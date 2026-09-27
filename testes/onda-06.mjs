// Bateria — ONDA 0.6: O ORGANIZADOR CONSEGUE TRABALHAR.
//
// Em 08/09/2026 a rodada completa dos guardiões deu NO-GO para nomear o primeiro
// organizador. Parte do motivo não era risco: era que ele simplesmente não
// conseguia operar o circuito dele. Quatro coisas, todas confirmadas no código
// antes de qualquer conserto (regra 6 do CLAUDE.md):
//
//   0.6.2  LISTAR_TELEFONES devolvia o telefone de TODOS os atletas da
//          plataforma, sem filtro — e por isso estava fora da allowlist. Com ela
//          fora, a tela de inscrições ficava em "carregando…" para sempre.
//          (as asserções do escopo vivem em permissoes.mjs, junto da allowlist)
//   0.6.3  Arquivar era porta de mão única: o botão "Reativar" chamava
//          EDITAR_ATLETA, que o organizador não tem.
//   0.6.4  Abrir a prova de um W.O. exigia o PIN do super-admin — ele decidia
//          W.O. sem ver o comprovante. (asserções no fim deste arquivo)
//   0.6.11 FICOU FORA desta fatia. O motor continua sem a ação e o botão do app
//          segue caindo em "Ação desconhecida" — o defeito original, intocado.
//          Motivo: o Guardião do Regulamento mostrou que a janela dos 7 dias está
//          INVERTIDA em relação ao Cap. 13 (a prioridade vai de início−7 até
//          início; as vagas abrem DEPOIS disso, não antes), e a própria tela se
//          contradiz. Implementar antes de decidir isso seria carimbar a regra
//          errada em cima de vaga vendida. Fica na Onda 0.6, aberto.
//   0.6.13 LER_COBRANCA_PLATAFORMA não recusava o BH, ao contrário da irmã.
//
// Nada disto é urgente enquanto o número de organizadores for zero. Vira falha
// real no minuto em que deixar de ser — e é para isso que estas asserções ficam.

import {
  montarMotor, comoOrganizador, comoAdmin, pinGuardado,
  atleta, circuito, ok, igual, secao, placar, BH, PIN,
} from "./ferramentas.mjs";

const CIRC = "66666666-6666-6666-6666-666666666666";
const OUTRO = "77777777-7777-7777-7777-777777777777";
const ORG = "eeee0001-0000-4000-8000-000000000051";
const ARQ = "eeee0002-0000-4000-8000-000000000052";
const ATIVO = "eeee0003-0000-4000-8000-000000000053";
const DE_FORA = "eeee0004-0000-4000-8000-000000000054";
const TEL = "31977776666";
const PIN_ORG = "8765";

function membro(id, atletaId, circuitoId, campos = {}) {
  return {
    id, circuito_id: circuitoId, atleta_id: atletaId,
    status: "ativo", pendente_circuito: false, saldo_temp: 0,
    vitorias: 0, derrotas: 0, vitorias_total: 0, derrotas_total: 0,
    quer_renovar: false, pagamento_proxima_confirmado: false,
    historico: [], posicao_historico: [],
    ...campos,
  };
}

// Cenário base: um circuito com organizador de verdade, um atleta arquivado e
// um ativo; e um SEGUNDO circuito, para provar que o escopo não vaza.
async function cenario(campos = {}) {
  const hash = await pinGuardado(PIN_ORG);
  return montarMotor({
    circuitos: [
      circuito(BH),
      circuito(CIRC, { slug: "sp", sistema: "B", ...campos }),
      circuito(OUTRO, { slug: "rj", sistema: "B" }),
    ],
    atletas: [
      atleta(ORG, { nome: "Organizador", telefone: TEL, pin_hash: hash }),
      atleta(ARQ, { nome: "Arquivado", status: "arquivado" }),
      atleta(ATIVO, { nome: "Ativo" }),
      atleta(DE_FORA, { nome: "De outro circuito" }),
    ],
    circuito_atletas: [
      membro("ca-arq", ARQ, CIRC, { status: "arquivado", pendente_circuito: false }),
      membro("ca-ativo", ATIVO, CIRC),
      membro("ca-fora", DE_FORA, OUTRO, { status: "arquivado" }),
    ],
    outras: { circuito_organizadores: [{ circuito_id: CIRC, atleta_id: ORG, papel: "organizador" }] },
  });
}

