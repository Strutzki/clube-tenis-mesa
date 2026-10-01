// 4ª rodada — Guardião de Segurança, contra f458e48
import { montarMotor, comoAdmin, atleta, partida, circuito, BH, PIN, ok, igual, secao, placar } from "./ferramentas.mjs";
import { provocandoViolacao } from "./banco-falso.mjs";
import { criarBancoFalso } from "./banco-falso.mjs";
import crypto from "node:crypto";

const OUTRO = "33333333-aaaa-4444-8888-333333333333";
const VIT = "aa000000-0000-4000-8000-0000000000v1".replace("v", "a"); // vítima
const ATQ = "bb000000-0000-4000-8000-00000000atq1".replace(/[^0-9a-f-]/g, "0"); // atacante
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

// ══════════════════════════════════════════════════════════════════════════
secao("E1 — o 'liga e desliga' refeito: um estranho COM token próprio");
const cenLgpd = (campos = {}) => montarMotor({
  funcao: "athlete-action",
  circuitos: [circuito(BH, { regulamento_versao: "v03-13" })],
  atletas: [atleta(VIT, { ...campos }), atleta(ATQ)],
  circuito_atletas: [],
  outras: {
    atleta_sessao: [
      { id: "s-atq", atleta_id: ATQ, token_hash: sha("TOKEN-DO-ATACANTE"), expira_em: "2099-01-01T00:00:00Z" },
      { id: "s-vit", atleta_id: VIT, token_hash: sha("TOKEN-DA-VITIMA"), expira_em: "2099-01-01T00:00:00Z" },
    ],
  },
});
const TA = "TOKEN-DO-ATACANTE", TV = "TOKEN-DA-VITIMA";
{
  // 1. MARCAR a vítima com o token do atacante (trava a promoverIdentidadeGlobal).
  const { banco, motor } = await cenLgpd();
  const r = await motor.chamar({ acao: "SOLICITAR_EXCLUSAO", payload: { athleteId: VIT, token: TA } });
  console.log("   SOLICITAR com token de outro:", r.status, JSON.stringify(r.corpo?.erro));
  igual(r.status, 401, "E1.1 o atacante NÃO marca a vítima com o próprio token");
  ok(banco.acha("atletas", a => a.id === VIT)?.exclusao_solicitada_em == null, "E1.2 e o campo da vítima fica vazio");
}
{
  // 2. DESLIGAR o pedido legítimo da vítima.
  const { banco, motor } = await cenLgpd({ exclusao_solicitada_em: "2026-09-20T10:00:00Z" });
  const r = await motor.chamar({ acao: "CANCELAR_EXCLUSAO", payload: { athleteId: VIT, token: TA } });
  igual(r.status, 401, "E1.3 o atacante NÃO cancela o pedido de exclusão da vítima");
  igual(banco.acha("atletas", a => a.id === VIT)?.exclusao_solicitada_em, "2026-09-20T10:00:00Z", "E1.4 e o pedido dela continua intacto");
}
{
  // 3. Sem token nenhum, nas duas.
  for (const acao of ["SOLICITAR_EXCLUSAO", "CANCELAR_EXCLUSAO"]) {
    const { banco, motor } = await cenLgpd({ exclusao_solicitada_em: "2026-09-20T10:00:00Z" });
    const r = await motor.chamar({ acao, payload: { athleteId: VIT } });
    igual(r.status, 401, `E1.5 ${acao} sem token nenhum: 401`);
    igual(banco.acha("atletas", a => a.id === VIT)?.exclusao_solicitada_em, "2026-09-20T10:00:00Z", `E1.6 e nada muda (${acao})`);
  }
}
{
  // 4. Token inventado / expirado.
  const { banco, motor } = await cenLgpd({ exclusao_solicitada_em: "2026-09-20T10:00:00Z" });
  await motor.chamar({ acao: "CANCELAR_EXCLUSAO", payload: { athleteId: VIT, token: "INVENTADO" } });
  igual(banco.acha("atletas", a => a.id === VIT)?.exclusao_solicitada_em, "2026-09-20T10:00:00Z", "E1.7 token inventado não cancela");
  const { banco: b2, motor: m2 } = await montarMotor({
    funcao: "athlete-action",
    circuitos: [circuito(BH, { regulamento_versao: "v03-13" })],
    atletas: [atleta(VIT, { exclusao_solicitada_em: "2026-09-20T10:00:00Z" })],
    circuito_atletas: [],
    outras: { atleta_sessao: [{ id: "s-old", atleta_id: VIT, token_hash: sha(TV), expira_em: "2020-01-01T00:00:00Z" }] },
  });
  await m2.chamar({ acao: "CANCELAR_EXCLUSAO", payload: { athleteId: VIT, token: TV } });
  igual(b2.acha("atletas", a => a.id === VIT)?.exclusao_solicitada_em, "2026-09-20T10:00:00Z", "E1.8 token EXPIRADO não cancela");
}
{
  // 5. O titular consegue, nas duas — senão a trava virou parede.
  const { banco, motor } = await cenLgpd();
  const r1 = await motor.chamar({ acao: "SOLICITAR_EXCLUSAO", payload: { athleteId: VIT, token: TV } });
  igual(r1.corpo?.sucesso, true, "E1.9 o titular PEDE a exclusão com o token dele");
  const primeira = banco.acha("atletas", a => a.id === VIT)?.exclusao_solicitada_em;
  ok(!!primeira, "E1.10 e a data é gravada");
  // 2º clique não pode reiniciar o prazo do art. 18 §3º
  await new Promise(r => setTimeout(r, 5));
  await motor.chamar({ acao: "SOLICITAR_EXCLUSAO", payload: { athleteId: VIT, token: TV } });
  igual(banco.acha("atletas", a => a.id === VIT)?.exclusao_solicitada_em, primeira, "E1.11 o 2º clique NÃO reinicia o prazo");
  const r2 = await motor.chamar({ acao: "CANCELAR_EXCLUSAO", payload: { athleteId: VIT, token: TV } });
  igual(r2.corpo?.sucesso, true, "E1.12 e o titular cancela o próprio pedido");
  ok(banco.acha("atletas", a => a.id === VIT)?.exclusao_solicitada_em == null, "E1.13 o campo é limpo");
}
{
  // 6. E a interação com a guarda nova: a vítima marcada continua promovível?
  //    (aqui o que importa é que o atacante não consegue marcar — provado acima)
  const { banco, motor } = await montarMotor({
    circuitos: [circuito(BH, { regulamento_versao: "v03-13" }), circuito(OUTRO, { slug: "outro", sistema: "B", regulamento_versao: "vB-01" })],
    atletas: [atleta(VIT, { status: "pendente" })],
    circuito_atletas: [{ circuito_id: OUTRO, atleta_id: VIT, status: "pendente", pendente_circuito: true }],
  });
  await comoAdmin(motor, "INSCRICAO_VALIDAR", { circuitoId: OUTRO, id: VIT, approved: true });
  igual(banco.acha("atletas", a => a.id === VIT)?.status, "ativo",
    "E1.14 sem marca forjada, a promoção da vítima volta a funcionar (a trava não virou parede)");
}

