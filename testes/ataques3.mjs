// 3ª rodada — Guardião de Segurança, contra 5dfd7b6
import { montarMotor, comoAdmin, atleta, partida, circuito, BH, PIN, ok, igual, secao, placar } from "./ferramentas.mjs";
import { provocandoViolacao } from "./banco-falso.mjs";
import { semComentarios } from "./ferramentas.mjs";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// TOKENS DE SESSÃO para as sondas que exercem direitos do titular. O
// `atletaPorTokenAA` guarda o SHA-256 do token, nunca o token — então o fixture
// precisa semear o hash, e a chamada manda o token cru. Calculado aqui para o
// fixture e a chamada nunca divergirem.
const sha = (t) => createHash("sha256").update(t).digest("hex");
const TOKEN_X = "token-de-teste-do-X";
const TOKEN_B1 = "token-de-teste-do-B1";
const HASH_TOKEN_X = sha(TOKEN_X);
const HASH_TOKEN_B1 = sha(TOKEN_B1);
import { criarBancoFalso } from "./banco-falso.mjs";

const OUTRO = "33333333-aaaa-4444-8888-333333333333";
const X = "aa000000-0000-4000-8000-00000000000a"; // só do OUTRO
const LEG = "cc000000-0000-4000-8000-00000000000f"; // roster legado: sem vínculo nenhum
const B1 = "bb000000-0000-4000-8000-00000000000b";
const B2 = "bb000000-0000-4000-8000-00000000000c";

const cen = (extra = {}) => montarMotor({
  circuitos: [circuito(BH, { regulamento_versao: "v03-13" }), circuito(OUTRO, { slug: "outro", sistema: "B", regulamento_versao: "vB-01" })],
  atletas: [atleta(X, { rating: 777, rating_inicial: 777 }), atleta(LEG, { status: "arquivado" }), atleta(B1), atleta(B2)],
  circuito_atletas: [
    { circuito_id: OUTRO, atleta_id: X, status: "ativo", pendente_circuito: false },
    { circuito_id: BH, atleta_id: B1, status: "ativo", pendente_circuito: false },
    { circuito_id: BH, atleta_id: B2, status: "ativo", pendente_circuito: false },
  ],
  partidas: [partida("jbh", { circuito_id: BH, atleta1_id: B1, atleta2_id: B2 })],
  ...extra,
});

// ══════════════════════════════════════════════════════════════════════════
secao("D4 — o ataque de ESCRITA, refeito: BH + id de fora");
{
  const { banco, motor } = await cen();
  const r = await comoAdmin(motor, "EXCLUIR_ATLETA", { circuitoId: BH, id: X });
  console.log("   EXCLUIR_ATLETA:", r.status, JSON.stringify(r.corpo));
  igual(r.status, 403, "D4.1 EXCLUIR_ATLETA no BH com id de fora é RECUSADO");
  ok(!!banco.acha("atletas", a => a.id === X), "D4.2 e o atleta continua existindo");
}
for (const [acao, extra, conf] of [
  ["ARQUIVAR_ATLETA", {}, b => b.acha("atletas", a => a.id === X)?.status === "ativo"],
  ["INSCRICAO_VALIDAR", { approved: true, rating: 9999 }, b => b.acha("atletas", a => a.id === X)?.rating === 777],
  ["DESARQUIVAR_ATLETA", {}, () => true],
  ["INCLUIR_NO_CIRCUITO", {}, b => !b.acha("circuito_atletas", c => c.circuito_id === BH && c.atleta_id === X)],
  ["RECUSAR_CIRCUITO", {}, b => !b.acha("circuito_atletas", c => c.circuito_id === BH && c.atleta_id === X)],
]) {
  const { banco, motor } = await cen();
  const r = await comoAdmin(motor, acao, { circuitoId: BH, id: X, ...extra });
  igual(r.status, 403, `D4.3 ${acao} no BH com id de fora é recusado`);
  ok(conf(banco), `D4.4 e ${acao} não deixou marca no atleta de fora`);
}
for (const [acao, campo] of [["DEFINIR_DESCONTO_ATLETA", { descontoPct: 100, isento: true }], ["REGISTRAR_PAGAMENTO", { valor: 1 }]]) {
  const { banco, motor } = await cen();
  const r = await comoAdmin(motor, acao, { circuitoId: BH, atletaId: X, ...campo });
  igual(r.status, 403, `D4.5 ${acao} no BH com atleta de fora é recusado`);
  ok(!banco.acha("circuito_atletas", c => c.circuito_id === BH && c.atleta_id === X), `D4.6 e ${acao} não cria vínculo fantasma no BH`);
}
{
  // O roster LEGADO (sem vínculo nenhum) tem de continuar passando.
  const { banco, motor } = await cen();
  const r = await comoAdmin(motor, "DESARQUIVAR_ATLETA", { circuitoId: BH, id: LEG });
  igual(r.status, 200, "D4.7 o atleta do roster legado (sem vínculo nenhum) continua passando no BH");
  igual(banco.acha("atletas", a => a.id === LEG)?.status, "ativo", "D4.8 e volta a ativo");
}
{
  // Quem tem vínculo com os DOIS continua passando no BH.
  const { banco, motor } = await cen({
    atletas: [atleta(X), atleta(B1), atleta(B2)],
    circuito_atletas: [
      { circuito_id: OUTRO, atleta_id: B1, status: "ativo" },
      { circuito_id: BH, atleta_id: B1, status: "ativo", pendente_circuito: false },
      { circuito_id: BH, atleta_id: B2, status: "ativo", pendente_circuito: false },
    ],
  });
  const r = await comoAdmin(motor, "ARQUIVAR_ATLETA", { circuitoId: BH, id: B1 });
  igual(r.status, 200, "D4.9 quem joga nos DOIS circuitos continua sendo operável no BH");
}

