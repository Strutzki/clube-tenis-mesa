import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

let _bhId: string | null = null;
async function bhId(): Promise<string> {
  if (_bhId) return _bhId;
  const { data, error } = await supabase.from("circuitos").select("id").eq("slug", "bh").single();
  if (error) throw error;
  _bhId = data!.id as string;
  return _bhId;
}

async function pinValido(pin: string): Promise<boolean> {
  const desde = new Date(Date.now() - JANELA_MINUTOS * 60_000).toISOString();
  const { count } = await supabase.from("tentativas_login_admin").select("*", { count: "exact", head: true }).gte("tentativa_em", desde).eq("sucesso", false);
  if ((count ?? 0) >= MAX_TENTATIVAS) return false;
  const ok = pin === ADMIN_PIN;
  await supabase.from("tentativas_login_admin").insert({ sucesso: ok });
  return ok;
}

function _fromB64(s: string): Uint8Array { return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); }
function _b64(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)); }
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
async function autenticarOrganizador(telefone: string, pin: string): Promise<string | null> {
  const alvo = String(telefone || "").replace(/\D/g, "");
  if (alvo.length < 10 || !pin) return null;
  const { data } = await supabase.from("atletas").select("id,telefone,pin_hash,pin_tentativas,pin_bloqueado_ate,status");
  const a = (data ?? []).find((x: any) => String(x.telefone || "").replace(/\D/g, "") === alvo);
  if (!a || !a.pin_hash || a.status !== "ativo") return null;
  if (a.pin_bloqueado_ate && new Date(a.pin_bloqueado_ate) > new Date()) return null;
  const ok = await _verifyPin(String(pin), a.pin_hash);
  if (!ok) {
    const tent = (a.pin_tentativas || 0) + 1;
    const upd = tent >= 5 ? { pin_tentativas: 0, pin_bloqueado_ate: new Date(Date.now() + 15 * 60000).toISOString() } : { pin_tentativas: tent };
    await supabase.from("atletas").update(upd).eq("id", a.id);
    return null;
  }
  await supabase.from("atletas").update({ pin_tentativas: 0, pin_bloqueado_ate: null }).eq("id", a.id);
  return a.id;
}

