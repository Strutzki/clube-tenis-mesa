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
    sistema: "B", pareamento: "sorteio", maxAtletas: 16,
  });
  ok(r.corpo?.sucesso === true, `CRIAR_CIRCUITO de pontos respondeu sucesso (veio: ${JSON.stringify(r.corpo?.erro ?? r.corpo?.sucesso)})`);

  const criado = banco.acha("circuitos", c => c.slug === "bh-pontos");
  igual(criado?.sistema, "B", "o circuito nasce no Sistema B");
  igual(criado?.pareamento, "sorteio", "com o pareamento que o admin escolheu");
  igual(criado?.regulamento_versao, "vB-01", "e carimbado com o regulamento de PONTOS, não com o v03-12 do BH");
  igual(criado?.max_atletas, 16, "e com o teto que o admin pediu, não com 20 fixo");
  igual(criado?.inscricoes_abertas, false, "nasce com as inscrições FECHADAS — ninguém entra por acidente");

  // 0.10.7: o recibo. Antes o select não trazia a versão, então a tela de
  // confirmação não tinha como dizer sob qual regulamento o circuito nasceu —
  // e o admin descobria (ou não) depois, por outro caminho.
  igual(r.corpo?.dados?.regulamento_versao, "vB-01",
    "e o SERVIDOR devolve a versão, para a confirmação mostrar o que foi gravado e não o que a tela mandou");
  igual(r.corpo?.dados?.max_atletas, 16,
    "e devolve o teto gravado também");
}

// ───────────────────────────────────────────────────────────────────────────────
secao("O teto de um circuito que JÁ EXISTE passa a ser editável (0.10.9)");
{
  // Rodando o motor de verdade: é a única forma de provar que o campo chega ao
  // banco. A tela mandar o payload não prova nada se o motor ignorar a chave.
  const { banco, motor } = await montarMotor({
    circuitos: [circuito(BH), circuito(NOVO, { slug: "bh-pontos", sistema: "B", pareamento: "sorteio", max_atletas: 20, regulamento_versao: "vB-01" })],
    funcoes: { arquivar_partidas_temporada_circuito: () => null },
  });
  const r = await comoAdmin(motor, "DEFINIR_CONFIG_CIRCUITO", { circuitoId: NOVO, nome: "Circuito BH — Pontos", maxAtletas: 12 });
  ok(r.corpo?.sucesso === true, `DEFINIR_CONFIG_CIRCUITO respondeu sucesso (veio: ${JSON.stringify(r.corpo?.erro ?? r.corpo?.sucesso)})`);
  const c = banco.acha("circuitos", x => x.id === NOVO);
  igual(c?.max_atletas, 12, "o teto novo chega ao banco");
  igual(c?.regulamento_versao, "vB-01", "e a versão do regulamento NÃO é tocada por um salvamento de configuração");
}
{
  // A faixa do motor é 8..20, e ele APARA em silêncio. Isso é backstop aceitável
  // (8..20 é sempre válido), mas aparar sem dizer faria o admin digitar 50, ver
  // "salvo" e ficar com 20 sem saber — por isso a TELA bloqueia antes. As duas
  // asserções abaixo fixam o backstop; as de fonte adiante fixam o bloqueio.
  const { banco, motor } = await montarMotor({
    // ⚠️ Parte de 12, NÃO de 20: com 20 no cenário, a asserção do aparo passava
    // mesmo que o motor não escrevesse nada. Era verde pelo motivo errado.
    circuitos: [circuito(BH), circuito(NOVO, { slug: "bh-pontos", sistema: "B", pareamento: "sorteio", max_atletas: 12 })],
    funcoes: { arquivar_partidas_temporada_circuito: () => null },
  });
  await comoAdmin(motor, "DEFINIR_CONFIG_CIRCUITO", { circuitoId: NOVO, maxAtletas: 50 });
  igual(banco.acha("circuitos", x => x.id === NOVO)?.max_atletas, 20, "teto acima de 20 é aparado para 20 pelo motor");
  await comoAdmin(motor, "DEFINIR_CONFIG_CIRCUITO", { circuitoId: NOVO, maxAtletas: 3 });
  igual(banco.acha("circuitos", x => x.id === NOVO)?.max_atletas, 8, "e abaixo de 8 é elevado para 8 — o mínimo do Cap. 13");
}
{
  // Baixar o teto NÃO tira ninguém: ele é conferido só na ENTRADA. Provado
  // executando, porque é exatamente o medo de quem vai mexer no campo novo.
  const ATL = "cccc0001-0000-4000-8000-000000000001";
  const { banco, motor } = await montarMotor({
    circuitos: [circuito(BH), circuito(NOVO, { slug: "bh-pontos", sistema: "B", pareamento: "sorteio", max_atletas: 20 })],
    atletas: [atleta(ATL, { status: "ativo", pendente_circuito: false })],
    circuito_atletas: [{ id: "mmmm0001-0000-4000-8000-000000000001", circuito_id: NOVO, atleta_id: ATL, status: "ativo", pendente_circuito: false, saldo_temp: 0, vitorias: 0, derrotas: 0 }],
    funcoes: { arquivar_partidas_temporada_circuito: () => null },
  });
  const antes = banco.tabelas.circuito_atletas.filter(m => m.circuito_id === NOVO && m.status === "ativo").length;
  await comoAdmin(motor, "DEFINIR_CONFIG_CIRCUITO", { circuitoId: NOVO, maxAtletas: 8 });
  const depois = banco.tabelas.circuito_atletas.filter(m => m.circuito_id === NOVO && m.status === "ativo").length;
  igual(depois, antes, "baixar o teto NÃO remove ninguém do circuito — ele só fecha a entrada");
}

