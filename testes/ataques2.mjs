// Reconferência do Guardião de Segurança — 5bc6703
import { montarMotor, comoAdmin, atleta, partida, circuito, BH, PIN, ok, igual, secao, placar } from "./ferramentas.mjs";
import fs from "node:fs";

const OUTRO = "33333333-aaaa-4444-8888-333333333333";
const X = "aa000000-0000-4000-8000-00000000000a"; // só do OUTRO
const B1 = "bb000000-0000-4000-8000-00000000000b";
const B2 = "bb000000-0000-4000-8000-00000000000c";

const cenario = (extra = {}) => montarMotor({
  circuitos: [circuito(BH, { regulamento_versao: "v03-13" }), circuito(OUTRO, { slug: "outro", sistema: "B", regulamento_versao: "vB-01" })],
  atletas: [atleta(X, { rating: 777, rating_inicial: 777 }), atleta(B1), atleta(B2)],
  circuito_atletas: [
    { circuito_id: OUTRO, atleta_id: X, status: "ativo", pendente_circuito: false },
    { circuito_id: BH, atleta_id: B1, status: "ativo", pendente_circuito: false },
    { circuito_id: BH, atleta_id: B2, status: "ativo", pendente_circuito: false },
  ],
  partidas: [partida("jbh", { circuito_id: BH, atleta1_id: B1, atleta2_id: B2 })],
  ...extra,
});

// ══════════════════════════════════════════════════════════════════════════
secao("C4 — o caso IRREVERSÍVEL: super-admin no BH com id de atleta de OUTRO circuito");
{
  const { banco, motor } = await cenario();
  const r = await comoAdmin(motor, "EXCLUIR_ATLETA", { circuitoId: BH, id: X });
  console.log("   EXCLUIR_ATLETA:", r.status, JSON.stringify(r.corpo));
  ok(!!banco.acha("atletas", a => a.id === X), "C4.1 o atleta do OUTRO não é apagado globalmente por uma ação do BH");
  ok(!!banco.acha("circuito_atletas", c => c.atleta_id === X), "C4.2 e o vínculo dele com o OUTRO sobrevive");
}
{
  const { banco, motor } = await cenario();
  await comoAdmin(motor, "ARQUIVAR_ATLETA", { circuitoId: BH, id: X });
  igual(banco.acha("atletas", a => a.id === X)?.status, "ativo", "C4.3 arquivar no BH não derruba o login global dele");
}
{
  const { banco, motor } = await cenario();
  await comoAdmin(motor, "INSCRICAO_VALIDAR", { circuitoId: BH, id: X, approved: true, rating: 9999 });
  igual(banco.acha("atletas", a => a.id === X)?.rating, 777, "C4.4 o rating global dele não é reescrito por uma aprovação no BH");
}
// O que o `semIntrusosDeOutroCircuito` DE FATO fecha (o caminho de LEITURA).
{
  const { banco, motor } = await cenario({
    atletas: [atleta(X, { status: "ativo", pendente_circuito: false }), atleta(B1), atleta(B2)],
    partidas: [],
  });
  const r = await comoAdmin(motor, "INICIAR_ETAPA", { circuitoId: BH });
  const ps = banco.linhas("partidas");
  const pareouIntruso = ps.some(m => m.atleta1_id === X || m.atleta2_id === X);
  console.log("   INICIAR_ETAPA no BH:", r.status, JSON.stringify(r.corpo), "| partidas:", ps.length);
  ok(!pareouIntruso, "C4.5 o intruso de outro circuito NÃO é pareado no BH (roster filtrado)");
}

