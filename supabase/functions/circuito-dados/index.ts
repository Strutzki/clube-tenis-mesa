import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// circuito-dados — PORTEIRO de leitura de um circuito (ranking + jogos).
// Regra de visibilidade:
//   - circuito ABERTO (publico=true): serve pra qualquer um, sem credencial.
//   - circuito PRIVADO (publico=false): só serve se quem pede provar que é de
//     dentro — atleta MEMBRO ou ORGANIZADOR. Prova por telefone+PIN OU por
//     token de sessão ("continuar conectado", reabrir o app sem PIN).
// Reusa a trava anti-força-bruta do login (pin_tentativas / pin_bloqueado_ate).
// Devolve SÓ colunas de exibição (sem telefone, CPF, e-mail, pagamento).
// ============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ALLOWED_ORIGINS = [
  "https://clubedotenisdemesabh.com.br",
  "https://www.clubedotenisdemesabh.com.br",
  "https://clube-tenis-mesa.vercel.app",
];

const MAX_TENTATIVAS_PIN = 5;
const BLOQUEIO_MINUTOS = 15;

const ATLETA_COLS = "id,nome,apelido,federado,rating,rating_inicial,saldo_temp,status,vitorias,derrotas,vitorias_total,derrotas_total,foto_url,estilo_jogo,rating_pico,rating_historico,posicao_historico,wo_culposos_temporada";

function normTel(t: unknown): string { return String(t ?? "").replace(/\D/g, ""); }
function fromB64(s: string): Uint8Array { return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); }
function b64(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)); }
async function deriveBits(pin: string, salt: Uint8Array, iter: number): Promise<Uint8Array> {
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, km, 256);
  return new Uint8Array(bits);
}
async function verifyPin(pin: string, stored: string): Promise<boolean> {
  try {
    const [alg, iterStr, saltB64, hashB64] = stored.split("$");
    if (alg !== "pbkdf2") return false;
    const hash = await deriveBits(pin, fromB64(saltB64), parseInt(iterStr));
    const esperado = b64(hash);
    if (esperado.length !== hashB64.length) return false;
    let diff = 0; for (let i = 0; i < esperado.length; i++) diff |= esperado.charCodeAt(i) ^ hashB64.charCodeAt(i);
    return diff === 0;
  } catch { return false; }
}
async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function atletaPorToken(token: unknown): Promise<string | null> {
  if (!token || typeof token !== "string") return null;
  const hash = await sha256hex(token);
  const { data } = await supabase.from("atleta_sessao").select("id,atleta_id,expira_em").eq("token_hash", hash).maybeSingle();
  if (!data) return null;
  if (new Date(data.expira_em) < new Date()) { await supabase.from("atleta_sessao").delete().eq("id", data.id); return null; }
  return data.atleta_id;
}
async function acharAtleta(tel: string): Promise<any | null> {
  const alvo = normTel(tel);
  if (alvo.length < 10) return null;
  const { data } = await supabase.from("atletas").select("id,telefone,pin_hash,pin_tentativas,pin_bloqueado_ate,status");
  return (data ?? []).find((a: any) => normTel(a.telefone) === alvo) ?? null;
}

async function ehMembroOuOrg(circuitoId: string, atletaId: string): Promise<boolean> {
  const { data: mem } = await supabase.from("circuito_atletas").select("atleta_id").eq("circuito_id", circuitoId).eq("atleta_id", atletaId).maybeSingle();
  if (mem) return true;
  const { data: org } = await supabase.from("circuito_organizadores").select("atleta_id").eq("circuito_id", circuitoId).eq("atleta_id", atletaId).maybeSingle();
  return !!org;
}

