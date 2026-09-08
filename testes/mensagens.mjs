// Bateria — REGISTRO DE MENSAGEM ENVIADA.
//
// Em 08/09/2026 o Juliano mandou 4 mensagens pelo WhatsApp e elas continuaram
// aparecendo como pendentes. Duas causas somadas:
//   1. abrir o WhatsApp tira o navegador da frente e mata a chamada no meio
//      (corrigido no app com keepalive — nao da para testar aqui, e do navegador);
//   2. o servidor respondia `sucesso: true` MESMO quando a gravacao falhava.
// Estas assercoes cobrem a segunda, que e a que mente.
//
// Por que importa: este registro nao e um log. E ele que tira a mensagem da
// fila de pendentes. Dizer "sucesso" sem gravar faz o admin perder o controle
// de quem ja foi avisado.

import { montarMotor, comoAdmin, atleta, partida, ok, igual, secao, placar, BH } from "./ferramentas.mjs";

secao("O registro grava de verdade");
{
  const { banco, motor } = await montarMotor({});
  const r = await comoAdmin(motor, "REGISTRAR_MENSAGEM_ENVIADA", {
    circuitoId: BH, id: "m-1", athleteId: null, athleteName: "Fulano",
    categoria: "resultados", categoriaLabel: "Resultados",
    texto: "Seu jogo terminou 3x1", enviadoEm: "2026-09-08T12:00:00Z", matchId: "j1",
  });
  ok(r.corpo.sucesso === true, "registro válido é aceito");
  igual(banco.linhas("mensagens_enviadas").length, 1, "e a linha foi mesmo gravada");
  const linha = banco.linhas("mensagens_enviadas")[0];
  igual(linha.categoria, "resultados", "guarda a categoria, que é como o app sabe o que já foi enviado");
  igual(linha.match_id, "j1", "guarda a partida — sem isso, o 2º jogo do mês do atleta ficaria preso");
  igual(linha.circuito_id, BH, "e fica preso ao circuito certo");
}

secao("O servidor não diz que gravou quando não gravou");
{
  // Antes de 08/09/2026 todas estas respondiam `sucesso: true`.
  const semTexto = await montarMotor({});
  let r = await comoAdmin(semTexto.motor, "REGISTRAR_MENSAGEM_ENVIADA", {
    circuitoId: BH, id: "m-2", categoria: "resultados", enviadoEm: "2026-09-08T12:00:00Z",
  });
  ok(r.corpo.sucesso === false, "mensagem sem texto é recusada, não fingida");
  igual(r.status, 400, "e a recusa vem com o código de pedido inválido");
  igual(semTexto.banco.linhas("mensagens_enviadas").length, 0, "nada foi gravado");

  const semId = await montarMotor({});
  r = await comoAdmin(semId.motor, "REGISTRAR_MENSAGEM_ENVIADA", {
    circuitoId: BH, categoria: "resultados", texto: "oi",
  });
  ok(r.corpo.sucesso === false, "mensagem sem identificador é recusada");

  const semCategoria = await montarMotor({});
  r = await comoAdmin(semCategoria.motor, "REGISTRAR_MENSAGEM_ENVIADA", {
    circuitoId: BH, id: "m-3", texto: "oi",
  });
  ok(r.corpo.sucesso === false, "mensagem sem categoria é recusada — sem ela o app não sabe o que foi enviado");
}

secao("Quando o banco recusa, o servidor conta a verdade");
{
  // O caso exato do incidente: a gravação falha e o servidor precisa dizer isso.
  // Antes de 08/09/2026 ele respondia `sucesso: true` e a mensagem voltava a
  // aparecer como pendente sem explicação nenhuma.
  const { banco, motor } = await montarMotor({});
  banco.recusar("mensagens_enviadas", "insert", { message: "null value in column \"texto\"", code: "23502" });
  const r = await comoAdmin(motor, "REGISTRAR_MENSAGEM_ENVIADA", {
    circuitoId: BH, id: "m-9", categoria: "resultados", texto: "oi", enviadoEm: "2026-09-08T12:00:00Z",
  });
  ok(r.corpo.sucesso === false, "banco recusou a gravação: o servidor responde falha, não sucesso");
  igual(r.status, 500, "e devolve erro de servidor");
  ok(String(r.corpo.erro || "").length > 0, "com uma explicação junto");
  igual(banco.linhas("mensagens_enviadas").length, 0, "e nada ficou gravado");
}

