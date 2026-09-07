// Bateria — ISOLAMENTO entre circuitos.
//
// É a bateria mais importante do projeto. O circuito de BH está em produção com
// atletas reais; qualquer circuito novo divide com ele o mesmo banco e as mesmas
// tabelas. A pergunta que estas asserções respondem é sempre a mesma:
// **operar um circuito mexeu em alguma coisa de outro?**
//
// O método é o mesmo que a governança do projeto usa à mão: fotografa o estado
// do BH antes, faz a operação no outro circuito, e exige que a foto seja idêntica.

import {
  montarMotor, comoAdmin, comoOrganizador, pinGuardado,
  atleta, partida, circuito, ok, igual, secao, placar, BH,
} from "./ferramentas.mjs";

const OUTRO = "22222222-2222-2222-2222-222222222222";

// Os ids de atleta são UUID porque o motor exige isso antes de excluir — ele
// valida o formato para fechar injeção de filtro (admin-action, EXCLUIR_ATLETA).
// Um id "bh1" seria recusado com 400 antes de qualquer regra ser testada.
const BH1 = "aaaa0001-0000-4000-8000-000000000001";
const BH2 = "aaaa0002-0000-4000-8000-000000000002";
const O1  = "bbbb0001-0000-4000-8000-000000000011";
const O2  = "bbbb0002-0000-4000-8000-000000000012";
const ORG = "cccc0001-0000-4000-8000-000000000021";

// Fotografia do que é do BH. Se mudar um byte, o teste acusa.
//
// A tabela `atletas` é global — guarda gente de todos os circuitos. Então a foto
// leva só quem participa do BH; o cadastro de um atleta de outro circuito pode
// mudar (o login dele zera o contador de tentativas, por exemplo) sem que isso
// signifique que o BH foi tocado.
function fotoDoBH(banco) {
  const doBH = new Set(banco.linhas("circuito_atletas")
    .filter((c) => c.circuito_id === BH).map((c) => String(c.atleta_id)));
  return JSON.stringify({
    atletas: banco.linhas("atletas").filter((a) => doBH.has(String(a.id))),
    configuracao: banco.linhas("configuracao"),
    partidasBH: banco.linhas("partidas").filter((p) => p.circuito_id === BH),
    chavesBH: banco.linhas("chaves").filter((c) => c.circuito_id === BH),
    participacoesBH: banco.linhas("circuito_atletas").filter((c) => c.circuito_id === BH),
  });
}

