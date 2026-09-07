// Bateria — Sistema B (pontos fixos), o sistema dos circuitos novos.
//
// Regulamento vB-01: vitória vale 2, derrota vale 1, e não existe rating.
// A regra que mais importa aqui é a que NÃO deve acontecer: um circuito B
// jamais pode escrever rating na tabela global `atletas` — se escrevesse,
// contaminaria o rating do atleta no circuito de BH.

import { montarMotor, comoAdmin, atleta, partida, circuito, ok, igual, secao, placar, BH } from "./ferramentas.mjs";

const CIRC_B = "11111111-1111-1111-1111-111111111111";

// Monta um circuito Sistema B com os atletas pedidos.
// No Modelo B a identidade fica em `atletas` e o que é da temporada em
// `circuito_atletas` — é assim que o motor lê circuito que não seja o BH.
async function circuitoB({ ids = ["A", "B"], partidas = [], sazonal = {} }) {
  const { banco, motor } = await montarMotor({
    circuitos: [circuito(BH), circuito(CIRC_B, { slug: "sp", sistema: "B", pareamento: "sorteio" })],
    atletas: ids.map((id) => atleta(id, { rating: 500, rating_pico: 500 })),
    circuito_atletas: ids.map((id) => ({
      id: "ca-" + id, circuito_id: CIRC_B, atleta_id: id,
      status: "ativo", pendente_circuito: false, chave: "chave1",
      saldo_temp: 0, vitorias: 0, derrotas: 0, vitorias_total: 0, derrotas_total: 0,
      wo_culposos_temporada: 0, pagamento_confirmado: true, isento: false,
      historico: [], posicao_historico: [],
      ...(sazonal[id] || {}),
    })),
    chaves: [{ id: "chave1", nome: "Chave A", rodada_atual: 1, circuito_id: CIRC_B }],
    partidas: partidas.map((p) => partida(p.id, { circuito_id: CIRC_B, ...p })),
  });
  return {
    banco, motor,
    processar: (round = 1) => comoAdmin(motor, "PROCESSAR_RODADA", { circuitoId: CIRC_B, round }),
    naTemporada: (id) => banco.acha("circuito_atletas", (x) => x.atleta_id === id && x.circuito_id === CIRC_B),
    identidade: (id) => banco.acha("atletas", (x) => x.id === id),
  };
}

secao("Pontuação do Sistema B");
{
  const c = await circuitoB({
    partidas: [{ id: "j1", rodada: 1, atleta1_id: "A", atleta2_id: "B", placar1: 3, placar2: 1, validado: true }],
  });
  await c.processar();
  igual(c.naTemporada("A").saldo_temp, 2, "vitória vale 2 pontos");
  igual(c.naTemporada("B").saldo_temp, 1, "derrota vale 1 ponto — quem joga pontua");
  igual(c.naTemporada("A").vitorias, 1, "vitória contada");
  igual(c.naTemporada("B").derrotas, 1, "derrota contada");
}

secao("O Sistema B não encosta no rating");
{
  const c = await circuitoB({
    partidas: [{ id: "j1", rodada: 1, atleta1_id: "A", atleta2_id: "B", placar1: 3, placar2: 1, validado: true }],
  });
  await c.processar();
  igual(c.identidade("A").rating, 500, "quem venceu num circuito de pontos NÃO ganha rating");
  igual(c.identidade("B").rating, 500, "quem perdeu num circuito de pontos NÃO perde rating");
  igual(c.identidade("A").rating_pico, 500, "e o pico de rating fica onde estava");
  igual(c.identidade("A").saldo_temp, 0,
    "o saldo do Sistema B fica na participação, não na identidade global do atleta");
}

secao("W.O. no Sistema B — não anula o jogo, vira pontos");
{
  // Justificado: quem faltou com motivo ainda leva o ponto de participação.
  const c = await circuitoB({
    partidas: [{ id: "j1", rodada: 1, atleta1_id: "A", atleta2_id: "B",
      wo_tipo: "justificado", wo_beneficiario_id: "A", wo_faltoso_id: "B" }],
  });
  await c.processar();
  igual(c.naTemporada("A").saldo_temp, 2, "quem compareceu leva os 2 pontos da vitória");
  igual(c.naTemporada("A").vitorias, 1, "e a vitória é contada");
  igual(c.naTemporada("B").saldo_temp, 1, "W.O. justificado preserva o ponto de participação");
  igual(c.naTemporada("B").derrotas, 1, "mas a derrota é contada");
}
{
  // Culposo: quem faltou sem motivo fica sem ponto nenhum.
  const c = await circuitoB({
    partidas: [{ id: "j1", rodada: 1, atleta1_id: "A", atleta2_id: "B",
      wo_tipo: "culposo", wo_beneficiario_id: "A", wo_faltoso_id: "B" }],
  });
  await c.processar();
  igual(c.naTemporada("A").saldo_temp, 2, "o adversário leva 2 mesmo sem jogar");
  igual(c.naTemporada("B").saldo_temp, 0, "quem faltou sem justificar fica com zero ponto");
  igual(c.identidade("B").rating, 500, "e continua sem tocar no rating — nada de -15 aqui");
}

secao("Bye — quem sobra numa rodada ímpar");
{
  // 3 atletas: A joga com B, C fica de fora. C leva 1 ponto de participação.
  const c = await circuitoB({
    ids: ["A", "B", "C"],
    partidas: [{ id: "j1", rodada: 1, atleta1_id: "A", atleta2_id: "B", placar1: 3, placar2: 1, validado: true }],
  });
  await c.processar();
  igual(c.naTemporada("C").saldo_temp, 1, "quem ficou de fora com número ímpar de atletas ganha 1 ponto");
  igual(c.naTemporada("A").saldo_temp, 2, "e quem jogou pontua normalmente");
}
{
  // 4 atletas, 2 jogos: ninguém sobra, ninguém ganha ponto de bye.
  const c = await circuitoB({
    ids: ["A", "B", "C", "D"],
    partidas: [
      { id: "j1", rodada: 1, atleta1_id: "A", atleta2_id: "B", placar1: 3, placar2: 1, validado: true },
      { id: "j2", rodada: 1, atleta1_id: "C", atleta2_id: "D", placar1: 3, placar2: 1, validado: true },
    ],
  });
  await c.processar();
  igual(c.naTemporada("D").saldo_temp, 1, "com número par todos jogaram: o perdedor tem só o ponto da derrota");
}
{
  // Processar de novo não pode dar bye duas vezes.
  const c = await circuitoB({
    ids: ["A", "B", "C"],
    partidas: [{ id: "j1", rodada: 1, atleta1_id: "A", atleta2_id: "B", placar1: 3, placar2: 1, validado: true }],
  });
  await c.processar();
  await c.processar();
  igual(c.naTemporada("C").saldo_temp, 1, "processar a mesma rodada duas vezes não dobra o ponto do bye");
  igual(c.naTemporada("A").saldo_temp, 2, "nem dobra os pontos de quem jogou");
}

process.exit(placar("Sistema B (pontos fixos)"));