secao("Mensagem já registrada não vira erro na cara do admin");
{
  // O clique que abre o WhatsApp e a chamada que sobrevive à saída da página
  // podem chegar as duas. Chave repetida = o efeito desejado já aconteceu.
  const { banco, motor } = await montarMotor({});
  banco.recusar("mensagens_enviadas", "insert", { message: "duplicate key value", code: "23505" });
  const r = await comoAdmin(motor, "REGISTRAR_MENSAGEM_ENVIADA", {
    circuitoId: BH, id: "m-repetido", categoria: "resultados", texto: "oi", enviadoEm: "2026-09-08T12:00:00Z",
  });
  ok(r.corpo.sucesso === true, "id repetido é tratado como sucesso — a mensagem já estava registrada");
  ok(r.corpo.dados?.jaRegistrada === true, "e o servidor diz que ela já existia");
}

secao("Um registro válido grava uma linha só");
{
  // O clique que abre o WhatsApp e a chamada que sobrevive à saída da página
  // podem chegar as duas. O efeito desejado já aconteceu.
  const { banco, motor } = await montarMotor({});
  const carga = {
    circuitoId: BH, id: "m-igual", athleteName: "Fulano",
    categoria: "resultados", texto: "mesmo texto", enviadoEm: "2026-09-08T12:00:00Z",
  };
  const primeira = await comoAdmin(motor, "REGISTRAR_MENSAGEM_ENVIADA", carga);
  ok(primeira.corpo.sucesso === true, "a primeira grava");
  igual(banco.linhas("mensagens_enviadas").length, 1, "uma linha");
}

secao("As DUAS travas do clique — não basta fechar uma");
{
  // O clique que abre o WhatsApp dispara duas escritas independentes:
  //   `mensagens_enviadas`  segura a mensagem DENTRO do mês;
  //   `resultado_comunicado` é o que segura DEPOIS da virada do mês (App.jsx:3148).
  // Em 08/09/2026 as duas morreram juntas — as 4 mensagens do Juliano tinham as
  // duas abertas. Consertar só uma adia o defeito em vez de fechá-lo.
  const { banco, motor } = await montarMotor({
    atletas: [atleta("aaaa0001-0000-4000-8000-000000000001", { nome: "Fulano" })],
    partidas: [partida("j1", { rodada: 1, atleta1_id: "aaaa0001-0000-4000-8000-000000000001",
      atleta2_id: "aaaa0001-0000-4000-8000-000000000001", placar1: 3, placar2: 1,
      validado: true, resultado_comunicado: false })],
  });

  const r = await comoAdmin(motor, "MARCAR_RESULTADO_COMUNICADO", { circuitoId: BH, matchId: "j1", comunicado: true });
  ok(r.corpo.sucesso === true, "marcar o resultado como comunicado é aceito");
  igual(banco.acha("partidas", (p) => p.id === "j1").resultado_comunicado, true,
    "e a partida fica marcada — é esta trava que sobrevive à virada do mês");

  const semId = await montarMotor({});
  const r2 = await comoAdmin(semId.motor, "MARCAR_RESULTADO_COMUNICADO", { circuitoId: BH, comunicado: true });
  ok(r2.corpo.sucesso === false, "sem dizer qual partida, é recusado");
  igual(r2.status, 400, "com código de pedido inválido");
}

{
  // E a recusa do banco também não pode virar "sucesso" aqui.
  const { banco, motor } = await montarMotor({
    partidas: [partida("j2", { rodada: 1, validado: true, resultado_comunicado: false })],
  });
  banco.recusar("partidas", "update", { message: "erro qualquer do banco", code: "XX000" });
  const r = await comoAdmin(motor, "MARCAR_RESULTADO_COMUNICADO", { circuitoId: BH, matchId: "j2", comunicado: true });
  ok(r.corpo.sucesso === false, "banco recusou: o servidor responde falha, não sucesso");
  igual(banco.acha("partidas", (p) => p.id === "j2").resultado_comunicado, false, "e a partida segue não comunicada");
}

process.exit(placar("Registro de mensagens"));