async function contarCirc(c: any, bh: string) {
  const cid = c.id;
  async function nPart(filtro: (q: any) => any) {
    let q = supabase.from("partidas").select("*", { count: "exact", head: true }).eq("circuito_id", cid);
    q = filtro(q);
    const { count } = await q; return count || 0;
  }
  const validar = await nPart((q) => q.eq("rejeitado", false).eq("validado", false).not("p1_enviado_em", "is", null).not("p2_enviado_em", "is", null));
  const divulgar = await nPart((q) => q.eq("rejeitado", false).eq("validado", true).eq("calculado", true).or("resultado_comunicado.is.null,resultado_comunicado.eq.false"));
  const { count: woC } = await supabase.from("solicitacoes_wo").select("*", { count: "exact", head: true }).eq("circuito_id", cid).eq("status", "pendente");
  const wo = woC || 0;
  let inscricoes = 0, backlog = 0;
  if (cid === bh) {
    const { count: iC } = await supabase.from("atletas").select("*", { count: "exact", head: true }).eq("status", "pendente");
    inscricoes = iC || 0;
    const { count: bC } = await supabase.from("atletas").select("*", { count: "exact", head: true }).eq("status", "ativo").eq("pendente_circuito", true);
    backlog = bC || 0;
  } else {
    const { count: iC } = await supabase.from("circuito_atletas").select("*", { count: "exact", head: true }).eq("circuito_id", cid).eq("status", "pendente");
    inscricoes = iC || 0;
    const { count: bC } = await supabase.from("circuito_atletas").select("*", { count: "exact", head: true }).eq("circuito_id", cid).eq("status", "ativo").eq("pendente_circuito", true);
    backlog = bC || 0;
  }
  // Backlog só é AÇÃO DE HOJE se dá pra incluir agora: pré-temporada (promove antes de
  // começar) OU temporada em andamento fora do último terço e com vaga (inclui no próximo
  // par). No último terço (Cap. 11 — sem novas entradas), lotado, ou temporada completa,
  // o backlog só espera a virada → não conta como despacho do dia.
  if (backlog > 0 && (c.fase || null) === "etapa") {
    const rpt = c.rodadas_por_temporada || 6;
    const max = c.max_atletas || 20;
    const { data: rmax } = await supabase.from("partidas").select("rodada").eq("circuito_id", cid).order("rodada", { ascending: false }).limit(1);
    const rodadaAtual = rmax && rmax[0] ? rmax[0].rodada : 0;
    const ultimoTerco = rodadaAtual > 0 && rodadaAtual > (rpt * 2) / 3;
    let ativos = 0;
    if (cid === bh) { const { count } = await supabase.from("atletas").select("*", { count: "exact", head: true }).eq("status", "ativo").eq("pendente_circuito", false); ativos = count || 0; }
    else { const { count } = await supabase.from("circuito_atletas").select("*", { count: "exact", head: true }).eq("circuito_id", cid).eq("status", "ativo").eq("pendente_circuito", false); ativos = count || 0; }
    if (ultimoTerco || ativos >= max) backlog = 0;
  }
  // Qual rodada está pronta pra processar: a MENOR rodada com resultado validado (ou W.O.)
  // ainda não calculado. "Pronta" = mesma regra do botão de processar (front):
  //   • todas as partidas da rodada resolvidas (nada por validar, fora W.O.), E
  //   • rodada ÍMPAR: o prazo dela já fechou · rodada PAR: a anterior já foi processada.
  // Só conta em "processar" o que é REALMENTE processável agora (evita falso-positivo
  // de partida validada cedo com a rodada ainda aberta / prazo no futuro).
  let processarRodada: number | null = null;
  const { data: rv } = await supabase.from("partidas").select("rodada").eq("circuito_id", cid).eq("rejeitado", false).eq("validado", true).eq("calculado", false).order("rodada", { ascending: true }).limit(1);
  if (rv && rv[0]) processarRodada = rv[0].rodada;
  if (processarRodada == null) {
    const { data: rw } = await supabase.from("partidas").select("rodada").eq("circuito_id", cid).eq("rejeitado", false).eq("calculado", false).in("wo_tipo", ["culposo", "a_favor", "justificado"]).order("rodada", { ascending: true }).limit(1);
    if (rw && rw[0]) processarRodada = rw[0].rodada;
  }
  let processarPronta = false;
  let processar = 0;
  if (processarRodada != null) {
    const { count: naoResolvidas } = await supabase.from("partidas").select("*", { count: "exact", head: true }).eq("circuito_id", cid).eq("rodada", processarRodada).eq("rejeitado", false).eq("validado", false).is("wo_tipo", null);
    const resolvida = (naoResolvidas || 0) === 0;
    const ehSegundaDoPar = processarRodada % 2 === 0;
    let liberado = true;
    if (ehSegundaDoPar) {
      // rodada par: liberada só depois de a anterior estar sem validado-não-calc / W.O.-não-calc.
      const { count: antV } = await supabase.from("partidas").select("*", { count: "exact", head: true }).eq("circuito_id", cid).eq("rodada", processarRodada - 1).eq("rejeitado", false).eq("validado", true).eq("calculado", false);
      const { count: antW } = await supabase.from("partidas").select("*", { count: "exact", head: true }).eq("circuito_id", cid).eq("rodada", processarRodada - 1).eq("rejeitado", false).eq("calculado", false).in("wo_tipo", ["culposo", "a_favor", "justificado"]);
      liberado = ((antV || 0) + (antW || 0)) === 0;
    } else {
      // rodada ímpar: precisa do prazo próprio já ter fechado.
      const { data: pr } = await supabase.from("partidas").select("prazo").eq("circuito_id", cid).eq("rodada", processarRodada).not("prazo", "is", null).order("prazo", { ascending: true }).limit(1);
      const prazo = pr && pr[0] ? pr[0].prazo : null;
      liberado = prazo ? (new Date(prazo) <= new Date()) : true;
    }
    processarPronta = resolvida && liberado;
    if (processarPronta) {
      const { count: pv } = await supabase.from("partidas").select("*", { count: "exact", head: true }).eq("circuito_id", cid).eq("rodada", processarRodada).eq("rejeitado", false).eq("validado", true).eq("calculado", false);
      const { count: pw } = await supabase.from("partidas").select("*", { count: "exact", head: true }).eq("circuito_id", cid).eq("rodada", processarRodada).eq("rejeitado", false).eq("calculado", false).in("wo_tipo", ["culposo", "a_favor", "justificado"]);
      processar = (pv || 0) + (pw || 0);
    }
  }
  const counts = { validar, processar, wo, inscricoes, backlog, divulgar };
  const total = validar + processar + wo + inscricoes + backlog + divulgar;
  return { id: cid, nome: c.nome_circuito, sistema: c.sistema, publico: c.publico, ativo: c.ativo, counts, total, processarRodada, processarPronta };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") || "";
  const CORS = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...CORS } });
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS });
  if (req.method !== "POST") return json({ sucesso: false, erro: "Método não permitido" }, 405);

  let body: any; try { body = await req.json(); } catch { return json({ sucesso: false, erro: "JSON inválido" }, 400); }
  const { pin, orgTelefone, orgPin } = body || {};

  try {
    const bh = await bhId();
    let circuitos: any[] = [];
    if (orgTelefone && orgPin) {
      const atletaId = await autenticarOrganizador(String(orgTelefone), String(orgPin));
      if (!atletaId) return json({ sucesso: false, erro: "Telefone ou PIN incorretos." }, 401);
      const { data: vinc } = await supabase.from("circuito_organizadores").select("circuito_id").eq("atleta_id", atletaId);
      const ids = (vinc ?? []).map((v: any) => v.circuito_id);
      if (ids.length === 0) return json({ sucesso: true, dados: { circuitos: [], totais: {} } });
      const { data } = await supabase.from("circuitos").select("id,nome_circuito,sistema,publico,ativo,fase,rodadas_por_temporada,max_atletas").in("id", ids).eq("ativo", true);
      circuitos = data || [];
    } else {
      if (!pin) return json({ sucesso: false, erro: "pin é obrigatório" }, 400);
      if (!(await pinValido(String(pin)))) return json({ sucesso: false, erro: "PIN inválido ou muitas tentativas." }, 401);
      const { data } = await supabase.from("circuitos").select("id,nome_circuito,sistema,publico,ativo,fase,rodadas_por_temporada,max_atletas").eq("ativo", true).order("nome_circuito", { ascending: true });
      circuitos = data || [];
    }
    const resultado = [];
    for (const c of circuitos) resultado.push(await contarCirc(c, bh));
    resultado.sort((a, b) => b.total - a.total);
    const totais = resultado.reduce((acc: any, r: any) => {
      for (const k in r.counts) acc[k] = (acc[k] || 0) + r.counts[k];
      acc.total = (acc.total || 0) + r.total;
      return acc;
    }, {});
    return json({ sucesso: true, dados: { circuitos: resultado, totais } });
  } catch (e) {
    console.error(e);
    return json({ sucesso: false, erro: (e as any)?.message || "Erro interno" }, 500);
  }
});