// Dois circuitos vivos ao mesmo tempo: o BH (Sistema A, produção) e um novo.
async function doisCircuitos({ sistemaDoOutro = "B", partidasExtras = [], organizador = null } = {}) {
  const atletasBH = [atleta(BH1, { nome: "BH um", rating: 600 }), atleta(BH2, { nome: "BH dois", rating: 550 })];
  const atletasOutro = [atleta(O1, { nome: "Outro um", rating: 500 }), atleta(O2, { nome: "Outro dois", rating: 500 })];
  const todos = [...atletasBH, ...atletasOutro];
  if (organizador) {
    todos.push(atleta(ORG, { nome: "Organizador", telefone: organizador.telefone, pin_hash: organizador.hash, status: "ativo" }));
  }

  const { banco, motor } = await montarMotor({
    circuitos: [circuito(BH), circuito(OUTRO, { slug: "outro", sistema: sistemaDoOutro, pareamento: "sorteio" })],
    atletas: todos,
    circuito_atletas: [
      ...atletasBH.map((a) => ({ id: "ca-" + a.id, circuito_id: BH, atleta_id: a.id, status: "ativo", pendente_circuito: false, saldo_temp: 0, vitorias: 0, derrotas: 0, wo_culposos_temporada: 0, pagamento_confirmado: true, historico: [], posicao_historico: [] })),
      ...atletasOutro.map((a) => ({ id: "ca-" + a.id, circuito_id: OUTRO, atleta_id: a.id, status: "ativo", pendente_circuito: false, chave: "chaveO", saldo_temp: 0, vitorias: 0, derrotas: 0, vitorias_total: 0, derrotas_total: 0, wo_culposos_temporada: 0, pagamento_confirmado: true, isento: false, historico: [], posicao_historico: [] })),
    ],
    chaves: [
      { id: "chave1", nome: "BH", rodada_atual: 1, circuito_id: BH },
      { id: "chaveO", nome: "Outro", rodada_atual: 1, circuito_id: OUTRO },
    ],
    partidas: [
      partida("bh-j1", { circuito_id: BH, chave_id: "chave1", rodada: 1, atleta1_id: BH1, atleta2_id: BH2, placar1: 3, placar2: 1, validado: true }),
      partida("o-j1", { circuito_id: OUTRO, chave_id: "chaveO", rodada: 1, atleta1_id: O1, atleta2_id: O2, placar1: 3, placar2: 1, validado: true }),
      ...partidasExtras,
    ],
    ...(organizador ? { outras: { circuito_organizadores: [{ circuito_id: OUTRO, atleta_id: ORG, papel: "organizador" }] } } : {}),
    funcoes: {
      // A virada de temporada chama esta função do banco. A de verdade arquiva
      // as partidas DE UM circuito; a de mentira faz o mesmo, para o teste poder
      // conferir que nenhuma partida do BH foi levada junto.
      arquivar_partidas_temporada_circuito: (bd, args) => {
        const alvo = String(args?.p_circuito_id ?? args?.circuito_id ?? "");
        const rotulo = args?.p_rotulo ?? args?.rotulo ?? null;
        const daqui = (bd.tabelas.partidas || []).filter((p) => String(p.circuito_id) === alvo);
        bd.tabelas.partidas_historico.push(...daqui.map((p) => ({ ...p, temporada_rotulo: rotulo })));
        return null;
      },
    },
  });
  return { banco, motor };
}

secao("Processar a rodada de um circuito não toca no outro");
{
  const { banco, motor } = await doisCircuitos();
  const antes = fotoDoBH(banco);
  const r = await comoAdmin(motor, "PROCESSAR_RODADA", { circuitoId: OUTRO, round: 1 });
  ok(r.corpo.sucesso === true, "a rodada do outro circuito foi processada");
  igual(fotoDoBH(banco), antes, "o BH ficou byte-idêntico depois de processar o outro circuito");
  const o1 = banco.acha("circuito_atletas", (x) => x.atleta_id === O1 && x.circuito_id === OUTRO);
  igual(o1.saldo_temp, 2, "e o outro circuito, esse sim, pontuou");
}

secao("Excluir atleta: no BH apaga a pessoa; nos outros, só a participação");
{
  const { banco, motor } = await doisCircuitos();
  const r = await comoAdmin(motor, "EXCLUIR_ATLETA", { circuitoId: OUTRO, id: O2 });
  ok(r.corpo.sucesso === false, "excluir atleta que já tem partida no circuito é recusado");
  igual(r.status, 409, "e o motor devolve conflito, pedindo para arquivar em vez de excluir");
}
{
  // Atleta sem partida no circuito novo: aí sim pode sair — mas só de lá.
  const { banco, motor } = await doisCircuitos();
  banco.tabelas.circuito_atletas.push({
    id: "ca-bh1-outro", circuito_id: OUTRO, atleta_id: BH1,
    status: "ativo", pendente_circuito: false, saldo_temp: 0, vitorias: 0, derrotas: 0,
  });
  const r = await comoAdmin(motor, "EXCLUIR_ATLETA", { circuitoId: OUTRO, id: BH1 });
  ok(r.corpo.sucesso === true, "atleta sem partida pode sair do circuito novo");
  igual(r.corpo.dados?.escopo, "circuito", "e o motor diz que o escopo foi só o circuito");
  ok(!!banco.acha("atletas", (x) => x.id === BH1),
    "a pessoa continua existindo — sair de um circuito não apaga a identidade");
  igual(banco.acha("atletas", (x) => x.id === BH1).rating, 600,
    "e o rating dela fica intacto");
  ok(!!banco.acha("circuito_atletas", (x) => x.atleta_id === BH1 && x.circuito_id === BH),
    "a participação dela no BH continua de pé");
}
{
  const { banco, motor } = await doisCircuitos();
  banco.tabelas.partidas = banco.tabelas.partidas.filter((p) => p.circuito_id !== BH);
  const r = await comoAdmin(motor, "EXCLUIR_ATLETA", { circuitoId: BH, id: BH1 });
  igual(r.corpo.dados?.escopo, "global", "no BH a exclusão continua sendo global (comportamento legado)");
  ok(!banco.acha("atletas", (x) => x.id === BH1), "e a pessoa some da tabela de atletas");
}

