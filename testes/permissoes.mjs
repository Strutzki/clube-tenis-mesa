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
  // Estas passaram despercebidas na primeira versão da bateria: uma mutação do
  // Guardião Jurídico as concedeu ao organizador e as 13 asserções continuaram
  // verdes. São justamente as que devolvem telefone de atleta e o preço que a
  // plataforma cobra.
  // LISTAR_TELEFONES saiu desta lista em 27/09/2026 (item 0.6.2): sem ela, a tela
  // de inscrições do organizador ficava em "carregando…" para sempre. Ela passou a
  // ser dele, mas ESCOPADA por circuito — a proteção virou a seção seguinte.
  const soDoDono = [
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

secao("O telefone que o organizador vê é só o do circuito dele");
{
  // Item 0.6.2. Antes, LISTAR_TELEFONES fazia `select("id, telefone")` na tabela
  // `atletas` sem NENHUM filtro: devolvia o telefone de todos os atletas da
  // plataforma. Com a ação fora da allowlist isso ficava escondido atrás de um
  // 403; ao conceder a ação, o filtro passa a ser a única proteção que existe.
  const hash = await pinGuardado(PIN_ORG);
  const OUTRO_C = "55555555-5555-5555-5555-555555555555";
  const DE_FORA = "dddd0002-0000-4000-8000-000000000042";
  const { motor } = await montarMotor({
    circuitos: [BH, CIRC, OUTRO_C].map((id, i) =>
      i === 0 ? circuito(BH) : circuito(id, { slug: i === 1 ? "sp" : "rj", sistema: "B" })),
    atletas: [
      atleta(ORG, { nome: "Organizador", telefone: TEL, pin_hash: hash }),
      atleta(MEMBRO, { nome: "Atleta do circuito", telefone: "31911112222" }),
      atleta(DE_FORA, { nome: "Atleta de outro circuito", telefone: "21933334444" }),
    ],
    circuito_atletas: [
      { id: "ca-m", circuito_id: CIRC, atleta_id: MEMBRO, status: "ativo", pendente_circuito: false, saldo_temp: 0, vitorias: 0, derrotas: 0 },
      { id: "ca-f", circuito_id: OUTRO_C, atleta_id: DE_FORA, status: "ativo", pendente_circuito: false, saldo_temp: 0, vitorias: 0, derrotas: 0 },
    ],
    outras: { circuito_organizadores: [{ circuito_id: CIRC, atleta_id: ORG, papel: "organizador" }] },
  });

  const r = await comoOrganizador(motor, TEL, PIN_ORG, "LISTAR_TELEFONES", { circuitoId: CIRC });
  igual(r.status, 200, "o organizador consegue ler os telefones do circuito dele");
  const lidos = (r.corpo?.dados || []).map((t) => t.telefone);
  ok(lidos.includes("31911112222"), "e o telefone do atleta do circuito dele vem na lista");
  ok(!lidos.includes("21933334444"), "mas o telefone do atleta de OUTRO circuito não vem");
  ok(!lidos.includes(TEL) || lidos.length === 1, "e a lista não traz quem não é membro do circuito");
  igual(lidos.length, 1, "exatamente 1 telefone: só o membro do circuito dele");

  // MINIMIZAÇÃO DE COLUNA. O `select("id, telefone")` é a única coisa que impede
  // esta ação de devolver a linha inteira de `atletas` — que inclui o `pin_hash`
  // de cada atleta do circuito. Até 27/09/2026 trocar por `select("*")` deixava a
  // bateria VERDE, porque o banco falso não projetava colunas (apontado pelo
  // Guardião Jurídico). Agora o banco falso projeta, e isto confere as CHAVES.
  igual(Object.keys(r.corpo.dados[0]).sort(), ["id", "telefone"],
    "e a ação devolve SÓ id e telefone — nunca pin_hash, CPF ou o resto da linha");

  const fora = await comoOrganizador(motor, TEL, PIN_ORG, "LISTAR_TELEFONES", { circuitoId: OUTRO_C });
  igual(fora.status, 403, "e pedir os telefones de um circuito que não é dele continua 403");

  // Regra 2 do CLAUDE.md: o caminho do BH não muda. Lá o roster É a identidade
  // global, então o super-admin continua vendo todos os atletas.
  const noBh = await comoAdmin(motor, "LISTAR_TELEFONES", { circuitoId: BH });
  igual(noBh.status, 200, "no BH a leitura continua respondendo 200 para o super-admin");
  igual((noBh.corpo?.dados || []).length, 3, "e no BH ele continua vendo todos os atletas, como antes");
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
