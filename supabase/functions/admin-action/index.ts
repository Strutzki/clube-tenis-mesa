import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PIN = Deno.env.get("ADMIN_PIN")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ALLOWED_ORIGINS = [
  "https://clubedotenisdemesabh.com.br",
  "https://www.clubedotenisdemesabh.com.br",
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

function parearRodada(athletes: any[], historico: Set<string>): { pares: { p1: string; p2: string }[]; bye: string | null } {
  const sorted = [...athletes].sort((a, b) => (b.rating || 250) - (a.rating || 250));

  let byeId: string | null = null;
  let jogadores = sorted;
  if (sorted.length % 2 !== 0) {
    byeId = sorted[sorted.length - 1].id;
    jogadores = sorted.slice(0, -1);
  }

  const n = jogadores.length;
  const usados = new Array(n).fill(false);

  function custo(i: number, j: number) {
    return Math.abs((jogadores[i].rating || 250) - (jogadores[j].rating || 250));
  }

  function resolver(pares: { p1: string; p2: string }[]): { p1: string; p2: string }[] | null {
    const i = usados.findIndex((u) => !u);
    if (i === -1) return pares;

    usados[i] = true;
    const candidatos: { j: number; c: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (j === i || usados[j]) continue;
      if (jaSeEnfrentaram(jogadores[i].id, jogadores[j].id, historico)) continue;
      candidatos.push({ j, c: custo(i, j) });
    }
    candidatos.sort((a, b) => a.c - b.c);

    for (const { j } of candidatos) {
      usados[j] = true;
      const res = resolver([...pares, { p1: jogadores[i].id, p2: jogadores[j].id }]);
      if (res) return res;
      usados[j] = false;
    }
    usados[i] = false;
    return null;
  }

  let pares = resolver([]);

  if (!pares) {
    pares = [];
    const u2 = new Array(n).fill(false);
    for (let i = 0; i < n; i++) {
      if (u2[i]) continue;
      u2[i] = true;
      let best = -1, bestC = Infinity;
      for (let j = i + 1; j < n; j++) {
        if (u2[j]) continue;
        const c = custo(i, j);
        if (c < bestC) { bestC = c; best = j; }
      }
      if (best >= 0) { u2[best] = true; pares.push({ p1: jogadores[i].id, p2: jogadores[best].id }); }
    }
  }

  return { pares, bye: byeId };
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

function calcularPrazos() {
  const hoje = new Date();
  const ano = hoje.getFullYear(), mes = hoje.getMonth();
  const prazoA = new Date(ano, mes, 15);
  const prazoB = new Date(ano, mes, 25);
  if (prazoA < hoje) prazoA.setMonth(prazoA.getMonth() + 1);
  if (prazoB < hoje) prazoB.setMonth(prazoB.getMonth() + 1);
  return { prazoA: prazoA.toISOString().split("T")[0], prazoB: prazoB.toISOString().split("T")[0] };
}

Deno.serve(async (req) => {
  // CORS por requisição: só ecoa a origem de volta se ela estiver na lista
  // permitida — o navegador do visitante é quem realmente faz a checagem
  // (se a origem não bater, o navegador bloqueia a leitura da resposta,
  // mesmo que o servidor responda 200).
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

  try {
    switch (acao) {
      case "EXCLUIR_ATLETA": {
        const { id } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        const { error } = await supabase.from("atletas").delete().eq("id", id);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "INSCRICAO_VALIDAR": {
        const { id, rating, approved, motivo } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        const update = approved
          ? { status: "ativo", rating, rating_inicial: rating, saldo_temp: 0, pendente_circuito: true }
          : { status: "reprovado", motivo_reprovacao: motivo };
        const { error } = await supabase.from("atletas").update(update).eq("id", id);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "PROCESSAR_RODADA": {
        const { round } = payload || {};
        if (round === undefined || round === null || typeof round !== "number") {
          return jsonResponse({ sucesso: false, erro: "round é obrigatório" }, 400);
        }

        const { data: partidasRodadaAnterior } = await supabase
          .from("partidas")
          .select("id")
          .eq("rodada", round - 1)
          .eq("validado", true)
          .eq("calculado", false)
          .eq("rejeitado", false);

        if (round % 2 === 0 && (partidasRodadaAnterior?.length ?? 0) > 0) {
          return jsonResponse({ sucesso: false, erro: "A rodada anterior ainda tem resultados sem calcular." }, 409);
        }

        const { data: pendentes, error: errPend } = await supabase
          .from("partidas")
          .select("*")
          .eq("rodada", round)
          .eq("validado", true)
          .eq("calculado", false)
          .eq("rejeitado", false)
          .order("admin_aprovado_em", { ascending: true });
        if (errPend) throw errPend;
        if (!pendentes || pendentes.length === 0) {
          return jsonResponse({ sucesso: true, dados: { processadas: 0 } });
        }

        const idsAtletas = [...new Set(pendentes.flatMap(m => [m.atleta1_id, m.atleta2_id]))];
        const { data: atletasData, error: errAtl } = await supabase
          .from("atletas").select("*").in("id", idsAtletas);
        if (errAtl) throw errAtl;

        const athletesMap: Record<string, any> = {};
        atletasData!.forEach(a => { athletesMap[a.id] = { ...a }; });

        const infoPorPartida: Record<string, { favorito_id: string; diferenca_rating_momento: number }> = {};

        for (const match of pendentes) {
          const p1 = athletesMap[match.atleta1_id];
          const p2 = athletesMap[match.atleta2_id];
          if (!p1 || !p2) continue;
          const p1wins = match.placar1 > match.placar2;
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

        const { data: todosAtivos, error: errTodos } = await supabase
          .from("atletas").select("*").eq("status", "ativo").eq("pendente_circuito", false);
        if (errTodos) throw errTodos;

        todosAtivos!.forEach(a => { if (!athletesMap[a.id]) athletesMap[a.id] = { ...a }; });

        // "Estar no ranking" exige, além de fora do backlog, já ter recebido
        // pelo menos uma partida na temporada — senão quem é incluído no meio
        // do mês aparece no ranking antes da hora (mesmo bug relatado em 11/07).
        const { data: partidasTemporada, error: errPartidasTmp } = await supabase
          .from("partidas").select("atleta1_id,atleta2_id");
        if (errPartidasTmp) throw errPartidasTmp;
        const idsComPartida = new Set<string>();
        (partidasTemporada ?? []).forEach((m: any) => { idsComPartida.add(m.atleta1_id); idsComPartida.add(m.atleta2_id); });

        const rankingAtual = Object.values(athletesMap)
          .filter((a: any) => a.status === "ativo" && !a.pendente_circuito && idsComPartida.has(a.id))
          .sort((a: any, b: any) => (b.saldo_temp || 0) - (a.saldo_temp || 0));

        const dataSnapshot = new Date().toISOString();
        rankingAtual.forEach((a: any, i: number) => {
          athletesMap[a.id] = {
            ...athletesMap[a.id],
            posicao_historico: [...(athletesMap[a.id].posicao_historico || []), { data: dataSnapshot, posicao: i + 1 }].slice(-30),
          };
        });

        const idsAlterados = new Set<string>();
        pendentes.forEach(m => { idsAlterados.add(m.atleta1_id); idsAlterados.add(m.atleta2_id); });
        rankingAtual.forEach((a: any) => idsAlterados.add(a.id));

        for (const id of idsAlterados) {
          const a = athletesMap[id];
          const { error } = await supabase.from("atletas").update({
            rating: a.rating, saldo_temp: a.saldo_temp, vitorias: a.vitorias, derrotas: a.derrotas,
            rating_pico: a.rating_pico, rating_historico: a.rating_historico,
            posicao_historico: a.posicao_historico,
          }).eq("id", id);
          if (error) throw error;
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

        return jsonResponse({ sucesso: true, dados: { processadas: pendentes.length } });
      }

      case "EDITAR_ATLETA": {
        const { id, nome, telefone, apelido, rating, status } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        const { error } = await supabase.from("atletas").update({
          nome, telefone, apelido: apelido || null, rating, status,
        }).eq("id", id);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "INCLUIR_NO_CIRCUITO": {
        const { id } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        const { error } = await supabase.from("atletas").update({ pendente_circuito: false }).eq("id", id);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "RECUSAR_CIRCUITO": {
        const { id } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        const { error } = await supabase.from("atletas")
          .update({ ultima_recusa_circuito_em: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "ARQUIVAR_ATLETA": {
        const { id } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        const { error } = await supabase.from("atletas")
          .update({ status: "arquivado", pendente_circuito: false }).eq("id", id);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "VALIDATE_RESULT": {
        const { matchId, approved, motivo } = payload || {};
        if (!matchId) return jsonResponse({ sucesso: false, erro: "matchId é obrigatório" }, 400);
        if (typeof approved !== "boolean") {
          return jsonResponse({ sucesso: false, erro: "approved (boolean) é obrigatório" }, 400);
        }

        if (approved) {
          const { data: match, error: errMatch } = await supabase
            .from("partidas").select("p1_placar1,p1_placar2,p2_placar1,p2_placar2").eq("id", matchId).single();
          if (errMatch) throw errMatch;
          if (!match) return jsonResponse({ sucesso: false, erro: "Partida não encontrada" }, 404);

          const consistente = match.p1_placar1 === match.p2_placar1 && match.p1_placar2 === match.p2_placar2;
          if (!consistente) {
            return jsonResponse({ sucesso: false, erro: "Placares divergentes entre os dois atletas — verifique antes de aprovar." }, 409);
          }

          const now = new Date().toISOString();
          const { error } = await supabase.from("partidas").update({
            placar1: match.p1_placar1, placar2: match.p1_placar2,
            validado: true, validado_por_admin: true, admin_aprovado_em: now,
            calculado: false,
          }).eq("id", matchId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("partidas")
            .update({ rejeitado: true, motivo_rejeicao: motivo }).eq("id", matchId);
          if (error) throw error;
        }
        return jsonResponse({ sucesso: true });
      }

      case "ADMIN_IMPUTAR_RESULTADO": {
        const { matchId, score1, score2 } = payload || {};
        if (!matchId) return jsonResponse({ sucesso: false, erro: "matchId é obrigatório" }, 400);
        if (typeof score1 !== "number" || typeof score2 !== "number") {
          return jsonResponse({ sucesso: false, erro: "score1 e score2 (números) são obrigatórios" }, 400);
        }
        const now = new Date().toISOString();
        const { error } = await supabase.from("partidas").update({
          placar1: score1, placar2: score2,
          validado: true, validado_por_admin: true, admin_aprovado_em: now,
          calculado: false, imputado_pelo_admin: true,
        }).eq("id", matchId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "INICIAR_ETAPA": {
        const { data: config } = await supabase.from("configuracao").select("fase").eq("id", 1).single();
        if (config?.fase === "etapa") {
          return jsonResponse({ sucesso: false, erro: "A etapa já está em andamento. Use AVANCAR_RODADA para o próximo par mensal." }, 409);
        }

        const { data: ativos, error: errAtivos } = await supabase
          .from("atletas").select("*").eq("status", "ativo").eq("pendente_circuito", false);
        if (errAtivos) throw errAtivos;
        if (!ativos || ativos.length < 8) {
          return jsonResponse({ sucesso: false, erro: `Mínimo de 8 atletas ativos para iniciar a etapa (atual: ${ativos?.length ?? 0}).` }, 400);
        }

        const { prazoA, prazoB } = calcularPrazos();
        const keyId = "key_1";

        const { error: errConfig } = await supabase.from("configuracao").update({ fase: "etapa" }).eq("id", 1);
        if (errConfig) throw errConfig;

        await supabase.from("chaves").insert({ id: keyId, nome: "Chave Única", rodada_atual: 1 });

        for (const a of ativos) {
          const { error } = await supabase.from("atletas").update({ chave: keyId }).eq("id", a.id);
          if (error) throw error;
        }

        const { rodada1, rodada2 } = gerarPareamentoPorRating(ativos, []);

        for (const pair of rodada1) {
          const mid = `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const { error } = await supabase.from("partidas").insert({
            id: mid, chave_id: keyId, rodada: 1, atleta1_id: pair.p1, atleta2_id: pair.p2, prazo: prazoA,
          });
          if (error) throw error;
        }
        for (const pair of rodada2) {
          const mid = `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const { error } = await supabase.from("partidas").insert({
            id: mid, chave_id: keyId, rodada: 2, atleta1_id: pair.p1, atleta2_id: pair.p2, prazo: prazoB,
          });
          if (error) throw error;
        }

        return jsonResponse({ sucesso: true, dados: { atletas: ativos.length, partidas: rodada1.length + rodada2.length } });
      }

      case "AVANCAR_RODADA": {
        const { data: ativos, error: errAtivos } = await supabase
          .from("atletas").select("*").eq("status", "ativo").eq("pendente_circuito", false);
        if (errAtivos) throw errAtivos;
        if (!ativos || ativos.length < 8) {
          return jsonResponse({ sucesso: false, erro: `Mínimo de 8 atletas ativos para avançar a rodada (atual: ${ativos?.length ?? 0}).` }, 400);
        }

        const { data: todasPartidas, error: errPartidas } = await supabase
          .from("partidas").select("atleta1_id,atleta2_id,rodada");
        if (errPartidas) throw errPartidas;

        const roundBase = (todasPartidas ?? []).reduce((max: number, m: any) => Math.max(max, m.rodada || 0), 0);
        const { data: chaveAtual } = await supabase.from("chaves").select("id").limit(1).single();
        const keyId = chaveAtual?.id || "key_1";

        const { prazoA, prazoB } = calcularPrazos();
        const { rodada1, rodada2 } = gerarPareamentoPorRating(ativos, todasPartidas ?? []);
        const rA = roundBase + 1, rB = roundBase + 2;

        await supabase.from("chaves").update({ rodada_atual: rB }).eq("id", keyId);

        for (const pair of rodada1) {
          const mid = `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const { error } = await supabase.from("partidas").insert({
            id: mid, chave_id: keyId, rodada: rA, atleta1_id: pair.p1, atleta2_id: pair.p2, prazo: prazoA,
          });
          if (error) throw error;
        }
        for (const pair of rodada2) {
          const mid = `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const { error } = await supabase.from("partidas").insert({
            id: mid, chave_id: keyId, rodada: rB, atleta1_id: pair.p1, atleta2_id: pair.p2, prazo: prazoB,
          });
          if (error) throw error;
        }

        return jsonResponse({ sucesso: true, dados: { rodadas: [rA, rB], partidas: rodada1.length + rodada2.length } });
      }

      case "DESFAZER_VALIDACAO": {
        const { matchId } = payload || {};
        if (!matchId) return jsonResponse({ sucesso: false, erro: "matchId é obrigatório" }, 400);
        const { data: match, error: errMatch } = await supabase
          .from("partidas").select("calculado").eq("id", matchId).single();
        if (errMatch) throw errMatch;
        if (match?.calculado) {
          return jsonResponse({ sucesso: false, erro: "Não é possível desfazer: o resultado já foi calculado no rating." }, 409);
        }
        const { error } = await supabase.from("partidas").update({
          validado: false, validado_por_admin: false, admin_aprovado_em: null,
          placar1: null, placar2: null, imputado_pelo_admin: false,
        }).eq("id", matchId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "MARCAR_RESULTADO_COMUNICADO": {
        const { matchId, comunicado } = payload || {};
        if (!matchId) return jsonResponse({ sucesso: false, erro: "matchId é obrigatório" }, 400);
        const { error } = await supabase.from("partidas")
          .update({ resultado_comunicado: comunicado }).eq("id", matchId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "REGISTRAR_MENSAGEM_ENVIADA": {
        const { id, athleteId, athleteName, categoria, categoriaLabel, texto, enviadoEm, matchId } = payload || {};
        try {
          const { error } = await supabase.from("mensagens_enviadas").insert({
            id,
            atleta_id: athleteId || null,
            atleta_nome: athleteName || null,
            categoria, categoria_label: categoriaLabel,
            texto, enviado_em: enviadoEm,
            match_id: matchId || null,
          });
          if (error) throw error;
        } catch (e) {
          console.warn("Registro de mensagem no histórico falhou (seguindo mesmo assim):", e.message);
        }
        return jsonResponse({ sucesso: true });
      }

      case "RESPONDER_WO": {
        // Decide uma solicitação de W.O. Justificado. Aprovado = mesmo efeito de
        // VALIDATE_RESULT(approved:false): anula a partida, ninguém pontua.
        const { id, matchId, aprovado, motivoRecusa, justificativa } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        if (typeof aprovado !== "boolean") {
          return jsonResponse({ sucesso: false, erro: "aprovado (boolean) é obrigatório" }, 400);
        }
        const now = new Date().toISOString();
        const { error: errSol } = await supabase.from("solicitacoes_wo").update({
          status: aprovado ? "aprovado" : "recusado",
          respondido_em: now,
          motivo_recusa: motivoRecusa || null,
        }).eq("id", id);
        if (errSol) throw errSol;

        if (aprovado) {
          if (!matchId) return jsonResponse({ sucesso: false, erro: "matchId é obrigatório quando aprovado" }, 400);
          const { error: errMatch } = await supabase.from("partidas").update({
            rejeitado: true,
            motivo_rejeicao: `W.O. Justificado — ${justificativa || ""}`.trim(),
          }).eq("id", matchId);
          if (errMatch) throw errMatch;
        }
        return jsonResponse({ sucesso: true });
      }

      case "NOVA_TEMPORADA": {
        // Zera a temporada: saldo/vitórias/derrotas de todo mundo, arquiva a
        // posição final no histórico, apaga partidas/chaves, avança o contador
        // (3 temporadas por ano — Cap. 13).
        const { data: ativos, error: errAtivos } = await supabase
          .from("atletas").select("*").eq("status", "ativo");
        if (errAtivos) throw errAtivos;

        const { data: config, error: errConfigGet } = await supabase
          .from("configuracao").select("temporada_numero,temporada_ano").eq("id", 1).single();
        if (errConfigGet) throw errConfigGet;
        const temporadaNumero = config?.temporada_numero || 1;
        const temporadaAno = config?.temporada_ano || new Date().getFullYear();
        const rotuloTemporada = `${temporadaNumero}/${temporadaAno}`;

        // Mesma regra do ranking normal: só entra na posição final quem
        // recebeu partida de verdade nessa temporada (consultamos antes de
        // apagar as partidas, mais abaixo).
        const { data: partidasTemporada, error: errPartidasTmp } = await supabase
          .from("partidas").select("atleta1_id,atleta2_id");
        if (errPartidasTmp) throw errPartidasTmp;
        const idsComPartida = new Set<string>();
        (partidasTemporada ?? []).forEach((m: any) => { idsComPartida.add(m.atleta1_id); idsComPartida.add(m.atleta2_id); });

        const rankingFinal = (ativos ?? [])
          .filter((a: any) => !a.pendente_circuito && idsComPartida.has(a.id))
          .sort((a: any, b: any) => (b.saldo_temp || 0) - (a.saldo_temp || 0));
        const posicaoFinal: Record<string, number> = {};
        rankingFinal.forEach((a: any, i: number) => { posicaoFinal[a.id] = i + 1; });

        for (const a of ativos ?? []) {
          const historicoAtualizado = posicaoFinal[a.id]
            ? [{ temporada: rotuloTemporada, pos: posicaoFinal[a.id] }, ...(a.historico || [])]
            : (a.historico || []);
          const { error } = await supabase.from("atletas").update({
            vitorias_total: (a.vitorias_total || 0) + (a.vitorias || 0),
            derrotas_total: (a.derrotas_total || 0) + (a.derrotas || 0),
            saldo_temp: 0, vitorias: 0, derrotas: 0, chave: null,
            historico: historicoAtualizado,
          }).eq("id", a.id);
          if (error) throw error;
        }

        await supabase.from("partidas").delete().neq("id", "__none__");
        await supabase.from("chaves").delete().neq("id", "__none__");

        const proximoNumero = temporadaNumero >= 3 ? 1 : temporadaNumero + 1;
        const proximoAno = temporadaNumero >= 3 ? temporadaAno + 1 : temporadaAno;
        const { error: errConfig } = await supabase.from("configuracao").update({
          fase: "inscricoes", temporada_numero: proximoNumero, temporada_ano: proximoAno,
        }).eq("id", 1);
        if (errConfig) throw errConfig;

        return jsonResponse({ sucesso: true, dados: { temporadaNumero: proximoNumero, temporadaAno: proximoAno } });
      }

      case "LISTAR_TELEFONES": {
        // Único jeito de obter telefone de mais de um atleta de uma vez —
        // exige PIN. Devolve {id, telefone} de todo mundo (qualquer status),
        // pro admin cruzar com a lista já carregada sem telefone.
        const { data, error } = await supabase.from("atletas").select("id, telefone");
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