function mergeAtletaCircuito(ca: any): any {
  const a = ca.atletas || {};
  return {
    ...a,
    id: a.id,
    status: ca.status,
    pendente_circuito: ca.pendente_circuito,
    chave: ca.chave,
    saldo_temp: ca.saldo_temp,
    vitorias: ca.vitorias,
    derrotas: ca.derrotas,
    vitorias_total: ca.vitorias_total,
    derrotas_total: ca.derrotas_total,
    wo_culposos_temporada: ca.wo_culposos_temporada,
    historico: ca.historico,
    posicao_historico: ca.posicao_historico,
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") || "";
  const CORS_HEADERS = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ sucesso: false, erro: "Método não permitido" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return jsonResponse({ sucesso: false, erro: "JSON inválido" }, 400); }

  const circuitoId = body?.circuitoId ? String(body.circuitoId) : "";
  const telefone = body?.telefone;
  const pin = body?.pin;
  if (!circuitoId) return jsonResponse({ sucesso: false, erro: "circuitoId é obrigatório" }, 400);

  try {
    const { data: circ } = await supabase.from("circuitos")
      .select("id,slug,nome_circuito,sistema,publico,ativo").eq("id", circuitoId).maybeSingle();
    if (!circ) return jsonResponse({ sucesso: false, erro: "circuito_nao_encontrado" }, 404);

    // ── Porta: aberto libera; privado exige prova de vínculo (token OU telefone+PIN) ──
    let acesso = !!circ.publico;
    let motivo = "circuito_privado";
    if (!acesso && body?.sessionToken) {
      const atletaId = await atletaPorToken(body.sessionToken);
      if (atletaId) {
        if (await ehMembroOuOrg(circuitoId, atletaId)) acesso = true; else motivo = "nao_membro";
      }
    }
    if (!acesso && telefone && pin) {
      const a = await acharAtleta(telefone);
      if (a && a.pin_hash && a.status === "ativo") {
        if (a.pin_bloqueado_ate && new Date(a.pin_bloqueado_ate) > new Date()) {
          return jsonResponse({ sucesso: false, erro: "muitas_tentativas" }, 429);
        }
        const ok = await verifyPin(String(pin), a.pin_hash);
        if (!ok) {
          const tent = (a.pin_tentativas || 0) + 1;
          const upd = tent >= MAX_TENTATIVAS_PIN
            ? { pin_tentativas: 0, pin_bloqueado_ate: new Date(Date.now() + BLOQUEIO_MINUTOS * 60000).toISOString() }
            : { pin_tentativas: tent };
          await supabase.from("atletas").update(upd).eq("id", a.id);
          return jsonResponse({ sucesso: false, erro: "pin_incorreto" }, 401);
        }
        await supabase.from("atletas").update({ pin_tentativas: 0, pin_bloqueado_ate: null }).eq("id", a.id);
        if (await ehMembroOuOrg(circuitoId, a.id)) acesso = true; else motivo = "nao_membro";
      }
    }
    if (!acesso) return jsonResponse({ sucesso: false, erro: motivo }, 403);

    // ── Serve ranking (circuito_atletas + identidade) + jogos ──
    const { data: caRows, error: eCa } = await supabase.from("circuito_atletas")
      .select(`*, atletas!inner(${ATLETA_COLS})`).eq("circuito_id", circuitoId);
    if (eCa) throw eCa;
    const ranking = (caRows ?? []).map(mergeAtletaCircuito);

    const { data: partidas, error: eP } = await supabase.from("partidas")
      .select("*").eq("circuito_id", circuitoId)
      .order("rodada", { ascending: true }).order("criado_em", { ascending: true });
    if (eP) throw eP;

    return jsonResponse({ sucesso: true, dados: {
      circuito: { id: circ.id, slug: circ.slug, nome: circ.nome_circuito, sistema: circ.sistema, publico: circ.publico, ativo: circ.ativo },
      ranking,
      partidas: partidas ?? [],
    } });
  } catch (e) {
    console.error(e);
    return jsonResponse({ sucesso: false, erro: (e as any).message || "Erro interno" }, 500);
  }
});
