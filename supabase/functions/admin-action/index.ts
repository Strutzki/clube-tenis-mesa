import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PIN = Deno.env.get("ADMIN_PIN")!;

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

// Resolve o sistema do circuito ('A'/'B') SEM consultar coluna inexistente: o BH le a
// config de `configuracao` (que NAO tem `sistema`), entao resolvemos por codigo. Memoizado.
// Fail-safe: qualquer duvida -> 'A' (comportamento do BH). `sistema`/`pareamento` so em `circuitos`.
const _sistemaCache = new Map<string, string>();
async function getSistema(circuitoId: string): Promise<string> {
  const bh = await bhId();
  if (circuitoId === bh) return "A";
  if (_sistemaCache.has(circuitoId)) return _sistemaCache.get(circuitoId)!;
  const { data, error } = await supabase.from("circuitos").select("sistema").eq("id", circuitoId).single();
  if (error) throw error; // fail-closed: NUNCA assumir 'A' num circuito nao-BH por falha transitoria (evitaria gravar rating no B)
  const s = (data?.sistema === "B") ? "B" : "A";
  _sistemaCache.set(circuitoId, s);
  return s;
}

// --- Dual-write (Fase 4B) -------------------------------------------------
// O servidor continua gravando o estado sazonal em `atletas` (o BH depende disso)
// e a config em `configuracao`. Em PARALELO, espelha em `circuito_atletas`/`circuitos`.
// O espelho e' BEST-EFFORT: se falhar, apenas loga -> nunca quebra a operacao do BH.
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
// Espelha campos sazonais de um atleta na sua participacao no circuito (upsert por (circuito_id, atleta_id)).
async function mirrorSazonal(circuitoId: string, atletaId: string, campos: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  try {
    const dados = seasonalOnly(campos);
    if (Object.keys(dados).length === 0 && Object.keys(extra).length === 0) return;
    const { error } = await supabase.from("circuito_atletas")
      .upsert({ circuito_id: circuitoId, atleta_id: atletaId, ...dados, ...extra }, { onConflict: "circuito_id,atleta_id" });
    if (error) throw error;
  } catch (e) {
    console.warn("dual-write circuito_atletas falhou (BH segue via atletas):", (e as any)?.message);
  }
}
// Espelha config no circuito (mesmos nomes de coluna que `configuracao`).
async function mirrorConfig(circuitoId: string, campos: Record<string, unknown>) {
  try {
    if (!campos || Object.keys(campos).length === 0) return;
    const { error } = await supabase.from("circuitos").update(campos).eq("id", circuitoId);
    if (error) throw error;
  } catch (e) {
    console.warn("dual-write circuitos falhou (BH segue via configuracao):", (e as any)?.message);
  }
}

// Escreve um update de atleta roteando por circuito (blindagem cross-tenant):
// - BH: grava tudo em `atletas` (fonte que o app le) + espelha o sazonal em circuito_atletas (como hoje).
// - nao-BH: IDENTIDADE (rating/nome/etc.) -> atletas (compartilhada, Modelo B); SAZONAL -> so circuito_atletas.
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
  // Guard motor B (defesa em profundidade): circuito Sistema B NUNCA escreve identidade de
  // rating na tabela global `atletas` — nem que um bug futuro tente. NAO afeta o BH ('A').
  if ((await getSistema(circuitoId)) === "B") {
    delete identidade.rating; delete identidade.rating_pico; delete identidade.rating_historico;
  }
  if (Object.keys(identidade).length > 0) {
    const { error } = await supabase.from("atletas").update(identidade).eq("id", atletaId);
    if (error) throw error;
  }
  await mirrorSazonal(circuitoId, atletaId, campos);
}

// --- Leitura por circuito (Fase 4B passo 3) ------------------------------
// REGRA DE CAUTELA: para o BH, tudo roda EXATAMENTE como antes (le atletas/configuracao).
// Para outros circuitos, le circuito_atletas/circuitos. Assim o caminho do BH nao muda.