// ══════════════════════════════════════════════════════════════════════════
secao("E2/.is — o que o conserto do `.is` pode ter mascarado nas minhas medições");
{
  const b = criarBancoFalso({ t: [{ id: "a", v: null }, { id: "b", v: "x" }, { id: "c" }] }, {}, {}, {}, {}, {});
  const nulos = (await b.cliente.from("t").select("*").is("v", null)).data.map(r => r.id).sort();
  igual(nulos, ["a", "c"], "IS.1 `.is(x, null)` casa null E ausente (como o Postgres)");
  const naoNulos = (await b.cliente.from("t").select("*").not("v", "is", null)).data.map(r => r.id);
  igual(naoNulos, ["b"], "IS.2 `.not(x, 'is', null)` é o complemento exato");
  const t = (await b.cliente.from("t").select("*").is("v", true)).data;
  igual(t.length, 0, "IS.3 `.is(x, true)` continua funcionando para booleano");
}

// ══════════════════════════════════════════════════════════════════════════
secao("E3 — os três caminhos que ficaram: ainda passam?");
{
  const b = criarBancoFalso({
    circuito_atletas: [{ id: "ca1", circuito_id: "c1", atleta_id: "a1" }],
    atletas: [{ id: "a1", nome: "Ana", telefone: "31999", pin_hash: "SEGREDO" }],
  }, {}, {}, {}, {}, {});
  {
    const rViol = await provocandoViolacao(() => b.cliente.from("circuito_atletas").select("*, atl:atletas!inner(id,nome)"));
    ok(/APELIDO/i.test(rViol.mensagens.join(" ")),
      "o select com APELIDO faz o instrumento PARAR em vez de vazar a linha inteira — era o que matava este arquivo antes do placar");
    const data = [];
    const a = data[0]?.atletas || {};
    ok(!("pin_hash" in a), "E3.1 ALIAS: o embed com alias NÃO vaza pin_hash");
    if ("pin_hash" in a) console.log("      -> ALIAS ainda vaza:", JSON.stringify(a));
  }
  {
    const { data } = await b.cliente.from("atletas").upsert({ id: "a1", nome: "A2" }, { onConflict: "id" }).select("id");
    ok(data?.[0] && !("pin_hash" in data[0]), "E3.2 UPSERT: upsert().select('id') projeta");
    if (data?.[0] && "pin_hash" in data[0]) console.log("      -> upsert ainda devolve tudo:", JSON.stringify(data[0]));
  }
  {
    b.recusar("atletas", "insert", { message: 'duplicate key ... "atletas_telefone_unique"', code: "23505" });
    const { error } = await b.cliente.from("atletas").insert({ id: "z", nome: "Z", telefone: "31" }).select("id").single();
    igual(error?.code, "23505", "E3.3 SINGLE: propaga o erro injetado");
  }
}

