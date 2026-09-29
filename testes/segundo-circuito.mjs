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
  ok, igual, secao, placar, BH,
} from "./ferramentas.mjs";
import { carregarFuncao } from "./carrega-motor.mjs";

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
  ok(/const naFilaDeEspera = eu\.status === "ativo" && eu\.pendenteCircuito;/.test(fonteApp),
    "a tela do atleta reconhece o estado 'aprovado, aguardando vaga'");
  // ⚠️ ANCORADA NA CONDIÇÃO QUE RENDERIZA, não no texto. A primeira redação
  // casava só a frase — e desligar a guarda (`{naFilaDeEspera && (` → `{false && (`)
  // deixava a bateria VERDE com a caixa morta na tela. Oitava vez nesta sessão que
  // uma asserção minha olha para o procurador da regra em vez da regra.
  ok(/\{naFilaDeEspera && \(/.test(fonteApp),
    "a caixa é renderizada sob essa condição — não é texto morto no arquivo");
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
  ok(/Quem pagar depois entra só na rodada seguinte/.test(fonteApp),
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
  igual((fonteApp2.match(/if \(!trocou\)/g) || []).length, 2,
    "nos DOIS lugares: processar a rodada e abrir o circuito");
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
    // ⚠️ AQUI ESTÁ UM ACHADO, e ele é o motivo de o Cap. 03 ter mudado de "sem
    // repetir" para "evitando repetir". A 1ª versão desta asserção exigia ZERO
    // repetição — e ficava vermelha em cerca de 1 de cada 8 execuções. Eu quase
    // a tratei como teste instável. Não é: é o motor.
    //
    // Medido em 120 temporadas completas por configuração (29/09/2026):
    //   8 atletas / sorteio ..... 13 em 120 temporadas com repetição, no máximo 1
    //   8 atletas / grupos ...... 0 em 120
    //   9, 10 e 12 / sorteio .... 0 em 120
    //
    // A razão: com 8 atletas cada um tem 7 adversários possíveis e a temporada usa
    // 6 — quase o rodízio completo. O motor escolhe a melhor solução DE CADA
    // RODADA, sem olhar as seguintes; então uma escolha boa na rodada 3 pode
    // deixar a rodada 6 sem saída, e ele repete um confronto. Existe escala que
    // evitaria (rodízio pelo método do círculo), mas trocar o algoritmo do
    // pareamento é mudança de motor e é decisão do Juliano, não minha.
    //
    // A asserção afirma o que é VERDADE SEMPRE, com o limite medido. Se alguém
    // melhorar o pareamento, ela continua verde; se alguém piorar, fica vermelha.
    const confrontos = partidas.map(m => [m.atleta1_id, m.atleta2_id].sort().join("|"));
    const repeticoes = confrontos.length - new Set(confrontos).size;
    ok(repeticoes <= 1,
      `com 8 atletas o motor repete no máximo UM confronto na temporada inteira (veio: ${repeticoes})`);
    // Cada atleta joga as 6 rodadas.
    for (const id of lista) {
      const minhas = partidas.filter(m => m.atleta1_id === id || m.atleta2_id === id);
      igual(minhas.length, 6, `o atleta ${id} joga as 6 rodadas`);
      // E ninguém enfrenta a mesma pessoa três vezes — o limite duro.
      const advs = minhas.map(m => m.atleta1_id === id ? m.atleta2_id : m.atleta1_id);
      const maxVezes = Math.max(...advs.map(x => advs.filter(y => y === x).length));
      ok(maxVezes <= 2, `o atleta ${id} não enfrenta ninguém mais de duas vezes (máximo: ${maxVezes})`);
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
    // No modo grupos a ordem é determinística (tabela de pontos, todos em 0), e o
    // motor acerta as 120 temporadas medidas. Aqui ZERO é exigível.
    igual(new Set(confrontos).size, confrontos.length,
      "no modo grupos por faixa NENHUM confronto se repete com 8 atletas");
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

  // ⚠️ No BH o super-admin NÃO passa pela checagem de membro, e é de propósito: lá
  // a participação é a própria linha de `atletas` (roster legado), e existe atleta
  // do BH sem linha em `circuito_atletas`. Exigi-la ali recusaria operação legítima
  // — a bateria pegou isso na hora quando eu apertei demais.
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

process.exit(placar("O segundo circuito"));
