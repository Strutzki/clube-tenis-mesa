// Bateria — Sistema A (rating CBTM), o sistema do circuito de BH.
//
// Roda o `admin-action` DE VERDADE contra um banco em memória. Cada asserção
// abaixo confere um número que o regulamento v03-12 manda o app produzir.
// Se alguém mexer na tabela da CBTM ou no cálculo, isto fica vermelho.

import { montarMotor, comoAdmin, atleta, partida, circuito, ok, igual, secao, placar, BH } from "./ferramentas.mjs";

// Monta dois atletas, um jogo já validado, e processa a rodada.
// Devolve como os dois ficaram depois.
async function jogo({ ratingA, ratingB, vence, rodada = 1, extraPartida = {}, extraA = {}, extraB = {} }) {
  const a = atleta("A", { rating: ratingA, rating_inicial: ratingA, rating_pico: ratingA, ...extraA });
  const b = atleta("B", { rating: ratingB, rating_inicial: ratingB, rating_pico: ratingB, ...extraB });
  const { banco, motor } = await montarMotor({
    atletas: [a, b],
    partidas: [partida("j1", {
      rodada, atleta1_id: "A", atleta2_id: "B",
      placar1: vence === "A" ? 3 : 1, placar2: vence === "A" ? 1 : 3,
      validado: true, ...extraPartida,
    })],
  });
  const resposta = await comoAdmin(motor, "PROCESSAR_RODADA", { circuitoId: BH, round: rodada });
  return {
    resposta, banco,
    A: banco.acha("atletas", (x) => x.id === "A"),
    B: banco.acha("atletas", (x) => x.id === "B"),
    partida: banco.acha("partidas", (x) => x.id === "j1"),
  };
}

secao("Tabela da CBTM — favorito vence");
{
  // Diferença 20 (faixa até 24): vencedor +10, perdedor -8.
  const r = await jogo({ ratingA: 520, ratingB: 500, vence: "A" });
  igual(r.A.rating, 530, "favorito com 20 de vantagem vence: +10");
  igual(r.B.rating, 492, "azarão com 20 de desvantagem perde: -8");
  igual(r.A.saldo_temp, 10, "o saldo da temporada acompanha o ganho");
  igual(r.B.saldo_temp, -8, "o saldo da temporada acompanha a perda");
  igual(r.A.vitorias, 1, "vitória contada");
  igual(r.B.derrotas, 1, "derrota contada");
}
{
  // Fronteira da 1ª faixa: 24 ainda é +10; 25 já é a faixa seguinte, +9.
  const na = await jogo({ ratingA: 524, ratingB: 500, vence: "A" });
  igual(na.A.rating, 534, "diferença exata de 24 ainda é a primeira faixa (+10)");
  const fora = await jogo({ ratingA: 525, ratingB: 500, vence: "A" });
  igual(fora.A.rating, 534, "diferença de 25 cai para a segunda faixa (+9)");
  igual(fora.B.rating, 493, "e o perdedor perde 7, não 8");
}
{
  // Faixa mais alta do favorito: diferença acima de 749 rende +1, e o azarão não perde nada.
  const r = await jogo({ ratingA: 1300, ratingB: 500, vence: "A" });
  igual(r.A.rating, 1301, "favorito muito superior ganha só +1");
  igual(r.B.rating, 500, "e o perdedor muito inferior não perde ponto nenhum");
}

secao("Tabela da CBTM — azarão vence (zebra)");
{
  // Mesmo par de ratings, resultado invertido: a tabela do azarão é outra.
  const r = await jogo({ ratingA: 500, ratingB: 520, vence: "A" });
  igual(r.A.rating, 511, "azarão que vence por 20 de diferença ganha +11");
  igual(r.B.rating, 511, "e o favorito que perde cai 9");
  ok(r.A.rating === r.B.rating, "com esses números os dois se encontram em 511 — a zebra aproxima");
}
{
  const r = await jogo({ ratingA: 500, ratingB: 1300, vence: "A" });
  igual(r.A.rating, 530, "zebra grande rende +30 ao azarão");
  igual(r.B.rating, 1278, "e custa 22 ao favorito");
}

secao("Rating de pico e histórico");
{
  const r = await jogo({ ratingA: 520, ratingB: 500, vence: "A" });
  igual(r.A.rating_pico, 530, "o pico sobe junto quando o rating sobe");
  igual(r.B.rating_pico, 500, "o pico NÃO desce quando o rating desce");
  igual(r.A.rating_historico.length, 1, "o histórico ganha uma entrada por jogo");
  igual(r.A.rating_historico[0], { data: "2026-01-01T10:00:00Z", rating: 530 },
    "a entrada do histórico carrega a data da aprovação e o rating novo");
}
{
  // Quem já teve pico alto e caiu não perde o pico.
  const r = await jogo({ ratingA: 500, ratingB: 520, vence: "B", extraA: { rating_pico: 900 } });
  igual(r.A.rating_pico, 900, "pico antigo é preservado mesmo perdendo hoje");
}

