import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// anonimizar-atleta — FINALIZA um pedido de exclusão de dados (LGPD). Exige PIN
// (só admin). ANONIMIZA o atleta: apaga os dados pessoais e mantém a linha
// (com as estatísticas) para não quebrar as partidas dos adversários nem o
// histórico do circuito. Função isolada de propósito — fácil de remover se um
// dia quiser desfazer esta funcionalidade.
// ============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PIN = Deno.env.get("ADMIN_PIN")!;
// Bucket PUBLICO das fotos de perfil. O mesmo nome esta no `App.jsx`
// (`FOTOS_BUCKET`), onde o upload acontece.
const FOTOS_BUCKET = "fotos-atletas";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ALLOWED_ORIGINS = [
  "https://clubedotenisdemesabh.com.br",
  "https://www.clubedotenisdemesabh.com.br",
  "https://clube-tenis-mesa.vercel.app",
  // Desenvolvimento: o app rodando na maquina do Juliano (`npm run dev`).
  // Sem isto, o preflight responde com a origem de producao e o navegador corta
  // a chamada ANTES de sair da tela — nao da para entrar no app local, nem como
  // admin nem como atleta, e so as telas publicas carregam.
  // Nao afrouxa autenticacao: CORS so vale para navegador, e PIN/token continuam
  // exigidos aqui dentro. Quem chama por fora do navegador (curl) nunca passou
  // por CORS de todo jeito.
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const JANELA_MINUTOS = 15;
const MAX_TENTATIVAS = 5;

async function pinValido(pin: string): Promise<{ ok: boolean; motivo?: string }> {
  const desde = new Date(Date.now() - JANELA_MINUTOS * 60_000).toISOString();
  const { count } = await supabase
    .from("tentativas_login_admin")
    .select("*", { count: "exact", head: true })
    .gte("tentativa_em", desde)
    .eq("sucesso", false);

  if ((count ?? 0) >= MAX_TENTATIVAS) {
    return { ok: false, motivo: `Muitas tentativas incorretas. Aguarde ${JANELA_MINUTOS} minutos.` };
  }
  const ok = pin === ADMIN_PIN;
  await supabase.from("tentativas_login_admin").insert({ sucesso: ok });
  if (!ok) return { ok: false, motivo: "PIN inválido." };
  return { ok: true };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") || "";
  const CORS_HEADERS = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ sucesso: false, erro: "Método não permitido" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return jsonResponse({ sucesso: false, erro: "JSON inválido" }, 400); }

  const { pin, id } = body || {};
  if (!pin || !id) return jsonResponse({ sucesso: false, erro: "pin e id são obrigatórios" }, 400);

  const check = await pinValido(String(pin));
  if (!check.ok) return jsonResponse({ sucesso: false, erro: check.motivo }, 401);

  // ⚠️ A ORDEM DESTE BLOCO É A CORREÇÃO, e ela vale o dado do titular.
  //
  // Ate 29/09/2026 tudo o que podia falhar rodava DEPOIS do update que anonimiza,
  // e os `delete` nao checavam o proprio erro. O Guardiao Juridico e o de
  // Seguranca acharam a mesma coisa, separados, e a combinacao e uma armadilha
  // fechada: o CPF FICA, a identidade JA FOI destruida sem volta, a funcao
  // responde `sucesso: true`, e -- o pior -- o update ja gravou
  // `exclusao_solicitada_em: null`, entao O PEDIDO SOME DA FILA DO ADMIN
  // (`a.exclusaoSolicitadaEm && a.status !== "arquivado"`). Ninguem volta la. O
  // dado que o titular mandou apagar sobrevive, e nao resta sinal de que
  // sobreviveu.
  //
  // Agora: primeiro o que pode falhar, e qualquer falha ABORTA antes de a
  // identidade ser tocada e antes de o pedido sair da fila. O titular continua na
  // fila e o admin pode tentar de novo.

  // ── A FOTO. Bucket PUBLICO: anular `foto_url` no banco NAO tira o arquivo do
  // ar, e a URL continua servindo o ROSTO da pessoa para sempre, para quem a
  // tiver. As duas telas prometem apagar a foto. (Guardiao Juridico: 23 arquivos
  // para 13 atletas -- quem troca a foto deixa a antiga para tras, e ela tambem
  // continua publica.)
  // O padrao de nome e `<atletaId>-<timestamp>.jpg` (`uploadFotoAtleta` no
  // App.jsx), conferido em producao: 23 de 23 arquivos batem. O prefixo pega
  // todas as fotos da pessoa, inclusive as antigas.
  {
    const { data: fotos, error: eList } = await supabase.storage.from(FOTOS_BUCKET)
      .list("", { limit: 1000, search: String(id) });
    if (eList) return jsonResponse({ sucesso: false, erro: "Não consegui listar as fotos para apagar. Nada foi alterado — tente de novo." }, 500);
    const doAtleta = (fotos ?? []).map((f: any) => f.name).filter((n: string) => n.startsWith(String(id) + "-"));
    if (doAtleta.length > 0) {
      const { error: eRm } = await supabase.storage.from(FOTOS_BUCKET).remove(doAtleta);
      if (eRm) return jsonResponse({ sucesso: false, erro: "Não consegui apagar a foto. Nada foi alterado — tente de novo." }, 500);
    }
  }

  // ── O DOCUMENTO (CPF) ─────────────────────────────────────────────────────
  // DECISAO DO JULIANO, 29/09/2026, fechando a pendencia 0.7.2 do ROADMAP:
  // "vamos excluir quando o cliente pedir, mas deixar claro os impactos que pode
  // causar caso resolva voltar no futuro".
  //
  // O que sai daqui: o hash do CPF, a data de nascimento, e o nome e o hash do CPF
  // do responsavel legal quando o atleta era menor. Nenhum deles e o numero em si
  // -- o CPF nunca foi guardado em claro --, mas o hash e identificador estavel de
  // pessoa, e reter identificador de quem pediu exclusao contraria o pedido.
  //
  // O QUE SE PERDE, e esta escrito no texto que o atleta le antes de confirmar:
  //   · a trava de duplicata deixa de reconhece-lo -- ele pode se cadastrar de novo
  //     como pessoa nova, e o clube nao tem como saber que e a mesma pessoa;
  //   · em consequencia, um banimento por fraude (que o regulamento declara
  //     permanente) deixa de ser aplicavel automaticamente a um cadastro novo. Isto
  //     e um custo REAL da decisao, e fica registrado aqui para nao ser descoberto
  //     por acidente depois. O controlador escolheu o direito do titular.
  const { error: eDoc } = await supabase.from("atleta_documento").delete().eq("atleta_id", id);
  if (eDoc) return jsonResponse({ sucesso: false, erro: "Não consegui apagar o documento. Nada foi alterado — tente de novo." }, 500);

  // ── AS SESSOES ABERTAS ────────────────────────────────────────────────────
  // Sem isto o aparelho dele continuava entrando no app depois da exclusao.
  const { error: eSes } = await supabase.from("atleta_sessao").delete().eq("atleta_id", id);
  if (eSes) return jsonResponse({ sucesso: false, erro: "Não consegui encerrar as sessões. Nada foi alterado — tente de novo." }, 500);

  // ⚠️ ESTES DOIS BLOCOS FICAVAM DEPOIS DO `update` QUE ANONIMIZA, e a bateria
  // pegou: com a anonimizacao das mensagens falhando, a identidade ja tinha sido
  // destruida e o pedido ja tinha saido da fila. Tudo o que pode falhar vem ANTES.

  // ── O NOME EM CLARO NOS REGISTROS QUE PENDURAM NA PARTIDA ─────────────────
  // A tela diz ao titular que "as partidas continuam registradas SEM O SEU NOME".
  // Isso era verdade no ranking e na lista de jogos (o nome exibido vira "Atleta
  // removido"), e FALSO nos registros ao lado: `mensagens_enviadas` guarda
  // `atleta_nome` em claro -- e o nome ainda aparece DENTRO do `texto` --, e
  // `solicitacoes_wo` guarda `atleta_nome` e `adversario_nome`. O Guardiao
  // Juridico contou em producao: 288 e 5 linhas, todas com nome.
  //
  // A `justificativa` do W.O. merece nome proprio: e o campo de texto livre onde
  // o atleta explica POR QUE faltou ("estava internado com pneumonia" foi o
  // exemplo que o guardiao usou). Isso e DADO SENSIVEL DE SAUDE, e dado sensivel
  // nao sobrevive a um pedido de exclusao. Ele e APAGADO, nao anonimizado.
  const ANON = "Atleta removido";
  {
    const { data: msgs, error: eMsgSel } = await supabase.from("mensagens_enviadas")
      .select("id,atleta_nome,texto").eq("atleta_id", id);
    if (eMsgSel) return jsonResponse({ sucesso: false, erro: "Não consegui ler as mensagens para anonimizar. Nada foi alterado — tente de novo." }, 500);
    for (const m of msgs ?? []) {
      const nomeAntigo = String((m as any).atleta_nome || "");
      const texto = nomeAntigo
        ? String((m as any).texto || "").split(nomeAntigo).join(ANON)
        : (m as any).texto;
      const { error: eMsg } = await supabase.from("mensagens_enviadas")
        .update({ atleta_nome: ANON, texto }).eq("id", (m as any).id);
      if (eMsg) return jsonResponse({ sucesso: false, erro: "Não consegui anonimizar as mensagens. Nada foi alterado — tente de novo." }, 500);
    }
  }
  {
    const { error: eWo1 } = await supabase.from("solicitacoes_wo")
      .update({ atleta_nome: ANON, justificativa: null, comprovante_url: null }).eq("atleta_id", id);
    if (eWo1) return jsonResponse({ sucesso: false, erro: "Não consegui anonimizar os pedidos de W.O. Nada foi alterado — tente de novo." }, 500);
    // Ele tambem aparece como ADVERSARIO no pedido de outra pessoa.
    const { error: eWo2 } = await supabase.from("solicitacoes_wo")
      .update({ adversario_nome: ANON }).eq("adversario_id", id);
    if (eWo2) return jsonResponse({ sucesso: false, erro: "Não consegui anonimizar os pedidos de W.O. Nada foi alterado — tente de novo." }, 500);
  }

  // ── O VINCULO COM CADA CIRCUITO ───────────────────────────────────────────
  // ⚠️ Ate 29/09/2026 esta funcao era UM UNICO update em `atletas`. Achado do
  // Guardiao Juridico, provado rodando o motor: depois de "finalizar exclusao" a
  // linha do atleta em `circuito_atletas` continuava `status: 'ativo'`,
  // `pendente_circuito: false`, e -- o pior -- com `aceite_regulamento: true`,
  // `versao_regulamento` e `data_aceite_regulamento` PRESERVADOS. Ou seja: o
  // titular revogava o consentimento e o banco continuava provando que ele tinha
  // aceitado. E o `INICIAR_ETAPA` do circuito ainda o pareava normalmente.
  // No BH nao aparecia, porque la o roster e a propria linha de `atletas`.
  // A tela do admin promete "anonimiza o cadastro E O REMOVE DO CIRCUITO" -- era
  // falso fora do BH.
  const { error: eVinc } = await supabase.from("circuito_atletas").update({
    status: "arquivado",
    pendente_circuito: false,
    chave: null,
    aceite_regulamento: false,
    data_aceite_regulamento: null,
    versao_regulamento: null,
    motivo_reprovacao: null,
    quer_renovar: false,
    renovacao_em: null,
  }).eq("atleta_id", id);
  if (eVinc) return jsonResponse({ sucesso: false, erro: "Não consegui arquivar o vínculo com o circuito. Nada foi alterado — tente de novo." }, 500);

  // Anonimização: apaga o dado PESSOAL, mantém a linha e as estatísticas.
  // telefone é NOT NULL e único, então vira um token não-identificável por id.
  const { error } = await supabase.from("atletas").update({
    nome: "Atleta removido",
    telefone: "removido:" + id,
    apelido: null,
    foto_url: null,
    estilo_jogo: null,
    aceite_regulamento: false,
    data_aceite_regulamento: null,
    aceite_lgpd: false,
    data_aceite_lgpd: null,
    versao_regulamento: null,
    motivo_reprovacao: null,
    status: "arquivado",
    pendente_circuito: false,
    chave: null,
    exclusao_solicitada_em: null,
    // Nao faz sentido encerrar as sessoes e MANTER o segredo de autenticacao e os
    // identificadores dos aparelhos. E `cpf_verificado: true` sem documento
    // guardado e estado incoerente, que confunde quem for investigar depois.
    // (Guardiao Juridico, 29/09/2026.)
    pin_hash: null,
    pin_tentativas: 0,
    pin_bloqueado_ate: null,
    bio_cred_ids: [],
    cpf_verificado: false,
  }).eq("id", id);
  if (error) throw error;



  return jsonResponse({ sucesso: true });
});
