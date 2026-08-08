import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// athlete-action — ações do ATLETA (sem PIN), validadas no servidor.
// ============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ALLOWED_ORIGINS = [
  "https://clubedotenisdemesabh.com.br",
  "https://www.clubedotenisdemesabh.com.br",
  "https://clube-tenis-mesa.vercel.app",
];

const VERSAO_REGULAMENTO = "v03-11";

function scoreValido(n: unknown): boolean {
  return Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 99;
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

  const { acao, payload } = body || {};
  if (!acao) return jsonResponse({ sucesso: false, erro: "acao é obrigatória" }, 400);

  try {
    switch (acao) {

      case "INSCREVER": {
        const p = payload || {};
        const nome = String(p.nome || "").trim();
        const telefone = String(p.telefone || "").replace(/\D/g, "");
        if (!nome) return jsonResponse({ sucesso: false, erro: "Nome é obrigatório." }, 400);
        if (telefone.length < 10) return jsonResponse({ sucesso: false, erro: "Telefone inválido." }, 400);

        const federado = !!p.federado;
        let rating: number | null = 250;
        if (federado) {
          const r = Number(p.rating);
          rating = (Number.isFinite(r) && r > 0 && r <= 3000) ? Math.round(r) : null;
        }

        const dataAceite = p.dataAceite || new Date().toISOString();
        const linha = {
          nome,
          telefone,
          apelido: p.apelido ? String(p.apelido) : null,
          federado,
          rating,
          rating_inicial: rating,
          saldo_temp: 0,
          status: "pendente",
          aceite_regulamento: !!p.aceiteRegulamento,
          data_aceite_regulamento: p.aceiteRegulamento ? dataAceite : null,
          versao_regulamento: VERSAO_REGULAMENTO,
          aceite_lgpd: !!p.aceiteLGPD,
          data_aceite_lgpd: p.aceiteLGPD ? dataAceite : null,
          inscrito_em: dataAceite,
        };

        const { error } = await supabase.from("atletas").insert(linha);
        if (error) {
          const msg = String(error.message || "");
          if (msg.includes("atletas_telefone_unique") || msg.includes("duplicate key")) {
            return jsonResponse({ sucesso: false, erro: "telefone_duplicado" }, 409);
          }
          throw error;
        }
        return jsonResponse({ sucesso: true });
      }

      case "ENVIAR_PLACAR": {
        const { matchId, athleteId, score1, score2 } = payload || {};
        if (!matchId || !athleteId) return jsonResponse({ sucesso: false, erro: "matchId e athleteId são obrigatórios" }, 400);
        if (!scoreValido(score1) || !scoreValido(score2)) {
          return jsonResponse({ sucesso: false, erro: "Placar inválido." }, 400);
        }

        const { data: partida, error: errP } = await supabase
          .from("partidas").select("atleta1_id,atleta2_id,validado,rejeitado,wo_tipo,p1_placar1,p1_placar2,p2_placar1,p2_placar2").eq("id", matchId).single();
        if (errP) throw errP;
        if (!partida) return jsonResponse({ sucesso: false, erro: "Partida não encontrada." }, 404);
        if (partida.validado || partida.rejeitado) {
          return jsonResponse({ sucesso: false, erro: "Esta partida já foi encerrada." }, 409);
        }

        const now = new Date().toISOString();
        let upd: Record<string, unknown>;
        if (athleteId === partida.atleta1_id) {
          upd = { p1_placar1: score1, p1_placar2: score2, p1_enviado_em: now };
        } else if (athleteId === partida.atleta2_id) {
          upd = { p2_placar1: score1, p2_placar2: score2, p2_enviado_em: now };
        } else {
          return jsonResponse({ sucesso: false, erro: "Você não participa desta partida." }, 403);
        }

        const { error } = await supabase.from("partidas").update(upd).eq("id", matchId);
        if (error) throw error;

        try {
          const { data: cfg } = await supabase.from("configuracao").select("auto_validar_placar").eq("id", 1).single();
          if (cfg?.auto_validar_placar === true && !partida.wo_tipo) {
            const ehA = athleteId === partida.atleta1_id;
            const p1p1 = ehA ? score1 : partida.p1_placar1;
            const p1p2 = ehA ? score2 : partida.p1_placar2;
            const p2p1 = ehA ? partida.p2_placar1 : score1;
            const p2p2 = ehA ? partida.p2_placar2 : score2;
            const ambosEnviaram = p1p1 != null && p1p2 != null && p2p1 != null && p2p2 != null;
            const batem = p1p1 === p2p1 && p1p2 === p2p2;
            if (ambosEnviaram && batem) {
              const { error: errAuto } = await supabase.from("partidas").update({
                placar1: p1p1, placar2: p1p2,
                validado: true, validado_por_admin: false, validado_automatico: true,
                admin_aprovado_em: now, calculado: false,
              }).eq("id", matchId).eq("validado", false).eq("rejeitado", false);
              if (errAuto) throw errAuto;
              return jsonResponse({ sucesso: true, dados: { autoValidado: true } });
            }
          }
        } catch (eAuto) {
          console.warn("Auto-validação não aplicada:", (eAuto as any)?.message);
        }

        return jsonResponse({ sucesso: true });
      }

      case "ATUALIZAR_PERFIL": {
        const { athleteId, foto_url, estilo_jogo } = payload || {};
        if (!athleteId) return jsonResponse({ sucesso: false, erro: "athleteId é obrigatório" }, 400);
        const upd: Record<string, unknown> = {};
        if (typeof foto_url === "string") upd.foto_url = foto_url;
        if (typeof estilo_jogo === "string") upd.estilo_jogo = estilo_jogo;
        if (Object.keys(upd).length === 0) {
          return jsonResponse({ sucesso: false, erro: "Nada para atualizar." }, 400);
        }
        const { error } = await supabase.from("atletas").update(upd).eq("id", athleteId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "RENOVAR": {
        const { athleteId, quer } = payload || {};
        if (!athleteId) return jsonResponse({ sucesso: false, erro: "athleteId é obrigatório" }, 400);
        const { data: atleta, error: errA } = await supabase.from("atletas").select("status").eq("id", athleteId).single();
        if (errA) throw errA;
        if (!atleta) return jsonResponse({ sucesso: false, erro: "Atleta não encontrado." }, 404);
        if (atleta.status !== "ativo") return jsonResponse({ sucesso: false, erro: "Apenas atletas ativos podem renovar." }, 403);
        const querRenovar = quer === false ? false : true;
        const { error } = await supabase.from("atletas").update({
          quer_renovar: querRenovar,
          renovacao_em: querRenovar ? new Date().toISOString() : null,
        }).eq("id", athleteId);
        if (error) throw error;
        return jsonResponse({ sucesso: true, dados: { querRenovar } });
      }

      case "SOLICITAR_WO": {
        const p = payload || {};
        if (!p.id || !p.matchId || !p.athleteId) {
          return jsonResponse({ sucesso: false, erro: "id, matchId e athleteId são obrigatórios" }, 400);
        }
        const { data: partida, error: errP } = await supabase
          .from("partidas").select("atleta1_id,atleta2_id").eq("id", p.matchId).single();
        if (errP) throw errP;
        if (!partida) return jsonResponse({ sucesso: false, erro: "Partida não encontrada." }, 404);
        if (p.athleteId !== partida.atleta1_id && p.athleteId !== partida.atleta2_id) {
          return jsonResponse({ sucesso: false, erro: "Você não participa desta partida." }, 403);
        }

        const { error } = await supabase.from("solicitacoes_wo").insert({
          id: p.id,
          match_id: p.matchId,
          atleta_id: p.athleteId || null,
          atleta_nome: p.athleteName || null,
          adversario_id: p.adversarioId || null,
          adversario_nome: p.adversarioNome || null,
          round: p.round || null,
          justificativa: p.justificativa || null,
          comprovante_url: p.comprovanteUrl || null,
          status: "pendente",
          criado_em: p.criadoEm || new Date().toISOString(),
        });
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "CANCELAR_WO": {
        const { id } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        const { data: sol, error: errS } = await supabase
          .from("solicitacoes_wo").select("status").eq("id", id).single();
        if (errS) throw errS;
        if (!sol) return jsonResponse({ sucesso: false, erro: "Solicitação não encontrada." }, 404);
        if (sol.status !== "pendente") {
          return jsonResponse({ sucesso: false, erro: "Só é possível cancelar uma solicitação ainda pendente." }, 409);
        }
        const { error } = await supabase.from("solicitacoes_wo").delete().eq("id", id).eq("status", "pendente");
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "SOLICITAR_EXCLUSAO": {
        const { athleteId } = payload || {};
        if (!athleteId) return jsonResponse({ sucesso: false, erro: "athleteId é obrigatório" }, 400);
        const { error } = await supabase.from("atletas")
          .update({ exclusao_solicitada_em: new Date().toISOString() })
          .eq("id", athleteId).neq("status", "arquivado");
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      default:
        return jsonResponse({ sucesso: false, erro: `Ação desconhecida: ${acao}` }, 400);
    }
  } catch (e) {
    console.error(e);
    return jsonResponse({ sucesso: false, erro: (e as any).message || "Erro interno" }, 500);
  }
});
