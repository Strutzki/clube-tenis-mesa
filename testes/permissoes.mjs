// Bateria — O QUE UM ORGANIZADOR PODE FAZER.
//
// Em 07/09/2026 o Juliano decidiu, acao a acao, o que o organizador de um
// circuito NAO deve poder fazer. A decisao entrou no repositorio e ficou meses
// sem ir ao ar — descoberto pelo Supervisor de Seguranca em 08/09.
//
// Hoje isso e inofensivo porque nao existe organizador cadastrado. Vira falha de
// autorizacao no minuto em que existir o primeiro. Estas assercoes existem para
// que a decisao nao dependa de alguem lembrar: se a lista voltar a conceder,
// a bateria fica vermelha.
//
// IMPORTANTE: elas testam o arquivo do repositorio. Enquanto o codigo NO AR
// conceder mais do que isto, publicar continua sendo o que fecha o buraco —
// o teste verde aqui nao prova producao. Ver docs/ROADMAP.md, item 0.5.1.

import {
  montarMotor, comoOrganizador, comoAdmin, pinGuardado,
  atleta, circuito, ok, igual, secao, placar, BH,
} from "./ferramentas.mjs";

const CIRC = "33333333-3333-3333-3333-333333333333";
const ORG = "cccc0002-0000-4000-8000-000000000031";
const MEMBRO = "dddd0001-0000-4000-8000-000000000041";
const TEL = "31988887777";
const PIN_ORG = "4321";

// Um circuito com um organizador de verdade, autenticado por telefone e PIN.
async function comOrganizador(extra = {}) {
  const hash = await pinGuardado(PIN_ORG);
  return montarMotor({
    circuitos: [circuito(BH), circuito(CIRC, { slug: "sp", sistema: "B", ...(extra.circuito || {}) })],
    atletas: [
      atleta(ORG, { nome: "Organizador", telefone: TEL, pin_hash: hash }),
      atleta(MEMBRO, { nome: "Atleta do circuito" }),
    ],
    circuito_atletas: [{
      id: "ca-membro", circuito_id: CIRC, atleta_id: MEMBRO,
      status: "ativo", pendente_circuito: false, saldo_temp: 0, vitorias: 0, derrotas: 0,
    }],
    outras: { circuito_organizadores: [{ circuito_id: CIRC, atleta_id: ORG, papel: "organizador" }] },
  });
}

secao("O que o Juliano tirou do organizador em 07/09/2026");
{
  const proibidas = [
    ["EXCLUIR_ATLETA", { id: MEMBRO }, "apagar um atleta"],
    ["ABRIR_PROXIMA_TEMPORADA", { rotulo: "2027/1" }, "abrir a próxima temporada"],
    ["CANCELAR_PROXIMA", {}, "cancelar a temporada aberta"],
    ["DEFINIR_RODADAS", { rodadas: 8 }, "mudar o número de rodadas"],
  ];
  for (const [acao, carga, oQueFaz] of proibidas) {
    const { motor } = await comOrganizador();
    const r = await comoOrganizador(motor, TEL, PIN_ORG, acao, { circuitoId: CIRC, ...carga });
    ok(r.status === 403, `organizador é barrado ao tentar ${oQueFaz} (${acao})`);
  }
}

secao("Dinheiro só com o portão ligado pelo super-admin");
{
  // `org_ve_financeiro` nasce DESLIGADO. Sem ele, nenhuma ação de dinheiro passa.
  const financeiras = [
    ["DEFINIR_FINANCEIRO", { ativo: true, valor: 100 }, "definir os valores"],
    ["REGISTRAR_PAGAMENTO", { atletaId: MEMBRO, valor: 100 }, "registrar um pagamento"],
    ["ESTORNAR_PAGAMENTO", { id: "p1" }, "estornar um pagamento"],
    ["EDITAR_PAGAMENTO", { id: "p1", valor: 50 }, "editar um pagamento"],
    ["LISTAR_PAGAMENTOS", {}, "ver a lista de pagamentos"],
  ];
  for (const [acao, carga, oQueFaz] of financeiras) {
    const { motor } = await comOrganizador({ circuito: { org_ve_financeiro: false } });
    const r = await comoOrganizador(motor, TEL, PIN_ORG, acao, { circuitoId: CIRC, ...carga });
    ok(r.status === 403, `com o portão desligado, o organizador não consegue ${oQueFaz}`);
  }
}

secao("O que o organizador continua podendo — a operação do circuito dele");
{
  const { motor } = await comOrganizador();
  const r = await comoOrganizador(motor, TEL, PIN_ORG, "LISTAR_MENSAGENS", { circuitoId: CIRC });
  ok(r.status !== 403, "listar mensagens do circuito dele continua liberado");

  const { motor: m2 } = await comOrganizador();
  const r2 = await comoOrganizador(m2, TEL, PIN_ORG, "DEFINIR_PUBLICO", { circuitoId: CIRC, publico: false });
  ok(r2.status !== 403, "deixar o circuito dele privado continua liberado");
}

