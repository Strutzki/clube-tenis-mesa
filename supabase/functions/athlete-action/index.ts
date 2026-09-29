import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// athlete-action — ações do ATLETA (sem PIN), validadas no servidor.
// ============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// --- Multi-circuito (Fase 4A) --------------------------------------------
// circuito_id do circuito de producao (BH). Memoizado por instancia.
// Enquanto o app nao envia payload.circuitoId, tudo resolve para BH -> comportamento identico.
let _bhId: string | null = null;
async function bhId(): Promise<string> {
  if (_bhId) return _bhId;
  const { data, error } = await supabase.from("circuitos").select("id").eq("slug", "bh").single();
  if (error) throw error;
  _bhId = data!.id as string;
  return _bhId;
}

// --- Dual-write (Fase 4B) -------------------------------------------------
// Espelho BEST-EFFORT em circuito_atletas: se falhar, apenas loga (o BH segue via atletas).
const SEASONAL_COLS = new Set([
  "status","motivo_reprovacao","pendente_circuito","ultima_recusa_circuito_em","chave",
  "saldo_temp","vitorias","derrotas","vitorias_total","derrotas_total","wo_culposos_temporada",
  "aceite_regulamento","data_aceite_regulamento","versao_regulamento",
  "pagamento_confirmado","pagamento_proxima_confirmado","desconto_pct","isento",
  "quer_renovar","renovacao_em","historico","posicao_historico",
]);
function seasonalOnly(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k in obj) if (SEASONAL_COLS.has(k)) out[k] = obj[k];
  return out;
}
// O parametro `ehEspelho` (29/09/2026, gemeo do que o admin-action ganhou no
// item 0.6.18): "best-effort" so e aceitavel quando isto e MESMO um espelho --
// isto e, quando `atletas` ja recebeu a mesma escrita e o BH segue por la. Num
// circuito NAO-BH o campo sazonal nao tem outro lugar: esta e a UNICA escrita.
// Engolir o erro ali faz a funcao responder `sucesso: true` sem ter gravado nada
// -- e o campo em questao e `versao_regulamento`/`data_aceite_regulamento`, ou
// seja, o RECIBO DE CONSENTIMENTO. O atleta ve "aceito", o clube nao tem prova, e
// ninguem fica sabendo: so um `console.warn` num log que ninguem le.
async function mirrorSazonal(circuitoId: string, atletaId: string, campos: Record<string, unknown>, extra: Record<string, unknown> = {}, ehEspelho = true) {
  try {
    const dados = seasonalOnly(campos);
    if (Object.keys(dados).length === 0 && Object.keys(extra).length === 0) return;
    const { error } = await supabase.from("circuito_atletas")
      .upsert({ circuito_id: circuitoId, atleta_id: atletaId, ...dados, ...extra }, { onConflict: "circuito_id,atleta_id" });
    if (error) throw error;
  } catch (e) {
    if (!ehEspelho) throw e; // unica escrita: o erro TEM de subir, senao mente "sucesso"
    console.warn("dual-write circuito_atletas falhou (BH segue via atletas):", (e as any)?.message);
  }
}
// Escreve update de atleta roteando por circuito (blindagem cross-tenant):
// BH -> atletas (fonte do app) + espelho; nao-BH -> identidade em atletas, sazonal so em circuito_atletas.
// Resolve o atleta a partir do token de sessão. Mesma implementação do
// `login-atleta` (que guarda só o hash do token), repetida aqui porque esta
// função não tinha nenhuma verificação de sessão — todas as ações confiam no
// `athleteId` do payload. Para o RE-ACEITE isso não serve: os ids são públicos
// no ranking, e um recibo de consentimento forjável não prova nada.
//
// Usada SÓ pelo ACEITAR_REGULAMENTO. As demais ações seguem como estavam; mudar
// o modelo de autenticação delas é outra onda (e outro risco).
async function sha256hexAA(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function atletaPorTokenAA(token: unknown): Promise<string | null> {
  if (!token || typeof token !== "string") return null;
  const hash = await sha256hexAA(token);
  const { data } = await supabase.from("atleta_sessao").select("id,atleta_id,expira_em").eq("token_hash", hash).maybeSingle();
  if (!data) return null;
  if (new Date(data.expira_em) < new Date()) return null; // expirada: não renova nem apaga aqui
  return data.atleta_id;
}

async function writeAtleta(circuitoId: string, atletaId: string, campos: Record<string, unknown>) {
  const bh = await bhId();
  if (circuitoId === bh) {
    const { error } = await supabase.from("atletas").update(campos).eq("id", atletaId);
    if (error) throw error;
    await mirrorSazonal(circuitoId, atletaId, campos);
    return;
  }
  const identidade: Record<string, unknown> = {};
  for (const k in campos) if (!SEASONAL_COLS.has(k)) identidade[k] = campos[k];
  const escreveuIdentidade = Object.keys(identidade).length > 0;
  if (escreveuIdentidade) {
    const { error } = await supabase.from("atletas").update(identidade).eq("id", atletaId);
    if (error) throw error;
  }
  // `ehEspelho = escreveuIdentidade`: aqui `circuito_atletas` so e espelho de
  // alguma coisa se `atletas` tambem recebeu escrita. Quando os campos sao todos
  // sazonais (o caso do re-aceite e da renovacao) esta e a unica gravacao que
  // acontece -- e entao o erro sobe.
  await mirrorSazonal(circuitoId, atletaId, campos, {}, escreveuIdentidade);
}

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

function scoreValido(n: unknown): boolean {
  return Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 99;
}

// Idade a partir de "AAAA-MM-DD". Devolve null quando NAO DA PARA SABER — e quem
// chama tem de tratar null como desconhecido, nunca como maior de idade.
function idadeDeISO(iso: string | null | undefined): number | null {
  const t = String(iso ?? "").trim();
  if (!t) return null;
  const d = new Date(t + "T00:00:00Z");
  if (isNaN(d.getTime())) return null;
  const h = new Date();
  let anos = h.getUTCFullYear() - d.getUTCFullYear();
  const dm = h.getUTCMonth() - d.getUTCMonth();
  if (dm < 0 || (dm === 0 && h.getUTCDate() < d.getUTCDate())) anos--;
  return anos;
}

// ── CPF (identidade nacional) — helpers. Spec: ESPEC_CPF_SEGURANCA.md ─────────
// O CPF cru NUNCA entra em SQL/log/URL: normaliza + valida DV em memória; só o HMAC
// (hash) trafega pro banco. Pepper vem do Vault via RPC service-role-only.
function cpfNormaliza(s: unknown): string | null {
  const d = String(s ?? "").replace(/\D/g, "");
  return d.length === 11 ? d : null;
}
function cpfDVValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // rejeita 000..., 111..., etc.
  const dv = (base: string, pesoIni: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += parseInt(base[i], 10) * (pesoIni - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  if (dv(cpf.slice(0, 9), 10) !== parseInt(cpf[9], 10)) return false;
  return dv(cpf.slice(0, 10), 11) === parseInt(cpf[10], 10);
}
let _cpfPepper: string | null = null;
async function getCpfPepper(): Promise<string> {
  if (_cpfPepper) return _cpfPepper;
  const { data, error } = await supabase.rpc("get_cpf_pepper");
  if (error) throw error;
  const pep = (typeof data === "string" ? data : (data as any)) as string;
  if (!pep) throw new Error("pepper_indisponivel");
  _cpfPepper = pep;
  return pep;
}
async function cpfHmacHex(cpf: string, pepper: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(cpf));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
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

  const { acao, payload } = body || {};
  if (!acao) return jsonResponse({ sucesso: false, erro: "acao é obrigatória" }, 400);

  // Circuito alvo: o que o app enviar, ou BH por padrao (transicao single-tenant).
  const circuitoId = (payload && payload.circuitoId) ? String(payload.circuitoId) : await bhId();

  try {
    switch (acao) {

      case "INSCREVER": {
        const p = payload || {};
        const nome = String(p.nome || "").trim();
        const telefone = String(p.telefone || "").replace(/\D/g, "");
        if (!nome) return jsonResponse({ sucesso: false, erro: "Nome é obrigatório." }, 400);
        if (telefone.length < 10) return jsonResponse({ sucesso: false, erro: "Telefone inválido." }, 400);

        // Fatia 5: valida o circuito alvo NO SERVIDOR (não confia no circuitoId do cliente).
        // A flag/versão vivem em `circuitos` p/ todos (inclusive BH). Fecha inscrição em
        // circuito fechado/inexistente e carimba a versão do regulamento do próprio circuito.
        const { data: circ, error: eCirc } = await supabase
          .from("circuitos").select("ativo,inscricoes_abertas,regulamento_versao").eq("id", circuitoId).maybeSingle();
        if (eCirc) throw eCirc;
        if (!circ) return jsonResponse({ sucesso: false, erro: "Circuito não encontrado." }, 404);
        if (!circ.ativo) return jsonResponse({ sucesso: false, erro: "Este circuito está inativo." }, 400);
        if (!circ.inscricoes_abertas) return jsonResponse({ sucesso: false, erro: "As inscrições deste circuito estão fechadas no momento." }, 400);
        // Fail-closed: sem saber a versão do regulamento, não se colhe aceite.
        // O app já barra isto na tela (Onda 0.10.1), mas a tela não é o portão —
        // qualquer um pode chamar a função direto. Um aceite carimbado com a versão
        // errada é pior que inscrição recusada: vira recibo falso. Fica AQUI, junto
        // das outras guardas do circuito, para nada ter sido escrito ainda.
        const versaoDoCircuito = String(circ.regulamento_versao ?? "").trim();
        if (!versaoDoCircuito) {
          return jsonResponse({ sucesso: false, erro: "Não foi possível confirmar a versão do regulamento deste circuito. Tente de novo em instantes." }, 409);
        }

        // ── CPF (Fatia 5) — OBRIGATÓRIO no servidor (backstop; o front já exige). Decisão Juliano: exigir de todos já.
        // (Atletas já cadastrados não passam por aqui — o backfill deles é fatia futura.)
        const ipReq = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
        const temCpf = String(p.cpf ?? "").replace(/\D/g, "").length > 0;
        if (!temCpf) return jsonResponse({ sucesso: false, erro: "cpf_obrigatorio" }, 400);
        if (!p.cpfConsent) return jsonResponse({ sucesso: false, erro: "cpf_consentimento_obrigatorio" }, 400);
        // ── MENOR DE IDADE — OBRIGATORIO NO SERVIDOR (27/09/2026) ──────────────
        // Esta funcao e a PORTA DA FRENTE: por aqui entra todo atleta novo, e e o
        // unico caminho para o BH. E ela nao tinha guarda de menor NENHUMA: a unica
        // linha era `if (p.responsavelCpf)`, que validava o digito SE o campo viesse.
        // A trava era so a tela.
        // Achado por dois guardioes (Juridico e Seguranca) em 27/09/2026, e os dois
        // o classificaram ACIMA do que eles mesmos tinham vindo cobrar, por uma razao
        // que nomearam bem: o PARTICIPAR (a porta de servico, para quem ja tem
        // cadastro) tinha acabado de ganhar a guarda, e a porta da frente ficou mais
        // frouxa que ela. Para o menor que entra por aqui, a violacao do art. 14 da
        // LGPD acontece no cadastro — antes de qualquer outra tela poder impedir.
        //
        // Fail-closed nas tres pontas, no mesmo desenho do PARTICIPAR: data ausente
        // recusa, data absurda recusa, e menor sem responsavel recusa. Idade que nao
        // da para calcular e RECUSA, nao liberacao.
        const idadeInsc = idadeDeISO(p.dataNascimento);
        if (idadeInsc === null) {
          return jsonResponse({ sucesso: false, erro: "Informe a data de nascimento para concluir a inscrição." }, 400);
        }
        if (idadeInsc < 0 || idadeInsc > 120) {
          return jsonResponse({ sucesso: false, erro: "Confira a data de nascimento: o ano informado não parece válido." }, 400);
        }
        // A segunda camada do fail-closed, agora EXPLICITA (28/09/2026).
        // Ate aqui esta linha era so `if (idadeInsc < 18)`, e a protecao do caso nulo
        // vinha da coercao de tipo do JavaScript (`null < 18` e `true`) mais um
        // comentario de seis linhas proibindo a "limpeza" `idadeInsc !== null &&`.
        // O Guardiao de Seguranca aplicou exatamente essa reescrita proibida e a
        // BATERIA FICOU VERDE: com a guarda de cima de pe, esta linha nunca recebe
        // nulo, entao nenhuma assercao de comportamento consegue distinguir as duas
        // formas. Comentario nao e portao. Escrever `idadeInsc === null ||` faz a
        // regra dizer o que quer dizer, sem depender de coercao e sem deixar nada
        // para alguem "limpar" depois.
        if (idadeInsc === null || idadeInsc < 18) {
          if (!String(p.responsavelNome ?? "").trim() || !String(p.responsavelCpf ?? "").trim()) {
            return jsonResponse({ sucesso: false, erro: "Para menor de 18 anos, a lei exige o consentimento de um responsável legal. Volte ao passo 1 e preencha o nome e o CPF do responsável." }, 400);
          }
        }

        let cpfHash: string | null = null;
        let respCpfHash: string | null = null;
        if (temCpf) {
          const cpf = cpfNormaliza(p.cpf);
          if (!cpf || !cpfDVValido(cpf)) return jsonResponse({ sucesso: false, erro: "cpf_invalido" }, 400);
          // Rate-limit por IP (2ª camada; anti-oráculo de existência).
          const desdeRl = new Date(Date.now() - 15 * 60_000).toISOString();
          const { count: tentIp } = await supabase.from("tentativas_busca_cpf")
            .select("*", { count: "exact", head: true }).gte("tentativa_em", desdeRl).eq("ip", ipReq);
          if ((tentIp ?? 0) >= 12) return jsonResponse({ sucesso: false, erro: "muitas_tentativas" }, 429);
          await supabase.from("tentativas_busca_cpf").insert({ ip: ipReq });
          const pepper = await getCpfPepper();
          cpfHash = await cpfHmacHex(cpf, pepper);
          const { data: dd, error: eDd } = await supabase.rpc("dedup_por_cpf_hash", { p_hash: cpfHash });
          if (eDd) throw eDd;
          const existe = Array.isArray(dd) ? !!dd[0]?.existe : !!(dd as any)?.existe;
          if (existe) return jsonResponse({ sucesso: false, erro: "cpf_duplicado" }, 409);
          // Menor de idade: hash do CPF do responsável. Nunca guarda o número.
          // O "(se enviado)" que estava aqui deixou de valer em 27/09/2026: para menor
          // de 18 o campo passou a ser OBRIGATÓRIO, exigido na guarda acima. O `if`
          // continua porque maior de idade não manda responsável nenhum.
          if (p.responsavelCpf) {
            const rc = cpfNormaliza(p.responsavelCpf);
            if (!rc || !cpfDVValido(rc)) return jsonResponse({ sucesso: false, erro: "cpf_responsavel_invalido" }, 400);
            respCpfHash = await cpfHmacHex(rc, pepper);
          }
        }

        const federado = !!p.federado;
        let rating: number | null = 250;
        if (federado) {
          const r = Number(p.rating);
          rating = (Number.isFinite(r) && r > 0 && r <= 3000) ? Math.round(r) : null;
        }

        const dataAceite = p.dataAceite || new Date().toISOString();
        const linha = {
          nome,
          telefone,
          apelido: p.apelido ? String(p.apelido) : null,
          federado,
          rating,
          rating_inicial: rating,
          saldo_temp: 0,
          status: "pendente",
          aceite_regulamento: !!p.aceiteRegulamento,
          data_aceite_regulamento: p.aceiteRegulamento ? dataAceite : null,
          // Carimba a versão QUE O CIRCUITO DECLARA. Sem fallback, de propósito:
          // o `|| VERSAO_REGULAMENTO` que estava aqui gravava "v03-12" — a versão
          // do BH, com torneio e com o desconto de 80% — em QUALQUER circuito cuja
          // versão não tivesse sido lida. O recibo ficaria provadamente falso, que
          // é exatamente o defeito que a Onda 0.10.1 fechou no app. O servidor não
          // podia continuar fail-OPEN no lugar que grava o aceite (13/09/2026).
          // A guarda que impede chegar aqui sem versão está logo acima.
          versao_regulamento: versaoDoCircuito,
          aceite_lgpd: !!p.aceiteLGPD,
          data_aceite_lgpd: p.aceiteLGPD ? dataAceite : null,
          cpf_verificado: temCpf, // true só quando veio CPF válido e não-duplicado (doc gravado abaixo)
          inscrito_em: dataAceite,
        };

        const { data: novoAtleta, error } = await supabase.from("atletas").insert(linha).select("id").single();
        if (error) {
          const msg = String(error.message || "");
          if (msg.includes("atletas_telefone_unique") || msg.includes("duplicate key")) {
            return jsonResponse({ sucesso: false, erro: "telefone_duplicado" }, 409);
          }
          throw error;
        }
        // CPF (Fatia 3): grava o documento na tabela blindada. Corrida no cpf_hash UNIQUE
        // (dedup passou mas outro inscreveu no meio) → desfaz o atleta recém-criado (sem órfão).
        if (temCpf && novoAtleta?.id) {
          const { error: eDoc } = await supabase.from("atleta_documento").insert({
            atleta_id: novoAtleta.id,
            cpf_hash: cpfHash,
            cpf_consent_em: p.cpfConsent ? dataAceite : null,
            cpf_consent_versao: p.cpfConsentVersao ? String(p.cpfConsentVersao) : null,
            cpf_consent_ip: ipReq,
            data_nascimento: p.dataNascimento || null,
            responsavel_nome: p.responsavelNome ? String(p.responsavelNome) : null,
            responsavel_cpf_hash: respCpfHash,
          });
          if (eDoc) {
            await supabase.from("atletas").delete().eq("id", novoAtleta.id); // rollback do atleta
            const md = String(eDoc.message || "");
            if (md.includes("duplicate") || md.includes("unique") || md.includes("cpf_hash")) {
              return jsonResponse({ sucesso: false, erro: "cpf_duplicado" }, 409);
            }
            return jsonResponse({ sucesso: false, erro: "falha_documento" }, 500);
          }
        }
        // Dual-write: cria a participacao do atleta no circuito (membership + estado sazonal inicial).
        //
        // `ehEspelho` so vale para o BH. Em `atletas` NAO EXISTE coluna de circuito:
        // a linha de `circuito_atletas` e o UNICO registro de que este atleta e
        // deste circuito. No BH o roster ainda e lido pelo jeito antigo
        // (`atletas` com status='ativo'), entao uma falha ali degrada mas nao
        // apaga ninguem. Num circuito novo ela apaga: o atleta fica existindo
        // globalmente e membro de circuito nenhum -- invisivel no roster, fora do
        // pareamento, com o recibo de regulamento sem circuito a que se referir --
        // e o app responderia "inscricao feita".
        if (novoAtleta?.id) {
          const ehBhInsc = circuitoId === (await bhId());
          try {
            await mirrorSazonal(circuitoId, novoAtleta.id as string, linha, { inscrito_em: dataAceite }, ehBhInsc);
          } catch (eMemb) {
            // Sem membership nao ha inscricao: desfaz o atleta recem-criado, como
            // o rollback do documento acima faz, para nao deixar orfao.
            //
            // ⚠️ O ERRO DO DELETE E LIDO (Guardiao Juridico + Guardiao do Atleta,
            // 29/09/2026). Ate aqui ele era `await ... .delete()` sem `if (error)`,
            // e a resposta afirmava "Nada foi salvo" de qualquer jeito. Se o delete
            // falhasse -- a mesma indisponibilidade que acabara de derrubar a
            // escrita do vinculo --, sobrava um atleta orfao COM cpf_hash, data de
            // nascimento e nome do responsavel em claro, e o titular lia que nada
            // fora salvo. Afirmar ao titular um fato que o banco nao sustenta e
            // exatamente o defeito que esta onda veio consertar.
            const { error: eUndo } = await supabase.from("atletas").delete().eq("id", novoAtleta.id);
            console.error("membership circuito_atletas falhou; inscricao desfeita:", (eMemb as any)?.message);
            if (eUndo) {
              // O beco sem saida que o guardiao do Atleta mapeou: mandar "tente de
              // novo" aqui leva o atleta a "telefone ja cadastrado" e dali a "seu
              // cadastro nao foi aprovado", para sempre -- e o organizador nao o ve,
              // porque ele nao tem vinculo com circuito nenhum.
              console.error("ROLLBACK FALHOU — atleta orfao em `atletas`:", novoAtleta.id, (eUndo as any)?.message);
              return jsonResponse({ sucesso: false, erro: "Não conseguimos concluir nem desfazer sua inscrição. Fale com o organizador antes de tentar de novo." }, 500);
            }
            return jsonResponse({ sucesso: false, erro: "Sua inscrição não foi concluída. Tente de novo em instantes." }, 500);
          }
        }
        return jsonResponse({ sucesso: true });
      }

      case "ENVIAR_PLACAR": {
        const { matchId, athleteId, score1, score2 } = payload || {};
        if (!matchId || !athleteId) return jsonResponse({ sucesso: false, erro: "matchId e athleteId são obrigatórios" }, 400);
        if (!scoreValido(score1) || !scoreValido(score2)) {
          return jsonResponse({ sucesso: false, erro: "Placar inválido." }, 400);
        }

        const { data: partida, error: errP } = await supabase
          .from("partidas").select("circuito_id,atleta1_id,atleta2_id,prazo,fora_do_prazo,validado,rejeitado,wo_tipo,p1_placar1,p1_placar2,p2_placar1,p2_placar2").eq("id", matchId).single();
        if (errP) throw errP;
        if (!partida) return jsonResponse({ sucesso: false, erro: "Partida não encontrada." }, 404);
        if (partida.validado || partida.rejeitado) {
          return jsonResponse({ sucesso: false, erro: "Esta partida já foi encerrada." }, 409);
        }

        const now = new Date().toISOString();
        let upd: Record<string, unknown>;
        if (athleteId === partida.atleta1_id) {
          upd = { p1_placar1: score1, p1_placar2: score2, p1_enviado_em: now };
        } else if (athleteId === partida.atleta2_id) {
          upd = { p2_placar1: score1, p2_placar2: score2, p2_enviado_em: now };
        } else {
          return jsonResponse({ sucesso: false, erro: "Você não participa desta partida." }, 403);
        }

        // Sinaliza (nao bloqueia) placar fora do prazo — o admin decide. Vale se ESTE envio
        // e' tardio OU se a partida ja estava marcada (um envio anterior foi tardio).
        const hojeSP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
        const isForaPrazo = !!(partida.prazo && hojeSP > String(partida.prazo)) || !!partida.fora_do_prazo;
        if (isForaPrazo) upd.fora_do_prazo = true;

        const { error } = await supabase.from("partidas").update(upd).eq("id", matchId);
        if (error) throw error;

        try {
          // Fora do prazo NAO auto-valida: cai em "Aguardando Validacao" para o admin decidir.
          // ⚠️ ISTO LIA A CONFIGURACAO DO BH EM QUALQUER CIRCUITO (ate 29/09/2026):
          // `from("configuracao").eq("id", 1)` e a tabela LEGADA, que so vale para o
          // BH. O `DEFINIR_AUTO_VALIDAR` grava, para circuito nao-BH, em
          // `circuitos.auto_validar_placar` -- coluna que existe e que NINGUEM LIA.
          // Efeito medido pelo Guardiao de Seguranca rodando este motor: com o
          // circuito novo marcado DESLIGADO e o BH LIGADO (que e o estado de
          // producao hoje), a partida do circuito novo era auto-validada assim
          // mesmo. O organizador dele nao tinha como desligar: o botao gravava numa
          // coluna que ninguem consultava.
          // ⚠️ O CIRCUITO VEM DA PARTIDA, NAO DO CLIENTE. Achado do Guardiao de
          // Seguranca em 29/09/2026, e o defeito e meu: ao consertar a
          // auto-validacao eu transformei `payload.circuitoId` -- que ate entao era
          // decorativo aqui -- em PARAMETRO DE DECISAO, sem validar a origem dele.
          // Medido: partida de um circuito com a auto-validacao DESLIGADA pelo
          // organizador, os dois atletas mandando o mesmo placar com
          // `circuitoId: <BH>` no corpo do pedido -> `autoValidado: true`. O atleta
          // escolhia de qual circuito saia a regra e passava por cima do botao do
          // organizador. A partida sempre soube a que circuito pertence; bastava
          // perguntar a ela.
          const circuitoDaPartida = (partida as any).circuito_id || circuitoId;
          const ehBhAuto = circuitoDaPartida === (await bhId());
          const { data: cfg } = ehBhAuto
            ? await supabase.from("configuracao").select("auto_validar_placar").eq("id", 1).maybeSingle()
            : await supabase.from("circuitos").select("auto_validar_placar").eq("id", circuitoDaPartida).maybeSingle();
          if (cfg?.auto_validar_placar === true && !partida.wo_tipo && !isForaPrazo) {
            const ehA = athleteId === partida.atleta1_id;
            const p1p1 = ehA ? score1 : partida.p1_placar1;
            const p1p2 = ehA ? score2 : partida.p1_placar2;
            const p2p1 = ehA ? partida.p2_placar1 : score1;
            const p2p2 = ehA ? partida.p2_placar2 : score2;
            const ambosEnviaram = p1p1 != null && p1p2 != null && p2p1 != null && p2p2 != null;
            const batem = p1p1 === p2p1 && p1p2 === p2p2;
            if (ambosEnviaram && batem) {
              const { error: errAuto } = await supabase.from("partidas").update({
                placar1: p1p1, placar2: p1p2,
                validado: true, validado_por_admin: false, validado_automatico: true,
                admin_aprovado_em: now, calculado: false,
              }).eq("id", matchId).eq("validado", false).eq("rejeitado", false);
              if (errAuto) throw errAuto;
              return jsonResponse({ sucesso: true, dados: { autoValidado: true } });
            }
          }
        } catch (eAuto) {
          console.warn("Auto-validação não aplicada:", (eAuto as any)?.message);
        }

        return jsonResponse({ sucesso: true });
      }

      case "ATUALIZAR_PERFIL": {
        const { athleteId, foto_url, estilo_jogo } = payload || {};
        if (!athleteId) return jsonResponse({ sucesso: false, erro: "athleteId é obrigatório" }, 400);
        const upd: Record<string, unknown> = {};
        if (typeof foto_url === "string") upd.foto_url = foto_url;
        if (typeof estilo_jogo === "string") upd.estilo_jogo = estilo_jogo;
        if (Object.keys(upd).length === 0) {
          return jsonResponse({ sucesso: false, erro: "Nada para atualizar." }, 400);
        }
        const { error } = await supabase.from("atletas").update(upd).eq("id", athleteId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      // RE-ACEITE do regulamento. O aceite original é colhido no INSCREVER; este
      // é para quando o circuito TROCA de versão e o atleta já é membro.
      //
      // Por que ele existe (0.10.15(b), 18/09/2026): o ROADMAP dizia que "a
      // renovação é o momento natural de re-colher o aceite". Era falso — o
      // `RENOVAR` logo abaixo grava só `quer_renovar`, não exibe texto, não pede
      // caixa de seleção e não carimba versão. Sem esta ação, os atletas entram
      // numa temporada com preço novo tendo aceitado textos de várias versões
      // atrás, e o único ato deles terá sido apertar "quero renovar".
      case "ACEITAR_REGULAMENTO": {
        const p = payload || {};

        // Autenticado por TOKEN DE SESSÃO, não pelo `athleteId` do payload como
        // as outras ações desta função. Os ids dos atletas são públicos no
        // ranking: para renovar isso passa, para um RECIBO DE CONSENTIMENTO não
        // — qualquer um aceitaria pelo outro, e o recibo não provaria nada.
        const atletaId = await atletaPorTokenAA(p.token);
        // Texto pronto para o atleta ler, não um código. A lista branca do app
        // exige que toda mensagem que chega à tela exista literalmente aqui — e
        // "sessao_invalida" viraria o genérico "tente de novo", que é errado:
        // tentar de novo sem logar falha igual, em loop.
        if (!atletaId) return jsonResponse({ sucesso: false, erro: "Sua sessão expirou. Entre de novo para confirmar o aceite." }, 401);

        const { data: circAc, error: eCircAc } = await supabase.from("circuitos")
          .select("regulamento_versao").eq("id", circuitoId).maybeSingle();
        if (eCircAc) throw eCircAc;
        if (!circAc) return jsonResponse({ sucesso: false, erro: "Circuito não encontrado." }, 404);

        // Fail-closed, como o INSCREVER: sem versão não se carimba aceite.
        const versaoAtual = String(circAc.regulamento_versao ?? "").trim();
        if (!versaoAtual) {
          return jsonResponse({ sucesso: false, erro: "Não foi possível confirmar a versão do regulamento deste circuito. Tente de novo em instantes." }, 409);
        }

        // O atleta declara QUAL versão está aceitando. Se ela mudou entre a tela
        // carregar e o clique, recusa em vez de carimbar uma versão que ele não
        // leu — é o mesmo cuidado que faz o INSCREVER recusar sem versão.
        const versaoVista = String(p.versaoVista ?? "").trim();
        if (versaoVista !== versaoAtual) {
          return jsonResponse({ sucesso: false, erro: "O regulamento mudou enquanto você lia. Recarregue e leia a versão nova antes de aceitar." }, 409);
        }

        // Tem de ser membro DESTE circuito — senão o aceite não tem objeto.
        const { data: vinc, error: eVinc } = await supabase.from("circuito_atletas")
          .select("atleta_id,status").eq("circuito_id", circuitoId).eq("atleta_id", atletaId).maybeSingle();
        if (eVinc) throw eVinc;
        if (!vinc) return jsonResponse({ sucesso: false, erro: "Você não participa deste circuito." }, 403);

        await writeAtleta(circuitoId, atletaId, {
          aceite_regulamento: true,
          data_aceite_regulamento: new Date().toISOString(),
          versao_regulamento: versaoAtual,
        });
        return jsonResponse({ sucesso: true, dados: { versao: versaoAtual } });
      }

      case "RENOVAR": {
        const { athleteId, quer } = payload || {};
        if (!athleteId) return jsonResponse({ sucesso: false, erro: "athleteId é obrigatório" }, 400);
        const { data: atleta, error: errA } = await supabase.from("atletas").select("status").eq("id", athleteId).single();
        if (errA) throw errA;
        if (!atleta) return jsonResponse({ sucesso: false, erro: "Atleta não encontrado." }, 404);
        if (atleta.status !== "ativo") return jsonResponse({ sucesso: false, erro: "Apenas atletas ativos podem renovar." }, 403);
        const querRenovar = quer === false ? false : true;
        const updRenovar = {
          quer_renovar: querRenovar,
          renovacao_em: querRenovar ? new Date().toISOString() : null,
        };
        await writeAtleta(circuitoId, athleteId, updRenovar);
        return jsonResponse({ sucesso: true, dados: { querRenovar } });
      }

      // Guarda o handle (credId) da credencial WebAuthn no cadastro do atleta.
      // NAO e' segredo (nao autentica no servidor; e' so o "gate" local). Guardar
      // aqui permite recuperar a biometria depois que o navegador limpa o localStorage.
      // bio_cred_ids e' IDENTIDADE (compartilhada entre circuitos) -> grava direto em atletas.
      case "SALVAR_BIO_CRED": {
        const { atletaId, credId } = payload || {};
        if (!atletaId || !credId || typeof credId !== "string") {
          return jsonResponse({ sucesso: false, erro: "atletaId e credId são obrigatórios" }, 400);
        }
        const { data: at, error: eSel } = await supabase.from("atletas").select("bio_cred_ids").eq("id", atletaId).single();
        if (eSel) throw eSel;
        const atual = Array.isArray(at?.bio_cred_ids) ? (at!.bio_cred_ids as string[]) : [];
        if (!atual.includes(credId)) {
          const novo = [...atual, credId].slice(-5); // no maximo 5 aparelhos por atleta
          const { error: eUpd } = await supabase.from("atletas").update({ bio_cred_ids: novo }).eq("id", atletaId);
          if (eUpd) throw eUpd;
        }
        return jsonResponse({ sucesso: true });
      }

      case "SOLICITAR_WO": {
        const p = payload || {};
        if (!p.id || !p.matchId || !p.athleteId) {
          return jsonResponse({ sucesso: false, erro: "id, matchId e athleteId são obrigatórios" }, 400);
        }
        const { data: partida, error: errP } = await supabase
          .from("partidas").select("atleta1_id,atleta2_id").eq("id", p.matchId).single();
        if (errP) throw errP;
        if (!partida) return jsonResponse({ sucesso: false, erro: "Partida não encontrada." }, 404);
        if (p.athleteId !== partida.atleta1_id && p.athleteId !== partida.atleta2_id) {
          return jsonResponse({ sucesso: false, erro: "Você não participa desta partida." }, 403);
        }

        const { error } = await supabase.from("solicitacoes_wo").insert({
          id: p.id,
          match_id: p.matchId,
          atleta_id: p.athleteId || null,
          atleta_nome: p.athleteName || null,
          adversario_id: p.adversarioId || null,
          adversario_nome: p.adversarioNome || null,
          round: p.round || null,
          justificativa: p.justificativa || null,
          comprovante_url: p.comprovanteUrl || null,
          status: "pendente",
          criado_em: p.criadoEm || new Date().toISOString(),
          circuito_id: circuitoId,
        });
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "CANCELAR_WO": {
        const { id } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        const { data: sol, error: errS } = await supabase
          .from("solicitacoes_wo").select("status").eq("id", id).eq("circuito_id", circuitoId).single();
        if (errS) throw errS;
        if (!sol) return jsonResponse({ sucesso: false, erro: "Solicitação não encontrada." }, 404);
        if (sol.status !== "pendente") {
          return jsonResponse({ sucesso: false, erro: "Só é possível cancelar uma solicitação ainda pendente." }, 409);
        }
        const { error } = await supabase.from("solicitacoes_wo").delete().eq("id", id).eq("status", "pendente").eq("circuito_id", circuitoId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "SOLICITAR_EXCLUSAO": {
        const { athleteId } = payload || {};
        if (!athleteId) return jsonResponse({ sucesso: false, erro: "athleteId é obrigatório" }, 400);
        const { error } = await supabase.from("atletas")
          .update({ exclusao_solicitada_em: new Date().toISOString() })
          .eq("id", athleteId).neq("status", "arquivado");
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      default:
        return jsonResponse({ sucesso: false, erro: `Ação desconhecida: ${acao}` }, 400);
    }
  } catch (e) {
    console.error(e);
    return jsonResponse({ sucesso: false, erro: (e as any).message || "Erro interno" }, 500);
  }
});