// ══════════════════════════════════════════════════════════════════════════
secao("D2 — o conserto da projeção, com má vontade: o que ainda passa");
{
  const banco = criarBancoFalso({
    circuito_atletas: [{ id: "ca1", circuito_id: "c1", atleta_id: "a1", desconto_pct: 80, isento: true }],
    atletas: [{ id: "a1", nome: "Ana", telefone: "31999", pin_hash: "SEGREDO", cpf_hash: "H", perfis: null }],
    perfis: [{ id: "p1", atleta_id: "a1", segredo: "SENSIVEL" }],
  }, {}, {}, {});
  const q = (cols) => banco.cliente.from("circuito_atletas").select(cols);

  // 1. o caso consertado — controle
  {
    const { data } = await q("*, atletas!inner(id,nome)");
    const a = data[0].atletas;
    ok(!("pin_hash" in a) && !("telefone" in a), "D2.1 ✅ embed de 1 nível projeta (o conserto funciona)");
  }
  // 2 e 3. EMBED ANINHADO e ALIAS — reescritos em 01/10/2026.
  //
  // Estas duas sondas nasceram ANTES do portão fail-closed, para perguntar "o
  // instrumento vaza nestas formas?". Desde 29/09 o `projetar` RECUSA as duas em voz
  // alta, e por isso este arquivo parou de rodar: ele morria na segunda sonda e nunca
  // imprimia placar — o Supervisor de Segurança mediu que as "58 asserções" da 3ª
  // rodada eram contagem de código, não execução verde.
  //
  // A recusa é a resposta CERTA, e agora é afirmada em vez de sofrida. A pergunta
  // mudou de "o que vaza?" para "o instrumento se recusa a adivinhar?".
  {
    const r = await provocandoViolacao(() => q("*, atletas!inner(id, perfis(segredo))"));
    ok(/ANINHADO/i.test(r.mensagens.join(" ")),
      "D2.2 embed ANINHADO faz o instrumento PARAR — o split por vírgula descartaria o nível de dentro em silêncio");
  }
  {
    const r = await provocandoViolacao(() => q("*, atl:atletas!inner(id,nome)"));
    ok(/APELIDO/i.test(r.mensagens.join(" ")),
      "D2.3 select com APELIDO faz o instrumento PARAR — ele devolveria a linha inteira em vez de projetar");
  }
  // 4. `!left` — o aplicarJuncao só conhece `!inner`
  {
    const { data } = await q("*, atletas!left(id,nome)");
    console.log("      -> com !left, `atletas` veio:", JSON.stringify(data[0]?.atletas));
    // ⚠️ ERA `ok(true, ...)` — tautologia literal, sempre verde, zero informação.
    // O `!left` é falso-vermelho conhecido (o `aplicarJuncao` só entende `!inner`),
    // e o jeito honesto de registrar isso não é uma asserção que não afirma nada:
    // é afirmar que o instrumento REALMENTE não o modela, para o dia em que alguém
    // ensinar `!left` e esta linha ficar vermelha avisando que o registro envelheceu.
    ok(!/!left/.test(semComentarios(readFileSync(new URL("./banco-falso.mjs", import.meta.url), "utf8"))),
      "D2.4 o instrumento ainda NÃO modela `!left` — é falso-vermelho conhecido, não vazamento (se alguém ensinar, esta linha avisa)");
  }
  // 5. UPSERT + .select(...) — projeta?
  {
    const { data } = await banco.cliente.from("atletas")
      .upsert({ id: "a1", nome: "Ana2", pin_hash: "SEGREDO" }, { onConflict: "id" }).select("id");
    console.log("      -> upsert().select('id') devolveu:", JSON.stringify(data));
    ok(Array.isArray(data) && data[0] && !("pin_hash" in data[0]),
      "D2.5 upsert().select() projeta como insert/update/delete");
  }
  // 6. `single()` engole o erro injetado por `recusar`
  {
    banco.recusar("atletas", "insert", { message: 'duplicate key value violates unique constraint "atletas_telefone_unique"', code: "23505" });
    const { error } = await banco.cliente.from("atletas").insert({ id: "z" }).select("id").single();
    igual(error?.code, "23505", "D2.6 single() devolve o erro que o banco recusou (e não PGRST116)");
  }
}

