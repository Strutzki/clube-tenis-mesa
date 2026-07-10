import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PIN = Deno.env.get("ADMIN_PIN")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const JANELA_MINUTOS = 15;
const MAX_TENTATIVAS = 5;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Tabela CBTM (Cap. 05 do regulamento) ────────────────────────────────────
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

// ── PIN + rate limit ─────────────────────────────────────────────────────────
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

        const rankingAtual = Object.values(athletesMap)
          .filter((a: any) => a.status === "ativo" && !a.pendente_circuito)
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

      default:
        return jsonResponse({ sucesso: false, erro: `Ação desconhecida: ${acao}` }, 400);
    }
  } catch (e) {
    console.error(e);
    return jsonResponse({ sucesso: false, erro: e.message || "Erro interno" }, 500);
  }
});
