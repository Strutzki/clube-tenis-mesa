import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// comprovante-url — devolve um link ASSINADO temporário para um comprovante de
// W.O. guardado no bucket PRIVADO. Exige PIN (só admin). Os arquivos não têm
// leitura pública; a única forma de ver é por este link, que expira em 1 hora.
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
const BUCKET = "comprovantes-wo";

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

  const { pin, path } = body || {};
  if (!pin || !path) return jsonResponse({ sucesso: false, erro: "pin e path são obrigatórios" }, 400);

  const check = await pinValido(String(pin));
  if (!check.ok) return jsonResponse({ sucesso: false, erro: check.motivo }, 401);

  // Só assina caminhos deste bucket e sem travessia de diretório.
  const p = String(path).replace(/^\/+/, "");
  if (p.includes("..")) return jsonResponse({ sucesso: false, erro: "Caminho inválido." }, 400);

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(p, 3600);
  if (error) return jsonResponse({ sucesso: false, erro: error.message }, 500);
  return jsonResponse({ sucesso: true, dados: { url: data.signedUrl } });
});