secao("W.O. no Sistema A");
{
  // W.O. culposo: quem faltou sem justificar perde 15; quem esperou ganha 8.
  const { banco, motor } = await montarMotor({
    atletas: [atleta("A", { rating: 500 }), atleta("B", { rating: 500 })],
    partidas: [partida("j1", {
      rodada: 1, atleta1_id: "A", atleta2_id: "B",
      wo_tipo: "culposo", wo_beneficiario_id: "A", wo_faltoso_id: "B",
    })],
  });
  await comoAdmin(motor, "PROCESSAR_RODADA", { circuitoId: BH, round: 1 });
  const A = banco.acha("atletas", (x) => x.id === "A");
  const B = banco.acha("atletas", (x) => x.id === "B");
  igual(A.rating, 508, "quem compareceu ganha +8 (admin-action:805)");
  igual(A.saldo_temp, 8, "e o saldo da temporada sobe 8");
  igual(A.vitorias, 1, "conta como vitória para quem compareceu");
  igual(B.rating, 485, "quem faltou sem justificar perde 15 (admin-action:815)");
  igual(B.saldo_temp, -15, "e o saldo da temporada cai 15");
  igual(B.derrotas, 1, "conta como derrota para quem faltou");
}
{
  // W.O. "a favor": o beneficiário ganha, mas ninguém é punido no rating.
  const { banco, motor } = await montarMotor({
    atletas: [atleta("A", { rating: 500 }), atleta("B", { rating: 500 })],
    partidas: [partida("j1", {
      rodada: 1, atleta1_id: "A", atleta2_id: "B",
      wo_tipo: "a_favor", wo_beneficiario_id: "A", wo_faltoso_id: "B",
    })],
  });
  await comoAdmin(motor, "PROCESSAR_RODADA", { circuitoId: BH, round: 1 });
  igual(banco.acha("atletas", (x) => x.id === "A").rating, 508, "W.O. a favor rende +8 ao beneficiado");
  igual(banco.acha("atletas", (x) => x.id === "B").rating, 500,
    "no W.O. 'a favor' o outro NÃO perde rating — só o culposo perde");
}

secao("O que o motor se recusa a processar");
{
  // Placar enviado mas ainda não validado pelo admin não pode virar rating.
  const r = await jogo({ ratingA: 520, ratingB: 500, vence: "A", extraPartida: { validado: false } });
  igual(r.A.rating, 520, "placar não validado não mexe no rating");
  igual(r.resposta.corpo.dados?.processadas, 0, "e o motor responde que não processou nada");
}
{
  // Já calculado não entra de novo — senão reprocessar dobraria o rating de todos.
  const r = await jogo({ ratingA: 520, ratingB: 500, vence: "A", extraPartida: { calculado: true } });
  igual(r.A.rating, 520, "partida já calculada não é processada duas vezes");
}
{
  const r = await jogo({ ratingA: 520, ratingB: 500, vence: "A", extraPartida: { rejeitado: true } });
  igual(r.A.rating, 520, "partida anulada não vira rating");
}
{
  // Rodada par só processa se a ímpar anterior já estiver fechada.
  const { motor } = await montarMotor({
    atletas: [atleta("A"), atleta("B")],
    partidas: [
      partida("j1", { rodada: 1, atleta1_id: "A", atleta2_id: "B", placar1: 3, placar2: 1, validado: true }),
      partida("j2", { rodada: 2, atleta1_id: "A", atleta2_id: "B", placar1: 3, placar2: 1, validado: true }),
    ],
  });
  const r = await comoAdmin(motor, "PROCESSAR_RODADA", { circuitoId: BH, round: 2 });
  igual(r.status, 409, "processar a 2ª rodada com a 1ª em aberto é recusado");
  ok(String(r.corpo.erro).includes("rodada anterior"), "e a recusa explica que a rodada anterior está pendente");
}

secao("A partida guarda como o cálculo foi feito");
{
  const r = await jogo({ ratingA: 620, ratingB: 500, vence: "B" });
  igual(r.partida.favorito_id, "A", "a partida registra quem era o favorito");
  igual(r.partida.diferenca_rating_momento, 120, "e a diferença de rating no momento do jogo");
  ok(r.partida.calculado === true, "a partida fica marcada como calculada");
}

process.exit(placar("Sistema A (rating CBTM)"));
