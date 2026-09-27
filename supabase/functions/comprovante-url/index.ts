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

// ── PIN de ATLETA (organizador) — copia fiel do admin-action ──────────────────
// O organizador nao tem o PIN global; ele entra com telefone + PIN de atleta. Sem
// isto, abrir o comprovante de um W.O. do circuito DELE exigia o PIN do super-admin
// (0.6.4): ele decidia W.O. sem poder ver a prova.
function _b64(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)); }
function _fromB64(t: string): Uint8Array { return Uint8Array.from(atob(t), (c) => c.charCodeAt(0)); }
async function _deriveBits(pin: string, salt: Uint8Array, iter: number): Promise<Uint8Array> {
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, km, 256);
  return new Uint8Array(bits);
}
async function _verifyPin(pin: string, stored: string): Promise<boolean> {
  try {
    const [alg, iterStr, saltB64, hashB64] = stored.split("$");
    if (alg !== "pbkdf2") return false;
    const hash = await _deriveBits(pin, _fromB64(saltB64), parseInt(iterStr));
    const esperado = _b64(hash);
    if (esperado.length !== hashB64.length) return false;
    let diff = 0; for (let i = 0; i < esperado.length; i++) diff |= esperado.charCodeAt(i) ^ hashB64.charCodeAt(i);
    return diff === 0;
  } catch { return false; }
}
async function autenticarOrganizador(telefone: string, pin: string): Promise<{ atletaId?: string; bloqueado?: boolean }> {
  const alvo = String(telefone || "").replace(/\D/g, "");
  if (alvo.length < 10 || !pin) return {};
  const { data } = await supabase.from("atletas").select("id,telefone,pin_hash,pin_tentativas,pin_bloqueado_ate,status");
  const a = (data ?? []).find((x: any) => String(x.telefone || "").replace(/\D/g, "") === alvo);
  if (!a || !a.pin_hash || a.status !== "ativo") return {};
  if (a.pin_bloqueado_ate && new Date(a.pin_bloqueado_ate) > new Date()) return { bloqueado: true };
  const ok = await _verifyPin(String(pin), a.pin_hash);
  if (!ok) {
    const tent = (a.pin_tentativas || 0) + 1;
    const upd = tent >= 5 ? { pin_tentativas: 0, pin_bloqueado_ate: new Date(Date.now() + 15 * 60000).toISOString() } : { pin_tentativas: tent };
    await supabase.from("atletas").update(upd).eq("id", a.id);
    return {};
  }
  await supabase.from("atletas").update({ pin_tentativas: 0, pin_bloqueado_ate: null }).eq("id", a.id);
  return { atletaId: a.id };
}
async function ehOrganizadorDe(atletaId: string, circuitoId: string): Promise<boolean> {
  const { data } = await supabase.from("circuito_organizadores").select("atleta_id").eq("atleta_id", atletaId).eq("circuito_id", circuitoId).maybeSingle();
  return !!data;
}

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

  const { pin, path, orgTelefone, orgPin, circuitoId } = body || {};
  if (!path) return jsonResponse({ sucesso: false, erro: "path é obrigatório" }, 400);

  // AUTH — dois caminhos, espelhando o admin-action:
  //   super-admin  = PIN global (INALTERADO, inclusive a trava de tentativas);
  //   organizador  = telefone + PIN de atleta + o circuito dele.
  if (orgTelefone && orgPin) {
    if (!circuitoId) return jsonResponse({ sucesso: false, erro: "circuitoId é obrigatório" }, 400);
    const r = await autenticarOrganizador(String(orgTelefone), String(orgPin));
    if (r.bloqueado) return jsonResponse({ sucesso: false, erro: "Muitas tentativas. Aguarde alguns minutos." }, 429);
    if (!r.atletaId) return jsonResponse({ sucesso: false, erro: "Telefone ou PIN incorretos." }, 401);
    if (!(await ehOrganizadorDe(r.atletaId, String(circuitoId)))) {
      return jsonResponse({ sucesso: false, erro: "Você não organiza este circuito." }, 403);
    }
    // ESCOPO POR RECURSO: só assina o comprovante de um W.O. DESTE circuito. Sem isto,
    // o organizador de um circuito abriria a prova de um W.O. de outro (dado pessoal).
    const alvo = String(path).replace(/^\/+/, "");
    const { data: solW } = await supabase.from("solicitacoes_wo")
      .select("id").eq("circuito_id", String(circuitoId)).eq("comprovante_url", alvo).maybeSingle();
    if (!solW) return jsonResponse({ sucesso: false, erro: "Comprovante não é do seu circuito." }, 403);
  } else {
    if (!pin) return jsonResponse({ sucesso: false, erro: "pin e path são obrigatórios" }, 400);
    const check = await pinValido(String(pin));
    if (!check.ok) return jsonResponse({ sucesso: false, erro: check.motivo }, 401);
  }

  // Só assina caminhos deste bucket e sem travessia de diretório.
  const p = String(path).replace(/^\/+/, "");
  if (p.includes("..")) return jsonResponse({ sucesso: false, erro: "Caminho inválido." }, 400);

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(p, 3600);
  if (error) return jsonResponse({ sucesso: false, erro: error.message }, 500);
  return jsonResponse({ sucesso: true, dados: { url: data.signedUrl } });
});
