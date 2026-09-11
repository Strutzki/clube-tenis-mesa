// Bateria — CADA CIRCUITO VÊ O REGULAMENTO DELE.
//
// Até 10/09/2026 a `RegulamentoView` escolhia o texto só pelo SISTEMA (A ou B).
// Como só existia um circuito de rating (o BH), isso funcionava por coincidência.
// No dia em que nascesse um 2º circuito de rating, ele herdaria o regulamento do
// BH inteiro — **incluindo o Cap. 10, o Torneio Presencial de Encerramento**, que
// não é dele. O atleta leria, e ACEITARIA, a regra de um torneio que o circuito
// dele não tem.
//
// A diferença entre as duas versões de rating é SÓ esse capítulo. Fui conferir se
// havia também diferença de prazo (o `REGULAMENTOS_NOVOS_CIRCUITOS.md` listava o
// dia 27 como mudança dos circuitos novos): não há — o v03-12 do BH já usa o dia
// 27, e quem tinha dia 25 eram as versões antigas, v03-4 e v03-11.
//
// Estas asserções travam três coisas: que o BH continua com o torneio, que a
// escolha vem do DADO (`circuitos.regulamento_versao`) e não do sistema, e que
// versão desconhecida é fail-closed — não ganha o capítulo.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ok, igual, secao, placar } from "./ferramentas.mjs";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bruto = fs.readFileSync(path.join(RAIZ, "src", "App.jsx"), "utf8");
const semComentarios = t => t.split("\n").filter(l => !/^\s*(\/\/|\{?\/\*)/.test(l)).join("\n");
const fonte = semComentarios(bruto);

secao("A escolha do regulamento vem do dado, não do sistema");
{
  ok(/const\s+VERSOES_COM_TORNEIO\s*=\s*new Set\(\[/.test(fonte),
    "existe uma lista explícita de versões que incluem o torneio");

  // Fail-closed: `.has()` sobre uma lista branca. Se virasse `!VERSOES_SEM_...`
  // ou qualquer forma que aceite o desconhecido, um circuito novo voltaria a
  // herdar o torneio do BH sem ninguém perceber.
  ok(/const\s+comTorneio\s*=\s*VERSOES_COM_TORNEIO\.has\(/.test(fonte),
    "versão desconhecida NÃO ganha o capítulo do torneio (fail-closed)");

  // A prop tem de existir e ser passada — sem ela a ramificação nunca dispara.
  ok(/function RegulamentoView\(\{[^}]*\bversao\b/.test(fonte),
    "a RegulamentoView recebe a versão do regulamento");
  ok(/versao=\{escolhido\.regulamento_versao\}/.test(fonte),
    "a tela de inscrição passa a versão do circuito escolhido");

  // A versão precisa chegar do banco: a RPC de vagas não a devolve, então há uma
  // leitura própria. Sem ela, `versao` é sempre nulo e o app cai no padrão.
  ok(/regulamento_versao/.test(fonte) && /getVersoesRegulamento/.test(fonte),
    "o app busca regulamento_versao do banco para casar com cada circuito");
}

secao("O BH não perde o capítulo dele");
{
  // PRIMEIRO o código de verdade. A simulação abaixo prova que a REGRA está
  // certa, mas não que o app a aplica — se alguém tirar o filtro da fonte, a
  // simulação segue verde. Foi o que aconteceu ao testar a mutação desta
  // asserção pela 1ª vez, e é por isso que esta linha existe.
  ok(/\.filter\(c => comTorneio \|\| c\.id !== 10\)/.test(fonte),
    "a montagem dos capítulos filtra o torneio quando a versão não o tem");
  ok(/\.map\(\(c, i\) => \(\{ \.\.\.c, tag: `Cap\. \$\{String\(i \+ 1\)/.test(fonte),
    "o rótulo é renumerado pela posição, sem mexer no id que busca o conteúdo");

  // Reproduz a montagem: filtrar o Cap. 10 e renumerar SÓ o rótulo (o conteúdo é
  // buscado por `id`, que não muda).
  const capsBase = Array.from({ length: 14 }, (_, i) => ({ id: i + 1 }));
  const COM_TORNEIO = new Set(["v03-12"]);
  const montar = (versao, sistema) => {
    const v = versao || (sistema === "B" ? "vB-01" : "v03-12");
    const comTorneio = COM_TORNEIO.has(v);
    return capsBase
      .filter(c => comTorneio || c.id !== 10)
      .map((c, i) => ({ id: c.id, tag: `Cap. ${String(i + 1).padStart(2, "0")}` }));
  };

  const bh = montar("v03-12", "A");
  igual(bh.length, 14, "BH mantém os 14 capítulos");
  ok(bh.some(c => c.id === 10), "BH mantém o Torneio Presencial (Cap. 10)");
  igual(bh[13].tag, "Cap. 14", "a numeração do BH não muda");

  const novo = montar("vA-nc-01", "A");
  igual(novo.length, 13, "circuito de rating novo fica com 13 capítulos");
  ok(!novo.some(c => c.id === 10), "circuito de rating novo NÃO recebe o torneio");
  igual(novo[12].tag, "Cap. 13", "os capítulos seguintes são renumerados");

  // Sem versão (chamada genérica, antes de escolher circuito) tem de se comportar
  // como o app se comportava antes — falha de leitura não pode regredir o BH.
  const semVersao = montar(null, "A");
  igual(semVersao.length, 14, "sem versão, o sistema A mantém o comportamento antigo");
  ok(semVersao.some(c => c.id === 10), "sem versão, o torneio continua aparecendo (sem regressão)");
}

secao("A premissa: nenhum resquício de torneio para quem não tem torneio");
{
  // ESTA é a asserção que faltava, e a ausência dela deixou passar o defeito.
  // As outras testam o MECANISMO (existe filtro? a prop é passada?). Nenhuma
  // testava a PROSA — e o torneio estava citado em QUATRO capítulos além do
  // Cap. 10, dois deles falando de dinheiro (uma taxa cobrada por um evento
  // inexistente, e o torneio listado no que a temporada compra). Dois guardiões
  // acharam isso independentemente; a bateria, não.
  //
  // Regra: toda menção a torneio no regulamento de rating tem de estar atrás de
  // `comTorneio`. Sabote tirando o `comTorneio ?` de qualquer uma e isto fica
  // vermelho.
  const MENCOES = [
    "convocados para o torneio presencial de encerramento",
    "taxa individual do torneio presencial de encerramento",
    "Elegível ao torneio presencial normalmente se atingir top 8",
    "Elegibilidade para o torneio presencial (via ranking)",
    "Torneio presencial: mês imediatamente seguinte",
    "disputam torneio presencial",
    // As duas que faltavam, e que deixaram passar a caixa "Estrutura do Ano":
    // o exemplo de datas nomeia o torneio DUAS vezes, e o bullet dos meses
    // contradizia, uma linha abaixo, o parágrafo já ramificado.
    "torneio em agosto",
    "Janeiro, julho e dezembro: meses sem rodadas",
    // A SEXTA, que escapou de três varreduras — inclusive das minhas. Aqui
    // "torneio" é sinônimo de competição, não do evento; mas num documento de
    // onde o torneio foi retirado de propósito, lê como contradição.
    "o torneio continua normalmente",
  ];
  for (const m of MENCOES) {
    const i = fonte.indexOf(m);
    ok(i > 0, `a menção ao torneio existe no fonte: "${m.slice(0, 40)}…"`);
    // Procura `comTorneio` na vizinhança anterior — é o guarda que a esconde.
    const antes = fonte.slice(Math.max(0, i - 320), i);
    ok(/comTorneio/.test(antes),
      `a menção "${m.slice(0, 34)}…" está atrás de comTorneio`);
  }

  // O RECESSO continua ramificado (o vA-nc-01 o define como configurável).
  // O TETO não: o Juliano decidiu em 10/09 que é 20 para todo circuito, com
  // mínimo 10 — então ramificá-lo seria mentir para o circuito novo. A regra do
  // teto é verificada na seção "Teto do circuito", contra o motor.
  {
    const i = fonte.indexOf("janeiro, julho e dezembro reservados");
    ok(i > 0 && /comTorneio/.test(fonte.slice(Math.max(0, i - 320), i)),
      "os meses de recesso estão atrás de comTorneio (o vA-nc-01 os define como configuráveis)");
  }
}

secao("O conteúdo da lista de versões, não só a forma");
{
  // O guardião do atleta sabotou acrescentando "vA-nc-01" à lista — ou seja,
  // reintroduziu o defeito — e as 192 asserções continuaram VERDES, porque elas
  // checavam `new Set([` e `.has(` por regex e a simulação reimplementava a
  // lista dentro do próprio teste. É o vício que o CLAUDE.md descreve no harness
  // antigo: "reescreve a lógica dentro dele, e por isso continua verde mesmo com
  // o motor quebrado". Agora a lista é LIDA do fonte.
  const m = fonte.match(/const VERSOES_COM_TORNEIO = new Set\(\[([^\]]*)\]\)/);
  ok(!!m, "a lista de versões com torneio foi encontrada e pôde ser lida");
  const versoes = [...(m ? m[1] : "").matchAll(/"([^"]+)"/g)].map(x => x[1]);
  igual(versoes.join(","), "v03-12",
    `só o v03-12 tem torneio (achadas: ${versoes.join(", ") || "nenhuma"})`);
}

secao("O portão do aceite usa a versão do circuito");
{
  // O resumo do passo 3 é uma lista PRÓPRIA, dentro do InscricaoForm — não é a
  // RegulamentoView. Corrigir só a tela longa deixava o portão do aceite
  // prometendo torneio e nomeando a versão errada.
  ok(/const versaoReg = \(circ && circ\.regulamento_versao\)/.test(fonte),
    "a versão do formulário de inscrição vem do circuito, não do sistema");
  ok(/const comTorneio = VERSOES_COM_TORNEIO\.has\(versaoReg\)/.test(fonte),
    "o resumo do passo 3 sabe se o circuito tem torneio");
  ok(/\(versão \{versaoReg\}\)/.test(fonte),
    "a frase de ACEITE nomeia a versão vinda do dado");
  ok(!/\(versão v03-12\)/.test(fonte),
    "a frase de aceite não crava mais v03-12");
}

secao("Não sobra referência a número de capítulo");
{
  // A renumeração quebrou uma referência cruzada ("Sem novas entradas (Cap. 11)"
  // passou a apontar para o próprio capítulo onde está). Nomear o capítulo pelo
  // título mata a classe inteira do defeito: título não renumera.
  // Escopado ao CORPO do regulamento — é ele que renumera. Fora dali existem
  // referências a "(Cap. NN)" em comentários de código e em telas do admin
  // (7672, 7939, 8031, 8796): essas ficam off-by-one para um circuito de rating
  // novo, mas mexer nelas mexeria na tela do BH, e a instrução do Juliano em
  // 10/09 foi explícita — nada pode mudar para o circuito que está rodando.
  // Registrado como divergência conhecida no ROADMAP.
  // A regra mudou depois que o Juliano foi explícito: o BH não pode ter NENHUM
  // texto alterado. Então a referência numerada FICA para ele — ela está certa
  // no mundo dele, onde a numeração nunca muda. O que não pode existir é
  // referência numerada DESGUARDADA, que é a que quebraria no circuito novo.
  const corpo = fonte.slice(fonte.indexOf("function RegulamentoView"), fonte.indexOf("const CAPS_B"));
  const refs = [...corpo.matchAll(/\(Cap\. \d+\)/g)];
  const desguardadas = refs.filter(m => !/comTorneio/.test(corpo.slice(Math.max(0, m.index - 200), m.index)));
  igual(desguardadas.length, 0,
    `nenhuma referência por número FORA do guarda (achadas: ${desguardadas.map(m=>m[0]).join(", ") || "nenhuma"})`);
  ok(refs.length > 0, "o BH mantém a referência numerada que ele já tinha");
}

secao("Nada do texto do BH foi reescrito");
{
  // A instrução do Juliano em 10/09: nada muda para o circuito que está rodando.
  // A prova anterior ("as frases do BH continuam no fonte") só mostrava que nada
  // SUMIU — e por esse buraco passou uma referência cruzada que eu reescrevi
  // para todos, inclusive para o BH. Agora: todo literal que o ramo
  // comTorneio=true entrega tem de ser texto que já existia.
  const ramo = [...fonte.matchAll(/comTorneio \? "([^"]{20,})"/g)].map(m => m[1]);
  ok(ramo.length >= 4, `o ramo do BH entrega textos literais (achados: ${ramo.length})`);

  // A referência cruzada tem de continuar numerada PARA O BH.
  ok(/comTorneio \? "Sem novas entradas \(Cap\. 11\)"/.test(fonte),
    "o BH mantém a referência como estava; só o circuito novo recebe o nome do capítulo");
}

secao("O espelho local carimba a versão do circuito");
{
  // A correção anterior era INERTE: eu lia `action.payload.versaoRegulamento`,
  // mas nada mandava o campo, então o fallback "v03-12" disparava sempre.
  ok(/versaoRegulamento: versaoReg,/.test(fonte),
    "a inscrição envia a versão do circuito escolhido no payload");
}

secao("O rodapé diz a versão real");
{
  const rodapes = (fonte.match(/Regulamento \{versaoEfetiva\}/g) || []).length;
  igual(rodapes, 2, "os dois rodapés (rating e pontos) dizem a versão vinda do dado");
  ok(!/Regulamento v03-12<\/div>/.test(fonte),
    "nenhum rodapé crava v03-12");
}

secao("O motor carimba a versão certa em circuito novo");
{
  const motor = fs.readFileSync(path.join(RAIZ, "supabase", "functions", "admin-action", "index.ts"), "utf8");

  // A tela deixar de mostrar o torneio não basta: se o circuito novo continuar
  // nascendo com v03-12 no banco, o app mostra corretamente o regulamento
  // ERRADO. As duas metades têm de andar juntas.
  ok(/regulamento_versao:\s*sistema === "A" \? "vA-nc-01" : "vB-01"/.test(motor),
    "CRIAR_CIRCUITO carimba vA-nc-01 no circuito de rating novo, não o v03-12 do BH");

  // E o v03-12 não pode voltar a ser carimbado em lugar nenhum do motor.
  const carimbos = (motor.match(/regulamento_versao:\s*[^,\n]*v03-12/g) || []).length;
  igual(carimbos, 0, "nenhum ponto do motor grava v03-12 num circuito novo");

  // O BH continua sendo v03-12 — isso é DADO, não código. A asserção aqui é só
  // que o motor não tem caminho para reescrever a versão de um circuito que já
  // existe: a linha vive no insert do CRIAR_CIRCUITO.
  const trecho = motor.slice(motor.indexOf('case "CRIAR_CIRCUITO"'), motor.indexOf('case "CRIAR_CIRCUITO"') + 5000);
  ok(/regulamento_versao/.test(trecho),
    "o carimbo da versão está no CRIAR_CIRCUITO (insert), não num update");
}

secao("Teto do circuito: a regra e o motor concordam");
{
  const motor = fs.readFileSync(path.join(RAIZ, "supabase", "functions", "admin-action", "index.ts"), "utf8");
  // Decisão do Juliano, 10/09: teto 20, mínimo 10. O motor não fazia valer:
  // criação sem limite superior, edição com mínimo 2. Os dois pontos precisam
  // usar a MESMA regra, senão o texto que o atleta aceita ("teto de 20") mente.
  // Regra do Juliano, 10/09: máximo 20 atletas por circuito, mínimo 8. O 8 é o
  // ponto abaixo do qual o pareamento REPETE confrontos na mesma temporada de 6
  // rodadas — é a razão do "mínimo 8 ativos" do Cap. 13, não um número solto.
  const clamps = (motor.match(/Math\.min\(20, Math\.max\(8,/g) || []).length;
  igual(clamps, 2, `criação e edição usam o mesmo limite 8..20 (achados: ${clamps})`);
  ok(!/Math\.max\(2, Math\.round\(Number\(p\.maxAtletas\)/.test(motor),
    "a edição não aceita mais teto abaixo do mínimo");

  // A TELA tem de barrar antes: sem limite superior nela, o organizador digitava
  // 50, o botão acendia, o motor cortava para 20 em silêncio e ninguém avisava.
  // Achado independente do guardião de regulamento E do de segurança.
  ok(/Number\(maxAtletas\) >= 8 && Number\(maxAtletas\) <= 20/.test(fonte),
    "a tela de criação barra fora da faixa 8..20, em vez de deixar o motor cortar calado");
  ok(/De 8 a 20 atletas\./.test(fonte),
    "a legenda diz a faixa inteira, não só o mínimo");

  // E o texto do regulamento volta a dizer 20 nos dois ramos — não é mais
  // configurável, então ramificá-lo seria mentir para o circuito novo.
  ok(/"Cada circuito tem um teto de 20 atletas por temporada"/.test(fonte),
    "o regulamento diz teto de 20 para todos os circuitos");
}

secao("A frase de preço não é garantia absoluta");
{
  // O Guardião Jurídico: quem escreve o regulamento é a plataforma, mas quem
  // cobra num circuito novo é o ORGANIZADOR. Afirmar "não há custo adicional"
  // criaria obrigação da plataforma sobre preço de terceiro (CDC art. 30).
  ok(/não prevê custo adicional obrigatório/.test(fonte),
    "o texto diz o que o regulamento prevê, não o que o organizador vai cobrar");
  ok(!/Não há custo adicional<\/span> além do valor da temporada\.<\/>/.test(fonte),
    "não sobrou a garantia absoluta de preço");
}

placar("Regulamento por circuito");