// ── 0.6.3 — desarquivar ──────────────────────────────────────────────────────
secao("Arquivar deixou de ser porta de mão única");
{
  const { motor, banco } = await cenario();
  const r = await comoOrganizador(motor, TEL, PIN_ORG, "DESARQUIVAR_ATLETA", { circuitoId: CIRC, id: ARQ });
  igual(r.status, 200, "o organizador consegue desarquivar um atleta do circuito dele");
  const linha = banco.acha("circuito_atletas", (l) => l.atleta_id === ARQ);
  // O backlog deste app é o PAR status "ativo" + pendente_circuito true. Não
  // existe status "ativo_backlog" no banco: é rótulo do <select> da tela, e a
  // primeira versão desta fatia gravava a string crua. A asserção antiga
  // exigia justamente a string errada — ela carimbava o defeito em vez de
  // proteger a regra. Pego pelos guardiões em 27/09/2026.
  igual(linha.status, "ativo", "o atleta volta como ATIVO (o status que o resto do app entende)");
  igual(linha.pendente_circuito, true, "e aguardando vaga — que é o par que forma o backlog");
}
{
  // Sem esta asserção, desarquivar viraria um jeito silencioso de reativar
  // qualquer atleta — inclusive um que nunca foi arquivado.
  const { motor } = await cenario();
  const r = await comoOrganizador(motor, TEL, PIN_ORG, "DESARQUIVAR_ATLETA", { circuitoId: CIRC, id: ATIVO });
  igual(r.status, 409, "desarquivar quem não está arquivado é recusado");
}
{
  const { motor } = await cenario();
  const r = await comoOrganizador(motor, TEL, PIN_ORG, "DESARQUIVAR_ATLETA", { circuitoId: CIRC, id: DE_FORA });
  igual(r.status, 403, "e ele não desarquiva atleta de outro circuito");
}
{
  const { motor } = await cenario();
  const r = await comoOrganizador(motor, TEL, PIN_ORG, "DESARQUIVAR_ATLETA", { circuitoId: CIRC });
  igual(r.status, 400, "sem o id do atleta, a ação recusa em vez de adivinhar");
}

secao("E o desarquivado volta a JOGAR — a prova que faltava");
{
  // Esta é a asserção que nenhuma das antigas fazia, e por isso o defeito do
  // status passou verde: conferir o valor gravado prova o que o motor quis
  // gravar, não que o resto do sistema sabe ler. Aqui o teste vai até o fim:
  // desarquiva, vira a etapa, e exige que o atleta tenha CHAVE e PARTIDAS.
  const hash = await pinGuardado(PIN_ORG);
  const ativos = [];
  const membros = [];
  for (let n = 0; n < 8; n++) {
    const id = `ffff000${n}-0000-4000-8000-00000000006${n}`;
    ativos.push(atleta(id, { nome: `Ativo ${n}` }));
    membros.push(membro(`ca-a${n}`, id, CIRC));
  }
  const { motor, banco } = await montarMotor({
    circuitos: [circuito(BH), circuito(CIRC, { slug: "sp", sistema: "B", fase: "inscricoes" })],
    atletas: [atleta(ORG, { nome: "Organizador", telefone: TEL, pin_hash: hash }),
              atleta(ARQ, { nome: "Arquivado", status: "arquivado" }), ...ativos],
    circuito_atletas: [membro("ca-arq", ARQ, CIRC, { status: "arquivado", pendente_circuito: false }), ...membros],
    outras: { circuito_organizadores: [{ circuito_id: CIRC, atleta_id: ORG, papel: "organizador" }] },
  });

  const semEle = await comoAdmin(motor, "INICIAR_ETAPA", { circuitoId: CIRC });
  igual(semEle.corpo?.dados?.atletas, 8, "antes de desarquivar, a etapa começa com os 8 ativos");

  const { motor: m2, banco: b2 } = await montarMotor({
    circuitos: [circuito(BH), circuito(CIRC, { slug: "sp", sistema: "B", fase: "inscricoes" })],
    atletas: [atleta(ORG, { nome: "Organizador", telefone: TEL, pin_hash: hash }),
              atleta(ARQ, { nome: "Arquivado", status: "arquivado" }), ...ativos],
    circuito_atletas: [membro("ca-arq", ARQ, CIRC, { status: "arquivado", pendente_circuito: false }), ...membros],
    outras: { circuito_organizadores: [{ circuito_id: CIRC, atleta_id: ORG, papel: "organizador" }] },
  });
  const des = await comoOrganizador(m2, TEL, PIN_ORG, "DESARQUIVAR_ATLETA", { circuitoId: CIRC, id: ARQ });
  igual(des.status, 200, "desarquiva");
  const comEle = await comoAdmin(m2, "INICIAR_ETAPA", { circuitoId: CIRC });
  igual(comEle.corpo?.dados?.atletas, 9, "depois de desarquivar, a etapa começa com 9 — ele FOI promovido do backlog");
  const dele = b2.acha("circuito_atletas", (l) => l.atleta_id === ARQ);
  ok(!!dele.chave, "ele recebeu chave");
  igual(dele.pendente_circuito, false, "e deixou de estar aguardando vaga");
  const jogos = b2.linhas("partidas").filter((m) => m.atleta1_id === ARQ || m.atleta2_id === ARQ);
  ok(jogos.length > 0, `e foi pareado de verdade (${jogos.length} partida(s))`);
}