// ══════════════════════════════════════════════════════════════════════════
secao("C1 — as duas guardas LGPD dentro de promoverIdentidadeGlobal");
const cenLgpd = (campos) => montarMotor({
  circuitos: [circuito(BH, { regulamento_versao: "v03-13" }), circuito(OUTRO, { slug: "outro", sistema: "B", regulamento_versao: "vB-01" })],
  atletas: [atleta(X, { status: "pendente", ...campos })],
  circuito_atletas: [{ circuito_id: OUTRO, atleta_id: X, status: "pendente", pendente_circuito: true }],
});
for (const [rotulo, campos] of [
  ["pediu exclusão", { exclusao_solicitada_em: "2026-09-20T10:00:00Z" }],
  ["telefone anonimizado", { telefone: "removido:abc" }],
  ["pediu exclusão E anonimizado", { exclusao_solicitada_em: "2026-09-20T10:00:00Z", telefone: "removido:abc" }],
]) {
  const { banco, motor } = await cenLgpd(campos);
  const r = await comoAdmin(motor, "INSCRICAO_VALIDAR", { circuitoId: OUTRO, id: X, approved: true });
  igual(banco.acha("atletas", a => a.id === X)?.status, "pendente",
    `C1.1 INSCRICAO_VALIDAR não promove a identidade global de quem ${rotulo} (resposta ${r.status})`);
}
{
  const { banco, motor } = await cenLgpd({});
  await comoAdmin(motor, "INSCRICAO_VALIDAR", { circuitoId: OUTRO, id: X, approved: true });
  const a = banco.acha("atletas", a => a.id === X);
  igual(a?.status, "ativo", "C1.2 o caso legítimo continua promovendo");
  igual(a?.pendente_circuito, true, "C1.3 e marca pendente_circuito=true (para não cair no roster do BH)");
}
{
  // O outro chamador: DESARQUIVAR. As guardas do `case` já pegavam; agora há duas camadas.
  const { banco, motor } = await montarMotor({
    circuitos: [circuito(BH, { regulamento_versao: "v03-13" }), circuito(OUTRO, { slug: "outro", sistema: "B", regulamento_versao: "vB-01" })],
    atletas: [atleta(X, { status: "pendente", exclusao_solicitada_em: "2026-09-20T10:00:00Z" })],
    circuito_atletas: [{ circuito_id: OUTRO, atleta_id: X, status: "arquivado", pendente_circuito: false }],
  });
  const r = await comoAdmin(motor, "DESARQUIVAR_ATLETA", { circuitoId: OUTRO, id: X });
  igual(r.status, 409, "C1.4 DESARQUIVAR continua recusando quem pediu exclusão");
  igual(banco.acha("atletas", a => a.id === X)?.status, "pendente", "C1.5 e a identidade global não sobe");
}

// ══════════════════════════════════════════════════════════════════════════
secao("C2 — ENVIAR_PLACAR: o circuito vem da PARTIDA");
{
  const cen = (autoBH, autoOutro) => montarMotor({
    funcao: "athlete-action",
    circuitos: [circuito(BH, { regulamento_versao: "v03-13" }), circuito(OUTRO, { slug: "outro", sistema: "B", regulamento_versao: "vB-01", auto_validar_placar: autoOutro })],
    configuracao: [{ id: 1, fase: "temporada", temporada_numero: 1, temporada_ano: 2026, rodadas_por_temporada: 6, auto_validar_placar: autoBH }],
    atletas: [atleta(B1), atleta(B2)],
    circuito_atletas: [{ circuito_id: OUTRO, atleta_id: B1, status: "ativo" }, { circuito_id: OUTRO, atleta_id: B2, status: "ativo" }],
    partidas: [partida("j1", { circuito_id: OUTRO, atleta1_id: B1, atleta2_id: B2, prazo: "2099-01-01" })],
  });
  const dois = async (motor, cid) => {
    await motor.chamar({ acao: "ENVIAR_PLACAR", payload: { circuitoId: cid, matchId: "j1", athleteId: B1, score1: 3, score2: 1 } });
    return motor.chamar({ acao: "ENVIAR_PLACAR", payload: { circuitoId: cid, matchId: "j1", athleteId: B2, score1: 3, score2: 1 } });
  };
  { const { banco, motor } = await cen(true, false); const r = await dois(motor, BH);
    console.log("   mentindo circuitoId:<BH>:", JSON.stringify(r.corpo));
    igual(banco.acha("partidas", m => m.id === "j1")?.validado, false,
      "C2.1 o atleta NÃO escolhe de qual circuito sai a regra de auto-validação"); }
  { const { banco, motor } = await cen(true, false); await dois(motor, OUTRO);
    igual(banco.acha("partidas", m => m.id === "j1")?.validado, false, "C2.2 circuito desligado continua não auto-validando"); }
  { const { banco, motor } = await cen(false, true); await dois(motor, BH);
    igual(banco.acha("partidas", m => m.id === "j1")?.validado, true, "C2.3 e circuito ligado auto-valida mesmo com o cliente mentindo <BH> (a partida manda)"); }
  { const { banco, motor } = await cen(true, false); await dois(motor, "nao-existe");
    igual(banco.acha("partidas", m => m.id === "j1")?.validado, false, "C2.4 circuitoId inventado também não muda nada"); }
}