secao("Virada de temporada não arrasta as partidas do vizinho");
{
  const { banco, motor } = await doisCircuitos();
  const partidasBHAntes = banco.linhas("partidas").filter((p) => p.circuito_id === BH).length;
  ok(partidasBHAntes > 0, "o BH tem partida antes da virada do outro circuito");
  await comoAdmin(motor, "PROCESSAR_RODADA", { circuitoId: OUTRO, round: 1 });
  await comoAdmin(motor, "NOVA_TEMPORADA", { circuitoId: OUTRO, rotulo: "2026/2" });
  const partidasBHDepois = banco.linhas("partidas").filter((p) => p.circuito_id === BH);
  igual(partidasBHDepois.length, partidasBHAntes, "as partidas do BH continuam lá depois da virada do outro");
  const arquivadas = banco.linhas("partidas_historico");
  igual(arquivadas.filter((p) => p.circuito_id === BH).length, 0,
    "e nenhuma partida do BH foi parar no arquivo do outro circuito");
  const chamadaGlobal = banco.funcoesChamadas.find((f) => f.nome === "arquivar_partidas_temporada");
  ok(!chamadaGlobal, "a virada não chama a função de arquivar global (a que apagaria tudo)");
}

secao("Organizador só age no circuito dele");
{
  const hash = await pinGuardado("9876");
  const { banco, motor } = await doisCircuitos({ organizador: { telefone: "31999990000", hash } });
  const antes = fotoDoBH(banco);

  const noDele = await comoOrganizador(motor, "31999990000", "9876", "PROCESSAR_RODADA", { circuitoId: OUTRO, round: 1 });
  ok(noDele.corpo.sucesso === true, "o organizador processa a rodada do circuito dele");

  const noAlheio = await comoOrganizador(motor, "31999990000", "9876", "PROCESSAR_RODADA", { circuitoId: BH, round: 1 });
  igual(noAlheio.status, 403, "e é barrado ao tentar a mesma ação no BH");
  ok(String(noAlheio.corpo.erro).includes("não organiza"), "com a recusa dizendo que ele não organiza aquele circuito");
  igual(fotoDoBH(banco), antes, "o BH segue byte-idêntico depois da tentativa barrada");
}
{
  const hash = await pinGuardado("9876");
  const { motor } = await doisCircuitos({ organizador: { telefone: "31999990000", hash } });
  const r = await comoOrganizador(motor, "31999990000", "9876", "CRIAR_CIRCUITO", { nome: "Invadido", slug: "invadido" });
  igual(r.status, 403, "organizador não cria circuito — isso é do super-admin");
}
{
  const hash = await pinGuardado("9876");
  const { motor } = await doisCircuitos({ organizador: { telefone: "31999990000", hash } });
  const r = await comoOrganizador(motor, "31999990000", "pin-errado", "PROCESSAR_RODADA", { circuitoId: OUTRO, round: 1 });
  igual(r.status, 401, "PIN errado de organizador não entra");
}

secao("O PIN do super-admin tem freio");
{
  const { banco, motor } = await doisCircuitos();
  for (let i = 0; i < 5; i++) await motor.chamar({ pin: "errado", acao: "DEFINIR_AUTO_VALIDAR", payload: { ligado: true } });
  const r = await motor.chamar({ pin: "errado", acao: "DEFINIR_AUTO_VALIDAR", payload: { ligado: true } });
  ok(String(r.corpo.erro).includes("Muitas tentativas"), "depois de 5 erros o motor trava novas tentativas");
  igual(r.status, 401, "e responde não-autorizado");
}

process.exit(placar("Isolamento entre circuitos"));
