// Bateria — PARTICIPAR DE OUTRO CIRCUITO, com ciência do regulamento.
//
// Decisão do Juliano, 27/09/2026: "quero que o atleta tenha ciência do
// regulamento do tipo de circuito que ele vai participar".
//
// O contexto que tornou isto urgente: ele vai criar um SEGUNDO circuito, de
// PONTOS, enquanto o BH é de RATING. Um atleta do BH que entrasse no circuito
// novo pelo fluxo "Participar de outro circuito" era gravado com
// `aceite_regulamento: true` e a versão certa do circuito — mas o fluxo tinha
// três telas (identificação, CPF, pronto) e NENHUMA mencionava regulamento.
// Recibo de consentimento apontando para um texto que o atleta nunca abriu, e
// de um sistema cujas regras são outras: pontuação, pareamento, encerramento.
//
// E a rede do re-aceite NÃO pegava: a versão gravada já era a do circuito, então
// não havia divergência para o app detectar. O conserto tinha de ser aqui.
//
// ESTE ARQUIVO É O PRIMEIRO A EXECUTAR O `login-atleta` DE VERDADE. Até
// 27/09/2026 essa função só tinha checagem por regex no texto fonte — e o
// CLAUDE.md registra que regex fica verde com a regra quebrada.

import {
  montarMotor, pinGuardado, atleta, circuito, ok, igual, secao, placar, BH,
} from "./ferramentas.mjs";

const CIRC = "88888888-8888-8888-8888-888888888888";
const ATL = "aaaa0001-0000-4000-8000-0000000000a1";
const TEL = "31966665555";
const PIN = "1357";
const VERSAO_B = "vB-01";

// CPFs com dígito verificador válido — o servidor revalida, então não dá para
// inventar. Gerados pelo algoritmo da Receita.
const CPF_OK = "52998224725";
const CPF_RESP = "11144477735";

// O `login-atleta` chama estas funções do banco. O banco em memória as serve.
const FUNCOES_DO_BANCO = {
  get_cpf_pepper: () => "pimenta-de-teste",
  // Sem duplicata em nenhum cenário deste arquivo: o CPF é novo.
  dedup_por_cpf_hash: () => [{ existe: false, atleta_id: null }],
};

async function cenario(campos = {}) {
  const hash = await pinGuardado(PIN);
  return montarMotor({
    funcao: "login-atleta",
    circuitos: [
      circuito(BH),
      circuito(CIRC, { slug: "sp", sistema: "B", regulamento_versao: VERSAO_B,
                       inscricoes_abertas: true, ativo: true, ...campos }),
    ],
    atletas: [atleta(ATL, { nome: "Atleta do BH", telefone: TEL, pin_hash: hash, rating: 720 })],
    circuito_atletas: [{
      id: "ca-bh", circuito_id: BH, atleta_id: ATL,
      status: "ativo", pendente_circuito: false, saldo_temp: 0, vitorias: 0, derrotas: 0,
    }],
    funcoes: FUNCOES_DO_BANCO,
    outras: { atleta_documento: [] },
  });
}

// Pedido completo e correto. Cada teste tira UMA peça.
function pedido(extra = {}) {
  return {
    acao: "PARTICIPAR", telefone: TEL, pin: PIN, circuitoId: CIRC,
    aceiteRegulamento: true, versaoRegulamento: VERSAO_B,
    cpf: CPF_OK, cpfConsent: true, cpfConsentVersao: "cpf-2026-08-v1",
    dataNascimento: "1990-05-10",
    ...extra,
  };
}

secao("Sem aceite declarado, não entra — e nada é gravado");
{
  const { motor, banco } = await cenario();
  const r = await motor.chamar(pedido({ aceiteRegulamento: undefined }));
  igual(r.status, 400, "participar sem declarar o aceite do regulamento é recusado");
  igual(r.corpo?.erro, "aceite_regulamento_obrigatorio", "e diz exatamente o que falta");
  igual(banco.linhas("circuito_atletas").filter(l => l.circuito_id === CIRC).length, 0,
    "nenhum vínculo criado");
  igual(banco.linhas("atleta_documento").length, 0,
    "e nenhum dado pessoal gravado — a recusa vem antes do CPF");
}
{
  const { motor } = await cenario();
  const r = await motor.chamar(pedido({ aceiteRegulamento: "sim" }));
  igual(r.status, 400, "e 'aceite' que não é exatamente true também é recusado");
}