secao("Desarquivar não desfaz um pedido de exclusão de dados");
{
  // LGPD. Arquivar NÃO limpa `exclusao_solicitada_em`, e a fila de pedidos do
  // admin ignora quem está arquivado — então o pedido fica invisível e o
  // organizador reativaria sem ver que a pessoa pediu para sair.
  const hash = await pinGuardado(PIN_ORG);
  const PEDIU = "ffff00a0-0000-4000-8000-0000000000a0";
  const { motor, banco } = await montarMotor({
    circuitos: [circuito(BH), circuito(CIRC, { slug: "sp", sistema: "B" })],
    atletas: [atleta(ORG, { nome: "Organizador", telefone: TEL, pin_hash: hash }),
              atleta(PEDIU, { nome: "Pediu exclusão", status: "arquivado", exclusao_solicitada_em: "2026-09-01T10:00:00Z" })],
    circuito_atletas: [membro("ca-p", PEDIU, CIRC, { status: "arquivado", pendente_circuito: false })],
    outras: { circuito_organizadores: [{ circuito_id: CIRC, atleta_id: ORG, papel: "organizador" }] },
  });
  const r = await comoOrganizador(motor, TEL, PIN_ORG, "DESARQUIVAR_ATLETA", { circuitoId: CIRC, id: PEDIU });
  igual(r.status, 409, "quem pediu a exclusão dos dados não é reativado");
  igual(banco.acha("circuito_atletas", (l) => l.atleta_id === PEDIU).status, "arquivado",
    "e ele continua arquivado — nada foi gravado");
}
{
  // O estado exato em que `anonimizar-atleta` deixa o registro: status
  // "arquivado" e telefone "removido:<id>". É o FIM de uma exclusão concluída;
  // reativar traria de volta um registro morto ("Atleta removido").
  const hash = await pinGuardado(PIN_ORG);
  const MORTO = "ffff00b0-0000-4000-8000-0000000000b0";
  const { motor } = await montarMotor({
    circuitos: [circuito(BH), circuito(CIRC, { slug: "sp", sistema: "B" })],
    atletas: [atleta(ORG, { nome: "Organizador", telefone: TEL, pin_hash: hash }),
              atleta(MORTO, { nome: "Atleta removido", status: "arquivado", telefone: "removido:" + MORTO, exclusao_solicitada_em: null })],
    circuito_atletas: [membro("ca-m", MORTO, CIRC, { status: "arquivado", pendente_circuito: false })],
    outras: { circuito_organizadores: [{ circuito_id: CIRC, atleta_id: ORG, papel: "organizador" }] },
  });
  const r = await comoOrganizador(motor, TEL, PIN_ORG, "DESARQUIVAR_ATLETA", { circuitoId: CIRC, id: MORTO });
  igual(r.status, 409, "e um cadastro já anonimizado não volta à vida");
}

secao("No BH, desarquivar escreve no caminho legado sem estragar nada");
{
  // Regra 2 do CLAUDE.md. No BH o roster É a identidade global: writeAtleta
  // grava em `atletas`. O BH não tem organizador, então só o super-admin chega
  // aqui — mas o caminho precisa funcionar e precisa ter asserção, porque foi
  // exatamente onde o status errado fazia o atleta perder o login.
  const ARQ_BH = "ffff00c0-0000-4000-8000-0000000000c0";
  const { motor, banco } = await montarMotor({
    atletas: [atleta(ARQ_BH, { nome: "Arquivado do BH", status: "arquivado" })],
  });
  const r = await comoAdmin(motor, "DESARQUIVAR_ATLETA", { circuitoId: BH, id: ARQ_BH });
  igual(r.status, 200, "o super-admin desarquiva no BH");
  const g = banco.acha("atletas", (l) => l.id === ARQ_BH);
  igual(g.status, "ativo", "e a tabela GLOBAL recebe 'ativo' — o único valor que o login-atleta aceita");
  igual(g.pendente_circuito, true, "aguardando vaga");
}