secao("E nada disso vale fora do circuito dele");
{
  const { motor } = await comOrganizador();
  const r = await comoOrganizador(motor, TEL, PIN_ORG, "LISTAR_MENSAGENS", { circuitoId: BH });
  igual(r.status, 403, "no BH ele é barrado, mesmo numa ação que pode fazer no circuito dele");
}

secao("O organizador não alcança o que é só do dono da plataforma");
{
  // Estas quatro passaram despercebidas na primeira versão da bateria: uma
  // mutação do Guardião Jurídico concedeu as quatro ao organizador e as 13
  // asserções continuaram verdes. São justamente as que devolvem telefone de
  // atleta e o preço que a plataforma cobra.
  const soDoDono = [
    ["LISTAR_TELEFONES", {}, "ler o telefone dos atletas"],
    ["LISTAR_ORGANIZADORES", {}, "listar organizadores (devolve nome e telefone)"],
    ["LER_COBRANCA_PLATAFORMA", {}, "ver quanto a plataforma cobra"],
    ["DEFINIR_COBRANCA_PLATAFORMA", { ativa: true }, "mudar quanto a plataforma cobra"],
    ["DEFINIR_ORG_VE_FINANCEIRO", { ver: true }, "ligar o próprio portão do financeiro"],
  ];
  for (const [acao, carga, oQueFaz] of soDoDono) {
    const { motor } = await comOrganizador();
    const r = await comoOrganizador(motor, TEL, PIN_ORG, acao, { circuitoId: CIRC, ...carga });
    igual(r.status, 403, `organizador é barrado ao tentar ${oQueFaz}`);
  }
}

secao("Com o portão ligado, o financeiro passa");
{
  // O par que faltava: sem isto, inverter a condição do portão deixaria o
  // organizador que PAGOU pelo módulo barrado, e a bateria não veria.
  const { motor } = await comOrganizador({ circuito: { org_ve_financeiro: true } });
  const r = await comoOrganizador(motor, TEL, PIN_ORG, "LISTAR_PAGAMENTOS", { circuitoId: CIRC });
  ok(r.status !== 403, "com o portão ligado, o organizador vê os pagamentos do circuito dele");
}

secao("O portão é lido do circuito certo");
{
  // Dois circuitos: o portão ligado num, desligado no outro. O organizador do
  // circuito de portão DESLIGADO continua barrado — mesmo existindo um circuito
  // com o portão aberto no banco. Sem esta asserção, tirar o escopo da consulta
  // do portão passa despercebido.
  const hash = await pinGuardado(PIN_ORG);
  const OUTRO = "44444444-4444-4444-4444-444444444444";
  const { motor } = await montarMotor({
    circuitos: [
      circuito(BH),
      circuito(CIRC, { slug: "sp", sistema: "B", org_ve_financeiro: false }),
      circuito(OUTRO, { slug: "rj", sistema: "B", org_ve_financeiro: true }),
    ],
    atletas: [atleta(ORG, { nome: "Organizador", telefone: TEL, pin_hash: hash })],
    outras: { circuito_organizadores: [
      { circuito_id: CIRC, atleta_id: ORG, papel: "organizador" },
      { circuito_id: OUTRO, atleta_id: ORG, papel: "organizador" },
    ] },
  });
  const fechado = await comoOrganizador(motor, TEL, PIN_ORG, "LISTAR_PAGAMENTOS", { circuitoId: CIRC });
  igual(fechado.status, 403, "no circuito de portão fechado ele é barrado, mesmo organizando outro com o portão aberto");
  const aberto = await comoOrganizador(motor, TEL, PIN_ORG, "LISTAR_PAGAMENTOS", { circuitoId: OUTRO });
  ok(aberto.status !== 403, "e no circuito de portão aberto ele passa");
}

secao("O super-admin continua podendo tudo");
{
  const { motor } = await comOrganizador();
  const r = await comoAdmin(motor, "LISTAR_PAGAMENTOS", { circuitoId: CIRC });
  ok(r.status !== 403, "o super-admin não é barrado pelo portão do financeiro");

  // As quatro que saíram do organizador continuam sendo dele.
  for (const [acao, carga, oQueFaz] of [
    ["EXCLUIR_ATLETA", { id: MEMBRO }, "apagar atleta"],
    ["ABRIR_PROXIMA_TEMPORADA", { rotulo: "2027/1", nome: "2027/1" }, "abrir a próxima temporada"],
    ["CANCELAR_PROXIMA", {}, "cancelar a próxima"],
    ["DEFINIR_ORG_VE_FINANCEIRO", { ver: true }, "ligar o portão do financeiro"],
  ]) {
    const { motor: m } = await comOrganizador();
    const rr = await comoAdmin(m, acao, { circuitoId: CIRC, ...carga });
    ok(rr.status !== 403, `o super-admin continua podendo ${oQueFaz}`);
  }
}

process.exit(placar("Permissões do organizador"));