// ══════════════════════════════════════════════════════════════════════════
secao("D3 — anonimizar: ordem, escopo e o que sobrou");
const cenAnon = (extra = {}) => montarMotor({
  funcao: "anonimizar-atleta",
  circuitos: [circuito(BH, { regulamento_versao: "v03-13" }), circuito(OUTRO, { slug: "outro", sistema: "B", regulamento_versao: "vB-01" })],
  atletas: [atleta(X, { nome: "Joao Silva", exclusao_solicitada_em: "2026-09-20T10:00:00Z", pin_hash: "SEGREDO", bio_cred_ids: ["c1"] }),
            atleta(B1, { nome: "Maria" })],
  circuito_atletas: [
    { circuito_id: OUTRO, atleta_id: X, status: "ativo", aceite_regulamento: true },
    { circuito_id: BH, atleta_id: X, status: "ativo", aceite_regulamento: true },
    { circuito_id: OUTRO, atleta_id: B1, status: "ativo", aceite_regulamento: true },
  ],
  outras: {
    atleta_documento: [{ atleta_id: X, cpf_hash: "h1" }, { atleta_id: B1, cpf_hash: "h2" }],
    atleta_sessao: [{ id: "s1", atleta_id: X }, { id: "s2", atleta_id: B1 }],
    mensagens_enviadas: [
      { id: "m1", atleta_id: X, atleta_nome: "Joao Silva", texto: "Oi Joao Silva, sua rodada saiu" },
      { id: "m2", atleta_id: B1, atleta_nome: "Maria", texto: "Maria, voce joga contra Joao Silva" },
    ],
    solicitacoes_wo: [
      { id: "w1", atleta_id: X, atleta_nome: "Joao Silva", adversario_id: B1, adversario_nome: "Maria", justificativa: "estava internado com pneumonia", comprovante_url: "wo/atestado-joao.pdf" },
      { id: "w2", atleta_id: B1, atleta_nome: "Maria", adversario_id: X, adversario_nome: "Joao Silva", justificativa: "viagem", comprovante_url: null },
    ],
  },
  arquivos: { "fotos-atletas": [`${X}-111.jpg`, `${X}-222.jpg`, `${B1}-333.jpg`], "comprovantes-wo": ["atestado-joao.pdf"] },
  ...extra,
});
{
  const { banco, motor } = await cenAnon();
  const r = await motor.chamar({ pin: PIN, id: X });
  console.log("   anonimizar:", r.status, JSON.stringify(r.corpo));
  igual(banco.arquivosDe("fotos-atletas"), [`${B1}-333.jpg`], "D3.1 apaga as DUAS fotos dele e só as dele");
  igual(banco.linhas("atleta_documento").map(d => d.atleta_id), [B1], "D3.2 documento: só o dele");
  igual(banco.linhas("atleta_sessao").map(s => s.atleta_id), [B1], "D3.3 sessões: só as dele");
  igual(banco.acha("atletas", a => a.id === X)?.pin_hash, null, "D3.4 zera o pin_hash");
  igual(banco.acha("atletas", a => a.id === B1)?.nome, "Maria", "D3.5 não toca no outro atleta");
  // ⚠️ ESPERAVA `null` ATÉ 01/10/2026. A coluna `justificativa` é NOT NULL em
  // produção, e escrever `null` fazia a função ESTOURAR depois de já ter apagado a
  // foto, o documento e as sessões — respondendo "nada foi alterado", que era falso
  // desde o segundo passo. O motor foi consertado em 29/09 para gravar string vazia;
  // esta sonda ficou congelada no `null` e nunca foi re-rodada, porque vivia fora do
  // `npm run teste`. É o retrato do problema que trazê-la para cá resolve.
  igual(banco.acha("solicitacoes_wo", w => w.id === "w1")?.justificativa, "",
    "D3.6 apaga a justificativa (dado de saúde) — com STRING VAZIA, porque a coluna é NOT NULL");
  igual(banco.acha("solicitacoes_wo", w => w.id === "w2")?.adversario_nome, "Atleta removido", "D3.7 anonimiza onde ele é ADVERSÁRIO");
  igual(banco.acha("solicitacoes_wo", w => w.id === "w2")?.justificativa, "viagem", "D3.8 e não apaga a justificativa DO OUTRO");
  // O que sobra:
  const m2 = banco.acha("mensagens_enviadas", m => m.id === "m2");
  ok(!/Joao Silva/.test(String(m2?.texto)), "D3.9 o nome dele some também das mensagens em que ele é o ADVERSÁRIO");
  // ⚠️ O FIXTURE ESTAVA ERRADO, NÃO O MOTOR. A função deriva o nome com
  // `.split("/").pop()`, então para `comprovante_url = "wo/atestado-joao.pdf"` ela
  // apaga `"atestado-joao.pdf"`. O balde era semeado com o caminho inteiro, nada
  // casava, e a sonda acusava defeito inexistente. O Supervisor de Segurança
  // retificou isto por conta própria. E o motor já tem guarda que devolve 500 se o
  // número de removidos não casar — ela nasceu exatamente deste engano.
  ok(!banco.arquivosDe("comprovantes-wo").includes("atestado-joao.pdf"),
    "D3.10 o ARQUIVO do comprovante de W.O. (atestado) também é apagado do bucket");
}
{
  // A ordem: cada falha aborta ANTES de destruir a identidade e ANTES de tirar da fila.
  const passos = [
    ["fotos-atletas/remove", b => b.recusar("fotos-atletas", "remove", { message: "x" })],
    ["atleta_documento/delete", b => b.recusar("atleta_documento", "delete", { message: "x" })],
    ["atleta_sessao/delete", b => b.recusar("atleta_sessao", "delete", { message: "x" })],
    ["mensagens_enviadas/update", b => b.recusar("mensagens_enviadas", "update", { message: "x" })],
    ["solicitacoes_wo/update", b => b.recusar("solicitacoes_wo", "update", { message: "x" })],
    ["circuito_atletas/update", b => b.recusar("circuito_atletas", "update", { message: "x" })],
  ];
  for (const [nome, aplicar] of passos) {
    const { banco, motor } = await cenAnon();
    aplicar(banco);
    const r = await motor.chamar({ pin: PIN, id: X });
    const a = banco.acha("atletas", x => x.id === X);
    igual(r.corpo?.sucesso, false, `D3.11 falha em ${nome} => sucesso: false`);
    igual(a?.nome, "Joao Silva", `D3.12 e a identidade NÃO foi destruída (${nome})`);
    ok(!!a?.exclusao_solicitada_em, `D3.13 e o pedido CONTINUA na fila (${nome})`);
  }
}
{
  const { motor } = await cenAnon();
  const r = await motor.chamar({ pin: "9999", id: X });
  igual(r.status, 401, "D3.14 sem PIN não anonimiza");
}