// ── 0.6.13 — coerência da leitura da cobrança ────────────────────────────────
secao("Ler quanto a plataforma cobra também recusa o BH");
{
  const { motor } = await cenario();
  const r = await comoAdmin(motor, "LER_COBRANCA_PLATAFORMA", { circuitoId: BH });
  igual(r.status, 400, "o BH é circuito próprio: ler a cobrança da plataforma nele é recusado");
  const noOutro = await comoAdmin(motor, "LER_COBRANCA_PLATAFORMA", { circuitoId: CIRC });
  igual(noOutro.status, 200, "e num circuito vendido a leitura continua respondendo");
}

// ── 0.6.4 — o comprovante do W.O. ────────────────────────────────────────────
secao("O organizador abre a prova do W.O. do circuito dele");

const CAMINHO = "wo/2026/circuito-sp/comprovante-1.jpg";
const CAMINHO_DE_FORA = "wo/2026/circuito-rj/comprovante-9.jpg";

async function cenarioComprovante() {
  const hash = await pinGuardado(PIN_ORG);
  return montarMotor({
    funcao: "comprovante-url",
    circuitos: [circuito(BH), circuito(CIRC, { slug: "sp", sistema: "B" }), circuito(OUTRO, { slug: "rj", sistema: "B" })],
    atletas: [atleta(ORG, { nome: "Organizador", telefone: TEL, pin_hash: hash })],
    solicitacoes_wo: [
      { id: "wo-1", circuito_id: CIRC, comprovante_url: CAMINHO },
      { id: "wo-2", circuito_id: OUTRO, comprovante_url: CAMINHO_DE_FORA },
    ],
    outras: { circuito_organizadores: [{ circuito_id: CIRC, atleta_id: ORG, papel: "organizador" }] },
  });
}

{
  const { motor, banco } = await cenarioComprovante();
  const r = await motor.chamar({ orgTelefone: TEL, orgPin: PIN_ORG, circuitoId: CIRC, path: CAMINHO });
  igual(r.status, 200, "com telefone+PIN, o organizador recebe o link do comprovante");
  ok(String(r.corpo?.dados?.url || "").includes(CAMINHO), "e o link aponta para o comprovante pedido");
  igual(banco.assinaturas.length, 1, "o link foi assinado uma vez");
  igual(banco.assinaturas[0].bucket, "comprovantes-wo", "no bucket privado dos comprovantes");
  igual(banco.assinaturas[0].caminho, CAMINHO,
    "e o caminho assinado é EXATAMENTE o pedido — não um vizinho que passa no includes");
  igual(banco.assinaturas[0].segundos, 3600, "e continua expirando em 1 hora");
}
{
  // A proteção que importa: o comprovante é dado pessoal de outro circuito.
  const { motor, banco } = await cenarioComprovante();
  const r = await motor.chamar({ orgTelefone: TEL, orgPin: PIN_ORG, circuitoId: CIRC, path: CAMINHO_DE_FORA });
  igual(r.status, 403, "pedir o comprovante de um W.O. de OUTRO circuito é recusado");
  igual(banco.assinaturas.length, 0, "e nada é assinado — a autorização vem antes do storage");
}
{
  const { motor, banco } = await cenarioComprovante();
  const r = await motor.chamar({ orgTelefone: TEL, orgPin: PIN_ORG, circuitoId: OUTRO, path: CAMINHO_DE_FORA });
  igual(r.status, 403, "e dizer que organiza o outro circuito não basta: o vínculo é conferido no banco");
  igual(banco.assinaturas.length, 0, "sem assinatura nenhuma");
}
{
  const { motor } = await cenarioComprovante();
  const r = await motor.chamar({ orgTelefone: TEL, orgPin: "0000", circuitoId: CIRC, path: CAMINHO });
  igual(r.status, 401, "PIN errado do organizador não abre comprovante");
}
{
  const { motor } = await cenarioComprovante();
  const r = await motor.chamar({ orgTelefone: TEL, orgPin: PIN_ORG, path: CAMINHO });
  igual(r.status, 400, "sem dizer o circuito, a função recusa em vez de adivinhar");
}
{
  // O caminho do super-admin não foi tocado.
  const { motor, banco } = await cenarioComprovante();
  const r = await motor.chamar({ pin: PIN, path: CAMINHO });
  igual(r.status, 200, "o super-admin continua abrindo qualquer comprovante com o PIN global");
  igual(banco.assinaturas.length, 1, "e o link é assinado");
  const errado = await motor.chamar({ pin: "9999", path: CAMINHO });
  igual(errado.status, 401, "e o PIN global errado continua sendo 401");
}
{
  const { motor } = await cenarioComprovante();
  const r = await motor.chamar({ pin: PIN });
  igual(r.status, 400, "sem path, recusa");
}

process.exit(placar("Onda 0.6 — o organizador consegue trabalhar"));
