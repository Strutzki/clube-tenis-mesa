import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// login-atleta — login do ATLETA por telefone + PIN (zero-custo, sem OTP).
//  - acao "LOGIN": telefone (+ pin). Retorna primeiroAcesso, precisaPin,
//    ok+atleta, ou erro. Trava por tentativas (anti-força-bruta).
//  - acao "DEFINIR_PIN": telefone + pin, cria o PIN só se ainda não existir
//    (confiança no 1º acesso). Se já existe, manda pedir reset ao admin.
// O PIN é guardado com hash PBKDF2 + sal. Nunca em texto puro, nunca exposto.
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
const ITERACOES = 100000;

// Colunas devolvidas ao app no sucesso — NUNCA inclui pin_hash.
const COLS = "id,nome,telefone,apelido,federado,rating,rating_inicial,saldo_temp,status,chave,vitorias,derrotas,vitorias_total,derrotas_total,inscrito_em,pendente_circuito,ultima_recusa_circuito_em,foto_url,estilo_jogo,historico,rating_pico,rating_historico,posicao_historico,wo_culposos_temporada,exclusao_solicitada_em";

function normTel(t: unknown): string {
  return String(t ?? "").replace(/\D/g, "");
}

function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}
function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function deriveBits(pin: string, salt: Uint8Array, iter: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, keyMaterial, 256,
  );
  return new Uint8Array(bits);
}

async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveBits(pin, salt, ITERACOES);
  return `pbkdf2$${ITERACOES}$${b64(salt)}$${b64(hash)}`;
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
  try {
    const [alg, iterStr, saltB64, hashB64] = stored.split("$");
    if (alg !== "pbkdf2") return false;
    const hash = await deriveBits(pin, fromB64(saltB64), parseInt(iterStr));
    const esperado = b64(hash);
    // comparação de tempo constante simples
    if (esperado.length !== hashB64.length) return false;
    let diff = 0;
    for (let i = 0; i < esperado.length; i++) diff |= esperado.charCodeAt(i) ^ hashB64.charCodeAt(i);
    return diff === 0;
  } catch { return false; }
}

async function acharAtleta(tel: string): Promise<any | null> {
  const alvo = normTel(tel);
  if (alvo.length < 10) return null;
  const { data } = await supabase
    .from("atletas")
    .select("id,telefone,pin_hash,pin_tentativas,pin_bloqueado_ate,status");
  return (data ?? []).find((a: any) => normTel(a.telefone) === alvo) ?? null;
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

  const { acao, telefone, pin } = body || {};

  try {
    if (acao === "LOGIN") {
      const a = await acharAtleta(telefone);
      if (!a) return jsonResponse({ sucesso: true, dados: { encontrado: false } });

      if (a.pin_bloqueado_ate && new Date(a.pin_bloqueado_ate) > new Date()) {
        return jsonResponse({ sucesso: false, erro: "Muitas tentativas. Aguarde alguns minutos e tente de novo." }, 429);
      }
      if (!a.pin_hash) {
        return jsonResponse({ sucesso: true, dados: { encontrado: true, primeiroAcesso: true } });
      }
      if (!pin) {
        return jsonResponse({ sucesso: true, dados: { encontrado: true, precisaPin: true } });
      }

      const ok = await verifyPin(String(pin), a.pin_hash);
      if (!ok) {
        const tent = (a.pin_tentativas || 0) + 1;
        const upd = tent >= MAX_TENTATIVAS_PIN
          ? { pin_tentativas: 0, pin_bloqueado_ate: new Date(Date.now() + BLOQUEIO_MINUTOS * 60000).toISOString() }
          : { pin_tentativas: tent };
        await supabase.from("atletas").update(upd).eq("id", a.id);
        return jsonResponse({ sucesso: false, erro: "PIN incorreto." }, 401);
      }

      await supabase.from("atletas").update({ pin_tentativas: 0, pin_bloqueado_ate: null }).eq("id", a.id);
      const { data: full } = await supabase.from("atletas").select(COLS).eq("id", a.id).single();
      return jsonResponse({ sucesso: true, dados: { encontrado: true, ok: true, atleta: full } });
    }

    if (acao === "DEFINIR_PIN") {
      const pinStr = String(pin ?? "");
      if (!/^\d{4,6}$/.test(pinStr)) {
        return jsonResponse({ sucesso: false, erro: "O PIN deve ter de 4 a 6 dígitos." }, 400);
      }
      const a = await acharAtleta(telefone);
      if (!a) return jsonResponse({ sucesso: false, erro: "Cadastro não encontrado." }, 404);
      if (a.pin_hash) {
        return jsonResponse({ sucesso: false, erro: "Você já tem um PIN. Se esqueceu, peça um reset ao administrador." }, 409);
      }
      const h = await hashPin(pinStr);
      await supabase.from("atletas").update({
        pin_hash: h, pin_definido_em: new Date().toISOString(), pin_tentativas: 0, pin_bloqueado_ate: null,
      }).eq("id", a.id);
      const { data: full } = await supabase.from("atletas").select(COLS).eq("id", a.id).single();
      return jsonResponse({ sucesso: true, dados: { ok: true, atleta: full } });
    }

    return jsonResponse({ sucesso: false, erro: `Ação desconhecida: ${acao}` }, 400);
  } catch (e) {
    console.error(e);
    return jsonResponse({ sucesso: false, erro: (e as any).message || "Erro interno" }, 500);
  }
});
