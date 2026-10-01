import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// resetar-pin-atleta — o admin (com PIN de admin) apaga o PIN de um atleta que
// esqueceu. No próximo login, o atleta volta ao fluxo de "primeiro acesso" e
// cria um PIN novo. É o "destrava do admin" da Fase 3.
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

// ── TRAVA DE TENTATIVAS DE PIN — POR ORIGEM E POR PORTA, E FAIL-CLOSED ──────────
// Reescrita em 01/10/2026. A versao anterior contava `tentativa_em + sucesso` e mais
// nada, e a tabela nao guardava nem quem tentou nem em que porta. Tres defeitos:
//
//  1. TRANCAVA TODO MUNDO. Sem saber a origem, 5 erros de QUALQUER pessoa trancavam
//     a entrada de TODOS por 15 minutos -- inclusive o super-admin no proprio painel.
//     Nao precisava de ataque: bastava alguem achar o endereco e errar cinco vezes.
//  2. ABRIA QUANDO QUEBRAVA. O erro da contagem era descartado (`const { count }`),
//     entao banco fora do ar ou rede lenta devolvia `count` vazio, `(count ?? 0)`
//     virava zero, `0 >= 5` dava falso, e a trava LIBERAVA. Freio que abre ao
//     quebrar nao e freio. Agora recusa -- se nao da para conferir, nao passa.
//  3. SEIS PORTAS, UM CADERNO. As seis Edge Functions que pedem PIN usavam a MESMA
//     contagem, entao um erro em qualquer uma trancava as outras cinco -- inclusive
//     a `anonimizar-atleta`, que cumpre direito de exclusao de dados com PRAZO
//     LEGAL. Filtrar por `porta` da a cada uma a sua propria conta.
//
// `origem` nunca e NULL (vira 'desconhecida') para a contagem comparar sempre com
// `=` e nunca precisar de `IS NULL`. As linhas antigas tem NULL nas duas colunas,
// logo nao casam com nenhuma contagem nova -- os 18 erros historicos nao contam
// contra ninguem, o que e o comportamento certo.
//
// ⚠️ As SEIS funcoes tem esta mesma forma porque nao existe pasta compartilhada
// entre Edge Functions neste projeto. A bateria tem varredura que exige as seis
// iguais -- consertar uma e esquecer cinco e exatamente como este defeito viveu.
function ipDaChamada(req: Request): string {
  // Mesmo idioma que o `login-atleta` e o `athlete-action` ja usam.
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "desconhecida";
}
const PORTA = "resetar-pin-atleta";
const FALHA_CONFERIR = { ok: false, motivo: "Não foi possível conferir o acesso agora. Tente de novo em instantes." };
const BLOQUEADO = { ok: false, motivo: `Muitas tentativas incorretas desta origem. Aguarde ${JANELA_MINUTOS} minutos.` };

async function pinValido(pin: string, origem: string): Promise<{ ok: boolean; motivo?: string }> {
  const desde = new Date(Date.now() - JANELA_MINUTOS * 60_000).toISOString();
  const { count, error: errConta } = await supabase
    .from("tentativas_login_admin")
    .select("*", { count: "exact", head: true })
    .gte("tentativa_em", desde)
    .eq("sucesso", false)
    .eq("porta", PORTA)
    .eq("origem", origem);
  // FAIL-CLOSED: nao conseguir conferir e motivo para RECUSAR, nunca para liberar.
  if (errConta) return FALHA_CONFERIR;
  if ((count ?? 0) >= MAX_TENTATIVAS) return BLOQUEADO;
  const ok = pin === ADMIN_PIN;
  await supabase.from("tentativas_login_admin").insert({ sucesso: ok, porta: PORTA, origem });
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
      status, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ sucesso: false, erro: "Método não permitido" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return jsonResponse({ sucesso: false, erro: "JSON inválido" }, 400); }

  const { pin, id } = body || {};
  if (!pin || !id) return jsonResponse({ sucesso: false, erro: "pin e id são obrigatórios" }, 400);

  const check = await pinValido(String(pin), ipDaChamada(req));
  if (!check.ok) return jsonResponse({ sucesso: false, erro: check.motivo }, 401);

  const { error } = await supabase.from("atletas").update({
    pin_hash: null,
    pin_definido_em: null,
    pin_tentativas: 0,
    pin_bloqueado_ate: null,
  }).eq("id", id);
  if (error) throw error;

  return jsonResponse({ sucesso: true });
});