secao("O atleta declara QUAL versão aceitou, e ela tem de ser a do circuito");
{
  const { motor, banco } = await cenario();
  const r = await motor.chamar(pedido({ versaoRegulamento: "v03-12" }));
  igual(r.status, 409, "declarar a versão do OUTRO circuito (a de rating) é recusado");
  igual(r.corpo?.erro, "versao_regulamento_divergente", "com o erro que a tela sabe traduzir");
  igual(banco.linhas("circuito_atletas").filter(l => l.circuito_id === CIRC).length, 0, "e nada é gravado");
}
{
  const { motor } = await cenario();
  const r = await motor.chamar(pedido({ versaoRegulamento: "" }));
  igual(r.status, 400, "declarar versão vazia é recusado");
}
{
  // O carimbo trocou enquanto o atleta lia: a versão declarada ficou velha.
  const { motor } = await cenario({ regulamento_versao: "vB-02" });
  const r = await motor.chamar(pedido());
  igual(r.status, 409, "se o carimbo mudar no meio do caminho, a participação é recusada");
}
{
  const { motor } = await cenario({ regulamento_versao: null });
  const r = await motor.chamar(pedido());
  igual(r.status, 409, "circuito sem regulamento carimbado não aceita ninguém");
  igual(r.corpo?.erro, "versao_regulamento_indisponivel", "e diz por quê");
}

secao("Com o aceite certo, entra — reusando o cadastro, sem tocar no rating");
{
  const { motor, banco } = await cenario();
  const r = await motor.chamar(pedido());
  igual(r.status, 200, "o atleta do BH entra no circuito de pontos");
  const vinc = banco.acha("circuito_atletas", (l) => l.circuito_id === CIRC && l.atleta_id === ATL);
  ok(!!vinc, "o vínculo foi criado");
  igual(vinc.versao_regulamento, VERSAO_B, "com a versão que ele declarou ter aceitado");
  igual(vinc.aceite_regulamento, true, "e o aceite registrado");
  igual(vinc.pendente_circuito, true, "entra na fila, aguardando o admin incluir");
  igual(vinc.saldo_temp, 0, "zerado no circuito novo");
  // O que mais importa: a identidade nacional não é tocada.
  igual(banco.linhas("atletas").length, 1, "NÃO cria atleta novo");
  igual(banco.acha("atletas", (a) => a.id === ATL).rating, 720, "e o rating do BH fica intacto");
  igual(banco.linhas("circuito_atletas").filter(l => l.circuito_id === BH).length, 1,
    "a participação no BH continua lá");
}
{
  const { motor } = await cenario();
  const p = pedido();
  igual((await motor.chamar(p)).status, 200, "primeira vez: entra");
  const r2 = await motor.chamar(p);
  igual(r2.status, 409, "segunda vez: recusa");
  igual(r2.corpo?.erro, "ja_participa", "dizendo que ele já está no circuito");
}
{
  const { motor } = await cenario();
  const r = await motor.chamar(pedido({ circuitoId: BH }));
  igual(r.status, 400, "e o BH não entra por aqui — lá o cadastro é direto");
}

