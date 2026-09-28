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
      // O fixture do BH ESPELHA a produção (`inscricoes_abertas: true`,
      // `regulamento_versao: "v03-12"`). Sem isso, sabotar a guarda do BH deixava a
      // bateria verde: a chamada morria em `inscricoes_fechadas`, e não no
      // `bh_cadastro_direto` que é a guarda de verdade. Pego pelo Guardião de
      // Segurança — é a única linha entre este fluxo e o circuito de produção.
      circuito(BH, { inscricoes_abertas: true, regulamento_versao: "v03-12" }),
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
  igual(r.corpo?.erro, "bh_cadastro_direto",
    "e pelo motivo CERTO: a guarda do BH, não um efeito colateral de inscrições fechadas");
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
{
  // A FRONTEIRA. Os fixtures acima são 15 e 36 anos — nenhum encosta nos 18, e o
  // Guardião de Confiabilidade provou que trocar `idade < 18` por `idade < 17`
  // deixava a bateria VERDE. O jovem de 17 é o caso real mais provável.
  const menosUmDia = (anos) => {
    const d = new Date(); d.setFullYear(d.getFullYear() - anos); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  };
  const maisUmDia = (anos) => {
    const d = new Date(); d.setFullYear(d.getFullYear() - anos); d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  };
  const { motor } = await cenario();
  const dezessete = await motor.chamar(pedido({ dataNascimento: menosUmDia(18) }));
  igual(dezessete.status, 400, "faltando UM DIA para 18, ainda é menor: recusa sem responsável");
  igual(dezessete.corpo?.erro, "responsavel_obrigatorio", "com o erro do responsável");

  const { motor: m2 } = await cenario();
  const dezoito = await m2.chamar(pedido({ dataNascimento: maisUmDia(18) }));
  igual(dezoito.status, 200, "e um dia DEPOIS de completar 18, entra sem responsável");
}
{
  // O buraco FAIL-OPEN que o Guardião Jurídico provou rodando: a guarda inteira
  // vivia dentro de `if (nasc)`, então bastava OMITIR a data para nenhuma
  // checagem acontecer — o documento era gravado com `data_nascimento: null` e o
  // menor entrava. E quem se beneficia de omitir a idade é o próprio menor, que
  // tem o PIN na mão: é o titular contornando a proteção que existe para ele.
  const { motor, banco } = await cenario();
  const r = await motor.chamar(pedido({ dataNascimento: undefined }));
  igual(r.status, 400, "OMITIR a data de nascimento é recusado — não é mais caminho livre");
  igual(r.corpo?.erro, "data_nascimento_obrigatoria", "com erro próprio");
  igual(banco.linhas("atleta_documento").length, 0, "e nada de dado pessoal gravado");
  igual(banco.linhas("circuito_atletas").filter(l => l.circuito_id === CIRC).length, 0, "nem vínculo");

  const { motor: m2 } = await cenario();
  const vazia = await m2.chamar(pedido({ dataNascimento: "" }));
  igual(vazia.status, 400, "data vazia também");
}
{
  // Data ABSURDA também é recusa. A mutação desta linha ficava VERDE — a regra
  // estava certa no código e desprotegida na bateria. E ela é a guarda contra o
  // PRÓXIMO movimento: com a data obrigatória, quem quer entrar sem responsável
  // passa a mentir. Data plausível é indetectável; data absurda é pega aqui.
  const { motor, banco } = await cenario();
  const antiga = await motor.chamar(pedido({ dataNascimento: "1850-01-01" }));
  igual(antiga.status, 400, "data absurda no passado é recusada");
  igual(antiga.corpo?.erro, "data_nascimento_invalida", "com erro próprio");

  const { motor: m2, banco: b2 } = await cenario();
  const futura = await m2.chamar(pedido({ dataNascimento: "2030-01-01" }));
  igual(futura.status, 400, "e data no futuro também");
  igual(futura.corpo?.erro, "data_nascimento_invalida", "idem");
  igual(b2.linhas("atleta_documento").length, 0, "e nada é gravado em nenhum dos dois");
  igual(banco.linhas("atleta_documento").length, 0, "nem no primeiro");
}
{
  // O 2º buraco: quem JÁ TEM documento não passava pelo backfill, então a idade
  // dele nunca era conferida. Agora é lida do arquivo.
  const hash = await pinGuardado(PIN);
  const nascMenor = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 15); return d.toISOString().slice(0, 10); })();
  async function comDocumento(docExtra) {
    return montarMotor({
      funcao: "login-atleta",
      circuitos: [circuito(BH, { inscricoes_abertas: true, regulamento_versao: "v03-12" }),
                  circuito(CIRC, { slug: "sp", sistema: "B", regulamento_versao: VERSAO_B, inscricoes_abertas: true, ativo: true })],
      atletas: [atleta(ATL, { nome: "Atleta do BH", telefone: TEL, pin_hash: hash, rating: 720 })],
      circuito_atletas: [{ id: "ca-bh", circuito_id: BH, atleta_id: ATL, status: "ativo", pendente_circuito: false, saldo_temp: 0, vitorias: 0, derrotas: 0 }],
      funcoes: FUNCOES_DO_BANCO,
      outras: { atleta_documento: [{ atleta_id: ATL, cpf_hash: "ja-tem", data_nascimento: nascMenor, ...docExtra }] },
    });
  }
  async function comDocumentoSemData() {
    return montarMotor({
      funcao: "login-atleta",
      circuitos: [circuito(BH, { inscricoes_abertas: true, regulamento_versao: "v03-12" }),
                  circuito(CIRC, { slug: "sp", sistema: "B", regulamento_versao: VERSAO_B, inscricoes_abertas: true, ativo: true })],
      atletas: [atleta(ATL, { nome: "Atleta do BH", telefone: TEL, pin_hash: hash, rating: 720 })],
      circuito_atletas: [{ id: "ca-bh", circuito_id: BH, atleta_id: ATL, status: "ativo", pendente_circuito: false, saldo_temp: 0, vitorias: 0, derrotas: 0 }],
      funcoes: FUNCOES_DO_BANCO,
      outras: { atleta_documento: [{ atleta_id: ATL, cpf_hash: "ja-tem", data_nascimento: null, responsavel_nome: null, responsavel_cpf_hash: null }] },
    });
  }
  const { motor, banco } = await comDocumento({ responsavel_nome: null, responsavel_cpf_hash: null });
  const r = await motor.chamar(pedido());
  igual(r.status, 400, "menor com documento SEM responsável no arquivo é recusado");
  igual(r.corpo?.erro, "responsavel_obrigatorio", "com o mesmo erro");
  igual(banco.linhas("circuito_atletas").filter(l => l.circuito_id === CIRC).length, 0, "e sem vínculo");

  const { motor: m2 } = await comDocumento({ responsavel_nome: "Mãe do atleta", responsavel_cpf_hash: "hash-do-resp" });
  const ok2 = await m2.chamar(pedido());
  igual(ok2.status, 200, "com responsável no arquivo, o menor entra");

  // ── A RESSALVA DELIBERADA, fixada em asserção a pedido do Guardião Jurídico ──
  // Documento com `data_nascimento` NULA passa. É intencional, não esquecimento, e
  // o motivo é da TELA: o `ParticiparFlow` tem duas fases e só coleta a data se o
  // servidor pedir CPF. Quem já tem documento nunca chega a essa fase — então não
  // existe passo onde ele possa informar a data. Recusar ali produziria um 400 que
  // o atleta não tem como resolver sozinho: beco sem saída, não incômodo.
  // A única origem de documento sem data é o `INSCREVER`, que não tem guarda de
  // menor nenhuma (ROADMAP 0.6.24) — e para o menor que passou por lá a violação
  // já aconteceu na porta da frente; fechar aqui não o protege, só o impede de
  // entrar no 2º circuito.
  // QUANDO O 0.6.24 FECHAR, esta asserção fica vermelha de propósito: é o sinal de
  // que a ressalva morreu. Não "conserte" — apague, e troque pela recusa.
  const { motor: m3 } = await comDocumentoSemData();
  const semData = await m3.chamar(pedido());
  igual(semData.status, 200,
    "documento com data de nascimento NULA passa — deliberado, ver ROADMAP 0.6.24");
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
  ok(/aceiteRegulamento:\s*aceiteReg,\s*versaoRegulamento:\s*versaoReg/.test(bloco),
    "o pedido declara o aceite e a versão que o atleta viu");
  ok(!/aceiteRegulamento:\s*true/.test(bloco),
    "e o aceite NÃO é cravado como true no cliente — é a mesma classe do defeito que esta fatia consertou");
  ok(/bloqueado\s*\|\|\s*!aceiteReg/.test(bloco),
    "o botão fica travado sem o aceite, e também se faltar a versão OU o sistema");
  ok(/const bloqueado = semVersao \|\| semSistema/.test(bloco),
    "e 'bloqueado' cobre as duas ignorâncias: sem texto e sem sistema");
  ok(/sistemaBruto === "B" \? "B" : \(sistemaBruto === "A" \? "A" : null\)/.test(bloco),
    "o sistema é FAIL-CLOSED: ausente vira null, nunca o padrão 'A' (que mostraria rating num circuito de pontos)");
  ok(/const semVersao = !versaoReg/.test(bloco),
    "fail-closed na tela também: sem versão, ninguém confirma");

  // ⚠️ ESTA É A ASSERÇÃO QUE FALTAVA, e a lição vale mais que ela. As checagens
  // acima recortam o CORPO da função — e o defeito mais grave desta fatia estava
  // num PONTO DE CHAMADA, 300 linhas adiante, fora da janela: o segundo caminho
  // (`InscricaoForm` → `modoParticipar`) não passava `circ`, então o cartão nascia
  // bloqueado acusando o organizador, e o sistema cairia no padrão "rating".
  // Dois guardiões provaram, independentemente, que tirar `circ=` da chamada que
  // funciona deixava a bateria INTEIRA verde.
  // Padrão novo: quando uma prop é o que faz a tela funcionar, conte os pontos de
  // chamada e exija a prop em TODOS.
  const chamadas = fonte.match(/<ParticiparFlow[\s\S]*?\/>/g) || [];
  ok(chamadas.length >= 2, `o fluxo é invocado de ${chamadas.length} lugares (esperado ao menos 2)`);
  const semCirc = chamadas.filter((c) => !/\bcirc=/.test(c));
  igual(semCirc.length, 0, "TODA invocação de <ParticiparFlow> passa `circ=` — sem ele a tela não sabe qual regulamento mostrar");
  // A chamada que monta o `circ` INLINE é a que pode perder o sistema — a outra
  // passa o objeto do RPC, que já traz a coluna. Então a cobrança é sobre essa.
  const inline = chamadas.filter((c) => /circ=\{\{/.test(c));
  igual(inline.filter((c) => !/sistema/.test(c)).length, 0,
    "a invocação que monta o circuito inline leva o sistema explicitamente");

  // E a coluna que sustenta tudo isso: se `sistema` sair do select, a tela passa a
  // mostrar o regulamento errado sem uma única asserção vermelha.
  ok(/getCircuitosAbertos:[\s\S]{0,240}?sistema/.test(fonte),
    "a leitura dos circuitos abertos inclui a coluna `sistema`");
  ok(/getVersoesRegulamento:[\s\S]{0,160}?regulamento_versao/.test(fonte),
    "e existe a leitura que traz a versão do regulamento por circuito");
}

secao("Em circuito de PONTOS, nenhuma tela do atleta mostra RATING");
{
  // Mesmo padrão da asserção acima, um nível acima: em vez de contar pontos de
  // chamada, conta os lugares que rotulam um número como "Rating" PARA O ATLETA e
  // exige a ramificação por sistema em todos.
  //
  // Por que isto existe: o regulamento de pontos (`vB-01`) diz QUATRO vezes que
  // "não há rating", e a tela mostrava "RATING <número do outro circuito>" — em
  // três lugares. Eu consertei dois e deixei passar justamente o pior: a tela de
  // ATERRISSAGEM, a primeira que o atleta vê ao entrar, colada numa caixa
  // "PONTOS". A Experiência do Atleta pegou, e pediu esta asserção porque
  // **nenhum** dos consertos estava protegido — foi assim que o terceiro lugar
  // chegou até ali.
  const { readFileSync } = await import("node:fs");
  const fonte = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

  // (a) o rótulo em maiúsculo da tela de aterrissagem
  const maiusculos = [...fonte.matchAll(/>RATING<\/div>/g)];
  ok(maiusculos.length > 0, `o rótulo RATING existe na tela (${maiusculos.length} lugar(es))`);
  const desprotegidos = maiusculos.filter((m) => {
    const antes = fonte.slice(Math.max(0, m.index - 900), m.index);
    return !/SISTEMA_ATIVO\s*!==\s*"B"/.test(antes) && !/SISTEMA_ATIVO\s*===\s*"B"/.test(antes);
  });
  igual(desprotegidos.length, 0,
    "TODO rótulo RATING da tela do atleta está dentro de uma ramificação por sistema");

  // (b) os três lugares nomeados, cada um com a sua ramificação
  ok(/SISTEMA_ATIVO !== "B" && \([\s\S]{0,400}?>RATING<\/div>/.test(fonte),
    "a caixa RATING da tela de aterrissagem SAI em circuito de pontos");
  ok(/SISTEMA_ATIVO === "B" \? \(eu\.saldoTemp \|\| 0\) : eu\.rating/.test(fonte),
    "no perfil, a caixa mostra pontos em circuito de pontos");
  ok(/SISTEMA_ATIVO === "B"[\s\S]{0,200}?saldoTemp \|\| 0\} pts/.test(fonte),
    "e no ranking, a linha mostra pts em vez de Rating");
  ok(/SISTEMA_ATIVO === "B" \? \(saldo \?\? 0\) : rating/.test(fonte),
    "e o cartão que o atleta COMPARTILHA também — esse sai do app, vai para o WhatsApp");

  // (c) e a prop que o cartão precisa para isso não pode desaparecer: sem ela,
  // `saldo` é ReferenceError e a tela QUEBRA em circuito de pontos. Foi um erro
  // meu nesta mesma fatia — o build não avisa, porque é JavaScript.
  ok(/function AtletaCard\(\{[^}]*\bsaldo\b/.test(fonte),
    "o AtletaCard declara a prop `saldo` (sem ela, a tela quebra em circuito de pontos)");
  ok(/saldo=\{athlete\.saldoTemp/.test(fonte),
    "e quem o invoca passa essa prop");

  // As exibições de rating do painel do ADMIN ficam de fora de propósito: são
  // outra plateia e estão registradas no ROADMAP 0.6.26, junto do gate de rating
  // obrigatório para federado e da ordenação por rating em circuito de pontos.
}

process.exit(placar("Participar de outro circuito"));