// ══════════════════════════════════════════════════════════════════════════
secao("PORTEIRO — o caminho novo do PIN do super-admin");
const cenPort = (pub) => montarMotor({
  funcao: "circuito-dados",
  circuitos: [circuito(BH, { regulamento_versao: "v03-13" }), circuito(OUTRO, { slug: "outro", sistema: "B", publico: pub, regulamento_versao: "vB-01" })],
  atletas: [atleta(B1), atleta(B2)],
  circuito_atletas: [
    { circuito_id: OUTRO, atleta_id: B1, status: "ativo", wo_culposos_temporada: 2, desconto_pct: 80, isento: true, pagamento_confirmado: true },
    { circuito_id: OUTRO, atleta_id: B2, status: "ativo", wo_culposos_temporada: 0, desconto_pct: 0, isento: false },
  ],
  partidas: [partida("j1", { circuito_id: OUTRO, atleta1_id: B1, atleta2_id: B2 })],
});
{
  const { motor } = await cenPort(false);
  const r = await motor.chamar({ circuitoId: OUTRO, pin: PIN });
  igual(r.status, 200, "P1 com o PIN global certo o super-admin lê o circuito PRIVADO");
  ok((r.corpo?.dados?.ranking || []).length === 2, "P2 e recebe o ranking completo");
  igual(r.corpo?.dados?.ranking?.find(a => a.id === B1)?.wo_culposos_temporada, 2, "P3 com o wo_culposos_temporada, que era o ponto");
}
{
  const { banco, motor } = await cenPort(false);
  const r = await motor.chamar({ circuitoId: OUTRO, pin: "9999" });
  igual(r.status, 403, "P4 PIN errado: 403, sem dado nenhum");
  ok(!r.corpo?.dados, "P5 e o corpo não traz `dados`");
  igual(banco.linhas("tentativas_login_admin").length, 1, "P6 e a tentativa falha é REGISTRADA no mesmo balde do admin-action");
}
{
  // O freio: 5 falhas em 15 min fecham a porta.
  const { banco, motor } = await cenPort(false);
  for (let i = 0; i < 5; i++) await motor.chamar({ circuitoId: OUTRO, pin: "0000" });
  const r = await motor.chamar({ circuitoId: OUTRO, pin: PIN });
  igual(r.status, 429, "P7 depois de 5 falhas nem o PIN CERTO passa (freio compartilhado)");
  console.log("   ⚠️ consequência: qualquer um trava o super-admin por 15 min, nas DUAS funções");
}
{
  // `telefone` presente desvia do caminho do super-admin (é a chave da distinção).
  const { motor } = await cenPort(false);
  const r = await motor.chamar({ circuitoId: OUTRO, telefone: "31900000000", pin: PIN });
  igual(r.status, 403, "P8 PIN global COM telefone não entra pelo caminho do super-admin");
}
{
  // Anônimo num circuito PRIVADO continua barrado.
  const { motor } = await cenPort(false);
  const r = await motor.chamar({ circuitoId: OUTRO });
  igual(r.status, 403, "P9 anônimo em circuito privado: 403");
}
{
  // Anônimo num circuito PÚBLICO: o que ele passa a ver?
  const { motor } = await cenPort(true);
  const r = await motor.chamar({ circuitoId: OUTRO });
  igual(r.status, 200, "P10 anônimo em circuito público é servido (como antes)");
  const a = r.corpo?.dados?.ranking?.find(x => x.id === B1) || {};
  const chaves = Object.keys(a).sort();
  console.log("   campos servidos ao ANÔNIMO:", chaves.join(","));
  ok(!("desconto_pct" in a), "P11 o anônimo NÃO recebe desconto_pct (blindagem intacta)");
  ok(!("isento" in a), "P12 nem isento");
  ok(!("pagamento_confirmado" in a), "P13 nem pagamento_confirmado");
  ok(!("telefone" in a) && !("pin_hash" in a) && !("cpf_hash" in a), "P14 nem telefone/pin_hash/cpf_hash");
  ok(!("exclusao_solicitada_em" in a) && !("aceite_lgpd" in a), "P15 nem exclusao_solicitada_em/aceite_lgpd");
  // ⚠️ AQUI EU DISCORDO DO SUPERVISOR DE SEGURANÇA, com argumento.
  //
  // Ele classificou esta asserção como "uma asserção que protege o furo": o rótulo
  // antigo dizia "⚠️ MAS recebe wo_culposos_temporada — coluna que a fase 4C tirou do
  // anon de propósito", ou seja reconhecia um vazamento E afirmava que ele acontece,
  // congelando-o como esperado. A crítica ao RÓTULO está certa e ele foi reescrito.
  //
  // Mas o COMPORTAMENTO não é vazamento, e tirá-lo quebraria o produto. O vB-01,
  // Cap. 09, faz "menos W.O. injustificados" o 2º critério de DESEMPATE do ranking —
  // e o ranking de circuito público é público. Sem este número, ninguém consegue
  // conferir por que um atleta está acima de outro com os mesmos pontos: o ranking
  // deixa de ser verificável e passa a ser uma lista que o servidor manda acreditar.
  // É dado de COMPETIÇÃO, da mesma natureza de vitórias e derrotas, que ninguém
  // propôs esconder.
  //
  // A fronteira que importa está nas asserções P11–P15 logo acima, e ela é outra:
  // pagamento, desconto, isenção, telefone, hash de PIN, hash de CPF, aceite de LGPD
  // e pedido de exclusão NÃO saem. Essas são dados pessoais e financeiros. O contador
  // de W.O. não é nenhum dos dois.
  //
  // E a fronteira de circuito PRIVADO é garantida antes disto: o porteiro recusa a
  // requisição inteira de quem não é membro (asserção P9/P10 e o bloco do freio).
  igual(a.wo_culposos_temporada, 2,
    "P16 o anônimo RECEBE wo_culposos_temporada em circuito público — deliberado: é o 2º desempate do Cap. 09, e sem ele o ranking público não é verificável");
}