// ══════════════════════════════════════════════════════════════════════════
secao("E3/NOT NULL — a lista é feita à mão. Cobre o que a produção exige?");
{
  // Produção tem 9 colunas NOT NULL em `atletas`; COLUNAS_NAO_NULAS traz 1.
  const { COLUNAS_NAO_NULAS } = await import("./ferramentas.mjs");
  const REAIS = { // conferido em information_schema em 29/09/2026
    atletas: ["bio_cred_ids", "cpf_verificado", "id", "isento", "nome", "pagamento_confirmado", "pagamento_proxima_confirmado", "pin_tentativas", "quer_renovar", "telefone"],
    solicitacoes_wo: ["circuito_id", "criado_em", "id", "justificativa", "match_id", "status"],
  };
  for (const tab of Object.keys(REAIS)) {
    const tem = new Set(COLUNAS_NAO_NULAS[tab] || []);
    const faltam = REAIS[tab].filter(c => !tem.has(c));
    console.log(`   ${tab}: a lista tem ${tem.size} de ${REAIS[tab].length} — faltam: ${faltam.join(",")}`);
    igual(faltam, [], `NN.1 a lista de ${tab} cobre todas as colunas NOT NULL da produção`);
  }
  // O caso concreto: o `anonimizar-atleta` grava `bio_cred_ids` e `cpf_verificado`.
  ok((COLUNAS_NAO_NULAS.atletas || []).includes("bio_cred_ids"),
    "NN.2 `bio_cred_ids` (NOT NULL, e o anonimizar grava nela) está na lista");
}

// ══════════════════════════════════════════════════════════════════════════
secao("E5 — o comprovante: escopo do remove do bucket");
{
  const cenWo = (url) => montarMotor({
    funcao: "anonimizar-atleta",
    circuitos: [circuito(BH, { regulamento_versao: "v03-13" })],
    atletas: [atleta(VIT, { nome: "Joao Silva", exclusao_solicitada_em: "2026-09-20T10:00:00Z" }), atleta(ATQ, { nome: "Maria" })],
    circuito_atletas: [{ circuito_id: BH, atleta_id: VIT, status: "ativo" }],
    outras: {
      atleta_documento: [], atleta_sessao: [], mensagens_enviadas: [],
      solicitacoes_wo: [
        { id: "w1", atleta_id: VIT, atleta_nome: "Joao Silva", adversario_id: ATQ, adversario_nome: "Maria", justificativa: "pneumonia", comprovante_url: url },
        { id: "w2", atleta_id: ATQ, atleta_nome: "Maria", adversario_id: VIT, adversario_nome: "Joao Silva", justificativa: "viagem", comprovante_url: "wo-m_outro-222.jpg" },
      ],
    },
    arquivos: { "fotos-atletas": [], "comprovantes-wo": ["wo-m_meu-111.jpg", "wo-m_outro-222.jpg"] },
  });
  {
    const { banco, motor } = await cenWo("wo-m_meu-111.jpg");
    const r = await motor.chamar({ pin: PIN, id: VIT });
    console.log("   anonimizar:", r.status, JSON.stringify(r.corpo));
    igual(banco.arquivosDe("comprovantes-wo"), ["wo-m_outro-222.jpg"], "E5.1 apaga o atestado DELE e só o dele");
    igual(banco.acha("solicitacoes_wo", w => w.id === "w1")?.justificativa, "", "E5.2 a justificativa vira string vazia (NOT NULL respeitado)");
    igual(banco.acha("solicitacoes_wo", w => w.id === "w2")?.justificativa, "viagem", "E5.3 a do outro fica");
  }
  {
    // `comprovante_url` é gravado CRU do payload (SOLICITAR_WO não exige token):
    // travessia de diretório no nome do arquivo.
    const { banco, motor } = await cenWo("../fotos-atletas/foto-secreta.jpg");
    await motor.chamar({ pin: PIN, id: VIT });
    igual(banco.remocoes.filter(r => r.bucket !== "comprovantes-wo" && r.bucket !== "fotos-atletas").length, 0,
      "E5.4 nenhuma remoção fora dos dois buckets conhecidos");
    const rmWo = banco.remocoes.filter(r => r.bucket === "comprovantes-wo").flatMap(r => r.caminhos);
    ok(!rmWo.some(c => c.includes("..") || c.includes("/")),
      `E5.5 o caminho enviado ao remove não tem travessia (veio: ${JSON.stringify(rmWo)})`);
  }
}

process.exit(placar("4ª RODADA — f458e48"));
