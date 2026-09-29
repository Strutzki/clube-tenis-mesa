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
import {
  montarMotor, comoAdmin, circuito, atleta,
  ok, igual, secao, placar, BH,
} from "./ferramentas.mjs";

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
  ok(/nem o certificado do Top 3/.test(criar) && /nem certificado/.test(criar),
    "e o certificado, que o texto de rating lista como incluído, é nomeado como ausente nos dois");
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
  // O campo do teto nasceu (f229432) SEM ressincronizar na troca de circuito,
  // herdando o defeito que o comentário do campo do NOME descreve palavra por
  // palavra. `AdminDashboard` não remonta na troca, então o campo ficava com o
  // teto do circuito anterior e o Salvar gravava esse valor no circuito novo.
  // Três guardiões pegaram. A bateria não executa `App.jsx`, então o portão
  // possível é de fonte — e ele é GENÉRICO de propósito: pega o próximo campo
  // que nascer torto, não só este.
  const iDash = fonte.indexOf("function AdminDashboard(");
  const fimDash = fonte.indexOf("\nfunction ", iDash + 1);
  ok(iDash > 0 && fimDash > iDash, "o AdminDashboard foi localizado no fonte");
  const dash = fonte.slice(iDash, fimDash);
  const camposDoEstado = [...dash.matchAll(/const \[\w+, (set\w+)\] = useState\((?:\(\) => )?(?:String\()?state\.(\w+)/g)];
  ok(camposDoEstado.length > 0, "há campos do painel inicializados a partir do estado do circuito");
  const semRessincronizar = camposDoEstado.filter(([, setter, campo]) =>
    !new RegExp(`useEffect\\(\\(\\) => \\{ ${setter}\\([^)]*\\)[^}]*\\}, \\[state\\.${campo}\\]\\);`).test(dash));
  igual(semRessincronizar.length, 0,
    `todo campo do painel inicializado do estado ressincroniza quando o circuito troca (sem isso: ${semRessincronizar.map(m=>m[1]).join(", ")})`);
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

process.exit(placar("O segundo circuito"));