secao("Menor de 18 não entra sem responsável legal, nem por fora da tela");
{
  // A tela desabilita o botão; mas a tela não é o portão. Antes de 27/09/2026 o
  // servidor aceitava um menor sem responsável se o pedido viesse sem os campos.
  const menor = new Date();
  menor.setFullYear(menor.getFullYear() - 15);
  const nascMenor = menor.toISOString().slice(0, 10);

  const { motor, banco } = await cenario();
  const r = await motor.chamar(pedido({ dataNascimento: nascMenor }));
  igual(r.status, 400, "menor sem responsável é recusado pelo SERVIDOR");
  igual(r.corpo?.erro, "responsavel_obrigatorio", "com o erro próprio");
  igual(banco.linhas("atleta_documento").length, 0, "e o documento não é gravado");
  igual(banco.linhas("circuito_atletas").filter(l => l.circuito_id === CIRC).length, 0, "nem o vínculo");

  const { motor: m2 } = await cenario();
  const soNome = await m2.chamar(pedido({ dataNascimento: nascMenor, responsavelNome: "Mãe do atleta" }));
  igual(soNome.status, 400, "só o nome do responsável não basta — falta o CPF dele");

  const { motor: m3 } = await cenario();
  const soCpf = await m3.chamar(pedido({ dataNascimento: nascMenor, responsavelCpf: CPF_RESP }));
  igual(soCpf.status, 400, "e só o CPF não basta — falta o nome");

  const { motor: m4, banco: b4 } = await cenario();
  const completo = await m4.chamar(pedido({
    dataNascimento: nascMenor, responsavelNome: "Mãe do atleta", responsavelCpf: CPF_RESP,
  }));
  igual(completo.status, 200, "com nome e CPF do responsável, o menor entra");
  const doc = b4.acha("atleta_documento", (d) => d.atleta_id === ATL);
  ok(!!doc, "o documento foi gravado");
  igual(doc.responsavel_nome, "Mãe do atleta", "com o nome do responsável");
  ok(!!doc.responsavel_cpf_hash, "e o CPF do responsável guardado como hash, nunca em claro");
  ok(!String(JSON.stringify(doc)).includes(CPF_RESP), "o CPF do responsável NÃO aparece em claro na linha");
  ok(!String(JSON.stringify(doc)).includes(CPF_OK), "nem o CPF do atleta");
}
{
  // Maior de idade segue sem precisar de responsável.
  const { motor } = await cenario();
  const r = await motor.chamar(pedido({ dataNascimento: "1990-05-10" }));
  igual(r.status, 200, "maior de 18 entra sem responsável");
}

secao("E a tela do atleta oferece o regulamento antes do PIN");
{
  // ⚠️ SÃO CHECAGENS POR REGEX no fonte do app, não comportamento: o CLAUDE.md
  // registra que regex fica verde com a regra quebrada. Elas valem só porque o
  // que está sendo afirmado é "este trecho existe" — o portão de verdade é o
  // servidor, e as 38 asserções acima o exercitam rodando.
  const { readFileSync } = await import("node:fs");
  const fonte = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const i = fonte.indexOf("function ParticiparFlow");
  ok(i > 0, "o fluxo de participar existe no app");
  // Janela = a FUNÇÃO inteira, do início até a próxima declaração de topo. Um
  // número fixo de caracteres já deixou esta asserção mirar curto: a condição do
  // botão estava 9.524 caracteres adentro e a janela era de 9.000.
  const fim = fonte.indexOf("\nfunction ", i + 10);
  const bloco = fonte.slice(i, fim > i ? fim : fonte.length);

  ok(/setVerReg\(true\)/.test(bloco) && /<RegulamentoView/.test(bloco),
    "o fluxo abre o regulamento do circuito ALVO (antes ele não mencionava regulamento)");
  ok(/sistema=\{sistemaCirc\}/.test(bloco),
    "e com o SISTEMA do circuito alvo — senão mostraria as regras do circuito errado");
  ok(/aceiteRegulamento:\s*true,\s*versaoRegulamento:\s*versaoReg/.test(bloco),
    "o pedido declara o aceite e a versão que o atleta viu");
  ok(/semVersao\s*\|\|\s*!aceiteReg/.test(bloco),
    "e o botão fica travado sem o aceite, e também se o circuito não tiver versão");
  ok(/const semVersao = !versaoReg/.test(bloco),
    "fail-closed na tela também: sem versão, ninguém confirma");
}

process.exit(placar("Participar de outro circuito"));