// ───────────────────────────────────────────────────────────────────────────────
secao("A tela deixou de mentir sobre o teto, e passou a mostrar o regulamento");
{
  // A frase que estava no card de configuração até 28/09/2026.
  ok(!/O teto é fixo em 20 atletas por circuito/.test(fonteSemComentario),
    "a afirmação 'o teto é fixo em 20 atletas por circuito' saiu da tela — ela era falsa desde que a criação passou a perguntar");

  // O campo novo, e o bloqueio em vez do aparo silencioso.
  // Mesma redação nos dois lugares (criação e configuração) — eram "Máx. de
  // atletas" e "Máximo de atletas no circuito", com duas ajudas quase iguais.
  igual((fonte.match(/>Máx\. de atletas<\/(div|label)>/g) || []).length, 2,
    "o campo do teto tem a MESMA redação na criação e na configuração");
  ok(/const tetoValido = Number\(tetoEdit\) >= 8 && Number\(tetoEdit\) <= 20;/.test(fonte),
    "e a tela valida a mesma faixa do motor (8 a 20)");
  ok(/disabled=\{!tetoValido\}/.test(fonte),
    "e BLOQUEIA o salvamento fora da faixa, em vez de deixar o motor aparar em silêncio");
  // O MOTIVO do botão morto fica imediatamente abaixo dele — padrão da casa. Em
  // f229432 ele estava a ~78px, atrás de um bloco com borda própria.
  ok(/Ajuste o teto para um número entre 8 e 20 para poder salvar\./.test(fonte),
    "e o motivo do botão desabilitado está escrito, logo abaixo dele");

  // ── CONTRASTE: cor semântica na BORDA/FUNDO, nunca no texto pequeno ───────
  // Em f229432 os três tons do card ficaram em 3,00 / 3,06 / 3,96:1 — todos
  // abaixo dos 4,5:1 que a WCAG AA pede para texto pequeno — e na ordem errada:
  // o texto "está normal" era o mais legível e os dois de alerta os menos. Esta
  // lição já estava escrita neste mesmo arquivo, sobre esta mesma cor, na
  // `AcaoErroBar`. Elemento gráfico tem piso 3:1; texto pequeno, 4,5:1.
  const cardCfg = fonte.slice(fonte.indexOf("⚙️ Configuração do circuito"), fonte.indexOf("💾 Salvar", fonte.indexOf("⚙️ Configuração do circuito")));
  ok(cardCfg.length > 0, "o card de configuração foi localizado no fonte");
  ok(!/fontSize:11,color:"#c25a45"/.test(cardCfg) && !/color: tetoValido \? "#7d9188" : "#c25a45"/.test(cardCfg),
    "nenhum texto de 11px do card usa #c25a45, que dá 3,06:1 — abaixo do mínimo de 4,5:1");
  ok(!/fontSize:11,color:"#9C6F3E"/.test(cardCfg),
    "nem #9C6F3E, que dá 3,00:1");
  ok(/borderLeft:"3px solid #c25a45"/.test(cardCfg) && /borderLeft:"3px solid #9C6F3E"/.test(cardCfg),
    "as duas cores semânticas vivem na BORDA, onde o piso é 3:1 e elas passam");
  ok(/color:"#f8c4b4"/.test(cardCfg) && /color:"#e8c9a0"/.test(cardCfg),
    "e o texto dos dois avisos usa tons legíveis — #f8c4b4 (8,55:1) e #e8c9a0");
  // Manda só o que MUDOU: antes ia `nome` e `maxAtletas` sempre, então quem
  // entrava para corrigir o nome regravava o teto — e no BH reescrevia
  // `configuracao.nome_circuito` a cada gravação de teto.
  ok(/payload\.maxAtletas = Number\(tetoEdit\);/.test(fonte),
    "o Salvar manda o teto quando ele mudou");
  ok(/if \(Object\.keys\(payload\)\.length === 0\) return;/.test(fonte),
    "e não chama o servidor quando nada mudou");
  ok(!/payload:\{nome:nomeEdit\.trim\(\)\|\|"Clube do Tênis de Mesa", maxAtletas:/.test(fonte),
    "e a forma que mandava os dois sempre não voltou");

  // O aviso de baixar o teto com o circuito mais cheio que ele.
  // ⚠️ `<=`, não `<`. A fila do backlog congela quando `teto <= dentro`, não só
  // quando é menor — com 8 dentro e teto 8, zero promovidos e, antes, zero aviso.
  ok(/const tetoFechaEntrada = tetoValido && Number\(tetoEdit\) <= ativosNoCircuito;/.test(fonte),
    "o aviso dispara quando o teto FECHA A ENTRADA (<=), não só quando é menor que os de dentro");
  ok(!/Number\(tetoEdit\) < ativosNoCircuito/.test(fonteSemComentario),
    "e a forma `<`, que deixava o caso 'teto igual ao número de dentro' sem aviso, não voltou");
  ok(/atletas no backlog deixam de entrar automaticamente/.test(fonte),
    "e o aviso nomeia quem de fato é afetado: os do backlog, que param de entrar");
  ok(/não tira ninguém/.test(fonte),
    "e diz o que acontece de verdade — não tira ninguém, só fecha a entrada");
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
  ok(/if \(p\.maxAtletas !== undefined\) \{/.test(motorFonte),
    "e o teto continua sendo a única coisa nova que a configuração escreve");
  ok(/if \(!Number\.isFinite\(n\)\) return jsonResponse/.test(motorFonte),
    "e um teto não-numérico é RECUSADO, não vira 20 em silêncio — o resto do motor recusa em vez de adivinhar");
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
