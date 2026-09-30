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
  montarMotor, pinGuardado, atleta, circuito, ok, igual, secao, placar, BH, semComentarios} from "./ferramentas.mjs";

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
    // O atleta do BH JÁ TEM uma versão aceita — nas duas pontas, como em produção:
    // `circuito_atletas` (a participação dele no BH) e `atletas` (o espelho legado).
    // Sem isso o cenário não espelhava a produção, e a asserção que prova que o
    // aceite no 2º circuito NÃO mexe no registro do BH comparava contra `undefined`
    // — passando, ou falhando, pelo motivo errado. Mesma armadilha do fixture do
    // `inscricoes_abertas` logo acima, e pela mesma razão: fixture que não espelha
    // a produção mede outra coisa.
    atletas: [atleta(ATL, { nome: "Atleta do BH", telefone: TEL, pin_hash: hash, rating: 720,
                            versao_regulamento: "v03-12", aceite_regulamento: true })],
    circuito_atletas: [{
      id: "ca-bh", circuito_id: BH, atleta_id: ATL,
      status: "ativo", pendente_circuito: false, saldo_temp: 0, vitorias: 0, derrotas: 0,
      versao_regulamento: "v03-12", aceite_regulamento: true,
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

  // ── A VERSÃO ACEITA É POR CIRCUITO, e é isso que a tela tem de mostrar ────
  // Pergunta do Juliano, 29/09/2026: "quando o atleta estiver em mais de um
  // circuito, vai precisar mostrar em outro local, dentro do circuito que ele
  // acessou naquele momento, certo?".
  //
  // Certo — e o mecanismo já existia, mas NÃO estava protegido. O risco concreto:
  // se o aceite no circuito NOVO escrevesse por cima do registro do BH, o atleta
  // pararia de ser chamado para re-aceitar no BH (ou seria chamado à toa), e o
  // recibo de um circuito passaria a falar pelo outro. As duas pontas são
  // independentes de propósito.
  const vincBH = banco.acha("circuito_atletas", (l) => l.circuito_id === BH && l.atleta_id === ATL);
  igual(vincBH.versao_regulamento, "v03-12",
    "o aceite no circuito de PONTOS não mexe na versão registrada no BH — cada circuito guarda a sua");
  ok(vinc.versao_regulamento !== vincBH.versao_regulamento,
    "e o mesmo atleta fica com versões DIFERENTES nos dois circuitos, que é o estado normal");

  // O caminho legado do BH também não é tocado: `atletas.versao_regulamento` é o
  // espelho do BH, e escrever nele a partir de outro circuito seria vazamento
  // cross-tenant — o defeito que a blindagem do `writeAtleta` existe para impedir.
  igual(banco.acha("atletas", (a) => a.id === ATL).versao_regulamento, "v03-12",
    "nem o espelho legado em `atletas`, que é do BH");
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

  // A METADE QUE FALTAVA: nome preenchido e hash do CPF vazio. A asserção anterior
  // cobria "sem nome" e deixava passar "com nome, sem CPF" — e essa forma é
  // alcançável de verdade, porque o `INSCREVER` grava `responsavel_nome` sempre que
  // vier, e o `responsavel_cpf_hash` SÓ se o CPF vier. Mutação: tirar a metade do
  // hash da condição ficava VERDE. (Guardião de Confiabilidade.)
  const { motor: m4, banco: b4 } = await comDocumento({ responsavel_nome: "Mãe do atleta", responsavel_cpf_hash: null });
  const soNomeArquivo = await m4.chamar(pedido());
  igual(soNomeArquivo.status, 400, "menor com NOME do responsável mas sem o CPF no arquivo é recusado");
  igual(soNomeArquivo.corpo?.erro, "responsavel_obrigatorio", "com o mesmo erro");
  igual(b4.linhas("circuito_atletas").filter(l => l.circuito_id === CIRC).length, 0, "e sem vínculo");

  const { motor: m5 } = await comDocumento({ responsavel_nome: null, responsavel_cpf_hash: "hash-do-resp" });
  const soHash = await m5.chamar(pedido());
  igual(soHash.status, 400, "e o inverso também: CPF sem nome não basta");

  // ── A RESSALVA DELIBERADA, fixada em asserção a pedido do Guardião Jurídico ──
  // A RESSALVA MORREU EM 28/09/2026, E ESTA ASSERÇÃO É O RECIBO DISSO.
  // Até 27/09 este bloco exigia 200: documento com `data_nascimento` nula PASSAVA,
  // deliberadamente, porque a única origem de documento sem data era o `INSCREVER`
  // — que não tinha guarda de menor nenhuma. Recusar aqui trancaria adulto de
  // cadastro antigo por um defeito de OUTRA porta, e para o menor que passou por lá
  // a violação já tinha acontecido na porta da frente.
  // O comentário de então terminava assim, e ficou valendo ao pé da letra:
  //   "QUANDO O 0.6.24 FECHAR, esta asserção fica vermelha de propósito: é o sinal
  //    de que a ressalva morreu. Não 'conserte' — apague, e troque pela recusa."
  // O 0.6.24 fechou no MESMO commit que criou esta linha. Ela ficou vermelha, e é
  // a troca pela recusa. Hoje os dois únicos criadores de `atleta_documento` exigem
  // a data, então documento sem data não pode mais nascer: o que sobrava era código
  // morto que falhava ABERTO — o pior tipo, porque ninguém o exercita.
  const { motor: m3 } = await comDocumentoSemData();
  const semData = await m3.chamar(pedido());
  igual(semData.status, 409,
    "documento com data de nascimento NULA agora RECUSA — a ressalva do 0.6.24 morreu");
  igual(semData.corpo?.erro, "cadastro_sem_data_nascimento",
    "e pelo motivo certo, não por um efeito colateral de outra guarda");
  // A recusa tem de NOMEAR O REMÉDIO: esta tela não tem campo para corrigir a data,
  // então um 409 seco deixaria o atleta preso (condição do Guardião Jurídico).
  const fonteApp = await import("node:fs/promises").then(f => f.readFile("src/App.jsx", "utf-8"));
  const linhaTraducao = fonteApp.split("\n").find(l => l.includes('includes("cadastro_sem_data_nascimento")'));
  ok(!!linhaTraducao, "o app traduz o código novo — sem isso ele cai no genérico 'tente de novo', que aqui é mentira");
  ok(/Fale com o organizador/.test(linhaTraducao || ""),
    "e a frase manda falar com o organizador, que é o único que consegue resolver");

  // ── A FORMA da guarda, e não só o comportamento (28/09/2026) ──────────────
  // O Guardião de Segurança mutou `=== null ||` de volta para `!== null &&` AQUI
  // e a bateria ficou VERDE — a mesma regressão que o `athlete-action` já barra,
  // na guarda IRMÃ, voltando sem ninguém ver. É a terceira vez nesta série que um
  // conserto cai de um lado só, e o molde já existia a um arquivo de distância.
  // Por que precisa ser asserção de FONTE: com a guarda de `=== null` de pé, a
  // linha de baixo nunca recebe nulo, então nenhuma asserção de comportamento
  // consegue distinguir as duas formas. Inalcançável por construção.
  {
    const motorLogin = await import("node:fs/promises")
      .then(f => f.readFile("supabase/functions/login-atleta/index.ts", "utf-8"));
    const semComentario = motorLogin.replace(/\/\/[^\n]*/g, "");
    ok(/if \(idadeArquivo === null\) \{/.test(semComentario),
      "a guarda do arquivo recusa idade DESCONHECIDA explicitamente");
    ok(!/idadeArquivo !== null/.test(semComentario),
      "e a reescrita que transforma idade desconhecida em liberação silenciosa não voltou — a mesma que o athlete-action já barra");
  }
}

secao("Nenhuma MENSAGEM vaza rating para um circuito de pontos");
{
  // Achado na varredura de 29/09/2026, a pedido do Juliano ("faça uma análise mais
  // profunda do app para ver se está tudo bem mesmo").
  //
  // Duas mensagens — as duas ENVIADAS por WhatsApp, as duas de alta frequência —
  // citavam RATING sem ramificar por sistema:
  //   "resultados" (a cada partida): "📊 Seu novo Rating: X"
  //   "ranking"    (a cada rodada):  "📊 Seu saldo: +N pts | Rating: X"
  //
  // E o número não seria zero nem vazio: `a.rating` vem da tabela GLOBAL `atletas`,
  // que é a identidade compartilhada entre circuitos. O atleta de um circuito de
  // PONTOS receberia, no telefone dele, **o rating que ele tem em OUTRO circuito** —
  // a contaminação que o `CLAUDE.md` chama de "rating vazando para circuito de
  // pontos", e a pior forma dela, porque sai do app.
  //
  // É a mesma família do torneio (seção acima) e do RATING nas telas (seção do
  // Sistema B): o app tinha quatro superfícies e três já estavam protegidas.
  const fonteMsg = await import("node:fs/promises").then(f => f.readFile("src/App.jsx", "utf-8"));
  const semComentario = fonteMsg.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "").replace(/^\s*\/\/[^\n]*/gm, "");
  // ⚠️ A ÂNCORA DE FIM É `case "renovacao":`, e não `case "torneio":`. A primeira
  // redação usava o torneio — mas ele vem ANTES do ranking no arquivo, então o
  // recorte terminava cedo e a asserção do ranking media um trecho que não continha
  // o ranking. Verde ou vermelha, seria pelo motivo errado. Ancorar por posição
  // presumida em vez de verificada é o mesmo erro da janela fixa.
  const iIni = semComentario.indexOf('case "resultados":');
  const iFim = semComentario.indexOf('case "renovacao":');
  const geradores = semComentario.slice(iIni, iFim);
  ok(iIni > 0 && iFim > iIni, "o recorte vai do primeiro gerador até o da renovação");
  ok(geradores.includes('case "ranking":'), "e ele CONTÉM o gerador do ranking — senão a asserção abaixo mede outra coisa");


  // Toda citação de rating dentro dos geradores tem de estar sob ramo de sistema.
  const citaRating = [...geradores.matchAll(/[Rr]ating/g)].length;
  const ramos = [...geradores.matchAll(/SISTEMA_ATIVO === "B"/g)].length;
  ok(ramos >= 2, `os geradores ramificam por sistema onde citam rating (${ramos} ramos)`);
  ok(/Seus pontos na temporada: \*\$\{p1b\.saldoTemp\|\|0\}\*/.test(geradores),
    "a mensagem de RESULTADO manda pontos num circuito de pontos");
  ok(/Seu novo Rating: \*\$\{p1b\.rating\}\*/.test(geradores),
    "e continua mandando rating num circuito de rating — o conserto não apagou o certo");
  ok(/📊 Seus pontos: \*\$\{a\.saldoTemp\|\|0\}\*/.test(geradores),
    "a mensagem de RANKING manda pontos num circuito de pontos");
  ok(!/Rating: \*\$\{a\.rating\}\*`\}?\\n\\nConfira todos os detalhes/.test(geradores) ||
     /SISTEMA_ATIVO === "B" \? `📊 Seus pontos/.test(geradores),
    "e a do ranking só cita rating dentro do ramo");

  // ⚠️ E o RÓTULO da categoria, que o admin lê no painel antes de disparar.
  ok(!/desc:"Envia resultado e novo rating para cada atleta"/.test(semComentario),
    "a categoria não promete mais 'novo rating' ao admin de um circuito de pontos");
  ok(/Envia o resultado e a pontuação atualizada para cada atleta/.test(semComentario),
    "ela fala do que os DOIS sistemas têm");
}

secao("Num circuito SEM torneio, nada promete torneio (0.10.5)");
{
  // O Cap. 10 — Torneio Presencial de Encerramento — é do BH. Um circuito de
  // PONTOS não tem torneio, e um de rating NOVO (`vA-nc-01`) também não: o aviso
  // da criação diz isso com todas as letras desde 29/09.
  //
  // Mas TRÊS superfícies prometiam torneio incondicionalmente, e nenhuma delas
  // perguntava a versão do circuito:
  //  (a) o RANKING desenhava "Zona de classificação", cortava no 8º e marcava os
  //      primeiros com "C", com a legenda "classificado para o torneio final";
  //  (b) o CABEÇALHO de "Meus jogos" estampava "✓ ZONA DE CLASSIFICAÇÃO";
  //  (c) a CONVOCAÇÃO, que não é rótulo: é mensagem enviada dizendo "você está no
  //      Torneio Presencial".
  //
  // A (c) é a pior: sai do app, chega no telefone da pessoa, e fala de um evento
  // que o regulamento dela não menciona.
  //
  // ⚠️ CORREÇÃO DE UM ERRO MEU, e ele é do tipo mais perigoso que existe aqui.
  // Eu rotulei a (b) como "o cartão que o atleta COMPARTILHA" e escrevi que ela
  // era a segunda pior "porque o cartão viaja para fora do contexto". Era FALSO: o
  // `classificado` que eu guardei é usado num lugar só — o selo do CABEÇALHO de
  // "Meus jogos", que é uma tela e não viaja. O cartão compartilhável é outro
  // objeto (`AtletaCard`), ele é montado pelo `CartaModal` SEM prop de
  // classificação, e **nunca teve** marca de torneio nenhuma.
  // Pego pelo Guardião da Experiência do Atleta. É a SÉTIMA vez nesta sessão que
  // uma asserção minha aponta para o lugar errado — e a primeira em que o rótulo
  // errado CREDITA COBERTURA A UM ARTEFATO DESCOBERTO: quem lesse isto em três
  // meses acreditaria que o cartão está protegido, e um selo acrescentado a ele
  // não seria acusado por ninguém. Por isso a asserção do cartão nasce agora,
  // logo abaixo, na forma NEGATIVA: ele está limpo, e o que se quer é que continue.
  const fonteApp = await import("node:fs/promises").then(f => f.readFile("src/App.jsx", "utf-8"));

  ok(/function circuitoTemTorneio\(state\)/.test(fonteApp),
    "existe UMA conta de 'este circuito tem torneio', em vez de cada tela decidir sozinha");

  // ── E AQUI A BATERIA EXECUTA A FUNÇÃO, em vez de ler o texto dela ─────────
  // Pedido pelo Guardião do Regulamento e pelo de Confiabilidade, pelo mesmo
  // motivo: sabotar `circuitoTemTorneio` para `return true` deixava 12 das 13
  // seções verdes, e só uma regex pegava. Pela regra da casa, regex não protege
  // regra.
  // `circuitoTemTorneio` é PURA e atende as quatro cláusulas do contrato de
  // extração escrito para a `janelaRenovacao`: mesma entrada → mesma saída, sem
  // estado, sem React, e só fecha sobre `VERSOES_COM_TORNEIO`, que é uma const
  // incluída no mesmo recorte. Então ela é extraída e EXECUTADA — e isso cobre de
  // graça o `.trim()` e o `|| ""`, que nenhuma regex exercitava.
  {
    const iSet = fonteApp.indexOf("const VERSOES_COM_TORNEIO");
    const iFn = fonteApp.indexOf("function circuitoTemTorneio(state) {");
    const fimFn = fonteApp.indexOf("\n}", iFn) + 2;
    ok(iSet > 0 && iFn > iSet && fimFn > iFn, "a constante e a função foram localizadas no fonte");
    const recorte = fonteApp.slice(iSet, fonteApp.indexOf("\n", iSet)) + "\n" + fonteApp.slice(iFn, fimFn);
    const temTorneio = new Function(`${recorte}; return circuitoTemTorneio;`)();

    ok(temTorneio({ regulamentoVersao: "v03-12" }) === true, "v03-12 (o BH) TEM torneio");
    ok(temTorneio({ regulamentoVersao: "v03-13" }) === true, "v03-13 (o BH, versão nova) também");
    ok(temTorneio({ regulamentoVersao: "vB-01" }) === false, "vB-01 (pontos) NÃO tem");
    ok(temTorneio({ regulamentoVersao: "vA-nc-01" }) === false, "vA-nc-01 (rating novo) NÃO tem");
    // As três entradas que nenhuma regex exercitava:
    ok(temTorneio({ regulamentoVersao: null }) === false, "versão NULA não tem — é o estado antes da carga terminar");
    ok(temTorneio({ regulamentoVersao: "" }) === false, "versão vazia também não");
    ok(temTorneio({}) === false, "e estado sem o campo nenhum");
    ok(temTorneio(null) === false, "nem estado nulo — a função não estoura");
    ok(temTorneio({ regulamentoVersao: "  v03-12  " }) === true,
      "e o `.trim()` funciona: o motor apara o carimbo, e sem simetria aqui o BH perderia o corte por dois espaços");
  }

  ok(/VERSOES_COM_TORNEIO\.has\(String\(state\?\.regulamentoVersao \|\| ""\)\.trim\(\)\)/.test(fonteApp),
    "e ela lê a versão do CIRCUITO, não uma constante");

  // (a) ranking
  ok(/const temCorte = temTorneio && sorted\.length > CORTE;/.test(fonteApp),
    "(a) sem torneio, o ranking não desenha corte");
  ok(/const classificado = temTorneio && i < CORTE;/.test(fonteApp),
    "e ninguém é marcado como classificado");
  // O rodapé FICA sempre; o conteúdo é que muda. Sem torneio, a legenda do "C"
  // daria explicação a uma marca que não existe — e um rodapé vazio deixaria a
  // lista terminar de repente contra a barra de abas (~23px de folga, medido pelo
  // Designer, e menos ainda num aparelho com notch). O lugar recebeu o CRITÉRIO DE
  // DESEMPATE, que é o que o atleta empatado quer saber e não estava em tela
  // nenhuma. Os dois textos foram conferidos contra o `cmpRanking`, linha a linha.
  ok(/\? <><span style=\{\{color:T\.terracota,fontWeight:700\}\}>C<\/span> = classificado/.test(fonteApp),
    "a legenda do 'C' só aparece onde há torneio");
  // "injustificados", não "culposos": é a palavra do Cap. 09 que o atleta aceitou;
  // "culposo" é a palavra da coluna do banco. E o rodapé passou a listar os SEIS
  // critérios, não quatro — ele parava no 4º e o regulamento tem 6. (Guardião do
  // Atleta, 29/09/2026.)
  ok(/Desempate: menos W\.O\. injustificados · confronto direto · aproveitamento · saldo de sets · decisão do administrador/.test(fonteApp),
    "e sem torneio o rodapé mostra o desempate do Sistema B, na ordem que o cmpRanking aplica, com a palavra do regulamento");
  ok(!/Desempate: menos W\.O\. culposos/.test(fonteApp),
    "e a palavra do banco de dados ('culposos') não aparece mais no texto que o atleta lê");
  ok(/Desempate: vitórias · confronto direto · rating/.test(fonteApp),
    "e o do Sistema A, idem");
  ok(/\{\(temCorte \? sorted\.slice\(0, CORTE\) : sorted\)\.map/.test(fonteApp),
    "e a lista mostra TODO MUNDO quando não há corte, em vez de cortar no 8º em silêncio");

  // (b) o selo do cabeçalho de "Meus jogos" — uma TELA, que não viaja
  ok(/const classificado = circuitoTemTorneio\(state\) && minhaPos >= 0 && minhaPos < 8;/.test(fonteApp),
    "(b) o cabeçalho de 'Meus jogos' não estampa classificação onde não há torneio");

  // (b2) E O ARTEFATO QUE DE FATO SAI DO APP: o cartão que o atleta compartilha no
  // WhatsApp. Ele nunca teve marca de torneio, e esta asserção existe para que
  // continue assim — porque ele é o pior lugar possível para a promessa aparecer:
  // é imagem, sai do contexto, e ninguém do outro lado tem como conferir.
  {
    const iCard = fonteApp.indexOf("function AtletaCard(");
    const fimCard = fonteApp.indexOf("\nfunction ", iCard + 1);
    ok(iCard > 0 && fimCard > iCard, "o cartão compartilhável foi localizado no fonte");
    const corpoCard = fonteApp.slice(iCard, fimCard);
    ok(!/CLASSIFICA|classificad/.test(corpoCard),
      "(b2) o cartão que o atleta COMPARTILHA não tem marca de classificação — e não pode ganhar uma sem gate");
    ok(!/[Tt]orneio/.test(corpoCard),
      "nem menção a torneio");
    ok(!/\bC =/.test(corpoCard),
      "nem a legenda do 'C'");
  }

  // (c) a mensagem — e são DUAS pontas, não uma.
  ok(/if \(!circuitoTemTorneio\(state\)\) return \[\];/.test(fonteApp),
    "(c) o GERADOR da convocação não produz nada num circuito sem torneio");
  // ⚠️ O FILTRO da categoria também, e ele estava de fora (auditoria multi-circuito,
  // 29/09/2026). O gerador perguntava; o filtro não. Resultado num circuito de
  // pontos: ao fim da temporada o chip "🎯 Convocação Torneio — Notifica os Top 8
  // classificados" APARECIA no painel e a fila vinha vazia, sem explicação. Duas
  // telas discordando sobre a mesma regra — uma oferece, a outra não entrega.
  ok(/if \(c\.id === "torneio"\) return circuitoTemTorneio\(state\) && temporadaCompletaCheck\(state\);/.test(fonteApp),
    "e o FILTRO da categoria também — o chip nem chega a aparecer");

  // ⚠️ FAIL-CLOSED: versão desconhecida NÃO tem torneio. Prometer um evento que
  // talvez não exista é pior que omitir um que existe — o segundo o organizador
  // corrige com uma mensagem; o primeiro já criou expectativa em quem leu.
  // ⚠️ Ancorada no CORPO da função, não nos pontos de chamada. A primeira redação
  // olhava `circuitoTemTorneio(state) ||` nos chamadores — e a sabotagem que
  // importa mora DENTRO: um `|| !state?.regulamentoVersao` ali faz versão
  // desconhecida ganhar torneio, e nenhum chamador muda. Sexta vez nesta sessão que
  // uma asserção minha olhava para o lugar errado.
  const corpoTorneio = fonteApp.slice(fonteApp.indexOf("function circuitoTemTorneio(state) {"),
                                      fonteApp.indexOf("}", fonteApp.indexOf("function circuitoTemTorneio(state) {")) + 1);
  ok(corpoTorneio.length > 0, "o corpo da função foi localizado");
  ok(!/\|\|/.test(corpoTorneio.replace(/String\(state\?\.regulamentoVersao \|\| ""\)/, "")),
    "e não há fallback dentro dela que faça versão desconhecida ganhar torneio");
}

secao("O invariante que segura o corte do BH: a versão chega SEMPRE com o roster");
{
  // Achado do Guardião de Confiabilidade, e é do tipo que só aparece quando alguém
  // pergunta "o que sustenta isso?".
  //
  // Antes de 0.10.5, `temCorte = sorted.length > CORTE` NÃO dependia da versão do
  // regulamento. A fatia cria essa dependência — corretamente — e com ela uma
  // exigência nova: **a versão tem de chegar sempre junto com o roster**. Se o
  // roster entrar e a versão vier nula, `circuitoTemTorneio` é fail-closed e o
  // ranking do BH perde o corte, os "C" e a legenda — **sem erro nenhum na tela**.
  //
  // Hoje isso é verdade por três detalhes de implementação, e NADA no repositório
  // dizia que eles não podem mudar. Ele mediu com a sabotagem realista, não com uma
  // artificial: trocar `db.getConfig()` por `db.getConfig().catch(() => [])` —
  // **o padrão que este MESMO arquivo já usa em dois outros pontos** — deixava a
  // bateria VERDE e apagava o corte do ranking do BH. "Tornar a carga mais
  // resiliente" é o movimento mais natural do mundo, e era o que quebrava.
  const fonteApp = await import("node:fs/promises").then(f => f.readFile("src/App.jsx", "utf-8"));

  ok(/const \{ athletes, matches, keys, phase[^}]*regulamentoVersao[^}]*\} = action\.payload;/.test(fonteApp),
    "(1) o roster e a versão do regulamento chegam no MESMO payload — não há como um entrar sem o outro");

  const iCarga = fonteApp.indexOf("async function loadFromSupabase");
  const fimCarga = fonteApp.indexOf("\n  async function", iCarga + 1);
  const carga = fonteApp.slice(iCarga, fimCarga > iCarga ? fimCarga : iCarga + 9000);
  ok(/await Promise\.all\(/.test(carga),
    "(2) a carga é tudo-ou-nada: se a leitura do circuito falhar, nenhum estado meio-carregado é despachado");
  ok(!/Promise\.allSettled/.test(carga),
    "e NÃO é `allSettled`, que deixaria o roster entrar sem a versão");
  ok(!/getConfig\(\)[\s\S]{0,40}\.catch\(/.test(carga),
    "(3) e a leitura da configuração não é tolerante a falha — um `.catch(() => [])` aqui apagaria o corte do ranking do BH em silêncio");
}

secao("A tela mostra a versão DO CIRCUITO ABERTO, não uma global");
{
  // Pergunta do Juliano, 29/09/2026. A resposta é sim, e o mecanismo já existia —
  // mas não tinha portão, e o defeito possível é silencioso: o atleta veria a
  // versão de um circuito enquanto lê o regulamento de outro, ou seria chamado a
  // re-aceitar algo que já aceitou.
  //
  // COMO O APP GARANTE ISSO, em três elos que precisam continuar de pé:
  //  (1) a leitura do roster é FILTRADA por circuito — `circuito_atletas` com
  //      `circuito_id=eq.${CIRCUITO_ATIVO}` — e a versão vem da linha SAZONAL,
  //      não da tabela global `atletas`;
  //  (2) `currentAthlete` é restaurado DE DENTRO desse roster já filtrado, então
  //      trocar de circuito troca o objeto do atleta inteiro, com a versão dele
  //      naquele circuito;
  //  (3) o card de re-aceite compara a versão do CIRCUITO com a versão daquele
  //      objeto — as duas pontas do mesmo circuito.
  const fonteApp = await import("node:fs/promises").then(f => f.readFile("src/App.jsx", "utf-8"));

  ok(/circuito_atletas\?circuito_id=eq\.\$\{CIRCUITO_ATIVO\}/.test(fonteApp),
    "(1) o roster é lido filtrado pelo circuito aberto");
  // ⚠️ Esta asserção era `/select=[^`]*\bversao_regulamento\b/` e passou a falhar
  // em 30/09/2026 quando a lista de colunas saiu de dentro do `getAtletas` para a
  // constante `ATLETA_SAZONAL_COLS` — o comportamento não mudou, o regex é que
  // olhava para o lugar errado. Reescrita apontando para o MECANISMO, o que a
  // torna mais forte: agora afirma que a coluna está na lista SAZONAL (e não na
  // de identidade, que é global e serviria a versão do circuito errado).
  ok(/const ATLETA_SAZONAL_COLS = "[^"]*\bversao_regulamento\b/.test(fonteApp),
    "e a versão aceita está na lista SAZONAL de colunas, que é por circuito");
  ok(!/const ATLETA_IDENTIDADE_COLS = "[^"]*\bversao_regulamento\b/.test(fonteApp),
    "e NÃO na lista de identidade, que é global — de lá viria a versão de outro circuito");
  ok(/getAtletas: \(\) => supaFetch\(`circuito_atletas\?circuito_id=eq\.\$\{CIRCUITO_ATIVO\}&select=\$\{ATLETA_SELECT\}`\)/.test(fonteApp),
    "e o roster usa essa lista única — sem segunda cópia para divergir");
  ok(/const atletaCompleto = athletesMapped\.find\(a => a\.id === sessAgora\.athleteId\);/.test(fonteApp),
    "(2) o atleta logado é restaurado de dentro do roster já filtrado — trocar de circuito troca o objeto inteiro");
  ok(/const versaoCircuito = String\(state\.regulamentoVersao \|\| ""\)\.trim\(\);/.test(fonteApp) &&
     /const versaoAceita = String\(athlete\?\.versaoRegulamento \|\| ""\)\.trim\(\);/.test(fonteApp),
    "(3) o card de re-aceite compara a versão do circuito com a do atleta NAQUELE circuito");

  // ⚠️ O elo que quebraria sem ninguém ver: buscar o atleta por id na tabela
  // GLOBAL em vez de no roster do circuito. Aí a versão viria do BH sempre, e o
  // atleta de dois circuitos leria a versão errada no segundo.
  ok(!/atletas\?id=eq\.\$\{[^}]*athleteId/.test(fonteApp),
    "e o atleta logado NÃO é buscado na tabela global por id — seria a versão do BH em qualquer circuito");
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

  // ⚠️ AQUI A BATERIA TEM UM LIMITE, e é importante escrevê-lo em vez de fingir
  // que não existe. A versão anterior desta asserção guardava o select de
  // `getCircuitosAbertos` — uma função que ficou com ZERO chamadores quando os dois
  // fluxos passaram a usar o RPC. Ou seja: ela guardava código morto, e a
  // dependência viva ficava sem guarda. Apagar a função morta deixava a bateria
  // vermelha SEM defeito nenhum, que foi exatamente o que aconteceu.
  // O que sustenta a tela hoje é o RPC `circuitos_abertos_vagas` devolver a coluna
  // `sistema` — e isso vive **no banco**, fora do alcance de qualquer teste daqui.
  // Então o que dá para travar é só que a tela use o RPC certo. Se ele parar de
  // devolver `sistema`, a tela mostra o regulamento errado e NADA fica vermelho.
  // (Guardião de Confiabilidade, 27/09/2026.)
  ok(/getCircuitosAbertosVagas:[\s\S]{0,120}?circuitos_abertas_vagas|getCircuitosAbertosVagas:[\s\S]{0,120}?circuitos_abertos_vagas/.test(fonte),
    "existe a leitura por RPC que traz sistema, cidade e fase de uma vez");
  const usosRpc = (fonte.match(/db\.getCircuitosAbertosVagas\(\)/g) || []).length;
  igual(usosRpc, 2, "e os DOIS fluxos (inscrição e participar) usam esse RPC — não o select cru");
  ok(!/getCircuitosAbertos:/.test(fonte),
    "a leitura antiga foi removida: asserção ancorada em código morto guarda o nada");
  ok(/getVersoesRegulamento:[\s\S]{0,160}?regulamento_versao/.test(fonte),
    "e existe a leitura que traz a versão do regulamento por circuito");

  // A flag que separa "não consegui ler" de "o circuito não tem versão" nasceu como
  // CÓDIGO MORTO: era gravada e ninguém lia, então a tela usava uma frase só e
  // mandava o atleta insistir num circuito que nunca vai ter regulamento. Se ela
  // voltar a não ser consumida, esta asserção fica vermelha.
  const gravaFlag = (fonte.match(/_versaoIndisponivel/g) || []).length;
  ok(gravaFlag >= 2, `a flag _versaoIndisponivel é gravada E lida (${gravaFlag} ocorrências — 1 só significa código morto)`);
  ok(/circ\._versaoIndisponivel/.test(bloco),
    "e é a tela que a lê, para escolher entre 'tente de novo' e 'avise o organizador'");
  ok(/Tentar de novo não resolve|Tentar de novo nao resolve|tentar de novo não resolve/i.test(bloco)
     || /avise o organizador do circuito/.test(bloco),
    "no caso de circuito sem regulamento, a tela NÃO manda insistir");
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

secao("O app manda o PIN do super-admin ao porteiro — a linha de que tudo depende");
{
  // Achado MJ do Guardião de Confiabilidade: apagar esta única linha do
  // `fetchCircuitoPorteiro` deixa a bateria INTEIRA verde, e a correção do
  // desempate do Cap. 09 para o super-admin vira inerte — ele volta em silêncio à
  // leitura anônima e lê ZERO em `wo_culposos_temporada`.
  // É a família do 0.6.21: a prop que falta num ponto de chamada, com tudo verde.
  // `fonteApp` é local de cada bloco neste arquivo — o `no-undef` da bateria me
  // pegou escrevendo sem carregar. É a mesma classe de erro que a seção
  // "Nomes que não existem" protege, e ela funcionou.
  const fonteApp = await import("node:fs/promises").then(f => f.readFile("src/App.jsx", "utf-8"));
  const iP = fonteApp.indexOf("async function fetchCircuitoPorteiro(");
  ok(iP > 0, "o `fetchCircuitoPorteiro` foi localizado");
  const fimP = fonteApp.indexOf("\n}", iP);
  const corpoP = fonteApp.slice(iP, fimP).replace(/\/\/[^\n]*/g, "");
  ok(/cred\.pinSuper[\s\S]{0,40}body\.pin\s*=\s*cred\.pinSuper/.test(corpoP),
    "e ele manda o PIN do super-admin no corpo quando a credencial o traz");
  ok(!/body\.pin[^=]*=[^;]*telefone/.test(corpoP),
    "e o PIN do super-admin vai SEM telefone — é o que o porteiro usa para distinguir do organizador");

  // E o ponto de CHAMADA tem de montar essa credencial. A asserção acima é cega
  // para isso — lição de 27/09: a janela ancorada na função não vê quem a invoca.
  ok(/const pinSuper = getPinCache\(\);[\s\S]{0,300}pinSuper \? \{ pinSuper \}/.test(fonteApp),
    "e a carga do circuito monta a credencial do super-admin a partir do PIN em cache");
  // ⚠️ ESTA ASSERÇÃO JÁ DEFENDEU A ORDEM ERRADA, e chamava-a de "certa".
  //
  // Até 30/09/2026 ela exigia `getAtletaCred() || getOrgCred() || (pinSuper` e
  // dizia "na ordem certa: atleta → organizador → super-admin". Não era: o
  // `ctm_atleta_sessao` é gravado em TODO login de atleta e a função que o apaga
  // (`clearAtletaCred`) existe no arquivo e NUNCA é chamada — nem no logout.
  // Numa máquina que é atleta e super-admin (a do Juliano), o token velho vencia
  // o PIN, o porteiro respondia `nao_membro`, e o painel degradava em silêncio.
  // Consertar o app deixaria a bateria vermelha SEM defeito nenhum: a asserção
  // congelava o estado de hoje em vez de defender a regra. Achado do Supervisor
  // do Admin. A regra é: credencial MAIS FORTE primeiro.
  ok(/getOrgCred\(\) \|\| \(pinSuper \? \{ pinSuper \} : null\) \|\| getAtletaCred\(\)/.test(fonteApp),
    "na ordem certa: organizador → super-admin (PIN) → atleta (token) — credencial mais forte primeiro, porque o token de atleta nunca é apagado");
  ok(!/getAtletaCred\(\) \|\| getOrgCred\(\)/.test(fonteApp),
    "e o token de atleta NÃO vem primeiro — era o que fazia o PIN do super-admin perder para uma sessão velha");

  // A LEITURA DO PORTEIRO SOMA COM A NORMAL, NÃO SUBSTITUI.
  //
  // O defeito que isto prende foi criado por mim nesta onda: eu alarguei o
  // porteiro para todo circuito não-BH e ele SUBSTITUÍA a leitura normal. O
  // porteiro serve qualquer visitante de circuito público, então não devolve dado
  // privado — e esta bateria proíbe que devolva (asserções da Regra 2, acima).
  // Substituir cegava o painel do organizador: todos "Sem pgto", todos "Sem
  // consentimento", inclusão bloqueada para quem já pagou, e a lista de PEDIDOS
  // DE EXCLUSÃO DE DADOS sempre vazia — obrigação legal com prazo, invisível.
  //
  // Medido no banco antes do conserto: há permissões por COLUNA, e o `anon` já lê
  // `pagamento_confirmado`, `aceite_regulamento`, `aceite_lgpd` e
  // `exclusao_solicitada_em`. O único campo que ele não alcança é
  // `wo_culposos_temporada`. Então a leitura normal é a base e o porteiro entra
  // só com o que falta.
  ok(/const woPorId = new Map\(doPorteiro\.map/.test(fonteApp),
    "a carga monta o índice do contador de W.O. vindo do porteiro");
  ok(/atletasEf = \(atletas \|\| \[\]\)\.map\(/.test(fonteApp),
    "e a base de `atletasEf` é a leitura NORMAL — o porteiro não substitui a lista");
  ok(!/atletasEf = \(dadosPort\.ranking \|\| \[\]\)\.map\(porteiroRankingToCa\);\s*\n\s*partidasEf/.test(fonteApp),
    "o caminho antigo, que trocava a lista inteira pela do porteiro em circuito público, não existe mais");
  ok(/if \(\(atletas \|\| \[\]\)\.length > 0\)/.test(fonteApp),
    "a soma só vale quando a leitura normal trouxe linha — circuito privado cai no porteiro puro, que é limite conhecido");
  ok(/setDbStatus\("error"\)[\s\S]{0,200}porteiro/.test(fonteApp) || /\[porteiro\][\s\S]{0,120}vazia/.test(fonteApp),
    "e a falha do porteiro com leitura vazia AVISA em vez de degradar em silêncio");

  // NENHUM LUGAR MOSTRA O NÚMERO DO RATING SEM OLHAR O SISTEMA.
  //
  // O `vB-01` diz QUATRO vezes que num circuito de pontos "não há rating", e o app
  // mostrava "Rating: <número do outro circuito>" em OITO lugares que exibem o
  // valor. Eu já tinha consertado cinco nesta onda e reportado "cinco superfícies";
  // o Supervisor do Admin mediu ~20 menções, oito delas exibindo o número. O erro
  // não foi a contagem: foi consertar com ternário copiado, que obriga a achar os
  // irmãos na mão.
  //
  // A VARREDURA PROCURA O NÚMERO, NÃO A PALAVRA. Essa é a definição que a torna
  // útil: o regulamento do Sistema A e a tela de criação de circuito DEVEM falar
  // "rating" (uma explica a regra, a outra oferece a escolha entre os dois
  // sistemas) e nenhuma delas interpola valor. A primeira versão desta varredura
  // procurava a palavra e acusou 26 lugares, a maioria correta — varredura que
  // acusa o certo é varredura que alguém vai desligar.
  {
    const fonteLimpa = semComentarios(fonteApp);
    // Exibições do NÚMERO: interpolação de `.rating` como conteúdo de JSX, e o
    // desenho no canvas. Atributo (`prop={...}`) fica de fora — ver o portão logo
    // abaixo, que é o que torna essa exclusão legítima.
    const exibicoes = [
      ...fonteLimpa.matchAll(/(^|[^=\w])\{\s*[a-zA-Z0-9_?.]*\.rating\s*\}/g),
      ...fonteLimpa.matchAll(/fillText\(\s*String\(\s*rating/g),
      ...fonteLimpa.matchAll(/fillText\(\s*"RATING"/g),
    ];
    const semRamo = exibicoes.filter((m) => {
      const antes = fonteLimpa.slice(Math.max(0, m.index - 800), m.index);
      return !/SISTEMA_ATIVO\s*[!=]==\s*"B"/.test(antes) && !/pontuacaoDoAtleta\(/.test(antes);
    });
    igual(semRamo.length, 0,
      "nenhum lugar exibe o NÚMERO do rating sem ramificar por sistema ou usar o `pontuacaoDoAtleta`");

    // O AJUDANTE ÚNICO, que é o que impede a nona superfície de nascer errada.
    ok(/function pontuacaoDoAtleta\(a\)/.test(fonteLimpa),
      "existe UM ajudante que devolve o rótulo e o número que o circuito usa");
    ok(/rotulo: "Pontos"[\s\S]{0,80}saldoTemp/.test(fonteLimpa),
      "e no Sistema B ele devolve «Pontos» com o saldo da temporada, não o rating");
    const usos = (fonteLimpa.match(/pontuacaoDoAtleta\(/g) || []).length;
    ok(usos >= 7,
      `e ele é usado em pelo menos 7 lugares (hoje ${usos}) — se cair, alguém voltou ao ternário copiado`);

    // O CANVAS É O ÚNICO ARTEFATO QUE SAI DO APP: o atleta baixa o PNG e manda no
    // WhatsApp e no Instagram. A versão de TELA já ramificava; esta não, e havia uma
    // asserção dizendo proteger "o cartão que sai do app" que verificava o cartão da
    // tela — confiança falsa exatamente sobre a superfície que ela nomeava.
    const iCanvas = fonteLimpa.indexOf("async function desenharCartaCanvas(");
    const fimCanvas = fonteLimpa.indexOf("\n}", iCanvas) + 2;
    ok(iCanvas > 0 && fimCanvas > iCanvas, "a função do canvas foi localizada");
    const canvas = fonteLimpa.slice(iCanvas, fimCanvas);
    ok(/saldo = 0/.test(canvas),
      "o canvas RECEBE o saldo — sem isso ele não teria o que desenhar num circuito de pontos");
    ok(/SISTEMA_ATIVO === "B" \? "PONTOS" : "RATING"/.test(canvas),
      "e o rótulo desenhado no PNG ramifica por sistema");
    ok(/\(saldo \?\? 0\) : \(rating \?\? 0\)/.test(canvas),
      'e o número tem `?? 0` nos dois lados — sem isso a imagem sairia com a palavra "null" desenhada');
    ok(/saldo: athlete\.saldoTemp \|\| 0,/.test(fonteLimpa),
      "e quem manda baixar passa o saldo de verdade");

    // O PORTÃO DA EXCLUSÃO dos atributos: `rating={...}` só é inofensivo porque o
    // componente que recebe decide por dentro. Sem isto, "é atributo" seria licença.
    const iCard = fonteLimpa.indexOf("function AtletaCard(");
    const fimCard = fonteLimpa.indexOf("\nfunction ", iCard + 10);
    ok(iCard > 0 && fimCard > iCard, "o AtletaCard foi localizado");
    const card = fonteLimpa.slice(iCard, fimCard);
    ok(/SISTEMA_ATIVO === "B" \? \(saldo \?\? 0\) : rating/.test(card),
      "o AtletaCard escolhe o número por sistema DENTRO dele — é isso que torna legítimo passar `rating={...}` como atributo");
    ok(/SISTEMA_ATIVO === "B" \? "Pontos" : "Rating"/.test(card),
      "e o rótulo dele também");
  }

  // CADA STATUS RECEBE A SUA FRASE — quatro situações, quatro respostas.
  //
  // A guarda do login é `status !== "ativo"` e engloba pendente, reprovado,
  // suspenso e arquivado. Até 30/09/2026 os quatro liam "ainda está em análise…
  // ele avisa assim que aprovar". Certo só para o pendente. O reprovado esperava
  // para sempre por uma aprovação já negada, com o motivo no banco e nunca
  // chegando nele; o suspenso levava explicação errada para uma suspensão que o
  // próprio app anunciou; o arquivado não sabia que tinha de se reinscrever.
  // Conferido em produção antes do conserto: HÁ 1 ATLETA SUSPENSO, então a frase
  // errada estava viva. Achado do Supervisor do Atleta.
  //
  // A asserção cobre os QUATRO de propósito. Consertar um e deixar os outros é
  // literalmente como este defeito nasceu — eu tinha consertado o caso pendente
  // nesta mesma onda e regredido os outros três.
  {
    const iG = fonteApp.indexOf('if (found.status !== "ativo")');
    const fimG = fonteApp.indexOf("\n      }", iG) + 8;
    ok(iG > 0 && fimG > iG, "a guarda de status do login foi localizada");
    const guarda = semComentarios(fonteApp.slice(iG, fimG));

    for (const st of ["reprovado", "suspenso", "arquivado"]) {
      ok(new RegExp(`found\\.status === "${st}"`).test(guarda),
        `o status «${st}» tem ramo próprio na guarda do login`);
    }
    ok(/não foi aprovada/.test(guarda),
      "o reprovado lê que NÃO foi aprovado — não «está em análise»");
    ok(/Motivo: \$\{motivo\}/.test(guarda),
      "e recebe o MOTIVO que o organizador escreveu, quando existe");
    ok(/String\(found\.motivo \|\| ""\)/.test(guarda),
      "com tolerância à ausência do campo — o motor sobe primeiro, mas a frase nunca mostra «undefined»");
    ok(/suspensa nesta temporada/.test(guarda),
      "o suspenso lê que está suspenso");
    ok(/arquivado[\s\S]{0,120}inscrever de novo/.test(guarda),
      "e o arquivado lê que precisa se inscrever de novo");
    ok(/ainda está em análise/.test(guarda),
      "e o pendente continua com a frase dele, que estava certa");

    // O motor tem de DEVOLVER o motivo, senão o ramo do reprovado é decorativo.
    const fonteLogin = await import("node:fs/promises")
      .then(f => f.readFile("supabase/functions/login-atleta/index.ts", "utf-8"));
    ok(/const COLS = "[^"]*\bmotivo_reprovacao\b/.test(fonteLogin),
      "e o login-atleta devolve `motivo_reprovacao` — sem isso o ramo do reprovado nunca teria o que mostrar");
  }

  // O LOGIN POR BIOMETRIA PERGUNTA "ONDE ESSA PESSOA JOGA?", NÃO "ESTÁ AQUI?".
  //
  // Até 30/09/2026 ele fazia `athletes.find(...)` — o elenco do circuito ABERTO
  // NA TELA — e o logout força o BH. Num circuito novo o atleta autenticava com
  // sucesso no Face ID / digital do próprio aparelho e lia "Cadastro não
  // encontrado. Entre com seu número.": o passkey provou quem ele é e o app
  // respondeu que ele não existe. Pior, `athletes` nasce `[]`, então em conexão
  // lenta a MESMA frase aparecia só porque o elenco não tinha chegado.
  // Achado do Supervisor do Atleta.
  {
    // ⚠️ EXISTEM DUAS `autenticarBiometria`: uma em `AdminLoginBiometria` e uma em
    // `AthleteLoginBiometria`. A primeira versão desta asserção usou
    // `indexOf("async function autenticarBiometria()")` e caiu na DO ADMIN — ficou
    // vermelha apontando para código que estava certo, e por um instante me fez
    // duvidar de um conserto que estava no arquivo. Recortar o COMPONENTE primeiro
    // é o que torna a medição inequívoca; e fica registrado que são duas, porque
    // essa é a informação que se perde.
    const iComp = fonteApp.indexOf("function AthleteLoginBiometria(");
    const fimComp = fonteApp.indexOf("\nfunction ", iComp + 10);
    ok(iComp > 0 && fimComp > iComp, "o componente de login do ATLETA por biometria foi localizado");
    const comp = fonteApp.slice(iComp, fimComp);
    igual((fonteApp.match(/async function autenticarBiometria\(\)/g) || []).length, 2,
      "há DUAS funções de login por biometria no app (atleta e admin) — asserção que não escolher o componente mede a errada");

    const iBio = comp.indexOf("async function autenticarBiometria()");
    const fimBio = comp.indexOf("\n  }", iBio) + 4;
    ok(iBio >= 0 && fimBio > iBio, "e a função de login dentro dele foi localizada");
    // Sem comentário: a asserção abaixo proíbe `athletes.find` NO CÓDIGO, e o
    // comentário que documenta a remoção contém a expressão. Sem isto, a única
    // forma de deixar verde seria apagar a explicação.
    const bio = semComentarios(comp.slice(iBio, fimBio));
    ok(/navigator\.credentials\.get/.test(bio),
      "o recorte contém MESMO a chamada do passkey — recorte errado é falha de medição, não resultado");

    ok(!/athletes\.find\(/.test(bio),
      "o login por biometria NÃO busca a pessoa no elenco do circuito aberto — era o que dizia «Cadastro não encontrado» a quem acabou de se autenticar");
    ok(/db\.getAtletaPorId\(atletaId\)/.test(bio),
      "ele busca a identidade GLOBAL no servidor, em todos os circuitos de que a pessoa é membro ativo");
    ok(/não está ativa em nenhum circuito/.test(bio),
      "e distingue «reconhecido mas sem circuito» de «não reconhecido» — a frase antiga misturava os dois");
    ok(!/trocarCircuito\(/.test(bio),
      "e NÃO troca de circuito aqui dentro: quem decide é o onAthleteLogin, um lugar só (a primeira versão disto chamava, e o no-undef da bateria pegou)");

    // A consulta tem de ser por PESSOA e por vínculo ATIVO — nunca por circuito.
    const iCons = fonteApp.indexOf("getAtletaPorId:");
    ok(iCons > 0, "a consulta por identidade global existe no `db`");
    const consulta = fonteApp.slice(iCons, fonteApp.indexOf("\n", iCons));
    ok(/atleta_id=eq\.\$\{id\}/.test(consulta),
      "a consulta filtra por ATLETA, não por circuito");
    ok(/status=eq\.ativo/.test(consulta),
      "e só traz vínculo ativo");
    ok(!/circuito_id=eq/.test(consulta),
      "e NÃO amarra a um circuito — é justamente o que o defeito fazia");

    // A ativação que falha tem de AVISAR. `onAthleteLogin` desmonta a tela, então
    // entrar direto apagava o erro: a pessoa saía acreditando que tinha ativado.
    // Mesma armadilha: `cadastrarBiometria` também existe nos dois componentes.
    // A do atleta recebe `(atleta)`; a do admin não recebe parâmetro — mas recortar
    // do componente é o que garante, em vez de depender da assinatura.
    const iAtiv = comp.indexOf("async function cadastrarBiometria(atleta)");
    const fimAtiv = comp.indexOf("\n  }", iAtiv) + 4;
    ok(iAtiv >= 0 && fimAtiv > iAtiv, "a função de ativação do ATLETA foi localizada");
    const ativ = semComentarios(comp.slice(iAtiv, fimAtiv));
    const iCatch = ativ.lastIndexOf("} catch");
    ok(iCatch > 0, "o ramo de falha da ativação foi localizado");
    const falha = ativ.slice(iCatch);
    ok(/setErr\(/.test(falha),
      "a falha de ativação da biometria AVISA o atleta — antes ela só trocava um status que a tela nunca desenhava");
    ok(!/onAthleteLogin\(/.test(falha),
      "e não entra direto no app apagando o aviso: quem decide seguir é ele, no botão");
  }

  // A CADEIA DOS DOIS TRADUTORES, RODADA DE VERDADE.
  //
  // Não é regex: extrai `mapAtletaFromDb` e `mapAtletaFromCircuito` do fonte e
  // EXECUTA com uma linha na forma exata que o `db.getAtletas()` devolve.
  //
  // Por que precisa rodar: eu tentei responder "o botão Mudei de ideia volta a
  // aparecer?" LENDO o código e errei duas vezes em um minuto — primeiro achando
  // que o campo era descartado (o `grep` não o viu porque ele passa pelo
  // `{...a}`), depois achando que passava. Ler a cadeia não responde; rodar
  // responde. É a mesma lição do `p_circuito`: leitura vazia e leitura por
  // inspeção não são medição.
  //
  // O que isto prende: o pedido de exclusão de dados (LGPD) tem de chegar à tela
  // em circuito não-BH, senão o recibo e o botão "↩️ Mudei de ideia" somem a cada
  // recarregamento enquanto o pedido segue de pé rumo à anonimização irreversível.
  {
    const iDb = fonteApp.indexOf("function mapAtletaFromDb(");
    const fimDb = fonteApp.indexOf("\n}", iDb) + 2;
    const iCa = fonteApp.indexOf("function mapAtletaFromCircuito(");
    const fimCa = fonteApp.indexOf("\n}", iCa) + 2;
    ok(iDb > 0 && fimDb > iDb && iCa > 0 && fimCa > iCa,
      "os dois tradutores de atleta foram localizados no fonte");

    const mapear = new Function(
      `${fonteApp.slice(iDb, fimDb)}\n${fonteApp.slice(iCa, fimCa)}\nreturn mapAtletaFromCircuito;`
    )();

    // A forma EXATA que `db.getAtletas()` devolve: sazonal na raiz, identidade
    // dentro de `atletas`. Se o `select` da linha 211 mudar, este fixture mente —
    // por isso a asserção seguinte confere que o campo está no select de verdade.
    ok(/atletas\([^)]*exclusao_solicitada_em/.test(fonteApp),
      "o `select` da leitura normal pede `exclusao_solicitada_em` dentro de atletas(...)");

    const linha = {
      status: "ativo", saldo_temp: 4, wo_culposos_temporada: 2,
      pagamento_confirmado: true, aceite_regulamento: true,
      atletas: {
        id: "a1", nome: "Teste", rating: 1000,
        aceite_lgpd: true, exclusao_solicitada_em: "2026-09-29T12:00:00Z",
      },
    };
    const saiu = mapear(linha);
    igual(saiu.exclusaoSolicitadaEm, "2026-09-29T12:00:00Z",
      "o pedido de exclusão ATRAVESSA os dois tradutores — é o que faz o recibo e o botão «Mudei de ideia» sobreviverem ao F5 em circuito não-BH");
    igual(saiu.woCulposos ?? saiu.wo_culposos_temporada ?? saiu.woCulpososTemporada, 2,
      "e o contador de W.O. sazonal também atravessa");
    igual(saiu.pagamentoConfirmado, true,
      "e o pagamento — o campo que o painel do organizador mostrava como «Sem pgto» para todos");
  }

  // ⚠️ E o `setSistemaAtivo` com DOIS argumentos (achado MI do mesmo guardião):
  // ignorar o 2º deixa a tela mentindo o método de pareamento, com tudo verde.
  ok(/setSistemaAtivo\(config\?\.\[0\]\?\.sistema \|\| "A", config\?\.\[0\]\?\.pareamento\)/.test(fonteApp),
    "o `setSistemaAtivo` recebe o pareamento junto com o sistema — sem isso a tela do organizador anuncia o método errado");
  // ⚠️ A asserção acima é sobre o PONTO DE CHAMADA, e o Guardião de Confiabilidade
  // mostrou que ela fecha só METADE: sabotar o CORPO da função, que passa a
  // ignorar o argumento que recebeu, continua verde. "Regex protege o texto que
  // ela casa, nada mais." Esta segunda olha o corpo.
  const iSet = fonteApp.indexOf("function setSistemaAtivo(");
  ok(iSet > 0, "o corpo do `setSistemaAtivo` foi localizado");
  const corpoSet = fonteApp.slice(iSet, fonteApp.indexOf("\n}", iSet));
  ok(/PAREAMENTO_ATIVO\s*=\s*\(pareamento === "grupos"\)/.test(corpoSet),
    "e o CORPO dele usa mesmo o argumento `pareamento` — ignorá-lo faria a tela anunciar o método errado com a bateria verde");
}

process.exit(placar("Participar de outro circuito"));
