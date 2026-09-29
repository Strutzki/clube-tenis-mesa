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
  }).eq("id", id);
  if (error) throw error;

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
  if (eVinc) throw eVinc;

  // ── AS SESSOES ABERTAS ────────────────────────────────────────────────────
  // Sem isto o aparelho dele continuava entrando no app depois da exclusao.
  await supabase.from("atleta_sessao").delete().eq("atleta_id", id);

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
  await supabase.from("atleta_documento").delete().eq("atleta_id", id);

  return jsonResponse({ sucesso: true });
});