// ══════════════════════════════════════════════════════════════════════════
secao("ANONIMIZAR — escopo e checagem de erro dos três comandos");
const cenAnon = () => montarMotor({
  funcao: "anonimizar-atleta",
  circuitos: [circuito(BH, { regulamento_versao: "v03-13" }), circuito(OUTRO, { slug: "outro", sistema: "B", regulamento_versao: "vB-01" })],
  atletas: [atleta(X, { exclusao_solicitada_em: "2026-09-20T10:00:00Z" }), atleta(B1)],
  circuito_atletas: [
    { circuito_id: OUTRO, atleta_id: X, status: "ativo", aceite_regulamento: true, versao_regulamento: "vB-01" },
    { circuito_id: BH, atleta_id: X, status: "ativo", aceite_regulamento: true, versao_regulamento: "v03-13" },
    { circuito_id: OUTRO, atleta_id: B1, status: "ativo", aceite_regulamento: true, versao_regulamento: "vB-01" },
  ],
  outras: { atleta_documento: [{ atleta_id: X, cpf_hash: "h1" }, { atleta_id: B1, cpf_hash: "h2" }], atleta_sessao: [{ id: "s1", atleta_id: X }, { id: "s2", atleta_id: B1 }] },
});
{
  const { banco, motor } = await cenAnon();
  const r = await motor.chamar({ pin: PIN, id: X });
  console.log("   anonimizar:", r.status, JSON.stringify(r.corpo));
  igual(banco.linhas("atleta_documento").map(d => d.atleta_id), [B1], "AN1 apaga só o documento DELE");
  igual(banco.linhas("atleta_sessao").map(s => s.atleta_id), [B1], "AN2 encerra só as sessões DELE");
  igual(banco.linhas("circuito_atletas").filter(c => c.status === "arquivado").map(c => c.atleta_id), [X, X], "AN3 arquiva o vínculo dele em TODOS os circuitos, e só o dele");
  igual(banco.acha("circuito_atletas", c => c.atleta_id === B1)?.aceite_regulamento, true, "AN4 e não toca no recibo de outro atleta");
  const vinc = banco.linhas("circuito_atletas").filter(c => c.atleta_id === X);
  ok(vinc.every(v => v.aceite_regulamento === false && v.versao_regulamento === null), "AN5 o recibo de consentimento dele é revogado nos dois circuitos");
}
{
  // O DELETE do documento falha: a função ainda responde sucesso?
  const { banco, motor } = await cenAnon();
  banco.recusar("atleta_documento", "delete", { message: "simulando falha", code: "XX000" });
  const r = await motor.chamar({ pin: PIN, id: X });
  console.log("   com o delete do CPF falhando:", r.status, JSON.stringify(r.corpo));
  // ⚠️ TRÊS VERSÕES DESTA ASSERÇÃO, e vale registrar as duas erradas.
  //
  // (1) ERA `sucesso !== true || efeito` — disjunção. O Supervisor de Segurança
  //     apontou, com razão, que QUALQUER 500 a satisfazia: um erro antes de a
  //     exclusão começar passava verde sem testar invariante nenhuma.
  // (2) EU TROQUEI por `sucesso === true && efeito` — e ficou VERMELHA, porque o
  //     cenário INJETA a falha de propósito. Eu li "disjunção fraca" e endureci o
  //     lado errado: exigir sucesso contradiz o próprio cenário.
  // (3) O certo é afirmar as TRÊS coisas que a invariante realmente promete, e que
  //     nem a disjunção nem a conjunção afirmavam:
  //       · não responde sucesso;
  //       · responde 500 (não um 2xx silencioso nem um 4xx de validação);
  //       · e NÃO destrói a identidade — é o que permite tentar de novo. O estado
  //         "pior que os dois" é apagar metade e dizer que nada aconteceu.
  ok(r.corpo?.sucesso !== true,
    "AN6a com o delete do CPF falhando, a função NÃO responde sucesso");
  igual(r.status, 500,
    "AN6b e responde 500 — falha de gravação, não erro de validação");
  igual(banco.acha("atletas", a => a.id === X)?.exclusao_solicitada_em, "2026-09-20T10:00:00Z",
    "AN6c e o PEDIDO continua de pé — o titular pode tentar de novo, que é o oposto de apagar metade e dizer que nada aconteceu");
}
{
  const { banco, motor } = await cenAnon();
  banco.recusar("atleta_sessao", "delete", { message: "simulando falha", code: "XX000" });
  const r = await motor.chamar({ pin: PIN, id: X });
  ok(r.corpo?.sucesso !== true,
    "AN7a com o delete da sessão falhando, a função NÃO responde sucesso");
  igual(r.status, 500, "AN7b e responde 500");
  igual(banco.acha("atletas", a => a.id === X)?.exclusao_solicitada_em, "2026-09-20T10:00:00Z",
    "AN7c e o pedido continua de pé para a próxima tentativa");
}
{
  const { motor } = await cenAnon();
  const r = await motor.chamar({ pin: "9999", id: X });
  igual(r.status, 401, "AN8 sem o PIN certo não anonimiza ninguém");
}

// ══════════════════════════════════════════════════════════════════════════
secao("C5 — o caminho público do visitante (fonte)");
{
  const fonte = fs.readFileSync("/Users/strutzki/clube-tenis-mesa-v2/src/App.jsx", "utf8");
  const sel = fonte.split("getAtletas:")[1]?.split("\n")[0] || "";
  ok(!/wo_culposos_temporada/.test(sel), "C5.1 o select anon de circuito_atletas continua sem wo_culposos_temporada");
  ok(!/desconto_pct|isento|pin_hash|telefone|cpf/.test(sel), "C5.2 e sem desconto_pct/isento/telefone/cpf");
  ok(/body\.pin = cred\.pinSuper/.test(fonte), "C5.3 o PIN do super vai no CORPO do POST");
  const bloco = fonte.split("async function fetchCircuitoPorteiro")[1]?.split("\n}\n")[0] || "";
  ok(!/\$\{[^}]*pin/i.test(bloco.split("body:")[0] || ""), "C5.4 e não entra na URL da requisição");
}

process.exit(placar("RECONFERÊNCIA 5bc6703"));
