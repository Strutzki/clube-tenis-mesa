// Bateria de ATAQUE do Guardião de Segurança — 707c40f
// Roda as Edge Functions DE VERDADE. Não escreve em produção.
import { montarMotor, comoAdmin, comoOrganizador, pinGuardado, atleta, partida, circuito, BH, ok, igual, secao, placar } from "./ferramentas.mjs";

const OUTRO = "33333333-aaaa-4444-8888-333333333333";
const TERC  = "44444444-aaaa-4444-8888-444444444444";
const X = "aa000000-0000-4000-8000-00000000000a"; // atleta SÓ do OUTRO
const B1 = "bb000000-0000-4000-8000-00000000000b"; // atleta do BH
const B2 = "bb000000-0000-4000-8000-00000000000c";

function cenario(extra = {}) {
  return montarMotor({
    circuitos: [
      circuito(BH, { regulamento_versao: "v03-13" }),
      circuito(OUTRO, { slug: "outro", sistema: "B", regulamento_versao: "vB-01" }),
    ],
    atletas: [
      atleta(X, { rating: 777, rating_inicial: 777, status: "ativo" }),
      atleta(B1), atleta(B2),
    ],
    circuito_atletas: [
      { circuito_id: OUTRO, atleta_id: X, status: "ativo", pendente_circuito: false, wo_culposos_temporada: 0 },
      { circuito_id: BH, atleta_id: B1, status: "ativo", pendente_circuito: false },
      { circuito_id: BH, atleta_id: B2, status: "ativo", pendente_circuito: false },
    ],
    partidas: [partida("jbh", { circuito_id: BH, atleta1_id: B1, atleta2_id: B2 })],
    ...extra,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
secao("A1 — a EXCEÇÃO do BH: super-admin no BH com id de atleta de OUTRO circuito");
{
  // EXCLUIR_ATLETA no BH = DELETE global em `atletas`.
  const { banco, motor } = await cenario();
  const r = await comoAdmin(motor, "EXCLUIR_ATLETA", { circuitoId: BH, id: X });
  console.log("   EXCLUIR_ATLETA:", r.status, JSON.stringify(r.corpo));
  const aindaExiste = !!banco.acha("atletas", a => a.id === X);
  ok(aindaExiste, "A1.1 o atleta que só participa do OUTRO NÃO é apagado globalmente por uma ação do BH");
  ok(!!banco.acha("circuito_atletas", c => c.circuito_id === OUTRO && c.atleta_id === X),
     "A1.2 e o vínculo dele com o OUTRO continua de pé");
}
{
  // INSCRICAO_VALIDAR no BH reescreve rating/rating_inicial GLOBAIS.
  const { banco, motor } = await cenario();
  const r = await comoAdmin(motor, "INSCRICAO_VALIDAR", { circuitoId: BH, id: X, approved: true, rating: 9999 });
  console.log("   INSCRICAO_VALIDAR:", r.status, JSON.stringify(r.corpo));
  igual(banco.acha("atletas", a => a.id === X)?.rating, 777,
    "A1.3 o rating global do atleta do OUTRO não é reescrito por uma aprovação feita no BH");
  ok(!banco.acha("circuito_atletas", c => c.circuito_id === BH && c.atleta_id === X),
    "A1.4 e ele NÃO ganha vínculo com o BH sem ninguém ter pedido");
}
{
  // ARQUIVAR_ATLETA no BH derruba o login GLOBAL (login-atleta lê atletas.status).
  const { banco, motor } = await cenario();
  const r = await comoAdmin(motor, "ARQUIVAR_ATLETA", { circuitoId: BH, id: X });
  console.log("   ARQUIVAR_ATLETA:", r.status, JSON.stringify(r.corpo));
  igual(banco.acha("atletas", a => a.id === X)?.status, "ativo",
    "A1.5 arquivar no BH não arquiva globalmente um atleta que é de outro circuito");
}
{
  // DEFINIR_DESCONTO_ATLETA: dado FINANCEIRO gravado no atleta de outro circuito.
  const { banco, motor } = await cenario();
  const r = await comoAdmin(motor, "DEFINIR_DESCONTO_ATLETA", { circuitoId: BH, atletaId: X, descontoPct: 100, isento: true });
  console.log("   DEFINIR_DESCONTO_ATLETA:", r.status, JSON.stringify(r.corpo));
  ok(!banco.acha("circuito_atletas", c => c.circuito_id === BH && c.atleta_id === X),
    "A1.6 definir desconto no BH não cria vínculo BH para atleta de outro circuito");
}

// ─────────────────────────────────────────────────────────────────────────────
secao("A2 — o espelho do A1: super-admin no OUTRO com atleta do BH (a trava nova)");
{
  const { banco, motor } = await cenario();
  const r = await comoAdmin(motor, "ARQUIVAR_ATLETA", { circuitoId: OUTRO, id: B1 });
  igual(r.status, 403, "A2.1 no OUTRO a checagem de membro vale para o super-admin (403)");
  igual(banco.acha("atletas", a => a.id === B1)?.status, "ativo", "A2.2 e o atleta do BH fica intacto");
}

// ─────────────────────────────────────────────────────────────────────────────
secao("A3 — promoverIdentidadeGlobal x LGPD");
{
  // Pediu EXCLUSÃO (art. 18 LGPD) e está globalmente "pendente".
  const { banco, motor } = await montarMotor({
    circuitos: [circuito(BH, { regulamento_versao: "v03-13" }), circuito(OUTRO, { slug: "outro", sistema: "B", regulamento_versao: "vB-01" })],
    atletas: [atleta(X, { status: "pendente", exclusao_solicitada_em: "2026-09-20T10:00:00Z" })],
    circuito_atletas: [{ circuito_id: OUTRO, atleta_id: X, status: "pendente", pendente_circuito: true }],
  });
  const r = await comoAdmin(motor, "INSCRICAO_VALIDAR", { circuitoId: OUTRO, id: X, approved: true });
  console.log("   INSCRICAO_VALIDAR (pediu exclusão):", r.status, JSON.stringify(r.corpo));
  const st = banco.acha("atletas", a => a.id === X)?.status;
  console.log("   atletas.status depois:", st);
  igual(st, "pendente",
    "A3.1 aprovar inscrição NÃO promove a identidade global de quem pediu exclusão LGPD");
}
{
  // Já ANONIMIZADO: status "arquivado" + telefone "removido:" — a promoção não pode ressuscitar.
  const { banco, motor } = await montarMotor({
    circuitos: [circuito(BH, { regulamento_versao: "v03-13" }), circuito(OUTRO, { slug: "outro", sistema: "B", regulamento_versao: "vB-01" })],
    atletas: [atleta(X, { status: "arquivado", telefone: "removido:abc" })],
    circuito_atletas: [{ circuito_id: OUTRO, atleta_id: X, status: "arquivado", pendente_circuito: false }],
  });
  const r1 = await comoAdmin(motor, "DESARQUIVAR_ATLETA", { circuitoId: OUTRO, id: X });
  igual(r1.status, 409, "A3.2 DESARQUIVAR recusa cadastro anonimizado (409)");
  const r2 = await comoAdmin(motor, "INSCRICAO_VALIDAR", { circuitoId: OUTRO, id: X, approved: true });
  console.log("   INSCRICAO_VALIDAR (anonimizado):", r2.status, JSON.stringify(r2.corpo));
  igual(banco.acha("atletas", a => a.id === X)?.status, "arquivado",
    "A3.3 e aprovar a inscrição do anonimizado não o traz de volta para 'ativo'");
}
{
  // Só para CIMA: reprovado e arquivado não voltam.
  for (const st of ["arquivado", "reprovado", "ativo"]) {
    const { banco, motor } = await montarMotor({
      circuitos: [circuito(BH, { regulamento_versao: "v03-13" }), circuito(OUTRO, { slug: "outro", sistema: "B", regulamento_versao: "vB-01" })],
      atletas: [atleta(X, { status: st })],
      circuito_atletas: [{ circuito_id: OUTRO, atleta_id: X, status: "pendente", pendente_circuito: true }],
    });
    await comoAdmin(motor, "INSCRICAO_VALIDAR", { circuitoId: OUTRO, id: X, approved: true });
    igual(banco.acha("atletas", a => a.id === X)?.status, st,
      `A3.4 a promoção não mexe em quem já está '${st}'`);
  }
}
{
  // O caso legítimo: pendente limpo VIRA ativo (senão não entra no app).
  const { banco, motor } = await montarMotor({
    circuitos: [circuito(BH, { regulamento_versao: "v03-13" }), circuito(OUTRO, { slug: "outro", sistema: "B", regulamento_versao: "vB-01" })],
    atletas: [atleta(X, { status: "pendente" })],
    circuito_atletas: [{ circuito_id: OUTRO, atleta_id: X, status: "pendente", pendente_circuito: true }],
  });
  await comoAdmin(motor, "INSCRICAO_VALIDAR", { circuitoId: OUTRO, id: X, approved: true });
  igual(banco.acha("atletas", a => a.id === X)?.status, "ativo",
    "A3.5 e o caso legítimo continua funcionando: pendente sem pendência vira ativo");
}
{
  // REPROVAR não pode fechar a porta global.
  const { banco, motor } = await montarMotor({
    circuitos: [circuito(BH, { regulamento_versao: "v03-13" }), circuito(OUTRO, { slug: "outro", sistema: "B", regulamento_versao: "vB-01" })],
    atletas: [atleta(X, { status: "ativo" })],
    circuito_atletas: [{ circuito_id: OUTRO, atleta_id: X, status: "pendente", pendente_circuito: true }],
  });
  await comoAdmin(motor, "INSCRICAO_VALIDAR", { circuitoId: OUTRO, id: X, approved: false, motivo: "não" });
  igual(banco.acha("atletas", a => a.id === X)?.status, "ativo",
    "A3.6 reprovar num circuito não rebaixa a identidade global");
  igual(banco.acha("circuito_atletas", c => c.atleta_id === X)?.status, "reprovado",
    "A3.7 mas reprova no circuito");
}

// ─────────────────────────────────────────────────────────────────────────────
secao("A4 — o DELETE do INSCREVER: dá para apagar a pessoa errada?");
const funcoesCpf = {
  get_cpf_pepper: () => "pepper-de-teste",
  dedup_por_cpf_hash: (banco, args) => [{ existe: (banco.tabelas.atleta_documento || []).some(d => d.cpf_hash === args.p_hash) }],
};
function cenarioInscrever(atletas, docs = []) {
  return montarMotor({
    funcao: "athlete-action",
    circuitos: [circuito(BH, { regulamento_versao: "v03-13", inscricoes_abertas: true }), circuito(OUTRO, { slug: "outro", sistema: "B", regulamento_versao: "vB-01", inscricoes_abertas: true, ativo: true })],
    atletas,
    circuito_atletas: [],
    funcoes: funcoesCpf,
    outras: { atleta_documento: docs, tentativas_busca_cpf: [] },
  });
}
const INSC = {
  circuitoId: OUTRO, nome: "Novo", telefone: "31988887777", cpf: "39053344705",
  cpfConsent: true, cpfConsentVersao: "v1", dataNascimento: "1990-01-01",
  aceiteRegulamento: true, aceiteLGPD: true,
};
{
  // Falha do vínculo -> desfaz. Quem é apagado?
  const { banco, motor } = await cenarioInscrever([atleta(X), atleta(B1)]);
  banco.recusar("circuito_atletas", "upsert", { message: "simulando falha", code: "XX000" });
  const r = await motor.chamar({ acao: "INSCREVER", payload: INSC });
  console.log("   INSCREVER com vínculo falhando:", r.status, JSON.stringify(r.corpo));
  igual(banco.linhas("atletas").map(a => a.id).sort(), [X, B1].sort(),
    "A4.1 o rollback apaga SÓ o recém-criado — ninguém mais some de `atletas`");
  // A FK atleta_documento_atleta_id_fkey é ON DELETE CASCADE em produção (conferido
  // por SQL). O banco falso NÃO modela cascade — então aqui a linha sobra, e isso é
  // limitação do instrumento, não do motor. Registro o fato em vez de afirmar o falso.
  console.log("   (banco falso não modela CASCADE; em produção a FK é ON DELETE CASCADE)");
}
{
  // Telefone já existente: o insert falha ANTES, nenhum delete acontece.
  const { banco, motor } = await cenarioInscrever([atleta(X, { telefone: "31988887777" })]);
  // O banco falso não tem UNIQUE: simulo a recusa que o Postgres daria.
  banco.recusar("atletas", "insert", { message: 'duplicate key value violates unique constraint "atletas_telefone_unique"', code: "23505" });
  const r = await motor.chamar({ acao: "INSCREVER", payload: INSC });
  // ⚠️ LIMITAÇÃO DO INSTRUMENTO: o `single()` do banco falso DESCARTA o erro
  // injetado por `recusar` e devolve PGRST116 no lugar dele. Em produção a
  // mensagem traria "atletas_telefone_unique" e a resposta seria 409
  // telefone_duplicado. O que dá para provar aqui é o que importa para a
  // pergunta de segurança: a inscrição é recusada e NADA é apagado.
  ok(r.corpo?.sucesso !== true, "A4.3 com o insert recusado a inscrição NÃO responde sucesso");
  ok(!!banco.acha("atletas", a => a.id === X), "A4.4 e o dono do telefone continua existindo");
  igual(banco.registro.filter(r => r.tabela === "atletas" && r.operacao === "delete").length, 0,
    "A4.5 e nenhum DELETE em `atletas` foi executado");
}
{
  // O `id` do payload não pode virar o alvo do delete.
  const { banco, motor } = await cenarioInscrever([atleta(X)]);
  banco.recusar("circuito_atletas", "upsert", { message: "simulando falha", code: "XX000" });
  await motor.chamar({ acao: "INSCREVER", payload: { ...INSC, id: X, atleta_id: X } });
  ok(!!banco.acha("atletas", a => a.id === X),
    "A4.6 mandar `id` de outra pessoa no payload não faz o rollback apagá-la");
}
{
  // BH: a falha do vínculo é best-effort (roster legado) — a inscrição fica de pé.
  const { banco, motor } = await cenarioInscrever([]);
  banco.recusar("circuito_atletas", "upsert", { message: "simulando falha", code: "XX000" });
  const r = await motor.chamar({ acao: "INSCREVER", payload: { ...INSC, circuitoId: BH } });
  igual(r.corpo?.sucesso, true, "A4.7 no BH a falha do espelho não desfaz a inscrição");
  igual(banco.linhas("atletas").length, 1, "A4.8 e o atleta do BH permanece");
}

// ─────────────────────────────────────────────────────────────────────────────
secao("A5 — auto_validar_placar é DO CIRCUITO (e quem escolhe o circuito?)");
{
  const cen = (autoBH, autoOutro) => montarMotor({
    funcao: "athlete-action",
    circuitos: [circuito(BH, { regulamento_versao: "v03-13" }), circuito(OUTRO, { slug: "outro", sistema: "B", regulamento_versao: "vB-01", auto_validar_placar: autoOutro })],
    configuracao: [{ id: 1, fase: "temporada", temporada_numero: 1, temporada_ano: 2026, rodadas_por_temporada: 6, auto_validar_placar: autoBH }],
    atletas: [atleta(B1), atleta(B2)],
    circuito_atletas: [
      { circuito_id: OUTRO, atleta_id: B1, status: "ativo" }, { circuito_id: OUTRO, atleta_id: B2, status: "ativo" },
    ],
    partidas: [partida("j1", { circuito_id: OUTRO, atleta1_id: B1, atleta2_id: B2, prazo: "2099-01-01" })],
  });
  // Os DOIS atletas mandam o mesmo placar — é o que a auto-validação exige.
  const doisEnviam = async (motor, circuitoIdNoPayload) => {
    await motor.chamar({ acao: "ENVIAR_PLACAR", payload: { circuitoId: circuitoIdNoPayload, matchId: "j1", athleteId: B1, score1: 3, score2: 1 } });
    return motor.chamar({ acao: "ENVIAR_PLACAR", payload: { circuitoId: circuitoIdNoPayload, matchId: "j1", athleteId: B2, score1: 3, score2: 1 } });
  };
  {
    const { banco, motor } = await cen(true, false);
    await doisEnviam(motor, OUTRO);
    igual(banco.acha("partidas", m => m.id === "j1")?.validado, false,
      "A5.1 BH ligado + circuito novo desligado => a partida do circuito novo NÃO é auto-validada");
  }
  {
    const { banco, motor } = await cen(false, true);
    await doisEnviam(motor, OUTRO);
    igual(banco.acha("partidas", m => m.id === "j1")?.validado, true,
      "A5.2 e com o circuito novo ligado ela É auto-validada, mesmo com o BH desligado");
  }
  {
    const { banco, motor } = await cen(true, null);
    await doisEnviam(motor, OUTRO);
    igual(banco.acha("partidas", m => m.id === "j1")?.validado, false,
      "A5.3 circuito sem auto_validar definido não auto-valida (fail-closed)");
  }
  {
    // ATAQUE: o `circuitoId` do ENVIAR_PLACAR vem do CLIENTE e não é conferido
    // contra `partidas.circuito_id`. A partida é do OUTRO (auto-validação
    // DESLIGADA pelo organizador dele); o atleta manda `circuitoId: BH`, onde a
    // auto-validação está LIGADA (estado de produção hoje).
    const { banco, motor } = await cen(true, false);
    const r = await doisEnviam(motor, BH);
    console.log("   ENVIAR_PLACAR mentindo o circuitoId:", r.status, JSON.stringify(r.corpo));
    igual(banco.acha("partidas", m => m.id === "j1")?.validado, false,
      "A5.4 o atleta NÃO consegue escolher de qual circuito sai a regra de auto-validação");
  }
}

secao("A6 — wo_culposos_temporada: o caminho público do visitante anônimo");
{
  const fs = await import("node:fs");
  const fonte = fs.readFileSync("/Users/strutzki/clube-tenis-mesa-v2/src/App.jsx", "utf8");
  const sel = fonte.split("getAtletas:")[1]?.split("\n")[0] || "";
  ok(sel.length > 50, "A6.0 achei o select público de db.getAtletas");
  ok(!/wo_culposos_temporada/.test(sel),
    "A6.1 o select PÚBLICO de circuito_atletas NÃO pede wo_culposos_temporada (sem grant p/ anon — pediria e derrubaria o app do visitante)");
  ok(!/desconto_pct|isento|pin_hash|telefone|cpf/.test(sel),
    "A6.2 e continua sem desconto_pct/isento/telefone/cpf (blindagem da fase 4C)");
}
{
  // O porteiro (service role) DEVOLVE o campo, e os dois adaptadores o repassam.
  const fs = await import("node:fs");
  const fonte = fs.readFileSync("/Users/strutzki/clube-tenis-mesa-v2/src/App.jsx", "utf8");
  for (const nome of ["mapAtletaFromCircuito", "porteiroRankingToCa"]) {
    const corpo = fonte.split(`function ${nome}`)[1]?.split("\nfunction ")[0] || "";
    ok(/wo_culposos_temporada:\s*\w+\.wo_culposos_temporada/.test(corpo), `A6.3 ${nome} repassa o campo`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
secao("A7 — APLICAR_WO: faltosoId arbitrário (não é participante da partida)");
{
  const { banco, motor } = await montarMotor({
    circuitos: [circuito(BH, { regulamento_versao: "v03-13" }), circuito(OUTRO, { slug: "outro", sistema: "B", regulamento_versao: "vB-01" })],
    atletas: [atleta(X, { wo_culposos_temporada: 3 }), atleta(B1), atleta(B2)],
    circuito_atletas: [
      { circuito_id: OUTRO, atleta_id: X, status: "ativo", wo_culposos_temporada: 3 },
      { circuito_id: BH, atleta_id: B1, status: "ativo" }, { circuito_id: BH, atleta_id: B2, status: "ativo" },
    ],
    partidas: [partida("jbh", { circuito_id: BH, atleta1_id: B1, atleta2_id: B2 })],
  });
  const r = await comoAdmin(motor, "APLICAR_WO", { circuitoId: BH, matchId: "jbh", tipo: "culposo", faltosoId: X, beneficiarioId: B1 });
  console.log("   APLICAR_WO com faltoso de fora:", r.status, JSON.stringify(r.corpo));
  igual(r.status, 403, "A7.1 o faltoso tem de ser participante da partida / membro do circuito");
  igual(banco.acha("atletas", a => a.id === X)?.wo_culposos_temporada, 3,
    "A7.2 e o contador global do atleta de outro circuito não é reescrito");
  ok(!banco.acha("circuito_atletas", c => c.circuito_id === BH && c.atleta_id === X),
    "A7.3 e ele não ganha vínculo com o BH");
}

process.exit(placar("ATAQUE do Guardião de Segurança"));
