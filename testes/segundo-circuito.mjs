// Bateria — O SEGUNDO CIRCUITO: o que o admin precisa ver e poder mudar.
//
// Decisão do Juliano em 27/09/2026 (item 0.6.22): o 2º circuito será de PONTOS e
// será um circuito NOVO — não é o BH mudando de sistema. O `CRIAR_CIRCUITO` já
// criava circuito de pontos; o que faltava era o admin conseguir OPERÁ-LO depois.
//
// Duas coisas travavam, as duas do gatilho "antes de abrir o 2º circuito":
//
//   0.10.9  Não havia campo para editar o teto de um circuito existente. O motor
//           sempre aceitou (`DEFINIR_CONFIG_CIRCUITO` apara para 8..20), e a tela
//           não oferecia — pior: ela AFIRMAVA "o teto é fixo em 20 atletas por
//           circuito", frase que deixou de ser verdade quando a criação passou a
//           perguntar. Criar com o teto errado era irreversível pela tela.
//
//   0.10.7  O admin era cego para o regulamento do próprio circuito: não era
//           avisado na criação, não via `regulamento_versao` em tela nenhuma, e o
//           `CRIAR_CIRCUITO` nem devolvia o campo. Some as três: não é avisado,
//           não vê, não muda. Um circuito de rating NOVO nasce SEM o Torneio de
//           Encerramento (que é do BH) — diferença que só aparece no documento que
//           todo atleta daquele circuito vai aceitar.
//
// O que esta fatia deliberadamente NÃO faz: permitir TROCAR a versão do
// regulamento pela tela. Trocar um texto já aceito invalidaria os recibos dos
// atletas (regra 7 do CLAUDE.md). O admin passa a VER; mudar continua não sendo
// operação de tela.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  montarMotor, comoAdmin, circuito, atleta, partida,
  ok, igual, secao, placar, BH, PIN, semComentarios, pinGuardado, comoOrganizador} from "./ferramentas.mjs";
import { carregarFuncao } from "./carrega-motor.mjs";
import { criarBancoFalso, provocandoViolacao } from "./banco-falso.mjs";

const comAdminSlugBH = (motor) => comoAdmin(motor, "CRIAR_CIRCUITO", {
  slug: "bh", nome: "Outro BH", sistema: "B", pareamento: "sorteio",
});

const fonte = readFileSync("src/App.jsx", "utf-8");
// ⚠️ Versão SEM comentários, para as asserções que PROÍBEM uma forma antiga.
// Aconteceu três vezes em 28/09/2026: a asserção que proíbe um texto casava com
// o comentário que EXPLICA por que aquele texto saiu, e ficava verde (ou vermelha)
// pelo motivo errado. Uma asserção que se afoga na própria explicação não protege
// nada. Regra: `fonte` para exigir presença; `fonteSemComentario` para exigir
// ausência.
const fonteSemComentario = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/[^\n]*/gm, "");
const motorFonte = readFileSync("supabase/functions/admin-action/index.ts", "utf-8");
const NOVO = "22222222-2222-2222-2222-222222222222";

// ───────────────────────────────────────────────────────────────────────────────
secao("O INSTRUMENTO primeiro: o banco falso recorta colunas também na escrita");
{
  // Um portão novo tem de ser testado contra si mesmo (lição de 28/09/2026).
  // Este é o portão do instrumento, não do produto.
  //
  // O banco falso projetava colunas só no caminho do `select`. No retorno de
  // `insert(...).select(...)` ele devolvia a linha INTEIRA, qualquer que fosse a
  // lista pedida — mais generoso que o PostgREST real. Medido por mutação: tirar
  // `regulamento_versao` do select do `CRIAR_CIRCUITO` deixava a bateria VERDE,
  // porque a asserção do recibo não tinha como enxergar a diferença.
  // É a MESMA família do furo do `select("*")` em LISTAR_TELEFONES, que ficava
  // verde devolvendo `pin_hash` de todo mundo. Sem esta asserção, nada obriga a
  // projeção na escrita a continuar existindo.
  const { banco } = await montarMotor({ circuitos: [circuito(BH)] });
  const { data } = await banco.cliente.from("circuitos")
    .insert({ id: NOVO, slug: "instrumento", nome_circuito: "Instrumento", sistema: "B", regulamento_versao: "vB-01", max_atletas: 16 })
    .select("id, slug").single();
  ok(data && "id" in data && "slug" in data, "o insert com select devolve as colunas pedidas");
  ok(!("regulamento_versao" in (data || {})), "e NÃO devolve as que não foram pedidas — como o PostgREST real");
  ok(!("max_atletas" in (data || {})), "nem outra coluna que ficou fora da lista");

  const { data: tudo } = await banco.cliente.from("circuitos")
    .insert({ id: "33333333-3333-3333-3333-333333333333", slug: "instrumento-2", nome_circuito: "Instrumento 2", sistema: "B" })
    .select("*").single();
  ok(tudo && "sistema" in tudo && "slug" in tudo, 'e `select("*")` continua devolvendo tudo');
}

// ───────────────────────────────────────────────────────────────────────────────
secao("O 2º circuito nasce de PONTOS, e o servidor devolve o recibo do que gravou");
{
  const { banco, motor } = await montarMotor({ funcoes: { arquivar_partidas_temporada_circuito: () => null } });
  const r = await comoAdmin(motor, "CRIAR_CIRCUITO", {
    slug: "bh-pontos", nome: "Circuito BH — Pontos", cidade: "Belo Horizonte", uf: "MG",
    sistema: "B", pareamento: "sorteio", maxAtletas: 16, // pedido de propósito: tem de ser IGNORADO
  });
  ok(r.corpo?.sucesso === true, `CRIAR_CIRCUITO de pontos respondeu sucesso (veio: ${JSON.stringify(r.corpo?.erro ?? r.corpo?.sucesso)})`);

  const criado = banco.acha("circuitos", c => c.slug === "bh-pontos");
  igual(criado?.sistema, "B", "o circuito nasce no Sistema B");
  igual(criado?.pareamento, "sorteio", "com o pareamento que o admin escolheu");
  igual(criado?.regulamento_versao, "vB-01", "e carimbado com o regulamento de PONTOS, não com o v03-12 do BH");
  igual(criado?.max_atletas, 20,
    "e com o teto da PLATAFORMA (20) — o `maxAtletas: 16` do pedido é ignorado de propósito");
  igual(criado?.inscricoes_abertas, false, "nasce com as inscrições FECHADAS — ninguém entra por acidente");

  // 0.10.7: o recibo. Antes o select não trazia a versão, então a tela de
  // confirmação não tinha como dizer sob qual regulamento o circuito nasceu —
  // e o admin descobria (ou não) depois, por outro caminho.
  igual(r.corpo?.dados?.regulamento_versao, "vB-01",
    "e o SERVIDOR devolve a versão, para a confirmação mostrar o que foi gravado e não o que a tela mandou");
  igual(r.corpo?.dados?.max_atletas, 20,
    "e devolve o teto gravado também — que é o da plataforma, não o pedido");
}

// ───────────────────────────────────────────────────────────────────────────────
secao("O teto NÃO é configurável por circuito — decisão do Juliano, 29/09/2026");
{
  // HISTÓRIA, porque esta seção já defendeu o contrário e o registro importa:
  // a fatia 0.10.9 chegou a criar o campo do teto na tela (o motor já aceitava), e
  // foi DESFEITA antes de subir. Perguntei ao Juliano se a decisão dele de 10/09 —
  // "o teto é regra da plataforma, 20 para todos" — ficava revogada pelo código,
  // que tinha ido para o outro lado em duas ondas. Ela **fica de pé**. Então quem
  // estava fora da decisão era o código, não o texto.
  const { banco, motor } = await montarMotor({
    circuitos: [circuito(BH), circuito(NOVO, { slug: "bh-pontos", sistema: "B", pareamento: "sorteio", max_atletas: 20, regulamento_versao: "vB-01" })],
    funcoes: { arquivar_partidas_temporada_circuito: () => null },
  });
  const r = await comoAdmin(motor, "DEFINIR_CONFIG_CIRCUITO", { circuitoId: NOVO, nome: "Circuito BH — Pontos", maxAtletas: 12 });
  const c = banco.acha("circuitos", x => x.id === NOVO);
  igual(c?.max_atletas, 20, "mandar `maxAtletas` na configuração NÃO muda o teto — ele não é mais escrito por aqui");
  igual(c?.nome_circuito, "Circuito BH — Pontos", "e o resto da configuração continua funcionando");
  igual(c?.regulamento_versao, "vB-01", "e a versão do regulamento não é tocada por um salvamento de configuração");
  ok(r.corpo?.sucesso === true, "a chamada não falha — o campo é ignorado, não recusado");
}

// ───────────────────────────────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────────────────────────────
secao("A tela deixou de mentir sobre o teto, e passou a mostrar o regulamento");
{
  // A afirmação "o teto é fixo em 20 atletas por circuito" saiu do card em 28/09,
  // e o campo que a substituiu saiu em 29/09. O que sobrou é o certo: a tela não
  // pergunta o teto em lugar nenhum, e a criação AVISA qual é.
  ok(!/O teto é fixo em 20 atletas por circuito/.test(fonteSemComentario),
    "a frase antiga do card não voltou");
  ok(!/Máx\. de atletas<\/(div|label)>/.test(fonte),
    "e não há campo de teto em tela nenhuma — nem na criação, nem na configuração");
  ok(!/tetoEdit|tetoValido|tetoFechaEntrada/.test(fonteSemComentario),
    "nem o estado que sustentava o campo");
  ok(/Todo circuito tem teto de <strong[^>]*>20 atletas<\/strong> por temporada/.test(fonte),
    "a criação avisa qual é o teto — o admin não descobre depois");
  ok(/não se configura por circuito/.test(fonte),
    "e diz que é regra da plataforma, não escolha dele");
}
{
  // 0.10.7 — o admin VÊ a versão. Só leitura, e a tela diz por quê.
  ok(/Regulamento em vigor neste circuito/.test(fonte),
    "o card de configuração mostra a versão do regulamento do circuito");
  ok(/\{state\.regulamentoVersao \|\| "não definido"\}/.test(fonte),
    "lendo do estado do circuito carregado, não de uma constante");
  // A frase aponta para o card VIZINHO (que troca de verdade, com confirmação por
  // nome) em vez de parecer negar que exista caminho — e diz coisa diferente para
  // o organizador, para quem aquele card não aparece.
  ok(/Para trocar, use o card <strong[^>]*>📋 Regulamento deste circuito<\/strong>, logo acima/.test(fonte),
    "para o super-admin, a frase aponta para o card que troca de verdade");
  ok(/só o dono da plataforma troca/.test(fonte),
    "e para o organizador, diz QUEM troca — porque para ele aquele card não aparece");
  ok(!/invalidaria os aceites|invalidaria os recibos/.test(fonteSemComentario),
    "e nenhuma tela diz que trocar 'invalidaria' os aceites — o aceite não fica inválido");
  ok(/apontarem para um texto que ninguém leu/.test(fonte),
    "ela diz o mecanismo certo: o aceite passa a apontar para outro texto");

  // ⚠️ A 2ª oração era FALSA no BH: dizia que os atletas ACEITARAM a versão em
  // vigor, e 14 dos 15 aceitaram v03-3/v03-5/v03-8/v03-11.
  ok(!/É o texto que os atletas aceitaram ao se inscrever/.test(fonteSemComentario),
    "o card não afirma mais que os atletas ACEITARAM a versão em vigor — no BH isso é falso para 14 de 15");
  ok(/os atletas <strong[^>]*>aceitam<\/strong> ao se inscrever/.test(fonte),
    "ele descreve o mecanismo no presente, o que é verdade em qualquer circuito");
  ok(/const semAceite = atletasSemAceite\(state\);/.test(fonte),
    "e o card CONTA quem não aceitou, usando a função que já existia para isso");
  ok(/\{semAceite\.length\} de \{ativosTotal\} atletas ainda não aceitaram esta versão/.test(fonte),
    "mostrando o número na tela — o card vira o gatilho do 0.10.11 em vez de escondê-lo");
  ok(!/DEFINIR_CONFIG_CIRCUITO",payload:\{[^}]*regulamento/.test(fonte),
    "e nenhum botão desta tela manda trocar a versão");
}
{
  // 0.10.7 — o AVISO na criação, antes de criar. A parte que o Guardião do Admin
  // chamou de "não é avisado".
  // ⚠️ Fatia até a PRÓXIMA declaração de função, nunca `+ N` caracteres. Uma
  // janela fixa é um número mágico: quando o trecho cresce, a asserção passa a
  // olhar para fora do alvo e vira verde permanente. Foi o achado do Guardião do
  // Regulamento sobre a fatia de 1200 do `DEFINIR_CONFIG_CIRCUITO` — e a janela
  // de 9000 aqui quebrou na primeira vez que o bloco cresceu.
  const iCriar = fonte.indexOf("function CriarCircuitoCard");
  const fimCriar = fonte.indexOf("\nfunction ", iCriar + 1);
  ok(iCriar > 0 && fimCriar > iCriar, "o componente de criação foi localizado no fonte");
  const criar = fonte.slice(iCriar, fimCriar);
  ok(/Regulamento que este circuito vai usar/.test(criar),
    "o formulário de criação diz qual regulamento o circuito vai usar, ANTES de criar");
  ok(/vA-nc-01/.test(criar) && /vB-01/.test(criar),
    "e nomeia as duas versões possíveis");
  // "A diferença que importa" elegia UMA de TRÊS, e deixava de fora a que mais
  // pesa para quem está definindo preço: o desconto de quem entra na 2ª etapa.
  ok(!/A diferença que importa/.test(criar),
    "o aviso não elege mais UMA diferença como 'a que importa'");
  ok(/são <strong[^>]*>três diferenças<\/strong>/.test(criar),
    "ele nomeia as TRÊS: torneio, desconto de entrada e rodadas fixas");
  ok(/o do BH dá 80% a quem entra na 2ª/.test(criar),
    "e a de DINHEIRO aparece explícita — é a que muda quanto o atleta paga");
  // ⚠️ ESTA ASSERÇÃO CARIMBAVA UM ERRO MEU, e ela sai por isso (29/09/2026).
  // Eu escrevi no aviso que o `vA-nc-01` não tem "o Torneio nem o certificado do
  // Top 3", estendendo ao rating novo uma ausência que eu tinha confirmado só para
  // o `vB-01`. O texto de RATING promete "Top 3 recebe certificado digital" **sem
  // portão de versão** — então o `vA-nc-01` promete sim, e o meu aviso mentia.
  // A assimetria era na pior direção: o ADMIN lia que não há certificado (logo não
  // emitiria) enquanto o ATLETA lia que ele está incluído no que pagou.
  // Entre mudar o que o atleta foi prometido e corrigir o meu aviso, corrigi o
  // aviso. Se o circuito novo NÃO deve ter certificado, é decisão de produto do
  // Juliano — está no ROADMAP, e aí o portão nasce nos DOIS lugares de uma vez.
  ok(/o certificado digital do Top 3, esse continua/.test(criar),
    "o aviso diz a verdade sobre o certificado: o circuito de rating novo TEM");
  ok(/Top 3 recebe certificado digital/.test(fonte),
    "e o regulamento de rating realmente promete — é o que sustenta o aviso");
  ok(/nem certificado/.test(criar),
    "já o de PONTOS não tem, e o aviso continua dizendo isso");
  ok(/não muda depois/.test(criar),
    "e que o regulamento não muda depois");
  ok(/\{criado\.regulamento_versao \|\| "não confirmado/.test(criar),
    "e a confirmação mostra a versão que o SERVIDOR gravou — e diz quando ela não veio, em vez de sumir");
  ok(/\{criado\.max_atletas \?/.test(criar),
    "o teto tem guarda PRÓPRIA — antes ele sumia junto com a versão, embora tivesse vindo");
}

// ───────────────────────────────────────────────────────────────────────────────
secao("O BH: o slug reservado, e o campo que não pode guardar o circuito errado");
{
  // Regra 2. O Guardião de Confiabilidade mutou a reserva do slug e a bateria
  // ficou VERDE — lacuna de asserção. O dente de verdade está no banco
  // (`circuitos_slug_key UNIQUE`), então não era risco; mas a guarda da aplicação
  // é defesa em profundidade e custa duas linhas. E o motivo de ela importar:
  // `bhId()` faz `.eq("slug","bh").single()`, e duas linhas `bh` derrubariam TODA
  // ação do motor que resolve o BH.
  const { banco, motor } = await montarMotor({
    circuitos: [circuito(BH)],
    funcoes: { arquivar_partidas_temporada_circuito: () => null },
  });
  const r = await comAdminSlugBH(motor);
  igual(r.status, 400, "criar um segundo circuito com o slug 'bh' é RECUSADO");
  ok(/reservado/.test(String(r.corpo?.erro || "")), "e a recusa diz que o slug é reservado ao BH");
  igual(banco.tabelas.circuitos.length, 1, "e nada é criado — o BH continua sendo a única linha");
}
{
  // ⚠️ A MINHA ASSERÇÃO ANTERIOR ERA FALSA, E DO JEITO MAIS PERIGOSO: ela PARECIA
  // proteção. O texto prometia "todo campo do painel inicializado do estado
  // ressincroniza quando o circuito troca" — e a janela ia de `function
  // AdminDashboard(` até a PRÓXIMA `function`, que é justamente
  // `function AbrirProximaPanel(`. Medido: a janela enxergava UM campo
  // (`setNomeEdit`) e parava exatamente onde os campos tortos começavam.
  // Dentro do `AbrirProximaPanel`, que o painel RENDERIZA, havia dois:
  // `setNomeNova ← state.nomeCircuito` e `setPix ← state.pixChave`, nenhum com
  // resync — e o `pix` é a chave que SAI POR WHATSAPP na mensagem de renovação.
  // A bateria estava VERDE com o defeito dentro do painel que a asserção dizia
  // cobrir, sem precisar de sabotagem nenhuma.
  // É a lição do CLAUDE.md reaparecendo: "a janela ancorada na função é fiel ao
  // CORPO dela e por isso não vê quem a invoca". (Auditoria multi-circuito, 29/09.)
  //
  // O CONSERTO NÃO FOI CAMPO A CAMPO: tapar `pix` e `nomeNova` fecharia UM caminho
  // de uma classe, e o próximo painel nasceria torto. O painel inteiro passou a
  // remontar na troca (`key={circuitoSelId}`), e esta asserção passou a varrer o
  // ARQUIVO INTEIRO com lista declarada.
  const campos = [...fonte.matchAll(/const \[\w+, (set\w+)\] = useState\((?:\(\) => )?(?:String\()?state\.(\w+)/g)];
  ok(campos.length > 0, "há campos de tela inicializados a partir do estado do circuito");

  const funcoes = [...fonte.matchAll(/^function (\w+)\(/gm)].map(m => ({ nome: m[1], i: m.index }));
  const donoDe = (pos) => { let d = null; for (const f of funcoes) if (f.i < pos) d = f.nome; else break; return d; };
  const donos = [...new Set(campos.map(c => donoDe(c.index)))].sort();

  // LISTA DECLARADA: componente novo com campo derivado do estado OBRIGA alguém a
  // vir aqui dizer como ele está protegido. Mesmo padrão do documento do
  // regulamento — linha nova tem de ser declarada, não suposta.
  const declarados = {
    AdminDashboard:    "key={circuitoSelId} — remonta na troca, e os painéis-filhos junto",
    AbrirProximaPanel: "filho do AdminDashboard, coberto pela key do pai. Guardava a CHAVE PIX do circuito anterior",
    AdminFinanceiro:   "key={circuitoSelId}",
    AdminMensagens:    "key={circuitoSelId}",
  };
  const naoDeclarados = donos.filter(d => !(d in declarados));
  igual(naoDeclarados.length, 0,
    `todo componente com campo derivado do estado do circuito está declarado e protegido (sem declaração: ${naoDeclarados.join(", ")})`);

  for (const comp of ["AdminDashboard", "AdminHistorico", "AdminMensagens", "AdminFinanceiro"]) {
    ok(new RegExp(`<${comp} key=\\{circuitoSelId\\}`).test(fonte), `${comp} remonta ao trocar de circuito`);
  }
}

// ───────────────────────────────────────────────────────────────────────────────
secao("Em circuito NOVO, gravação que falha não responde 'sucesso' (0.6.18)");
{
  // Achado do Guardião de Confiabilidade em 27/09/2026; consertado em 29/09, ANTES
  // de existir o 2º circuito — que é quando ele deixaria de ser inalcançável.
  //
  // O DEFEITO, e por que ele é de circuito NOVO e não do BH: no BH, `atletas` é a
  // fonte e `circuito_atletas` é o espelho; se o espelho falhar, engolir o erro é o
  // certo, porque a operação do BH não pode quebrar por causa de uma cópia. Em
  // circuito não-BH **não há fonte do outro lado**: `status`, `pendente_circuito` e
  // `chave` são colunas SAZONAIS, então o bloco de identidade sai vazio e o upsert
  // É A ÚNICA ESCRITA. Engolir o erro ali fazia a ação responder `sucesso: true`
  // com NADA gravado — e a tela se autocorrigia no `loadFromSupabase()` seguinte,
  // mostrando o atleta como antes. O admin via "sucesso" e o oposto do que pediu,
  // sem uma pista do que houve.
  //
  // É CLASSE, NÃO CASO: vale para `ARQUIVAR_ATLETA`, `DESARQUIVAR_ATLETA`,
  // `INCLUIR_NO_CIRCUITO`, `RECUSAR_CIRCUITO` e `DEFINIR_DESCONTO_ATLETA` — todas
  // passam pelo `writeAtleta`. Por isso o teste exercita mais de uma.
  const ATL = "dddd0001-0000-4000-8000-000000000881";

  async function cenarioNovo() {
    const { motor, banco } = await montarMotor({
      circuitos: [circuito(BH), circuito(NOVO, { slug: "novo-pontos", sistema: "B", pareamento: "grupos", fase: "inscricoes" })],
      atletas: [atleta(ATL, { nome: "Atleta do circuito novo" })],
      circuito_atletas: [{ id: "cn-1", circuito_id: NOVO, atleta_id: ATL, status: "ativo", pendente_circuito: true, saldo_temp: 0, vitorias: 0, derrotas: 0 }],
      funcoes: { arquivar_partidas_temporada_circuito: () => null },
    });
    return { motor, banco };
  }

  // Com o banco recusando a gravação sazonal, a ação NÃO pode dizer sucesso.
  for (const [acao, payloadExtra] of [
    ["INCLUIR_NO_CIRCUITO", {}],
    ["ARQUIVAR_ATLETA", {}],
  ]) {
    const { motor, banco } = await cenarioNovo();
    banco.recusar("circuito_atletas", "upsert", { message: "permission denied", code: "42501" });
    const r = await comoAdmin(motor, acao, { circuitoId: NOVO, id: ATL });
    ok(r.status >= 400, `${acao}: com a gravação recusada, a ação NÃO responde sucesso (veio ${r.status})`);
    ok(r.corpo?.sucesso !== true, `${acao}: e o corpo não diz sucesso`);
    igual(banco.acha("circuito_atletas", m => m.atleta_id === ATL)?.pendente_circuito, true,
      `${acao}: e o atleta continua como estava — sem meio-estado`);
  }

  // E o caminho feliz continua funcionando — senão eu teria "consertado" fechando tudo.
  {
    const { motor, banco } = await cenarioNovo();
    const r = await comoAdmin(motor, "INCLUIR_NO_CIRCUITO", { circuitoId: NOVO, id: ATL });
    igual(r.status, 200, "sem recusa, incluir no circuito novo funciona");
    igual(banco.acha("circuito_atletas", m => m.atleta_id === ATL)?.pendente_circuito, false,
      "e o atleta entra de verdade");
  }

  // ⚠️ O BH NÃO MUDA: lá o espelho continua best-effort, porque lá ele é mesmo
  // espelho. Se esta asserção ficar vermelha, o conserto vazou para o lado errado.
  const motorFonte2 = await import("node:fs/promises").then(f => f.readFile("supabase/functions/admin-action/index.ts", "utf-8"));
  ok(/if \(!ehEspelho\) throw e;/.test(motorFonte2),
    "o erro só sobe quando a gravação é a ÚNICA — não quando é espelho");
  ok(/await mirrorSazonal\(circuitoId, atletaId, campos, \{\}, escreveuIdentidade\);/.test(motorFonte2),
    "e quem decide isso é se algo foi gravado em `atletas` — não uma lista de ações");
}

// ───────────────────────────────────────────────────────────────────────────────
secao("O atleta na fila sabe que está na fila, e o admin sabe quem fica de fora (0.6.16, 0.6.6)");
{
  const fonteApp = await import("node:fs/promises").then(f => f.readFile("src/App.jsx", "utf-8"));

  // ── 0.6.16: quem está aprovado aguardando vaga sai do ranking, então a POSIÇÃO
  // vira "—" enquanto pontos e rating continuam na tela. Ficava com cara de
  // DEFEITO, e não havia uma linha explicando em lugar nenhum do app.
  // ⚠️ REESCRITA EM 01/10/2026. A asserção antiga ancorava em
  // `const naFilaDeEspera = eu.status === "ativo" && eu.pendenteCircuito;` e em
  // `{naFilaDeEspera && (` — as duas DENTRO do `AthleteGames`. O card saiu de lá: ele
  // só renderizava sob `tab === "meus_jogos"`, e a aba é restaurada do localStorage,
  // então quem fechava o app no Ranking reabria no Ranking e NUNCA achava a
  // explicação de por que não estava no Ranking.
  //
  // A intenção da asserção antiga continua valendo e está preservada abaixo: a caixa
  // tem de renderizar sob CONDIÇÃO, não ser texto morto. O mecanismo agora é o
  // `return null` de um componente próprio, e a condição nova — que é o conserto —
  // é ele estar FORA da aba.
  const iFila = fonteApp.indexOf("function FilaDeEsperaCard(");
  ok(iFila > 0, "o card de fila é um componente próprio, fora do AthleteGames");
  const fila = fonteApp.slice(iFila, fonteApp.indexOf("\nfunction ", iFila + 10));
  ok(/eu\.status === "ativo" && eu\.pendenteCircuito/.test(fila),
    "e reconhece o estado 'aprovado, aguardando vaga'");
  ok(/return null;/.test(fila),
    "e não renderiza nada fora dele — a caixa é condicional, não texto morto");
  ok(/<FilaDeEsperaCard state=\{state\} athlete=\{athlete\} \/>\{content\}/.test(fonteApp),
    "e é renderizado ANTES do `content`, ou seja FORA da aba — era o conserto que faltava");
  ok(/<AvisoWoCard state=\{state\} athlete=\{athlete\} \/>/.test(fonteApp),
    "e o aviso de W.O. também saiu da aba — é o «aviso formal» que a auditoria criou para ninguém ser suspenso sem saber do 1º");
  ok(!/\{naFilaDeEspera && \(/.test(fonteApp),
    "e a versão presa na aba não existe mais");
  ok(/Sua inscrição foi aprovada — você está na fila de espera/.test(fonteApp),
    "e diz isso a ele, com essas palavras");
  ok(/não é erro do app/.test(fonteApp),
    "e nomeia o que ele estava pensando: que era defeito");
  // ⚠️ O que a caixa NÃO pode fazer: prometer posição na fila ou data. A ordem é
  // por data de inscrição, mas `INCLUIR_NO_CIRCUITO` recebe um id — o admin pode
  // incluir qualquer um, e o regulamento diz que a entrada é "mediante avaliação e
  // aprovação do administrador". Número na tela criaria expectativa que o app pode
  // quebrar legitimamente: trocaríamos um silêncio por uma promessa falsa.
  const iCaixa = fonteApp.indexOf("Sua inscrição foi aprovada — você está na fila de espera");
  const caixa = fonteApp.slice(iCaixa, iCaixa + 1400);
  ok(!/\d+º (lugar|da fila)|posição na fila|você é o/i.test(caixa),
    "e NÃO promete posição na fila — a ordem é sugerida, não garantida");
  ok(/depende da aprovação do organizador/.test(caixa),
    "dizendo justamente isso");

  // A mensagem de WhatsApp prometia mais que o regulamento que ele aceitou.
  ok(/assim que houver vaga/.test(fonteApp),
    "e a mensagem de inscrição aprovada deixou de dizer 'você entra' sem condição");
  igual((fonteApp.match(/assim que houver vaga/g) || []).length, 2,
    "nas duas frases que prometiam entrada (próxima temporada e próxima etapa)");

  // ── 0.6.6: com a cobrança ligada, quem não pagou fica FORA do pareamento, e o
  // pareamento é tirado no início da rodada. Pagar depois não traz de volta.
  ok(/const naoPagaram = state\.financeiroAtivo/.test(fonteApp),
    "o painel calcula quem fica de fora por falta de pagamento");
  ok(/\{naoPagaram\.length > 0 && \(/.test(fonteApp),
    "o aviso é renderizado quando há quem fique de fora — não é texto morto");
  ok(/ficam de fora desta rodada/.test(fonteApp),
    "e avisa o admin ANTES de ele clicar em iniciar");
  // ATUALIZADA em 11/10/2026: dizia "rodada seguinte", e `AVANCAR_RODADA` gera
  // DUAS rodadas por avanço (`const rA = roundBase + 1, rB = roundBase + 2`) —
  // o prazo prometido ao organizador era ~metade do real.
  ok(/Quem pagar depois entra só no próximo par de rodadas/.test(fonteApp),
    "dizendo a consequência exata: pagar depois não traz de volta para esta rodada");
  ok(/naoPagaram\.map\(a=>nomeExibicao\(a\)\)\.join\(", "\)/.test(fonteApp),
    "e com NOMES — para o admin poder resolver, não só saber");

  // ⚠️ E a paridade e o mínimo passaram a contar QUEM VAI JOGAR, não quem está
  // ativo. Com a cobrança ligada, contar os ativos dizia "12, número par" enquanto
  // o motor parearia 9 — os dois avisos (bye e mínimo) ficavam errados juntos.
  ok(/const impar = vaoJogar % 2 !== 0;/.test(fonteApp),
    "o aviso do bye conta quem VAI JOGAR, não quem está ativo");
  ok(/const faltam = Math\.max\(0, MINIMO - vaoJogar\);/.test(fonteApp),
    "e o do mínimo de 8 também — senão os dois mentiriam juntos com a cobrança ligada");

  // O motor confirma que o filtro existe: é ele que torna o aviso verdadeiro.
  const motorTxt = await import("node:fs/promises").then(f => f.readFile("supabase/functions/admin-action/index.ts", "utf-8"));
  igual((motorTxt.match(/if \(exigePagamento\) q = q\.eq\("pagamento_confirmado", true\);/g) || []).length, 2,
    "o motor realmente exclui quem não pagou do roster — nos dois caminhos, BH e não-BH");
}

// ───────────────────────────────────────────────────────────────────────────────
secao("Trocar de circuito: a troca DIZ se aconteceu, e a agenda é invalidada");
{
  // Duas saídas silenciosas do `trocarCircuito` e um cache que sobrevivia à troca.
  // As duas foram achadas pela auditoria multi-circuito de 29/09/2026 e são do
  // tipo que só aparece com dois circuitos — mas a segunda tem uma janela HOJE.
  //
  // (a) `trocarCircuito` devolvia `undefined` em dois casos — carga em andamento, e
  //     falha de carga com reversão. Quem chamava seguia adiante achando que estava
  //     no circuito novo. O caminho que dói: os Despachos do Dia trocam de circuito
  //     e em seguida mandam `PROCESSAR_RODADA`, que **calcula rating/pontos e não
  //     pode ser desfeito**. Com a troca no-opada, processava a rodada do circuito
  //     ERRADO — e a faixa verde anunciava o nome do circuito que não foi tocado.
  //
  // (b) a agenda de telefones (`telefones`) é **por circuito** — `LISTAR_TELEFONES`
  //     filtra por circuito no motor —, mas `garantirTelefones()` devolve o cache
  //     sem reconsultar quando ele já tem algo, e a troca não o limpava. Além do
  //     botão de WhatsApp montar link sem destinatário, o modal de editar abria com
  //     o telefone VAZIO e salvar gravava `telefone: ""` na tabela GLOBAL `atletas`
  //     — que é a CREDENCIAL DE LOGIN do atleta em TODOS os circuitos.
  const fonteApp2 = await import("node:fs/promises").then(f => f.readFile("src/App.jsx", "utf-8"));
  const iTroca = fonteApp2.indexOf("async function trocarCircuito(circ)");
  const fimTroca = fonteApp2.indexOf("\n  }", iTroca) + 4;
  ok(iTroca > 0 && fimTroca > iTroca, "a função de trocar circuito foi localizada");
  const troca = fonteApp2.slice(iTroca, fimTroca);

  igual((troca.match(/return false;/g) || []).length, 3,
    "as TRÊS saídas sem troca devolvem `false` — nenhuma sai em silêncio");
  ok(/return true;/.test(troca), "e a saída com troca devolve `true`");
  ok(!/\breturn;\s*$/m.test(troca), "nenhum `return` mudo sobrou");
  ok(/setTelefones\(\{\}\);/.test(troca),
    "e a agenda de telefones é invalidada na troca — ela é por circuito");

  // Quem chama tem de ABORTAR quando a troca não aconteceu.
  ok(/const trocou = await trocarCircuito\(\{ id: c\.id \}\);\s*\n\s*if \(!trocou\)/.test(fonteApp2.replace(/\r/g, "")),
    "quem troca antes de uma ação confere o resultado antes de seguir");
  // ⚠️ ESTA ASSERÇÃO PUNIA O CONSERTO CERTO, e é o pior tipo de asserção que
  // existe neste projeto.
  //
  // Ela dizia `igual(..., 2, "nos DOIS lugares")`. Havia CINCO chamadores de
  // `trocarCircuito` e só dois conferiam o retorno — inclusive o do login do
  // atleta, onde uma falha de rede o deixava no BH em silêncio, que é o sintoma
  // que aquele bloco existia para consertar. Corrigir o terceiro deixava a bateria
  // VERMELHA sem defeito nenhum: ela defendia o número de hoje, não a regra.
  // Achado do Supervisor do Atleta, que previu a vermelha antes de ela acontecer —
  // e ela aconteceu exatamente assim quando eu fiz o conserto.
  //
  // A forma nova se mantém sozinha: conta os chamadores e exige que TODOS
  // confiram. Chamador novo sem conferência fica vermelho por construção, e
  // conserto certo nunca mais fica vermelho.
  {
    const chamadas = (fonteApp2.match(/trocarCircuito\(/g) || []).length - 1; // −1: a definição
    const conferencias = (fonteApp2.match(/if \(!trocou\)/g) || []).length;
    ok(chamadas > 0, `há chamadores de trocarCircuito no app (${chamadas})`);
    igual(conferencias, chamadas,
      `TODOS os ${chamadas} chamadores de trocarCircuito conferem o retorno — nenhum troca de circuito em silêncio`);
  }
  ok(/nada foi processado/.test(fonteApp2),
    "e a recusa diz ao admin que NADA foi processado — não deixa dúvida");

  // A guarda de última linha: telefone vazio não apaga o login do atleta.
  ok(/if \(!String\(editTelefone \|\| ""\)\.trim\(\)\) \{/.test(fonteApp2),
    "salvar com telefone vazio é recusado — ele é o login do atleta em todos os circuitos");
}

// ───────────────────────────────────────────────────────────────────────────────
secao("O que NÃO mudou: o carimbo de quem já aceitou e o sistema do circuito");
{
  // O motor continua sem ação para trocar o sistema de um circuito (0.6.22), e
  // sem ação para trocar a versão do regulamento pela tela. Se um dia alguma das
  // duas nascer, estas asserções ficam vermelhas — e é o sinal de que a decisão
  // do 0.6.22 está sendo tomada, não de que algo quebrou.
  ok(!/case "TROCAR_SISTEMA"/.test(motorFonte),
    "não existe ação para trocar o sistema de um circuito — o 2º circuito é NOVO, não o BH convertido");
  const motorSemComentario = motorFonte.replace(/\/\/[^\n]*/g, "");
  ok(!/p\.maxAtletas/.test(motorSemComentario),
    "o motor não lê `maxAtletas` do cliente em lugar nenhum — nem na criação, nem na configuração");
  ok(/const maxAtletas = 20;/.test(motorFonte),
    "a criação crava 20, o teto da plataforma");
  // Mesma razão: até o PRÓXIMO `case "`, não `+1200`. O case tinha 836 caracteres
  // e a janela 1200 — 364 de folga num case que acumula campos de configuração.
  // Com ele crescido, a escrita proibida cairia FORA da janela e a bateria ficaria
  // verde com `regulamento_versao` sendo reescrito num salvamento de config.
  const iCfg = motorFonte.indexOf('case "DEFINIR_CONFIG_CIRCUITO"');
  const fimCfg = motorFonte.indexOf('case "', iCfg + 10);
  ok(iCfg > 0 && fimCfg > iCfg, "o case da configuração foi localizado, e a fatia vai até o case seguinte");
  const trechoCfg = motorFonte.slice(iCfg, fimCfg);
  ok(!/regulamento_versao/.test(trechoCfg),
    "o DEFINIR_CONFIG_CIRCUITO não toca regulamento_versao — o recibo do atleta não se reescreve por um salvamento de configuração");
}

secao("A auto-validação de placar é DO CIRCUITO — RODANDO o motor, não lendo o texto");
{
  // Achado do Guardião de Segurança em 29/09/2026, rodando este motor: o
  // `ENVIAR_PLACAR` lia `from("configuracao").eq("id", 1)` — a tabela LEGADA, que
  // é do BH — **em qualquer circuito**. O `DEFINIR_AUTO_VALIDAR` grava, para
  // circuito não-BH, em `circuitos.auto_validar_placar`: uma coluna que existe,
  // que a tela mostra, e que NINGUÉM LIA.
  //
  // O efeito prático era este, e é o motivo de a asserção RODAR em vez de casar
  // regex: com o BH ligado (o estado de produção de hoje) e o circuito novo
  // DESLIGADO, a partida do circuito novo era auto-validada assim mesmo — e o
  // organizador dele não tinha botão nenhum que resolvesse, porque o botão
  // gravava na coluna que o motor não consultava.
  //
  // As quatro combinações, porque duas delas passariam verde por acidente: se o
  // teste só medisse "BH ligado / novo desligado", trocar a leitura por
  // `false` fixo também passaria.
  const NOVO = "44444444-4444-4444-4444-444444444444";

  const cenario = async ({ bhLiga, novoLiga }) => {
    const { banco } = await montarMotor({
      circuitos: [
        circuito(BH, { auto_validar_placar: bhLiga }),
        circuito(NOVO, { slug: "novo", sistema: "B", auto_validar_placar: novoLiga }),
      ],
      configuracao: [{ id: 1, fase: "temporada", temporada_numero: 1, temporada_ano: 2026, rodadas_por_temporada: 6, auto_validar_placar: bhLiga }],
      atletas: [atleta("a1"), atleta("a2")],
      chaves: [
        { id: "chave1", nome: "Chave A", rodada_atual: 1, circuito_id: BH },
        { id: "chaveN", nome: "Chave N", rodada_atual: 1, circuito_id: NOVO },
      ],
      partidas: [
        // Um envio já registrado pelo atleta 2, batendo com o que o atleta 1 vai
        // mandar: é a condição em que a auto-validação dispara.
        partida("jBH", { circuito_id: BH, chave_id: "chave1", atleta1_id: "a1", atleta2_id: "a2", p2_placar1: 3, p2_placar2: 1 }),
        partida("jNO", { circuito_id: NOVO, chave_id: "chaveN", atleta1_id: "a1", atleta2_id: "a2", p2_placar1: 3, p2_placar2: 1 }),
      ],
    });
    const fn = await carregarFuncao("athlete-action", banco);
    const enviar = (circuitoId, matchId) => fn.chamar({
      acao: "ENVIAR_PLACAR",
      payload: { circuitoId, matchId, athleteId: "a1", score1: 3, score2: 1 },
    });
    return { banco, enviar };
  };

  const validou = (banco, id) => banco.acha("partidas", j => j.id === id)?.validado === true;

  {
    const { banco, enviar } = await cenario({ bhLiga: true, novoLiga: false });
    await enviar(BH, "jBH");
    await enviar(NOVO, "jNO");
    ok(validou(banco, "jBH"), "BH ligado: a partida do BH é auto-validada");
    ok(!validou(banco, "jNO"),
      "BH ligado e circuito novo DESLIGADO: a partida do circuito novo NÃO é auto-validada — era exatamente isto que quebrava");
  }
  {
    const { banco, enviar } = await cenario({ bhLiga: false, novoLiga: true });
    await enviar(BH, "jBH");
    await enviar(NOVO, "jNO");
    ok(!validou(banco, "jBH"), "BH desligado: a partida do BH não é auto-validada");
    ok(validou(banco, "jNO"),
      "circuito novo LIGADO com o BH desligado: a partida dele É auto-validada — o botão do organizador passou a valer");
  }
  {
    const { banco, enviar } = await cenario({ bhLiga: false, novoLiga: false });
    await enviar(BH, "jBH"); await enviar(NOVO, "jNO");
    ok(!validou(banco, "jBH") && !validou(banco, "jNO"), "os dois desligados: nenhuma partida se auto-valida");
  }
  {
    const { banco, enviar } = await cenario({ bhLiga: true, novoLiga: true });
    await enviar(BH, "jBH"); await enviar(NOVO, "jNO");
    ok(validou(banco, "jBH") && validou(banco, "jNO"), "os dois ligados: as duas partidas se auto-validam");
  }

  // E a origem da leitura, para ninguém "consertar" voltando a tabela legada.
  const atletaFonte = readFileSync("supabase/functions/athlete-action/index.ts", "utf-8");
  const iEnv = atletaFonte.indexOf('case "ENVIAR_PLACAR"');
  const fimEnv = atletaFonte.indexOf('case "', iEnv + 10);
  ok(iEnv > 0 && fimEnv > iEnv, "o case do envio de placar foi localizado, e a fatia vai até o case seguinte");
  const trechoEnv = atletaFonte.slice(iEnv, fimEnv).replace(/\/\/[^\n]*/g, "");
  ok(/from\("circuitos"\)[\s\S]{0,80}auto_validar_placar/.test(trechoEnv),
    "o envio de placar lê `auto_validar_placar` da tabela `circuitos`, que é por circuito");
}

secao("Recibo de consentimento não se perde em silêncio — RODANDO o motor");
{
  // Achado do Guardião Jurídico em 29/09/2026. O `mirrorSazonal` do
  // `athlete-action` era best-effort SEM EXCEÇÃO: `catch` com `console.warn` e
  // segue. Isso é defensável quando `circuito_atletas` é mesmo um ESPELHO — no
  // BH, `atletas` recebeu a mesma escrita e o roster legado continua lendo de lá.
  //
  // Num circuito NÃO-BH o campo sazonal não tem outro lugar. `versao_regulamento`
  // e `data_aceite_regulamento` SÃO sazonais. Então o re-aceite num circuito novo
  // respondia `sucesso: true`, o atleta via "aceito", e o clube ficava sem
  // recibo nenhum — com um aviso num log que ninguém lê.
  //
  // E na inscrição era pior que perder o recibo: em `atletas` NÃO EXISTE coluna
  // de circuito. A linha de `circuito_atletas` é o ÚNICO registro de que aquele
  // atleta é daquele circuito. Sem ela o atleta existe globalmente e é membro de
  // circuito nenhum — invisível no roster, fora do pareamento — e o app dizia
  // "inscrição feita".
  const ATL = "aaaaaaaa-0000-0000-0000-000000000009";
  const NOVO = "55555555-5555-5555-5555-555555555555";
  const TOKEN = "token-do-recibo";
  const sha = (t) => createHash("sha256").update(t).digest("hex");
  const daquiAUmaHora = () => new Date(Date.now() + 3600e3).toISOString();

  const cenario = async (circuitoAlvo) => {
    const { banco } = await montarMotor({
      circuitos: [
        circuito(BH, { regulamento_versao: "v03-13" }),
        circuito(NOVO, { slug: "novo", sistema: "B", regulamento_versao: "vB-01", inscricoes_abertas: true }),
      ],
      atletas: [atleta(ATL, { versao_regulamento: "antiga", aceite_regulamento: true })],
      circuito_atletas: [
        { circuito_id: BH, atleta_id: ATL, status: "ativo", versao_regulamento: "antiga" },
        { circuito_id: NOVO, atleta_id: ATL, status: "ativo", versao_regulamento: "antiga" },
      ],
      funcoes: {
        get_cpf_pepper: () => "pimenta-de-teste",
        dedup_por_cpf_hash: () => [{ existe: false, atleta_id: null }],
      },
      outras: {
        atleta_sessao: [{ id: "s1", atleta_id: ATL, token_hash: sha(TOKEN), expira_em: daquiAUmaHora() }],
        atleta_documento: [], tentativas_busca_cpf: [],
      },
    });
    const fn = await carregarFuncao("athlete-action", banco);
    return { banco, fn, circuitoAlvo };
  };

  // ── O re-aceite, com o espelho recusando ────────────────────────────────
  {
    const { banco, fn } = await cenario();
    banco.recusar("circuito_atletas", "upsert", { message: "simulando falha", code: "XX000" });
    const r = await fn.chamar({ acao: "ACEITAR_REGULAMENTO", payload: { circuitoId: NOVO, token: TOKEN, versaoVista: "vB-01" } });
    ok(r.corpo?.sucesso !== true,
      `o re-aceite num circuito novo NÃO responde sucesso quando a gravação falha (veio: ${JSON.stringify(r.corpo?.sucesso)})`);
    const vinc = banco.acha("circuito_atletas", x => x.circuito_id === NOVO && x.atleta_id === ATL);
    igual(vinc?.versao_regulamento, "antiga",
      "e a versão do vínculo continua a antiga — recusa não deixa meio-recibo");
  }

  // E no BH a escrita segue por `atletas`: ali o espelho é mesmo espelho, e
  // derrubar a operação do circuito legado por causa dele seria o erro oposto.
  {
    const { banco, fn } = await cenario();
    banco.recusar("circuito_atletas", "upsert", { message: "simulando falha", code: "XX000" });
    const r = await fn.chamar({ acao: "ACEITAR_REGULAMENTO", payload: { circuitoId: BH, token: TOKEN, versaoVista: "v03-13" } });
    ok(r.corpo?.sucesso === true,
      "no BH o aceite NÃO quebra quando o espelho falha — lá `atletas` recebeu a escrita e é o que o roster lê");
    igual(banco.acha("atletas", a => a.id === ATL)?.versao_regulamento, "v03-13",
      "e o lugar autoritativo do BH ficou com a versão nova");
  }

  // ⚠️ Pedido COMPLETO, e é o ponto. A 1ª versão desta asserção mandava só nome
  // e telefone: a inscrição morria em `cpf_obrigatorio` MUITO antes de chegar ao
  // vínculo, e o `sucesso === false` ficava verde sem ter exercitado nada do que
  // a asserção diz proteger. CPF com dígito verificador válido, porque o
  // servidor revalida.
  const inscricaoCompleta = {
    circuitoId: NOVO, nome: "Novato da Silva", telefone: "31988887777",
    aceiteRegulamento: true, aceiteLGPD: true,
    cpf: "52998224725", cpfConsent: true, cpfConsentVersao: "cpf-2026-08-v1",
    dataNascimento: "1990-05-10",
  };

  // ── A inscrição, com o vínculo recusando ────────────────────────────────
  {
    const { banco, fn } = await cenario();
    banco.recusar("circuito_atletas", "upsert", { message: "simulando falha", code: "XX000" });
    const antes = banco.tabelas.atletas.length;
    const r = await fn.chamar({
      acao: "INSCREVER",
      payload: inscricaoCompleta,
    });
    ok(r.corpo?.sucesso === false,
      `a inscrição sem vínculo ao circuito é recusada (veio: ${JSON.stringify(r.corpo?.sucesso)})`);
    igual(banco.tabelas.atletas.length, antes,
      "e o atleta recém-criado é DESFEITO — não fica órfão, existindo globalmente e membro de circuito nenhum");
    // ⚠️ A frase NÃO promete mais "nada foi salvo". O Guardião Jurídico mostrou que
    // era parcialmente falso: o registro de tentativas de CPF grava o IP antes de
    // tudo e nada o limpa. A frase agora afirma só o que é verdade — que a
    // inscrição não foi concluída — e continua dizendo o que fazer.
    igual(String(r.corpo?.erro || ""), "Sua inscrição não foi concluída. Tente de novo em instantes.",
      "e a mensagem diz o que houve e o que fazer, em vez de mandar o atleta conferir a conexão no clique final de uma inscrição paga");
  }

  // ── E quando NEM O DESFAZIMENTO funciona ────────────────────────────────
  // Achado do Guardião Jurídico e do guardião do Atleta: o `delete` de rollback
  // não checava o próprio erro, e a resposta afirmava "nada foi salvo" de
  // qualquer jeito. Se ele falhar, sobra um atleta órfão — com CPF e, no caso de
  // menor, o nome do responsável — e mandar "tente de novo" leva o atleta ao erro
  // de telefone duplicado e dali a um beco sem saída, invisível ao organizador.
  {
    const { banco, fn } = await cenario();
    banco.recusar("circuito_atletas", "upsert", { message: "simulando falha", code: "XX000" });
    banco.recusar("atletas", "delete", { message: "o desfazimento também falhou", code: "XX000" });
    const r = await fn.chamar({ acao: "INSCREVER", payload: inscricaoCompleta });
    ok(r.corpo?.sucesso === false, "a inscrição é recusada");
    igual(String(r.corpo?.erro || ""), "Não conseguimos concluir nem desfazer sua inscrição. Fale com o organizador antes de tentar de novo.",
      "e a mensagem manda FALAR COM O ORGANIZADOR — não 'tente de novo', que levaria a um beco sem saída");
  }

  // Sem o vínculo recusando, o mesmo caminho conclui — senão as três asserções
  // acima passariam com uma inscrição que nunca funciona.
  {
    const { banco, fn } = await cenario();
    const r = await fn.chamar({
      acao: "INSCREVER",
      payload: inscricaoCompleta,
    });
    ok(r.corpo?.sucesso === true, `a mesma inscrição conclui quando o banco aceita (erro: ${JSON.stringify(r.corpo?.erro)})`);
    const novoId = banco.tabelas.atletas.find(a => a.telefone === "31988887777")?.id;
    ok(!!novoId, "o atleta foi criado em `atletas`");
    ok(!!banco.acha("circuito_atletas", x => x.circuito_id === NOVO && x.atleta_id === novoId),
      "e o vínculo dele com o circuito novo foi criado — é ele o único registro de que o atleta é deste circuito");
  }
}

secao("A virada não apaga do histórico quem jogou W.O. — RODANDO a ação mais destrutiva");
{
  // Achado do Guardião de Regulamento em 29/09/2026. `NOVA_TEMPORADA` montava o
  // ranking final com `validado && !rejeitado`; a TELA monta com
  // `calculado && !rejeitado` (`App.jsx`, `estaNoRanking`). Duas respostas para a
  // mesma pergunta, e elas discordam exatamente nos W.O.: a partida de W.O. nunca
  // é "validada" (ninguém enviou placar), mas é CALCULADA e PONTUA.
  //
  // O efeito não é cosmético e não se desfaz: quem fez a temporada em W.O. some do
  // histórico, e TODOS ABAIXO DELE SOBEM UMA POSIÇÃO no registro permanente.
  const A = "cccccccc-0000-0000-0000-00000000000a";
  const B = "cccccccc-0000-0000-0000-00000000000b";
  const C = "cccccccc-0000-0000-0000-00000000000c";

  const cenarioVirada = async () => montarMotor({
    circuitos: [circuito(BH, { regulamento_versao: "v03-13" })],
    atletas: [
      // A e C jogaram partida normal. B fez a temporada inteira em W.O. a favor:
      // ganhou rating, aparece no ranking da tela, e some na virada.
      atleta(A, { rating: 700 }),
      atleta(B, { rating: 600 }),
      atleta(C, { rating: 500 }),
    ],
    partidas: [
      partida("n1", { atleta1_id: A, atleta2_id: C, placar1: 3, placar2: 0, validado: true, calculado: true }),
      partida("w1", { rodada: 2, atleta1_id: B, atleta2_id: C, wo_tipo: "a_favor", wo_beneficiario_id: B, validado: false, calculado: true }),
    ],
    funcoes: { arquivar_partidas_temporada_circuito: () => null },
  });

  {
    const { banco, motor } = await cenarioVirada();
    const r = await comoAdmin(motor, "NOVA_TEMPORADA", { circuitoId: BH });
    ok(r.corpo?.sucesso === true, `a virada conclui (erro: ${JSON.stringify(r.corpo?.erro)})`);
    const hist = (id) => banco.acha("atletas", a => a.id === id)?.historico || [];
    ok(hist(B).length === 1,
      `quem fez a temporada em W.O. RECEBE linha de histórico (veio: ${JSON.stringify(hist(B))})`);
    // E a consequência que ninguém veria: as posições dos outros.
    const pos = (id) => hist(id)[0]?.pos;
    const todas = [pos(A), pos(B), pos(C)].sort((x, y) => x - y);
    igual(todas.join(","), "1,2,3",
      "e as três posições são 1, 2 e 3 — sem ninguém subindo de degrau por causa de um atleta apagado");
  }
}

secao("A virada no CIRCUITO NOVO também preserva quem jogou W.O. — o ramo que importa");
{
  // A seção acima roda com `circuitoId: BH`, e o `NOVA_TEMPORADA` tem DOIS ramos:
  // o do BH (tabelas legadas) e o dos demais (`circuito_atletas`). O guardião de
  // Regulamento sabotou o ramo NÃO-BH de volta para `validado` e a bateria ficou
  // VERDE: a correção estava protegida no BH — que já encerrou — e desprotegida
  // no caminho que o 2º circuito vai usar.
  //
  // É a mesma família do erro do cenário logo acima: testar o caminho que eu
  // conheço em vez do caminho que vai rodar.
  const CIRC_NOVO = "77770000-1111-2222-3333-444444444444";
  const P = "77770000-0000-0000-0000-00000000000p"; // jogou partida normal
  const W = "77770000-0000-0000-0000-00000000000w"; // fez a temporada em W.O.
  const T = "77770000-0000-0000-0000-00000000000t"; // terceiro

  const { banco, motor } = await montarMotor({
    circuitos: [
      circuito(BH, { regulamento_versao: "v03-13" }),
      circuito(CIRC_NOVO, { slug: "novo-virada", sistema: "B", pareamento: "sorteio", regulamento_versao: "vB-01" }),
    ],
    atletas: [atleta(P), atleta(W), atleta(T)],
    circuito_atletas: [
      { circuito_id: CIRC_NOVO, atleta_id: P, status: "ativo", saldo_temp: 4 },
      { circuito_id: CIRC_NOVO, atleta_id: W, status: "ativo", saldo_temp: 2 },
      { circuito_id: CIRC_NOVO, atleta_id: T, status: "ativo", saldo_temp: 1 },
    ],
    partidas: [
      partida("n1", { circuito_id: CIRC_NOVO, atleta1_id: P, atleta2_id: T, placar1: 3, placar2: 0, validado: true, calculado: true }),
      // A partida do W é W.O.: calculada e pontuando, mas NUNCA validada.
      partida("n2", { circuito_id: CIRC_NOVO, rodada: 2, atleta1_id: W, atleta2_id: T, wo_tipo: "a_favor", wo_beneficiario_id: W, validado: false, calculado: true }),
    ],
    funcoes: { arquivar_partidas_temporada_circuito: () => null },
  });

  const r = await comoAdmin(motor, "NOVA_TEMPORADA", { circuitoId: CIRC_NOVO });
  ok(r.corpo?.sucesso === true, `a virada do circuito novo conclui (erro: ${JSON.stringify(r.corpo?.erro)})`);
  const hist = (id) => banco.acha("circuito_atletas", c => c.circuito_id === CIRC_NOVO && c.atleta_id === id)?.historico || [];
  igual(hist(W).length, 1,
    `no circuito NOVO, quem fez a temporada em W.O. recebe linha de histórico (veio: ${JSON.stringify(hist(W))})`);
  const pos = (id) => hist(id)[0]?.pos;
  igual([pos(P), pos(W), pos(T)].sort((a, b) => a - b).join(","), "1,2,3",
    "e as três posições são 1, 2 e 3 — ninguém sobe de degrau por causa de um atleta apagado");
  igual(pos(W), 2, "o atleta do W.O. fica em 2º, que é o que os 2 pontos dele valem pelo Cap. 09");
}

secao("A estreia no ranking acontece na rodada em que a 1ª partida é processada");
{
  // Esta seção nasceu de um erro meu, e é o motivo de ela existir. Ao unificar a
  // conta de "quem entra no ranking" eu troquei o `PROCESSAR_RODADA` para usar
  // `calculado` — e a bateria ficou VERDE. Só que ali a ordem importa: as partidas
  // da rodada só recebem `calculado: true` no FIM da própria ação, depois de o
  // ranking ser montado. Ou seja: o atleta cuja 1ª partida é a desta rodada ficava
  // de fora do ranking que a rodada acabou de gerar, e só apareceria na seguinte.
  //
  // Nada na bateria falava dessa estreia. Regra da casa: o que não tem asserção
  // não está protegido — e eu acabei de provar isso contra mim mesmo.
  const A = "dddddddd-0000-0000-0000-00000000000a";
  const B = "dddddddd-0000-0000-0000-00000000000b";

  const { banco, motor } = await montarMotor({
    circuitos: [circuito(BH, { regulamento_versao: "v03-13" })],
    atletas: [atleta(A, { rating: 700 }), atleta(B, { rating: 500 })],
    chaves: [{ id: "chave1", nome: "Chave A", rodada_atual: 1, circuito_id: BH }],
    // Primeira e única partida dos dois: validada, ainda NÃO calculada — é
    // exatamente o estado em que o organizador aperta "atualizar ranking".
    partidas: [partida("p1", { atleta1_id: A, atleta2_id: B, placar1: 3, placar2: 1, validado: true, calculado: false })],
  });
  const r = await comoAdmin(motor, "PROCESSAR_RODADA", { circuitoId: BH, round: 1 });
  ok(r.corpo?.sucesso === true, `a rodada é processada (erro: ${JSON.stringify(r.corpo?.erro)})`);
  for (const [id, quem] of [[A, "o vencedor"], [B, "o perdedor"]]) {
    const ph = banco.acha("atletas", a => a.id === id)?.posicao_historico || [];
    ok(ph.length > 0,
      `${quem} entra no ranking na MESMA rodada em que a 1ª partida dele foi processada (posicao_historico: ${JSON.stringify(ph)})`);
  }
}

secao("O número de W.O. injustificados chega à tela — os dois adaptadores");
{
  // Achado do Guardião de Regulamento em 29/09/2026. `wo_culposos_temporada` é
  // SAZONAL: mora em `circuito_atletas`. Os dois adaptadores que montam o atleta
  // para a tela o DESCARTAVAM — um com um comentário explicando que era de
  // propósito ("paridade com hoje"). A paridade era com o BH, onde o servidor
  // grava também no registro global e por isso o número aparecia. Em circuito
  // não-BH o app lia SEMPRE ZERO, e duas regras morriam juntas: o 2º desempate do
  // Cap. 09 do Sistema B (que é o sistema dos circuitos não-BH) e o painel de
  // suspensão do Cap. 07, que sumia ao recarregar.
  //
  // Asserção por LISTA DECLARADA, não por janela: uma janela ancorada num dos
  // adaptadores seria cega para o outro — que é exatamente como o defeito
  // sobreviveu. Adaptador novo entra nesta lista ou a bateria fica vermelha.
  const ADAPTADORES = ["mapAtletaFromCircuito", "porteiroRankingToCa"];
  for (const nome of ADAPTADORES) {
    const i = fonte.indexOf(`function ${nome}(`);
    ok(i > 0, `o adaptador ${nome} foi localizado`);
    const f = fonte.indexOf("\n}", i);
    ok(f > i, `e o fim de ${nome} foi localizado`);
    const corpo = fonte.slice(i, f).replace(/\/\/[^\n]*/g, "");
    ok(/wo_culposos_temporada:\s*\w+\.wo_culposos_temporada/.test(corpo),
      `${nome} repassa wo_culposos_temporada em vez de deixar o campo cair para zero`);
  }

  // E o porteiro precisa MANDAR o campo — senão os adaptadores repassam undefined
  // e a bateria fica verde com a regra morta do mesmo jeito.
  const porteiro = readFileSync("supabase/functions/circuito-dados/index.ts", "utf-8");
  ok(/wo_culposos_temporada/.test(porteiro.split("const ATLETA_COLS")[1]?.split("\n")[0] || ""),
    "o `circuito-dados` pede wo_culposos_temporada no select do atleta");
  ok(/wo_culposos_temporada:\s*ca\.wo_culposos_temporada/.test(porteiro),
    "e o devolve no item de ranking");

  // O comparador do Sistema B usa o campo como 2º critério — se alguém o tirar de
  // lá, repassar o número deixa de servir para alguma coisa.
  const iCmp = fonte.indexOf("function cmpRanking(");
  const fimCmp = fonte.indexOf("\n}", iCmp);
  const cmp = fonte.slice(iCmp, fimCmp);
  ok(iCmp > 0 && fimCmp > iCmp, "o comparador oficial do ranking foi localizado");
  ok(/SISTEMA_ATIVO === "B"[\s\S]*woCulpososTemporada/.test(cmp),
    "e no Sistema B o desempate por MENOS W.O. injustificados vem dentro do ramo B, como manda o Cap. 09");
}

secao("O contador de W.O. injustificados é DERIVADO — RODANDO os dois sistemas");
{
  // O Cap. 07 SUSPENDE o atleta no 2º W.O. injustificado. Até 29/09/2026 o número
  // era acumulado (+1 a cada `APLICAR_WO` culposo) e nada nunca subtraía. Três
  // caminhos levavam alguém a ser suspenso sem ter duas faltas:
  //   · aplicar o W.O. duas vezes na mesma partida — dois cliques, chamada
  //     repetida, ou o organizador corrigindo quem era o faltoso;
  //   · aprovar a justificativa depois: o ponto não voltava;
  //   · trocar o tipo de culposo para justificado: idem.
  // Agora o número é lido das partidas. Idempotente por construção.
  const F = "eeeeeeee-0000-0000-0000-00000000000f"; // faltoso
  const V = "eeeeeeee-0000-0000-0000-00000000000v"; // adversário
  const CIRC_B_WO = "eeeeeeee-1111-1111-1111-111111111111";

  // ⚠️ ESTA SEÇÃO ANUNCIAVA "RODANDO OS DOIS SISTEMAS" E RODAVA O SISTEMA A DUAS
  // VEZES. O cenário montava `circuito(BH, { sistema })` — e o `getSistema()` do
  // motor devolve "A" para o BH POR CRAVAÇÃO (`if (circuitoId === bh) return "A"`),
  // sem nunca olhar a coluna `sistema`. Os rótulos `[B]` eram falsos.
  //
  // O guardião de Regulamento provou da forma mais direta: pôs um `throw` na
  // primeira linha do ramo Sistema B do `APLICAR_WO` e a bateria ficou VERDE,
  // 1149/1149. O ramo inteiro do W.O. no modelo de PONTOS — o modelo do 2º
  // circuito — era código morto para a bateria. Quatro sabotagens passaram verdes
  // por causa disto: tirar a recontagem do ramo B, tirar o `a_favor` da conta,
  // tirar o escopo por circuito da recontagem, e a virada de temporada no ramo
  // não-BH.
  //
  // A correção é o cenário, não a asserção: o Sistema B precisa de um circuito que
  // NÃO seja o BH. O portão que prova que agora roda de verdade está no fim da
  // seção.
  const circuitoDoSistema = (sistema) => sistema === "B" ? CIRC_B_WO : BH;

  const cenarioWo = async (sistema) => {
    const cid = circuitoDoSistema(sistema);
    return montarMotor({
      circuitos: [
        circuito(BH, { regulamento_versao: "v03-13" }),
        circuito(CIRC_B_WO, { slug: "pontos-wo", sistema: "B", pareamento: "sorteio", regulamento_versao: "vB-01" }),
      ],
      atletas: [atleta(F, { rating: 500 }), atleta(V, { rating: 500 })],
      circuito_atletas: [
        { circuito_id: cid, atleta_id: F, status: "ativo" },
        { circuito_id: cid, atleta_id: V, status: "ativo" },
      ],
      partidas: [partida("j1", { circuito_id: cid, atleta1_id: F, atleta2_id: V })],
      solicitacoes_wo: [{ id: "s1", circuito_id: cid, atleta_id: F, adversario_id: V, partida_id: "j1", status: "pendente" }],
    });
  };

  const contador = (banco, sistema) => {
    const cid = circuitoDoSistema(sistema);
    return banco.acha("circuito_atletas", c => c.circuito_id === cid && c.atleta_id === F)?.wo_culposos_temporada
      ?? banco.acha("atletas", a => a.id === F)?.wo_culposos_temporada;
  };

  for (const sistema of ["A", "B"]) {
    const CIRC = circuitoDoSistema(sistema);
    // 1. Aplicar DUAS vezes o mesmo W.O. não pode contar duas faltas.
    {
      const { banco, motor } = await cenarioWo(sistema);
      await comoAdmin(motor, "APLICAR_WO", { circuitoId: CIRC, matchId: "j1", tipo: "culposo", faltosoId: F, beneficiarioId: V });
      igual(contador(banco, sistema), 1, `[${sistema}] um W.O. culposo conta 1`);
      await comoAdmin(motor, "APLICAR_WO", { circuitoId: CIRC, matchId: "j1", tipo: "culposo", faltosoId: F, beneficiarioId: V });
      igual(contador(banco, sistema), 1,
        `[${sistema}] aplicar o MESMO W.O. de novo continua contando 1 — dois cliques não suspendem ninguém`);
    }

    // 2. Aprovar a justificativa depois devolve o ponto.
    {
      const { banco, motor } = await cenarioWo(sistema);
      await comoAdmin(motor, "APLICAR_WO", { circuitoId: CIRC, matchId: "j1", tipo: "culposo", faltosoId: F, beneficiarioId: V });
      igual(contador(banco, sistema), 1, `[${sistema}] a falta entra como culposa`);
      const r = await comoAdmin(motor, "RESPONDER_WO", { circuitoId: CIRC, id: "s1", matchId: "j1", aprovado: true, justificativa: "atestado" });
      ok(r.corpo?.sucesso === true, `[${sistema}] a justificativa é aprovada (erro: ${JSON.stringify(r.corpo?.erro)})`);
      igual(contador(banco, sistema), 0,
        `[${sistema}] e o ponto VOLTA — ninguém fica suspenso por uma falta que o organizador perdoou`);
    }
  }

  // 3. TROCAR O TIPO de culposo para justificado devolve o ponto — nos DOIS
  //    sistemas. O commit do Bloco 2 declarava isto consertado e, no Sistema A,
  //    NÃO estava: o ramo `justificado` do APLICAR_WO dava `return` antes de
  //    recontar. Achado do Guardião de Regulamento, medido rodando o motor.
  for (const sistema of ["A", "B"]) {
    const CIRC = circuitoDoSistema(sistema);
    const { banco, motor } = await cenarioWo(sistema);
    await comoAdmin(motor, "APLICAR_WO", { circuitoId: CIRC, matchId: "j1", tipo: "culposo", faltosoId: F, beneficiarioId: V });
    igual(contador(banco, sistema), 1, `[${sistema}] a falta entra como culposa`);
    const r = await comoAdmin(motor, "APLICAR_WO", { circuitoId: CIRC, matchId: "j1", tipo: "justificado", faltosoId: F, beneficiarioId: V });
    ok(r.corpo?.sucesso === true, `[${sistema}] o organizador reclassifica o W.O. como justificado (erro: ${JSON.stringify(r.corpo?.erro)})`);
    igual(contador(banco, sistema), 0,
      `[${sistema}] e o ponto VOLTA ao reclassificar — o Cap. 07 não pode suspender por falta perdoada`);
  }

  // 4. CORRIGIR QUEM FALTOU não pode deixar a falta lançada para os dois. Era o
  //    outro caso que o commit listava como consertado e não estava: a recontagem
  //    era idempotente por ATLETA, não por PARTIDA.
  for (const sistema of ["A", "B"]) {
    const CIRC = circuitoDoSistema(sistema);
    const { banco, motor } = await cenarioWo(sistema);
    await comoAdmin(motor, "APLICAR_WO", { circuitoId: CIRC, matchId: "j1", tipo: "culposo", faltosoId: F, beneficiarioId: V });
    await comoAdmin(motor, "APLICAR_WO", { circuitoId: CIRC, matchId: "j1", tipo: "culposo", faltosoId: V, beneficiarioId: F });
    const doV = () => banco.acha("circuito_atletas", c => c.circuito_id === CIRC && c.atleta_id === V)?.wo_culposos_temporada
      ?? banco.acha("atletas", a => a.id === V)?.wo_culposos_temporada;
    igual(doV(), 1, `[${sistema}] o faltoso corrigido fica com a falta`);
    igual(contador(banco, sistema), 0,
      `[${sistema}] e o faltoso ANTERIOR é zerado — um W.O. não pode contar para duas pessoas`);
  }

  // 5. No Sistema B o "a favor" TAMBÉM conta como injustificado (vB-01, Cap. 07),
  //    e no Sistema A não conta (v03-12 fala em "2 W.O.s culposos"). Sem esta
  //    asserção, tirar o `a_favor` da conta passava verde.
  {
    const { banco, motor } = await cenarioWo("B");
    const r = await comoAdmin(motor, "APLICAR_WO", { circuitoId: CIRC_B_WO, matchId: "j1", tipo: "a_favor", beneficiarioId: V });
    ok(r.corpo?.sucesso === true, `o W.O. "a favor" é aceito no circuito de pontos (erro: ${JSON.stringify(r.corpo?.erro)})`);
    igual(contador(banco, "B"), 1,
      'no Sistema B o "a favor" conta como injustificado para o ausente — é o que o Cap. 07 do vB-01 manda');
  }
  {
    const { banco, motor } = await cenarioWo("A");
    await comoAdmin(motor, "APLICAR_WO", { circuitoId: BH, matchId: "j1", tipo: "a_favor", beneficiarioId: V });
    igual(contador(banco, "A") || 0, 0,
      'no Sistema A o "a favor" NÃO conta — o v03-12 suspende por "2 W.O.s culposos", e são coisas diferentes');
  }

  // 6. A recontagem é ESCOPADA POR CIRCUITO. Sem esta asserção, tirar o filtro
  //    `circuito_id` passava verde — numa onda cujo tema é isolamento entre
  //    circuitos, era a linha que mais merecia portão.
  {
    const OUTRO_B = "eeeeeeee-2222-2222-2222-222222222222";
    const { banco, motor } = await montarMotor({
      circuitos: [
        circuito(BH, { regulamento_versao: "v03-13" }),
        circuito(CIRC_B_WO, { slug: "pontos-a", sistema: "B", pareamento: "sorteio", regulamento_versao: "vB-01" }),
        circuito(OUTRO_B, { slug: "pontos-b", sistema: "B", pareamento: "sorteio", regulamento_versao: "vB-01" }),
      ],
      atletas: [atleta(F), atleta(V)],
      circuito_atletas: [
        { circuito_id: CIRC_B_WO, atleta_id: F, status: "ativo" },
        { circuito_id: OUTRO_B, atleta_id: F, status: "ativo" },
      ],
      // O MESMO atleta falta nos DOIS circuitos.
      partidas: [
        partida("ja", { circuito_id: CIRC_B_WO, atleta1_id: F, atleta2_id: V }),
        partida("jb", { circuito_id: OUTRO_B, atleta1_id: F, atleta2_id: V }),
      ],
    });
    await comoAdmin(motor, "APLICAR_WO", { circuitoId: CIRC_B_WO, matchId: "ja", tipo: "culposo", faltosoId: F, beneficiarioId: V });
    await comoAdmin(motor, "APLICAR_WO", { circuitoId: OUTRO_B, matchId: "jb", tipo: "culposo", faltosoId: F, beneficiarioId: V });
    const no = (cid) => banco.acha("circuito_atletas", c => c.circuito_id === cid && c.atleta_id === F)?.wo_culposos_temporada;
    igual(no(CIRC_B_WO), 1, "a falta do circuito A conta 1 no circuito A");
    igual(no(OUTRO_B), 1,
      "e a do circuito B conta 1 no circuito B — a contagem não soma entre circuitos, nem vaza de um para o outro");
  }

  // 7. O PORTÃO DO CENÁRIO. Esta asserção não testa regra nenhuma: ela prova que o
  //    ramo Sistema B do APLICAR_WO é MESMO executado. Foi o teste que o guardião
  //    usou para mostrar que esta seção inteira rodava o Sistema A duas vezes.
  //    Se alguém voltar a montar o cenário do B com o BH, isto fica vermelho.
  {
    const { motor } = await cenarioWo("B");
    const r = await comoAdmin(motor, "APLICAR_WO", { circuitoId: CIRC_B_WO, matchId: "j1", tipo: "culposo", faltosoId: F, beneficiarioId: null });
    igual(r.corpo?.erro, "beneficiarioId é obrigatório",
      "o cenário do Sistema B alcança MESMO o ramo B do motor — esta recusa só existe lá (o ramo A não exige beneficiário no culposo… exige faltoso)");
  }

  // 8. O FALTOSO E O BENEFICIÁRIO TÊM DE SER OS DOIS JOGADORES DAQUELA PARTIDA.
  //
  //    Achado por três auditores independentes, com a prova VERMELHA desde a 1ª
  //    rodada e ninguém lendo a saída. O motor conferia em QUE partida o
  //    organizador agia e nunca conferia QUEM ele apontou. Medido no motor, com
  //    `sucesso: true`: um W.O. distribuía 5 pontos onde o vB-01 previa 3, os dois
  //    jogadores de verdade ficavam com ZERO, a vitória ia para quem não jogou, e
  //    um terceiro levava `wo_culposos_temporada = 1` — que é o contador da
  //    SUSPENSÃO do Cap. 07 e o 2º desempate do Cap. 09. Dava para suspender
  //    qualquer atleta da plataforma em dois cliques de API.
  //
  //    Não era alcançável pela tela (o RegistrarWoInline só oferece os dois
  //    jogadores), então não houve dano — era guarda de servidor faltando.
  //
  //    Nos DOIS sistemas, porque foi exatamente aqui que eu já errei uma vez hoje:
  //    o `circuitoDoSistema` é o que garante que o "B" não é o BH disfarçado.
  const X = "eeeeeeee-0000-0000-0000-0000000000ff"; // não joga a partida j1
  for (const sistema of ["A", "B"]) {
    const CIRC = circuitoDoSistema(sistema);
    {
      const { banco, motor } = await cenarioWo(sistema);
      const r = await comoAdmin(motor, "APLICAR_WO",
        { circuitoId: CIRC, matchId: "j1", tipo: "culposo", faltosoId: X, beneficiarioId: V });
      igual(r.status, 403,
        `[${sistema}] apontar como faltoso alguém que não jogou a partida é RECUSADO`);
      igual(banco.acha("circuito_atletas", c => c.atleta_id === X), undefined,
        `[${sistema}] e o estranho NÃO ganha vínculo fabricado em circuito_atletas — Regra Inviolável nº 3`);
      igual(banco.acha("atletas", a => a.id === X), undefined,
        `[${sistema}] nem linha de identidade inventada em atletas`);
      const j1 = banco.acha("partidas", p => p.id === "j1");
      igual(j1?.wo_faltoso_id ?? null, null,
        `[${sistema}] e a partida não foi consumida — nada de W.O. gravado com faltoso de fora`);
    }
    // O beneficiário também. Sem esta, metade da guarda podia cair e passar verde.
    {
      const { banco, motor } = await cenarioWo(sistema);
      const r = await comoAdmin(motor, "APLICAR_WO",
        { circuitoId: CIRC, matchId: "j1", tipo: "culposo", faltosoId: F, beneficiarioId: X });
      igual(r.status, 403,
        `[${sistema}] apontar como beneficiário alguém que não jogou a partida é RECUSADO`);
      igual(contador(banco, sistema) ?? 0, 0,
        `[${sistema}] e ninguém leva falta numa ação recusada`);
    }
    // E o caminho legítimo continua passando — senão a guarda seria só um "não"
    // para tudo, que é o jeito mais fácil de ficar verde sem servir para nada.
    {
      const { banco, motor } = await cenarioWo(sistema);
      const r = await comoAdmin(motor, "APLICAR_WO",
        { circuitoId: CIRC, matchId: "j1", tipo: "culposo", faltosoId: F, beneficiarioId: V });
      ok(r.corpo?.sucesso === true,
        `[${sistema}] e o W.O. legítimo, com os dois jogadores da partida, segue funcionando (erro: ${JSON.stringify(r.corpo?.erro)})`);
      igual(contador(banco, sistema), 1, `[${sistema}] com a falta contando 1 para quem faltou`);
    }
  }

  // 3. Duas faltas de verdade, em partidas diferentes, contam 2 — senão as
  //    asserções acima passariam com um contador que nunca sobe.
  {
    const { banco, motor } = await montarMotor({
      circuitos: [circuito(BH, { regulamento_versao: "v03-13" })],
      atletas: [atleta(F), atleta(V)],
      circuito_atletas: [{ circuito_id: BH, atleta_id: F, status: "ativo" }],
      partidas: [
        partida("j1", { atleta1_id: F, atleta2_id: V }),
        partida("j2", { rodada: 2, atleta1_id: F, atleta2_id: V }),
      ],
    });
    for (const m of ["j1", "j2"]) {
      await comoAdmin(motor, "APLICAR_WO", { circuitoId: BH, matchId: m, tipo: "culposo", faltosoId: F, beneficiarioId: V });
    }
    igual(contador(banco), 2, "duas faltas em partidas diferentes contam 2 — é aí que o Cap. 07 suspende");
  }
}

secao("O motor de pareamento do Sistema B — RODANDO a temporada inteira");
{
  // Este era o maior buraco da bateria: o Sistema B inteiro (o modelo do 2º
  // circuito) não tinha NENHUMA asserção rodando o pareamento. As 20 asserções da
  // seção "Sistema B" cobriam pontuação, não pareamento.
  //
  // O que se prova aqui, com o motor de verdade e 6 rodadas completas:
  //   · o circuito B usa o pareamento B (e não o por rating, que é do A);
  //   · ninguém repete adversário quando dá para não repetir;
  //   · com número ímpar, exatamente um fica de fora por rodada;
  //   · o bye RODA — ninguém leva um segundo antes de todos levarem um;
  //   · a trava de 6 rodadas segura.
  const CIRC_B = "bbbbbbbb-1111-1111-1111-111111111111";
  const ids = (n) => Array.from({ length: n }, (_, i) => `atl-${String(i + 1).padStart(2, "0")}`);

  const temporadaB = async (quantos, pareamento = "sorteio") => {
    const lista = ids(quantos);
    const { banco, motor } = await montarMotor({
      circuitos: [circuito(BH), circuito(CIRC_B, {
        slug: "pontos", sistema: "B", pareamento,
        regulamento_versao: "vB-01", rodadas_por_temporada: 6, fase: "temporada",
      })],
      atletas: lista.map((id, i) => atleta(id, { rating: 500 + i * 10 })),
      circuito_atletas: lista.map(id => ({ circuito_id: CIRC_B, atleta_id: id, status: "ativo", pendente_circuito: false, saldo_temp: 0 })),
      chaves: [], partidas: [],
    });
    const r0 = await comoAdmin(motor, "INICIAR_ETAPA", { circuitoId: CIRC_B });
    ok(r0.corpo?.sucesso === true, `[${quantos} atletas/${pareamento}] a etapa inicia (erro: ${JSON.stringify(r0.corpo?.erro)})`);
    // Pares mensais: INICIAR gera as rodadas 1 e 2; cada AVANCAR gera mais duas.
    for (const _ of [1, 2]) {
      const r = await comoAdmin(motor, "AVANCAR_RODADA", { circuitoId: CIRC_B });
      ok(r.corpo?.sucesso === true, `[${quantos} atletas/${pareamento}] avança o par mensal (erro: ${JSON.stringify(r.corpo?.erro)})`);
    }
    const partidas = banco.tabelas.partidas.filter(m => m.circuito_id === CIRC_B);
    return { banco, motor, partidas, lista };
  };

  // ── 8 atletas (o mínimo), sorteio ────────────────────────────────────────
  {
    const { motor, partidas, lista } = await temporadaB(8);
    const rodadas = [...new Set(partidas.map(m => m.rodada))].sort((a, b) => a - b);
    igual(rodadas.join(","), "1,2,3,4,5,6", "as 6 rodadas da temporada foram geradas");
    for (const r of rodadas) {
      igual(partidas.filter(m => m.rodada === r).length, 4,
        `a rodada ${r} tem 4 partidas — os 8 atletas jogam, ninguém sobra`);
    }
    // ⚠️ ESTA ASSERÇÃO JÁ TOLEROU UMA REPETIÇÃO, e a história importa.
    //
    // A 1ª versão exigia zero e ficava vermelha em ~1 de cada 8 execuções. Eu quase
    // a tratei como teste instável e mexi no teste. Não era: era o motor. Medi 120
    // temporadas completas por configuração e o Guardião de Regulamento refez a
    // medição por conta própria:
    //   8 atletas / sorteio ..... 13/120 (eu) e 14/120 (ele), sempre 1 repetição
    //   8 atletas / grupos, 9, 10, 12 .... 0/120
    // A causa: o motor resolvia o ótimo DE CADA RODADA sem olhar as seguintes, e
    // com 8 atletas (7 adversários possíveis, 6 rodadas) isso fechava a saída da
    // última. Então a asserção passou a afirmar o limite medido (`<= 1`), e o
    // regulamento passou a prometer só "evitando repetir".
    //
    // Em 29/09/2026 o Juliano decidiu: "Não pode ter repetição de atleta." O motor
    // ganhou o rodízio pelo método do círculo (`escalaCirculo`) e a medição foi
    // refeita: 0/120 em TODAS as configurações. A asserção volta a exigir ZERO —
    // agora com o motor capaz de cumprir.
    const confrontos = partidas.map(m => [m.atleta1_id, m.atleta2_id].sort().join("|"));
    const repeticoes = confrontos.length - new Set(confrontos).size;
    igual(repeticoes, 0,
      "com 8 atletas NENHUM confronto se repete na temporada — decisão do Juliano em 29/09/2026");
    // Cada atleta joga as 6 rodadas.
    for (const id of lista) {
      const minhas = partidas.filter(m => m.atleta1_id === id || m.atleta2_id === id);
      igual(minhas.length, 6, `o atleta ${id} joga as 6 rodadas`);
      // E ninguém enfrenta a mesma pessoa três vezes — o limite duro.
      const advs = minhas.map(m => m.atleta1_id === id ? m.atleta2_id : m.atleta1_id);
      const maxVezes = Math.max(...advs.map(x => advs.filter(y => y === x).length));
      igual(maxVezes, 1, `o atleta ${id} enfrenta cada adversário UMA vez só (máximo: ${maxVezes})`);
    }
    // A trava das 6 rodadas.
    const r = await comoAdmin(motor, "AVANCAR_RODADA", { circuitoId: CIRC_B });
    ok(r.corpo?.sucesso === false && r.status === 409,
      "a 7ª rodada é recusada — a temporada tem 6 e a trava segura");
  }

  // ── 9 atletas (ímpar), sorteio: o bye e a rotação ────────────────────────
  {
    const { partidas, lista } = await temporadaB(9);
    const byes = [];
    for (const r of [1, 2, 3, 4, 5, 6]) {
      const daRodada = partidas.filter(m => m.rodada === r);
      igual(daRodada.length, 4, `com 9 atletas a rodada ${r} tem 4 partidas — exatamente um fica de fora`);
      const jogaram = new Set(daRodada.flatMap(m => [m.atleta1_id, m.atleta2_id]));
      const fora = lista.filter(id => !jogaram.has(id));
      igual(fora.length, 1, `e há exatamente um atleta de bye na rodada ${r}`);
      byes.push(fora[0]);
    }
    // A rotação do Cap. 03: "ninguém recebe um segundo bye antes de todos terem
    // recebido um". Com 9 atletas e 6 rodadas ninguém pode repetir.
    igual(new Set(byes).size, byes.length,
      `o bye ROTACIONA — ninguém repete em 6 rodadas com 9 atletas (byes: ${byes.join(", ")})`);
    // Com 9 atletas sobra folga (8 adversários possíveis, 6 rodadas) e o motor
    // acerta as 120 temporadas medidas. Aqui ZERO é exigível.
    const confr9 = partidas.map(m => [m.atleta1_id, m.atleta2_id].sort().join("|"));
    igual(new Set(confr9).size, confr9.length,
      "e com 9 atletas NENHUM confronto se repete — a folga do ímpar resolve o aperto do 8");
  }

  // ── Modo "grupos por faixa" ──────────────────────────────────────────────
  {
    const { partidas } = await temporadaB(8, "grupos");
    const confrontos = partidas.map(m => [m.atleta1_id, m.atleta2_id].sort().join("|"));
    // ⚠️ ESTA ASSERÇÃO EXIGIA ZERO E CONTRADIZIA O CAP. 03. O comentário antigo
    // dizia "a ordem é determinística (tabela de pontos, todos em 0), e o motor
    // acerta as 120 temporadas medidas" — e "todos em 0" não é uma configuração do
    // circuito: é a ÚNICA em que o modo grupos nunca é exercitado, porque ele
    // pareia POR POSIÇÃO NA TABELA e a tabela não se move se ninguém processa
    // rodada. Com as rodadas processadas, esta asserção ficaria vermelha em ~9%
    // das execuções — e o próximo a topar com ela trataria como teste instável,
    // que foi o que quase aconteceu com a asserção irmã do sorteio nesta auditoria.
    //
    // O TETO é a regra, e é o que o Cap. 03 promete: com o grupo completo, no
    // máximo UM confronto repetido (medido pelo Guardião de Regulamento em 6.700
    // temporadas — a distribuição só tem 0 e 1, nunca 2).
    ok(confrontos.length - new Set(confrontos).size <= 1,
      "no modo grupos por faixa, com o grupo completo, no máximo UM confronto se repete — é o teto que o Cap. 03 promete");
    igual(partidas.length, 24, "e as 24 partidas da temporada foram geradas");
  }

  // ── O circuito B usa o motor B, não o do rating ──────────────────────────
  // Sabotar `gerarPareamentoB` tem de quebrar isto. Se o INICIAR_ETAPA chamasse
  // `gerarPareamentoPorRating` num circuito B, as asserções acima passariam
  // igual — o pareamento por rating também evita repetição. O que separa os dois
  // é o `pareamento: "grupos"`, que só existe no B.
  const fonteMotor = motorFonte;
  const iIni = fonteMotor.indexOf('case "INICIAR_ETAPA"');
  const fimIni = fonteMotor.indexOf('case "', iIni + 10);
  ok(iIni > 0 && fimIni > iIni, "o case de iniciar a etapa foi localizado");
  const trechoIni = fonteMotor.slice(iIni, fimIni);
  ok(/sistemaIni === "B"[\s\S]{0,120}gerarPareamentoB/.test(trechoIni),
    "o INICIAR_ETAPA escolhe o pareamento B quando o sistema é B");
  ok(/gerarPareamentoPorRating/.test(trechoIni),
    "e o por rating continua sendo o caminho do Sistema A");
}

secao("O atleta aprovado no circuito novo consegue ENTRAR no app — RODANDO inscrição, aprovação e sessão");
{
  // O bloqueio mais grave que a auditoria achou, e o mais silencioso: o atleta se
  // inscrevia, o organizador aprovava, e ele NUNCA conseguia entrar. Provado
  // rodando os dois motores.
  //
  // O caminho: `INSCREVER` cria a linha em `atletas` com status "pendente"; a
  // aprovação chama `writeAtleta`, e `status` é SAZONAL, então num circuito
  // não-BH ele vai SÓ para `circuito_atletas` — o `atletas.status` fica
  // "pendente" para sempre. E o `login-atleta` recusa com `cadastro_inativo`
  // (403) em SESSAO, PARTICIPAR e LOGIN_ORGANIZADOR olhando justamente o global.
  // A tela fecha junto: "Seu cadastro ainda não foi aprovado pelo admin".
  // No BH nada disso aparecia, porque lá o servidor grava nos dois lugares.
  const NOVO = "99999999-9999-9999-9999-999999999999";
  const TOKEN = "token-da-sessao-do-novato";
  const sha = (t) => createHash("sha256").update(t).digest("hex");

  const cenarioEntrada = async () => {
    const { banco, motor } = await montarMotor({
      circuitos: [circuito(BH), circuito(NOVO, { slug: "novo", sistema: "B", regulamento_versao: "vB-01", inscricoes_abertas: true })],
      atletas: [], circuito_atletas: [],
      funcoes: { get_cpf_pepper: () => "pimenta-de-teste", dedup_por_cpf_hash: () => [{ existe: false, atleta_id: null }] },
      outras: { atleta_documento: [], tentativas_busca_cpf: [], atleta_sessao: [] },
    });
    const aa = await carregarFuncao("athlete-action", banco);
    const r = await aa.chamar({
      acao: "INSCREVER",
      payload: {
        circuitoId: NOVO, nome: "Novato da Silva", telefone: "31999998888",
        aceiteRegulamento: true, aceiteLGPD: true,
        cpf: "52998224725", cpfConsent: true, cpfConsentVersao: "cpf-2026-08-v1",
        dataNascimento: "1990-01-01",
      },
    });
    ok(r.corpo?.sucesso === true, `a inscrição no circuito novo conclui (erro: ${JSON.stringify(r.corpo?.erro)})`);
    const id = banco.tabelas.atletas[0]?.id;
    ok(!!id, "e o atleta foi criado");
    return { banco, motor, id };
  };

  {
    const { banco, motor, id } = await cenarioEntrada();
    igual(banco.acha("atletas", a => a.id === id)?.status, "pendente",
      "recém-inscrito, a identidade global nasce pendente — como deve ser");

    const rv = await comoAdmin(motor, "INSCRICAO_VALIDAR", { circuitoId: NOVO, id, rating: 500, approved: true });
    ok(rv.corpo?.sucesso === true, `o organizador aprova a inscrição (erro: ${JSON.stringify(rv.corpo?.erro)})`);
    igual(banco.acha("circuito_atletas", c => c.atleta_id === id)?.status, "ativo",
      "o vínculo com o circuito fica ativo");
    igual(banco.acha("atletas", a => a.id === id)?.status, "ativo",
      "E A IDENTIDADE GLOBAL TAMBÉM — sem isto o atleta aprovado nunca entra no app");

    // A prova que importa: o motor do login deixa ele entrar.
    banco.tabelas.atleta_sessao.push({ id: "s1", atleta_id: id, token_hash: sha(TOKEN), expira_em: new Date(Date.now() + 3600e3).toISOString() });
    const login = await carregarFuncao("login-atleta", banco);
    const rs = await login.chamar({ acao: "SESSAO", token: TOKEN });
    ok(rs.corpo?.sucesso === true && rs.corpo?.erro !== "cadastro_inativo",
      `e o login-atleta reidrata a sessão dele em vez de recusar com cadastro_inativo (veio: ${JSON.stringify(rs.corpo?.erro ?? "ok")})`);
  }

  // Reprovar num circuito NÃO pode trancar a porta dos outros: a identidade é da
  // pessoa, o vínculo é do circuito. Por isso a promoção é só para cima.
  {
    const { banco, motor, id } = await cenarioEntrada();
    await comoAdmin(motor, "INSCRICAO_VALIDAR", { circuitoId: NOVO, id, rating: 500, approved: true });
    await comoAdmin(motor, "INSCRICAO_VALIDAR", { circuitoId: NOVO, id, approved: false, motivo: "não compareceu" });
    igual(banco.acha("circuito_atletas", c => c.atleta_id === id)?.status, "reprovado",
      "reprovar depois marca o VÍNCULO como reprovado");
    igual(banco.acha("atletas", a => a.id === id)?.status, "ativo",
      "mas a identidade global continua ativa — ser reprovado num circuito não tranca a porta dos outros");
  }
}

secao("O circuito de PONTOS não encosta no rating global — RODANDO as duas portas");
{
  // A pergunta do Juliano era "um não interferindo no outro". Este era o caso em
  // que interferia, e do pior jeito: em silêncio e para sempre.
  //
  // `rating`, `rating_inicial`, `rating_pico` e `rating_historico` NÃO são sazonais
  // — vão para `atletas`, a identidade GLOBAL que a pessoa carrega para todos os
  // circuitos dela. O `writeAtleta` já barrava três deles num circuito de pontos.
  // FALTAVA `rating_inicial` — e ele é escrito justamente pela porta de entrada:
  // `INSCRICAO_VALIDAR` grava `rating_inicial: rating` ao aprovar uma inscrição.
  //
  // Então aprovar alguém no circuito de PONTOS reescrevia o `rating_inicial` global
  // daquela pessoa: o número com que ela entrou no circuito de RATING, que é a base
  // da linha do tempo dela no BH. Com o que o cliente mandasse, ou com `undefined`,
  // porque no Sistema B nem existe campo de rating na tela para digitar.
  //
  // ⚠️ A 1ª versão desta seção testava só `rating` — que JÁ estava protegido — e a
  // mutação ficou VERDE. Passei pelo motivo errado e quase "consertei" dentro dos
  // dois `case`, criando a terceira cópia da mesma regra. A asserção agora cobre a
  // lista inteira, campo a campo, e é por isso que ela pega.
  const ATL = "77777777-0000-0000-0000-000000000001";
  const CIRC_PONTOS = "77777777-1111-1111-1111-111111111111";
  const RATING_DE_VERDADE = 1234;

  const cenarioPontos = async () => montarMotor({
    circuitos: [
      circuito(BH, { regulamento_versao: "v03-13" }),
      circuito(CIRC_PONTOS, { slug: "pontos", sistema: "B", pareamento: "sorteio", regulamento_versao: "vB-01" }),
    ],
    // O atleta existe nos dois: joga rating no BH e pontos no circuito novo.
    atletas: [atleta(ATL, {
      rating: RATING_DE_VERDADE, rating_inicial: RATING_DE_VERDADE,
      rating_pico: RATING_DE_VERDADE, rating_historico: [{ data: "2026-01-01", rating: RATING_DE_VERDADE }],
      nome: "Fulano",
    })],
    circuito_atletas: [
      { circuito_id: BH, atleta_id: ATL, status: "ativo" },
      { circuito_id: CIRC_PONTOS, atleta_id: ATL, status: "pendente", pendente_circuito: false },
    ],
  });

  const ratingGlobal = (banco) => banco.acha("atletas", a => a.id === ATL)?.rating;
  // A lista INTEIRA da identidade de rating. Testar um campo só foi o erro da 1ª
  // versão: `rating` estava protegido e `rating_inicial` não, e a bateria não viu.
  // ⚠️ Medido com mutação campo a campo (29/09/2026): tirar a proteção de `rating`
  // ou de `rating_inicial` deixa a bateria VERMELHA — são os dois que alguma ação
  // do organizador realmente escreve. Tirar a de `rating_pico` ou a de
  // `rating_historico` deixa a bateria VERDE, porque hoje NENHUMA ação os escreve
  // num circuito de pontos: elas são defesa em profundidade, e esta asserção NÃO as
  // protege. Está escrito aqui para ninguém ler a lista e achar que protege.
  const CAMPOS_DE_RATING = ["rating", "rating_inicial", "rating_pico"];
  const conferirIdentidadeIntacta = (banco, quando) => {
    const g = banco.acha("atletas", a => a.id === ATL);
    for (const campo of CAMPOS_DE_RATING) {
      igual(g?.[campo], RATING_DE_VERDADE,
        `${quando}: o campo global \`${campo}\` do atleta não se mexe`);
    }
    igual(JSON.stringify(g?.rating_historico), JSON.stringify([{ data: "2026-01-01", rating: RATING_DE_VERDADE }]),
      `${quando}: e o histórico de rating dele fica intacto`);
  };

  // 1. Aprovar no circuito de pontos.
  {
    const { banco, motor } = await cenarioPontos();
    const r = await comoAdmin(motor, "INSCRICAO_VALIDAR", { circuitoId: CIRC_PONTOS, id: ATL, rating: 300, approved: true });
    ok(r.corpo?.sucesso === true, `a aprovação no circuito de pontos conclui (erro: ${JSON.stringify(r.corpo?.erro)})`);
    igual(banco.acha("circuito_atletas", c => c.circuito_id === CIRC_PONTOS && c.atleta_id === ATL)?.status, "ativo",
      "o vínculo com o circuito de pontos fica ativo");
    conferirIdentidadeIntacta(banco, "aprovando no circuito de pontos com o cliente mandando 300");
  }

  // 2. Editar o atleta pelo painel do circuito de pontos.
  {
    const { banco, motor } = await cenarioPontos();
    const r = await comoAdmin(motor, "EDITAR_ATLETA", { circuitoId: CIRC_PONTOS, id: ATL, nome: "Fulano Corrigido", telefone: "31900000000", rating: 300, status: "ativo" });
    ok(r.corpo?.sucesso === true, `a edição conclui (erro: ${JSON.stringify(r.corpo?.erro)})`);
    igual(banco.acha("atletas", a => a.id === ATL)?.nome, "Fulano Corrigido",
      "o nome, que é identidade de verdade, é corrigido");
    conferirIdentidadeIntacta(banco, "arrumando o nome pelo painel do circuito de pontos");
  }

  // 3. E no circuito de RATING as duas ações continuam podendo — senão o conserto
  //    teria quebrado o Sistema A em vez de proteger o B.
  {
    const { banco, motor } = await cenarioPontos();
    await comoAdmin(motor, "EDITAR_ATLETA", { circuitoId: BH, id: ATL, nome: "Fulano", telefone: "31900000000", rating: 999, status: "ativo" });
    igual(ratingGlobal(banco), 999,
      "no circuito de RATING o organizador continua podendo ajustar o rating — a guarda é só do Sistema B");
  }
}

secao("Um circuito não age sobre o outro — nem pelo super-admin");
{
  // O organizador sempre foi escopado por RECURSO: passar um matchId de outro
  // circuito devolve 403. O super-admin não era — e o raciocínio de antes ("ele
  // pode tudo, não há o que negar") respondia a pergunta errada.
  //
  // A pergunta aqui não é PERMISSÃO, é COERÊNCIA: a ação diz em que circuito está
  // agindo e diz em que partida. Se os dois discordam, isso nunca é intenção — é
  // bug de quem chamou, e obedecer é o pior desfecho possível.
  //
  // E o risco não é teórico neste app: o painel do admin é por circuito e já teve
  // estado sobrevivendo à troca de circuito. Com a tela no circuito B e um matchId
  // do circuito A sobrando na memória, o motor validava, imputava resultado ou
  // aplicava W.O. NO OUTRO CIRCUITO, em silêncio.
  const OUTRO = "33333333-aaaa-4444-8888-333333333333";
  const A1 = "aa000000-0000-4000-8000-000000000001";
  const A2 = "aa000000-0000-4000-8000-000000000002";

  const doisCircuitos = async () => montarMotor({
    circuitos: [circuito(BH, { regulamento_versao: "v03-13" }), circuito(OUTRO, { slug: "outro", sistema: "B", regulamento_versao: "vB-01" })],
    atletas: [atleta(A1), atleta(A2)],
    circuito_atletas: [
      { circuito_id: BH, atleta_id: A1, status: "ativo" },
      { circuito_id: BH, atleta_id: A2, status: "ativo" },
    ],
    chaves: [{ id: "chave1", nome: "Chave A", rodada_atual: 1, circuito_id: BH }],
    // A partida é do BH. Toda ação abaixo vai dizer que está no circuito OUTRO.
    partidas: [partida("jbh", { circuito_id: BH, atleta1_id: A1, atleta2_id: A2, p1_placar1: 3, p1_placar2: 1, p2_placar1: 3, p2_placar2: 1 })],
  });

  const ACOES_COM_PARTIDA = [
    ["VALIDATE_RESULT", { approved: true }],
    ["ADMIN_IMPUTAR_RESULTADO", { score1: 3, score2: 0 }],
    ["DESFAZER_VALIDACAO", {}],
    ["MARCAR_RESULTADO_COMUNICADO", { comunicado: true }],
    ["APLICAR_WO", { tipo: "culposo", faltosoId: A1, beneficiarioId: A2 }],
  ];

  for (const [acao, extra] of ACOES_COM_PARTIDA) {
    const { banco, motor } = await doisCircuitos();
    const antes = JSON.stringify(banco.acha("partidas", m => m.id === "jbh"));
    const r = await comoAdmin(motor, acao, { circuitoId: OUTRO, matchId: "jbh", ...extra });
    igual(r.status, 403,
      `o super-admin no circuito OUTRO não consegue ${acao} numa partida do BH`);
    igual(JSON.stringify(banco.acha("partidas", m => m.id === "jbh")), antes,
      `e a partida do BH fica byte-idêntica depois do ${acao} recusado`);
  }

  // E a mesma ação, apontando para o circuito certo, continua funcionando — senão
  // a trava teria virado uma parede em vez de uma guarda.
  {
    const { banco, motor } = await doisCircuitos();
    const r = await comoAdmin(motor, "VALIDATE_RESULT", { circuitoId: BH, matchId: "jbh", approved: true });
    ok(r.corpo?.sucesso === true, `no circuito certo a validação passa (erro: ${JSON.stringify(r.corpo?.erro)})`);
    igual(banco.acha("partidas", m => m.id === "jbh")?.validado, true, "e a partida do BH é validada");
  }

  // Atleta de outro circuito: mesma ideia, pela outra porta.
  {
    const { banco, motor } = await doisCircuitos();
    const r = await comoAdmin(motor, "ARQUIVAR_ATLETA", { circuitoId: OUTRO, id: A1 });
    igual(r.status, 403,
      "o super-admin no circuito OUTRO não arquiva um atleta que só participa do BH");
    igual(banco.acha("circuito_atletas", c => c.circuito_id === BH && c.atleta_id === A1)?.status, "ativo",
      "e o vínculo dele com o BH fica como estava");
  }

  // ⚠️ No BH o super-admin tem um FALLBACK, não um pulo. A exceção existe porque
  // lá a participação é a própria linha de `atletas` (roster legado) e há atleta do
  // BH sem linha de vínculo — exigi-la recusaria operação legítima, e a bateria
  // pegou isso na hora quando eu apertei demais.
  // Mas eu a escrevi como PULO CEGO, e o Guardião de Segurança mediu o preço:
  // com o BH selecionado e o id de um atleta de OUTRO circuito, o `EXCLUIR_ATLETA`
  // respondia 200 e o atleta SUMIA do banco, levando por efeito cascata os
  // vínculos dele em todos os circuitos. Irreversível.
  // Regra agora: tem vínculo com outro circuito e não com o BH ⇒ não é do BH.
  {
    const ARQ = "bb000000-0000-4000-8000-000000000001";
    const { banco, motor } = await montarMotor({
      circuitos: [circuito(BH, { regulamento_versao: "v03-13" })],
      atletas: [atleta(ARQ, { status: "arquivado" })],
      circuito_atletas: [],
    });
    const r = await comoAdmin(motor, "DESARQUIVAR_ATLETA", { circuitoId: BH, id: ARQ });
    igual(r.status, 200, "no BH o super-admin continua desarquivando atleta sem linha de vínculo — o roster legado vale");
    igual(banco.acha("atletas", a => a.id === ARQ)?.status, "ativo", "e o atleta volta a ativo");
  }
}

secao("A promoção da identidade global é um portão — não um comentário");
{
  // Três achados dos guardiões, todos na mesma função, todos provados rodando:
  //
  // 1. [Jurídico] A trava "só para cima" NÃO TINHA TESTE. Ele sabotou as DUAS
  //    cópias da regra juntas (o `return` antecipado e o filtro do `update`) e a
  //    bateria ficou VERDE. Sem essa linha, um cadastro ANONIMIZADO volta a
  //    "ativo" e o login deixa entrar quem exerceu o direito de exclusão.
  // 2. [Segurança] REGRESSÃO QUE EU INTRODUZI: o `INSCRICAO_VALIDAR` não tinha
  //    guarda de LGPD nenhuma. Quem pediu exclusão dos dados era reativado por uma
  //    aprovação de rotina. Antes dos meus commits isso não acontecia.
  // 3. [Jurídico] A promoção punha o atleta do circuito novo DENTRO DO ROSTER DO
  //    BH: o roster legado é `status='ativo' AND pendente_circuito=false`, e a
  //    coluna nasce `false`. Ele provou rodando o INICIAR_ETAPA do BH.
  const NOVO = "88880000-1111-2222-3333-444444444444";
  const cenarioPromo = async (campos = {}) => montarMotor({
    circuitos: [
      circuito(BH, { regulamento_versao: "v03-13" }),
      circuito(NOVO, { slug: "promo", sistema: "B", pareamento: "sorteio", regulamento_versao: "vB-01" }),
    ],
    atletas: [atleta("alvo", { status: "pendente", pendente_circuito: false, ...campos })],
    circuito_atletas: [{ circuito_id: NOVO, atleta_id: "alvo", status: "pendente", pendente_circuito: false }],
  });
  const global = (banco) => banco.acha("atletas", a => a.id === "alvo");

  // ── 1. O caminho feliz continua funcionando ──────────────────────────────
  {
    const { banco, motor } = await cenarioPromo();
    await comoAdmin(motor, "INSCRICAO_VALIDAR", { circuitoId: NOVO, id: "alvo", approved: true });
    igual(global(banco)?.status, "ativo", "aprovado no circuito novo, o cadastro global vira ativo");
    igual(global(banco)?.pendente_circuito, true,
      "E ENTRA NA FILA DE ESPERA GLOBAL — é isso que o mantém fora do roster do BH");
  }

  // ── 2. O roster do BH, atravessando o consumidor ─────────────────────────
  // Conferir o valor gravado não basta (lição de 27/09): a prova é o BH iniciar a
  // etapa e o intruso NÃO aparecer.
  {
    const { banco, motor } = await montarMotor({
      circuitos: [
        circuito(BH, { regulamento_versao: "v03-13" }),
        circuito(NOVO, { slug: "promo", sistema: "B", pareamento: "sorteio", regulamento_versao: "vB-01" }),
      ],
      atletas: [
        ...Array.from({ length: 8 }, (_, i) => atleta(`bh-${i}`, { status: "ativo", pendente_circuito: false })),
        atleta("intruso", { status: "pendente", pendente_circuito: false }),
      ],
      circuito_atletas: [{ circuito_id: NOVO, atleta_id: "intruso", status: "pendente", pendente_circuito: false }],
      chaves: [], partidas: [],
    });
    await comoAdmin(motor, "INSCRICAO_VALIDAR", { circuitoId: NOVO, id: "intruso", rating: 500, approved: true });
    const r = await comoAdmin(motor, "INICIAR_ETAPA", { circuitoId: BH });
    ok(r.corpo?.sucesso === true, `a etapa do BH inicia (erro: ${JSON.stringify(r.corpo?.erro)})`);
    igual(r.corpo?.dados?.atletas, 8,
      "e o BH começa com os 8 atletas DELE — o aprovado no circuito novo não entrou no roster do BH");
    const doIntruso = banco.tabelas.partidas.filter(m => m.atleta1_id === "intruso" || m.atleta2_id === "intruso");
    igual(doIntruso.length, 0, "o intruso não foi pareado em partida nenhuma do BH");
    igual(banco.acha("atletas", a => a.id === "intruso")?.chave, undefined,
      "e não recebeu chave do BH");
  }

  // ── 3. As duas portas da LGPD ────────────────────────────────────────────
  {
    const { banco, motor } = await cenarioPromo({ exclusao_solicitada_em: "2026-09-01T10:00:00Z" });
    await comoAdmin(motor, "INSCRICAO_VALIDAR", { circuitoId: NOVO, id: "alvo", approved: true });
    igual(global(banco)?.status, "pendente",
      "quem PEDIU EXCLUSÃO dos dados não é reativado por uma aprovação de rotina");
  }
  {
    const { banco, motor } = await cenarioPromo({ telefone: "removido:alvo" });
    await comoAdmin(motor, "INSCRICAO_VALIDAR", { circuitoId: NOVO, id: "alvo", approved: true });
    igual(global(banco)?.status, "pendente",
      "e um cadastro JÁ ANONIMIZADO também não volta à vida por aqui");
  }

  // ── 4. A trava "só para cima", com os estados que importam ───────────────
  // Sabotar AS DUAS cópias juntas tem de ficar vermelho — hoje ficava verde.
  for (const [status, extra, oQue] of [
    ["arquivado", { telefone: "removido:alvo" }, "anonimizado"],
    ["arquivado", {}, "arquivado"],
    ["reprovado", {}, "reprovado"],
  ]) {
    const { banco, motor } = await cenarioPromo({ status, ...extra });
    await comoAdmin(motor, "INSCRICAO_VALIDAR", { circuitoId: NOVO, id: "alvo", approved: true });
    igual(global(banco)?.status, status,
      `a promoção NÃO rebaixa nem levanta quem está ${oQue} — ela só age sobre "pendente"`);
  }

  // E o consumidor: o login continua recusando quem não foi promovido.
  {
    const { banco, motor } = await cenarioPromo({ status: "arquivado", telefone: "removido:alvo" });
    await comoAdmin(motor, "INSCRICAO_VALIDAR", { circuitoId: NOVO, id: "alvo", approved: true });
    banco.tabelas.atleta_sessao.push({ id: "s9", atleta_id: "alvo", token_hash: createHash("sha256").update("tok").digest("hex"), expira_em: new Date(Date.now() + 3600e3).toISOString() });
    const login = await carregarFuncao("login-atleta", banco);
    const rs = await login.chamar({ acao: "SESSAO", token: "tok" });
    igual(rs.corpo?.erro, "cadastro_inativo",
      "e o login-atleta continua recusando o cadastro anonimizado — a porta não reabriu por via lateral");
  }
}

secao("A auto-validação lê o circuito DA PARTIDA — o atleta não escolhe a regra");
{
  // Achado do Guardião de Segurança, e o defeito é meu: ao consertar a
  // auto-validação eu transformei `payload.circuitoId` — até então decorativo no
  // ENVIAR_PLACAR — em PARÂMETRO DE DECISÃO, sem validar de onde ele vem.
  //
  // O ataque, exatamente como ele o rodou: partida do circuito novo, com a
  // auto-validação DESLIGADA pelo organizador; os dois atletas mandam o mesmo
  // placar declarando `circuitoId: <BH>` (que está LIGADO). Antes: auto-validava,
  // passando por cima do botão do organizador.
  const NOVO = "99990000-1111-2222-3333-444444444444";
  const { banco } = await montarMotor({
    circuitos: [
      circuito(BH, { auto_validar_placar: true }),
      circuito(NOVO, { slug: "atacado", sistema: "B", auto_validar_placar: false }),
    ],
    configuracao: [{ id: 1, fase: "temporada", temporada_numero: 1, temporada_ano: 2026, rodadas_por_temporada: 6, auto_validar_placar: true }],
    atletas: [atleta("a1"), atleta("a2")],
    chaves: [{ id: "chaveN", nome: "N", rodada_atual: 1, circuito_id: NOVO }],
    partidas: [partida("jN", { circuito_id: NOVO, chave_id: "chaveN", atleta1_id: "a1", atleta2_id: "a2", p2_placar1: 3, p2_placar2: 1 })],
  });
  const fn = await carregarFuncao("athlete-action", banco);
  const r = await fn.chamar({
    acao: "ENVIAR_PLACAR",
    // O atleta MENTE o circuito no corpo do pedido.
    payload: { circuitoId: BH, matchId: "jN", athleteId: "a1", score1: 3, score2: 1 },
  });
  ok(r.corpo?.sucesso === true, "o placar é aceito normalmente");
  ok(r.corpo?.dados?.autoValidado !== true,
    "mas NÃO é auto-validado — o motor pergunta à partida de que circuito ela é, e ignora o que o atleta declarou");
  igual(banco.acha("partidas", m => m.id === "jN")?.validado, false,
    "e a partida continua esperando o organizador, que foi o que ele configurou");
}

secao("Avançar a rodada sem chave é RECUSADO — a correção que não tinha portão");
{
  // Esta era a correção mais grave do Bloco 1: o `AVANCAR_RODADA` caía num
  // `|| "key_1"` — a chave do BH — quando o circuito não tinha chave. O Guardião
  // de Segurança já tinha provado que isso voltava o BH da rodada 6 para a 2.
  //
  // O Guardião de Confiabilidade sabotou a correção de volta e a bateria ficou
  // INTEIRA VERDE. Motivo: TODOS os cenários de `AVANCAR_RODADA` da bateria rodam
  // `INICIAR_ETAPA` antes, que cria a chave — então o ramo "circuito sem chave"
  // nunca era alcançado por asserção nenhuma. A correção estava certa e
  // desprotegida.
  const SEM_CHAVE = "aaaa0000-1111-2222-3333-444444444444";
  const { banco, motor } = await montarMotor({
    circuitos: [
      circuito(BH, { regulamento_versao: "v03-13" }),
      circuito(SEM_CHAVE, { slug: "sem-chave", sistema: "B", pareamento: "sorteio", regulamento_versao: "vB-01", fase: "etapa" }),
    ],
    atletas: Array.from({ length: 8 }, (_, i) => atleta(`s-${i}`)),
    circuito_atletas: Array.from({ length: 8 }, (_, i) => ({ circuito_id: SEM_CHAVE, atleta_id: `s-${i}`, status: "ativo", pendente_circuito: false })),
    // A chave é DO BH, e está na rodada 6. O circuito novo não tem chave nenhuma.
    chaves: [{ id: "key_1", nome: "Chave Única", rodada_atual: 6, circuito_id: BH }],
    partidas: [],
  });

  const r = await comoAdmin(motor, "AVANCAR_RODADA", { circuitoId: SEM_CHAVE });
  igual(r.status, 409, "avançar a rodada num circuito sem chave é recusado com 409");
  ok(/inicie a etapa/i.test(String(r.corpo?.erro || "")),
    `e a mensagem diz o que fazer (veio: ${JSON.stringify(r.corpo?.erro)})`);

  // O que a recusa está protegendo: a chave do BH.
  igual(banco.acha("chaves", c => c.id === "key_1")?.rodada_atual, 6,
    "e a chave do BH continua na rodada 6 — era ela que o `|| \"key_1\"` reescrevia");
  igual(banco.tabelas.partidas.length, 0,
    "nenhuma partida foi criada — nem no circuito novo, nem no BH");
  igual(banco.tabelas.chaves.length, 1,
    "e nenhuma chave foi inventada pelo caminho");
}

secao("O rodízio: a escala da temporada inteira, sem repetir ninguém");
{
  // Decisão do Juliano em 29/09/2026: "Não pode ter repetição de atleta."
  // O motor ganhou o método do círculo — fixa um atleta e gira os demais, gerando
  // n-1 rodadas sem nenhuma repetição. É o rodízio de tabela de campeonato.
  //
  // Três propriedades sustentam isso, e as três precisam de portão próprio:
  //   1. zero repetição (a regra)
  //   2. a ordem é ESTÁVEL dentro da temporada — o INICIAR gera as rodadas 1 e 2 e
  //      cada AVANCAR gera mais duas; se a ordem mudasse entre as chamadas, o
  //      rodízio se perderia e a repetição voltaria pela porta dos fundos
  //   3. a ordem MUDA na virada — senão o "sorteio" que o regulamento promete
  //      seria a mesma tabela todo ano
  const CIRC = "cccc0000-1111-2222-3333-444444444444";
  const ids = (n) => Array.from({ length: n }, (_, i) => `rod-${String(i).padStart(2, "0")}`);

  const temporadaCompleta = async (quantos, pareamento, tempNum = 1) => {
    const lista = ids(quantos);
    const { banco, motor } = await montarMotor({
      circuitos: [circuito(BH), circuito(CIRC, {
        slug: "rodizio", sistema: "B", pareamento, regulamento_versao: "vB-01",
        rodadas_por_temporada: 6, fase: "temporada", temporada_numero: tempNum,
      })],
      atletas: lista.map(id => atleta(id)),
      circuito_atletas: lista.map(id => ({ circuito_id: CIRC, atleta_id: id, status: "ativo", pendente_circuito: false, saldo_temp: 0 })),
      chaves: [], partidas: [],
    });
    await comoAdmin(motor, "INICIAR_ETAPA", { circuitoId: CIRC });
    await comoAdmin(motor, "AVANCAR_RODADA", { circuitoId: CIRC });
    await comoAdmin(motor, "AVANCAR_RODADA", { circuitoId: CIRC });
    const partidas = banco.tabelas.partidas.filter(m => m.circuito_id === CIRC);
    const confronto = (m) => [m.atleta1_id, m.atleta2_id].sort().join("-");
    const daRodada = (r) => partidas.filter(m => m.rodada === r).map(confronto).sort().join(" ");
    return { partidas, lista, daRodada, confrontos: partidas.map(confronto) };
  };

  // ── 1. ZERO repetição, nas configurações que o regulamento permite ────────
  for (const n of [8, 9, 12, 20]) {
    const { confrontos, lista, partidas } = await temporadaCompleta(n, "sorteio");
    igual(confrontos.length - new Set(confrontos).size, 0,
      `com ${n} atletas, NENHUM confronto se repete nas 6 rodadas`);
    // E o rodízio não pode ter deixado ninguém de fora de graça.
    // ⚠️ A 1ª versão desta asserção exigia 5 jogos para todo mundo no ímpar, e
    // estava ERRADA — suposição minha, não medição. Com 9 atletas e 6 rodadas só
    // SEIS pessoas folgam (uma por rodada); as outras três jogam as seis. A conta
    // fecha: 6×5 + 3×6 = 48 = 6 rodadas × 4 partidas × 2 atletas.
    const jogos = lista.map(id => partidas.filter(m => m.atleta1_id === id || m.atleta2_id === id).length);
    igual(jogos.reduce((x, y) => x + y, 0), partidas.length * 2,
      `com ${n} atletas, a soma dos jogos individuais bate com o total de partidas`);
    ok(jogos.every(j => j === 6 || (n % 2 === 1 && j === 5)),
      `com ${n} atletas, ninguém fica de fora de graça (jogos por atleta: ${[...new Set(jogos)].sort().join(" ou ")})`);
    if (n % 2 === 1) {
      igual(jogos.filter(j => j === 5).length, 6,
        `com ${n} atletas, exatamente 6 pessoas folgaram uma vez — uma por rodada`);
    }
  }

  // ── 2. A ordem é ESTÁVEL dentro da temporada ──────────────────────────────
  // Duas montagens independentes da MESMA temporada têm de dar a mesma rodada 1.
  // Se isto quebrar, as rodadas 3-6 deixam de pertencer ao mesmo rodízio.
  {
    const a = await temporadaCompleta(8, "sorteio", 1);
    const b = await temporadaCompleta(8, "sorteio", 1);
    igual(a.daRodada(1), b.daRodada(1),
      "a rodada 1 da mesma temporada é idêntica em execuções independentes — é o que mantém o rodízio de pé entre o INICIAR e os AVANCAR");
    igual(a.daRodada(5), b.daRodada(5),
      "e a rodada 5 também — ela é gerada numa chamada separada, três ações depois");
  }

  // ── 3. A ordem MUDA na virada de temporada ────────────────────────────────
  {
    const t1 = await temporadaCompleta(8, "sorteio", 1);
    const t2 = await temporadaCompleta(8, "sorteio", 2);
    const t3 = await temporadaCompleta(8, "sorteio", 3);
    const r1 = [t1.daRodada(1), t2.daRodada(1), t3.daRodada(1)];
    igual(new Set(r1).size, 3,
      `o sorteio é REFEITO a cada temporada — as três primeiras rodadas são diferentes (${r1.join(" | ")})`);
  }

  // ── O bye continua rotacionando, e agora sai do próprio rodízio ───────────
  {
    const { partidas, lista } = await temporadaCompleta(9, "sorteio");
    const byes = [];
    for (const r of [1, 2, 3, 4, 5, 6]) {
      const jogaram = new Set(partidas.filter(m => m.rodada === r).flatMap(m => [m.atleta1_id, m.atleta2_id]));
      const fora = lista.filter(id => !jogaram.has(id));
      igual(fora.length, 1, `com 9 atletas, exatamente um folga na rodada ${r}`);
      byes.push(fora[0]);
    }
    igual(new Set(byes).size, 6,
      `e ninguém folga duas vezes em 6 rodadas (${byes.join(", ")}) — o "fantasma" do rodízio gira junto`);
  }

  // ── O modo GRUPOS continua no pareamento dinâmico, de propósito ───────────
  // Ele pareia por proximidade na tabela de pontos, que muda a cada rodada — um
  // rodízio fixo contradiria o próprio Cap. 03. E a medição dele já era 0/120.
  {
    const { confrontos } = await temporadaCompleta(8, "grupos");
    igual(confrontos.length - new Set(confrontos).size, 0,
      "no modo grupos por faixa também não há repetição");
  }
}

secao("A exclusão de dados alcança TUDO — RODANDO a função que apaga dado pessoal");
{
  // ⚠️ Esta função NUNCA TINHA SIDO EXECUTADA por teste nenhum. Ela é a que apaga
  // dado pessoal a pedido do titular, e a única asserção que existia sobre ela
  // descrevia o estado que ela deixa — lida do código, não medida.
  //
  // O Guardião Jurídico provou rodando: ela era UM ÚNICO update em `atletas`.
  // Depois de "finalizar exclusão", em circuito não-BH:
  //   · o vínculo seguia `status: 'ativo'`, e o INICIAR_ETAPA ainda o pareava;
  //   · `aceite_regulamento`, `versao_regulamento` e `data_aceite_regulamento`
  //     continuavam lá — o titular revogava e o banco seguia PROVANDO que ele
  //     tinha aceitado;
  //   · a sessão do aparelho dele continuava válida;
  //   · e a tela do admin prometia "remove do circuito", o que era falso.
  //
  // DECISÃO DO JULIANO em 29/09/2026, fechando o 0.7.2: o CPF (guardado só como
  // código embaralhado) passa a ser apagado junto, com a consequência escrita na
  // tela ANTES de o titular confirmar — ele volta como cadastro novo, e o clube
  // não tem como reconhecê-lo.
  const CIRC = "dddd0000-1111-2222-3333-444444444444";
  const ALVO = "dddd0000-0000-0000-0000-0000000000a1";
  const OUTRO = "dddd0000-0000-0000-0000-0000000000a2";

  const cenarioLgpd = async () => montarMotor({
    funcao: "anonimizar-atleta",
    // O bucket das fotos é PÚBLICO. O alvo tem DUAS fotos (quem troca a de perfil
    // deixa a antiga para trás, e ela continua servindo) e há uma foto de outro
    // atleta, que não pode ser tocada.
    arquivos: {
      "fotos-atletas": [
        `${"dddd0000-0000-0000-0000-0000000000a1"}-111.jpg`,
        `${"dddd0000-0000-0000-0000-0000000000a1"}-222.jpg`,
        `${"dddd0000-0000-0000-0000-0000000000a2"}-333.jpg`,
      ],
      // O comprovante de W.O. — o atestado. O nome do arquivo é pelo id DA
      // PARTIDA, não do atleta: por isso a URL na tabela era o único vínculo.
      "comprovantes-wo": ["wo-m_111-222.jpg", "wo-m_999-888.jpg"],
    },
    circuitos: [circuito(BH), circuito(CIRC, { slug: "lgpd", sistema: "B", pareamento: "sorteio", regulamento_versao: "vB-01" })],
    atletas: [
      atleta(ALVO, { nome: "Fulano de Tal", telefone: "31988887777", apelido: "Fu", foto_url: "http://x/f.jpg", exclusao_solicitada_em: "2026-09-20T10:00:00Z" }),
      atleta(OUTRO, { nome: "Sicrano" }),
    ],
    circuito_atletas: [
      { circuito_id: CIRC, atleta_id: ALVO, status: "ativo", pendente_circuito: false, chave: "k1",
        aceite_regulamento: true, versao_regulamento: "vB-01", data_aceite_regulamento: "2026-09-01T10:00:00Z" },
      { circuito_id: CIRC, atleta_id: OUTRO, status: "ativo", aceite_regulamento: true, versao_regulamento: "vB-01" },
    ],
    outras: {
      mensagens_enviadas: [
        { id: "m1", atleta_id: ALVO, atleta_nome: "Fulano de Tal", texto: "Olá Fulano de Tal, seu jogo é dia 15." },
        { id: "m2", atleta_id: OUTRO, atleta_nome: "Sicrano", texto: "Olá Sicrano, seu jogo é dia 15." },
        // ⚠️ A mensagem de TERCEIRO que cita o nome do titular. Em produção são
        // 117 das 288 linhas. A troca antiga não alcançava nenhuma delas.
        { id: "m3", atleta_id: OUTRO, atleta_nome: "Sicrano", texto: "Sicrano, você joga contra Fulano de Tal na rodada 3." },
        // ⚠️ O caso do "Juliano": o nome do titular é PREFIXO do nome de outra
        // pessoa. Sem fronteira de palavra, excluir um CORROMPERIA o registro do
        // outro — danificar o dado de um terceiro enquanto se atende o pedido de
        // outra pessoa é problema por si. (Guardião Jurídico, 29/09/2026: há um
        // atleta cadastrado como "Juliano", nome único, em produção.)
        { id: "m4", atleta_id: OUTRO, atleta_nome: "Sicrano", texto: "Sicrano, você joga contra Fulano de Talento na rodada 4." },
      ],
      solicitacoes_wo: [
        { id: "w1", atleta_id: ALVO, adversario_id: OUTRO, atleta_nome: "Fulano de Tal", adversario_nome: "Sicrano",
          justificativa: "Estava internado com pneumonia", comprovante_url: "comprovantes-wo/wo-m_111-222.jpg", status: "pendente" },
        { id: "w2", atleta_id: OUTRO, adversario_id: ALVO, atleta_nome: "Sicrano", adversario_nome: "Fulano de Tal",
          justificativa: "Viagem de trabalho", status: "pendente" },
      ],
      atleta_documento: [
        { atleta_id: ALVO, cpf_hash: "hash-do-alvo", data_nascimento: "2012-01-01", responsavel_nome: "Mãe do Fulano", responsavel_cpf_hash: "hash-da-mae" },
        { atleta_id: OUTRO, cpf_hash: "hash-do-outro" },
      ],
      atleta_sessao: [
        { id: "s-alvo", atleta_id: ALVO, token_hash: "t1", expira_em: new Date(Date.now() + 3600e3).toISOString() },
        { id: "s-outro", atleta_id: OUTRO, token_hash: "t2", expira_em: new Date(Date.now() + 3600e3).toISOString() },
      ],
    },
  });

  const { banco, motor } = await cenarioLgpd();
  const r = await motor.chamar({ pin: PIN, id: ALVO });
  ok(r.corpo?.sucesso === true, `a exclusão conclui (erro: ${JSON.stringify(r.corpo?.erro)})`);

  // ── A identidade global ───────────────────────────────────────────────────
  const g = banco.acha("atletas", a => a.id === ALVO);
  igual(g?.nome, "Atleta removido", "o nome sai da identidade global");
  ok(String(g?.telefone || "").startsWith("removido:"), "o telefone vira um token não-identificável");
  igual(g?.apelido, null, "o apelido sai");
  igual(g?.foto_url, null, "a foto sai");
  igual(g?.status, "arquivado", "e o cadastro fica arquivado");

  // ── O VÍNCULO com o circuito — era o que faltava ──────────────────────────
  const v = banco.acha("circuito_atletas", c => c.circuito_id === CIRC && c.atleta_id === ALVO);
  igual(v?.status, "arquivado", "o vínculo com o circuito também é arquivado — a tela do admin promete isso");
  igual(v?.chave, null, "ele sai da chave");
  igual(v?.aceite_regulamento, false,
    "e o RECIBO DE CONSENTIMENTO é revogado no vínculo — o banco não pode continuar provando um aceite que o titular revogou");
  igual(v?.versao_regulamento, null, "a versão aceita sai junto");
  igual(v?.data_aceite_regulamento, null, "e a data também");

  // ── O CPF — a decisão do Juliano ──────────────────────────────────────────
  igual(banco.tabelas.atleta_documento.filter(d => d.atleta_id === ALVO).length, 0,
    "o documento é APAGADO: some o código do CPF, a data de nascimento e o nome do responsável legal");

  // ── A sessão aberta ───────────────────────────────────────────────────────
  igual(banco.tabelas.atleta_sessao.filter(x => x.atleta_id === ALVO).length, 0,
    "a sessão dele é encerrada — sem isto o aparelho continuava entrando no app depois da exclusão");

  // ── A FOTO, num bucket PÚBLICO ────────────────────────────────────────────
  // Achado do Guardião Jurídico: `foto_url` era anulada no banco e o ARQUIVO
  // ficava servindo para sempre. É o dado mais identificador que existe — um
  // rosto — e as duas telas prometem apagá-lo.
  igual(banco.arquivosDe("fotos-atletas"), [`${OUTRO}-333.jpg`],
    "as DUAS fotos do titular somem do bucket (inclusive a antiga, que ninguém mais referenciava) e a do outro atleta fica");

  // ── O NOME EM CLARO NOS REGISTROS AO LADO DA PARTIDA ──────────────────────
  // A tela promete "as partidas continuam registradas sem o seu nome". Era
  // verdade no ranking e falso aqui: 288 mensagens e 5 pedidos de W.O. em
  // produção guardavam o nome.
  {
    const m1 = banco.acha("mensagens_enviadas", m => m.id === "m1");
    igual(m1?.atleta_nome, "Atleta removido", "o nome sai do registro da mensagem");
    ok(!String(m1?.texto || "").includes("Fulano"),
      `e sai também de DENTRO do texto da mensagem (veio: ${JSON.stringify(m1?.texto)})`);
    const m2 = banco.acha("mensagens_enviadas", m => m.id === "m2");
    igual(m2?.atleta_nome, "Sicrano", "a mensagem do outro atleta não é tocada");
  }
  {
    const w1 = banco.acha("solicitacoes_wo", w => w.id === "w1");
    igual(w1?.atleta_nome, "Atleta removido", "o nome sai do pedido de W.O. dele");
    // ⚠️ `""` E NÃO `null`, e esta asserção é a prova do NO-GO de 29/09/2026.
    // Ela dizia `null`, executava a função de verdade, e CERTIFICAVA UM ESTADO QUE
    // O BANCO NÃO PODE GUARDAR — `solicitacoes_wo.justificativa` é NOT NULL em
    // produção. O banco falso não modelava restrição de coluna, então a asserção
    // ficava verde afirmando a intenção certa sobre um valor impossível.
    // Em produção a função quebraria aqui, DEPOIS de já ter apagado as fotos, o
    // CPF e as sessões. O banco falso aprendeu a recusar, e foi ele que pegou esta
    // linha quando eu consertei o motor.
    igual(w1?.justificativa, "",
      "e a JUSTIFICATIVA é APAGADA — é texto livre onde cabe motivo de saúde, e dado sensível não sobrevive a um pedido de exclusão");
    igual(w1?.comprovante_url, null, "o comprovante também");
    const w2 = banco.acha("solicitacoes_wo", w => w.id === "w2");
    igual(w2?.adversario_nome, "Atleta removido",
      "e ele também some como ADVERSÁRIO no pedido de outra pessoa");
    igual(w2?.justificativa, "Viagem de trabalho",
      "mas a justificativa do OUTRO atleta fica — ela é dado dele, não do titular");
  }

  // ── O ARQUIVO DO COMPROVANTE (o atestado) ────────────────────────────────
  // Anular a URL sem apagar o arquivo era ESTRITAMENTE PIOR que deixar os dois: o
  // nome do arquivo é pelo id DA PARTIDA, então a coluna era o único vínculo
  // entre a pessoa e o atestado. Apagar o ponteiro deixaria o dado de saúde no
  // bucket sem ninguém conseguir atribuí-lo.
  igual(banco.arquivosDe("comprovantes-wo"), ["wo-m_999-888.jpg"],
    "o comprovante de W.O. do titular SOME do bucket, e o de outra pessoa fica");

  // ── O NOME NAS MENSAGENS DE TERCEIROS ────────────────────────────────────
  {
    const m3 = banco.acha("mensagens_enviadas", m => m.id === "m3");
    ok(!String(m3?.texto || "").includes("Fulano"),
      `o nome do titular sai até da mensagem endereçada a OUTRA pessoa (veio: ${JSON.stringify(m3?.texto)}) — são 117 das 288 linhas em produção`);
    ok(String(m3?.texto || "").includes("Sicrano"),
      "e o nome do destinatário, que é dado dele, fica");
    igual(m3?.atleta_nome, "Sicrano",
      "e o registro continua dizendo de quem é a mensagem");
    // A FRONTEIRA DE PALAVRA: "Fulano de Tal" não pode casar dentro de
    // "Fulano de Talento".
    const m4 = banco.acha("mensagens_enviadas", m => m.id === "m4");
    igual(m4?.texto, "Sicrano, você joga contra Fulano de Talento na rodada 4.",
      "e o nome de OUTRA pessoa que só CONTÉM o nome do titular fica intacto — sem fronteira de palavra, excluir um corromperia o registro do outro");
  }

  // ── O SEGREDO DE ACESSO ───────────────────────────────────────────────────
  igual(g?.pin_hash, null, "o PIN de acesso é apagado — não faz sentido encerrar a sessão e manter a chave");
  igual(JSON.stringify(g?.bio_cred_ids), "[]", "e os identificadores dos aparelhos também");
  igual(g?.cpf_verificado, false, "e `cpf_verificado` deixa de dizer `true` sem documento guardado");

  // ── E NADA do outro atleta é tocado ───────────────────────────────────────
  igual(banco.acha("atletas", a => a.id === OUTRO)?.nome, "Sicrano", "o outro atleta não é tocado");
  igual(banco.acha("circuito_atletas", c => c.atleta_id === OUTRO)?.aceite_regulamento, true,
    "o recibo do outro atleta continua de pé");
  igual(banco.tabelas.atleta_documento.filter(d => d.atleta_id === OUTRO).length, 1,
    "e o documento do outro continua lá");
  igual(banco.tabelas.atleta_sessao.filter(x => x.atleta_id === OUTRO).length, 1,
    "e a sessão do outro também");

  // ── QUANDO ALGO FALHA NO MEIO: nada é destruído, e o pedido FICA NA FILA ──
  // Era a armadilha fechada que os guardiões Jurídico e de Segurança acharam,
  // separados. Antes: os `delete` não checavam erro e rodavam DEPOIS do update
  // que anonimiza. Se o apagamento do CPF falhasse, o resultado era
  //   · o CPF ficava
  //   · a identidade JÁ tinha sido destruída, sem volta
  //   · a função respondia `sucesso: true`
  //   · e `exclusao_solicitada_em` já tinha sido zerado, então O PEDIDO SUMIA DA
  //     FILA DO ADMIN — ninguém voltava lá, e não restava sinal nenhum.
  // Agora tudo o que pode falhar roda ANTES, e cada falha aborta inteira.
  for (const [tabela, operacao, oQue] of [
    ["fotos-atletas", "remove", "o apagamento da foto"],
    ["atleta_documento", "delete", "o apagamento do CPF"],
    ["atleta_sessao", "delete", "o encerramento das sessões"],
    ["mensagens_enviadas", "update", "a anonimização das mensagens"],
    ["solicitacoes_wo", "update", "a anonimização dos pedidos de W.O."],
    ["circuito_atletas", "update", "o arquivamento do vínculo"],
  ]) {
    const { banco: b, motor: m } = await cenarioLgpd();
    b.recusar(tabela, operacao, { message: "simulando falha", code: "XX000" });
    const r = await m.chamar({ pin: PIN, id: ALVO });
    ok(r.corpo?.sucesso === false,
      `quando ${oQue} falha, a função NÃO responde sucesso (veio: ${JSON.stringify(r.corpo?.sucesso)})`);
    const gg = b.acha("atletas", a => a.id === ALVO);
    igual(gg?.nome, "Fulano de Tal",
      `e a identidade NÃO é destruída — ela é irreversível, e ${oQue} ainda pode ser tentado de novo`);
    ok(!!gg?.exclusao_solicitada_em,
      `e o pedido CONTINUA NA FILA do admin — sem isso ele sumiria e ninguém voltaria lá`);
  }

  // Sem isto as asserções acima passariam com uma função que nunca conclui.
  {
    const { banco: b, motor: m } = await cenarioLgpd();
    const r = await m.chamar({ pin: PIN, id: ALVO });
    ok(r.corpo?.sucesso === true, "e sem falha nenhuma a exclusão conclui normalmente");
    igual(b.acha("atletas", a => a.id === ALVO)?.exclusao_solicitada_em, null,
      "aí sim o pedido sai da fila");
  }

  // ── Sem PIN não apaga nada ────────────────────────────────────────────────
  {
    const { banco: b2, motor: m2 } = await cenarioLgpd();
    const r2 = await m2.chamar({ pin: "pin-errado", id: ALVO });
    ok(r2.corpo?.sucesso === false, "com PIN errado a exclusão é recusada");
    igual(b2.acha("atletas", a => a.id === ALVO)?.nome, "Fulano de Tal", "e nada é apagado");
    igual(b2.tabelas.atleta_documento.filter(d => d.atleta_id === ALVO).length, 1, "o documento continua lá");
  }
}

secao("O porteiro: o portão de autenticação, RODANDO a função");
{
  // ⚠️ O `circuito-dados` era a ÚNICA das 5 peças desta onda sem asserção
  // comportamental — a bateria só o lia como TEXTO. E foi justamente ele que
  // ganhou, em 29/09/2026, um CAMINHO DE AUTENTICAÇÃO (o PIN do super-admin),
  // numa função que está no ar com `verify_jwt = false`, ou seja, alcançável da
  // internet aberta.
  //
  // Dois guardiões, independentes, sabotaram os portões dele e a bateria ficou
  // VERDE nas três tentativas:
  //   · `okSuper = true` — o PIN passa a aceitar QUALQUER valor;
  //   · some o freio de 5 tentativas — vira oráculo para adivinhar o PIN global;
  //   · `ATLETA_COLS` ganha `telefone,pin_hash` — vaza credencial de todo mundo.
  // Regra da casa (28/09): um portão que nunca foi sabotado é uma promessa, não
  // uma proteção.
  const PRIV = "eeee0000-1111-2222-3333-444444444444";
  const PUB = "eeee0000-5555-6666-7777-888888888888";
  const MEMBRO = "eeee0000-0000-0000-0000-00000000000m";

  const cenarioPorteiro = async () => montarMotor({
    funcao: "circuito-dados",
    circuitos: [
      circuito(BH),
      circuito(PRIV, { slug: "privado", sistema: "B", publico: false, regulamento_versao: "vB-01" }),
      circuito(PUB, { slug: "publico", sistema: "B", publico: true, regulamento_versao: "vB-01" }),
    ],
    atletas: [atleta(MEMBRO, { nome: "Membro", telefone: "31977776666", pin_hash: "pbkdf2$1$c2Fs$aGFzaA==", rating: 700 })],
    circuito_atletas: [
      { circuito_id: PRIV, atleta_id: MEMBRO, status: "ativo", wo_culposos_temporada: 2 },
      { circuito_id: PUB, atleta_id: MEMBRO, status: "ativo", wo_culposos_temporada: 1 },
    ],
    partidas: [],
    outras: { tentativas_login_admin: [], atleta_sessao: [], circuito_organizadores: [] },
  });

  // ── 1. Circuito PÚBLICO serve sem credencial nenhuma ─────────────────────
  {
    const { motor } = await cenarioPorteiro();
    const r = await motor.chamar({ circuitoId: PUB });
    ok(r.corpo?.sucesso === true, `circuito público é servido sem credencial (erro: ${JSON.stringify(r.corpo?.erro)})`);
    igual(r.corpo?.dados?.ranking?.length, 1, "e devolve o ranking");
  }

  // ── 2. Circuito PRIVADO recusa o anônimo ─────────────────────────────────
  {
    const { motor } = await cenarioPorteiro();
    const r = await motor.chamar({ circuitoId: PRIV });
    igual(r.status, 403, "circuito privado recusa quem não tem credencial");
    ok(r.corpo?.dados === undefined, "e a recusa NÃO vaza dados no corpo");
  }

  // ── 3. O PIN do super-admin abre o privado ───────────────────────────────
  {
    const { motor } = await cenarioPorteiro();
    const r = await motor.chamar({ circuitoId: PRIV, pin: PIN });
    ok(r.corpo?.sucesso === true, `o PIN do super-admin abre o circuito privado (erro: ${JSON.stringify(r.corpo?.erro)})`);
    igual(r.corpo?.dados?.ranking?.[0]?.wo_culposos_temporada, 2,
      "e devolve o número de W.O. — era por isto que o caminho existe");
  }

  // ── 4. PIN ERRADO é recusado, e não vaza ─────────────────────────────────
  {
    const { motor } = await cenarioPorteiro();
    const r = await motor.chamar({ circuitoId: PRIV, pin: "9999" });
    igual(r.status, 403, "PIN errado é recusado");
    ok(r.corpo?.dados === undefined, "e a recusa NÃO vaza dados no corpo");
  }

  // ── 5. O FREIO: 5 falhas em 15 min trancam, INCLUSIVE o PIN certo ────────
  {
    const { motor } = await cenarioPorteiro();
    for (let i = 0; i < 5; i++) await motor.chamar({ circuitoId: PRIV, pin: "9999" });
    const r = await motor.chamar({ circuitoId: PRIV, pin: PIN });
    igual(r.status, 429,
      "depois de 5 tentativas erradas o freio tranca — e tranca ATÉ o PIN certo, que é o que impede adivinhar por força bruta");
  }

  // ── 5b. O FREIO É POR ORIGEM — não tranca o resto do mundo ───────────────
  //
  // Até 01/10/2026 a contagem olhava `tentativa_em + sucesso` e mais nada, e a
  // tabela não guardava de onde veio a tentativa. Então 5 erros de QUALQUER pessoa
  // trancavam a entrada de TODOS por 15 minutos — inclusive o super-admin no
  // próprio painel. Não precisava de ataque: bastava alguém achar o endereço e
  // errar cinco vezes. Achado do Supervisor de Segurança.
  {
    const { motor } = await cenarioPorteiro();
    const outro = { "x-forwarded-for": "198.51.100.7" };
    for (let i = 0; i < 5; i++) await motor.chamar({ circuitoId: PRIV, pin: "9999" }, outro);
    // A origem que errou está trancada…
    const bloqueada = await motor.chamar({ circuitoId: PRIV, pin: PIN }, outro);
    igual(bloqueada.status, 429, "a origem que errou 5 vezes fica trancada");
    // …e QUEM NÃO ERROU continua entrando.
    const minha = await motor.chamar({ circuitoId: PRIV, pin: PIN }, { "x-forwarded-for": "203.0.113.9" });
    ok(minha.corpo?.sucesso === true,
      `outra origem com o PIN certo NÃO é trancada pelo erro de terceiros (erro: ${JSON.stringify(minha.corpo?.erro)})`);
  }

  // ── 5c. O FREIO É POR PORTA — um erro numa função não tranca as outras ───
  //
  // As SEIS funções que pedem PIN usavam a MESMA contagem, e a tabela não guardava
  // em qual porta o erro foi. Então errar o PIN na porta de resetar PIN trancava a
  // porta da EXCLUSÃO DE DADOS, que é obrigação legal com prazo. E esta onda dobrou
  // a superfície: a `circuito-dados` passou a usar o mesmo caderno.
  {
    const { banco, motor } = await cenarioPorteiro();
    const minhaOrigem = "203.0.113.9";
    // Cinco erros registrados em OUTRA porta, da MESMA origem.
    for (let i = 0; i < 5; i++) {
      banco.tabelas.tentativas_login_admin.push({
        id: 900 + i, tentativa_em: new Date().toISOString(),
        sucesso: false, porta: "resetar-pin-atleta", origem: minhaOrigem,
      });
    }
    const r = await motor.chamar({ circuitoId: PRIV, pin: PIN }, { "x-forwarded-for": minhaOrigem });
    ok(r.corpo?.sucesso === true,
      `erro em OUTRA porta não tranca esta — a exclusão de dados não pode ser trancada de fora (erro: ${JSON.stringify(r.corpo?.erro)})`);
  }

  // ── 5d. FAIL-CLOSED: se não dá para conferir, RECUSA ────────────────────
  //
  // O defeito mais grave dos três, e o mais silencioso: o erro da contagem era
  // descartado (`const { count }`), então banco fora do ar ou rede lenta devolvia
  // `count` vazio, `(count ?? 0)` virava zero, `0 >= 5` dava falso e a trava
  // LIBERAVA. Freio que abre ao quebrar não é freio.
  {
    const { banco, motor } = await cenarioPorteiro();
    banco.recusar("tentativas_login_admin", "select", { message: "connection reset", code: "08006" });
    const r = await motor.chamar({ circuitoId: PRIV, pin: PIN }, { "x-forwarded-for": "203.0.113.9" });
    ok(r.corpo?.sucesso !== true,
      "quando a contagem do freio FALHA, o acesso é recusado — não liberado");
    igual(r.status, 503,
      "e com 503 («não consegui conferir»), que é diferente do 429 («você excedeu») — o app trata as duas de forma diferente");
  }

  // ── 5e. AS SEIS PORTAS TÊM A MESMA TRAVA ────────────────────────────────
  //
  // Não existe pasta compartilhada entre Edge Functions neste projeto, então a
  // trava é a mesma forma repetida seis vezes. Consertar uma e esquecer cinco é
  // exatamente como este defeito sobreviveu — por isso a varredura, e não
  // asserções soltas por função.
  {
    const { readFileSync } = await import("node:fs");
    const PORTAS = ["admin-action", "circuito-dados", "anonimizar-atleta",
                    "resetar-pin-atleta", "comprovante-url", "despachos-do-dia"];
    for (const nome of PORTAS) {
      const src = readFileSync(new URL(`../supabase/functions/${nome}/index.ts`, import.meta.url), "utf8");
      ok(/from\("tentativas_login_admin"\)/.test(src),
        `[${nome}] usa a tabela de tentativas (se parar de usar, esta varredura precisa saber)`);
      ok(/\.eq\("porta", PORTA\)[\s\S]{0,80}\.eq\("origem", origem\)|\.eq\("porta", PORTA\)\.eq\("origem", origem\)/.test(src),
        `[${nome}] a contagem filtra por PORTA e por ORIGEM`);
      ok(/insert\(\{ sucesso: ok[A-Za-z]*, porta: PORTA, origem \}\)/.test(src),
        `[${nome}] e a tentativa é anotada com a porta e a origem`);
      ok(/if \(errConta\)/.test(src),
        `[${nome}] e o erro da contagem é CONFERIDO — fail-closed`);
      ok(new RegExp(`const PORTA = "${nome}"`).test(src),
        `[${nome}] com o nome da própria porta, não o de outra`);
      ok(/x-forwarded-for/.test(src),
        `[${nome}] e lê a origem do cabeçalho da chamada`);
    }
  }

  // ── 6. `pin` COM `telefone` não entra pelo caminho do super-admin ────────
  // O `!telefone` é a chave da distinção entre organizador e super-admin. Sem
  // ele, um telefone qualquer com o PIN global entraria por um caminho que não
  // confere vínculo nenhum.
  {
    const { motor } = await cenarioPorteiro();
    const r = await motor.chamar({ circuitoId: PRIV, telefone: "31900000000", pin: PIN });
    igual(r.status, 403,
      "mandar o PIN global junto com um telefone NÃO abre o circuito — esse é o caminho do organizador, e ele exige vínculo");
  }

  // ── 7. O QUE O PORTEIRO DEVOLVE — a Regra 2 do projeto ───────────────────
  // Esta asserção só passou a ter valor em 29/09/2026, quando o banco falso
  // aprendeu a projetar DENTRO do join. Antes, sabotar o `ATLETA_COLS` para
  // incluir `telefone,pin_hash` deixava a bateria verde.
  {
    const { motor } = await cenarioPorteiro();
    const r = await motor.chamar({ circuitoId: PUB });
    const item = r.corpo?.dados?.ranking?.[0] || {};
    for (const proibido of ["telefone", "pin_hash", "pin_tentativas", "desconto_pct", "isento", "cpf_hash", "aceite_lgpd", "bio_cred_ids"]) {
      ok(!(proibido in item),
        `o porteiro NÃO devolve \`${proibido}\` no item de ranking`);
    }
    ok("nome" in item && "rating" in item, "e devolve o que a tela precisa (nome, rating)");
  }
}

secao("A tela dos meses: a escolha chega ao motor e some no BH");
{
  // O motor ganhou o campo em 03/10 e a TELA ficou pela metade — eu derrubei a
  // produção no meio e parei. Esta é a outra ponta.
  const { readFileSync } = await import("node:fs");
  const fonteApp = semComentarios(readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8"));

  const iCard = fonteApp.indexOf("function MesesTemporadaCard(");
  ok(iCard > 0, "o card dos meses existe");
  const card = fonteApp.slice(iCard, fonteApp.indexOf("\nfunction ", iCard + 10));

  // ⚠️ NÃO APARECE NO BH, e isso não é layout: lá os meses de férias são CRAVADOS no
  // v03-13, Cap. 13, que é texto com aceite. Oferecer a escolha seria oferecer o que
  // o regulamento aceito não permite.
  ok(/\{circuitoSelId !== CIRCUITO_BH_ID && \(\s*<MesesTemporadaCard/.test(fonteApp),
    "o card só aparece em circuito NÃO-BH — no BH os meses são cravados no regulamento com aceite");

  // A ESCOLHA TEM DE CHEGAR AO MOTOR com o nome que ele espera.
  ok(/DEFINIR_CONFIG_CIRCUITO/.test(card) && /mesesTemporada: valor/.test(card),
    "a tela manda a escolha pela ação de configuração, no campo `mesesTemporada`");
  const motorSrc = semComentarios(readFileSync(new URL("../supabase/functions/admin-action/index.ts", import.meta.url), "utf8"));
  ok(/p\.mesesTemporada !== undefined/.test(motorSrc),
    "e o motor lê exatamente esse nome — se os dois divergirem, a tela salva no vazio");

  // O CAMINHO INTEIRO: banco → estado → tela. Um elo que perde o campo faz a tela
  // mostrar o valor errado sem erro nenhum, que foi o defeito de três tradutores
  // nesta onda.
  ok(/mesesTemporada: config\?\.\[0\]\?\.meses_temporada/.test(fonteApp),
    "a configuração lida do banco vira estado");
  ok(/getConfig: \(\) => supaFetch\(`circuitos[^`]*meses_temporada/.test(fonteApp),
    "e a leitura PEDE a coluna — sem isso o estado nasceria sempre nulo");
  ok(/mesesTemporada !== undefined \? mesesTemporada : state\.mesesTemporada/.test(fonteApp),
    "o LOAD_FROM_DB preserva o campo");
  ok(/\.\.\.\(mesesTemporada !== undefined \? \{ mesesTemporada: mesesTemporada \|\| null \} : \{\}\)/.test(fonteApp),
    "e o reducer reflete a escolha na hora — senão o card mostraria o valor antigo e o organizador acharia que não pegou");

  // A TELA SÓ DEIXA SALVAR 3, e diz o que falta.
  ok(/atual\.length >= 3 \? atual/.test(card),
    "a tela impede escolher mais de 3 meses");
  ok(/Faltam \{3 - sel\.length\}/.test(card),
    "e diz quantos faltam — botão desabilitado sem motivo foi o defeito de 03/10");
  ok(/completo \|\| !mudou/.test(card.replace(/\s+/g, " ")) || /!completo \|\| !mudou/.test(card),
    "e o botão só liga com os 3 escolhidos E alguma mudança");

  // E DIZ O QUE A ESCOLHA SIGNIFICA — três nomes numa lista não deixam claro que o
  // circuito FICA PARADO nos outros meses.
  ok(/fica <strong[^>]*>parado/.test(card),
    "o card avisa que o circuito fica PARADO nos meses de fora");
  ok(/atravessa o ano/.test(card),
    "e avisa quando a temporada atravessa o ano — é o caso em que o ano vira sozinho no motor");
  ok(/Voltar ao automático/.test(card),
    "e dá como desfazer: voltar ao automático");
}

secao("Nas tabelas com grant por coluna, nada pede TODAS as colunas");
{
  // ISTO DERRUBOU A PRODUÇÃO em 03/10/2026, 20:55, e o aviso existia desde 29/09.
  //
  // O `db.getConfig()` lia `circuitos?id=eq.X` SEM lista de colunas. Sem `select`, o
  // PostgREST pede TODAS; o `anon` tem grant POR COLUNA em `circuitos`; coluna nova
  // nasce SEM grant; e o PostgREST recusa a leitura INTEIRA quando falta uma. Bastou
  // eu acrescentar `meses_temporada` para o app responder, em toda tela,
  // "permission denied for table circuitos" (42501).
  //
  // O Supervisor do Admin apontou exatamente isso — "o último `select *` na tabela da
  // armadilha nº 1" — e eu classifiquei como "endurecimento, não defeito" porque não
  // consegui demonstrar a quebra. Demonstrei quatro dias depois, sozinho, em produção.
  // A lição não é sobre colunas: é que "não consegui demonstrar" não é o mesmo que
  // "não quebra", e eu tratei como se fosse.
  //
  // ⚠️ POR QUE SÓ ESTAS QUATRO TABELAS, e não todas. Medido no banco em 03/10:
  //    grant POR COLUNA (a armadilha é viva):
  //        circuitos · atletas · circuito_atletas · solicitacoes_wo
  //    grant de TABELA (coluna nova já nasce coberta, sem risco):
  //        partidas · chaves · configuracao · mensagens_enviadas · partidas_historico
  // Exigir `select` nas nove seria pedir mudança em código que não corre risco — e
  // asserção que cobra o que não importa é asserção que alguém desliga. Se um dia
  // alguma das cinco virar grant por coluna, ela entra NESTA lista, e esta frase é o
  // lembrete de por quê.
  const COM_GRANT_POR_COLUNA = ["circuitos", "atletas", "circuito_atletas", "solicitacoes_wo"];

  const { readFileSync } = await import("node:fs");
  const fonteApp = semComentarios(readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8"));

  const chamadas = [...fonteApp.matchAll(/supaFetch\(\s*[`"']([a-z_]+)\??([^`"']*)[`"']([^\n]*)/g)];
  ok(chamadas.length >= 10, `o app tem leituras diretas ao PostgREST (${chamadas.length})`);

  const emRisco = chamadas.filter((m) => {
    const [, tabela, query, resto] = m;
    if (!COM_GRANT_POR_COLUNA.includes(tabela)) return false;
    if (/\bselect=/.test(query)) return false;        // nomeia as colunas: seguro
    if (/return=minimal/.test(resto)) return false;    // não devolve linha: seguro
    return true;                                       // pede a linha inteira: QUEBRA
  });
  igual(emRisco.length, 0,
    `nenhuma chamada a tabela com grant por coluna pede a linha INTEIRA${emRisco.length ? " (em risco: " + emRisco.map(m => m[1] + "?" + m[2].slice(0, 36)).join(" | ") + ")" : ""}`);

  // E `select=*` é a mesma armadilha com outra roupa: pede tudo sem nomear.
  const comEstrela = chamadas.filter((m) => COM_GRANT_POR_COLUNA.includes(m[1]) && /\bselect=\*/.test(m[2]));
  igual(comEstrela.length, 0,
    "e nenhuma usa `select=*` nessas tabelas — o asterisco tem o mesmo efeito do `select` ausente");

  // A leitura que quebrou, especificamente, tem de pedir o que o app usa.
  const iCfg = fonteApp.indexOf("getConfig: () =>");
  const cfg = fonteApp.slice(iCfg, fonteApp.indexOf("\n", iCfg));
  for (const col of ["fase", "sistema", "pareamento", "regulamento_versao", "max_atletas",
                     "financeiro_ativo", "proxima_aberta", "publico", "meses_temporada"]) {
    ok(cfg.includes(col), `a leitura de configuração pede \`${col}\``);
  }
}

secao("Cada circuito define os três meses em que roda");
{
  // DECISÃO DO JULIANO, 03/10/2026. Até aqui os três meses eram SEMPRE CONSECUTIVOS:
  // o motor fazia "mês da rodada 1 + índice do par" e não havia onde dizer outra coisa.
  //
  // E o vB-01 já prometia o contrário — "os meses de recesso são definidos pelo
  // organizador do circuito" — numa promessa que não tinha campo nenhum no banco. O
  // texto que o atleta aceita dizia que o organizador define, e não havia onde definir.
  //
  // O BH é diferente e continua: o v03-13, Cap. 13, CRAVA janeiro, julho e dezembro
  // como férias, e é texto com aceite. Por isso NULL mantém o comportamento antigo.
  const CIRC_M = "eeeeeeee-9999-4999-8999-eeeeeeeeeeee";
  const A1 = "eeeeeeee-0000-4000-8000-000000009001";
  const A2 = "eeeeeeee-0000-4000-8000-000000009002";

  const cenarioMeses = async (meses) => montarMotor({
    circuitos: [
      circuito(BH),
      circuito(CIRC_M, { slug: "meses", sistema: "B", pareamento: "sorteio",
        regulamento_versao: "vB-01", fase: "temporada",
        ...(meses === undefined ? {} : { meses_temporada: meses }) }),
    ],
    atletas: [atleta(A1), atleta(A2)],
    circuito_atletas: [
      { circuito_id: CIRC_M, atleta_id: A1, status: "ativo", pendente_circuito: false },
      { circuito_id: CIRC_M, atleta_id: A2, status: "ativo", pendente_circuito: false },
    ],
    chaves: [{ id: "chave1", nome: "Chave A", rodada_atual: 2, circuito_id: CIRC_M }],
    // Rodada 1 com prazo em MARÇO: é a âncora de onde o motor caminha.
    partidas: [
      partida("j1", { circuito_id: CIRC_M, rodada: 1, atleta1_id: A1, atleta2_id: A2,
                      placar1: 3, placar2: 1, validado: true, calculado: true, prazo: "2026-03-15" }),
      partida("j2", { circuito_id: CIRC_M, rodada: 2, atleta1_id: A2, atleta2_id: A1,
                      placar1: 3, placar2: 0, validado: true, calculado: true, prazo: "2026-03-27" }),
    ],
  });
  const mesDaRodada = (banco, r) => {
    const p = banco.tabelas.partidas.find(x => x.circuito_id === CIRC_M && x.rodada === r && x.prazo);
    return p ? p.prazo.slice(0, 7) : null; // "AAAA-MM"
  };

  // 1. SEM meses definidos: o comportamento antigo, três consecutivos. É o do BH.
  {
    const { banco, motor } = await cenarioMeses(undefined);
    const r = await comoAdmin(motor, "AVANCAR_RODADA", { circuitoId: CIRC_M });
    ok(r.corpo?.sucesso === true, `avança a rodada (erro: ${JSON.stringify(r.corpo?.erro)})`);
    igual(mesDaRodada(banco, 3), "2026-04",
      "sem meses definidos, o 2º par cai no mês SEGUINTE — o comportamento antigo, que é o do BH e não muda");
  }

  // 2. COM meses definidos e um buraco: março, MAIO, agosto (pula abril e junho/julho).
  {
    const { banco, motor } = await cenarioMeses([3, 5, 8]);
    await comoAdmin(motor, "AVANCAR_RODADA", { circuitoId: CIRC_M });
    igual(mesDaRodada(banco, 3), "2026-05",
      "com os meses definidos, o 2º par vai para MAIO — pulando abril, que é o ponto da regra");
  }

  // 3. O TERCEIRO par também, e o buraco maior.
  {
    const { banco, motor } = await cenarioMeses([3, 5, 8]);
    await comoAdmin(motor, "AVANCAR_RODADA", { circuitoId: CIRC_M });
    banco.tabelas.chaves[0].rodada_atual = 4;
    await comoAdmin(motor, "AVANCAR_RODADA", { circuitoId: CIRC_M });
    igual(mesDaRodada(banco, 5), "2026-08",
      "e o 3º par vai para AGOSTO — a lista manda, não a aritmética de +1 mês");
  }

  // 4. O ANO VIRA SOZINHO. Começa em novembro, segue em fevereiro e abril.
  {
    const { banco, motor } = await montarMotor({
      circuitos: [circuito(BH), circuito(CIRC_M, { slug: "meses", sistema: "B",
        pareamento: "sorteio", regulamento_versao: "vB-01", fase: "temporada",
        meses_temporada: [11, 2, 4] })],
      atletas: [atleta(A1), atleta(A2)],
      circuito_atletas: [
        { circuito_id: CIRC_M, atleta_id: A1, status: "ativo", pendente_circuito: false },
        { circuito_id: CIRC_M, atleta_id: A2, status: "ativo", pendente_circuito: false },
      ],
      chaves: [{ id: "chave1", nome: "Chave A", rodada_atual: 2, circuito_id: CIRC_M }],
      partidas: [
        partida("j1", { circuito_id: CIRC_M, rodada: 1, atleta1_id: A1, atleta2_id: A2,
                        placar1: 3, placar2: 1, validado: true, calculado: true, prazo: "2026-11-15" }),
        partida("j2", { circuito_id: CIRC_M, rodada: 2, atleta1_id: A2, atleta2_id: A1,
                        placar1: 3, placar2: 0, validado: true, calculado: true, prazo: "2026-11-27" }),
      ],
    });
    await comoAdmin(motor, "AVANCAR_RODADA", { circuitoId: CIRC_M });
    igual(mesDaRodada(banco, 3), "2027-02",
      "de novembro para fevereiro o ANO VIRA sozinho — sem isso o prazo cairia num fevereiro que já passou");
  }

  // 5. A CONFIGURAÇÃO RECUSA O QUE ESTÁ ERRADO, dizendo o quê.
  //    Gravar um valor "quase certo" deslocaria o prazo de uma rodada inteira para
  //    atletas reais, e o organizador não teria como saber de onde veio.
  for (const [valor, pedaco, oque] of [
    [[3, 5], "exatamente 3 meses", "só dois meses"],
    [[3, 5, 13], "Mês inválido", "mês 13"],
    [[3, 5, 5], "diferentes entre si", "mês repetido"],
  ]) {
    const { motor } = await cenarioMeses(undefined);
    const r = await comoAdmin(motor, "DEFINIR_CONFIG_CIRCUITO", { circuitoId: CIRC_M, mesesTemporada: valor });
    igual(r.status, 400, `a configuração RECUSA ${oque}`);
    ok(String(r.corpo?.erro || "").includes(pedaco),
      `e diz o motivo (${oque}) — recusa sem motivo é o defeito que esta onda mais encontrou`);
  }

  // 6. E aceita o certo, e aceita voltar ao automático.
  {
    const { banco, motor } = await cenarioMeses(undefined);
    const r = await comoAdmin(motor, "DEFINIR_CONFIG_CIRCUITO", { circuitoId: CIRC_M, mesesTemporada: [3, 5, 8] });
    ok(r.corpo?.sucesso === true, `a configuração aceita três meses válidos (erro: ${JSON.stringify(r.corpo?.erro)})`);
    igual(banco.acha("circuitos", c => c.id === CIRC_M)?.meses_temporada?.join(","), "3,5,8",
      "e grava na ordem das etapas");
    await comoAdmin(motor, "DEFINIR_CONFIG_CIRCUITO", { circuitoId: CIRC_M, mesesTemporada: null });
    igual(banco.acha("circuitos", c => c.id === CIRC_M)?.meses_temporada, null,
      "e `null` devolve ao automático — o organizador pode desfazer a escolha");
  }
}

secao("Painel: dois cards não podem se contradizer na mesma tela");
{
  // ACHADO EM USO pelo Juliano, 03/10/2026, por um print: o Painel mostrava
  //   "🧮 Rodada 6 validada, mas ainda não processada → Ir para Pendências"
  // e, logo abaixo,
  //   "Temporada completa (6 rodadas). Para continuar, inicie uma nova temporada."
  // Dois cards se contradizendo, e o primeiro mandando-o a uma página sem nada.
  //
  // A causa: a condição era `!hasNextRound`, e `hasNextRound = todasResolvidas &&
  // !temporadaCompleta`. Então `!hasNextRound` é verdadeiro por DOIS motivos — falta
  // processar algo, OU a temporada acabou. O card existe só para o primeiro.
  //
  // Conferido no banco: 34 partidas, 27 calculadas, 7 rejeitadas, ZERO validadas sem
  // processar. Não havia nada pendente, e o card afirmava que havia.
  //
  // SEGUNDO defeito achado por USO em dois dias, depois de oito duplas de auditoria.
  const { readFileSync } = await import("node:fs");
  const fonteApp = semComentarios(readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8"));

  const iCard = fonteApp.indexOf("validada, mas ainda não processada");
  ok(iCard > 0, "o card de rodada não processada foi localizado");
  const condicao = fonteApp.slice(Math.max(0, iCard - 320), iCard);
  ok(/!todasResolvidas/.test(condicao),
    "o card exige que REALMENTE falte processar algo — `!hasNextRound` sozinho também é verdadeiro quando a temporada acabou");
  ok(/allCurrentValidated/.test(condicao),
    "e continua exigindo que a rodada atual esteja toda validada");

  // A frase de dentro só pode afirmar o que a condição garante.
  const corpo = fonteApp.slice(iCard, iCard + 700);
  ok(/Alguma partida de uma rodada anterior ainda não foi processada/.test(corpo),
    "a frase de recurso continua lá");
  ok(/calculoPendente\.length > 0/.test(corpo),
    "e a outra frase, com o número, também — as duas são verdadeiras sob `!todasResolvidas`");

  // E o card de temporada completa não pode depender da mesma condição, senão os
  // dois voltam a aparecer juntos.
  const iCompleta = fonteApp.indexOf("Temporada completa");
  ok(iCompleta > 0, "o card de temporada completa existe");
  ok(iCompleta !== iCard,
    "e é um card distinto — é ele que deve aparecer quando as 6 rodadas acabaram, sozinho");
}

secao("Criar circuito: o botão desabilitado DIZ o que falta");
{
  // ACHADO EM USO REAL, 03/10/2026, pelo Juliano: ele foi criar o 2º circuito do
  // Sistema B, escolheu sistema e pareamento, e o botão continuou morto. O relato
  // dele — "escolhi os parâmetros e não deixa avançar" — era a leitura CORRETA do
  // que a tela mostrava: `podeCriar` exige TAMBÉM nome e slug com 2+ caracteres, e
  // nada na tela dizia isso.
  //
  // É a mesma família que esta onda inteira perseguiu — a tela sabendo algo e não
  // falando — só que pelo SILÊNCIO em vez da frase errada. Botão desabilitado é uma
  // recusa, e recusa sem motivo é a pior forma de recusa. E foi encontrado por USO,
  // não pela auditoria: oito duplas de guardião e supervisor passaram por esta tela
  // e nenhuma tentou criar um circuito com o slug vazio.
  const { readFileSync } = await import("node:fs");
  const fonteApp = semComentarios(readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8"));
  const motorSrc = semComentarios(readFileSync(new URL("../supabase/functions/admin-action/index.ts", import.meta.url), "utf8"));

  // A LISTA É DERIVADA DA MESMA CONDIÇÃO DO BOTÃO, não escrita à mão.
  ok(/const faltando = \[\];/.test(fonteApp),
    "a tela monta a lista do que falta");
  ok(/const podeCriar = faltando\.length === 0;/.test(fonteApp),
    "e o BOTÃO usa essa mesma lista — se alguém acrescentar exigência e esquecer a lista, o botão não morre em silêncio: ele passa a deixar criar");
  ok(/Para criar, falta /.test(fonteApp),
    "e a tela mostra a frase com o que falta");
  ok(/\{!podeCriar && \(/.test(fonteApp),
    "renderizada exatamente quando o botão está desabilitado — não é texto morto");

  // CADA EXIGÊNCIA DO MOTOR TEM DE TER UMA LINHA NA LISTA. É isto que impede o
  // silêncio de voltar: o motor recusa quatro coisas, e a tela nomeia as quatro.
  const iFalt = fonteApp.indexOf("const faltando = [];");
  const bloco = fonteApp.slice(iFalt, fonteApp.indexOf("const podeCriar", iFalt));
  for (const [cond, oque] of [
    ["nome.trim()", "o nome"],
    ["slugLimpo.length < 2", "o slug curto ou vazio"],
    ['slugLimpo === "bh"', "o slug reservado"],
    ["!sistema", "o sistema"],
    ['sistema === "B" && !pareamento', "o pareamento no Sistema B"],
  ]) {
    ok(bloco.includes(cond), `a lista cobre ${oque}`);
  }

  // E as cinco do motor são exatamente estas — a tela não pode nomear menos do que o
  // servidor recusa, senão o botão volta a morrer por um motivo que ninguém lê.
  const iAcao = motorSrc.indexOf('case "CRIAR_CIRCUITO"');
  const acao = motorSrc.slice(iAcao, motorSrc.indexOf("\n      case ", iAcao + 10));
  for (const [re, oque] of [
    [/Nome do circuito é obrigatório/, "nome"],
    [/Slug inválido/, "slug curto"],
    [/reservado ao circuito de Belo Horizonte/, "slug bh"],
    [/Escolha o sistema do circuito/, "sistema"],
    [/escolha o método de pareamento/, "pareamento no B"],
  ]) {
    ok(re.test(acao), `o motor recusa por ${oque} (a tela tem de nomear o mesmo)`);
  }

  // A SELEÇÃO FICOU INEQUÍVOCA: era só uma borda trocando de cor.
  ok(/const marcaSel = /.test(fonteApp),
    "as opções ganharam marca de selecionado, não só borda");
  const marcas = (fonteApp.match(/\{marcaSel\(/g) || []).length;
  igual(marcas, 2,
    "nos DOIS seletores — sistema e pareamento; um só marcado deixaria o outro com o problema original");
}

secao("Os números citados existem no arquivo de prova");
{
  // O DEFEITO Nº 1 DESTE PROJETO — "não cite de memória, rode e leia" — tinha
  // acontecido DENTRO do número que existia para combatê-lo. O motor citava
  // `93/1500 (6,2%)`, nenhum arquivo continha esse valor, e a única execução
  // preservada dizia 83/1500 (5,5%) terminando em `FATAL ERROR: heap out of memory`.
  // Três lugares — motor, tela e documento de governança — citando um valor
  // irreproduzível. Achado do Supervisor de Regulamento.
  //
  // Esta seção fecha a porta: todo número citado tem de aparecer no ARQUIVO DE PROVA.
  // Se alguém editar o comentário sem re-medir, ou re-medir sem atualizar o
  // comentário, a bateria acusa. É o único jeito de o número não apodrecer de novo.
  const { readFileSync } = await import("node:fs");
  const prova = readFileSync(new URL("../docs/medicoes/2026-10-01-repeticao-grupos.txt", import.meta.url), "utf8");
  const motorSrc = semComentarios(
    readFileSync(new URL("../supabase/functions/admin-action/index.ts", import.meta.url), "utf8"),
  );
  const motorBruto = readFileSync(new URL("../supabase/functions/admin-action/index.ts", import.meta.url), "utf8");
  const readme = readFileSync(new URL("./README.md", import.meta.url), "utf8");

  // A prova existe e tem as seis células — leitura vazia é falha de medição.
  const celulas = (prova.match(/atletas \/ /g) || []).length;
  igual(celulas, 6, "o arquivo de prova tem as SEIS células medidas");
  ok(/Semente fixa/.test(prova), "e declara que a semente é fixa, ou seja reproduzível");

  // Cada número citado no motor tem de estar na prova. O motor é lido BRUTO aqui de
  // propósito: os números vivem em COMENTÁRIO, e é justamente o comentário que mente.
  for (const n of ["276/3000", "76/1500", "6.100"]) {
    ok(motorBruto.includes(n), `o motor cita \`${n}\``);
  }
  for (const n of ["276/3000", "76/1500"]) {
    ok(prova.includes(n), `e \`${n}\` ESTÁ no arquivo de prova`);
  }
  // ⚠️ A PRIMEIRA VERSÃO DISTO ERA `ok(!motorBruto.includes("93/1500"))` — e ficou
  // VERMELHA acusando a minha PRÓPRIA EXPLICAÇÃO, que precisa nomear o valor errado
  // para contar o que foi corrigido. Quinta vez nesta sessão que a documentação
  // dispara a asserção. Apagar a explicação para deixar verde seria o pior desfecho
  // possível: é ela que impede o número de apodrecer de novo.
  //
  // A asserção certa não pergunta "o texto errado desapareceu?", e sim "TODO número
  // que o motor APRESENTA COMO RESULTADO está na prova?". Os resultados vivem nas
  // linhas da tabela (`... .... N/M (X%)`); o valor antigo só aparece no parágrafo
  // que explica a correção, e lá ele deve ficar.
  const linhasTabela = [...motorBruto.matchAll(/elenco estavel, [^.]*\.+ (\d+\/\d+) \(([\d,]+)%\)/g)];
  igual(linhasTabela.length, 2, "o motor apresenta DUAS taxas como resultado");
  for (const m of linhasTabela) {
    ok(prova.includes(m[1]),
      `a taxa \`${m[1]}\` que o motor apresenta ESTÁ no arquivo de prova — era isto que faltava: o 93/1500 não estava em prova nenhuma`);
  }
  // E o valor antigo, quando aparece, tem de estar marcado como corrigido — nunca
  // solto como se ainda valesse.
  const iAntigo = motorBruto.indexOf("93/1500");
  ok(iAntigo > 0, "a explicação nomeia o valor antigo (é o que torna a correção auditável)");
  ok(/CORRIGIDOS|corrigid/i.test(motorBruto.slice(Math.max(0, iAntigo - 700), iAntigo + 300)),
    "e o nomeia dentro do parágrafo que o declara CORRIGIDO — não solto, como se ainda valesse");

  // A metade da decisão que nunca foi executada: o número no testes/README.md.
  ok(/9,2 %/.test(readme) && /5,1 %/.test(readme),
    "o `testes/README.md` traz as duas taxas — era a metade da decisão de 29/09 que ninguém executou");
  ok(/2026-10-01-repeticao-grupos\.txt/.test(readme),
    "e aponta o arquivo de prova ao lado do número");

  // "invariante" era erro de categoria: o teto é limite MEDIDO, sem mecanismo provado.
  ok(!/teto, invariante|TETO, invariante/.test(motorBruto),
    "o motor não chama o teto de «invariante» — invariante se prova por mecanismo, e não há argumento de por que o guloso não pode repetir duas vezes");
  ok(/limite MEDIDO|LIMITE MEDIDO/.test(motorBruto),
    "e diz o que ele é: limite medido");
  void motorSrc;
}

secao("Dinheiro — o estorno não derruba o pagamento da temporada errada");
{
  // DOIS DEFEITOS COM A MESMA RAIZ, achados pelo Supervisor do Admin: o flag
  // `pagamento_confirmado` / `pagamento_proxima_confirmado` não sabe A QUE TEMPORADA
  // pertence. Só o `temporada_rotulo` do PAGAMENTO sabe.
  //
  //  · o estorno decidia por `pag.temporada_rotulo === cfg.proxima_rotulo`, e tudo que
  //    não casasse caía no `else` derrubando `pagamento_confirmado`. O
  //    `CANCELAR_PROXIMA` ZERA `proxima_rotulo` — depois dele NADA casa, então estornar
  //    um pagamento da PRÓXIMA derrubava o da temporada EM CURSO. Com financeiro
  //    ligado, isso BLOQUEIA a inclusão de quem pagou;
  //  · e `CANCELAR_PROXIMA` deixava `pagamento_proxima_confirmado: true` preso, para
  //    uma temporada que deixou de existir — na pré-abertura seguinte, esses atletas
  //    apareciam como já pagos sem ter pago nada dela.
  //
  // É a primeira seção de DINHEIRO comportamental da bateria: antes só havia o teste
  // de permissão de `REGISTRAR_PAGAMENTO`, que confere quem pode chamar, não o efeito.
  const CIRC_M = "dddddddd-1111-4111-8111-dddddddddddd";
  const A1 = "dddddddd-0000-4000-8000-00000000000a";

  const cenarioDinheiro = async ({ proximaAberta = true } = {}) => montarMotor({
    circuitos: [
      circuito(BH),
      circuito(CIRC_M, { slug: "dinheiro", sistema: "B", regulamento_versao: "vB-01",
        financeiro_ativo: true, temporada_numero: 1, temporada_ano: 2026,
        proxima_aberta: proximaAberta,
        proxima_rotulo: proximaAberta ? "2/2026" : null,
        proxima_nome: proximaAberta ? "Temporada 2" : null }),
    ],
    atletas: [atleta(A1, { nome: "Pagador" })],
    circuito_atletas: [{ id: "ca-m", circuito_id: CIRC_M, atleta_id: A1, status: "ativo",
      pendente_circuito: false, pagamento_confirmado: true, pagamento_proxima_confirmado: true }],
    partidas: [],
    outras: { pagamentos: [
      { id: "pg-atual",   circuito_id: CIRC_M, atleta_id: A1, temporada_rotulo: "1/2026", status: "confirmado", valor: 10000 },
      { id: "pg-proxima", circuito_id: CIRC_M, atleta_id: A1, temporada_rotulo: "2/2026", status: "confirmado", valor: 10000 },
      { id: "pg-velho",   circuito_id: CIRC_M, atleta_id: A1, temporada_rotulo: "3/2025", status: "confirmado", valor: 10000 },
    ] },
  });
  const flags = (banco) => banco.acha("circuito_atletas", c => c.atleta_id === A1 && c.circuito_id === CIRC_M);

  // 1. O CAMINHO NORMAL continua certo: estornar o da próxima mexe no flag da próxima.
  {
    const { banco, motor } = await cenarioDinheiro();
    const r = await comoAdmin(motor, "ESTORNAR_PAGAMENTO", { circuitoId: CIRC_M, id: "pg-proxima" });
    ok(r.corpo?.sucesso === true, `o estorno da próxima funciona (erro: ${JSON.stringify(r.corpo?.erro)})`);
    igual(r.corpo?.dados?.flagTocada, "proxima", "e a resposta DIZ qual flag mexeu");
    igual(flags(banco)?.pagamento_proxima_confirmado, false, "o flag da próxima cai");
    igual(flags(banco)?.pagamento_confirmado, true, "e o da temporada EM CURSO fica intacto");
  }

  // 2. O DEFEITO: pré-abertura cancelada e depois estorno da próxima.
  {
    const { banco, motor } = await cenarioDinheiro();
    await comoAdmin(motor, "CANCELAR_PROXIMA", { circuitoId: CIRC_M });
    const r = await comoAdmin(motor, "ESTORNAR_PAGAMENTO", { circuitoId: CIRC_M, id: "pg-proxima" });
    ok(r.corpo?.sucesso === true, "o estorno roda mesmo depois de a pré-abertura ser cancelada");
    igual(flags(banco)?.pagamento_confirmado, true,
      "e NÃO derruba o pagamento da temporada em curso — era o defeito: o atleta virava inadimplente numa temporada que pagou");
    igual(r.corpo?.dados?.flagTocada, null,
      "e a resposta diz que NENHUM flag foi tocado, em vez de deixar o organizador achar que mexeu no certo");
  }

  // 3. O TERCEIRO CASO, que ninguém tinha nomeado: estornar temporada JÁ ENCERRADA.
  {
    const { banco, motor } = await cenarioDinheiro();
    const r = await comoAdmin(motor, "ESTORNAR_PAGAMENTO", { circuitoId: CIRC_M, id: "pg-velho" });
    ok(r.corpo?.sucesso === true, "estornar pagamento de temporada encerrada roda");
    igual(flags(banco)?.pagamento_confirmado, true,
      "e não derruba a atual — caía no mesmo `else` e tinha o mesmo efeito");
    igual(flags(banco)?.pagamento_proxima_confirmado, true, "nem a da próxima");
    igual(banco.acha("pagamentos", x => x.id === "pg-velho")?.status, "estornado",
      "mas o estorno FICA registrado — a devolução aconteceu, só não mexe em temporada viva");
  }

  // 4. CANCELAR A PRÉ-ABERTURA limpa o flag que ficava preso.
  {
    const { banco, motor } = await cenarioDinheiro();
    const r = await comoAdmin(motor, "CANCELAR_PROXIMA", { circuitoId: CIRC_M });
    igual(flags(banco)?.pagamento_proxima_confirmado, false,
      "cancelar a pré-abertura zera `pagamento_proxima_confirmado` — ele ficava preso para uma temporada que deixou de existir");
    igual(flags(banco)?.pagamento_confirmado, true, "e não encosta no da temporada em curso");
    igual(r.corpo?.dados?.pagamentosProximaLimpos, 1,
      "e a resposta DIZ quantos flags caíram — é dinheiro, e o organizador tem devoluções para resolver");
    igual(banco.acha("pagamentos", x => x.id === "pg-proxima")?.status, "confirmado",
      "o PAGAMENTO continua registrado: a pessoa pagou de verdade, o que se desfez foi a afirmação «está em dia com a próxima»");
  }
}

secao("As três telas que paravam de falar com o atleta");
{
  // Três consertos do bloco 2 que eu fiz SEM ASSERÇÃO, e a mutação me pegou: sabotar
  // o prazo de renovação deixou a bateria VERDE. Disciplina da casa é todo conserto
  // nascer com asserção; estes três nasceram sem, e esta seção é a dívida paga.
  const { readFileSync } = await import("node:fs");
  const fonteApp = semComentarios(readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8"));

  // ── 1. O LOGOUT DEIXA DE SER SILENCIOSO ──────────────────────────────────
  // A carga do circuito encerra a sessão quando o atleta não está mais no roster, e
  // fazia isso sem mensagem nem log. Todos os caminhos que chegam lá são legítimos
  // (organizador removeu, temporada virou, circuito de que não é membro), e o atleta
  // caía na tela de login sem uma palavra.
  ok(/ctm_aviso_saida/.test(fonteApp),
    "o logout por ausência no roster grava um aviso para a tela de login");
  ok(/localStorage\.setItem\("ctm_aviso_saida"/.test(fonteApp),
    "e no localStorage, que é o único lugar onde o aviso sobrevive à remontagem do app");
  ok(/localStorage\.removeItem\("ctm_aviso_saida"\)/.test(fonteApp),
    "e a tela de login o APAGA depois de ler — ninguém merece ver duas vezes");
  ok(/3600_000|3600000/.test(fonteApp),
    "com validade de uma hora: aviso velho não explica nada e só assusta");
  ok(/Você saiu do circuito/.test(fonteApp),
    "e a tela de entrada mostra o aviso com título próprio");
  const iSai = fonteApp.indexOf('localStorage.setItem("ctm_aviso_saida"');
  const janelaSai = fonteApp.slice(Math.max(0, iSai - 500), iSai);
  ok(/console\.warn\(/.test(fonteApp.slice(iSai, iSai + 900)),
    "e deixa rastro no console — o aviso é para o atleta, o log é para quem for investigar");

  // ── 2. O CARD DE FILA CONTA AS VAGAS EM VEZ DE AFIRMAR LOTAÇÃO ───────────
  // `pendente_circuito: true` é gravado em TODA aprovação, lotação ou não. Quem
  // entrou com 12 de 20 vagas lia "todas as vagas ocupadas" — e a mensagem de
  // WhatsApp era mais precisa que o app.
  const iFilaC = fonteApp.indexOf("function FilaDeEsperaCard(");
  ok(iFilaC > 0, "o card de fila foi localizado");
  const filaC = fonteApp.slice(iFilaC, fonteApp.indexOf("\nfunction ", iFilaC + 10));
  // ⚠️ ESTAS DUAS ASSERÇÕES ERAM `/const dentro = /` e `/{lotado/` — procuravam o
  // NOME da variável, não a conta. A mutação "troca a conta por `const dentro = 0;
  // const lotado = true;`" passou VERDE, porque o nome continuava lá. Agora prendem a
  // EXPRESSÃO: trocar a conta por um valor fixo quebra. É a mesma lição do `select=*`
  // e do comentário — asserção que olha para o procurador da regra não protege a regra.
  ok(/const dentro = \(state\.athletes \|\| \[\]\)\.filter\(a => a\.status === "ativo" && !a\.pendenteCircuito\)\.length;/.test(filaC),
    "o card CONTA quem está dentro filtrando o roster de verdade — não um número fixo");
  ok(/const lotado = dentro >= \(state\.maxAtletas \|\| 20\);/.test(filaC),
    "e compara a conta com o teto do circuito, também de verdade");
  ok(/\{lotado\n|\{lotado$|\{lotado\s/m.test(filaC),
    "e decide a frase pelo resultado dessa comparação");
  ok(/falta o organizador te/.test(filaC),
    "quando NÃO está lotado, diz a verdade: falta o organizador incluir");
  ok(/todas as \{state\.maxAtletas\} vagas ocupadas/.test(filaC),
    "e quando está lotado, diz o número — não uma afirmação vaga");

  // ── 3. O PRAZO DE RENOVAÇÃO APARECE PARA O ATLETA ────────────────────────
  // `janelaRenovacao` era chamada em três lugares — as duas mensagens de WhatsApp e o
  // painel do admin — e em NENHUM na tela dele. A mensagem mandava "abrir o app para
  // garantir a vaga" e o app não mostrava até quando. Os 7 dias de prioridade são do
  // Cap. 13, texto que ele assinou.
  const iRen = fonteApp.indexOf("function RenovacaoCard(");
  ok(iRen > 0, "o card de renovação foi localizado");
  const ren = fonteApp.slice(iRen, fonteApp.indexOf("\nfunction ", iRen + 10));
  ok(/janelaRenovacao\(dataIni\)/.test(ren),
    "o card do ATLETA calcula a janela de renovação — era a única das quatro telas que não calculava");
  ok(/jan\.fechaTxt/.test(ren),
    "e mostra a DATA do prazo, que é o que a mensagem de WhatsApp manda ele vir ver");
  ok(/jan\.abreTxt/.test(ren),
    "e a data em que a prioridade abre, para quem olha antes");
  ok(/jan\.aberta/.test(ren) && /jan\.encerrada/.test(ren) && /jan\.jaAbriu/.test(ren),
    "com os três estados distintos: ainda não abriu, aberta, encerrada");
  ok(/diasAteFechar/.test(ren),
    "e a contagem de dias quando o prazo está perto");
  // A conta é UMA: três contas separadas foi o que permitiu a divergência de 27/09.
  const chamadas = (fonteApp.match(/janelaRenovacao\(/g) || []).length - 1; // −1: a definição
  ok(chamadas >= 4,
    `as quatro telas usam a MESMA função (${chamadas} chamadas) — três contas separadas foi o que deixou o app se contradizer em 27/09`);
}

secao("O instrumento se confere — os quatro caminhos de gravação projetam colunas");
{
  // POR QUE O INSTRUMENTO PRECISA DAS PRÓPRIAS ASSERÇÕES.
  //
  // O banco falso deixou de ser um detalhe de teste e virou peça da segurança: é ele
  // que decide se "o porteiro não devolve `telefone`" é uma afirmação medida ou um
  // verde vazio. Nesta onda ele falhou nessa função TRÊS vezes — apelido e embed
  // aninhado (consertados em 29/09, agora LANÇAM erro) e `upsert` (01/10) — e das
  // três a do `upsert` era a pior: o `mirrorSazonal` do motor grava por upsert, e foi
  // por esse caminho que o ataque do W.O. fabricava vínculo em circuito alheio. O
  // portão à prova de falha ficava cego no lugar exato do vazamento conhecido.
  //
  // ⚠️ CALIBRAGEM HONESTA: hoje NENHUM lugar do motor faz `upsert(...).select(...)`
  // (medido: zero encadeamentos nas 9 funções). Então a entrada do `projetar` no
  // upsert é ENDURECIMENTO, não fechamento de buraco vivo — ela não muda
  // comportamento nenhum agora. O valor dela é este: no dia em que alguém escrever o
  // primeiro `upsert().select()`, o portão já está lá. Sem estas asserções essa
  // proteção seria invisível e indistinguível de código morto.
  const comUpsert = () => criarBancoFalso({ circuito_atletas: [] });

  {
    const banco = comUpsert();
    const r = await banco.cliente.from("circuito_atletas")
      .upsert({ circuito_id: "C1", atleta_id: "A1", saldo_temp: 3, telefone: "31999998888" },
              { onConflict: "circuito_id,atleta_id" })
      .select("circuito_id,atleta_id,saldo_temp");
    const item = r.data?.[0] || {};
    ok("saldo_temp" in item, "o upsert com select devolve a coluna pedida");
    ok(!("telefone" in item),
      "e NÃO devolve a coluna que o select não pediu — era o 4º caminho de gravação, o único que entregava a linha inteira");
  }

  {
    // E o portão fail-closed vale no upsert também: forma não modelada LANÇA, em vez
    // de devolver algo plausível. Foi a solução que o Guardião de Segurança propôs e
    // que eu aceitei em lugar da minha.
    const banco = comUpsert();
    const r = await provocandoViolacao(() => banco.cliente.from("circuito_atletas")
      .upsert({ circuito_id: "C1", atleta_id: "A1" }, { onConflict: "circuito_id,atleta_id" })
      .select("ca:circuito_atletas!inner(id,nome)"));
    ok(/APELIDO|nao e modelad/i.test(r.mensagens.join(" ")),
      "forma de select que o instrumento não modela DISPARA o portão, inclusive no upsert — não devolve valor plausível");
    ok(r.erro && r.erro.instrumento === true,
      "e lança um erro marcado como `instrumento`, para ninguém confundir com erro do motor");
  }

  {
    // A VÁLVULA TEM O PORTÃO DELA. `provocandoViolacao` remove do registro as
    // violações que ela mesma causou — e isso seria um jeito de silenciar violações
    // de verdade se ela aceitasse "nenhuma violação" como resultado válido. Ela
    // FALHA nesse caso, e esta asserção é o que garante que continue falhando.
    let recusou = false;
    try { await provocandoViolacao(() => Promise.resolve("nada de errado aqui")); }
    catch (e) { recusou = /NAO disparou/.test(String(e.message)); }
    ok(recusou,
      "a válvula que testa o portão FALHA quando o portão não dispara — ela afirma que a proteção funciona, não silencia violação");
  }

  {
    // COMPLETUDE: os quatro caminhos que devolvem linha passam pelo `projetar`. Se
    // alguém acrescentar um quinto e esquecer, esta asserção fica vermelha — foi
    // assim que o upsert ficou de fora por meses.
    const fonteBanco = readFileSync(new URL("./banco-falso.mjs", import.meta.url), "utf8");
    const devolucoes = [...fonteBanco.matchAll(/this\.devolverLinhas \? [^:]+ : null/g)];
    ok(devolucoes.length >= 4, `há ${devolucoes.length} caminhos que devolvem linha gravada`);
    const semProjetar = devolucoes.filter((m) => !/this\.projetar\(/.test(m[0]));
    igual(semProjetar.length, 0,
      "TODO caminho de gravação que devolve linha passa pelo `projetar` — nenhum entrega a linha inteira");
  }
}

secao("O modo GRUPOS pareia por faixa de pontos — e isso não tinha portão nenhum");
{
  // Achado do Guardião de Regulamento (G2/N10): ele trocou o algoritmo inteiro do
  // modo grupos pelo rodízio do círculo — que IGNORA a tabela de pontos por
  // completo — e a bateria ficou VERDE com as 1240 asserções. O 2º método do
  // Cap. 03 podia virar sorteio sem ninguém perceber.
  //
  // Foi assim que ele descobriu que a correção "óbvia" do NO-GO não servia:
  // aplicar o círculo ao grupos zeraria a repetição (ele mediu 0/400), mas
  // destruiria a regra que o Cap. 03 promete na mesma frase.
  const CIRC_G = "ffff0000-1111-2222-3333-444444444444";
  const lista = ["g0", "g1", "g2", "g3", "g4", "g5", "g6", "g7"];

  // ⚠️ OS SALDOS SÃO DESCORRELACIONADOS DA ORDEM DE CRIAÇÃO, e isso é a
  // correção. A 1ª versão desta seção criava `g0…g7` com saldo decrescente na
  // ordem de criação — então "parear por faixa de pontos" e "parear na ordem em
  // que o banco devolveu" davam O MESMO RESULTADO, e a asserção não conseguia
  // distinguir os dois. O Guardião de Regulamento sabotou o motor para PARAR DE
  // ORDENAR pela tabela e a bateria ficou VERDE — exatamente a regra que a seção
  // existe para provar.
  // Com os saldos embaralhados, a ordem por pontos é g1,g5,g3,g7,g6,g0,g4,g2 e
  // parear por faixa é g1×g5, g3×g7, g6×g0, g4×g2 — nada a ver com a ordem do
  // fixture.
  const { banco, motor } = await montarMotor({
    circuitos: [circuito(BH), circuito(CIRC_G, {
      slug: "faixas", sistema: "B", pareamento: "grupos",
      regulamento_versao: "vB-01", rodadas_por_temporada: 6, fase: "temporada",
    })],
    atletas: lista.map(id => atleta(id)),
    circuito_atletas: lista.map((id, i) => ({
      circuito_id: CIRC_G, atleta_id: id, status: "ativo", pendente_circuito: false,
      saldo_temp: [300, 800, 100, 600, 200, 700, 400, 500][i],
    })),
    chaves: [], partidas: [],
  });

  const r = await comoAdmin(motor, "INICIAR_ETAPA", { circuitoId: CIRC_G });
  ok(r.corpo?.sucesso === true, `a etapa do circuito de grupos inicia (erro: ${JSON.stringify(r.corpo?.erro)})`);

  // A posição na TABELA DE PONTOS, não no array — é a diferença entre as duas.
  const SALDOS = { "g0": 300, "g1": 800, "g2": 100, "g3": 600, "g4": 200, "g5": 700, "g6": 400, "g7": 500 };
  const ordemTabela = [...lista].sort((a, b) => SALDOS[b] - SALDOS[a]);
  const pos = Object.fromEntries(ordemTabela.map((id, i) => [id, i])); // 0 = líder
  const daRodada1 = banco.tabelas.partidas.filter(m => m.circuito_id === CIRC_G && m.rodada === 1);
  igual(daRodada1.length, 4, "a rodada 1 tem 4 partidas");

  // A prova: a distância média na tabela. Parear por faixa dá distância 1 em todos
  // os pares (1º×2º, 3º×4º, …). O rodízio do círculo, ignorando a tabela, dá
  // distâncias muito maiores.
  const distancias = daRodada1.map(m => Math.abs(pos[m.atleta1_id] - pos[m.atleta2_id]));
  const soma = distancias.reduce((a, b) => a + b, 0);
  igual(soma, 4,
    `no modo grupos cada confronto é entre vizinhos na tabela de pontos — soma das distâncias = 4 (veio: ${soma}, pares: ${distancias.join(",")})`);
  ok(distancias.every(d => d === 1),
    "e nenhum par salta faixa: é 1º×2º, 3º×4º, 5º×6º, 7º×8º");

  // ⚠️ ESTA DECLARAÇÃO ESTAVA FALSA, e o Guardião de Regulamento a derrubou
  // MEDINDO. Eu havia escrito que inverter a ordem do modo grupos "só muda quem
  // leva o bye com número ímpar" — e usei isso para não criar portão.
  //
  // Com número PAR ela está certa: ordenar crescente ou decrescente produz o mesmo
  // conjunto de pares vizinhos, a sabotagem fica verde, e está certo que fique.
  //
  // Com número ÍMPAR é outra história, e ele mostrou lado a lado com 9 atletas:
  // NENHUM par da rodada 1 sobrevive, os pares mudam em TODAS as rodadas, e o bye
  // passa a rodar pelo TOPO da tabela em vez da cauda. A razão é simples em
  // retrospecto: tirar uma PESSOA DIFERENTE da lista desloca a posição de todo
  // mundo, e o meu raciocínio ("crescente ou decrescente dá os mesmos vizinhos")
  // vale para a lista INTEIRA — com ímpar, a lista pareada não é a inteira.
  //
  // E o efeito é de competição, não cosmético: o bye vale 1 ponto e a vitória vale
  // 2 (vB-01 Cap. 05), então benchar sistematicamente os primeiros colocados NEGA
  // AO TOPO a chance de somar 2, mês após mês, enquanto a cauda joga. São duas
  // competições diferentes.
  //
  // ⚠️ E este repositório já tem escrito, no `promoverIdentidadeGlobal`, que
  // "comentário errado é pior que comentário nenhum, porque alguém lê para
  // decidir". Uma declaração dizendo "esta sabotagem é benigna" quando ela não é
  // autorizaria justamente a mudança que pretendia dispensar.
  // Por isso a asserção abaixo existe.

  // ── E NA RODADA 3, com a tabela JÁ MEXIDA pelo processamento ──────────────
  // Sem isto o modo grupos podia honrar a faixa no 1º par mensal e virar outra
  // coisa nos rodadas 3-6 sem ninguém ver (a 2ª sabotagem do guardião ficava
  // verde). E isto prova o que o Cap. 03 promete de verdade: que a faixa acompanha
  // a tabela ATUAL, não a do início.
  {
    // Processa a rodada 1 com resultados que MEXEM a tabela, e avança o par.
    const daR1 = banco.tabelas.partidas.filter(m => m.circuito_id === CIRC_G && m.rodada === 1);
    for (const m of daR1) {
      Object.assign(m, { placar1: 3, placar2: 0, validado: true, calculado: false });
    }
    await comoAdmin(motor, "PROCESSAR_RODADA", { circuitoId: CIRC_G, round: 1 });
    const rAv = await comoAdmin(motor, "AVANCAR_RODADA", { circuitoId: CIRC_G });
    ok(rAv.corpo?.sucesso === true, `o par mensal avança (erro: ${JSON.stringify(rAv.corpo?.erro)})`);

    // A tabela AGORA, lida do banco — não a do fixture.
    const agora = banco.tabelas.circuito_atletas
      .filter(c => c.circuito_id === CIRC_G)
      .sort((a, b) => (b.saldo_temp || 0) - (a.saldo_temp || 0));
    const posAgora = Object.fromEntries(agora.map((c, i) => [c.atleta_id, i]));
    const daR3 = banco.tabelas.partidas.filter(m => m.circuito_id === CIRC_G && m.rodada === 3);
    igual(daR3.length, 4, "a rodada 3 tem 4 partidas");
    const distR3 = daR3.map(m => Math.abs(posAgora[m.atleta1_id] - posAgora[m.atleta2_id]));
    const somaR3 = distR3.reduce((a, b) => a + b, 0);
    // ⚠️ O NÚMERO É MEDIDO, não chutado. Eu tinha escrito `<= 6` de palpite e a
    // asserção ficou vermelha na hora. Medido em 30 execuções de cada modo, neste
    // cenário: grupos dá 8 SEMPRE, sorteio dá 16 SEMPRE — determinístico nos dois.
    // A rodada 3 não pode parear só vizinhos porque precisa evitar os confrontos
    // das rodadas 1 e 2; o que importa é que ela pareia o MAIS PRÓXIMO DISPONÍVEL
    // na tabela atual, e é isso que o 8 contra 16 mostra.
    igual(somaR3, 8,
      `na rodada 3 o pareamento continua acompanhando a TABELA ATUAL — soma das distâncias ${somaR3} (pares: ${distR3.join(",")}); o rodízio, que ignora a tabela, dá 16 no mesmo cenário`);
  }

  // E o mesmo cenário no modo SORTEIO NÃO pode dar isso — senão a asserção acima
  // estaria medindo coincidência em vez de regra.
  {
    const { banco: b2, motor: m2 } = await montarMotor({
      circuitos: [circuito(BH), circuito(CIRC_G, {
        slug: "faixas", sistema: "B", pareamento: "sorteio",
        regulamento_versao: "vB-01", rodadas_por_temporada: 6, fase: "temporada",
      })],
      atletas: lista.map(id => atleta(id)),
      circuito_atletas: lista.map((id, i) => ({
        circuito_id: CIRC_G, atleta_id: id, status: "ativo", pendente_circuito: false,
        saldo_temp: [300, 800, 100, 600, 200, 700, 400, 500][i],
      })),
      chaves: [], partidas: [],
    });
    await comoAdmin(m2, "INICIAR_ETAPA", { circuitoId: CIRC_G });
    const r1 = b2.tabelas.partidas.filter(m => m.circuito_id === CIRC_G && m.rodada === 1);
    const somaSort = r1.map(m => Math.abs(pos[m.atleta1_id] - pos[m.atleta2_id])).reduce((a, b) => a + b, 0);
    ok(somaSort > 4,
      `e o modo SORTEIO ignora a tabela — soma das distâncias maior que 4 (veio: ${somaSort})`);
  }
}

secao("A rede de segurança do rodízio faz diferença — medida, não afirmada");
{
  // O Guardião de Regulamento sabotou a rede (`if (true)` no lugar da checagem) e
  // a bateria ficou VERDE. Pior: ele mediu cinco cenários e o resultado foi
  // IDÊNTICO com e sem ela. O comentário do motor afirma "assim o resultado nunca
  // é pior que o de antes", e ele apontou, com razão, que ninguém tinha medido.
  //
  // Fui atrás e ACHEI o cenário: 12 atletas com 4 saindo na virada do 1º par
  // mensal. Medido em 40 temporadas cada:
  //     COM a rede ..... 0 repetições
  //     SEM a rede ..... 3 repetições em TODAS as 40
  // Os cenários que ele testou (10 atletas com 2 ou 4 saindo, 9 com 2, 8 com 1)
  // dão igual nos dois — por isso ele não viu. O que separa é o rodízio precisar
  // ser refeito com um elenco bem menor DEPOIS de já ter gasto rodadas.
  const CIRC_R = "aaaa1111-2222-3333-4444-555555555555";
  const lista = Array.from({ length: 12 }, (_, i) => `r${String(i).padStart(2, "0")}`);

  const { banco, motor } = await montarMotor({
    circuitos: [circuito(BH), circuito(CIRC_R, {
      slug: "rede", sistema: "B", pareamento: "sorteio",
      regulamento_versao: "vB-01", rodadas_por_temporada: 6, fase: "temporada",
    })],
    atletas: lista.map(id => atleta(id)),
    circuito_atletas: lista.map(id => ({ circuito_id: CIRC_R, atleta_id: id, status: "ativo", pendente_circuito: false, saldo_temp: 0 })),
    chaves: [], partidas: [],
  });

  await comoAdmin(motor, "INICIAR_ETAPA", { circuitoId: CIRC_R });
  // Quatro saem depois do 1º par mensal — é o que força o rodízio a ser refeito.
  for (const id of lista.slice(0, 4)) {
    const v = banco.tabelas.circuito_atletas.find(x => x.atleta_id === id);
    if (v) v.status = "arquivado";
  }
  await comoAdmin(motor, "AVANCAR_RODADA", { circuitoId: CIRC_R });
  await comoAdmin(motor, "AVANCAR_RODADA", { circuitoId: CIRC_R });

  const partidas = banco.tabelas.partidas.filter(m => m.circuito_id === CIRC_R);
  const confrontos = partidas.map(m => [m.atleta1_id, m.atleta2_id].sort().join("|"));
  const repeticoes = confrontos.length - new Set(confrontos).size;
  igual(repeticoes, 0,
    `com 12 atletas e 4 saindo no meio, a rede de segurança evita TODA repetição (veio: ${repeticoes}) — sem ela são 3, medido`);

  // E o elenco que ficou joga mesmo as rodadas seguintes, senão o zero acima
  // poderia vir de não ter gerado partida nenhuma.
  const rodadas = [...new Set(partidas.map(m => m.rodada))].sort((a, b) => a - b);
  igual(rodadas.join(","), "1,2,3,4,5,6", "e as 6 rodadas foram geradas");
  const quemSaiu = new Set(lista.slice(0, 4));
  const depois = partidas.filter(m => m.rodada >= 3);
  ok(depois.length > 0 && depois.every(m => !quemSaiu.has(m.atleta1_id) && !quemSaiu.has(m.atleta2_id)),
    "e quem saiu não é pareado depois da saída");
}

secao("No BH, o super-admin não age sobre atleta de OUTRO circuito — o caminho de ESCRITA");
{
  // O `semIntrusosDeOutroCircuito` fechou a LEITURA (o intruso não é pareado no
  // BH). Este é o caminho de ESCRITA, que é o que não se desfaz — medido pelo
  // Guardião de Segurança rodando o motor em `5bc6703`.
  const SO_DO_OUTRO = "cafe0000-0000-0000-0000-000000000001";
  const LEGADO_BH = "cafe0000-0000-0000-0000-000000000002";
  const OUTRO_C = "cafe1111-2222-3333-4444-555555555555";

  const cenarioBH = async () => montarMotor({
    circuitos: [circuito(BH, { regulamento_versao: "v03-13" }), circuito(OUTRO_C, { slug: "outro", sistema: "B", regulamento_versao: "vB-01" })],
    atletas: [
      atleta(SO_DO_OUTRO, { nome: "Só do outro circuito", rating: 777 }),
      // Atleta do BH SEM linha de vínculo — o roster legado, que a exceção protege.
      atleta(LEGADO_BH, { nome: "Legado do BH", status: "arquivado" }),
    ],
    circuito_atletas: [{ circuito_id: OUTRO_C, atleta_id: SO_DO_OUTRO, status: "ativo" }],
  });

  // ── O caso irreversível: apagar da tabela global ─────────────────────────
  {
    const { banco, motor } = await cenarioBH();
    const r = await comoAdmin(motor, "EXCLUIR_ATLETA", { circuitoId: BH, id: SO_DO_OUTRO });
    igual(r.status, 403,
      "com o BH selecionado, o super-admin NÃO exclui um atleta que só participa de outro circuito");
    ok(!!banco.acha("atletas", a => a.id === SO_DO_OUTRO),
      "e o atleta continua existindo — este `delete` é global e leva os vínculos por efeito cascata, não se desfaz");
    igual(banco.acha("circuito_atletas", c => c.atleta_id === SO_DO_OUTRO)?.status, "ativo",
      "o vínculo dele com o circuito próprio fica intacto");
  }

  // ── Arquivar: ele perderia o login em TODOS os circuitos ─────────────────
  {
    const { banco, motor } = await cenarioBH();
    const r = await comoAdmin(motor, "ARQUIVAR_ATLETA", { circuitoId: BH, id: SO_DO_OUTRO });
    igual(r.status, 403, "nem arquiva");
    igual(banco.acha("atletas", a => a.id === SO_DO_OUTRO)?.status, "ativo",
      "e o cadastro global dele continua ativo — arquivar ali tirava o login dele em todo lugar");
  }

  // ── Aprovar: reescreveria o rating global ────────────────────────────────
  {
    const { banco, motor } = await cenarioBH();
    const r = await comoAdmin(motor, "INSCRICAO_VALIDAR", { circuitoId: BH, id: SO_DO_OUTRO, rating: 9999, approved: true });
    igual(r.status, 403, "nem aprova");
    igual(banco.acha("atletas", a => a.id === SO_DO_OUTRO)?.rating, 777,
      "e o rating global dele não é reescrito");
  }

  // ── E o roster LEGADO do BH continua funcionando ─────────────────────────
  // Sem isto o conserto teria virado uma parede: o atleta do BH sem linha de
  // vínculo é exatamente quem a exceção existe para proteger.
  {
    const { banco, motor } = await cenarioBH();
    const r = await comoAdmin(motor, "DESARQUIVAR_ATLETA", { circuitoId: BH, id: LEGADO_BH });
    igual(r.status, 200,
      "o super-admin continua desarquivando atleta do BH que não tem linha de vínculo — é o roster legado");
    igual(banco.acha("atletas", a => a.id === LEGADO_BH)?.status, "ativo", "e ele volta a ativo");
  }
}

secao("Guardas que a bateria NÃO alcança — declaradas, para ninguém as citar como protegidas");
{
  // Regra da casa: guarda inalcançável pelo instrumento ou ganha asserção de
  // FONTE com o motivo declarado, ou alguém a cita um dia como se estivesse
  // protegida. Estas três foram levantadas pelos guardiões de Confiabilidade e
  // de Regulamento em 29/09/2026.

  // 1. `if (eChave) throw eChave` no INICIAR_ETAPA. O banco em memória nunca faz
  //    o `insert` de `chaves` falhar, então o ramo é inalcançável por construção.
  //    A guarda existe porque um insert falho respondia `sucesso: true` e deixava
  //    o circuito sem chave — que é o que levava o AVANCAR_RODADA à chave do BH.
  const iIni = motorFonte.indexOf('case "INICIAR_ETAPA"');
  const fimIni = motorFonte.indexOf('case "', iIni + 10);
  ok(iIni > 0 && fimIni > iIni, "o case de iniciar a etapa foi localizado");
  ok(/if \(eChave\) throw eChave;/.test(motorFonte.slice(iIni, fimIni)),
    "o insert da chave continua com `if (eChave) throw` — INALCANÇÁVEL pela bateria (o banco falso não recusa esse insert), guardado só por esta asserção de fonte");

  // 2. `embaralhar` — o Guardião de Confiabilidade INSTRUMENTOU a função e mediu:
  //    ZERO chamadas em toda a bateria. Não é código morto: ele é o sorteio do
  //    `parearRodadaB`, que agora só roda como REDE DE SEGURANÇA do rodízio. Ou
  //    seja, o único ramo não-determinístico que sobrou no pareamento.
  //    (A seção "A rede de segurança do rodízio faz diferença" alcança a REDE, mas
  //    o embaralhamento em si continua sem asserção sobre o resultado dele.)
  ok(/function embaralhar/.test(motorFonte),
    "o `embaralhar` continua existindo — ele é a rede de segurança, não código morto");
  ok(/const ordenados = \(pareamento === "grupos"\)[\s\S]{0,120}embaralhar\(athletes\)/.test(motorFonte),
    "e continua sendo o caminho do sorteio dentro do `parearRodadaB` — se ele sumir daqui, a rede de segurança deixa de sortear");

  // 3. A lista `COLUNAS_NAO_NULAS` tem 28 colunas, e só UMA é portão provado.
  //    Sabotar `solicitacoes_wo.justificativa` deixa a bateria vermelha com 20
  //    falhas (foi o NO-GO). Tirar `atletas.telefone` — ou qualquer outra das 27 —
  //    deixa VERDE, porque nenhuma função grava `null` nelas hoje: o Guardião de
  //    Confiabilidade cruzou as 57 colunas NOT NULL reais contra toda ocorrência de
  //    `coluna: null` nas 9 Edge Functions e a interseção é VAZIA.
  //    Ou seja: as outras 27 são rede para o futuro, não portão de hoje. Declarado
  //    para ninguém as citar como protegidas — e para ninguém as apagar achando que
  //    são inúteis, que é o erro oposto.
  //    ⚠️ E a `!!ADMIN_PIN` do `circuito-dados` entra na mesma categoria: ela é
  //    fail-closed de verdade (li o código), mas o `carrega-motor.mjs` FIXA
  //    `ADMIN_PIN: "1234"`, então o caso "variável ausente" nunca acontece no teste
  //    e sabotá-la fica verde. (Guardião de Segurança, C6/E8.)
  ok(/COLUNAS_NAO_NULAS/.test(readFileSync("testes/ferramentas.mjs", "utf-8")),
    "a lista de colunas NOT NULL continua existindo — só `justificativa` é portão provado; as outras 27 são rede para o futuro, declaradas aqui");

  // 4. `await bhId()` no bloco de escopo roda FORA do try/catch (Guardião de
  //    Segurança, C6). É memoizado, mas na primeira chamada de uma instância fria
  //    uma falha transitória vira 500 sem cabeçalho de CORS — que na tela do
  //    organizador aparece como "erro de conexão" em vez de mensagem.
  //    Registrado, não consertado: mover o bloco para dentro do `try` muda a ordem
  //    de guardas de autorização, e isso é mudança que pede rodada própria.
  const iEsc = motorFonte.indexOf("ESCOPO POR RECURSO — VALE PARA TODO MUNDO");
  ok(iEsc > 0, "o bloco de escopo por recurso foi localizado");
  ok(motorFonte.indexOf("  try {", iEsc) > motorFonte.indexOf("await bhId()", iEsc),
    "o `await bhId()` do escopo roda ANTES do try — dívida conhecida e declarada (Guardião de Segurança, C6), não protegida por comportamento");
}

secao("Exclusão de dados: só o titular liga e desliga — RODANDO as duas ações");
{
  // ⚠️ ESTA SEÇÃO EXISTE PORQUE A AÇÃO NÃO RODAVA EM TESTE NENHUM. O Guardião de
  // Segurança tentou atacar o `CANCELAR_EXCLUSAO` e o teste QUEBROU — o banco
  // falso não implementava `.not()`. Com a bateria 1320/0 verde, isso PROVOU por
  // eliminação que nenhum teste a executava: uma ação nova de LGPD, numa onda
  // sobre LGPD, sem portão nenhum.
  //
  // O buraco: `athleteId` vinha do payload, e os ids são PÚBLICOS no ranking.
  // Qualquer um cancelava o pedido de exclusão de qualquer um — em silêncio,
  // porque o campo é anulado e não fica registro de que houve pedido.
  //
  // E as duas portas juntas eram piores que a soma: um estranho liga e desliga o
  // estado de LGPD de outra pessoa, inclusive para TRAVAR a
  // `promoverIdentidadeGlobal` (que recusa promover quem tem pedido em aberto).
  // Marca a vítima e ela nunca mais é aprovada em circuito nenhum.
  const EU = "1111aaaa-0000-0000-0000-000000000001";
  const OUTRO_ATL = "1111aaaa-0000-0000-0000-000000000002";
  const MEU_TOKEN = "token-do-titular";
  const TOKEN_DO_OUTRO = "token-do-estranho";
  const sha = (t) => createHash("sha256").update(t).digest("hex");
  const daquiAUmaHora = () => new Date(Date.now() + 3600e3).toISOString();

  const cenarioLGPD = async (campos = {}) => {
    const { banco } = await montarMotor({
      circuitos: [circuito(BH)],
      atletas: [atleta(EU, { nome: "Titular", ...campos }), atleta(OUTRO_ATL, { nome: "Estranho" })],
      outras: { atleta_sessao: [
        { id: "s1", atleta_id: EU, token_hash: sha(MEU_TOKEN), expira_em: daquiAUmaHora() },
        { id: "s2", atleta_id: OUTRO_ATL, token_hash: sha(TOKEN_DO_OUTRO), expira_em: daquiAUmaHora() },
      ] },
    });
    const fn = await carregarFuncao("athlete-action", banco);
    const pedir = (p) => fn.chamar({ acao: "SOLICITAR_EXCLUSAO", payload: p });
    const cancelar = (p) => fn.chamar({ acao: "CANCELAR_EXCLUSAO", payload: p });
    const marca = () => banco.acha("atletas", a => a.id === EU)?.exclusao_solicitada_em;
    return { banco, pedir, cancelar, marca };
  };

  // ── O titular pede e cancela o próprio pedido ────────────────────────────
  {
    const { pedir, cancelar, marca } = await cenarioLGPD();
    const r1 = await pedir({ athleteId: EU, token: MEU_TOKEN });
    ok(r1.corpo?.sucesso === true, `o titular pede a exclusão dos próprios dados (erro: ${JSON.stringify(r1.corpo?.erro)})`);
    ok(!!marca(), "e o pedido fica registrado");
    const r2 = await cancelar({ athleteId: EU, token: MEU_TOKEN });
    ok(r2.corpo?.sucesso === true, `e pode cancelar enquanto está pendente (erro: ${JSON.stringify(r2.corpo?.erro)})`);
    igual(marca(), null, "e o pedido sai do registro");
  }

  // ── SEM token, nenhuma das duas passa ────────────────────────────────────
  for (const [acao, oQue] of [["pedir", "pedir a exclusão"], ["cancelar", "cancelar o pedido"]]) {
    const c = await cenarioLGPD({ exclusao_solicitada_em: "2026-09-20T10:00:00Z" });
    const r = await c[acao]({ athleteId: EU });
    igual(r.status, 401, `sem token de sessão, ${oQue} é recusado`);
    igual(c.marca(), "2026-09-20T10:00:00Z", `e o estado do titular não se mexe (${oQue})`);
  }

  // ── Com o token de OUTRO atleta, também não ──────────────────────────────
  // Este é o ataque: os ids são públicos, então o estranho tem o id da vítima. O
  // que ele não tem é a sessão dela.
  for (const [acao, oQue] of [["pedir", "pedir a exclusão de outra pessoa"], ["cancelar", "cancelar o pedido de outra pessoa"]]) {
    const c = await cenarioLGPD({ exclusao_solicitada_em: "2026-09-20T10:00:00Z" });
    const r = await c[acao]({ athleteId: EU, token: TOKEN_DO_OUTRO });
    igual(r.status, 401, `com o token de OUTRO atleta, ${oQue} é recusado`);
    igual(c.marca(), "2026-09-20T10:00:00Z", `e o estado da vítima fica intacto (${oQue})`);
  }

  // ── O segundo clique NÃO reinicia o prazo do art. 18 ─────────────────────
  // ROADMAP 0.7.3: o `SOLICITAR` gravava a data incondicionalmente, então clicar
  // de novo empurrava o vencimento para frente e o titular perdia prazo sem saber.
  {
    const { pedir, marca } = await cenarioLGPD({ exclusao_solicitada_em: "2026-09-01T08:00:00Z" });
    await pedir({ athleteId: EU, token: MEU_TOKEN });
    igual(marca(), "2026-09-01T08:00:00Z",
      "pedir de novo NÃO sobrescreve a data do primeiro pedido — o prazo do art. 18 §3º não reinicia");
  }

  // ── Cancelar sem pedido pendente é recusado, e não limpa campo de ninguém ─
  {
    const { cancelar, banco } = await cenarioLGPD();
    const r = await cancelar({ athleteId: EU, token: MEU_TOKEN });
    igual(r.status, 409, "cancelar sem pedido pendente é recusado");
    ok(/Não há pedido/.test(String(r.corpo?.erro || "")), "com a frase que explica");
    igual(banco.acha("atletas", a => a.id === OUTRO_ATL)?.exclusao_solicitada_em, undefined,
      "e nenhum outro atleta é tocado");
  }
}

secao("A justificativa de saúde NÃO é copiada para a partida");
{
  // ⚠️ O ACHADO MAIS GRAVE DA 4ª RODADA (Guardião Jurídico). O `RESPONDER_WO`
  // gravava o TEXTO INTEIRO da justificativa em `partidas.motivo_rejeicao` — uma
  // coluna que a anonimização NUNCA toca, numa tabela que sobrevive por projeto.
  //
  // E eu conferi no banco, os três fatos juntos: `motivo_rejeicao` tem SELECT para
  // `anon`, a política `leitura_publica_partidas` libera qualquer partida de
  // circuito público, o BH é público, e 5 das 34 partidas JÁ carregam
  // `W.O. Justificado — <texto>`. O texto de saúde de cinco pessoas reais estava
  // legível por qualquer visitante do site.
  //
  // Esta onda apagava o atestado do bucket e zerava a `justificativa` — e deixava
  // uma cópia literal a uma tabela de distância.
  const F2 = "9999aaaa-0000-0000-0000-00000000000f";
  const V2 = "9999aaaa-0000-0000-0000-00000000000v";
  const SEGREDO = "Estava internado com pneumonia e tomando antibiótico";

  for (const sistema of ["A", "B"]) {
    const CIRC = sistema === "B" ? "9999bbbb-1111-1111-1111-111111111111" : BH;
    const { banco, motor } = await montarMotor({
      circuitos: [
        circuito(BH, { regulamento_versao: "v03-13" }),
        circuito("9999bbbb-1111-1111-1111-111111111111", { slug: "wo-b", sistema: "B", pareamento: "sorteio", regulamento_versao: "vB-01" }),
      ],
      atletas: [atleta(F2), atleta(V2)],
      circuito_atletas: [
        { circuito_id: CIRC, atleta_id: F2, status: "ativo" },
        { circuito_id: CIRC, atleta_id: V2, status: "ativo" },
      ],
      partidas: [partida("jw", { circuito_id: CIRC, atleta1_id: F2, atleta2_id: V2 })],
      solicitacoes_wo: [{ id: "sw", circuito_id: CIRC, atleta_id: F2, adversario_id: V2, partida_id: "jw", status: "pendente", justificativa: SEGREDO }],
    });
    const r = await comoAdmin(motor, "RESPONDER_WO", { circuitoId: CIRC, id: "sw", matchId: "jw", aprovado: true, justificativa: SEGREDO });
    ok(r.corpo?.sucesso === true, `[${sistema}] o organizador aprova a justificativa (erro: ${JSON.stringify(r.corpo?.erro)})`);
    const m = banco.acha("partidas", x => x.id === "jw");
    ok(!String(m?.motivo_rejeicao || "").includes("pneumonia"),
      `[${sistema}] e o texto da justificativa NÃO vai para a partida (veio: ${JSON.stringify(m?.motivo_rejeicao)}) — essa coluna é legível pelo visitante anônimo`);
    // E a justificativa continua onde é o lugar dela, para o organizador julgar.
    igual(banco.acha("solicitacoes_wo", w => w.id === "sw")?.justificativa, SEGREDO,
      `[${sistema}] ela continua em solicitacoes_wo, que é onde o organizador a lê`);
  }
}

secao("No modo grupos, quem folga é o FIM da tabela — e isso não tinha portão");
{
  // Sabotagem nova do Guardião de Regulamento (P4): mandar o bye do modo grupos
  // direto para o TOPO da tabela deixava a bateria VERDE. Qual ponta folga é regra
  // de competição — o bye vale 1 ponto, a vitória vale 2 — e nada protegia.
  //
  // MEDIDO POR MIM em `f458e48` antes de escrever a asserção, com 9 atletas e
  // saldos descorrelacionados: o bye desce pela CAUDA, nas posições 9, 8, 7 e 6 de
  // 9. É o comportamento certo — folga quem está no fim, para quem o 1 ponto do
  // bye é próximo do resultado esperado.
  const CIRC_BY = "8888cccc-1111-2222-3333-444444444444";
  const lista = ["b0", "b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8"];
  const SALDOS = [300, 800, 100, 600, 200, 700, 400, 500, 250];

  const { banco, motor } = await montarMotor({
    circuitos: [circuito(BH), circuito(CIRC_BY, {
      slug: "bye-faixa", sistema: "B", pareamento: "grupos",
      regulamento_versao: "vB-01", rodadas_por_temporada: 6, fase: "temporada",
    })],
    atletas: lista.map(id => atleta(id)),
    circuito_atletas: lista.map((id, i) => ({ circuito_id: CIRC_BY, atleta_id: id, status: "ativo", pendente_circuito: false, saldo_temp: SALDOS[i] })),
    chaves: [], partidas: [],
  });
  const r = await comoAdmin(motor, "INICIAR_ETAPA", { circuitoId: CIRC_BY });
  ok(r.corpo?.sucesso === true, `a etapa inicia com 9 atletas no modo grupos (erro: ${JSON.stringify(r.corpo?.erro)})`);

  const tabela = [...lista].sort((a, b) => SALDOS[lista.indexOf(b)] - SALDOS[lista.indexOf(a)]);
  const byeDa = (rodada) => {
    const da = banco.tabelas.partidas.filter(m => m.circuito_id === CIRC_BY && m.rodada === rodada);
    const jogaram = new Set(da.flatMap(m => [m.atleta1_id, m.atleta2_id]));
    return lista.filter(id => !jogaram.has(id))[0];
  };

  igual(byeDa(1), tabela[tabela.length - 1],
    `na rodada 1 folga o ÚLTIMO da tabela de pontos (${byeDa(1)}), não o líder — mandar o bye para o topo negaria aos primeiros a chance de somar 2`);
  igual(byeDa(2), tabela[tabela.length - 2],
    `na rodada 2 folga o penúltimo (${byeDa(2)}) — a folga desce pela cauda, sem repetir`);
  ok(byeDa(1) !== tabela[0] && byeDa(2) !== tabela[0],
    "e o líder da tabela não folga nas duas primeiras rodadas");
}

secao("Nenhum texto promete anulação num circuito de pontos");
{
  // POR QUE ISTO É UMA VARREDURA E NÃO TRÊS ASSERÇÕES.
  //
  // No Sistema B o `RESPONDER_WO` aprovado NÃO anula: grava `wo_tipo:
  // "justificado"` (admin-action:1738) e o `PROCESSAR_RODADA` pontua o ausente
  // +1 COM DERROTA e o adversário +2 com vitória (admin-action:1313-1321).
  //
  // Mesmo assim a tela do organizador e as DUAS mensagens de WhatsApp que ela
  // dispara afirmavam "foi anulado — ninguém perde pontos" em todo circuito. A
  // tela do ATLETA já estava ramificada; a do admin, que é a que MANDA a
  // mensagem para as duas pessoas, não. Achado do Supervisor do Admin.
  //
  // Consertar as três linhas e parar aí seria repetir o defeito que esta onda
  // catalogou cinco vezes: "conserto do caminho que eu estava olhando". O que
  // deixou as três passarem foi não existir nada contando os IRMÃOS. Então a
  // asserção conta TODA promessa de anulação do arquivo e exige que cada uma
  // esteja dentro de uma ramificação por sistema — a próxima que alguém
  // escrever já nasce coberta, ou nasce vermelha.
  const { readFileSync } = await import("node:fs");
  const bruto = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

  // COMENTÁRIO NÃO É TEXTO DE TELA. Trocado por espaço (não removido) para os
  // índices continuarem apontando para a linha certa. Isto não é conveniência:
  // a primeira versão desta varredura acusou o comentário que documenta o
  // próprio defeito, o que a tornaria impossível de deixar verde sem apagar a
  // documentação.
  const fonteApp = semComentarios(bruto);

  // EXCLUSÃO DECLARADA: o `RegulamentoView` mostra o regulamento DO CIRCUITO e
  // recebe `sistema` como propriedade — lá o texto do Sistema A dizer "rodada
  // anulada" é correto, é o regulamento dele. A exclusão é por região de arquivo
  // e vem com portão próprio duas asserções abaixo, para não virar buraco cego.
  const iReg = fonteApp.indexOf("function RegulamentoView(");
  ok(iReg > 0, "o RegulamentoView existe (se o nome mudar, a exclusão abaixo precisa ser revista)");
  const fimReg = fonteApp.indexOf("\nfunction ", iReg + 10);
  ok(fimReg > iReg, "e tem fim localizável — a exclusão é de uma região, não do arquivo");

  const promessas = [...fonteApp.matchAll(/ninguém perde pontos|foi anulad[oa]|é anulad[oa]|anula a rodada/g)];
  ok(promessas.length > 0,
    `o app tem texto que promete anulação (${promessas.length} lugar(es)) — se der zero, a busca quebrou e as asserções abaixo são vazias`);

  const foraDoRegulamento = promessas.filter((m) => !(m.index > iReg && m.index < fimReg));
  ok(foraDoRegulamento.length > 0,
    `e ${foraDoRegulamento.length} delas estão FORA do regulamento — se der zero, a exclusão engoliu a varredura inteira`);

  const semRamificacao = foraDoRegulamento.filter((m) => {
    const antes = fonteApp.slice(Math.max(0, m.index - 700), m.index);
    return !/SISTEMA_ATIVO\s*[!=]==\s*"B"|anulaNoSistema/.test(antes);
  });
  igual(semRamificacao.length, 0,
    "TODA promessa de anulação fora do regulamento está dentro de uma ramificação por sistema — no circuito de pontos o W.O. justificado pontua 1 × 2, não anula");

  // O PORTÃO DA EXCLUSÃO. Sem isto, "está no RegulamentoView" seria licença para
  // qualquer texto: o que torna a região segura é ela receber o sistema de fora.
  const corpoReg = fonteApp.slice(iReg, fimReg);
  ok(/function RegulamentoView\(\{[^}]*\bsistema\b/.test(corpoReg),
    "o RegulamentoView recebe `sistema` como propriedade — é isso que faz a exclusão acima ser legítima e não um buraco");
  ok(/<RegulamentoView[\s\S]{0,400}?sistema=/.test(fonteApp),
    "e quem o chama passa o `sistema` de verdade");

  // O NÚMERO, QUE É O QUE O ATLETA LÊ, TEM DE BATER COM O MOTOR — e a asserção
  // tem de ser POR MENSAGEM, não pelo arquivo.
  //
  // A primeira versão disto era `ok(/1 ponto e uma derrota/.test(fonteApp))`. A
  // mutação "troca 1 ponto por 0 pontos na mensagem do solicitante" passou
  // VERDE, porque a mesma frase também existe na tela do admin e o teste só
  // perguntava se ela estava em ALGUM lugar do arquivo. É exatamente o que o
  // CLAUDE.md diz sobre regex: "se a asserção é regex, ela não protege a regra
  // — só registra que um trecho de texto está lá". Cada destino é conferido no
  // seu próprio pedaço agora.
  const recorte = (de, ate) => {
    const i = fonteApp.indexOf(de);
    if (i < 0) return "";
    const f = fonteApp.indexOf(ate, i);
    return f > i ? fonteApp.slice(i, f) : "";
  };

  const trechoSolicitante = recorte("const msgSolicitante", "const msgAdversario");
  ok(trechoSolicitante.length > 0, "a mensagem do solicitante foi localizada no fonte");
  ok(/1 ponto e uma derrota/.test(trechoSolicitante),
    "a mensagem que vai para QUEM FALTOU diz o que ele realmente recebe: 1 ponto e uma derrota");
  ok(/2 pontos/.test(trechoSolicitante),
    "e diz que o adversário recebe 2 pontos");

  const trechoAdversario = recorte("const msgAdversario", "const linkSolicitante");
  ok(trechoAdversario.length > 0, "a mensagem do adversário foi localizada no fonte");
  ok(/2 pontos/.test(trechoAdversario),
    "a mensagem que vai para O ADVERSÁRIO diz que ele recebe os 2 pontos — não que o confronto foi anulado");

  const trechoTela = recorte("W.O. Justificado — Cap. 07", "{pendentesWo.map");
  ok(trechoTela.length > 0, "o aviso da tela do organizador foi localizado no fonte");
  ok(/1 ponto e uma derrota/.test(trechoTela) && /2 pontos/.test(trechoTela),
    "e o aviso da TELA do organizador traz os dois números antes de ele aprovar");
  ok(!/Justificado \(anula\)<\/Btn>/.test(fonteApp),
    'o botão não rotula "Justificado (anula)" sem ramificar — o rótulo ficava três linhas acima de um comentário dizendo que no B não anula');
}

secao("O preço que o atleta vê é o do circuito DELE — RODANDO o login-atleta");
{
  // 11/10/2026, piloto do 1º circuito PAGO, com atletas reais se inscrevendo.
  //
  // O DEFEITO, medido em produção: a ação PRECO não mandava circuito nenhum, e a
  // função do banco não recebia — ela lia `from configuracao where id = 1`, a
  // configuração LEGADA DO BH. Com o `desconto_global_pct = 100` que sobrou da
  // temporada de teste gratuita, a tela do atleta dizia
  // "Sua temporada: R$ 100,00 (riscado) R$ 0,00 (100% off)" com a chave PIX
  // logo abaixo, enquanto o painel do organizador dizia R$ 50,00.
  // Dois dos três atletas não pagaram. O app disse que não havia o que pagar.
  //
  // A regra, nas palavras do Juliano: "o atleta precisa ver o valor que o admin
  // configurou para aquele circuito que ele está se inscrevendo".
  //
  // ⚠️ LIMITE DESTA SEÇÃO, dito na cara: o cálculo mora em SQL
  // (`docs/migracoes/2026-10-11-preco-por-circuito.sql`) e a bateria NÃO EXECUTA
  // SQL — o banco falso serve RPC por dublê. Então aqui se prova o que é
  // provável em JS: que o `login-atleta` EXIGE o circuito e MANDA o circuito
  // certo. Que a função SQL faz a conta certa se prova no banco, com a consulta
  // de conferência que está no fim do arquivo da migração.
  // Isto não é desculpa: é a fronteira do que esta asserção cobre.
  const sha = (t) => createHash("sha256").update(t).digest("hex");
  const TOKEN = "token-do-preco";
  const ATL = "aaaa0000-0000-0000-0000-00000000bb01";
  const PAGO = "99990000-1111-2222-3333-555555555555";

  // O dublê DECLARA os dois argumentos. Se o servidor voltar a chamar com
  // `p_id` sozinho, o banco falso para alto em vez de devolver número errado.
  const cenario = async () => {
    const banco = criarBancoFalso({
      circuitos: [
        circuito(BH, { valor_temporada: 10000, desconto_global_pct: 100 }),
        circuito(PAGO, { slug: "pago", sistema: "B", regulamento_versao: "vB-01",
                         valor_temporada: 5000, desconto_global_pct: 0 }),
      ],
      atletas: [atleta(ATL, { nome: "Fulano", status: "ativo" })],
      circuito_atletas: [
        { circuito_id: BH, atleta_id: ATL, status: "ativo" },
        { circuito_id: PAGO, atleta_id: ATL, status: "ativo" },
      ],
      atleta_sessao: [{ id: "s1", atleta_id: ATL, token_hash: sha(TOKEN),
                        expira_em: new Date(Date.now() + 3600e3).toISOString() }],
      partidas: [], chaves: [], solicitacoes_wo: [], tentativas_login_admin: [],
      circuito_organizadores: [], mensagens_enviadas: [], pagamentos: [],
      partidas_historico: [], circuito_cobranca: [],
      configuracao: [{ id: 1, valor_temporada: 10000, desconto_global_pct: 100 }],
    }, {
      preco_temporada_atleta: {
        args: ["p_id", "p_circuito"],
        // Dublê fiel ao SQL da migração: lê `circuitos` pelo circuito recebido e
        // o desconto do VÍNCULO, nunca a `configuracao` nem o global.
        fn: (bd, args) => {
          const c = (bd.tabelas.circuitos || []).find(x => String(x.id) === String(args.p_circuito));
          const v = (bd.tabelas.circuito_atletas || []).find(x =>
            String(x.atleta_id) === String(args.p_id) && String(x.circuito_id) === String(args.p_circuito));
          if (!c || !v) return null;
          const base = c.valor_temporada;
          const pct = v.desconto_pct ?? c.desconto_global_pct ?? 0;
          return {
            isento: !!v.isento,
            valor_base_cent: base,
            preco_final_cent: base == null ? null : (v.isento ? 0 : Math.round(base * (1 - pct / 100))),
          };
        },
      },
    }, {}, {});
    return { banco, login: await carregarFuncao("login-atleta", banco) };
  };

  // 1. O CASO QUE QUEBROU EM PRODUÇÃO: o circuito pago não herda o zero do BH.
  {
    const { banco, login } = await cenario();
    const r = await login.chamar({ acao: "PRECO", token: TOKEN, circuitoId: PAGO });
    igual(r.status, 200, "o preço do circuito pago é respondido");
    igual(r.corpo?.dados?.preco_final_cent, 5000,
      "e é R$ 50,00 — o valor DAQUELE circuito, não o R$ 0,00 da configuração legada do BH");
    const chamada = banco.funcoesChamadas.find(f => f.nome === "preco_temporada_atleta");
    igual(String(chamada?.argumentos?.p_circuito), PAGO,
      "o servidor manda o circuito para a função do banco — era isto que faltava");
  }

  // 2. O BH continua recebendo o preço do BH: o conserto não inverteu a vítima.
  {
    const { login } = await cenario();
    const r = await login.chamar({ acao: "PRECO", token: TOKEN, circuitoId: BH });
    igual(r.corpo?.dados?.preco_final_cent, 0,
      "no BH, que tinha 100% de desconto, o preço segue zero — cada circuito com o seu");
  }

  // 3. SEM CIRCUITO É ERRO, NÃO PALPITE. Era o palpite (cair no BH) que produzia
  //    o número errado; responder "R$ 0,00" por omissão é o defeito, não o padrão.
  {
    const { banco, login } = await cenario();
    const r = await login.chamar({ acao: "PRECO", token: TOKEN });
    igual(r.status, 400, "sem circuito, a ação recusa em vez de adivinhar");
    igual(banco.funcoesChamadas.filter(f => f.nome === "preco_temporada_atleta").length, 0,
      "e nem chega a consultar o banco — a recusa não deixa rastro");
  }

  // 4. Sessão continua sendo o portão: preço e isenção são dado de uma pessoa, e
  //    os ids dos atletas são públicos no ranking.
  {
    const { login } = await cenario();
    const r = await login.chamar({ acao: "PRECO", circuitoId: PAGO });
    igual(r.status, 401, "sem token de sessão, não se responde preço de ninguém");
    const r2 = await login.chamar({ acao: "PRECO", token: "token-inventado", circuitoId: PAGO });
    igual(r2.status, 401, "e token inventado também não");
  }

  // 5. O FRONT manda o circuito. Sem isto o servidor recusaria (3) e a tela
  //    ficaria muda — trocaria um número errado por nenhum número.
  ok(/async function buscarPrecoTemporada\(circuitoId\)/.test(fonte),
    "a busca de preço no app exige o circuito na assinatura");
  ok(/acao: "PRECO", token: cred\.token, circuitoId: String\(circuitoId\)/.test(fonte),
    "e o manda no corpo da chamada");
  ok(/buscarPrecoTemporada\(CIRCUITO_ATIVO\)/.test(fonte),
    "o card do atleta pede o preço do circuito que está aberto na tela");
  // A troca de circuito tem de refazer a busca: `CIRCUITO_ATIVO` é variável de
  // módulo e não dispara efeito nenhum sozinho.
  ok(/state\.financeiroAtivo, eu\?\.id, state\.nomeCircuito\]/.test(fonte),
    "e trocar de circuito refaz a busca, em vez de deixar na tela o preço do anterior");
}

secao("O atleta sabe quanto, quando e como pagar — antes de se comprometer");
{
  // 11/10/2026. Feedback do piloto, nas palavras do Juliano: "está bem confuso e
  // burocrático e não está muito claro a questão do pagamento, quanto vai custar,
  // quando tem que pagar e como pagar".
  //
  // ⚠️ LIMITE: estas asserções são REGEX sobre o fonte. O CLAUDE.md é explícito —
  // "se a asserção é regex, ela não protege a regra, só registra que um trecho de
  // texto está lá", e em 19/09 três sabotagens do re-aceite ficaram verdes. Elas
  // valem aqui porque o que mudou É texto de tela e de mensagem; o que havia de
  // comportamento (o preço por circuito) está na seção anterior, rodando o
  // `login-atleta` de verdade. Não confunda as duas coberturas.

  // ── QUANTO: o preço existe no caminho PÚBLICO, antes do login ──
  // Antes disto o valor só existia depois da sessão, e a sessão depois da
  // aprovação: era inalcançável por construção para quem decide se inscrever.
  ok(/getVersoesRegulamento: \(\) => supaFetch\(`circuitos\?select=id,regulamento_versao,financeiro_ativo,valor_temporada,desconto_global_pct,rodadas_por_temporada,data_inicio_temporada&/.test(fonte),
    "a leitura pública carrega o preço do circuito, não só a versão do regulamento");
  // ESTA é a asserção que impede o conserto de virar o próximo apagão: a leitura
  // roda com a chave do visitante, e `select=*` quebra a consulta INTEIRA no dia
  // em que existir coluna sem permissão para o `anon` (armadilha nº 1 do
  // CLAUDE.md — derrubou o app em 07/09 e de novo em 03/10/2026).
  ok(!/getVersoesRegulamento: \(\) => supaFetch\(`circuitos\?select=\*/.test(fonte),
    "e continua NOMEANDO as colunas, nunca select=* na leitura do visitante");
  ok(/Inscrição da temporada: \{pct > 0 && base > 0/.test(fonte),
    "a tela da decisão mostra o valor da inscrição");
  ok(/if \(base == null\) return null;/.test(fonte),
    "e fica calada quando não há valor configurado, em vez de anunciar R$ 0,00");
  ok(/Valor único da temporada inteira — \{rodadas\} rodadas/.test(fonte),
    "dizendo que é da temporada inteira, com o número de rodadas");

  // ── QUANDO: a regra que o motor cumpre passa a ser dita ao ATLETA ──
  // `promoverBacklog` e `getAtivosNoCircuito` filtram por `pagamento_confirmado`,
  // então sem pagamento o atleta não é pareado. Até aqui só o organizador sabia.
  ok(/Sua vaga nos confrontos vale a partir do momento em que ele confirma o pagamento/.test(fonte),
    "a tela da decisão diz que a vaga depende da confirmação do pagamento");
  ok(/O pagamento é o que confirma sua vaga/.test(fonte),
    "e a mensagem de aprovação também diz");
  ok(/Enquanto não estiver confirmado, você não entra no sorteio dos confrontos/.test(fonte),
    "com a consequência explícita, que é o prazo real");

  // ── COMO: a chave PIX chega junto da aprovação, que é o canal que ele lê ──
  ok(/🔑 PIX: \*\$\{state\.pixChave\}\*/.test(fonte),
    "a mensagem de aprovação leva a chave PIX");
  ok(/💵 Inscrição da temporada: \*\$\{fmtB\(finalB\)\}\* — valor único da temporada inteira, sem mensalidade/.test(fonte),
    "e leva o valor, no mesmo vocabulário do aviso de renovação");
  ok(/if \(state\.financeiroAtivo && finalB != null\)/.test(fonte),
    "e não fala de dinheiro quando não há valor configurado");
  // A chave do organizador NÃO vai para a página pública: ela só é útil depois da
  // aprovação, e minimizar é a regra.
  ok(!/select=id,regulamento_versao[^`]*pix_chave/.test(fonte),
    "a chave PIX não entra na leitura pública");

  // ── O caminho deixa de terminar no escuro ──
  ok(/O que acontece agora/.test(fonte),
    "a tela de inscrição enviada lista os próximos passos");
  ok(/Entra no app em <b style=\{\{color:"#F0EAE0"\}\}>Sou atleta<\/b>, com este mesmo WhatsApp, e cria seu PIN/.test(fonte),
    "inclusive o passo que ninguém adivinha: voltar ao app e criar o PIN");

  // ── O card do atleta para de desaparecer quando a dívida passa a doer ──
  // ⚠️ A janela se ancora na função SEGUINTE de verdade (`IniciarEtapaPanel`).
  // Primeira tentativa usou `RenovacaoAdminPanel`, que vive ANTES de
  // `RenovacaoCard` no arquivo: o recorte saía vazio e as asserções abaixo
  // falhavam pelo motivo errado. A asserção de que o recorte foi LOCALIZADO é
  // obrigatória pelo CLAUDE.md, e é ela que transforma isto em erro visível.
  const iCard = fonte.indexOf("function RenovacaoCard");
  const iDepois = fonte.indexOf("function IniciarEtapaPanel");
  ok(iCard > 0 && iDepois > iCard, "o recorte do card do atleta foi localizado no fonte");
  const cardAtl = fonte.slice(iCard, iDepois);
  ok(/const devendo = !!eu && eu\.status === "ativo" && !eu\.pendenteCircuito/.test(cardAtl),
    "quem não pagou continua vendo o card em qualquer fase");
  ok(/const elegivel = \(inscricoes \|\| devendo\)/.test(cardAtl),
    "e isso entra no portão do card, não só numa variável solta");
  // Com a temporada em curso o card não pode falar da PRÓXIMA: `RENOVAR` grava
  // `quer_renovar`, que a virada zera, e não é o que libera a vaga agora.
  ok(/\) : !naProxima \? \(/.test(cardAtl),
    "e o texto ramifica por pré-abertura — quem é de primeira viagem não lê 'renovar'");
  ok(/💵 Pagamento da inscrição — \{nomeCirc\}/.test(cardAtl),
    "o título diz do que o card trata quando a temporada já começou");

  // ── O aviso de jogos presenciais deixa de depender de haver 2+ circuitos ──
  ok(!/\{lista && lista\.length > 1 && \(escolhido\.cidade \|\| escolhido\.uf\) && \(/.test(fonte),
    "o aviso de jogos presenciais não depende mais de existir outro circuito na lista");
  ok(/\{\(escolhido\.cidade \|\| escolhido\.uf\) && \(/.test(fonte),
    "ele aparece sempre que o circuito tem cidade — inclusive com um circuito só");

  // ── O prazo dito ao ORGANIZADOR estava subestimado em ~2x ──
  // `AVANCAR_RODADA` gera DUAS rodadas de uma vez (`const rA = roundBase + 1,
  // rB = roundBase + 2`), então "entra na rodada seguinte" prometia metade do
  // tempo real de espera de quem paga atrasado.
  ok(/Quem pagar depois entra só no próximo par de rodadas\./.test(fonte),
    "o painel do admin diz 'par de rodadas', que é o que o motor de fato gera");
  ok(/const rA = roundBase \+ 1, rB = roundBase \+ 2;/.test(motorFonte),
    "e o motor confirma que são duas rodadas por avanço — é o que sustenta a frase");
}

secao("O pagamento registra QUEM confirmou — rodando o motor de verdade");
{
  // 16/10/2026. O Juliano entrou como atleta, viu "pagamento confirmado" e
  // disse "não lembro de ter pago". O registro existia (03/10, 21:03:47,
  // R$ 50,00, criado e confirmado no MESMO milissegundo — assinatura do botão
  // do painel), mas a tabela não guardava autoria. O melhor que dava para
  // responder era "foi pelo painel", nunca "foi você".
  //
  // ⚠️ Campo de AUDITORIA: nenhum cálculo depende dele, e a trava do pareamento
  // continua olhando só `pagamento_confirmado`. As duas asserções abaixo provam
  // as duas metades — que a autoria é gravada, e que o efeito no pareamento não
  // mudou.
  const ATL_PG = "aaaa0000-0000-0000-0000-0000000000pg".replace("pg", "99");
  const { banco, motor } = await montarMotor({
    circuitos: [circuito(BH, { financeiro_ativo: true, valor_temporada: 5000 })],
    atletas: [atleta(ATL_PG, { nome: "Quem Pagou", status: "ativo" })],
    circuito_atletas: [{ circuito_id: BH, atleta_id: ATL_PG, status: "ativo" }],
  });
  const r = await comoAdmin(motor, "REGISTRAR_PAGAMENTO", {
    atletaId: ATL_PG, valor: 5000, temporadaRotulo: "1/2026", metodo: "pix",
  });
  igual(r.status, 200, "o pagamento é registrado");
  const pg = banco.linhas("pagamentos").find(x => x.atleta_id === ATL_PG);
  ok(!!pg, "e a linha existe no livro");
  igual(pg?.confirmado_por, "super-admin",
    "com a AUTORIA gravada — era isto que faltava para o app dizer de onde veio a confirmação");
  ok(!!pg?.confirmado_em, "e com a data da confirmação");
  // A autoria vem do SERVIDOR: o cliente não a declara.
  const corpoAcao = motorFonte.slice(motorFonte.indexOf('case "REGISTRAR_PAGAMENTO"'),
                                     motorFonte.indexOf('case "ESTORNAR_PAGAMENTO"'));
  ok(/confirmado_por: ehSuper \? "super-admin" : \(orgAtletaId \|\| null\)/.test(corpoAcao),
    "e ela sai da autenticação do servidor, não do payload — autoria que o cliente declara não é autoria");
  ok(!/confirmadoPor/.test(corpoAcao),
    "o motor não aceita autoria vinda do cliente");
  // O efeito que importa para a competição não mudou.
  igual(banco.acha("circuito_atletas", c => c.atleta_id === ATL_PG)?.pagamento_confirmado, true,
    "e o atleta passa a contar como pago — a trava do pareamento segue a mesma");
}

secao("Aprovado e pago são coisas diferentes, e a tela diz isso");
{
  // 16/10/2026. Pedido do Juliano, com as palavras dele: "quando um atleta se
  // inscreve e eu aprovo, não tem a opção aprovado aguardando pagamento ou algo
  // parecido, já vai como ativo, e isso me confunde para saber quem pagou ou não".
  //
  // O dado sempre existiu; o que faltava era o ESTADO ser legível. Tudo caía sob
  // "✅ Aprovados", com o pagamento num selo de 9px — e é justamente essa a
  // distinção que decide se o atleta joga: `promoverBacklog` e
  // `getAtivosNoCircuito` filtram por `pagamento_confirmado`.
  ok(/const aguardandoPgto = cobrando \? aprovados\.filter\(a => !a\.pagamentoConfirmado\) : \[\];/.test(fonte),
    "o painel separa quem está aprovado e ainda não pagou");
  ok(/const prontos = cobrando \? aprovados\.filter\(a => a\.pagamentoConfirmado\) : aprovados;/.test(fonte),
    "e quem já pagou — com o financeiro desligado, não há o que separar");
  ok(/⏳ Aprovados — aguardando pagamento \(\{aguardandoPgto\.length\}\)/.test(fonte),
    "o TÍTULO carrega o estado, em vez de escondê-lo num selo");
  ok(/não entram no sorteio dos confrontos<\/strong> enquanto/.test(fonte),
    "e diz a consequência: sem pagamento, não entra no sorteio");
  // A trava do motor é a razão de a separação existir — se ela sumir, a tela
  // passa a prometer uma distinção que o servidor não faz mais.
  ok(/pagamento_confirmado/.test(motorFonte),
    "e o motor de fato retém quem não pagou — é o que a tela está refletindo");
}

// ── O PREÇO NÃO SOME NO MEIO DO FORMULÁRIO — 01/11/2026 ─────────────────────
secao("O valor acompanha o atleta pelos dois passos da inscrição");
{
  // O Juliano, 01/11/2026: "o processo para o atleta se inscrever continua muito
  // confuso, quero simplificar o máximo".
  //
  // Medido antes de mexer: a palavra "R$" não aparecia NENHUMA vez dentro do
  // `InscricaoForm`. O valor existia na tela de confirmação, logo ANTES do
  // formulário (onda de 11/10), e depois sumia — o atleta atravessava dois
  // passos, três textos legais e a criação do PIN sem o número na frente, e a
  // tela de sucesso ainda dizia "você recebe o valor no WhatsApp", como se nunca
  // tivesse sido dito. A resposta para "quanto custa" estava no app e se perdia
  // no caminho.
  ok(/const LinhaPreco = \(\) => \{/.test(fonte),
    "existe uma linha de preço própria do formulário de inscrição");

  // A REGRA DO DINHEIRO, e a única aqui que não é cosmética: sem valor
  // configurado a tela cala a boca. Anunciar "R$ 0,00" porque o dado falta é
  // prometer gratuidade — foi o defeito que custou 2 dos 3 pagamentos do piloto
  // em 11/10/2026, pela outra ponta (a função de preço lia a config do BH).
  const iLinha = fonte.indexOf("const LinhaPreco = () => {");
  ok(iLinha > 0, "o corpo da LinhaPreco foi encontrado");
  const fimLinha = fonte.indexOf("\n  };", iLinha);
  ok(fimLinha > iLinha, "o fim da LinhaPreco foi encontrado");
  const corpo = fonte.slice(iLinha, fimLinha);

  ok(/if \(base == null\) return null;/.test(corpo),
    "a linha fica CALADA quando não há valor configurado, nunca anuncia R$ 0,00");
  ok(/if \(!circ \|\| !circ\.financeiro_ativo\) return null;/.test(corpo),
    "e não fala de dinheiro em circuito com cobrança desligada, nem sem o circuito");
  ok(/Nada é cobrado agora/.test(corpo),
    "ela responde QUANDO se paga: nada agora");
  ok(/depois<\/b> que o organizador aprovar/.test(corpo),
    "dizendo que o pagamento vem depois da aprovação");
  ok(/por PIX/.test(corpo), "e COMO se paga");

  // CONTE OS PONTOS DE CHAMADA, não a existência da função. A lição é do
  // CLAUDE.md, aprendida na fatia 0.6.21: a janela ancorada no corpo é fiel ao
  // corpo e CEGA para quem invoca — o defeito mais grave daquela onda era uma
  // prop faltando num ponto de chamada 300 linhas adiante, e a bateria inteira
  // ficou verde. São três telas e têm de ser as três: passo 1, passo 2 e
  // sucesso. Apague qualquer uma e esta asserção fica vermelha.
  const chamadas = (fonte.match(/<LinhaPreco\/>/g) || []).length;
  ok(chamadas === 3,
    `a linha de preço é renderizada nos TRÊS passos do formulário (achei ${chamadas})`);

  // ── O aviso da CBTM não aparece para quem nunca foi perguntado sobre a CBTM ──
  // A pergunta "é federado pela CBTM?" já vivia dentro de `{!ehB && ...}`; o
  // AVISO ficava do lado de fora e alcançava todo mundo. No bh2, que é Sistema B,
  // o atleta lia um alerta sobre a Nota CBTM 183/2025 sem ter sido perguntado
  // nada. Ruído numa tela cuja queixa é justamente ser longa demais.
  const iAviso = fonte.indexOf("⚠️ Atletas federados CBTM");
  ok(iAviso > 0, "o aviso da CBTM foi encontrado");
  // Janela para TRÁS até a abertura da div — fronteira sintática, não contagem.
  const aberturaAviso = fonte.lastIndexOf("{!ehB && <div", iAviso);
  const divAnterior = fonte.lastIndexOf("<div", iAviso);
  ok(aberturaAviso > 0 && aberturaAviso === divAnterior - 9,
    "o aviso da CBTM está DENTRO do gate !ehB — circuito por pontos não o recebe");
}

secao("A PORTA DO APP é a participação no circuito, não o status global — RODANDO o login-atleta");
{
  // 15/11/2026. Um atleta real do bh2 ficou 15 dias aprovado, pareado e PAGO, lendo
  // "Seu cadastro ainda está em análise pelo organizador". A aprovação são duas
  // escritas — o vínculo e a promoção da identidade global — e a segunda falhou
  // sozinha, sem deixar rastro em tela nenhuma. Ele perdeu o prazo da rodada 1.
  //
  // A porta deixou de ser `atletas.status` e passou a ser "é membro ATIVO de algum
  // circuito". Estas asserções RODAM o `login-atleta` de verdade: o que elas
  // protegem é comportamento, não a presença de um trecho de texto.
  const NOVO = "11111111-2222-3333-4444-555555555555";
  const ID = "atleta-da-porta";
  const TOKEN = "token-da-porta";
  const TEL = "31988887777";
  const sha = (t) => createHash("sha256").update(t).digest("hex");

  // `globalStatus` e `vinculo` variam de propósito: é o desencontro entre os dois
  // que o defeito produz, e nenhum teste que mexa só num deles o pegaria.
  const cenarioPorta = async ({ globalStatus, vinculo, circuitoAtivo = true, motivoRec = null, pinHash = null }) => {
    const { banco, motor } = await montarMotor({
      funcao: "login-atleta",
      circuitos: [circuito(NOVO, { slug: "novo", sistema: "B", ativo: circuitoAtivo })],
      atletas: [atleta(ID, { status: globalStatus, telefone: TEL, pin_hash: pinHash })],
      circuito_atletas: vinculo
        ? [{ circuito_id: NOVO, atleta_id: ID, status: vinculo, motivo_reprovacao: motivoRec }]
        : [],
      outras: {
        atleta_sessao: [{ id: "s1", atleta_id: ID, token_hash: sha(TOKEN),
                          expira_em: new Date(Date.now() + 3600e3).toISOString() }],
      },
    });
    return { banco, login: motor };
  };

  // ── 1. O CASO QUE ACONTECEU ──────────────────────────────────────────────
  {
    const { login } = await cenarioPorta({ globalStatus: "pendente", vinculo: "ativo" });
    const r = await login.chamar({ acao: "SESSAO", token: TOKEN });
    ok(r.corpo?.sucesso === true,
      `aprovado no circuito e "pendente" no global, o atleta ENTRA (veio: ${JSON.stringify(r.corpo?.erro ?? "ok")})`);
  }

  // ── 2. O DEFEITO SIMÉTRICO, que ninguém tinha visto ──────────────────────
  // Num circuito que não é o BH, suspender ou reprovar escreve no VÍNCULO e nunca
  // em `atletas.status`. Com a porta velha, o suspenso continuava entrando.
  for (const [vinculo, rotulo] of [["reprovado", "reprovado"], ["suspenso", "suspenso"], ["arquivado", "arquivado"]]) {
    const { login } = await cenarioPorta({ globalStatus: "ativo", vinculo });
    const r = await login.chamar({ acao: "SESSAO", token: TOKEN });
    igual(r.corpo?.erro, "cadastro_inativo",
      `${rotulo} no circuito NÃO entra, mesmo com a identidade global ativa`);
  }

  // ── 3. Sem vínculo nenhum: a porta fica fechada ──────────────────────────
  {
    const { login } = await cenarioPorta({ globalStatus: "ativo", vinculo: null });
    const r = await login.chamar({ acao: "SESSAO", token: TOKEN });
    igual(r.corpo?.erro, "cadastro_inativo",
      "quem não é membro de circuito nenhum não entra — nem com `atletas.status` ativo");
  }

  // ── 4. Circuito ENCERRADO não tranca o atleta para fora ──────────────────
  // Decisão deliberada: `temAcessoAoApp` NÃO filtra por `circuitos.ativo`. Quem
  // monta a lista do hub é `circuitosDoAtleta`, e essa sim filtra. São perguntas
  // diferentes: "pode entrar?" não é "o que ele vê quando entra?".
  {
    const { login } = await cenarioPorta({ globalStatus: "pendente", vinculo: "ativo", circuitoAtivo: false });
    const r = await login.chamar({ acao: "SESSAO", token: TOKEN });
    ok(r.corpo?.sucesso === true,
      `com o circuito encerrado o atleta ainda entra, para ver o próprio histórico (veio: ${JSON.stringify(r.corpo?.erro ?? "ok")})`);
  }

  // ── 5. O LOGIN passa a DIZER o veredito, em vez de a tela deduzir ────────
  {
    const hash = await pinGuardado("4321");
    const { login } = await cenarioPorta({ globalStatus: "pendente", vinculo: "ativo", pinHash: hash });
    const r = await login.chamar({ acao: "LOGIN", telefone: TEL, pin: "4321" });
    igual(r.corpo?.dados?.acesso?.ok, true,
      "o LOGIN devolve `acesso.ok = true` para quem tem vínculo ativo");
  }
  {
    const hash = await pinGuardado("4321");
    const { login } = await cenarioPorta({ globalStatus: "ativo", vinculo: "reprovado", motivoRec: "não compareceu", pinHash: hash });
    const r = await login.chamar({ acao: "LOGIN", telefone: TEL, pin: "4321" });
    igual(r.corpo?.dados?.acesso?.ok, false, "e `acesso.ok = false` para o reprovado");
    igual(r.corpo?.dados?.acesso?.motivo, "reprovado",
      "dizendo o MOTIVO vindo do vínculo — a tela não tem mais o que adivinhar");
    igual(r.corpo?.dados?.acesso?.detalhe, "não compareceu",
      "e o motivo escrito pelo organizador chega junto, para o atleta saber por quê");
  }

  // ── 5b. A LÁPIDE FECHA MESMO COM VÍNCULO ATIVO ──────────────────────────
  // `status "arquivado"` + telefone "removido:" é um cadastro ANONIMIZADO. O
  // `INSCRICAO_VALIDAR` consegue reativar o VÍNCULO de alguém assim (ele escreve
  // em circuito_atletas, e a promoção global se recusa a ressuscitar). Se a porta
  // só perguntasse pelo vínculo, aprovar um anonimizado na fila reabriria o acesso
  // dele. Foi exatamente o que esta mudança quase fez.
  for (const [ident, rotulo] of [
    [{ globalStatus: "arquivado", tel: TEL }, "arquivado"],
    [{ globalStatus: "ativo", tel: "removido:atleta-da-porta" }, "anonimizado (telefone removido)"],
  ]) {
    const { banco, motor } = await montarMotor({
      funcao: "login-atleta",
      circuitos: [circuito(NOVO, { slug: "novo", sistema: "B" })],
      atletas: [atleta(ID, { status: ident.globalStatus, telefone: ident.tel, pin_hash: null })],
      circuito_atletas: [{ circuito_id: NOVO, atleta_id: ID, status: "ativo" }],
      outras: {
        atleta_sessao: [{ id: "s1", atleta_id: ID, token_hash: sha(TOKEN),
                          expira_em: new Date(Date.now() + 3600e3).toISOString() }],
      },
    });
    const r = await motor.chamar({ acao: "SESSAO", token: TOKEN });
    igual(r.corpo?.erro, "cadastro_inativo",
      `cadastro ${rotulo} NÃO entra, nem com o vínculo do circuito ativo`);
  }

  // ── 5bis. O `DEFAULT` DA COLUNA É PARTE DA PORTA AGORA ───────────────────
  // Condição C2 do Guardião de Segurança, 15/11/2026, e o raciocínio é dele:
  // esta onda PROMOVEU `circuito_atletas.status` a estado de autenticação do app.
  // E existe caminho ANÔNIMO que insere linha nessa tabela — ele provou rodando:
  // `RENOVAR` no `athlete-action` fabrica vínculo em circuito alheio, sem token e
  // sem PIN, respondendo 200. Isso NÃO abre a porta hoje por um motivo só: a
  // coluna tem `DEFAULT 'pendente'` em produção (medido), e `pendente` não entra.
  // Ou seja: a porta está a um DEFAULT de distância de ser forçável.
  // ⚠️ EU ESCREVI AQUI QUE "agora prende" E ERA FALSO. O Supervisor de Segurança
  // mediu: esta asserção guarda o lado CONSUMIDOR (que a porta exige 'ativo') e
  // deixa solto o PRODUTOR — acrescentar `status: "ativo"` ao `RENOVAR` passava
  // VERDE. Afirmação sem a medição que a sustenta é a regra 6 do CLAUDE.md, e eu
  // a violei no comentário que explicava justamente esse risco. O que fecha o
  // produtor está na 5bis-B, logo abaixo.
  // O conserto do `RENOVAR` (exigir token + vínculo) está no ROADMAP 1.3b.
  {
    const { login } = await cenarioPorta({ globalStatus: "ativo", vinculo: "pendente" });
    const r = await login.chamar({ acao: "SESSAO", token: TOKEN });
    igual(r.corpo?.erro, "cadastro_inativo",
      "vínculo no DEFAULT da coluna ('pendente') NÃO abre a porta — linha fabricada não vira acesso");
  }

  // O caso REAL de produção, que não tinha teste: 10 dos 15 atletas estão em DOIS
  // circuitos. Arquivar num deles não pode trancar o outro — é a decisão acima,
  // agora exercitada no estado que de fato existe.
  {
    const OUTRO = "cccccccc-dddd-eeee-ffff-000000000000";
    const { motor } = await montarMotor({
      funcao: "login-atleta",
      circuitos: [circuito(NOVO, { slug: "origem", sistema: "B" }), circuito(OUTRO, { slug: "outro", sistema: "B" })],
      atletas: [atleta(ID, { status: "ativo", telefone: TEL, pin_hash: null })],
      circuito_atletas: [
        { circuito_id: NOVO, atleta_id: ID, status: "arquivado" },
        { circuito_id: OUTRO, atleta_id: ID, status: "ativo" },
      ],
      outras: { atleta_sessao: [{ id: "s1", atleta_id: ID, token_hash: sha(TOKEN),
                                  expira_em: new Date(Date.now() + 3600e3).toISOString() }] },
    });
    const r = await motor.chamar({ acao: "SESSAO", token: TOKEN });
    ok(r.corpo?.sucesso === true,
      `arquivado num circuito e ativo noutro: ENTRA — sanção de circuito não tranca a plataforma (veio: ${JSON.stringify(r.corpo?.erro ?? "ok")})`);
  }

  // ── 5bis-B. O QUE REALMENTE SEGURA A PORTA CONTRA A LINHA FABRICADA ──────
  // O Supervisor de Segurança provou que a 5bis guarda só o lado CONSUMIDOR
  // (que a porta exige 'ativo'). O lado PRODUTOR ficava solto: acrescentar
  // `status: "ativo"` ao `updRenovar` do `RENOVAR` — a edição de UMA LINHA que
  // converte o defeito anônimo em acesso forjado — deixava a bateria VERDE.
  //
  // ⚠️ E A MINHA PRIMEIRA TENTATIVA DE CONSERTO TAMBÉM ERA FURADA, pela razão que
  // esta casa repete desde 19/09/2026: eu prendi o invariante com REGEX no fonte
  // (`!/\bstatus\s*:/`), e regex não vê fluxo de dado. Ele mediu e me devolveu uma
  // segunda mutação, mais plausível que a primeira — um spread do payload:
  //     const updRenovar = { quer_renovar, renovacao_em, ...(payload.camposExtra || {}) };
  // Nenhum `status:` literal no corpo ⇒ a regex passava VERDE ⇒ e o exploit
  // anônimo rodava de ponta a ponta: 200, linha com `status:"ativo"`, porta
  // ABERTA. Pior que a primeira, porque entrega o `status` AO ATACANTE — derruba
  // a própria premissa em que a severidade de M1 se apoiava.
  //
  // A lição, e é a generalização que faltava: **não se enumera mutação, se asserta
  // o invariante contra entrada adversária.** O teste abaixo manda o payload
  // hostil tentando injetar `status` por todo canal plausível e exige que a linha
  // fabricada NÃO tenha a chave. Fica vermelho nas DUAS mutações.
  {
    const ALHEIO = "dddddddd-eeee-ffff-0000-111111111111";
    const { banco, motor: aa } = await montarMotor({
      funcao: "athlete-action",
      // O `circuito(BH)` é obrigatório aqui: o `writeAtleta` chama `bhId()`, que
      // procura o circuito de slug "bh". Sem ele a ação morre antes de chegar na
      // escrita, e as três asserções abaixo ficariam vermelhas pelo motivo errado
      // — que é a armadilha do fixture que não espelha a produção.
      circuitos: [circuito(BH),
                  circuito(NOVO, { slug: "origem", sistema: "B" }),
                  circuito(ALHEIO, { slug: "alheio", sistema: "B" })],
      atletas: [atleta(ID, { status: "ativo", telefone: TEL })],
      circuito_atletas: [{ circuito_id: NOVO, atleta_id: ID, status: "ativo" }],
      outras: { atleta_sessao: [] },
    });
    // SEM token e SEM PIN — é assim que o `RENOVAR` é alcançável hoje (ROADMAP 1.3d).
    const r = await aa.chamar({ acao: "RENOVAR", payload: {
      circuitoId: ALHEIO, athleteId: ID, quer: true,
      status: "ativo",                    // injeção direta
      camposExtra: { status: "ativo" },   // pass-through
      campos:      { status: "ativo" },   // idem, outro nome
    }});
    ok(r.corpo?.sucesso === true,
      "(contexto: o RENOVAR anônimo responde sucesso hoje — é o defeito do ROADMAP 1.3d, não desta onda)");
    const linha = banco.acha("circuito_atletas", x => x.atleta_id === ID && x.circuito_id === ALHEIO);
    ok(!!linha, "(e fabrica mesmo a linha em circuito alheio — medido, não deduzido)");
    ok(!("status" in (linha || {})),
      "o RENOVAR anônimo NÃO escreve `status` no vínculo, nem com o payload tentando injetá-lo por três canais — é só isso que impede a linha fabricada de nascer 'ativo' e virar acesso");
  }

  // ── 5bis-C. A PORTA IGNORA `pendente_circuito`, E ISSO É DE PROPÓSITO ────
  // Levantado pelo Supervisor de Segurança: `pendente_circuito` não aparecia em
  // asserção nenhuma, e em produção há 2 linhas com `status:'ativo'` +
  // `pendente_circuito:true` (medido em 15/11: dois atletas do BH).
  // Elas são o BACKLOG: gente APROVADA esperando vaga. Deixá-las entrar é o
  // comportamento certo, e o `admin-action:321` já diz isso por escrito — "o
  // login-atleta so olha `status` (nunca `pendente_circuito`), entao o atleta
  // continua entrando no app, que era o ponto da promocao".
  // Estava certo e não estava protegido: quem "limpasse" a porta acrescentando o
  // campo trancaria o backlog inteiro para fora sem nenhum teste reclamar.
  {
    const { login } = await cenarioPorta({ globalStatus: "ativo", vinculo: "ativo" });
    const r = await login.chamar({ acao: "SESSAO", token: TOKEN });
    ok(r.corpo?.sucesso === true, "vínculo ativo entra (controle)");

    const { banco, login: l2 } = await cenarioPorta({ globalStatus: "ativo", vinculo: "ativo" });
    banco.tabelas.circuito_atletas[0].pendente_circuito = true;
    const r2 = await l2.chamar({ acao: "SESSAO", token: TOKEN });
    ok(r2.corpo?.sucesso === true,
      `e o APROVADO ESPERANDO VAGA (pendente_circuito) entra igual — a porta ignora esse campo de propósito (veio: ${JSON.stringify(r2.corpo?.erro ?? "ok")})`);
  }

  // ── 5c. O PARTICIPAR TAMBÉM PASSOU PELA PORTA — e esta é a asserção que
  //        FALTAVA. O Supervisor de Confiabilidade sabotou a guarda do PARTICIPAR
  //        (`login-atleta:405`) de volta para `a.status !== "ativo"` e a bateria
  //        inteira ficou VERDE: nenhuma das 11 mutações desta onda tocava aquela
  //        linha. Guarda sem mutação vermelha é guarda sem proteção — é a regra
  //        da casa, e eu a tinha cumprido só na metade do SESSAO.
  {
    const ALVO = "77777777-8888-9999-aaaa-bbbbbbbbbbbb";
    const pedidoParticipar = {
      acao: "PARTICIPAR", telefone: TEL, pin: "4321",
      circuitoId: ALVO,
      aceiteRegulamento: true, versaoRegulamento: "vB-01", aceiteLGPD: true,
      cpf: "52998224725", cpfConsent: true, cpfConsentVersao: "cpf-2026-08-v1",
      dataNascimento: "1990-01-01",
    };
    const cenarioParticipar = async ({ globalStatus, vinculo }) => {
      const hash = await pinGuardado("4321");
      const { motor } = await montarMotor({
        funcao: "login-atleta",
        circuitos: [
          circuito(NOVO, { slug: "origem", sistema: "B" }),
          circuito(ALVO, { slug: "alvo", sistema: "B", regulamento_versao: "vB-01",
                           inscricoes_abertas: true, ativo: true }),
        ],
        atletas: [atleta(ID, { status: globalStatus, telefone: TEL, pin_hash: hash })],
        circuito_atletas: [{ circuito_id: NOVO, atleta_id: ID, status: vinculo }],
        funcoes: {
          get_cpf_pepper: () => "pimenta-de-teste",
          dedup_por_cpf_hash: () => [{ existe: false, atleta_id: null }],
        },
        outras: { atleta_documento: [], tentativas_busca_cpf: [], atleta_sessao: [] },
      });
      return motor;
    };

    // A porta ABRE: vínculo ativo, global "pendente" (o caso do atleta real).
    // Com a guarda velha isto era 403 `cadastro_inativo`.
    {
      const m = await cenarioParticipar({ globalStatus: "pendente", vinculo: "ativo" });
      const r = await m.chamar(pedidoParticipar);
      ok(r.corpo?.erro !== "cadastro_inativo",
        `o PARTICIPAR deixa passar quem tem vínculo ativo, mesmo com o global "pendente" (veio: ${JSON.stringify(r.corpo?.erro ?? "ok")})`);
    }

    // A porta FECHA: global "ativo", vínculo que não é ativo. Com a guarda velha
    // estes TRÊS passavam — era o buraco simétrico, e ninguém o tinha visto.
    for (const vinculo of ["suspenso", "reprovado", "arquivado"]) {
      const m = await cenarioParticipar({ globalStatus: "ativo", vinculo });
      const r = await m.chamar(pedidoParticipar);
      igual(r.corpo?.erro, "cadastro_inativo",
        `e recusa quem está ${vinculo} no circuito, mesmo com a identidade global ativa`);
    }
  }

  // ── 6. A PORTA DO ORGANIZADOR NÃO MUDOU, e isso é de propósito ───────────
  // Organizador pode não ser atleta de circuito nenhum. Se alguém um dia trocar
  // esta porta pela nova, o painel dele fecha — e esta asserção fica vermelha.
  {
    const hash = await pinGuardado("4321");
    const { login } = await cenarioPorta({ globalStatus: "pendente", vinculo: "ativo", pinHash: hash });
    const r = await login.chamar({ acao: "LOGIN_ORGANIZADOR", telefone: TEL, pin: "4321" });
    igual(r.corpo?.erro, "cadastro_inativo",
      "o LOGIN_ORGANIZADOR continua olhando o status GLOBAL — vínculo de atleta não é papel de organizador");
  }

  // ── 7. Fail-closed: dúvida não abre porta — RODANDO, não por fonte ───────
  // ⚠️ A PRIMEIRA VERSÃO DESTA ASSERÇÃO ERA DE FONTE, e a justificativa escrita
  // nela era FALSA: eu afirmei que "o banco em memória não simula falha de
  // consulta, então não dá para provar o `throw` rodando". Dá. O `banco.recusar`
  // existe desde sempre em `banco-falso.mjs` e faz exatamente isso. O Guardião de
  // Segurança provou rodando, em 15/11/2026, e me devolveu com a regra da casa na
  // mão: "se a asserção é regex, ela não protege a regra — só registra que um
  // trecho de texto está lá". Eu tinha escrito a desculpa em vez de procurar o
  // mecanismo. A asserção de forma continua abaixo, mas agora ela é o complemento.
  {
    const { banco, login } = await cenarioPorta({ globalStatus: "ativo", vinculo: "ativo" });
    banco.recusar("circuito_atletas", "select", { message: "connection reset", code: "08006" });
    const r = await login.chamar({ acao: "SESSAO", token: TOKEN });
    ok(r.status >= 500,
      `consulta da porta que FALHA derruba a ação (${r.status}) em vez de deixar entrar`);
    ok(r.corpo?.sucesso !== true,
      "e nunca responde sucesso — dúvida não abre porta");
  }
  {
    const fonteLogin = semComentarios(readFileSync("supabase/functions/login-atleta/index.ts", "utf-8"));
    const iPorta = fonteLogin.indexOf("async function temAcessoAoApp");
    ok(iPorta > 0, "a função da porta existe no fonte");
    const corpoPorta = fonteLogin.slice(iPorta, fonteLogin.indexOf("\n}", iPorta));
    ok(corpoPorta.includes("if (error) throw error;"),
      "e ela é fail-closed: consulta que falha derruba a ação em vez de devolver `false` calado");
    ok(!corpoPorta.includes('from("circuitos")'),
      "e não consulta a tabela `circuitos` — encerrar um circuito não pode trancar o atleta fora do app");
  }
}

secao("W.O. DUPLO — ninguém jogou, ninguém ganha (vB-01 Cap. 07) — RODANDO o motor");
{
  // Pedido do Juliano em 15/11/2026, depois de a rodada 1 do bh2 vencer com 4 dos
  // 5 jogos sem placar: "quero poder marcar W.O duplo e os dois atletas ficar com
  // zero pontos em uma rodada".
  //
  // NÃO É REGRA NOVA — e é por isso que não precisou de re-aceite. O vB-01
  // Cap. 07 já traz na tabela de pontos "Ambos injustificados | 0 | 0", e ainda
  // diz: "Partida não registrada no prazo: sem comprovação vira duplo
  // injustificado (0/0)". O app é que não cumpria: os três tipos antigos
  // (justificado, culposo, a_favor) EXIGEM um beneficiário, então não existia
  // forma de registrar que ninguém apareceu. A tela refletia a limitação do
  // motor, não uma decisão.
  const CD = "aa11bb22-cc33-dd44-ee55-ff6677889900";
  const A1 = "atleta-um", A2 = "atleta-dois";

  const cenarioDuplo = async (sistema) => {
    const cid = sistema === "B" ? CD : BH;
    return montarMotor({
      circuitos: [
        circuito(BH, { regulamento_versao: "v03-13" }),
        circuito(CD, { slug: "pontos-duplo", sistema: "B", pareamento: "sorteio",
                       regulamento_versao: "vB-01", fase: "etapa" }),
      ],
      atletas: [atleta(A1, { rating: 500 }), atleta(A2, { rating: 500 })],
      circuito_atletas: [
        { circuito_id: cid, atleta_id: A1, status: "ativo", saldo_temp: 0, vitorias: 0, derrotas: 0 },
        { circuito_id: cid, atleta_id: A2, status: "ativo", saldo_temp: 0, vitorias: 0, derrotas: 0 },
      ],
      partidas: [partida("jd", { circuito_id: cid, atleta1_id: A1, atleta2_id: A2, rodada: 1 })],
    });
  };
  const doCirc = (banco, id) => banco.acha("circuito_atletas", c => c.circuito_id === CD && c.atleta_id === id);

  // ── 1. O registro em si ──────────────────────────────────────────────────
  {
    const { banco, motor } = await cenarioDuplo("B");
    const r = await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jd", tipo: "duplo_culposo" });
    ok(r.corpo?.sucesso === true,
      `o organizador registra o W.O. duplo sem apontar faltoso nem beneficiário (erro: ${JSON.stringify(r.corpo?.erro)})`);
    const m = banco.acha("partidas", x => x.id === "jd");
    igual(m?.wo_tipo, "duplo_culposo", "a partida fica marcada como duplo");
    igual(m?.wo_faltoso_id, null, "e NÃO aponta faltoso — apontar um dos dois seria mentira");
    igual(m?.wo_beneficiario_id, null, "nem beneficiário — ninguém ganhou a partida");
  }

  // ── 2. A falta conta para OS DOIS ────────────────────────────────────────
  // Sem isto o duplo sairia de graça: zero ponto para os dois, mas nenhum dos dois
  // acumulando o injustificado que leva à suspensão (Cap. 07) e que é o 2º critério
  // de desempate (Cap. 09). Faltar os dois viraria a jogada barata.
  {
    const { banco, motor } = await cenarioDuplo("B");
    await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jd", tipo: "duplo_culposo" });
    igual(doCirc(banco, A1)?.wo_culposos_temporada, 1, "o primeiro atleta leva 1 W.O. injustificado");
    igual(doCirc(banco, A2)?.wo_culposos_temporada, 1, "e o segundo também — faltar os dois não sai de graça");

    // idempotente: dois cliques não suspendem ninguém
    await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jd", tipo: "duplo_culposo" });
    igual(doCirc(banco, A1)?.wo_culposos_temporada, 1, "aplicar de novo continua contando 1 (o primeiro)");
    igual(doCirc(banco, A2)?.wo_culposos_temporada, 1, "e 1 (o segundo)");
  }

  // ── 3. OS PONTOS — que é o que o Juliano pediu ───────────────────────────
  {
    const { banco, motor } = await cenarioDuplo("B");
    await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jd", tipo: "duplo_culposo" });
    const rp = await comoAdmin(motor, "PROCESSAR_RODADA", { circuitoId: CD, round: 1 });
    ok(rp.corpo?.sucesso === true, `a rodada processa (erro: ${JSON.stringify(rp.corpo?.erro)})`);
    igual(doCirc(banco, A1)?.saldo_temp, 0, "o primeiro atleta fica com ZERO ponto");
    igual(doCirc(banco, A2)?.saldo_temp, 0, "o segundo atleta fica com ZERO ponto");
    igual(doCirc(banco, A1)?.vitorias, 0, "e ninguém leva vitória — não houve vencedor");
    igual(doCirc(banco, A2)?.vitorias, 0, "nem o outro");
    igual(doCirc(banco, A1)?.derrotas, 1, "os dois levam derrota (o jogo existiu e não foi jogado)");
    igual(doCirc(banco, A2)?.derrotas, 1, "os dois, não só um");
  }

  // ── 4. CORRIGIR um W.O. simples para duplo não deixa falta órfã ──────────
  {
    const { banco, motor } = await cenarioDuplo("B");
    await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jd", tipo: "culposo", faltosoId: A1, beneficiarioId: A2 });
    igual(doCirc(banco, A1)?.wo_culposos_temporada, 1, "primeiro o organizador marca só o A1 como faltoso");
    await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jd", tipo: "duplo_culposo" });
    igual(doCirc(banco, A1)?.wo_culposos_temporada, 1,
      "ao corrigir para duplo, o A1 continua com 1 — não vira 2 por ter sido reclassificado");
    igual(doCirc(banco, A2)?.wo_culposos_temporada, 1, "e o A2 passa a ter a dele");
  }

  // ── 4b. O DUPLO SEGURA A RODADA SEGUINTE, como qualquer W.O. ────────────
  // ⚠️ ESTA ASSERÇÃO NASCEU DE UMA MUTAÇÃO VERDE. O motor varre os W.O. em DOIS
  // lugares: um busca os da rodada a processar, outro é a GUARDA que recusa
  // processar uma rodada par com a ímpar anterior ainda pendente. Eu acrescentei
  // `duplo_culposo` aos dois e testei a mutação só no conjunto — tirar o tipo da
  // SEGUNDA varredura ficava vermelho, e da PRIMEIRA ficava VERDE.
  // Sem isto, um duplo pendente na rodada 1 não impediria a rodada 2 de ser
  // processada: as duas rodadas do mês sairiam fora de ordem, e o Cap. 07 do
  // vB-01 depende de a 1ª estar fechada. É a lição da fatia 0.6.21 outra vez —
  // contar os pontos de uso, não só o corpo da função.
  {
    const { motor } = await montarMotor({
      circuitos: [
        circuito(BH, { regulamento_versao: "v03-13" }),
        circuito(CD, { slug: "pontos-duplo", sistema: "B", pareamento: "sorteio",
                       regulamento_versao: "vB-01", fase: "etapa" }),
      ],
      atletas: [atleta(A1, { rating: 500 }), atleta(A2, { rating: 500 })],
      circuito_atletas: [
        { circuito_id: CD, atleta_id: A1, status: "ativo", saldo_temp: 0, vitorias: 0, derrotas: 0 },
        { circuito_id: CD, atleta_id: A2, status: "ativo", saldo_temp: 0, vitorias: 0, derrotas: 0 },
      ],
      partidas: [
        partida("jr1", { circuito_id: CD, atleta1_id: A1, atleta2_id: A2, rodada: 1 }),
        partida("jr2", { circuito_id: CD, atleta1_id: A1, atleta2_id: A2, rodada: 2,
                         placar1: 3, placar2: 1, validado: true }),
      ],
    });
    await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jr1", tipo: "duplo_culposo" });
    const r = await comoAdmin(motor, "PROCESSAR_RODADA", { circuitoId: CD, round: 2 });
    ok(r.corpo?.sucesso !== true,
      "com um W.O. duplo pendente na rodada 1, a rodada 2 NÃO processa");
    igual(r.status, 409, "e a recusa é explícita (409), não um sucesso que pula a rodada anterior");
  }

  // ── 4d. A MESMA PARTIDA NÃO PODE SER CONTADA DUAS VEZES ─────────────────
  // ⛔ Medido pelo Supervisor de Confiabilidade em 15/11/2026, RODANDO o motor —
  // o guardião tinha apontado por leitura e marcado como "não medido"; a medição
  // mostrou que era pior: alcançável só com o `admin-action`, sem depender do
  // `athlete-action`. Com um duplo registrado numa partida que ficou
  // `validado: true` com placar, o `PROCESSAR_RODADA` devolvia `processadas: 2` —
  // a partida entrava em `pendentes` (pelo placar) E em `wos` (pelo W.O.), e cada
  // conjunto a pontuava: A1 saldo 2 / 1V / 1D, A2 saldo 1 / 2D.
  //
  // NÃO é defeito do duplo: existe para `culposo`/`a_favor` desde sempre (jogo
  // 2x1 + culposo depois = A1 4, A2 4). O duplo AGRAVA, porque a segunda contagem
  // soma derrota aos dois. E era alcançável pelo caminho que o próprio ROADMAP
  // recomendava como saída ("o organizador imputa o resultado à mão").
  //
  // A regra: partida com W.O. registrado tem o resultado decidido pelo W.O.,
  // nunca pelo placar.
  {
    const { banco, motor } = await cenarioDuplo("B");
    // o estado exato que o supervisor reproduziu: placar validado E duplo
    const pd = banco.tabelas.partidas.find(x => x.id === "jd");
    pd.placar1 = 3; pd.placar2 = 0; pd.validado = true;
    await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jd", tipo: "duplo_culposo" });
    const rp = await comoAdmin(motor, "PROCESSAR_RODADA", { circuitoId: CD, round: 1 });
    igual(rp.corpo?.dados?.processadas, 1,
      "partida com placar validado E W.O. é processada UMA vez, não duas");
    igual(doCirc(banco, A1)?.saldo_temp, 0, "o primeiro atleta fica com 0 — o W.O. manda, não o placar");
    igual(doCirc(banco, A2)?.saldo_temp, 0, "o segundo também");
    igual(doCirc(banco, A1)?.vitorias, 0, "e ninguém leva a vitória que o placar daria");
    igual(doCirc(banco, A1)?.derrotas, 1, "uma derrota para cada, não duas");
    igual(doCirc(banco, A2)?.derrotas, 1, "uma, não duas");
  }
  // O mesmo vale para o W.O. SIMPLES, que é onde o defeito nasceu — e isto prende
  // o conserto para os quatro tipos, não só para o que esta onda criou.
  {
    const { banco, motor } = await cenarioDuplo("B");
    const pd = banco.tabelas.partidas.find(x => x.id === "jd");
    pd.placar1 = 3; pd.placar2 = 1; pd.validado = true;
    await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jd", tipo: "culposo", faltosoId: A1, beneficiarioId: A2 });
    await comoAdmin(motor, "PROCESSAR_RODADA", { circuitoId: CD, round: 1 });
    igual(doCirc(banco, A1)?.saldo_temp, 0, "W.O. culposo sobre partida já validada: o faltoso fica com 0, não soma o placar");
    igual(doCirc(banco, A2)?.saldo_temp, 2, "e o beneficiário fica com os 2 do W.O., não 2+2");
  }

  // ── 4e. O INSTRUMENTO: `neq` e NULL, que quase deixou passar o pior ─────
  // 🔴 Achado pelo Supervisor de Regulamento em 15/11/2026, e não no código da
  // onda — no BANCO FALSO. `case "neq": return a !== b;` devolvia `true` para
  // coluna nula, MANTENDO a linha. O Postgres faz o oposto: `coluna <> 'x'` com a
  // coluna NULL avalia NULL e a linha é DESCARTADA.
  // Consequência se alguém escrevesse `.neq("wo_tipo", "duplo_culposo")` na
  // consulta do `PROCESSAR_RODADA` — que é uma forma natural de tentar consertar
  // a contagem dupla: a bateria ficaria VERDE e, em produção, NENHUMA partida
  // normal pontuaria nunca mais, em circuito nenhum, porque `wo_tipo` é NULL nas
  // 44 partidas que existem. O instrumento aprovaria a mudança que derruba o
  // ranking inteiro.
  // Esta asserção prende o operador, não a onda.
  {
    const { banco } = await cenarioDuplo("B");
    const todas = banco.linhas("partidas").length;
    const comNeq = await banco.cliente.from("partidas").select("*").neq("wo_tipo", "duplo_culposo");
    igual((comNeq.data || []).length, 0,
      "`neq` sobre coluna NULA não devolve a linha — é assim que o Postgres responde, e o banco falso dizia o contrário");
    ok(todas > 0, "(e o cenário tinha partida para devolver, então o zero acima não é cenário vazio)");

    // o espelho: com valor preenchido, o `neq` continua filtrando como sempre
    banco.tabelas.partidas[0].wo_tipo = "culposo";
    const r2 = await banco.cliente.from("partidas").select("*").neq("wo_tipo", "duplo_culposo");
    igual((r2.data || []).length, 1,
      "e com a coluna PREENCHIDA o `neq` continua funcionando — o conserto não cegou o operador");
  }

  // ── 5. O SISTEMA A RECUSA, e a recusa é fail-closed ──────────────────────
  // ⚠️ EU ESCREVI AQUI QUE "o v03-13 NÃO define o caso de ambos ausentes" E ERA
  // FALSO. O Guardião de Regulamento abriu o documento e achou a regra em três
  // lugares (`v03-13:194`, `:200`, `:202`, `:205`); a mais literal: "se nenhum
  // dos dois procurou o outro para marcar … é responsabilidade compartilhada e a
  // rodada é anulada para os dois (ninguém pontua)".
  // A RECUSA CONTINUA CERTA, e por uma razão mais forte: o Sistema A tem resposta
  // própria e DIFERENTE — anular (sem ponto e sem rating) contra o 0/0 COM falta
  // injustificada do Sistema B. Copiar o comportamento do B para o A inventaria
  // penalidade que o v03-13 não prevê. E o caminho do A já existe: o
  // `tipo="justificado"` lá grava `rejeitado: true`, que é a anulação.
  // O BH é Sistema A, e a regra 2 do CLAUDE.md diz que ele nunca é prejudicado.
  {
    const { banco, motor } = await cenarioDuplo("A");
    const r = await comoAdmin(motor, "APLICAR_WO", { circuitoId: BH, matchId: "jd", tipo: "duplo_culposo" });
    ok(r.corpo?.sucesso !== true, "no Sistema A o W.O. duplo é RECUSADO");
    igual(r.status, 409, "com 409, e não com um sucesso silencioso");
    // A MENSAGEM É O QUE O ORGANIZADOR LÊ, e ela já esteve errada: afirmava que o
    // regulamento "não prevê os dois ausentes", o que é falso. Agora tem de dizer
    // o que o v03-13 manda fazer E apontar o botão que faz isso — recusa que não
    // nomeia o remédio é beco sem saída.
    const msg = String(r.corpo?.erro || "");
    ok(/anular/i.test(msg),
      "e a mensagem diz o que o regulamento do Sistema A manda: ANULAR a rodada");
    ok(/Justificado \(anula\)/.test(msg),
      "e aponta o botão que já faz isso — recusa sem remédio é beco sem saída");
    ok(!/não prev[êe]/i.test(msg),
      "e NÃO afirma que o regulamento é omisso, porque ele não é (v03-13 :194, :200, :202, :205)");
    // ⚠️ E AVISA DO BECO. Exigido pelo Supervisor de Regulamento em 18/11/2026: a
    // mensagem manda usar o "Justificado (anula)", que é justamente o ÚNICO tipo
    // de W.O. sem botão de desfazer na tela (ROADMAP 1.3o — o botão vive na lista
    // `woPendente`, que filtra `!rejeitado`). Numa onda cujo título é "agora dá
    // para desfazer", empurrar alguém para o caminho sem volta sem dizer isso
    // seria o app prometendo o que não entrega.
    ok(/desfazer/i.test(msg),
      "e avisa que a anulação ainda NÃO tem botão de desfazer — senão a recusa empurra o organizador para o único caminho sem volta");
    igual(banco.acha("partidas", x => x.id === "jd")?.wo_tipo, null,
      "e a partida do BH fica intocada — recusa que grava metade é pior que recusa nenhuma");
  }

  // ── 4c. CORRIGIR O DUPLO DE VOLTA NÃO DEIXA FALTA FANTASMA ──────────────
  // ⛔ ESTA SEÇÃO NASCEU DE UM NO-GO, e o defeito era MEU, introduzido por esta
  // onda. O `recontarEnvolvidos` PERSEGUIA o `wo_faltoso_id` anterior — e o duplo
  // grava esse campo como `null` de propósito. Resultado: corrigir um duplo de
  // volta para um W.O. simples recontava só o novo faltoso, e o OUTRO atleta
  // ficava com um W.O. injustificado FANTASMA. Esse número é o que SUSPENDE
  // (Cap. 07, dois injustificados) e o que ordena o 2º desempate (Cap. 09).
  // Medido pelo Guardião de Regulamento nas três transições; alcançável em um
  // clique no bh2 — a rodada 1 tem UMA partida sem placar, então corrigir um
  // duplo é o movimento natural.
  //
  // A asserção é de INVARIANTE, não de enumeração — é a regra que esta casa tirou
  // da onda da porta: o contador de cada atleta tem de bater com o que as
  // PARTIDAS dizem, independentemente de por qual transição se chegou lá.
  {
    // A verdade derivada das partidas: quantos injustificados cada atleta tem.
    const injustificadosPelasPartidas = (banco, id) =>
      banco.linhas("partidas").filter(m =>
        m.circuito_id === CD && !m.rejeitado && (
          ((m.wo_tipo === "culposo" || m.wo_tipo === "a_favor") && m.wo_faltoso_id === id) ||
          (m.wo_tipo === "duplo_culposo" && (m.atleta1_id === id || m.atleta2_id === id))
        )).length;

    const conferirInvariante = async (rotulo, segundaChamada) => {
      const { banco, motor } = await cenarioDuplo("B");
      await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jd", tipo: "duplo_culposo" });
      await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jd", ...segundaChamada });
      for (const [id, nome] of [[A1, "o primeiro"], [A2, "o segundo"]]) {
        igual(doCirc(banco, id)?.wo_culposos_temporada, injustificadosPelasPartidas(banco, id),
          `${rotulo}: ${nome} atleta fica com o número que as PARTIDAS dizem — sem falta fantasma`);
      }
    };

    await conferirInvariante("duplo → culposo", { tipo: "culposo", faltosoId: A1, beneficiarioId: A2 });
    await conferirInvariante("duplo → justificado", { tipo: "justificado", faltosoId: A1, beneficiarioId: A2 });
    await conferirInvariante("duplo → a_favor", { tipo: "a_favor", beneficiarioId: A2 });

    // E o caso concreto que o guardião mediu, dito em número para quem ler depois.
    {
      const { banco, motor } = await cenarioDuplo("B");
      await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jd", tipo: "duplo_culposo" });
      await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jd", tipo: "culposo", faltosoId: A1, beneficiarioId: A2 });
      igual(doCirc(banco, A1)?.wo_culposos_temporada, 1, "corrigido para culposo, só o A1 tem a falta");
      igual(doCirc(banco, A2)?.wo_culposos_temporada, 0,
        "e o A2 fica com ZERO — era aqui que sobrava a falta fantasma que suspenderia alguém sem motivo");
    }
  }

  // ── 5bis. A TELA SABE QUE O DUPLO É UMA PARTIDA RESOLVIDA — EXECUTANDO ──
  // ⚠️ ESTA SEÇÃO NASCEU DE UM NO-GO. O Guardião de Confiabilidade aprovou o
  // motor e BARROU a tela: o `ehWo` dela listava só `culposo` e `a_favor`, então
  // uma partida gravada como duplo voltava do banco, caía em "Resultado
  // Incompleto" E ENTRAVA no `naoResolvidos`, que é a conta que TRAVA o botão de
  // processar a rodada. O motor gravava certo e o organizador não conseguia
  // fechar a rodada. Feature que parece pronta e não termina o trabalho.
  //
  // E a razão de ninguém ter visto: as 8 sabotagens daquela leva eram todas no
  // MOTOR. Nenhuma asserção tocava o `ehWo`, então sabotá-lo não deixava nada
  // vermelho. Regex no fonte também não serviria (regra da casa, 19/09/2026) —
  // por isso esta asserção EXTRAI a função e a EXECUTA, que é a técnica das
  // quatro condições do CLAUDE.md: `ehWo` é pura (recebe uma partida, devolve
  // booleano), não fecha sobre nada, e a âncora é a declaração inteira.
  {
    const marca = "const ehWo = ";
    const i = fonteSemComentario.indexOf(marca);
    ok(i > 0, "o `ehWo` da tela foi localizado");
    const fim = fonteSemComentario.indexOf(";", i);
    const expr = fonteSemComentario.slice(i + marca.length, fim);
    const ehWo = new Function("return " + expr)();

    ok(ehWo({ woTipo: "duplo_culposo" }) === true,
      "RODANDO o `ehWo`: a partida de W.O. DUPLO conta como RESOLVIDA — sem isto ela trava o botão de processar a rodada");
    ok(ehWo({ woTipo: "culposo" }) === true, "e o culposo continua resolvido");
    ok(ehWo({ woTipo: "a_favor" }) === true, "e o a_favor também");
    ok(ehWo({ woTipo: "justificado" }) === true,
      "e o justificado também — no Sistema B ele NÃO rejeita a partida, então sem isto caía na mesma armadilha (defeito irmão, anterior a esta onda)");
    ok(ehWo({ woTipo: null }) === false, "e partida SEM W.O. continua pendente — a conta não pode liberar tudo");
    ok(ehWo({}) === false, "nem a partida sem o campo");

    // As duas cópias da regra têm de dizer a mesma coisa. Elas vivem em
    // componentes diferentes e já divergiram antes.
    const marcaCal = "const ehWoCal = ";
    const j = fonteSemComentario.indexOf(marcaCal);
    ok(j > 0, "o `ehWoCal` do lembrete de calendário foi localizado");
    const exprCal = fonteSemComentario.slice(j + marcaCal.length, fonteSemComentario.indexOf(";", j));
    igual(exprCal.trim(), expr.trim(),
      "e as DUAS cópias da regra são idênticas — divergir faz o lembrete do calendário contar rodada que já está resolvida");

    // E o ponto de uso que importa: é o `ehWo` que decide o `naoResolvidos`.
    // Contar o ponto de chamada é a lição da fatia 0.6.21 — a janela ancorada na
    // função é cega para quem a invoca.
    ok(/naoResolvidos = state\.matches\.filter\([^)]*!ehWo\(m\)\)/.test(fonteSemComentario),
      "e o `naoResolvidos` (a conta que trava o botão) usa o `ehWo` — não uma terceira cópia da lista");
  }

  // ── 5ter. A GUARDA DO SISTEMA A NO PROCESSAMENTO — medida VERDE pelo guardião
  // Ele removeu `if (w.wo_tipo === "duplo_culposo") continue;` do ramo do Sistema A
  // e a bateria inteira ficou VERDE: guarda sem mutação vermelha é guarda sem
  // proteção. O cenário que a exercita tem de injetar a linha DIRETO nas partidas,
  // porque o `APLICAR_WO` recusa o duplo no A (409) — ou seja, só se chega a este
  // estado por dado migrado ou escrita manual no banco. É defesa em profundidade,
  // e sem ela a linha cairia no ramo de baixo: o `-15` só olha `culposo`, mas o
  // `+8` do beneficiário NÃO olha tipo nenhum — inventaria rating do nada.
  {
    const { banco, motor } = await montarMotor({
      circuitos: [circuito(BH, { regulamento_versao: "v03-13" })],
      atletas: [atleta(A1, { rating: 500, saldo_temp: 0, vitorias: 0, derrotas: 0 }),
                atleta(A2, { rating: 500, saldo_temp: 0, vitorias: 0, derrotas: 0 })],
      circuito_atletas: [
        { circuito_id: BH, atleta_id: A1, status: "ativo" },
        { circuito_id: BH, atleta_id: A2, status: "ativo" },
      ],
      // ⚠️ O `wo_beneficiario_id` PRECISA estar preenchido para esta asserção
      // morder, e isso não é artifício: com os dois ids nulos a guarda é inerte
      // (o `+8` não acha beneficiário e o `-15` exige `culposo`), então removê-la
      // não muda nada e a mutação passa VERDE — foi exatamente o que aconteceu na
      // primeira versão desta seção. O estado que a guarda protege é o de dado
      // MIGRADO ou escrita manual no banco: linha de duplo com beneficiário
      // sobrando. Aí, sem a guarda, o `+8` do Sistema A entra — porque ele NÃO
      // olha `wo_tipo` nenhum — e inventa rating do nada.
      partidas: [partida("ja", { circuito_id: BH, atleta1_id: A1, atleta2_id: A2, rodada: 1,
                                 wo_tipo: "duplo_culposo", wo_faltoso_id: null,
                                 wo_beneficiario_id: A2, admin_aprovado_em: "2026-01-02T10:00:00Z" })],
    });
    await comoAdmin(motor, "PROCESSAR_RODADA", { circuitoId: BH, round: 1 });
    for (const [id, nome] of [[A1, "o primeiro"], [A2, "o segundo"]]) {
      const g = banco.acha("atletas", x => x.id === id);
      igual(g?.rating, 500, `Sistema A: ${nome} atleta NÃO tem o rating mexido por uma linha de duplo`);
      igual(g?.saldo_temp, 0, `Sistema A: ${nome} atleta não recebe ponto nenhum`);
      igual(g?.vitorias, 0, `Sistema A: ${nome} atleta não recebe vitória inventada`);
    }
  }

  // ── 5quater. O CAMINHO QUE O 409 RECOMENDA REALMENTE FUNCIONA ───────────
  // Exigido pelo Supervisor de Regulamento: "se a mensagem de erro manda usar um
  // caminho, esse caminho é parte da onda e precisa de asserção". O 409 do
  // Sistema A manda usar "Justificado (anula)". Aqui ele é RODADO, e o que se
  // exige é o que o v03-13 descreve: sem ponto, sem rating, sem W.O. contado.
  {
    const { banco, motor } = await cenarioDuplo("A");
    const r = await comoAdmin(motor, "APLICAR_WO", { circuitoId: BH, matchId: "jd", tipo: "justificado" });
    ok(r.corpo?.sucesso === true, `o caminho recomendado pelo 409 é aceito (erro: ${JSON.stringify(r.corpo?.erro)})`);
    const m = banco.acha("partidas", x => x.id === "jd");
    igual(m?.rejeitado, true, "a partida é ANULADA — é o que o v03-13 manda quando ninguém jogou");
    await comoAdmin(motor, "PROCESSAR_RODADA", { circuitoId: BH, round: 1 });
    for (const [id, nome] of [[A1, "o primeiro"], [A2, "o segundo"]]) {
      const g = banco.acha("atletas", x => x.id === id);
      igual(g?.rating, 500, `e ${nome} atleta fica sem mexer no rating`);
      igual(g?.saldo_temp, 0, `${nome} atleta sem ponto`);
      igual(g?.wo_culposos_temporada, 0, `e ${nome} atleta SEM W.O. contado — anular não é punir`);
    }
  }

  // ── 5quinquies. O 4º CRITÉRIO DE DESEMPATE SENTE A DERROTA DO DUPLO ─────
  // Exigido pelo Supervisor de Regulamento, e é o ÚNICO efeito prático da
  // derrota: o Cap. 09 ordena por pontos (1), menos W.O. injustificados (2),
  // confronto direto (3) e só então % de aproveitamento (4). Entre os DOIS do
  // duplo o critério 2 é neutro (os dois levam +1), então quem decide é o 4 —
  // e contra TERCEIROS com a mesma contagem de W.O. a derrota do duplo muda a
  // ordem. Sem esta asserção, a decisão do Cap. 13 que o Juliano vai tomar não
  // tinha nada prendendo o efeito dela.
  {
    // EXTRAI E EXECUTA (técnica das 4 condições do CLAUDE.md: `aproveitamentoB`
    // é pura, recebe um objeto e devolve número, não fecha sobre nada).
    const fonteMotor = readFileSync("supabase/functions/admin-action/index.ts", "utf-8");
    const i = fonteMotor.indexOf("function aproveitamentoB");
    ok(i > 0, "a conta de aproveitamento do Sistema B foi localizada no motor");
    const corpoApr = fonteMotor.slice(i, fonteMotor.indexOf("\n}", i) + 2)
      .replace(/: any/g, "").replace(/: number/g, "");
    const aproveitamentoB = new Function(corpoApr + "; return aproveitamentoB;")();

    // Dois atletas com os MESMOS pontos e o MESMO número de W.O. — é o recorte em
    // que o 4º critério decide, e é o único efeito prático da derrota do duplo.
    const semDuplo = aproveitamentoB({ vitorias: 1, derrotas: 0 });
    const comDuplo = aproveitamentoB({ vitorias: 1, derrotas: 1 });
    ok(comDuplo < semDuplo,
      `a derrota do W.O. duplo REDUZ o aproveitamento (${semDuplo} → ${comDuplo}) — é assim que ela move o 4º critério do Cap. 09`);
    igual(aproveitamentoB({ vitorias: 0, derrotas: 1 }), 0,
      "e quem só tem a derrota do duplo fica com 0% — não com divisão por zero");
    igual(aproveitamentoB({ vitorias: 0, derrotas: 0 }), 0,
      "e quem não tem jogo nenhum também não quebra a conta");
  }

  // ── 7. DESFAZER W.O. — o beco sem saída que o Juliano pediu para fechar ──
  // 15/11/2026, logo depois de eu avisá-lo de que o W.O. só podia ser
  // RECLASSIFICADO, nunca removido: "quero poder desfazer um W.O seja de um
  // atleta ou duplo". O próprio ROADMAP 1.3g citava isso como o problema.
  {
    // ── o duplo ──
    {
      const { banco, motor } = await cenarioDuplo("B");
      await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jd", tipo: "duplo_culposo" });
      igual(doCirc(banco, A1)?.wo_culposos_temporada, 1, "(antes: o duplo lançou a falta)");
      const r = await comoAdmin(motor, "DESFAZER_WO", { circuitoId: CD, matchId: "jd" });
      ok(r.corpo?.sucesso === true, `o organizador desfaz o W.O. duplo (erro: ${JSON.stringify(r.corpo?.erro)})`);
      const m = banco.acha("partidas", x => x.id === "jd");
      igual(m?.wo_tipo, null, "a partida volta a não ter W.O.");
      igual(doCirc(banco, A1)?.wo_culposos_temporada, 0, "e a falta sai do primeiro atleta");
      igual(doCirc(banco, A2)?.wo_culposos_temporada, 0, "e do segundo — desfazer tem de desfazer para os DOIS");
    }

    // ── o W.O. de um atleta só ──
    {
      const { banco, motor } = await cenarioDuplo("B");
      await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jd", tipo: "culposo", faltosoId: A1, beneficiarioId: A2 });
      await comoAdmin(motor, "DESFAZER_WO", { circuitoId: CD, matchId: "jd" });
      const m = banco.acha("partidas", x => x.id === "jd");
      igual(m?.wo_tipo, null, "o W.O. de um atleta só também é desfeito");
      igual(m?.wo_faltoso_id, null, "e o faltoso apontado é limpo");
      igual(m?.wo_beneficiario_id, null, "e o beneficiário também");
      igual(doCirc(banco, A1)?.wo_culposos_temporada, 0, "e a falta sai de quem a tinha");
    }

    // ── o justificado do Sistema A, que NÃO grava `wo_tipo` ──
    // Ele anula com `rejeitado: true` + motivo. Se o DESFAZER só olhasse
    // `wo_tipo`, este caso ficaria sem volta — e é justamente o que o 409 do
    // Sistema A recomenda ao organizador usar.
    {
      const { banco, motor } = await cenarioDuplo("A");
      await comoAdmin(motor, "APLICAR_WO", { circuitoId: BH, matchId: "jd", tipo: "justificado" });
      igual(banco.acha("partidas", x => x.id === "jd")?.rejeitado, true, "(antes: o justificado anulou a partida)");
      const r = await comoAdmin(motor, "DESFAZER_WO", { circuitoId: BH, matchId: "jd" });
      ok(r.corpo?.sucesso === true, `o justificado do Sistema A também se desfaz (erro: ${JSON.stringify(r.corpo?.erro)})`);
      const m = banco.acha("partidas", x => x.id === "jd");
      igual(m?.rejeitado, false, "a anulação é revertida");
      igual(m?.motivo_rejeicao, null, "e o motivo sai junto");
    }

    // ── ⚠️ UM PLACAR RECUSADO NÃO PODE RESSUSCITAR ──────────────────────
    // `rejeitado` é o MESMO campo usado para recusar um placar
    // (`VALIDATE_RESULT` com aprovado:false). Se o DESFAZER limpasse o campo sem
    // conferir o MOTIVO, ele ressuscitaria um placar que o organizador recusou —
    // e ninguém saberia.
    {
      const { banco, motor } = await cenarioDuplo("B");
      const pd = banco.tabelas.partidas.find(x => x.id === "jd");
      pd.placar1 = 3; pd.placar2 = 0; pd.validado = true;
      await comoAdmin(motor, "VALIDATE_RESULT", { circuitoId: CD, matchId: "jd", approved: false, motivo: "placar inventado" });
      igual(banco.acha("partidas", x => x.id === "jd")?.rejeitado, true, "(antes: o organizador RECUSOU o placar)");
      const r = await comoAdmin(motor, "DESFAZER_WO", { circuitoId: CD, matchId: "jd" });
      ok(r.corpo?.sucesso !== true, "desfazer W.O. numa partida que não tem W.O. é RECUSADO");
      const m = banco.acha("partidas", x => x.id === "jd");
      igual(m?.rejeitado, true, "e o placar recusado CONTINUA recusado — o `rejeitado` do W.O. e o da recusa de placar não se confundem");
      igual(m?.motivo_rejeicao, "placar inventado", "com o motivo que o organizador escreveu, intacto");
    }

    // ── ⚠️ E O CASO EM QUE A RECUSA **NÃO** PROTEGE: W.O. **E** PLACAR RECUSADO
    // A asserção acima não bastava — nela o DESFAZER é recusado antes de chegar à
    // limpeza, então sabotar a limpeza passava VERDE. Medido: a mutação "limpa
    // `rejeitado` sem conferir o motivo" ficava verde com aquele cenário.
    // O cenário que morde é a partida que tem AS DUAS COISAS: o organizador
    // recusou o placar e DEPOIS registrou W.O. Aí o desfazer SUCEDE (há
    // `wo_tipo`), a limpeza roda, e sem a conferência do motivo ela ressuscitaria
    // um placar que o organizador recusou — sem ninguém saber.
    {
      const { banco, motor } = await cenarioDuplo("B");
      const pd = banco.tabelas.partidas.find(x => x.id === "jd");
      pd.placar1 = 3; pd.placar2 = 0; pd.validado = true;
      await comoAdmin(motor, "VALIDATE_RESULT", { circuitoId: CD, matchId: "jd", approved: false, motivo: "placar inventado" });
      await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jd", tipo: "duplo_culposo" });
      igual(banco.acha("partidas", x => x.id === "jd")?.wo_tipo, "duplo_culposo", "(antes: a partida tem W.O. E placar recusado)");
      const r = await comoAdmin(motor, "DESFAZER_WO", { circuitoId: CD, matchId: "jd" });
      ok(r.corpo?.sucesso === true, `o desfazer SUCEDE, porque há W.O. (erro: ${JSON.stringify(r.corpo?.erro)})`);
      const m = banco.acha("partidas", x => x.id === "jd");
      igual(m?.wo_tipo, null, "o W.O. sai");
      igual(m?.rejeitado, true,
        "MAS o placar recusado CONTINUA recusado — desfazer W.O. não ressuscita placar que o organizador recusou");
      igual(m?.motivo_rejeicao, "placar inventado", "com o motivo dele intacto");
    }

    // ── a guarda que protege o ranking ────────────────────────────────────
    {
      const { banco, motor } = await cenarioDuplo("B");
      await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jd", tipo: "duplo_culposo" });
      await comoAdmin(motor, "PROCESSAR_RODADA", { circuitoId: CD, round: 1 });
      const r = await comoAdmin(motor, "DESFAZER_WO", { circuitoId: CD, matchId: "jd" });
      ok(r.corpo?.sucesso !== true, "depois de a rodada ser PROCESSADA, desfazer é recusado");
      igual(r.status, 409, "com 409 — os pontos já estão no ranking e limpar a partida não os desfaz");
      igual(banco.acha("partidas", x => x.id === "jd")?.wo_tipo, "duplo_culposo",
        "e a partida fica intocada — recusa que grava metade é pior que recusa nenhuma");
      igual(doCirc(banco, A1)?.derrotas, 1, "a derrota processada continua lá, sem duplicar");
    }

    // ── o escopo: organizador não desfaz W.O. de outro circuito ───────────
    {
      const { banco, motor } = await cenarioDuplo("B");
      await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jd", tipo: "duplo_culposo" });
      const r = await comoAdmin(motor, "DESFAZER_WO", { circuitoId: BH, matchId: "jd" });
      ok(r.corpo?.sucesso !== true, "desfazer apontando OUTRO circuito é recusado");
      igual(banco.acha("partidas", x => x.id === "jd")?.wo_tipo, "duplo_culposo", "e o W.O. do circuito certo fica intacto");
    }

    // ── ⛔ DUAS PARTIDAS: desfazer UMA não apaga a falta da OUTRA ─────────
    // Esta é A mutação verde que o Guardião de Regulamento achou, e a mais grave
    // desta onda: trocar a recontagem por um zeramento direto
    // (`wo_culposos_temporada: 0`) deixava a bateria INTEIRA verde — porque todos
    // os meus cenários tinham UMA partida só, e com uma partida só o zero é a
    // resposta certa das duas formas. Com duas, o zeramento apaga a falta de uma
    // rodada que ninguém desfez.
    // Esse número SUSPENDE (Cap. 07) e ordena o 2º desempate (Cap. 09).
    {
      const { banco, motor } = await montarMotor({
        circuitos: [circuito(BH), circuito(CD, { slug: "pontos-duplo", sistema: "B", regulamento_versao: "vB-01", fase: "etapa" })],
        atletas: [atleta(A1), atleta(A2)],
        circuito_atletas: [
          { circuito_id: CD, atleta_id: A1, status: "ativo" },
          { circuito_id: CD, atleta_id: A2, status: "ativo" },
        ],
        partidas: [
          partida("r1", { circuito_id: CD, atleta1_id: A1, atleta2_id: A2, rodada: 1 }),
          partida("r2", { circuito_id: CD, atleta1_id: A1, atleta2_id: A2, rodada: 2 }),
        ],
      });
      await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "r1", tipo: "duplo_culposo" });
      await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "r2", tipo: "duplo_culposo" });
      igual(doCirc(banco, A1)?.wo_culposos_temporada, 2, "(antes: duas rodadas, duas faltas)");
      await comoAdmin(motor, "DESFAZER_WO", { circuitoId: CD, matchId: "r2" });
      igual(doCirc(banco, A1)?.wo_culposos_temporada, 1,
        "desfazer o W.O. da rodada 2 deixa o atleta com UMA falta — a da rodada 1 CONTINUA");
      igual(doCirc(banco, A2)?.wo_culposos_temporada, 1, "e vale para os dois atletas");
    }

    // ── ⛔ UM PLACAR RECUSADO NÃO RESSUSCITA, NEM COM A FRASE CERTA ───────
    // O Guardião de Regulamento provou que a guarda anterior era uma STRING que o
    // organizador digita: bastava escrever exatamente "W.O. Justificado" ao
    // RECUSAR um placar, e o desfazer limpava a recusa — o placar voltava e
    // pontuava. Discriminador que o usuário pode digitar não é discriminador.
    // Agora a pergunta é sobre o CAMPO `wo_tipo`, que não se digita.
    {
      const { banco, motor } = await cenarioDuplo("B");
      const pd = banco.tabelas.partidas.find(x => x.id === "jd");
      pd.placar1 = 3; pd.placar2 = 0; pd.validado = true;
      await comoAdmin(motor, "VALIDATE_RESULT", { circuitoId: CD, matchId: "jd", approved: false, motivo: "W.O. Justificado" });
      const m0 = banco.acha("partidas", x => x.id === "jd");
      igual(m0?.rejeitado, true, "(antes: placar RECUSADO, com a frase sentinela como motivo)");
      igual(m0?.wo_tipo, null, "(e sem W.O. nenhum na partida)");
      const r = await comoAdmin(motor, "DESFAZER_WO", { circuitoId: CD, matchId: "jd" });
      ok(r.corpo?.sucesso !== true,
        "desfazer é RECUSADO — a frase digitada não faz a partida ter W.O.");
      const m = banco.acha("partidas", x => x.id === "jd");
      igual(m?.rejeitado, true, "e o placar recusado CONTINUA recusado");
      igual(m?.motivo_rejeicao, "W.O. Justificado", "com o motivo que o organizador escreveu, intacto");
    }

    // ── ⛔ A GUARDA DO PROCESSADO NÃO PODE SER CONTORNADA ─────────────────
    // Medido pelo Guardião de Regulamento: o `DESFAZER_WO` recusava em partida
    // processada (certo), mas o `APLICAR_WO` não tinha a guarda irmã e regravava
    // `calculado: false` — então bastava reaplicar o W.O. para destravar o
    // desfazer. Resultado: partida sem W.O. e sem placar, com os pontos ainda no
    // atleta. Dois pontos de um jogo que não existe.
    {
      const { banco, motor } = await cenarioDuplo("B");
      await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jd", tipo: "duplo_culposo" });
      await comoAdmin(motor, "PROCESSAR_RODADA", { circuitoId: CD, round: 1 });
      const rA = await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jd", tipo: "culposo", faltosoId: A1, beneficiarioId: A2 });
      ok(rA.corpo?.sucesso !== true, "APLICAR_WO numa partida JÁ PROCESSADA é recusado");
      igual(rA.status, 409, "com 409 — senão ele destrava o desfazer regravando `calculado: false`");
      igual(banco.acha("partidas", x => x.id === "jd")?.calculado, true,
        "e a partida continua calculada — a guarda não pode deixar rastro");
    }

    // ── erro de banco NÃO vira "deu certo" ────────────────────────────────
    // Três `throw` da ação estavam sem proteção — o Guardião de Confiabilidade
    // mediu: tirar o `if (eLimp) throw` deixava a ação responder `sucesso: true`
    // SEM TER LIMPADO NADA. É a família que esta casa mais persegue: o "✓" que o
    // organizador acredita.
    {
      const { banco, motor } = await cenarioDuplo("B");
      await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jd", tipo: "duplo_culposo" });
      banco.recusar("partidas", "update", { message: "connection reset", code: "08006" });
      const r = await comoAdmin(motor, "DESFAZER_WO", { circuitoId: CD, matchId: "jd" });
      ok(r.corpo?.sucesso !== true,
        "se a limpeza FALHA, a ação NÃO responde sucesso — senão o organizador acredita num desfazer que não houve");
      igual(banco.acha("partidas", x => x.id === "jd")?.wo_tipo, "duplo_culposo",
        "e o W.O. continua lá, que é a verdade");
    }
    {
      const { banco, motor } = await cenarioDuplo("B");
      await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jd", tipo: "duplo_culposo" });
      banco.recusar("partidas", "select", { message: "connection reset", code: "08006" });
      const r = await comoAdmin(motor, "DESFAZER_WO", { circuitoId: CD, matchId: "jd" });
      ok(r.corpo?.sucesso !== true,
        "e se a LEITURA falha também não — a ação recusa em vez de seguir sem saber o estado da partida");
      // ⚠️ MEDIDO, porque o Guardião de Regulamento supôs o contrário: tirar o
      // `if (eMw) throw` deixa esta asserção VERDE — mas NÃO abre buraco. A
      // leitura falhando faz a guarda de ESCOPO recusar antes, com 403, e a
      // partida fica intocada (conferido: `wo_tipo` e `calculado` inalterados).
      // Ou seja, é mutação EQUIVALENTE: falha fechada por outro caminho. O
      // `throw` fica como defesa em profundidade, e está dito aqui que ele não
      // é o que segura a porta — para ninguém escrever depois que é.
      ok(r.status >= 400, `com recusa explícita (veio ${r.status})`);
    }
    {
      const { motor } = await cenarioDuplo("B");
      const r = await comoAdmin(motor, "DESFAZER_WO", { circuitoId: CD, matchId: "nao-existe" });
      // Vem 403 ("Partida não é do seu circuito"), não 404: a guarda de ESCOPO
      // responde antes do 404 da ação. É resposta legítima — partida que não
      // existe de fato não é do circuito de ninguém — e o que importa aqui é que
      // NÃO é sucesso. Registrado assim em vez de ajustado o motor, porque mexer
      // na ordem das guardas por causa de um código de status seria mexer na
      // blindagem de escopo por motivo cosmético.
      ok(r.corpo?.sucesso !== true, "partida que não existe é RECUSADA, e não devolve um sucesso vazio");
      ok(r.status === 404 || r.status === 403, `com recusa explícita (veio ${r.status})`);
    }

    // ── o ORGANIZADOR (sub-admin) consegue desfazer ───────────────────────
    // Lacuna medida pelo guardião: tirar `DESFAZER_WO` da allowlist `ACOES_ORG`
    // deixava a bateria VERDE, e o organizador levaria 403 sem ninguém notar.
    {
      const hashOrg = await pinGuardado("7788");
      const ORG = "organizador-do-cd";
      const { banco, motor } = await montarMotor({
        circuitos: [circuito(BH), circuito(CD, { slug: "pontos-duplo", sistema: "B", regulamento_versao: "vB-01", fase: "etapa" })],
        atletas: [atleta(A1), atleta(A2), atleta(ORG, { telefone: "31977776666", pin_hash: hashOrg })],
        circuito_atletas: [
          { circuito_id: CD, atleta_id: A1, status: "ativo" },
          { circuito_id: CD, atleta_id: A2, status: "ativo" },
        ],
        partidas: [partida("jo", { circuito_id: CD, atleta1_id: A1, atleta2_id: A2, rodada: 1 })],
        outras: { circuito_organizadores: [{ circuito_id: CD, atleta_id: ORG }] },
      });
      await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jo", tipo: "duplo_culposo" });
      const r = await comoOrganizador(motor, "31977776666", "7788", "DESFAZER_WO", { circuitoId: CD, matchId: "jo" });
      ok(r.corpo?.sucesso === true,
        `o ORGANIZADOR do circuito consegue desfazer — não é ação só de super-admin (erro: ${JSON.stringify(r.corpo?.erro)})`);
      igual(banco.acha("partidas", x => x.id === "jo")?.wo_tipo, null, "e o W.O. sai de verdade");
    }

    // ── A TELA: ancorada no PONTO DE CHAMADA, não no texto solto ──────────
    // ⚠️ ESTAS TRÊS NASCERAM DE UMA MUTAÇÃO VERDE. As primeiras eram
    // `/DESFAZER_WO/`, `/Desfazer W\.O\./` e `/Sim, desfazer/` sobre o fonte — e o
    // Guardião de Confiabilidade mostrou que apagar o ramo do `syncToSupabase`, OU
    // tirar o `dispatch` do botão, deixava a bateria VERDE. O efeito seria a tela
    // mostrando o W.O. sumir (otimismo do reducer) e o SERVIDOR NUNCA SER CHAMADO,
    // até o próximo recarregamento. É a lição da fatia 0.6.21 outra vez: a janela
    // ancorada na função é cega para quem a invoca.
    {
      const iSync = fonteSemComentario.indexOf('else if (action.type === "DESFAZER_WO")');
      ok(iSync > 0, "o ramo do DESFAZER_WO existe no despachante");
      const bloco = fonteSemComentario.slice(iSync, fonteSemComentario.indexOf("\n    }", iSync));
      ok(/chamarAdminAction\("DESFAZER_WO"/.test(bloco),
        "e ele CHAMA o motor — sem isto a tela apagaria o W.O. e o servidor nunca saberia");
      ok(/loadFromSupabase\(\)/.test(bloco),
        "e recarrega do banco depois, senão o contador de faltas fica velho na tela");

      const iBtn = fonteSemComentario.indexOf("Sim, desfazer");
      ok(iBtn > 0, "o botão de confirmação existe");
      const linhaBtn = fonteSemComentario.slice(fonteSemComentario.lastIndexOf("<Btn", iBtn), iBtn);
      ok(/dispatch\(\{type:"DESFAZER_WO"/.test(linhaBtn),
        "e o clique dele DESPACHA a ação — não é botão decorativo");

      // ── O PAYLOAD, não só o NOME da ação ──────────────────────────────
      // ⚠️ Lacuna medida pelo Supervisor de Confiabilidade em 18/11/2026: as
      // três asserções acima checam o NOME da chamada, e trocar o payload por
      // `{}` nos DOIS pontos deixava a bateria VERDE. O efeito seria o motor
      // respondendo 400 "matchId é obrigatório" a cada clique — a tela não
      // mente (a barra de erro acende), mas o botão nunca desfaz nada, e nada
      // na bateria acusaria. É a lição da fatia 0.6.21 um passo adiante:
      // ancorar no ponto de chamada não basta se a asserção não olha o que ele
      // manda.
      ok(/chamarAdminAction\("DESFAZER_WO",\s*action\.payload\)/.test(bloco),
        "e MANDA o payload adiante — sem ele o motor recusa com 400 e o botão nunca desfaz nada");
      ok(/payload:\s*\{matchId:/.test(linhaBtn),
        "e o clique diz QUAL partida — sem o matchId não há o que desfazer");
    }

    // ── O CARIMBO SAI quando a partida NÃO está validada ──────────────────
    // ⚠️ Lacuna medida pelo Supervisor de Confiabilidade em 18/11/2026: apagar
    // a linha `if (!mwValidado) limpeza.admin_aprovado_em = null` deixava a
    // bateria VERDE. É escrita em DADO, e dado sem asserção regride calado.
    // O carimbo é do próprio W.O. (o `APLICAR_WO` grava `now`), então numa
    // partida que ninguém validou ele não tem razão de existir depois do
    // desfazer — e no Sistema A este campo ORDENA o cálculo do rating.
    {
      const { banco, motor } = await cenarioDuplo("B");
      await comoAdmin(motor, "APLICAR_WO", { circuitoId: CD, matchId: "jd", tipo: "duplo_culposo" });
      ok(!!banco.acha("partidas", x => x.id === "jd")?.admin_aprovado_em,
        "(antes: o APLICAR_WO carimbou a partida com a hora do W.O.)");
      await comoAdmin(motor, "DESFAZER_WO", { circuitoId: CD, matchId: "jd" });
      igual(banco.acha("partidas", x => x.id === "jd")?.admin_aprovado_em, null,
        "desfazer numa partida NÃO validada apaga também o carimbo que o W.O. deixou");
    }

    // ── O justificado que nasce do PEDIDO DO ATLETA também se desfaz ──────
    // ⚠️ Lacuna medida pelos DOIS supervisores em 18/11/2026, e é a mais séria
    // das quatro: o `wo_tipo: "justificado"` foi gravado em DOIS lugares, e só
    // um tinha asserção. Remover o do `RESPONDER_WO` deixava a bateria inteira
    // VERDE — e o `RESPONDER_WO` é o caminho REAL e mais comum do justificado:
    // o atleta pede, o organizador aprova. Sem o campo ali, o desfazer
    // responderia "Esta partida não tem W.O." justamente no W.O. que o
    // organizador acabou de aprovar — o beco sem saída reaberto na porta
    // principal, com a bateria dizendo que estava tudo bem.
    {
      const { banco, motor } = await montarMotor({
        circuitos: [circuito(BH, { regulamento_versao: "v03-13" })],
        atletas: [atleta(A1, { rating: 500 }), atleta(A2, { rating: 500 })],
        circuito_atletas: [
          { circuito_id: BH, atleta_id: A1, status: "ativo" },
          { circuito_id: BH, atleta_id: A2, status: "ativo" },
        ],
        partidas: [partida("jr", { circuito_id: BH, atleta1_id: A1, atleta2_id: A2, rodada: 1 })],
        solicitacoes_wo: [{ id: "sr", circuito_id: BH, atleta_id: A1, adversario_id: A2,
                            partida_id: "jr", status: "pendente" }],
      });
      const rA = await comoAdmin(motor, "RESPONDER_WO", { circuitoId: BH, id: "sr", matchId: "jr", aprovado: true });
      ok(rA.corpo?.sucesso === true,
        `o organizador aprova a justificativa que o atleta pediu (erro: ${JSON.stringify(rA.corpo?.erro)})`);
      igual(banco.acha("partidas", x => x.id === "jr")?.rejeitado, true,
        "(antes: a aprovação anulou a partida, que é o que o Sistema A faz)");
      const r = await comoAdmin(motor, "DESFAZER_WO", { circuitoId: BH, matchId: "jr" });
      ok(r.corpo?.sucesso === true,
        `e esse W.O. também se desfaz (erro: ${JSON.stringify(r.corpo?.erro)})`);
      const m = banco.acha("partidas", x => x.id === "jr");
      igual(m?.rejeitado, false, "a partida volta a valer");
      igual(m?.wo_tipo, null, "e sem W.O. nenhum");
    }
  }

  // ── 6. A TELA: o botão existe e está atrás do portão do Sistema B ────────
  {
    const i = fonteSemComentario.indexOf('setTipo("duplo_culposo")');
    ok(i > 0, "a tela oferece o botão de W.O. duplo");
    ok(/algum dos dois tinha motivo[\s\S]{0,200}Justificado/.test(fonteSemComentario),
      "e a tela manda o organizador usar o Justificado quando ALGUM dos dois tinha motivo — sem essa linha ele lança falta em quem não faltou por descaso");
    const abertura = fonteSemComentario.lastIndexOf('SISTEMA_ATIVO === "B" &&', i);
    ok(abertura > 0 && i - abertura < 220,
      "e ele está DENTRO do gate `SISTEMA_ATIVO === \"B\"` — circuito de rating não o vê, porque o regulamento dele não prevê o caso");
  }
}

process.exit(placar("O segundo circuito"));