// ══════════════════════════════════════════════════════════════════════════
secao("CANCELAR_EXCLUSAO — o par sem autenticação");
{
  const cenC = () => montarMotor({
    funcao: "athlete-action",
    circuitos: [circuito(BH, { regulamento_versao: "v03-13" })],
    atletas: [atleta(X, { exclusao_solicitada_em: "2026-09-20T10:00:00Z" }), atleta(B1)],
    circuito_atletas: [],
    outras: { atleta_sessao: [
      { id: "sX", atleta_id: X, token_hash: HASH_TOKEN_X, expira_em: "2099-01-01T00:00:00Z" },
      { id: "sB1", atleta_id: B1, token_hash: HASH_TOKEN_B1, expira_em: "2099-01-01T00:00:00Z" },
    ] },
  });
  {
    const { banco, motor } = await cenC();
    const r = await motor.chamar({ acao: "CANCELAR_EXCLUSAO", payload: { athleteId: X } });
    console.log("   CANCELAR_EXCLUSAO sem credencial nenhuma:", r.status, JSON.stringify(r.corpo));
    ok(banco.acha("atletas", a => a.id === X)?.exclusao_solicitada_em != null,
      "CX.1 um estranho NÃO consegue cancelar o pedido de exclusão de outra pessoa");
  }
  {
    const { banco, motor } = await cenC();
    const r = await motor.chamar({ acao: "SOLICITAR_EXCLUSAO", payload: { athleteId: B1 } });
    ok(banco.acha("atletas", a => a.id === B1)?.exclusao_solicitada_em == null,
      "CX.2 (pré-existente) um estranho NÃO consegue PEDIR exclusão em nome de outra pessoa");
  }
  {
    // Anonimizado não volta.
    const { banco, motor } = await montarMotor({
      funcao: "athlete-action",
      circuitos: [circuito(BH, { regulamento_versao: "v03-13" })],
      atletas: [atleta(X, { status: "arquivado", exclusao_solicitada_em: "2026-09-20T10:00:00Z" })],
      circuito_atletas: [],
      // ⚠️ `atleta_sessao` ERA `[]` E A SONDA NÃO MANDAVA TOKEN. O
      // `CANCELAR_EXCLUSAO` nasceu em 29/09 SEM autenticação nenhuma — qualquer um
      // cancelava o pedido de exclusão de qualquer pessoa — e ganhou a exigência de
      // token no mesmo dia. Desde então estas duas sondas recebiam 401 e nunca
      // chegavam ao 409 que elas existem para medir. Ficaram vermelhas sem ninguém
      // ver, porque viviam fora do `npm run teste`.
      outras: { atleta_sessao: [{ id: "sX", atleta_id: X, token_hash: HASH_TOKEN_X, expira_em: "2099-01-01T00:00:00Z" }] },
    });
    const semToken = await motor.chamar({ acao: "CANCELAR_EXCLUSAO", payload: { athleteId: X } });
    igual(semToken.status, 401,
      "CX.3a sem token NÃO cancela — a ação nasceu sem autenticação nenhuma e isso foi fechado em 29/09");
    const r = await motor.chamar({ acao: "CANCELAR_EXCLUSAO", payload: { athleteId: X, token: TOKEN_X } });
    igual(r.status, 409, "CX.3 quem já foi arquivado não cancela por aqui — AGORA com token válido");
  }
  {
    const { motor } = await cenC();
    const r = await motor.chamar({ acao: "CANCELAR_EXCLUSAO", payload: { athleteId: B1, token: TOKEN_B1 } });
    igual(r.status, 409, "CX.4 cancelar sem pedido pendente devolve 409 (não limpa campo de ninguém)");
  }
}

process.exit(placar("3ª RODADA — 5dfd7b6"));