// Config do circuito: BH -> configuracao(id=1); demais -> circuitos(id).
async function getCfg(circuitoId: string, cols: string): Promise<any> {
  const bh = await bhId();
  if (circuitoId === bh) {
    const { data, error } = await supabase.from("configuracao").select(cols).eq("id", 1).single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from("circuitos").select(cols).eq("id", circuitoId).single();
  if (error) throw error;
  return data;
}
// Grava config: BH -> configuracao(id=1) + espelho circuitos; demais -> so circuitos.
// (Protege configuracao(id=1)/BH de escritas de outros circuitos.)
async function setCfg(circuitoId: string, campos: Record<string, unknown>) {
  const bh = await bhId();
  if (circuitoId === bh) {
    const { error } = await supabase.from("configuracao").update(campos).eq("id", 1);
    if (error) throw error;
    await mirrorConfig(circuitoId, campos);
  } else {
    const { error } = await supabase.from("circuitos").update(campos).eq("id", circuitoId);
    if (error) throw error;
  }
}
// Monta um objeto no formato de linha `atletas` a partir de circuito_atletas + atletas aninhado.
function mergeAtletaCircuito(ca: any): any {
  const a = ca.atletas || {};
  return {
    ...a,
    id: a.id,
    status: ca.status, motivo_reprovacao: ca.motivo_reprovacao,
    pendente_circuito: ca.pendente_circuito, ultima_recusa_circuito_em: ca.ultima_recusa_circuito_em,
    chave: ca.chave, saldo_temp: ca.saldo_temp, vitorias: ca.vitorias, derrotas: ca.derrotas,
    vitorias_total: ca.vitorias_total, derrotas_total: ca.derrotas_total,
    wo_culposos_temporada: ca.wo_culposos_temporada,
    pagamento_confirmado: ca.pagamento_confirmado, pagamento_proxima_confirmado: ca.pagamento_proxima_confirmado,
    desconto_pct: ca.desconto_pct, isento: ca.isento,
    quer_renovar: ca.quer_renovar, renovacao_em: ca.renovacao_em,
    historico: ca.historico, posicao_historico: ca.posicao_historico,
  };
}
// Atletas ATIVOS e no circuito (pendente_circuito=false), no formato de `atletas`.
async function getAtivosNoCircuito(circuitoId: string, exigePagamento: boolean): Promise<any[]> {
  const bh = await bhId();
  if (circuitoId === bh) {
    let q = supabase.from("atletas").select("*").eq("status", "ativo").eq("pendente_circuito", false);
    if (exigePagamento) q = q.eq("pagamento_confirmado", true);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }
  let q = supabase.from("circuito_atletas").select("*, atletas!inner(*)").eq("circuito_id", circuitoId).eq("status", "ativo").eq("pendente_circuito", false);
  if (exigePagamento) q = q.eq("pagamento_confirmado", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(mergeAtletaCircuito);
}
// Atletas por ids, no formato de `atletas` (para o motor de rating).
async function getAtletasPorIds(circuitoId: string, ids: string[]): Promise<any[]> {
  const bh = await bhId();
  if (circuitoId === bh) {
    const { data, error } = await supabase.from("atletas").select("*").in("id", ids);
    if (error) throw error;
    return data || [];
  }
  const { data, error } = await supabase.from("circuito_atletas").select("*, atletas!inner(*)").eq("circuito_id", circuitoId).in("atleta_id", ids);
  if (error) throw error;
  return (data || []).map(mergeAtletaCircuito);
}
// Conta atletas ativos no circuito (pendente_circuito=false).
async function countAtivosNoCircuito(circuitoId: string): Promise<number> {
  const bh = await bhId();
  if (circuitoId === bh) {
    const { count } = await supabase.from("atletas").select("*", { count: "exact", head: true }).eq("status", "ativo").eq("pendente_circuito", false);
    return count || 0;
  }
  const { count } = await supabase.from("circuito_atletas").select("*", { count: "exact", head: true }).eq("circuito_id", circuitoId).eq("status", "ativo").eq("pendente_circuito", false);
  return count || 0;
}

const ALLOWED_ORIGINS = [
  "https://clubedotenisdemesabh.com.br",
  "https://www.clubedotenisdemesabh.com.br",
  "https://clube-tenis-mesa.vercel.app",
];

const JANELA_MINUTOS = 15;
const MAX_TENTATIVAS = 5;

const CBTM_FAVORITO = [
  { max: 24, v: 10, p: -8 }, { max: 49, v: 9, p: -7 }, { max: 99, v: 8, p: -6 },
  { max: 149, v: 7, p: -5 }, { max: 199, v: 6, p: -4 }, { max: 299, v: 5, p: -3 },
  { max: 399, v: 4, p: -2 }, { max: 499, v: 3, p: -1 }, { max: 749, v: 2, p: 0 },
  { max: Infinity, v: 1, p: 0 },
];
const CBTM_AZARAO = [
  { max: 24, v: 11, p: -9 }, { max: 49, v: 12, p: -10 }, { max: 99, v: 14, p: -11 },
  { max: 149, v: 16, p: -12 }, { max: 199, v: 18, p: -14 }, { max: 299, v: 20, p: -16 },
  { max: 399, v: 23, p: -18 }, { max: 499, v: 26, p: -20 }, { max: Infinity, v: 30, p: -22 },
];
function calcRatingCBTM(ratingVencedor: number, ratingPerdedor: number, peso = 1) {
  const diff = Math.abs(ratingVencedor - ratingPerdedor);
  const azaraoVenceu = ratingVencedor < ratingPerdedor;
  const tabela = azaraoVenceu ? CBTM_AZARAO : CBTM_FAVORITO;
  const faixa = tabela.find(f => diff <= f.max)!;
  return { vencedor: faixa.v * peso, perdedor: faixa.p * peso };
}
function calcElo(ra: number, rb: number, result: 0 | 1, peso = 1) {
  if (result === 1) {
    const d = calcRatingCBTM(ra, rb, peso);
    return ra + d.vencedor;
  } else {
    const d = calcRatingCBTM(rb, ra, peso);
    return ra + d.perdedor;
  }
}

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

function confrontosDaTemporada(partidas: any[]): Set<string> {
  const set = new Set<string>();
  partidas.forEach((m) => {
    if (m.atleta1_id && m.atleta2_id) {
      const [a, b] = [m.atleta1_id, m.atleta2_id].sort();
      set.add(`${a}|${b}`);
    }
  });
  return set;
}

function jaSeEnfrentaram(idA: string, idB: string, historico: Set<string>): boolean {
  const [a, b] = [idA, idB].sort();
  return historico.has(`${a}|${b}`);
}

function confrontoDiretoDB(aId: string, bId: string, partidas: any[]): number {
  let av = 0, bv = 0;
  for (const m of partidas) {
    if (m.rejeitado || !m.validado) continue;
    if (m.placar1 == null || m.placar2 == null) continue;
    if (!((m.atleta1_id === aId && m.atleta2_id === bId) || (m.atleta1_id === bId && m.atleta2_id === aId))) continue;
    const venc = m.placar1 > m.placar2 ? m.atleta1_id : m.atleta2_id;
    if (venc === aId) av++; else if (venc === bId) bv++;
  }
  return av - bv;
}

function cmpRankingDB(partidas: any[]) {
  return (a: any, b: any) => {
    if ((b.saldo_temp || 0) !== (a.saldo_temp || 0)) return (b.saldo_temp || 0) - (a.saldo_temp || 0);
    if ((b.vitorias || 0) !== (a.vitorias || 0)) return (b.vitorias || 0) - (a.vitorias || 0);
    const h2h = confrontoDiretoDB(a.id, b.id, partidas);
    if (h2h !== 0) return -h2h;
    return (b.rating || 0) - (a.rating || 0);
  };
}

// Comparador de ranking do Sistema B (pontos fixos). saldo_temp = pontos acumulados (V=2/D=1).
// Desempate: pontos -> MENOS W.O. injustificados -> confronto direto -> % aproveitamento -> saldo de sets -> id (estavel).
// (Definido aqui; so e' CHAMADO no ramo `sistema === 'B'` — inerte pro BH ate a Fatia 2.)
function aproveitamentoB(a: any): number {
  const n = (a.vitorias || 0) + (a.derrotas || 0);
  return n > 0 ? (a.vitorias || 0) / n : 0;
}
function saldoSetsB(id: string, partidas: any[]): number {
  let s = 0;
  for (const m of partidas) {
    if (m.rejeitado || !m.validado) continue;
    if (m.placar1 == null || m.placar2 == null) continue;
    if (m.atleta1_id === id) s += (m.placar1 - m.placar2);
    else if (m.atleta2_id === id) s += (m.placar2 - m.placar1);
  }
  return s;
}
function cmpRankingB(partidas: any[]) {
  return (a: any, b: any) => {
    if ((b.saldo_temp || 0) !== (a.saldo_temp || 0)) return (b.saldo_temp || 0) - (a.saldo_temp || 0);
    if ((a.wo_culposos_temporada || 0) !== (b.wo_culposos_temporada || 0)) return (a.wo_culposos_temporada || 0) - (b.wo_culposos_temporada || 0);
    const h2h = confrontoDiretoDB(a.id, b.id, partidas);
    if (h2h !== 0) return -h2h;
    const apA = aproveitamentoB(a), apB = aproveitamentoB(b);
    if (apB !== apA) return apB - apA;
    const ssA = saldoSetsB(a.id, partidas), ssB = saldoSetsB(b.id, partidas);
    if (ssB !== ssA) return ssB - ssA;
    return String(a.id).localeCompare(String(b.id));
  };
}

function parearRodada(athletes: any[], historico: Set<string>): { pares: { p1: string; p2: string }[]; bye: string | null } {
  const sorted = [...athletes].sort((a, b) => (b.rating || 250) - (a.rating || 250));

  let byeId: string | null = null;
  let jogadores = sorted;
  if (sorted.length % 2 !== 0) {
    byeId = sorted[sorted.length - 1].id;
    jogadores = sorted.slice(0, -1);
  }

  const n = jogadores.length;
  const PENAL_REPETICAO = 1e7;

  function custo(i: number, j: number) {
    const repetido = jaSeEnfrentaram(jogadores[i].id, jogadores[j].id, historico) ? PENAL_REPETICAO : 0;
    return repetido + Math.abs((jogadores[i].rating || 250) - (jogadores[j].rating || 250));
  }

  const usados = new Array(n).fill(false);
  let melhorPares: { p1: string; p2: string }[] | null = null;
  let melhorCusto = Infinity;

  function resolver(pares: { p1: string; p2: string }[], custoAcc: number) {
    if (custoAcc >= melhorCusto) return;
    const i = usados.findIndex((u) => !u);
    if (i === -1) { melhorCusto = custoAcc; melhorPares = pares; return; }
    usados[i] = true;
    const candidatos: { j: number; c: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (j === i || usados[j]) continue;
      candidatos.push({ j, c: custo(i, j) });
    }
    candidatos.sort((a, b) => a.c - b.c);
    for (const { j, c } of candidatos) {
      usados[j] = true;
      resolver([...pares, { p1: jogadores[i].id, p2: jogadores[j].id }], custoAcc + c);
      usados[j] = false;
    }
    usados[i] = false;
  }
  resolver([], 0);

  return { pares: melhorPares || [], bye: byeId };
}

function gerarPareamentoPorRating(athletes: any[], matchesTemporada: any[] = []) {
  const historico = confrontosDaTemporada(matchesTemporada);
  const r1 = parearRodada(athletes, historico);

  const historico2 = new Set(historico);
  r1.pares.forEach((par) => {
    const [a, b] = [par.p1, par.p2].sort();
    historico2.add(`${a}|${b}`);
  });
  const r2 = parearRodada(athletes, historico2);

  return { rodada1: r1.pares, bye1: r1.bye, rodada2: r2.pares, bye2: r2.bye };
}

// ── Pareamento do Sistema B (sem rating) ──────────────────────────────────────
function embaralhar<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// Pareia uma rodada no Sistema B. `pareamento`: 'sorteio' (ordem aleatoria) ou 'grupos'
// (ordena pela tabela de pontos e pareia posicoes proximas). Custo = penalidade de repeticao
// (+ distancia de posicao no modo grupos). Bye com rotacao: prefere quem ainda nao teve bye.
function parearRodadaB(athletes: any[], historico: Set<string>, pareamento: string, jaTeveBye: Set<string>): { pares: { p1: string; p2: string }[]; bye: string | null } {
  const ordenados = (pareamento === "grupos")
    ? [...athletes].sort((a, b) => (b.saldo_temp || 0) - (a.saldo_temp || 0))
    : embaralhar(athletes);

  let byeId: string | null = null;
  let jogadores = ordenados;
  if (ordenados.length % 2 !== 0) {
    const candidatos = ordenados.filter(a => !jaTeveBye.has(a.id));
    const escolhido = candidatos.length > 0
      ? (pareamento === "grupos" ? candidatos[candidatos.length - 1] : candidatos[0])
      : ordenados[ordenados.length - 1];
    byeId = escolhido.id;
    jogadores = ordenados.filter(a => a.id !== byeId);
  }

  const n = jogadores.length;
  const PENAL_REPETICAO = 1e7;
  function custo(i: number, j: number) {
    const rep = jaSeEnfrentaram(jogadores[i].id, jogadores[j].id, historico) ? PENAL_REPETICAO : 0;
    const dist = (pareamento === "grupos") ? Math.abs(i - j) : 0;
    return rep + dist;
  }

  const usados = new Array(n).fill(false);
  let melhorPares: { p1: string; p2: string }[] | null = null;
  let melhorCusto = Infinity;
  function resolver(pares: { p1: string; p2: string }[], custoAcc: number) {
    if (custoAcc >= melhorCusto) return;
    const i = usados.findIndex((u) => !u);
    if (i === -1) { melhorCusto = custoAcc; melhorPares = pares; return; }
    usados[i] = true;
    const candidatos: { j: number; c: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (j === i || usados[j]) continue;
      candidatos.push({ j, c: custo(i, j) });
    }
    candidatos.sort((a, b) => a.c - b.c);
    for (const { j, c } of candidatos) {
      usados[j] = true;
      resolver([...pares, { p1: jogadores[i].id, p2: jogadores[j].id }], custoAcc + c);
      usados[j] = false;
    }
    usados[i] = false;
  }
  resolver([], 0);

  return { pares: melhorPares || [], bye: byeId };
}
// Gera o par mensal (2 rodadas) no Sistema B, com rotacao de bye entre as duas.
function gerarPareamentoB(athletes: any[], matchesTemporada: any[], pareamento: string) {
  const historico = confrontosDaTemporada(matchesTemporada);
  // Deriva "quem ja teve bye" (melhor esforco): por rodada, ativos que nao aparecem em partida.
  const jaTeveBye = new Set<string>();
  const rounds = [...new Set((matchesTemporada || []).map((m: any) => m.rodada))];
  const idsAtivos = athletes.map(a => a.id);
  for (const r of rounds) {
    const naRodada = new Set<string>();
    (matchesTemporada || []).filter((m: any) => m.rodada === r).forEach((m: any) => { naRodada.add(m.atleta1_id); naRodada.add(m.atleta2_id); });
    for (const id of idsAtivos) if (!naRodada.has(id)) jaTeveBye.add(id);
  }
  const r1 = parearRodadaB(athletes, historico, pareamento, jaTeveBye);
  const historico2 = new Set(historico);
  r1.pares.forEach((par) => { const [a, b] = [par.p1, par.p2].sort(); historico2.add(`${a}|${b}`); });
  const jaTeveBye2 = new Set(jaTeveBye);
  if (r1.bye) jaTeveBye2.add(r1.bye);
  const r2 = parearRodadaB(athletes, historico2, pareamento, jaTeveBye2);
  return { rodada1: r1.pares, bye1: r1.bye, rodada2: r2.pares, bye2: r2.bye };
}

function calcularPrazos(mesRef?: Date) {
  let ref: Date;
  if (mesRef) {
    ref = mesRef;
  } else {
    const hoje = new Date();
    ref = (hoje.getDate() > 27) ? new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1) : hoje;
  }
  const prazoA = new Date(ref.getFullYear(), ref.getMonth(), 15);
  const prazoB = new Date(ref.getFullYear(), ref.getMonth(), 27);
  return { prazoA: prazoA.toISOString().split("T")[0], prazoB: prazoB.toISOString().split("T")[0] };
}

// Promove o backlog respeitando o TETO (max_atletas). Entra por ordem de chegada
// (inscrito_em) só até preencher as vagas; o excedente segue na fila. Quando o
// financeiro está ligado, só promove quem já teve o pagamento confirmado — assim
// vaga contada = vaga de quem vai jogar. Retorna quantos entraram.
async function promoverBacklog(circuitoId: string): Promise<number> {
  const cfg = await getCfg(circuitoId, "max_atletas,financeiro_ativo");
  const max = cfg?.max_atletas || 20;
  const nCirc = await countAtivosNoCircuito(circuitoId);
  const vagas = Math.max(0, max - nCirc);
  if (vagas <= 0) return 0;
  const bh = await bhId();
  let ids: string[] = [];
  if (circuitoId === bh) {
    let q = supabase.from("atletas").select("id").eq("status", "ativo").eq("pendente_circuito", true);
    if (cfg?.financeiro_ativo) q = q.eq("pagamento_confirmado", true);
    const { data: fila } = await q.order("inscrito_em", { ascending: true }).limit(vagas);
    ids = (fila || []).map((a: any) => a.id);
    if (!ids.length) return 0;
    const { error } = await supabase.from("atletas").update({ pendente_circuito: false }).in("id", ids);
    if (error) throw error;
    // dual-write (corrige lacuna do passo 2): espelha em circuito_atletas. Best-effort.
    try {
      await supabase.from("circuito_atletas").update({ pendente_circuito: false }).eq("circuito_id", circuitoId).in("atleta_id", ids);
    } catch (e) {
      console.warn("dual-write promoverBacklog falhou (BH segue via atletas):", (e as any)?.message);
    }
  } else {
    let q = supabase.from("circuito_atletas").select("atleta_id").eq("circuito_id", circuitoId).eq("status", "ativo").eq("pendente_circuito", true);
    if (cfg?.financeiro_ativo) q = q.eq("pagamento_confirmado", true);
    const { data: fila } = await q.order("inscrito_em", { ascending: true }).limit(vagas);
    ids = (fila || []).map((a: any) => a.atleta_id);
    if (!ids.length) return 0;
    const { error } = await supabase.from("circuito_atletas").update({ pendente_circuito: false }).eq("circuito_id", circuitoId).in("atleta_id", ids);
    if (error) throw error;
  }
  return ids.length;
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

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return jsonResponse({ sucesso: false, erro: "Método não permitido" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return jsonResponse({ sucesso: false, erro: "JSON inválido" }, 400); }

  const { pin, acao, payload } = body || {};
  if (!pin || !acao) return jsonResponse({ sucesso: false, erro: "pin e acao são obrigatórios" }, 400);

  const check = await pinValido(String(pin));
  if (!check.ok) return jsonResponse({ sucesso: false, erro: check.motivo }, 401);

  // Circuito alvo: o que o app enviar, ou BH por padrao (transicao single-tenant).
  const circuitoId = (payload && payload.circuitoId) ? String(payload.circuitoId) : await bhId();

  try {
    switch (acao) {
      case "EXCLUIR_ATLETA": {
        const { id } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        // Valida UUID antes de interpolar no filtro `.or(...)` (a `.eq` é parametrizada,
        // mas a string do `.or` não é) — fecha injeção de filtro PostgREST.
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id))) {
          return jsonResponse({ sucesso: false, erro: "id inválido" }, 400);
        }
        const bhExcl = await bhId();
        // BH (legado): o roster É a identidade global -> exclusão global, como sempre.
        if (circuitoId === bhExcl) {
          const { error } = await supabase.from("atletas").delete().eq("id", id);
          if (error) throw error;
          return jsonResponse({ sucesso: true, dados: { escopo: "global" } });
        }
        // Circuito NÃO-BH: apaga SÓ a participação (circuito_atletas). A identidade
        // global (atletas), o rating e a participação em outros circuitos ficam intactos.
        // Guarda: bloqueia se o atleta tiver partidas NESTE circuito (evita partida órfã) —
        // nesse caso o admin deve arquivar, não excluir.
        const { count: nPartidasCirc } = await supabase
          .from("partidas")
          .select("*", { count: "exact", head: true })
          .eq("circuito_id", circuitoId)
          .or(`atleta1_id.eq.${id},atleta2_id.eq.${id}`);
        if ((nPartidasCirc ?? 0) > 0) {
          return jsonResponse({ sucesso: false, erro: "Este atleta tem partidas neste circuito. Arquive em vez de excluir." }, 409);
        }
        const { data: apagadas, error } = await supabase
          .from("circuito_atletas")
          .delete()
          .eq("circuito_id", circuitoId)
          .eq("atleta_id", id)
          .select("atleta_id");
        if (error) throw error;
        if (!apagadas || apagadas.length === 0) {
          return jsonResponse({ sucesso: false, erro: "Atleta não está neste circuito." }, 404);
        }
        return jsonResponse({ sucesso: true, dados: { escopo: "circuito", removidos: apagadas.length } });
      }

      case "INSCRICAO_VALIDAR": {
        const { id, rating, approved, motivo } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        const update = approved
          ? { status: "ativo", rating, rating_inicial: rating, saldo_temp: 0, pendente_circuito: true }
          : { status: "reprovado", motivo_reprovacao: motivo };
        await writeAtleta(circuitoId, id, update);
        return jsonResponse({ sucesso: true });
      }

      case "PROCESSAR_RODADA": {
        const { round } = payload || {};
        if (round === undefined || round === null || typeof round !== "number") {
          return jsonResponse({ sucesso: false, erro: "round é obrigatório" }, 400);
        }

        const sistema = await getSistema(circuitoId); // Fatia 2: ramifica pontuação/ranking do Sistema B

        const { data: partidasRodadaAnterior } = await supabase
          .from("partidas").select("id").eq("circuito_id", circuitoId).eq("rodada", round - 1).eq("validado", true).eq("calculado", false).eq("rejeitado", false);
        const { data: woRodadaAnterior } = await supabase
          .from("partidas").select("id").eq("circuito_id", circuitoId).eq("rodada", round - 1).in("wo_tipo", ["culposo", "a_favor", "justificado"]).eq("calculado", false).eq("rejeitado", false);

        if (round % 2 === 0 && (((partidasRodadaAnterior?.length ?? 0) + (woRodadaAnterior?.length ?? 0)) > 0)) {
          return jsonResponse({ sucesso: false, erro: "A rodada anterior ainda tem resultados sem calcular." }, 409);
        }

        const { data: pendentes, error: errPend } = await supabase
          .from("partidas").select("*").eq("circuito_id", circuitoId).eq("rodada", round).eq("validado", true).eq("calculado", false).eq("rejeitado", false).order("admin_aprovado_em", { ascending: true });
        if (errPend) throw errPend;

        const { data: wosRaw, error: errWo } = await supabase
          .from("partidas").select("*").eq("circuito_id", circuitoId).eq("rodada", round).in("wo_tipo", ["culposo", "a_favor", "justificado"]).eq("calculado", false).eq("rejeitado", false);
        if (errWo) throw errWo;
        const wos = wosRaw || [];
        const listaPend = pendentes || [];
        if (listaPend.length === 0 && wos.length === 0) {
          return jsonResponse({ sucesso: true, dados: { processadas: 0 } });
        }

        const idsAtletas = [...new Set([
          ...listaPend.flatMap((m: any) => [m.atleta1_id, m.atleta2_id]),
          ...wos.flatMap((m: any) => [m.atleta1_id, m.atleta2_id]),
        ])];
        const atletasData = await getAtletasPorIds(circuitoId, idsAtletas);

        const athletesMap: Record<string, any> = {};
        atletasData.forEach(a => { athletesMap[a.id] = { ...a }; });

        const infoPorPartida: Record<string, { favorito_id: string; diferenca_rating_momento: number }> = {};

        for (const match of pendentes) {
          const p1 = athletesMap[match.atleta1_id];
          const p2 = athletesMap[match.atleta2_id];
          if (!p1 || !p2) continue;
          const p1wins = match.placar1 > match.placar2;
          if (sistema === "B") {
            // Sistema B: pontos fixos — vencedor +2, perdedor +1. NAO mexe em rating.
            athletesMap[match.atleta1_id] = {
              ...p1, saldo_temp: (p1.saldo_temp || 0) + (p1wins ? 2 : 1),
              vitorias: (p1.vitorias || 0) + (p1wins ? 1 : 0),
              derrotas: (p1.derrotas || 0) + (p1wins ? 0 : 1),
            };
            athletesMap[match.atleta2_id] = {
              ...p2, saldo_temp: (p2.saldo_temp || 0) + (p1wins ? 1 : 2),
              vitorias: (p2.vitorias || 0) + (p1wins ? 0 : 1),
              derrotas: (p2.derrotas || 0) + (p1wins ? 1 : 0),
            };
            infoPorPartida[match.id] = { favorito_id: null as any, diferenca_rating_momento: null as any };
            continue;
          }
          const favoritoId = p1.rating >= p2.rating ? p1.id : p2.id;
          const diferencaRatingMomento = Math.abs(p1.rating - p2.rating);
          const newR1 = calcElo(p1.rating, p2.rating, p1wins ? 1 : 0);
          const newR2 = calcElo(p2.rating, p1.rating, p1wins ? 0 : 1);
          const delta1 = newR1 - p1.rating, delta2 = newR2 - p2.rating;
          const dataCalculo = match.admin_aprovado_em || new Date().toISOString();

          athletesMap[match.atleta1_id] = {
            ...p1, rating: newR1, saldo_temp: (p1.saldo_temp || 0) + delta1,
            vitorias: (p1.vitorias || 0) + (p1wins ? 1 : 0),
            derrotas: (p1.derrotas || 0) + (p1wins ? 0 : 1),
            rating_pico: Math.max(p1.rating_pico || p1.rating, newR1),
            rating_historico: [...(p1.rating_historico || []), { data: dataCalculo, rating: newR1 }].slice(-30),
          };
          athletesMap[match.atleta2_id] = {
            ...p2, rating: newR2, saldo_temp: (p2.saldo_temp || 0) + delta2,
            vitorias: (p2.vitorias || 0) + (p1wins ? 0 : 1),
            derrotas: (p2.derrotas || 0) + (p1wins ? 1 : 0),
            rating_pico: Math.max(p2.rating_pico || p2.rating, newR2),
            rating_historico: [...(p2.rating_historico || []), { data: dataCalculo, rating: newR2 }].slice(-30),
          };
          infoPorPartida[match.id] = { favorito_id: favoritoId, diferenca_rating_momento: diferencaRatingMomento };
        }

        const idsWoB = new Set<string>();
        for (const w of wos) {
          if (sistema === "B") {
            // Fatia 5 — W.O. no Sistema B: NÃO anula. Adversário +2 (V+1); ausente +1 (justificado)
            // ou +0 (culposo/a_favor), sempre D+1. O wo_culposos já foi contado no APLICAR/RESPONDER.
            const benefB = w.wo_beneficiario_id ? athletesMap[w.wo_beneficiario_id] : null;
            if (benefB) athletesMap[w.wo_beneficiario_id] = { ...benefB, saldo_temp: (benefB.saldo_temp || 0) + 2, vitorias: (benefB.vitorias || 0) + 1 };
            const faltB = w.wo_faltoso_id ? athletesMap[w.wo_faltoso_id] : null;
            if (faltB) {
              const ptsFalt = (w.wo_tipo === "justificado") ? 1 : 0;
              athletesMap[w.wo_faltoso_id] = { ...faltB, saldo_temp: (faltB.saldo_temp || 0) + ptsFalt, derrotas: (faltB.derrotas || 0) + 1 };
            }
            if (w.wo_beneficiario_id) idsWoB.add(w.wo_beneficiario_id);
            if (w.wo_faltoso_id) idsWoB.add(w.wo_faltoso_id);
            continue;
          }
          const dataWo = w.admin_aprovado_em || new Date().toISOString();
          const benef = w.wo_beneficiario_id ? athletesMap[w.wo_beneficiario_id] : null;
          if (benef) {
            const nr = benef.rating + 8;
            athletesMap[w.wo_beneficiario_id] = {
              ...benef, rating: nr, saldo_temp: (benef.saldo_temp || 0) + 8,
              vitorias: (benef.vitorias || 0) + 1,
              rating_pico: Math.max(benef.rating_pico || benef.rating, nr),
              rating_historico: [...(benef.rating_historico || []), { data: dataWo, rating: nr }].slice(-30),
            };
          }
          const falt = (w.wo_tipo === "culposo" && w.wo_faltoso_id) ? athletesMap[w.wo_faltoso_id] : null;
          if (falt) {
            const nr = falt.rating - 15;
            athletesMap[w.wo_faltoso_id] = {
              ...falt, rating: nr, saldo_temp: (falt.saldo_temp || 0) - 15,
              derrotas: (falt.derrotas || 0) + 1,
              rating_historico: [...(falt.rating_historico || []), { data: dataWo, rating: nr }].slice(-30),
            };
          }
        }

        const todosAtivos = await getAtivosNoCircuito(circuitoId, false);
        todosAtivos.forEach(a => { if (!athletesMap[a.id]) athletesMap[a.id] = { ...a }; });

        const { data: partidasTemporada, error: errPartidasTmp } = await supabase.from("partidas").select("atleta1_id,atleta2_id,placar1,placar2,validado,rejeitado").eq("circuito_id", circuitoId);
        if (errPartidasTmp) throw errPartidasTmp;
        const idsComPartida = new Set<string>();
        (partidasTemporada ?? []).forEach((m: any) => { if (m.validado && !m.rejeitado) { idsComPartida.add(m.atleta1_id); idsComPartida.add(m.atleta2_id); } });
        // Fatia 5: quem pontuou via W.O. no B entra no ranking desta rodada (a partida de W.O. não é "validada").
        if (sistema === "B") idsWoB.forEach(id => idsComPartida.add(id));

        // Fatia 4: bye +1 (ponto de participação) no Sistema B — idempotente por rodada.
        // Trava dupla p/ não premiar entrante tardio: só quando nº de ativos é ímpar E há exatamente 1 fora da rodada.
        // Idempotência: só na 1ª passada (nenhuma partida da rodada ainda calculada).
        if (sistema === "B") {
          const { data: partidasDaRodada } = await supabase
            .from("partidas").select("atleta1_id,atleta2_id,calculado,rejeitado")
            .eq("circuito_id", circuitoId).eq("rodada", round);
          const jaProcessadaAntes = (partidasDaRodada ?? []).some((p: any) => p.calculado);
          if (!jaProcessadaAntes) {
            const jogou = new Set<string>();
            (partidasDaRodada ?? []).forEach((p: any) => { if (!p.rejeitado) { jogou.add(p.atleta1_id); jogou.add(p.atleta2_id); } });
            const cfgBye = await getCfg(circuitoId, "financeiro_ativo");
            const ativosBye = await getAtivosNoCircuito(circuitoId, !!cfgBye?.financeiro_ativo);
            const foraDaRodada = (ativosBye || []).filter((a: any) => !jogou.has(a.id));
            if ((ativosBye || []).length % 2 === 1 && foraDaRodada.length === 1) {
              const byeId = foraDaRodada[0].id;
              const b = athletesMap[byeId] || { ...foraDaRodada[0] };
              athletesMap[byeId] = { ...b, saldo_temp: (b.saldo_temp || 0) + 1 };
              idsComPartida.add(byeId); // ganhou ponto → entra no ranking desta rodada
            }
          }
        }

        const rankingAtual = Object.values(athletesMap)
          .filter((a: any) => a.status === "ativo" && !a.pendente_circuito && idsComPartida.has(a.id))
          .sort(sistema === "B" ? cmpRankingB(partidasTemporada ?? []) : cmpRankingDB(partidasTemporada ?? []));

        const dataSnapshot = new Date().toISOString();
        rankingAtual.forEach((a: any, i: number) => {
          athletesMap[a.id] = {
            ...athletesMap[a.id],
            posicao_historico: [...(athletesMap[a.id].posicao_historico || []), { data: dataSnapshot, posicao: i + 1 }].slice(-30),
          };
        });

        const idsAlterados = new Set<string>();
        pendentes.forEach(m => { idsAlterados.add(m.atleta1_id); idsAlterados.add(m.atleta2_id); });
        wos.forEach((m: any) => { idsAlterados.add(m.atleta1_id); idsAlterados.add(m.atleta2_id); });
        rankingAtual.forEach((a: any) => idsAlterados.add(a.id));

        for (const id of idsAlterados) {
          const a = athletesMap[id];
          if (sistema === "B") {
            // Sistema B: grava só sazonais de pontos — nunca rating (identidade global).
            await writeAtleta(circuitoId, id, {
              saldo_temp: a.saldo_temp, vitorias: a.vitorias, derrotas: a.derrotas,
              posicao_historico: a.posicao_historico,
            });
          } else {
            await writeAtleta(circuitoId, id, {
              rating: a.rating, saldo_temp: a.saldo_temp, vitorias: a.vitorias, derrotas: a.derrotas,
              rating_pico: a.rating_pico, rating_historico: a.rating_historico,
              posicao_historico: a.posicao_historico,
            });
          }
        }

        for (const m of pendentes) {
          const info = infoPorPartida[m.id];
          const { error } = await supabase.from("partidas").update({
            calculado: true,
            favorito_id: info?.favorito_id ?? null,
            diferenca_rating_momento: info?.diferenca_rating_momento ?? null,
          }).eq("id", m.id);
          if (error) throw error;
        }
        for (const w of wos) {
          const { error } = await supabase.from("partidas").update({ calculado: true }).eq("id", w.id);
          if (error) throw error;
        }

        return jsonResponse({ sucesso: true, dados: { processadas: pendentes.length + wos.length } });
      }

      case "EDITAR_ATLETA": {
        const { id, nome, telefone, apelido, rating, status, pendenteCircuito } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        const upd: Record<string, unknown> = { nome, telefone, apelido: apelido || null, rating, status };
        if (typeof pendenteCircuito === "boolean") upd.pendente_circuito = pendenteCircuito;
        await writeAtleta(circuitoId, id, upd);
        return jsonResponse({ sucesso: true });
      }

      case "INCLUIR_NO_CIRCUITO": {
        const { id } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        const cfg = await getCfg(circuitoId, "max_atletas");
        const max = cfg?.max_atletas || 20;
        const nCirc = await countAtivosNoCircuito(circuitoId);
        if (nCirc >= max) {
          return jsonResponse({ sucesso: false, erro: `Circuito cheio (${nCirc}/${max}). Abra uma vaga antes de incluir.` }, 409);
        }
        await writeAtleta(circuitoId, id, { pendente_circuito: false });
        return jsonResponse({ sucesso: true });
      }

      case "RECUSAR_CIRCUITO": {
        const { id } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        const agoraRecusa = new Date().toISOString();
        await writeAtleta(circuitoId, id, { ultima_recusa_circuito_em: agoraRecusa });
        return jsonResponse({ sucesso: true });
      }

      case "ARQUIVAR_ATLETA": {
        const { id } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        await writeAtleta(circuitoId, id, { status: "arquivado", pendente_circuito: false });
        return jsonResponse({ sucesso: true });
      }

      case "VALIDATE_RESULT": {
        const { matchId, approved, motivo } = payload || {};
        if (!matchId) return jsonResponse({ sucesso: false, erro: "matchId é obrigatório" }, 400);
        if (typeof approved !== "boolean") return jsonResponse({ sucesso: false, erro: "approved (boolean) é obrigatório" }, 400);

        if (approved) {
          const { data: match, error: errMatch } = await supabase.from("partidas").select("p1_placar1,p1_placar2,p2_placar1,p2_placar2").eq("id", matchId).single();
          if (errMatch) throw errMatch;
          if (!match) return jsonResponse({ sucesso: false, erro: "Partida não encontrada" }, 404);
          const consistente = match.p1_placar1 === match.p2_placar1 && match.p1_placar2 === match.p2_placar2;
          if (!consistente) return jsonResponse({ sucesso: false, erro: "Placares divergentes entre os dois atletas — verifique antes de aprovar." }, 409);
          const now = new Date().toISOString();
          const { error } = await supabase.from("partidas").update({
            placar1: match.p1_placar1, placar2: match.p1_placar2,
            validado: true, validado_por_admin: true, admin_aprovado_em: now, calculado: false,
          }).eq("id", matchId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("partidas").update({ rejeitado: true, motivo_rejeicao: motivo }).eq("id", matchId);
          if (error) throw error;
        }
        return jsonResponse({ sucesso: true });
      }

      case "ADMIN_IMPUTAR_RESULTADO": {
        const { matchId, score1, score2 } = payload || {};
        if (!matchId) return jsonResponse({ sucesso: false, erro: "matchId é obrigatório" }, 400);
        if (typeof score1 !== "number" || typeof score2 !== "number") return jsonResponse({ sucesso: false, erro: "score1 e score2 (números) são obrigatórios" }, 400);
        const now = new Date().toISOString();
        const { error } = await supabase.from("partidas").update({
          placar1: score1, placar2: score2,
          validado: true, validado_por_admin: true, admin_aprovado_em: now, calculado: false, imputado_pelo_admin: true,
        }).eq("id", matchId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "INICIAR_ETAPA": {
        const config = await getCfg(circuitoId, "fase,financeiro_ativo");
        if (config?.fase === "etapa") {
          return jsonResponse({ sucesso: false, erro: "A etapa já está em andamento. Use AVANCAR_RODADA para o próximo par mensal." }, 409);
        }
        await promoverBacklog(circuitoId);

        const ativos = await getAtivosNoCircuito(circuitoId, !!config?.financeiro_ativo);
        if (!ativos || ativos.length < 8) {
          return jsonResponse({ sucesso: false, erro: `Mínimo de 8 atletas ativos para iniciar a etapa (atual: ${ativos?.length ?? 0}).` }, 400);
        }

        const { prazoA, prazoB } = calcularPrazos();
        const bhKeyIni = await bhId();
        const keyId = (circuitoId === bhKeyIni) ? "key_1" : `key_${circuitoId.slice(0, 8)}`;
        await setCfg(circuitoId, { fase: "etapa" });
        await supabase.from("chaves").insert({ id: keyId, nome: "Chave Única", rodada_atual: 1, circuito_id: circuitoId });
        for (const a of ativos) {
          await writeAtleta(circuitoId, a.id, { chave: keyId });
        }
        const sistemaIni = await getSistema(circuitoId); // Fatia 3: pareamento do Sistema B
        const pareamentoIni = sistemaIni === "B" ? ((await getCfg(circuitoId, "pareamento"))?.pareamento || "sorteio") : null;
        const { rodada1, rodada2 } = sistemaIni === "B"
          ? gerarPareamentoB(ativos, [], pareamentoIni)
          : gerarPareamentoPorRating(ativos, []);
        for (const pair of rodada1) {
          const mid = `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const { error } = await supabase.from("partidas").insert({ id: mid, chave_id: keyId, rodada: 1, atleta1_id: pair.p1, atleta2_id: pair.p2, prazo: prazoA, circuito_id: circuitoId });
          if (error) throw error;
        }
        for (const pair of rodada2) {
          const mid = `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const { error } = await supabase.from("partidas").insert({ id: mid, chave_id: keyId, rodada: 2, atleta1_id: pair.p1, atleta2_id: pair.p2, prazo: prazoB, circuito_id: circuitoId });
          if (error) throw error;
        }
        return jsonResponse({ sucesso: true, dados: { atletas: ativos.length, partidas: rodada1.length + rodada2.length } });
      }

      case "AVANCAR_RODADA": {
        const { data: todasPartidas, error: errPartidas } = await supabase.from("partidas").select("atleta1_id,atleta2_id,rodada,prazo").eq("circuito_id", circuitoId);
        if (errPartidas) throw errPartidas;
        const roundBase = (todasPartidas ?? []).reduce((max: number, m: any) => Math.max(max, m.rodada || 0), 0);
        const cfgRod = await getCfg(circuitoId, "rodadas_por_temporada,financeiro_ativo");
        const maxRodadas = cfgRod?.rodadas_por_temporada || 6;
        if (roundBase >= maxRodadas) {
          return jsonResponse({ sucesso: false, erro: `A temporada já tem as ${maxRodadas} rodadas configuradas. Inicie uma nova temporada.` }, 409);
        }
        const rA = roundBase + 1, rB = roundBase + 2;
        const inicioUltimoTerco = maxRodadas - Math.ceil(maxRodadas / 3) + 1;
        const permiteEntrada = rA < inicioUltimoTerco;
        if (permiteEntrada) {
          await promoverBacklog(circuitoId);
        }
        const ativos = await getAtivosNoCircuito(circuitoId, !!cfgRod?.financeiro_ativo);
        if (!ativos || ativos.length < 2) {
          return jsonResponse({ sucesso: false, erro: `São necessários ao menos 2 atletas ativos para gerar uma rodada (atual: ${ativos?.length ?? 0}).` }, 400);
        }
        const { data: chaveAtual } = await supabase.from("chaves").select("id").eq("circuito_id", circuitoId).limit(1).single();
        const keyId = chaveAtual?.id || "key_1";
        const parIndex = Math.floor(rB / 2) - 1;
        const prazoR1Existente = (todasPartidas ?? []).filter((m: any) => m.rodada === 1 && m.prazo).map((m: any) => m.prazo).sort()[0];
        let mesRef: Date | undefined;
        if (prazoR1Existente) {
          const d1 = new Date(prazoR1Existente + "T12:00:00");
          mesRef = new Date(d1.getFullYear(), d1.getMonth() + parIndex, 1);
        }
        const { prazoA, prazoB } = calcularPrazos(mesRef);
        const sistemaAv = await getSistema(circuitoId); // Fatia 3: pareamento do Sistema B
        const pareamentoAv = sistemaAv === "B" ? ((await getCfg(circuitoId, "pareamento"))?.pareamento || "sorteio") : null;
        const { rodada1, rodada2 } = sistemaAv === "B"
          ? gerarPareamentoB(ativos, todasPartidas ?? [], pareamentoAv)
          : gerarPareamentoPorRating(ativos, todasPartidas ?? []);
        await supabase.from("chaves").update({ rodada_atual: rB }).eq("id", keyId);
        for (const pair of rodada1) {
          const mid = `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const { error } = await supabase.from("partidas").insert({ id: mid, chave_id: keyId, rodada: rA, atleta1_id: pair.p1, atleta2_id: pair.p2, prazo: prazoA, circuito_id: circuitoId });
          if (error) throw error;
        }
        for (const pair of rodada2) {
          const mid = `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const { error } = await supabase.from("partidas").insert({ id: mid, chave_id: keyId, rodada: rB, atleta1_id: pair.p1, atleta2_id: pair.p2, prazo: prazoB, circuito_id: circuitoId });
          if (error) throw error;
        }
        return jsonResponse({ sucesso: true, dados: { rodadas: [rA, rB], partidas: rodada1.length + rodada2.length } });
      }

      case "DESFAZER_VALIDACAO": {
        const { matchId } = payload || {};
        if (!matchId) return jsonResponse({ sucesso: false, erro: "matchId é obrigatório" }, 400);
        const { data: match, error: errMatch } = await supabase.from("partidas").select("calculado").eq("id", matchId).single();
        if (errMatch) throw errMatch;
        if (match?.calculado) return jsonResponse({ sucesso: false, erro: "Não é possível desfazer: o resultado já foi calculado no rating." }, 409);
        const { error } = await supabase.from("partidas").update({
          validado: false, validado_por_admin: false, admin_aprovado_em: null,
          placar1: null, placar2: null, imputado_pelo_admin: false, validado_automatico: false,
        }).eq("id", matchId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "MARCAR_RESULTADO_COMUNICADO": {
        const { matchId, comunicado } = payload || {};
        if (!matchId) return jsonResponse({ sucesso: false, erro: "matchId é obrigatório" }, 400);
        const { error } = await supabase.from("partidas").update({ resultado_comunicado: comunicado }).eq("id", matchId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "REGISTRAR_MENSAGEM_ENVIADA": {
        const { id, athleteId, athleteName, categoria, categoriaLabel, texto, enviadoEm, matchId } = payload || {};
        try {
          const { error } = await supabase.from("mensagens_enviadas").insert({
            id, atleta_id: athleteId || null, atleta_nome: athleteName || null,
            categoria, categoria_label: categoriaLabel, texto, enviado_em: enviadoEm, match_id: matchId || null,
            circuito_id: circuitoId,
          });
          if (error) throw error;
        } catch (e) {
          console.warn("Registro de mensagem no histórico falhou (seguindo mesmo assim):", e.message);
        }
        return jsonResponse({ sucesso: true });
      }

      case "RESPONDER_WO": {
        const { id, matchId, aprovado, motivoRecusa, justificativa } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        if (typeof aprovado !== "boolean") return jsonResponse({ sucesso: false, erro: "aprovado (boolean) é obrigatório" }, 400);
        const sistemaRw = await getSistema(circuitoId); // Fatia 5: no B, aprovado pontua (não anula)
        const now = new Date().toISOString();
        const { error: errSol } = await supabase.from("solicitacoes_wo").update({
          status: aprovado ? "aprovado" : "recusado", respondido_em: now, motivo_recusa: motivoRecusa || null,
        }).eq("id", id).eq("circuito_id", circuitoId);
        if (errSol) throw errSol;
        if (aprovado) {
          if (!matchId) return jsonResponse({ sucesso: false, erro: "matchId é obrigatório quando aprovado" }, 400);
          if (sistemaRw === "B") {
            // Sistema B: W.O. justificado NÃO anula — pontua ausente 1 / adversário 2. Quem é quem vem da solicitação.
            const { data: sol } = await supabase.from("solicitacoes_wo").select("atleta_id,adversario_id").eq("id", id).single();
            const faltR = sol?.atleta_id || null;
            let benefR = sol?.adversario_id || null;
            if (!benefR && faltR) {
              const { data: mt } = await supabase.from("partidas").select("atleta1_id,atleta2_id").eq("id", matchId).single();
              if (mt) benefR = (mt.atleta1_id === faltR) ? mt.atleta2_id : mt.atleta1_id;
            }
            const { error: eMb } = await supabase.from("partidas").update({
              wo_tipo: "justificado", wo_faltoso_id: faltR, wo_beneficiario_id: benefR, admin_aprovado_em: now, calculado: false,
            }).eq("id", matchId);
            if (eMb) throw eMb;
          } else {
            const { error: errMatch } = await supabase.from("partidas").update({
              rejeitado: true, motivo_rejeicao: `W.O. Justificado — ${justificativa || ""}`.trim(),
            }).eq("id", matchId);
            if (errMatch) throw errMatch;
          }
        }
        return jsonResponse({ sucesso: true });
      }

      case "ABRIR_PROXIMA_TEMPORADA": {
        const p = payload || {};
        const cfg = await getCfg(circuitoId, "temporada_numero,temporada_ano");
        const num = cfg?.temporada_numero || 1;
        const ano = cfg?.temporada_ano || new Date().getFullYear();
        const proxNum = num >= 3 ? 1 : num + 1;
        const proxAno = num >= 3 ? ano + 1 : ano;
        const upd: Record<string, unknown> = {
          proxima_aberta: true,
          proxima_nome: (typeof p.nome === "string" && p.nome.trim()) ? p.nome.trim() : null,
          proxima_data_inicio: p.dataInicio || null,
          proxima_rotulo: `${proxNum}/${proxAno}`,
          proxima_valor_cheio: p.valorCheio != null ? Math.max(0, Math.round(Number(p.valorCheio))) : null,
          proxima_valor_desconto: p.valorDesconto != null ? Math.max(0, Math.round(Number(p.valorDesconto))) : null,
        };
        if (p.pixChave !== undefined) upd.pix_chave = (typeof p.pixChave === "string" && p.pixChave.trim()) ? p.pixChave.trim() : null;
        await setCfg(circuitoId, upd);
        return jsonResponse({ sucesso: true, dados: { rotulo: upd.proxima_rotulo } });
      }

      case "CANCELAR_PROXIMA": {
        const updCancel = {
          proxima_aberta: false, proxima_nome: null, proxima_data_inicio: null, proxima_rotulo: null,
          proxima_valor_cheio: null, proxima_valor_desconto: null,
        };
        await setCfg(circuitoId, updCancel);
        return jsonResponse({ sucesso: true });
      }

      case "NOVA_TEMPORADA": {
        if (circuitoId !== await bhId()) {
          return jsonResponse({ sucesso: false, erro: "Virada de temporada multi-circuito ainda não habilitada." }, 400);
        }
        const { data: ativos, error: errAtivos } = await supabase.from("atletas").select("*").eq("status", "ativo");
        if (errAtivos) throw errAtivos;
        const { data: config, error: errConfigGet } = await supabase.from("configuracao").select("temporada_numero,temporada_ano,proxima_aberta,proxima_nome,proxima_data_inicio,proxima_rotulo,proxima_valor_cheio,proxima_valor_desconto").eq("id", 1).single();
        if (errConfigGet) throw errConfigGet;
        const temporadaNumero = config?.temporada_numero || 1;
        const temporadaAno = config?.temporada_ano || new Date().getFullYear();
        const rotuloTemporada = `${temporadaNumero}/${temporadaAno}`;
        const { data: partidasTemporada, error: errPartidasTmp } = await supabase.from("partidas").select("atleta1_id,atleta2_id,placar1,placar2,validado,rejeitado");
        if (errPartidasTmp) throw errPartidasTmp;
        const idsComPartida = new Set<string>();
        (partidasTemporada ?? []).forEach((m: any) => { if (m.validado && !m.rejeitado) { idsComPartida.add(m.atleta1_id); idsComPartida.add(m.atleta2_id); } });
        const rankingFinal = (ativos ?? []).filter((a: any) => !a.pendente_circuito && idsComPartida.has(a.id)).sort(cmpRankingDB(partidasTemporada ?? []));
        const posicaoFinal: Record<string, number> = {};
        rankingFinal.forEach((a: any, i: number) => { posicaoFinal[a.id] = i + 1; });
        for (const a of ativos ?? []) {
          const historicoAtualizado = posicaoFinal[a.id]
            ? [{ temporada: rotuloTemporada, pos: posicaoFinal[a.id] }, ...(a.historico || [])]
            : (a.historico || []);
          const updNova: Record<string, unknown> = {
            vitorias_total: (a.vitorias_total || 0) + (a.vitorias || 0),
            derrotas_total: (a.derrotas_total || 0) + (a.derrotas || 0),
            saldo_temp: 0, vitorias: 0, derrotas: 0, chave: null,
            wo_culposos_temporada: 0,
            pagamento_confirmado: a.pagamento_proxima_confirmado || false,
            pagamento_proxima_confirmado: false,
            quer_renovar: false, renovacao_em: null,
            historico: historicoAtualizado,
          };
          await writeAtleta(circuitoId, a.id, updNova);
        }
        const { error: errArq } = await supabase.rpc("arquivar_partidas_temporada", { p_rotulo: rotuloTemporada });
        if (errArq) throw errArq;
        await supabase.from("partidas").delete().neq("id", "__none__");
        await supabase.from("chaves").delete().neq("id", "__none__");
        const proximoNumero = temporadaNumero >= 3 ? 1 : temporadaNumero + 1;
        const proximoAno = temporadaNumero >= 3 ? temporadaAno + 1 : temporadaAno;
        const updConfig: Record<string, unknown> = {
          fase: "inscricoes", temporada_numero: proximoNumero, temporada_ano: proximoAno,
          proxima_aberta: false, proxima_nome: null, proxima_data_inicio: null, proxima_rotulo: null,
          proxima_valor_cheio: null, proxima_valor_desconto: null,
        };
        const pNova = payload || {};
        if (config?.proxima_aberta) {
          if (config.proxima_nome) updConfig.nome_circuito = config.proxima_nome;
          updConfig.data_inicio_temporada = config.proxima_data_inicio || null;
          // Carrega o valor anunciado da próxima como valor oficial da nova temporada:
          // valor cheio -> valor_temporada, e o % de desconto de renovação -> desconto global.
          if (config.proxima_valor_cheio != null) {
            updConfig.valor_temporada = config.proxima_valor_cheio;
            updConfig.desconto_global_pct = (config.proxima_valor_desconto != null && config.proxima_valor_cheio > 0)
              ? Math.max(0, Math.min(100, Math.round((1 - config.proxima_valor_desconto / config.proxima_valor_cheio) * 100)))
              : 0;
          }
        } else {
          if (typeof pNova.nome === "string" && pNova.nome.trim()) updConfig.nome_circuito = pNova.nome.trim();
          if (pNova.dataInicio !== undefined) updConfig.data_inicio_temporada = pNova.dataInicio || null;
        }
        const { error: errConfig } = await supabase.from("configuracao").update(updConfig).eq("id", 1);
        if (errConfig) throw errConfig;
        await mirrorConfig(circuitoId, updConfig);
        return jsonResponse({ sucesso: true, dados: { temporadaNumero: proximoNumero, temporadaAno: proximoAno, arquivadas: rotuloTemporada } });
      }

      case "APLICAR_WO": {
        const { matchId, tipo, faltosoId, beneficiarioId } = payload || {};
        if (!matchId) return jsonResponse({ sucesso: false, erro: "matchId é obrigatório" }, 400);
        if (!["justificado", "culposo", "a_favor"].includes(tipo)) return jsonResponse({ sucesso: false, erro: "tipo deve ser 'justificado', 'culposo' ou 'a_favor'" }, 400);
        // Sistema B (Fatia 5): W.O. NÃO anula — vira pontos no processamento (adversário +2; ausente +1 justificado / 0 injustificado).
        if ((await getSistema(circuitoId)) === "B") {
          if (!beneficiarioId) return jsonResponse({ sucesso: false, erro: "beneficiarioId é obrigatório" }, 400);
          let faltIdB = faltosoId || null;
          if ((tipo === "culposo" || tipo === "justificado") && !faltIdB) return jsonResponse({ sucesso: false, erro: "faltosoId é obrigatório" }, 400);
          if (tipo === "a_favor" && !faltIdB) {
            const { data: mt } = await supabase.from("partidas").select("atleta1_id,atleta2_id").eq("id", matchId).single();
            if (mt) faltIdB = (mt.atleta1_id === beneficiarioId) ? mt.atleta2_id : mt.atleta1_id;
          }
          const nowB = new Date().toISOString();
          const { error: eWoB } = await supabase.from("partidas").update({
            wo_tipo: tipo, wo_faltoso_id: faltIdB, wo_beneficiario_id: beneficiarioId,
            admin_aprovado_em: nowB, calculado: false,
          }).eq("id", matchId);
          if (eWoB) throw eWoB;
          // culposo e a_favor contam como W.O. injustificado (suspensão + desempate); justificado não conta.
          if ((tipo === "culposo" || tipo === "a_favor") && faltIdB) {
            const { data: caB } = await supabase.from("circuito_atletas").select("wo_culposos_temporada").eq("circuito_id", circuitoId).eq("atleta_id", faltIdB).single();
            await writeAtleta(circuitoId, faltIdB, { wo_culposos_temporada: ((caB?.wo_culposos_temporada) || 0) + 1 });
          }
          return jsonResponse({ sucesso: true });
        }
        if (tipo === "justificado") {
          const { error } = await supabase.from("partidas").update({ rejeitado: true, motivo_rejeicao: "W.O. Justificado" }).eq("id", matchId);
          if (error) throw error;
          return jsonResponse({ sucesso: true });
        }
        if (!beneficiarioId) return jsonResponse({ sucesso: false, erro: "beneficiarioId é obrigatório" }, 400);
        if (tipo === "culposo" && !faltosoId) return jsonResponse({ sucesso: false, erro: "faltosoId é obrigatório no culposo" }, 400);
        const now = new Date().toISOString();
        const { error } = await supabase.from("partidas").update({
          wo_tipo: tipo, wo_faltoso_id: tipo === "culposo" ? faltosoId : null, wo_beneficiario_id: beneficiarioId,
          admin_aprovado_em: now, calculado: false,
        }).eq("id", matchId);
        if (error) throw error;
        if (tipo === "culposo" && faltosoId) {
          const { data: atl } = await supabase.from("atletas").select("wo_culposos_temporada").eq("id", faltosoId).single();
          const novo = ((atl?.wo_culposos_temporada) || 0) + 1;
          await writeAtleta(circuitoId, faltosoId, { wo_culposos_temporada: novo });
        }
        return jsonResponse({ sucesso: true });
      }

      case "MARCAR_WO_NOTIFICADO": {
        const { id, quem } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        if (quem !== "solicitante" && quem !== "adversario") return jsonResponse({ sucesso: false, erro: "quem deve ser 'solicitante' ou 'adversario'" }, 400);
        const campo = quem === "solicitante" ? "notificado_solicitante" : "notificado_adversario";
        const { error } = await supabase.from("solicitacoes_wo").update({ [campo]: true }).eq("id", id).eq("circuito_id", circuitoId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "DEFINIR_RODADAS": {
        const { rodadas } = payload || {};
        if (typeof rodadas !== "number" || rodadas < 2 || rodadas > 6 || rodadas % 2 !== 0) return jsonResponse({ sucesso: false, erro: "rodadas deve ser par entre 2 e 6 (máx. 3 meses)" }, 400);
        await setCfg(circuitoId, { rodadas_por_temporada: rodadas });
        return jsonResponse({ sucesso: true });
      }

      case "DEFINIR_AUTO_VALIDAR": {
        const { ligado } = payload || {};
        if (typeof ligado !== "boolean") return jsonResponse({ sucesso: false, erro: "ligado (boolean) é obrigatório" }, 400);
        await setCfg(circuitoId, { auto_validar_placar: ligado });
        return jsonResponse({ sucesso: true });
      }

      // Liga/desliga as inscrições do circuito. A coluna `inscricoes_abertas` vive SÓ em
      // `circuitos` (inclusive pro BH), então grava direto lá — nunca via setCfg/configuracao.
      case "DEFINIR_INSCRICOES_ABERTAS": {
        const { abertas } = payload || {};
        if (typeof abertas !== "boolean") return jsonResponse({ sucesso: false, erro: "abertas (boolean) é obrigatório" }, 400);
        const { error } = await supabase.from("circuitos").update({ inscricoes_abertas: abertas }).eq("id", circuitoId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      // Guarda o handle (credId) da biometria do ADMIN (protegido pelo PIN, ja checado
      // no topo do handler). NAO e' segredo. Permite recuperar a biometria do admin
      // depois que o navegador limpa o localStorage. Config global (admin unico).
      case "SALVAR_ADMIN_BIO_CRED": {
        const { credId } = payload || {};
        if (!credId || typeof credId !== "string") return jsonResponse({ sucesso: false, erro: "credId é obrigatório" }, 400);
        const { data: cfg, error: eSel } = await supabase.from("configuracao").select("admin_bio_cred_ids").eq("id", 1).single();
        if (eSel) throw eSel;
        const atual = Array.isArray(cfg?.admin_bio_cred_ids) ? (cfg!.admin_bio_cred_ids as string[]) : [];
        if (!atual.includes(credId)) {
          const novo = [...atual, credId].slice(-5); // no maximo 5 aparelhos
          const { error: eUpd } = await supabase.from("configuracao").update({ admin_bio_cred_ids: novo }).eq("id", 1);
          if (eUpd) throw eUpd;
        }
        return jsonResponse({ sucesso: true });
      }

      // Cria um NOVO circuito (plataforma multi-circuito, Fase A1). Protegido pelo PIN
      // (super-admin). NAO toca no BH nem em nenhum circuito existente: e' um INSERT puro
      // em `circuitos` com defaults saos espelhando o BH. Reversivel por DELETE.
      // O `sistema` (A=rating / B=pontos) TRAVA na criacao e nunca muda (dados incompativeis).
      case "CRIAR_CIRCUITO": {
        const p = payload || {};
        const nome = String(p.nome || "").trim();
        const slug = String(p.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
        const cidade = p.cidade ? String(p.cidade).trim() : null;
        const uf = p.uf ? String(p.uf).trim().toUpperCase().slice(0, 2) : null;
        const sistema = (p.sistema === "A" || p.sistema === "B") ? p.sistema : null;
        const pareamento = (p.pareamento === "sorteio" || p.pareamento === "grupos") ? p.pareamento : null;
        const maxAtletas = p.maxAtletas != null ? Math.max(10, Math.round(Number(p.maxAtletas) || 20)) : 20;
        const rodadas = (p.rodadas != null && Number(p.rodadas) >= 2 && Number(p.rodadas) % 2 === 0) ? Math.min(6, Math.round(Number(p.rodadas))) : 6;

        if (!nome) return jsonResponse({ sucesso: false, erro: "Nome do circuito é obrigatório." }, 400);
        if (slug.length < 2) return jsonResponse({ sucesso: false, erro: "Slug inválido — use ao menos 2 caracteres (letras, números ou hífen)." }, 400);
        if (slug === "bh") return jsonResponse({ sucesso: false, erro: "O slug 'bh' é reservado ao circuito de Belo Horizonte." }, 400);
        if (!sistema) return jsonResponse({ sucesso: false, erro: "Escolha o sistema do circuito (A — rating, ou B — pontos)." }, 400);
        if (sistema === "B" && !pareamento) return jsonResponse({ sucesso: false, erro: "No Sistema B, escolha o método de pareamento (sorteio ou grupos)." }, 400);

        const { data: jaExiste, error: eSel } = await supabase.from("circuitos").select("id").eq("slug", slug).maybeSingle();
        if (eSel) throw eSel;
        if (jaExiste) return jsonResponse({ sucesso: false, erro: `Já existe um circuito com o slug '${slug}'. Escolha outro.` }, 409);

        const novo = {
          slug,
          nome_circuito: nome,
          cidade,
          uf,
          sistema,
          pareamento: sistema === "B" ? pareamento : null,
          fase: "inscricoes",
          temporada_numero: 1,
          temporada_ano: new Date().getFullYear(),
          rodadas_por_temporada: rodadas,
          auto_validar_placar: false,
          financeiro_ativo: false,
          max_atletas: maxAtletas,
          desconto_global_pct: 0,
          percentual_entrada_meio: 80,
          ativo: true,
          regulamento_versao: sistema === "A" ? "v03-12" : "vB-01",
          inscricoes_abertas: false,
        };
        const { data: ins, error } = await supabase.from("circuitos").insert(novo).select("id, slug, nome_circuito, sistema, pareamento").single();
        if (error) {
          const msg = String(error.message || "");
          if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("circuitos_slug_key")) {
            return jsonResponse({ sucesso: false, erro: `Já existe um circuito com o slug '${slug}'. Escolha outro.` }, 409);
          }
          throw error;
        }
        return jsonResponse({ sucesso: true, dados: ins });
      }

      case "DEFINIR_CONFIG_CIRCUITO": {
        const p = payload || {};
        const upd: Record<string, unknown> = {};
        if (typeof p.nome === "string") upd.nome_circuito = p.nome.trim() || "Clube do Tênis de Mesa";
        if (p.dataInicio !== undefined) upd.data_inicio_temporada = p.dataInicio || null;
        if (p.maxAtletas !== undefined) upd.max_atletas = Math.max(2, Math.round(Number(p.maxAtletas) || 20));
        if (p.pixChave !== undefined) upd.pix_chave = (typeof p.pixChave === "string" && p.pixChave.trim()) ? p.pixChave.trim() : null;
        if (Object.keys(upd).length === 0) return jsonResponse({ sucesso: false, erro: "Nada para atualizar." }, 400);
        await setCfg(circuitoId, upd);
        return jsonResponse({ sucesso: true });
      }

      case "DEFINIR_FINANCEIRO": {
        const p = payload || {};
        const upd: Record<string, unknown> = {};
        if (typeof p.ativo === "boolean") upd.financeiro_ativo = p.ativo;
        if (p.valorTemporada !== undefined) upd.valor_temporada = (p.valorTemporada === null ? null : Math.max(0, Math.round(Number(p.valorTemporada))));
        if (p.descontoGlobalPct !== undefined) upd.desconto_global_pct = Math.min(100, Math.max(0, Math.round(Number(p.descontoGlobalPct) || 0)));
        if (p.percentualMeio !== undefined) upd.percentual_entrada_meio = Math.min(100, Math.max(0, Math.round(Number(p.percentualMeio) || 80)));
        if (p.proximaValorCheio !== undefined) upd.proxima_valor_cheio = (p.proximaValorCheio === null ? null : Math.max(0, Math.round(Number(p.proximaValorCheio))));
        if (p.proximaValorDesconto !== undefined) upd.proxima_valor_desconto = (p.proximaValorDesconto === null ? null : Math.max(0, Math.round(Number(p.proximaValorDesconto))));
        if (Object.keys(upd).length === 0) return jsonResponse({ sucesso: false, erro: "Nada para atualizar." }, 400);
        await setCfg(circuitoId, upd);
        return jsonResponse({ sucesso: true });
      }

      case "DEFINIR_DESCONTO_ATLETA": {
        const { atletaId, descontoPct, isento } = payload || {};
        if (!atletaId) return jsonResponse({ sucesso: false, erro: "atletaId é obrigatório" }, 400);
        const upd: Record<string, unknown> = {};
        if (descontoPct !== undefined) upd.desconto_pct = (descontoPct === null ? null : Math.min(100, Math.max(0, Math.round(Number(descontoPct) || 0))));
        if (typeof isento === "boolean") upd.isento = isento;
        if (Object.keys(upd).length === 0) return jsonResponse({ sucesso: false, erro: "Nada para atualizar." }, 400);
        await writeAtleta(circuitoId, atletaId, upd);
        return jsonResponse({ sucesso: true });
      }

      case "REGISTRAR_PAGAMENTO": {
        const p = payload || {};
        if (!p.atletaId) return jsonResponse({ sucesso: false, erro: "atletaId é obrigatório" }, 400);
        const alvo = (p.alvo === "proxima") ? "proxima" : "atual";
        const id = p.id || `pag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const now = new Date().toISOString();
        const { error: errIns } = await supabase.from("pagamentos").insert({
          id, atleta_id: p.atletaId, temporada_rotulo: p.temporadaRotulo || null, circuito_id: circuitoId,
          valor: p.valor != null ? Math.max(0, Math.round(Number(p.valor))) : null,
          percentual: p.percentual != null ? Math.round(Number(p.percentual)) : null,
          desconto_pct_aplicado: p.descontoPctAplicado != null ? Math.round(Number(p.descontoPctAplicado)) : null,
          isento: !!p.isento, status: "confirmado", metodo: p.metodo || "pix",
          comprovante_url: p.comprovanteUrl || null, observacao: p.observacao || null,
          confirmado_em: now, criado_em: now,
        });
        if (errIns) throw errIns;
        const flagCol = alvo === "proxima" ? { pagamento_proxima_confirmado: true } : { pagamento_confirmado: true };
        await writeAtleta(circuitoId, p.atletaId, flagCol);
        return jsonResponse({ sucesso: true, dados: { id, alvo } });
      }

      case "ESTORNAR_PAGAMENTO": {
        const { id } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        const { data: pag, error: errGet } = await supabase.from("pagamentos").select("atleta_id,temporada_rotulo").eq("id", id).eq("circuito_id", circuitoId).single();
        if (errGet) throw errGet;
        if (!pag) return jsonResponse({ sucesso: false, erro: "Pagamento não encontrado." }, 404);
        const { error: errUpd } = await supabase.from("pagamentos").update({ status: "estornado" }).eq("id", id).eq("circuito_id", circuitoId);
        if (errUpd) throw errUpd;
        if (pag.atleta_id) {
          const cfg = await getCfg(circuitoId, "proxima_rotulo");
          const ehProxima = !!(pag.temporada_rotulo && cfg?.proxima_rotulo && pag.temporada_rotulo === cfg.proxima_rotulo);
          const flagCol = ehProxima ? { pagamento_proxima_confirmado: false } : { pagamento_confirmado: false };
          await writeAtleta(circuitoId, pag.atleta_id, flagCol);
        }
        return jsonResponse({ sucesso: true });
      }

      case "LISTAR_PAGAMENTOS": {
        const { data, error } = await supabase.from("pagamentos").select("*").eq("circuito_id", circuitoId).order("criado_em", { ascending: false }).limit(500);
        if (error) throw error;
        return jsonResponse({ sucesso: true, dados: data });
      }

      case "EDITAR_PAGAMENTO": {
        const p = payload || {};
        if (!p.id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        const upd: Record<string, unknown> = {};
        if (p.valor !== undefined) upd.valor = p.valor != null ? Math.max(0, Math.round(Number(p.valor))) : null;
        if (p.percentual !== undefined) upd.percentual = p.percentual != null ? Math.round(Number(p.percentual)) : null;
        if (p.descontoPctAplicado !== undefined) upd.desconto_pct_aplicado = p.descontoPctAplicado != null ? Math.round(Number(p.descontoPctAplicado)) : null;
        if (p.metodo !== undefined) upd.metodo = p.metodo || "pix";
        if (p.observacao !== undefined) upd.observacao = p.observacao || null;
        if (Object.keys(upd).length === 0) return jsonResponse({ sucesso: false, erro: "Nada para atualizar." }, 400);
        const { error } = await supabase.from("pagamentos").update(upd).eq("id", p.id).eq("circuito_id", circuitoId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "LISTAR_TELEFONES": {
        const { data, error } = await supabase.from("atletas").select("id, telefone");
        if (error) throw error;
        return jsonResponse({ sucesso: true, dados: data });
      }

      case "LISTAR_MENSAGENS": {
        const { data, error } = await supabase.from("mensagens_enviadas").select("*").eq("circuito_id", circuitoId).order("enviado_em", { ascending: false }).limit(200);
        if (error) throw error;
        return jsonResponse({ sucesso: true, dados: data });
      }

      default:
        return jsonResponse({ sucesso: false, erro: `Ação desconhecida: ${acao}` }, 400);
    }
  } catch (e) {
    console.error(e);
    return jsonResponse({ sucesso: false, erro: e.message || "Erro interno" }, 500);
  }
});
