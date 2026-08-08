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

  return jsonResponse({ sucesso: true });
});
