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
import { ok, igual, secao, placar, montarMotor, comoAdmin, atleta, partida, circuito, BH } from "./ferramentas.mjs";
// O `athlete-action` também é carregado de verdade aqui — a guarda que recusa
// inscrição sem versão de regulamento mora nele, não no admin-action.
import { carregarFuncao } from "./carrega-motor.mjs";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bruto = fs.readFileSync(path.join(RAIZ, "src", "App.jsx"), "utf8");
// ⚠️ TIRA COMENTÁRIO DE BLOCO ANTES DA FILTRAGEM POR LINHA.
// O filtro por linha sozinho só reconhece a linha que ABRE o comentário — as
// continuações de um `{/* ... */}` de várias linhas sobreviviam. Isso fez uma
// asserção que PROÍBE um texto ficar vermelha por causar do comentário que
// EXPLICAVA por que aquele texto saiu (29/09/2026, e foi a quarta vez no mesmo dia
// que uma asserção se afogou na própria explicação). Uma asserção que não consegue
// distinguir o código do comentário sobre o código não protege nada.
const semComentarios = t => t
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")   // {/* ... */} do JSX
  .replace(/\/\*[\s\S]*?\*\//g, "")                // /* ... */ comum
  .split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
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
  // As DUAS versões do BH, e nenhuma outra. A v03-13 entrou em 13/09/2026: ela
  // tira o desconto por etapa do BH mas MANTÉM o Cap. 10, que é dele. Qualquer
  // terceira versão aqui significa circuito novo herdando o torneio do BH.
  igual(versoes.join(","), "v03-12,v03-13",
    `só as versões do BH têm torneio (achadas: ${versoes.join(", ") || "nenhuma"})`);
}

secao("O portão do aceite usa a versão do circuito");
{
  // O resumo do passo 3 é uma lista PRÓPRIA, dentro do InscricaoForm — não é a
  // RegulamentoView. Corrigir só a tela longa deixava o portão do aceite
  // prometendo torneio e nomeando a versão errada.
  // Ancorada no `versaoLida`, que é de onde o `versaoReg` passou a vir em
  // 17/09 — a leitura do circuito, aparada, e sem nenhum fallback por sistema.
  ok(/const versaoLida = String\(\(circ && circ\.regulamento_versao\) \|\| versaoRetry \|\| ""\)\.trim\(\);/.test(fonte),
    "a versão do formulário de inscrição vem do circuito, não do sistema");
  ok(!/\(ehB \? "vB-01" : "v03-12"\)/.test(fonte),
    "e não sobrou fallback por sistema em lugar nenhum do formulário");
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
  // O rótulo passou a ser `versaoLabelRodape` em 13/09: com versão não
  // confirmada ele diz "versão não confirmada" em vez de renderizar vazio.
  const rodapes = (fonte.match(/Regulamento \{versaoLabelRodape\}/g) || []).length;
  igual(rodapes, 2, "os dois rodapés (rating e pontos) dizem a versão vinda do dado");
  ok(/const versaoLabelRodape = versaoEfetiva \|\| "versão não confirmada"/.test(fonte),
    "o rodapé não inventa número de versão quando não sabe");
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

secao("Teto do circuito: 20 para todos, e o regulamento diz isso");
{
  const motor = fs.readFileSync(path.join(RAIZ, "supabase", "functions", "admin-action", "index.ts"), "utf8");

  // ⚠️ ESTA SEÇÃO JÁ DEFENDEU OS DOIS LADOS, E A HISTÓRIA PRECISA FICAR ESCRITA,
  // porque ela é o registro de uma decisão do Juliano — não de uma correção técnica.
  //
  //  10/09/2026 — decisão dele: o teto é regra da PLATAFORMA, 20 para todos.
  //  27/09/2026 — o Guardião do Regulamento notou que o CÓDIGO não fazia isso: a
  //               criação perguntava o teto (8 a 20). Eu tratei como defeito do
  //               TEXTO e mudei o regulamento para "até 20, definido pelo
  //               organizador", alinhando a prosa ao código. Estas asserções
  //               nasceram então, carimbando aquela redação.
  //  29/09/2026 — perguntei a ele, e a decisão de 10/09 **fica de pé**: o teto é
  //               da plataforma. Ou seja, em 27/09 eu alinhei o lado errado —
  //               quem estava fora da decisão era o código, não o texto.
  //
  // E isso tem uma consequência que vale mais que a regra: a linha do teto é
  // CONTEÚDO COMPARTILHADO do Sistema A, então ela renderiza para o **v03-12**,
  // que TEM aceite gravado. A troca de 27/09 alterou o texto que aquele recibo
  // aponta, sem re-aceite — um desvio da regra 7, cometido por mim e não
  // registrado. Voltar a "teto de 20" **restaura** o texto original e desfaz o
  // desvio, em vez de criar outro.
  const clamps = (motor.match(/Math\.min\(20, Math\.max\(8,/g) || []).length;
  igual(clamps, 0, `nem a criação nem a configuração aparam um teto por circuito (achados: ${clamps})`);
  ok(/const maxAtletas = 20;/.test(motor),
    "o motor CRAVA 20 na criação — o `p.maxAtletas` do cliente é ignorado de propósito");
  const cfg = motor.slice(motor.indexOf('case "DEFINIR_CONFIG_CIRCUITO"'), motor.indexOf('case "', motor.indexOf('case "DEFINIR_CONFIG_CIRCUITO"') + 10));
  ok(!/max_atletas/.test(cfg),
    "e a configuração do circuito não escreve o teto — nem a de um organizador");

  // A tela não pergunta o teto em lugar nenhum, e AVISA qual é.
  ok(!/Number\(maxAtletas\)/.test(fonte),
    "nenhuma tela pergunta o teto do circuito");
  ok(/Todo circuito tem teto de <strong[^>]*>20 atletas<\/strong> por temporada/.test(fonte),
    "e a criação avisa qual é o teto, para o admin não descobrir depois");
  ok(/é regra da plataforma, igual para todos, e não se configura por circuito/.test(fonte),
    "dizendo que é regra da plataforma, não escolha dele");

  // E os TRÊS textos do regulamento voltaram a dizer a verdade.
  //
  // ⚠️ AS DUAS ASSERÇÕES ABAIXO JÁ PASSARAM PELO MOTIVO ERRADO, e vale dizer como,
  // porque é o defeito mais teimoso desta bateria. A positiva casava
  // `/teto de 20 atletas por temporada/` — que o texto de PONTOS também contém —
  // então ela ficava verde com o texto de RATING sabotado. E a negativa proibia
  // "até 20, definido pelo organizador", que é a redação do texto de PONTOS: o de
  // rating diz "até 20 ATLETAS POR TEMPORADA, definido pelo organizador", com
  // quatro palavras no meio. A regex nunca casava com o que ela existia para
  // proibir. Medido por mutação: a troca do texto de rating passava VERDE.
  // Agora cada asserção é ancorada na frase INTEIRA do seu próprio texto.
  ok(/"Cada circuito tem um teto de 20 atletas por temporada",/.test(fonte),
    "o regulamento de RATING (compartilhado com o v03-12) diz teto de 20, fixo");
  ok(!/teto de até 20 atletas/.test(fonte),
    "e a redação de 27/09, que prometia teto por circuito, não pode voltar ao texto de rating");
  ok(!/definido pelo organizador"/.test(fonte),
    "nem por outra forma de dizer a mesma coisa");
  ok(/"Após o prazo de prioridade, as vagas não confirmadas abrem para a fila de espera, respeitando o teto de 20 atletas do circuito",/.test(fonte),
    "a cláusula da fila de espera também diz 20, não 'até 20'");
  ok(/O circuito tem um teto de 20 atletas por temporada<\/span> — regra da plataforma, igual para todos\./.test(fonte),
    "e o regulamento de PONTOS diz o mesmo, na frase inteira");
  ok(!/até 20, definido pelo organizador/.test(fonte),
    "e a redação antiga do texto de pontos também não volta");
}

secao("O mínimo de 8 para começar: os DOIS regulamentos prometem, o motor cumpre nos DOIS sistemas");
{
  // Pergunta do Juliano, 29/09/2026: "o mínimo de 8 está garantido nos dois modelos
  // de circuito?". Fui medir antes de responder, e a resposta era NÃO — não no
  // sentido que importa. O motor cumpria; o que não existia era **portão**.
  //
  // A única asserção sobre o mínimo 8 era `/no mínimo 8 atletas/.test(fonte)` — uma
  // regex no TEXTO do regulamento. Ela prova que o app PROMETE, não que ele CUMPRE.
  // Medido por mutação: trocar `ativos.length < 8` por `< 2` ou `< 4` no
  // `INICIAR_ETAPA` deixava a bateria **VERDE**. É a armadilha que o CLAUDE.md
  // descreve com todas as letras — "regex passa verde com a regra quebrada" — e
  // aqui ela guardava uma promessa que está nos DOIS regulamentos.
  //
  // Onde a regra vive, e por que ela vale para os dois sistemas: a guarda está no
  // `INICIAR_ETAPA`, **antes** de o motor chamar `getSistema`. Não é coincidência
  // feliz; é o que torna a regra transversal. Estas asserções fixam isso rodando o
  // motor de verdade em circuito A e em circuito B.
  const AT = (n) => `aaaa000${n}-0000-4000-8000-0000000001${n}${n}`;
  const CIRC_A = "44444444-4444-4444-4444-444444444444";
  const CIRC_B = "55555555-5555-5555-5555-555555555555";

  async function cenario(circuitoId, sistema, quantos) {
    const atletas = [], membros = [];
    for (let n = 0; n < quantos; n++) {
      atletas.push(atleta(AT(n), { nome: `Atleta ${n}`, rating: 700 + n * 10 }));
      membros.push({ id: `m8-${n}`, circuito_id: circuitoId, atleta_id: AT(n), status: "ativo", pendente_circuito: false, saldo_temp: 0, vitorias: 0, derrotas: 0 });
    }
    const { motor, banco } = await montarMotor({
      circuitos: [circuito(BH), circuito(circuitoId, { slug: sistema === "B" ? "pontos" : "rating", sistema, pareamento: sistema === "B" ? "grupos" : null, fase: "inscricoes" })],
      atletas, circuito_atletas: membros, chaves: [],
      funcoes: { arquivar_partidas_temporada_circuito: () => null },
    });
    const r = await comoAdmin(motor, "INICIAR_ETAPA", { circuitoId });
    return { r, banco };
  }

  for (const [sistema, circuitoId, rotulo] of [["A", CIRC_A, "rating"], ["B", CIRC_B, "pontos"]]) {
    // 7 ativos: RECUSA, e nada é escrito.
    const sete = await cenario(circuitoId, sistema, 7);
    igual(sete.r.status, 400, `Sistema ${sistema} (${rotulo}): com 7 ativos a etapa NÃO começa`);
    ok(/Mínimo de 8 atletas ativos/.test(String(sete.r.corpo?.erro || "")),
      `Sistema ${sistema}: e a recusa diz o número que o regulamento promete`);
    ok(/atual: 7/.test(String(sete.r.corpo?.erro || "")),
      `Sistema ${sistema}: e diz quantos há, para o admin saber quantos faltam`);
    igual(sete.banco.linhas("partidas").length, 0,
      `Sistema ${sistema}: e NENHUMA partida é criada — a recusa não deixa meio-estado`);
    igual(sete.banco.linhas("chaves").length, 0,
      `Sistema ${sistema}: nem chave`);

    // 8 ativos: a fronteira exata. Começa.
    const oito = await cenario(circuitoId, sistema, 8);
    igual(oito.r.status, 200, `Sistema ${sistema}: com 8 ativos — o número exato do Cap. 13 — a etapa COMEÇA`);
    igual(oito.r.corpo?.dados?.atletas, 8, `Sistema ${sistema}: com os 8`);
    ok(oito.banco.linhas("partidas").length > 0, `Sistema ${sistema}: e as partidas são geradas`);
  }

  // A guarda tem de ficar ANTES de o motor saber o sistema — é o que a torna
  // transversal. Se ela migrar para dentro de um ramo por sistema, um dos dois
  // circuitos fica sem ela, e nenhum teste de comportamento acusaria enquanto o
  // outro ramo continuasse certo.
  const motorFonte = fs.readFileSync(path.join(RAIZ, "supabase", "functions", "admin-action", "index.ts"), "utf8");
  const iniciar = motorFonte.slice(motorFonte.indexOf('case "INICIAR_ETAPA"'), motorFonte.indexOf('case "', motorFonte.indexOf('case "INICIAR_ETAPA"') + 10));
  ok(iniciar.indexOf("ativos.length < 8") < iniciar.indexOf("getSistema"),
    "a guarda do mínimo 8 roda ANTES de o motor perguntar qual é o sistema — por isso vale para os dois");

  // E a OUTRA metade da regra, que é igual de importante: os dois regulamentos
  // dizem que, se o número cair abaixo de 8 DURANTE a temporada, ela CONTINUA.
  // Então o `AVANCAR_RODADA` NÃO pode ganhar uma guarda de 8 — e alguém "consertando"
  // por simetria quebraria a promessa. O piso lá é 2, que é o mínimo para existir
  // uma partida.
  const avancar = motorFonte.slice(motorFonte.indexOf('case "AVANCAR_RODADA"'), motorFonte.indexOf('case "', motorFonte.indexOf('case "AVANCAR_RODADA"') + 10));
  ok(!/ativos\.length < 8/.test(avancar),
    "avançar rodada NÃO exige 8 — os dois regulamentos prometem que a temporada continua se o número cair");
  ok(/ativos\.length < 2/.test(avancar),
    "o piso de avançar é 2, que é o mínimo para existir uma partida");
}

secao("O regulamento só fala do circuito em que o atleta está entrando (29/09/2026)");
{
  // Decisão do Juliano: "o regulamento deve desvincular totalmente de circuitos
  // anteriores e só tratar o circuito que o atleta está se inscrevendo".
  //
  // O Cap. 2 era o capítulo mais "do BH" do texto COMPARTILHADO: "A Temporada 1
  // inicia com o ranking masculino adulto (18+)", uma tabela com coluna chamada
  // "Temporada 1", e categorias que são fato do clube dele. Havia um TODO marcando
  // isso desde antes — e um 2º circuito de rating leria tudo como se fosse seu.
  //
  // O app NÃO TEM o dado: `circuitos` não tem coluna de categoria. Então o texto
  // neutro não inventa uma — diz que quem define é o organizador. Afirmar um perfil
  // que ninguém cadastrou seria a mesma falha que o "teto de 20" quando o teto era
  // configurável: prometer o que o dado não sustenta.
  ok(/const VERSOES_DO_BH = new Set\(\["v03-12", "v03-13"\]\);/.test(fonte),
    "as versões do BH são nomeadas — para os atletas dele, o texto do BH é verdadeiro");
  ok(/const ehVersaoDoBH = VERSOES_DO_BH\.has\(versaoEfetiva\);/.test(fonte),
    "e o Cap. 2 ramifica por isso");
  ok(/\{ehVersaoDoBH \? <>/.test(fonte),
    "o texto do BH fica sob a condição, em vez de valer para todo circuito de rating");
  ok(/definido pelo organizador do circuito<\/span> e informado antes da abertura/.test(fonte),
    "e o circuito NOVO recebe um texto que não inventa categoria — quem define é o organizador");
  ok(/ehVersaoDoBH \? "Temporada 1" : "Neste circuito"/.test(fonte),
    "até o cabeçalho da tabela deixa de dizer 'Temporada 1' num circuito que não é o BH");
  ok(/\.\.\.\(ehVersaoDoBH \? \[\["Masculino adulto/.test(fonte),
    "e a linha da categoria piloto do BH não aparece em circuito novo");

  // Fail-closed: versão desconhecida NÃO recebe o texto do BH. Afirmar a categoria
  // de um circuito que não se conhece é pior que não afirmar nada.
  ok(!/VERSOES_DO_BH\.has\(versaoEfetiva\) \|\|/.test(fonte),
    "e não há fallback que faça versão desconhecida herdar o texto do BH");

  // O de PONTOS já nascera assim — é o controle desta seção.
  {
    const iB = fonte.indexOf("function ConteudoCapB");
    const fimB = fonte.indexOf("\nfunction ", iB + 1);
    const B = fonte.slice(iB, fimB);
    ok(!/v03-1\d/.test(B) && !/Temporada 1 /.test(B) && !/Circuito BH/.test(B),
      "o regulamento de PONTOS não menciona outra versão, outra temporada nem o BH — ele já nascera desvinculado");
  }
}

secao("O bye entra no texto de rating — na v03-13, não na v03-12 que já tem aceite");
{
  // O Juliano perguntou, em 29/09/2026: "na quantidade de atletas ímpar, me lembrar
  // qual a regra utilizada". A regra existia **no motor e em lugar nenhum do texto**:
  // o regulamento de rating não tinha uma palavra sobre bye, ímpar ou folga. O de
  // pontos sempre teve capítulo próprio.
  //
  // ⚠️ E O CAPÍTULO NÃO PODE ENTRAR NA v03-12. Ela é a versão em vigor no BH e foi
  // aceita por atletas reais; acrescentar um capítulo mudaria retroativamente o que
  // aqueles recibos provam (regra 7). Ele nasce na **v03-13**, que ainda não foi
  // carimbada, e chega aos atletas pelo re-aceite. É o mesmo desenho do
  // `VERSOES_COM_RODADAS_FIXAS`, e pela mesma razão.
  ok(/const VERSOES_COM_BYE_ESCRITO = new Set\(\["v03-13", "vA-nc-01"\]\);/.test(fonte),
    "o capítulo do bye é gatado por versão, e a v03-12 fica de fora");
  ok(/\{byeEscrito && \(/.test(fonte),
    "e o gate é consumido de verdade — não é constante morta");
  ok(/menor rating entre os que ainda não folgaram/.test(fonte),
    "o texto descreve a regra que o Juliano decidiu: menor rating, sem repetir");
  ok(/o bye tem <span style=\{s\.dest\}>rotação<\/span>/.test(fonte),
    "e diz que há rotação, com essa palavra");
  ok(/não altera o rating/.test(fonte),
    "e que a folga não mexe no rating — diferente do Sistema B, onde ela vale 1 ponto");
  ok(/nunca<\/span> dão bye à mesma pessoa/.test(fonte),
    "e que as duas rodadas do mesmo mês não caem na mesma pessoa");

  // O texto tem de bater com o MOTOR, não só existir. As três afirmações acima são
  // verificáveis: a ordem e a rotação têm asserção comportamental em `rating.mjs`;
  // aqui fica a que prova que o rating NÃO é tocado no bye — o Sistema A não tem
  // nenhum `saldo_temp + 1` para quem folga, ao contrário do B.
  const motorTxt = fs.readFileSync(path.join(RAIZ, "supabase", "functions", "admin-action", "index.ts"), "utf8");
  const trechoByePonto = motorTxt.slice(motorTxt.indexOf("// Fatia 4: bye +1"), motorTxt.indexOf("// Fatia 4: bye +1") + 1400);
  ok(/if \(sistema === "B"\) \{/.test(trechoByePonto),
    "o ponto de participação do bye é exclusivo do Sistema B — no A a folga não pontua, como o texto novo promete");

  // E o texto de PONTOS continua com o dele, intacto.
  ok(/🎟️ Bye \(número ímpar de atletas\)/.test(fonte),
    "o regulamento de pontos continua com o capítulo do bye");
  ok(/1 ponto de participação/.test(fonte),
    "e com o ponto de participação, que é a diferença entre os dois sistemas");
}

secao("A janela de entrada (Cap. 11) passa a existir no SERVIDOR, não só na tela");
{
  // Pedido do Juliano, 29/09/2026, ao enunciar a regra de entrada: "permitir a
  // entrada de novos desde que cumpra TODAS AS DEMAIS REGRAS DE ENTRADA, mas sempre
  // respeitando o limite máximo de 20".
  //
  // O teto de 20 já era respeitado no servidor (duas portas: `INCLUIR_NO_CIRCUITO` e
  // `promoverBacklog`). A que faltava era a do Cap. 11 — "não há entrada nas duas
  // últimas rodadas" —, que vivia SÓ na tela (`_entradaPermitida`). Efeito: a
  // promoção automática da fila entrava em QUALQUER rodada, contrariando o texto que
  // o atleta aceitou, e o `INCLUIR_NO_CIRCUITO` aceitava se alguém chamasse por fora.
  //
  // Com 6 rodadas o último terço começa na rodada 5, então 5 e 6 não recebem entrada.
  const CIRC = "66660000-0000-4000-8000-000000000999";
  const NA_FILA = "bbbb0001-0000-4000-8000-000000000991";

  async function cenario(rodadaMaxJogada) {
    const atletas = [], membros = [], partidas = [];
    for (let n = 0; n < 8; n++) {
      const id = `cccc000${n}-0000-4000-8000-0000000009${n}${n}`;
      atletas.push(atleta(id, { nome: `Dentro ${n}` }));
      membros.push({ id: `mj-${n}`, circuito_id: CIRC, atleta_id: id, status: "ativo", pendente_circuito: false, saldo_temp: 0, vitorias: 0, derrotas: 0 });
    }
    atletas.push(atleta(NA_FILA, { nome: "Na fila" }));
    membros.push({ id: "mj-fila", circuito_id: CIRC, atleta_id: NA_FILA, status: "ativo", pendente_circuito: true, saldo_temp: 0, vitorias: 0, derrotas: 0 });
    for (let r = 1; r <= rodadaMaxJogada; r++) {
      partidas.push(partida(`pj-${r}`, { chave_id: "kj", rodada: r, circuito_id: CIRC, atleta1_id: `cccc0000-0000-4000-8000-000000000900`, atleta2_id: `cccc0001-0000-4000-8000-000000000911` }));
    }
    const { motor, banco } = await montarMotor({
      circuitos: [circuito(BH), circuito(CIRC, { slug: "janela", sistema: "B", pareamento: "grupos", fase: "etapa", rodadas_por_temporada: 6 })],
      atletas, circuito_atletas: membros, partidas,
      chaves: [{ id: "kj", nome: "Chave", rodada_atual: rodadaMaxJogada, circuito_id: CIRC }],
      funcoes: { arquivar_partidas_temporada_circuito: () => null },
    });
    return { motor, banco };
  }

  // Rodada 2 jogada -> a próxima é a 3, ainda fora do último terço: ENTRA.
  {
    const { motor, banco } = await cenario(2);
    const r = await comoAdmin(motor, "INCLUIR_NO_CIRCUITO", { circuitoId: CIRC, id: NA_FILA });
    igual(r.status, 200, "com a temporada no começo, incluir da fila é permitido");
    igual(banco.acha("circuito_atletas", m => m.atleta_id === NA_FILA && m.circuito_id === CIRC)?.pendente_circuito, false,
      "e o atleta entra de verdade");
  }
  // Rodada 4 jogada -> a próxima é a 5, que JÁ é o último terço: RECUSA.
  {
    const { motor, banco } = await cenario(4);
    const r = await comoAdmin(motor, "INCLUIR_NO_CIRCUITO", { circuitoId: CIRC, id: NA_FILA });
    igual(r.status, 409, "nas duas últimas rodadas, o SERVIDOR recusa a inclusão");
    ok(/duas últimas rodadas/.test(String(r.corpo?.erro || "")),
      "e a recusa cita a regra que o atleta leu");
    ok(/estreia na próxima temporada/.test(String(r.corpo?.erro || "")),
      "e diz o que acontece com ele, em vez de só negar");
    igual(banco.acha("circuito_atletas", m => m.atleta_id === NA_FILA && m.circuito_id === CIRC)?.pendente_circuito, true,
      "e ele continua na fila, não em meio-estado");
  }
  // E a promoção AUTOMÁTICA respeita a mesma janela — é a porta que ninguém clica.
  {
    const { motor, banco } = await cenario(4);
    await comoAdmin(motor, "AVANCAR_RODADA", { circuitoId: CIRC });
    igual(banco.acha("circuito_atletas", m => m.atleta_id === NA_FILA && m.circuito_id === CIRC)?.pendente_circuito, true,
      "avançar rodada no último terço NÃO promove a fila — a porta automática respeita o Cap. 11");
  }

  // A conta do servidor tem de ser a MESMA da tela, senão as duas divergem e o botão
  // acende num estado que o servidor recusa (padrão que já apareceu três vezes).
  const motorFonte = fs.readFileSync(path.join(RAIZ, "supabase", "functions", "admin-action", "index.ts"), "utf8");
  igual((motorFonte.match(/Math\.ceil\(maxRodadas \/ 3\)/g) || []).length, 1,
    "o servidor calcula o último terço UMA vez só — havia duas contas independentes da mesma regra");
  ok(/const inicioUltimoTerco = maxRodadas - Math\.ceil\(maxRodadas \/ 3\) \+ 1;/.test(motorFonte),
    "e com a mesma fórmula da tela");
  const avancarTrecho = motorFonte.slice(motorFonte.indexOf('case "AVANCAR_RODADA"'), motorFonte.indexOf('case "', motorFonte.indexOf('case "AVANCAR_RODADA"') + 10));
  ok(!/inicioUltimoTerco/.test(avancarTrecho),
    "avançar rodada não refaz a conta — ela vive no portão por onde a fila entra");
  ok(/await promoverBacklog\(circuitoId\);/.test(avancarTrecho) && !/permiteEntrada/.test(avancarTrecho),
    "e a chamada da promoção é incondicional: quem decide é o portão, não o chamador");
  ok(/return \(maxRodada \+ 1\) < inicioUltimoTerco;/.test(motorFonte),
    "e compara a PRÓXIMA rodada, como a tela faz");
  ok(/_inicioUltimoTerco = _maxRodadas - Math\.ceil\(_maxRodadas\/3\) \+ 1/.test(fonte),
    "e a tela continua com a fórmula que o servidor espelha");
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

secao("Sem desconto por etapa de entrada no circuito novo");
{
  const motor = fs.readFileSync(path.join(RAIZ, "supabase", "functions", "admin-action", "index.ts"), "utf8");
  // Decisão do Juliano, 12/09: o atleta paga o mesmo valor entrando em qualquer
  // etapa. Desconto deixa de ser automático e vira ato do admin, por atleta.
  // As DUAS formas. O motor escreve esse campo de dois jeitos — como chave de
  // objeto (`percentual_entrada_meio: 100,` nos três pontos de criação/virada) e
  // como atribuição (`upd.percentual_entrada_meio = ...` no DEFINIR_FINANCEIRO,
  // linha ~1647). A 1ª versão desta asserção só olhava a forma de objeto, então
  // um `upd.percentual_entrada_meio = 80` passava batido — e é justamente a
  // forma do ponto onde o 80 já morou. (Supervisor do guardião de Regulamento.)
  ok(!/percentual_entrada_meio\s*[:=]\s*80\b/.test(motor),
    "nenhum ponto do motor cria circuito com o desconto de 80%");

  // E o texto: o BH mantém o 80% dele; o circuito novo diz valor único.
  ok(/\? \["💰 Valor","Valor por temporada, pago no início\. Quem entra na 2ª etapa \(Rodada 3\) paga 80%/.test(fonte),
    "o BH mantém o texto de 80% no portão do aceite");
  ok(/o mesmo, entrando em qualquer etapa/.test(fonte),
    "o circuito novo diz que o valor é o mesmo em qualquer etapa");

  // Mesmo cuidado da frase do custo adicional: quem concede o desconto é o
  // ORGANIZADOR, e a plataforma não pode escrever algo que soe como promessa de
  // processo. "São concedidos... caso a caso" lia como rotina formal.
  ok(/não é automático nem garantido/.test(fonte),
    "o desconto é descrito como decisão discricionária, não como promessa");
  ok(!/Descontos são concedidos pelo organizador/.test(fonte),
    "não sobrou a redação que soava como promessa");
  ok(/\["Entrada em qualquer etapa","Valor integral"\]/.test(fonte),
    "a tabela de valores do circuito novo não tem linha de desconto por etapa");
}

secao("Sem saber a versão, não se colhe aceite (fail-closed)");
{
  // 0.10.1 — achado independente do Guardião Jurídico E do de Segurança. O
  // fallback `|| "v03-12"` é seguro no BH (onde acerta) e perigoso fora dele:
  // numa falha de leitura, o atleta de um circuito novo leria o regulamento do
  // BH — com torneio e com a taxa — enquanto o servidor carimba a versão dele.
  // O recibo ficaria provadamente falso.
  // ATUALIZADA em 17/09: a guarda deixou de ISENTAR o BH. O argumento que o
  // isentava — "no BH a versão É a do fallback" — morreu junto com o fallback,
  // que foi removido no mesmo dia em que nasceu o carimbo da v03-13. A partir do
  // carimbo, o fallback mentiria: mostraria torneio e os 80% enquanto o servidor
  // já declara a versão nova. Agora versão ausente é desconhecida em QUALQUER
  // circuito, o BH inclusive.
  ok(/const versaoDesconhecida = !!circuitoId && !versaoLida;/.test(fonte),
    "versão ausente é desconhecida em qualquer circuito — o BH não é mais isento");
  ok(!/circuitoId !== CIRCUITO_BH_ID && !\(\(circ && circ\.regulamento_versao\)/.test(fonte),
    "e não sobrou a isenção antiga do BH");
  ok(/if \(step === 3 && versaoDesconhecida\) return/.test(fonte),
    "o passo do aceite é bloqueado quando a versão é desconhecida");

  // A ordem importa: a guarda tem de vir ANTES do passo 3 normal, senão nunca roda.
  const iGuarda = fonte.indexOf("if (step === 3 && versaoDesconhecida) return");
  const iNormal = fonte.indexOf("if (step === 3) return");
  ok(iGuarda > 0 && iGuarda < iNormal,
    "a guarda vem antes do passo 3 normal");

  ok(/registramos aceite de um texto que você não viu/.test(fonte),
    "a tela de recusa explica o motivo ao atleta, em vez de só falhar");

  // A retentativa NÃO pode recarregar a página: sem sessão neste ponto, o reload
  // apagaria os dois passos preenchidos e nem devolveria o atleta à inscrição —
  // ele cairia na tela inicial. Barrar o aceite protege a plataforma; fazer isso
  // custando a inscrição inteira protege às custas do atleta.
  ok(!/window\.location\.reload\(\)/.test(fonte),
    "a retentativa não recarrega a página (o formulário sobrevive)");
  ok(/async function tentarVersaoDeNovo/.test(fonte),
    "existe uma retentativa que refaz só a leitura da versão");

  // ORDEM DE DECLARAÇÃO. `versaoReg` lê `versaoRetry` dentro de um `||`, e const
  // fica em zona morta até a própria linha de declaração executar. Com a ordem
  // invertida, a tela de inscrição QUEBRAVA com ReferenceError sempre que a
  // versão não viesse — inclusive para o BH, e justamente na falha que esta
  // funcionalidade existe para tratar. Build e 244 asserções passavam: nenhuma
  // renderiza o componente. Só leitura do código pegou (Guardião de
  // Confiabilidade), e por isso esta asserção existe.
  const iDecl = fonte.indexOf("const [versaoRetry, setVersaoRetry]");
  const iUso = fonte.indexOf("const versaoLida = String((circ && circ.regulamento_versao) || versaoRetry");
  ok(iDecl > 0 && iUso > 0, "as duas linhas foram encontradas");
  ok(iDecl < iUso,
    "versaoRetry é declarado ANTES de quem o lê (senão a tela quebra com ReferenceError)");
}

secao("A regra do valor único sobrevive ao motor — rodando o motor, não lendo o texto");
{
  // Esta seção substituiu uma asserção que CONTAVA ocorrências de
  // `percentual_entrada_meio: 100` no arquivo e exigia que fossem 2. Ela ficava
  // verde sem saber em que RAMO as linhas estavam — e estava verde justamente
  // quando a linha da virada tinha caído no ramo errado (o do BH), deixando o
  // ramo dos circuitos novos descoberto. Dois guardiões acharam; o teste não.
  // A lição: asserção que lê texto não sabe o que o código faz. Estas chamam o
  // motor de verdade e leem o campo depois.
  const NOVO = "11111111-1111-1111-1111-111111111111";

  // 1) Circuito nasce com 100. Sabote `admin-action` (CRIAR_CIRCUITO) para 80.
  {
    const { banco, motor } = await montarMotor({ funcoes: { arquivar_partidas_temporada_circuito: () => null } });
    const r = await comoAdmin(motor, "CRIAR_CIRCUITO", {
      slug: "novo", nome: "Circuito Novo", cidade: "Uberlândia", uf: "MG", sistema: "A", rodadas: 6,
    });
    ok(r.corpo?.sucesso === true, `CRIAR_CIRCUITO respondeu sucesso (veio: ${JSON.stringify(r.corpo?.erro ?? r.corpo?.sucesso)})`);
    const criado = banco.acha("circuitos", c => c.slug === "novo");
    igual(criado?.percentual_entrada_meio, 100,
      "circuito novo NASCE sem desconto por etapa de entrada");
  }

  // 2) A virada do circuito NÃO-BH devolve o campo a 100. Sem a linha no
  //    `updCfgN`, um circuito cujo admin baixou o percentual carregaria o
  //    desconto para a temporada seguinte — a regra se desfazendo sozinha.
  //    Sabote apagando `percentual_entrada_meio: 100` do `updCfgN`.
  {
    const { banco, motor } = await montarMotor({
      circuitos: [circuito(BH), circuito(NOVO, { slug: "novo", sistema: "A", percentual_entrada_meio: 80,
        regulamento_versao: "vA-nc-01", fase: "temporada", temporada_numero: 1, temporada_ano: 2026 })],
      atletas: [atleta("b1"), atleta("b2")],
      circuito_atletas: [
        { id: "ca1", circuito_id: NOVO, atleta_id: "b1", status: "ativo", pendente_circuito: false, saldo_temp: 10, vitorias: 1, derrotas: 0, historico: [] },
        { id: "ca2", circuito_id: NOVO, atleta_id: "b2", status: "ativo", pendente_circuito: false, saldo_temp: -10, vitorias: 0, derrotas: 1, historico: [] },
      ],
      chaves: [{ id: "chave1", nome: "A", rodada_atual: 1, circuito_id: NOVO }],
      partidas: [partida("q1", { circuito_id: NOVO, atleta1_id: "b1", atleta2_id: "b2", placar1: 3, placar2: 1, validado: true, calculado: true })],
      funcoes: { arquivar_partidas_temporada_circuito: () => null },
    });
    const r = await comoAdmin(motor, "NOVA_TEMPORADA", { circuitoId: NOVO });
    ok(r.corpo?.sucesso === true, `NOVA_TEMPORADA do circuito não-BH respondeu sucesso (veio: ${JSON.stringify(r.corpo?.erro ?? r.corpo?.sucesso)})`);
    igual(banco.acha("circuitos", c => c.id === NOVO)?.percentual_entrada_meio, 100,
      "a virada do circuito NÃO-BH zera o desconto por etapa — a regra não se desfaz sozinha");
  }

  // 3) A alavanca que sobrou: campo vazio na tela do admin não pode virar 80.
  //    O motor recebia `0`/`""`, o `|| 80` engolia, e ele gravava 80 — um
  //    desconto que ninguém pediu, num circuito cujo regulamento não o promete
  //    mais. Sabote trocando o `|| 100` do DEFINIR_FINANCEIRO de volta por 80.
  {
    const { banco, motor } = await montarMotor({
      circuitos: [circuito(BH), circuito(NOVO, { slug: "novo", percentual_entrada_meio: 100 })],
      funcoes: { arquivar_partidas_temporada_circuito: () => null },
    });
    await comoAdmin(motor, "DEFINIR_FINANCEIRO", { circuitoId: NOVO, valorTemporada: 12000, descontoGlobalPct: 0, percentualMeio: "" });
    igual(banco.acha("circuitos", c => c.id === NOVO)?.percentual_entrada_meio, 100,
      "campo de percentual vazio grava 100, não o 80 abolido");
  }
}

secao("v03-13: o BH mantém o torneio e perde o desconto por etapa");
{
  // Decisão do Juliano, 13/09/2026. Ele autorizou o BH a ir a 100% na virada; os
  // guardiões Jurídico e Regulamento mostraram que isso exige versão nova do
  // regulamento, porque a v03-12 — que os atletas aceitaram — PROMETE 80% a quem
  // entra na Rodada 3. Cobrar 100% sob um texto que promete 80% é divergência de
  // verdade, não de redação.
  //
  // O ponto delicado do código: até aqui "tem torneio" e "tem desconto de etapa"
  // eram a MESMA chave (`comTorneio`), porque por acaso só o BH tinha as duas. A
  // v03-13 quebra a coincidência — mantém o torneio, tira o desconto. Sem duas
  // listas, tirar o desconto do BH tiraria o Cap. 10 junto.

  // As duas listas existem e são DIFERENTES. Não basta a forma: a lição de 12/09
  // foi que um agente pôs "vA-nc-01" na lista do torneio e a bateria seguiu verde,
  // porque a asserção checava o formato e não o conteúdo. Aqui o conteúdo é exato.
  const lista = re => {
    const m = fonte.match(re);
    return m ? m[1].split(",").map(x => x.trim().replace(/^["']|["']$/g, "")).filter(Boolean) : null;
  };
  igual(lista(/const VERSOES_COM_TORNEIO = new Set\(\[([^\]]*)\]\)/), ["v03-12", "v03-13"],
    "o torneio é das DUAS versões do BH — a v03-13 não perde o Cap. 10");
  igual(lista(/const VERSOES_COM_DESCONTO_ETAPA = new Set\(\[([^\]]*)\]\)/), ["v03-12"],
    "só a v03-12 promete o desconto de 80% — a v03-13 não, e nenhuma versão nova ganha isso de graça");

  // Os três textos de valor têm de olhar a lista do DESCONTO, não a do torneio.
  // Sabote trocando qualquer um por `comTorneio` e a bateria fica vermelha: o
  // atleta do BH leria 80% num circuito que passou a cobrar 100%.
  const valorPorDesconto = (fonte.match(/comDescontoEtapa\s*\n\s*\?/g) || []).length;
  igual(valorPorDesconto, 3,
    `os 3 textos de valor (card do aceite, bullet de entradas, tabela do Cap. 12) seguem o desconto, não o torneio (achados: ${valorPorDesconto})`);
  ok(!/comTorneio\s*\n?\s*\?\s*\["💰 Valor"/.test(fonte),
    "o card de Valor não depende mais da lista do torneio");
  ok(!/comTorneio\s*\n\s*\?\s*"Valor da temporada: 100% na abertura/.test(fonte),
    "o bullet de valor não depende mais da lista do torneio");

  // E as duas telas precisam derivar o flag, senão uma delas mostra o texto errado.
  const derivam = (fonte.match(/const comDescontoEtapa = VERSOES_COM_DESCONTO_ETAPA\.has\(/g) || []).length;
  igual(derivam, 2,
    `as duas telas (portão do aceite e RegulamentoView) derivam o flag do desconto (achadas: ${derivam})`);
}

secao("O documento da v03-13 muda UMA cláusula, e só");
{
  // Versão nova de regulamento é a coisa mais fácil de estragar sem ninguém ver:
  // basta uma linha a mais no copiar-e-colar e o atleta aceita uma regra que
  // ninguém decidiu mudar. Esta asserção compara os dois arquivos linha a linha e
  // exige que TODA linha removida da v03-12 seja sobre valor ou sobre a versão.
  const doc = v => fs.readFileSync(path.join(RAIZ, "docs", `REGULAMENTO_TENIS_DE_MESA_${v}.md`), "utf8").split("\n");
  const v12 = doc("v03-12"), v13 = new Set(doc("v03-13"));
  const sumiram = v12.filter(l => l.trim() && !v13.has(l));
  const esperadas = [
    "**Versão vigente: v03-12.** Prazos: **1ª rodada até o dia 15**, **2ª rodada até o dia 27**.",
    "> Fonte: texto oficial exibido no app (RegulamentoView). Este documento reproduz fielmente o regulamento vigente. Substitui as versões anteriores em PDF (v03-4 e v03-11), que estão **desatualizadas** (traziam a 2ª rodada no dia 25).",
    "- Valor da temporada: 100% na abertura; 80% para quem entra na 2ª etapa (Rodada 3)",
    "| Entrada na 2ª etapa (Rodada 3) | 80% do valor |",
    // O rodapé: as duas versões tinham o MESMO rodapé errado ("v03-12") por
    // coincidência do copiar-e-colar, e por isso esta asserção ficava verde
    // PROTEGENDO UM DEFEITO. O curador achou ao tentar consertar o .md e ver a
    // bateria acusar. Agora a v03-13 assina o próprio número.
    "*Clube do Tênis de Mesa · Circuito BH · Regulamento v03-12*",
    // A linha "Abertura da temporada (Rodada 1) | 100% do valor" sai porque,
    // SEM o desconto por etapa, ela e "Entrada em qualquer etapa | Valor
    // integral" dizem a mesma coisa. Duas redações para a mesma regra, na
    // cláusula que é o motivo da versão, é convite a discussão. Na v03-12 ela
    // fica, porque lá contrasta de verdade com os 80% da 2ª etapa.
    "| Abertura da temporada (Rodada 1) | 100% do valor |",
    // 27/09/2026: a frase das rodadas. A v03-12 dizia "por padrão, 6 rodadas (número
    // definido pelo administrador)", que NUNCA foi verdade no app — o motor fixa 6 e a
    // ação de alterar recusa. A v03-13 passa a dizer o que o sistema faz. A v03-12 fica
    // como está, de propósito: está em vigor e foi aceita por atletas reais.
    "O ano é dividido em **3 temporadas de 3 meses**, com janeiro, julho e dezembro reservados para férias. Cada temporada tem, por padrão, 6 rodadas (número definido pelo administrador), organizadas em pares mensais — 2 rodadas por mês.",
  ];
  // `includes` NÃO serve aqui, e o supervisor provou com três exemplos: numa
  // asserção cujo propósito é "nenhuma regra nova foi colada em silêncio",
  // casar por substring deixa passar o acréscimo À LINHA DECLARADA —
  // "| Entrada em qualquer etapa | Valor integral | multa de R$ 50 |" passava,
  // e o foro de eleição colado no rodapé também. Igualdade exata, com `trim`
  // só para não brigar com espaço no fim da linha.
  const igualExato = (l, lista) => lista.some(e => l.trim() === e.trim());
  const inesperadas = sumiram.filter(l => !igualExato(l, esperadas));
  igual(inesperadas, [],
    "nada além da cláusula de valor e do cabeçalho saiu da v03-12");

  // E o outro lado do diff, que faltava: linhas ACRESCENTADAS. A asserção acima
  // só conferia o que SAIU da v03-12 — uma cláusula nova colada na v03-13
  // passava em silêncio, que é exatamente o modo de falha que uma versão de
  // regulamento tem (copiar-e-colar acrescenta, raramente remove).
  // (Supervisor do guardião de Regulamento.)
  //
  // O que pode legitimamente ser novo na v03-13: o cabeçalho e a seção "O que
  // muda", que é o bloco que explica a transição. Qualquer linha nova FORA
  // desse bloco é regra que ninguém decidiu mudar.
  const v13linhas = doc("v03-13"), v12set = new Set(doc("v03-12"));
  const iInicioBloco = v13linhas.findIndex(l => l.includes("## O que muda da v03-12"));
  const iFimBloco = v13linhas.findIndex((l, n) => n > iInicioBloco && /^---\s*$/.test(l));
  ok(iInicioBloco > 0 && iFimBloco > iInicioBloco,
    "o bloco 'O que muda' da v03-13 foi localizado");

  const novasForaDoBloco = v13linhas
    .map((l, n) => ({ l, n }))
    .filter(({ l, n }) => l.trim()
      && !v12set.has(l)
      && !(n >= iInicioBloco && n <= iFimBloco))
    .map(({ l }) => l);
  const novasEsperadas = [
    "**Versão: v03-13.** Prazos: **1ª rodada até o dia 15**, **2ª rodada até o dia 27**.",
    "> Fonte: texto oficial exibido no app (RegulamentoView). Este documento reproduz fielmente o regulamento. Substitui as versões anteriores em PDF (v03-4 e v03-11), que estão **desatualizadas** (traziam a 2ª rodada no dia 25).",
    "- Valor da temporada: o mesmo para todos, entrando em qualquer etapa",
    "| Entrada em qualquer etapa | Valor integral |",
    // O par da linha acima: a correção da frase das rodadas (ver o comentário lá).
    "O ano é dividido em **3 temporadas de 3 meses**, com janeiro, julho e dezembro reservados para férias. Cada temporada tem **6 rodadas**, organizadas em pares mensais — **2 jogos por mês**. Esse número é fixo.",
    "*Clube do Tênis de Mesa · Circuito BH · Regulamento v03-13*",
  ];
  // Igualdade exata AQUI TAMBÉM. Eu tinha trocado só no lado das removidas e
  // afirmado ao supervisor que os três exemplos dele deixavam de passar — era
  // falso: este é o lado que importa, porque copiar-e-colar acrescenta, raramente
  // remove. Ele rodou a lógica que estava no arquivo e mostrou os três passando.
  const acrescentadasSemPermissao = novasForaDoBloco.filter(l => !igualExato(l, novasEsperadas));
  igual(acrescentadasSemPermissao, [],
    "nenhuma regra nova foi colada na v03-13 fora do bloco que explica a transição");

  // E o Cap. 10 — o torneio — tem de continuar lá por inteiro.
  const t13 = fs.readFileSync(path.join(RAIZ, "docs", "REGULAMENTO_TENIS_DE_MESA_v03-13.md"), "utf8");
  ok(/Cap\. 10/.test(t13), "a v03-13 mantém o Cap. 10 (Torneio Presencial) — ele é do BH");
  ok(!/\| Entrada na 2ª etapa \(Rodada 3\) \| 80% do valor \|/.test(t13),
    "a v03-13 não promete mais 80% na tabela de valores");
  // Sem atravessar quebra de linha: o .md quebra em "de quem\ningressou".
  ok(/não cobrará\*\* diferença de valor de ninguém/.test(t13),
    "a v03-13 continua obrigando o clube a não cobrar diferença — de NINGUÉM, sem recorte");
  ok(!/paga os 80% prometidos/.test(t13),
    "e a promessa de cobrar 80% de quem não quitou saiu — não havia mais quem (12 pagamentos, todos confirmados)");

  // A cláusula NÃO pode identificar o protegido por um NÚMERO DE VERSÃO.
  // A 1ª redação dizia "quem ingressou sob a v03-12" — e no banco NENHUM atleta
  // do BH tem v03-12 gravado. Conferido em 15/09/2026, com o filtro dito por
  // extenso porque dois documentos deste projeto já se contradisseram por
  // omiti-lo: são **15 matrículas** em `circuito_atletas` — **14 ativas**
  // (11 v03-3, 1 v03-5, 1 v03-8, 1 v03-11) mais **1 suspensa** (v03-3).
  // A frase escrita para proteger esses atletas nomeava um rótulo que nenhum
  // deles carrega; lida ao pé da letra, não cobria ninguém.
  //
  // O Jurídico resumiu a lição melhor do que eu: asserção que lê texto não sabe
  // A QUEM o texto se aplica. Esta aqui não conserta isso — só impede a forma
  // que já falhou uma vez. O protegido tem de ser definido por FATO (a data de
  // ingresso), não por etiqueta.
  // ⚠️ Normaliza a quebra de linha ANTES de testar. O `.md` quebra em coluna fixa,
  // então a frase parte no meio ("…de ninguém pelo\nque foi pago…") e qualquer
  // regex escrita a partir da frase inteira falha. Já havia um comentário avisando
  // disso duas asserções acima, e a armadilha pegou de novo em 29/09/2026 — então
  // agora é normalização, não regex torta.
  const clausula = t13.slice(t13.indexOf("**Não retroatividade.**"), t13.indexOf("**Não retroatividade.**") + 500).replace(/\s+/g, " ");
  ok(!/v03-\d+/.test(clausula),
    "a cláusula de não-retroatividade não identifica o protegido por número de versão");
  // A 1ª redação identificava o protegido por ETIQUETA ("quem ingressou sob a
  // v03-12") e não cobria ninguém, porque nenhum atleta do BH tem v03-12 gravado.
  // A 2ª passou a identificar por FATO (a data de ingresso). A 3ª, de 29/09/2026,
  // não precisa identificar ninguém: a temporada 1/2026 está financeiramente
  // encerrada — 12 pagamentos, todos `confirmado`, soma zero — então a cláusula
  // protege TODOS de uma vez, sem recorte. Menos recorte, menos superfície de erro.
  ok(/de ninguém pelo que foi pago, ou deixado de pagar, na \*\*temporada 1\/2026\*\*/.test(clausula),
    "ela protege todos, recortando por TEMPORADA — um fato — e não por etiqueta de versão");
  // ⚠️ A FRASE DO FATO SAIU EM 29/09/2026, e esta asserção trocou de lado.
  // Ela dizia "todos os pagamentos dela estão confirmados" — uma afirmação
  // FACTUAL SOBRE DADO, congelada dentro de um documento de regulamento. É a mesma
  // família que pegou o card de configuração ontem ("é o texto que os atletas
  // aceitaram", falso para 14 de 15). E não é hipotética: `ESTORNAR_PAGAMENTO`
  // existe no motor — um estorno tornaria um documento assinado falso.
  // A promessa não precisa dela: "não cobraremos diferença" vale por si. O motivo
  // não acrescenta nada ao atleta e só acrescenta um jeito de a frase ficar errada.
  // Pego pelo Guardião do Regulamento.
  ok(!/todos os pagamentos dela estão confirmados/.test(clausula),
    "e a cláusula não afirma um FATO sobre dado — um estorno tornaria o documento falso");
  ok(!/confirmad/.test(clausula),
    "nem por outra forma de dizer o mesmo");

  // O capítulo do bye entrou na TELA em 28/09 e NÃO no documento — lacuna minha,
  // achada pelo Guardião do Regulamento ao procurar "bye" nos dois textos de
  // rating e achar zero. O documento é o registro; a tela é a leitura.
  ok(/O bye \(número ímpar de atletas\)/.test(t13),
    "o documento da v03-13 descreve o bye — não só a tela");
  ok(/menor rating entre os que ainda não folgaram/.test(t13),
    "com a regra que o Juliano decidiu: menor rating, sem repetir");
  ok(/não altera o rating/.test(t13),
    "e dizendo que a folga não mexe no rating, que é a diferença para o Sistema B");
  // Na TELA a caixa de transição ficou só com a vigência — a cláusula de
  // não-retroatividade vive no documento, que é onde ela tem efeito jurídico.
  ok(!/80%/.test(fonte.slice(fonte.indexOf("ehTransicaoV0313 && ("), fonte.indexOf("💵 Valor conforme o momento de entrada"))),
    "e a caixa de transição da tela não menciona 80% em lugar nenhum");

  // O v03-12 é registro histórico: os atletas de hoje aceitaram AQUELE texto.
  // Editá-lo reescreveria o que eles aceitaram.
  const t12 = fs.readFileSync(path.join(RAIZ, "docs", "REGULAMENTO_TENIS_DE_MESA_v03-12.md"), "utf8");
  ok(/\| Entrada na 2ª etapa \(Rodada 3\) \| 80% do valor \|/.test(t12),
    "a v03-12 continua intacta — é o texto que os atletas de hoje aceitaram");
}

secao("O preço do BH não sobe antes do regulamento — e a trava age ANTES de destruir");
{
  // A virada leva o percentual do BH a 100. O v03-12, que os atletas aceitaram,
  // promete 80% na 2ª etapa. A trava recusa a virada enquanto o BH declarar uma
  // versão que promete o desconto.
  //
  // O que esta seção realmente protege é a ORDEM. O update da config acontece
  // depois de `arquivar_partidas_temporada_circuito`, do delete de partidas e do
  // delete de chaves. Uma recusa tardia devolveria "não pode" com a temporada já
  // destruída e sem caminho de volta — o motor não tem desfazer. Por isso a
  // asserção não se contenta com o 409: ela exige que as partidas CONTINUEM lá.
  const cenarioBh = async (versao) => montarMotor({
    circuitos: [circuito(BH, { regulamento_versao: versao, percentual_entrada_meio: 80 })],
    atletas: [atleta("p1"), atleta("p2")],
    partidas: [partida("j1", { atleta1_id: "p1", atleta2_id: "p2", placar1: 3, placar2: 1, validado: true, calculado: true })],
    funcoes: { arquivar_partidas_temporada_circuito: () => null },
  });

  {
    const { banco, motor } = await cenarioBh("v03-12");
    const r = await comoAdmin(motor, "NOVA_TEMPORADA", { circuitoId: BH });
    ok(r.corpo?.sucesso === false, "a virada do BH é RECUSADA enquanto ele declarar a v03-12");
    igual(r.status, 409, "a recusa vem como conflito (409), não como erro de servidor");
    ok(/v03-13/.test(String(r.corpo?.erro || "")),
      "a recusa diz ao admin o que fazer: carimbar a v03-13");
    ok(/80%/.test(String(r.corpo?.erro || "")),
      "a recusa diz POR QUE: o texto aceito promete 80%");

    // O coração da asserção: nada foi destruído.
    igual(banco.tabelas.partidas.length, 1,
      "a temporada continua INTEIRA — a trava agiu antes de arquivar e apagar as partidas");
    igual(banco.tabelas.chaves.length, 1, "as chaves continuam lá");
    igual(banco.acha("circuitos", c => c.id === BH)?.percentual_entrada_meio, 80,
      "e o preço não mudou — o BH segue no 80% que o regulamento dele promete");
  }

  {
    // Com a v03-13 carimbada, a virada acontece e o preço vai a 100.
    // Sabote apagando a trava e a asserção de cima fica vermelha; sabote apagando
    // `percentual_entrada_meio: 100` do updConfig e esta fica.
    const { banco, motor } = await cenarioBh("v03-13");
    const r = await comoAdmin(motor, "NOVA_TEMPORADA", { circuitoId: BH });
    ok(r.corpo?.sucesso === true,
      `com a v03-13 carimbada a virada do BH acontece (veio: ${JSON.stringify(r.corpo?.erro ?? r.corpo?.sucesso)})`);
    igual(banco.acha("configuracao", c => c.id === 1)?.percentual_entrada_meio, 100,
      "aí sim o BH passa a cobrar o mesmo valor em qualquer etapa");
  }

  // As duas listas não são mais iguais: a do app diz quem PROMETE o desconto, a
  // do motor diz quem JÁ NÃO promete (virou lista de permissão em 13/09, para um
  // typo no carimbo fechar o portão em vez de abrir). Logo a comparação não pode
  // ser de texto com texto — tem de ser SEMÂNTICA: as duas juntas têm de cobrir
  // todas as versões conhecidas, e nenhuma versão pode estar nas duas.
  // Uma versão que suma das duas é o caso perigoso: a tela não promete desconto,
  // mas o motor também não deixa virar — e ninguém descobre até apertar o botão.
  const motorTxt = fs.readFileSync(path.join(RAIZ, "supabase", "functions", "admin-action", "index.ts"), "utf8");
  const leSet = (txt, nome) => {
    const m = txt.match(new RegExp(`const ${nome} = new Set\\(\\[([^\\]]*)\\]\\)`));
    return m ? [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]) : null;
  };
  const prometem = leSet(fonte, "VERSOES_COM_DESCONTO_ETAPA");
  const naoPrometem = leSet(motorTxt, "VERSOES_SEM_DESCONTO_ETAPA");
  ok(!!prometem && !!naoPrometem, "as duas listas do desconto foram encontradas (app e motor)");

  // As versões conhecidas são DERIVADAS, não escritas à mão. A lista fixa que
  // estava aqui tinha um furo exato: o "caso perigoso" que o comentário acima
  // descreve — versão nova órfã das duas listas — ficava VERDE, porque o teste
  // não sabia que ela existia. Quem cria uma v03-14 e esquece de classificá-la
  // não era avisado por nada. (Supervisor do guardião de Regulamento.)
  //
  // Duas fontes, as duas reais:
  //   1. os documentos de regulamento em docs/ — uma versão com texto publicado
  //      é uma versão que alguém pode aceitar;
  //   2. o que o CRIAR_CIRCUITO carimba — é o que nasce em circuito novo.
  const dosDocumentos = fs.readdirSync(path.join(RAIZ, "docs"))
    .map(f => (f.match(/^REGULAMENTO_TENIS_DE_MESA_(v[\w-]+)\.md$/) || [])[1])
    .filter(Boolean);
  const doCriarCircuito = [...motorTxt.matchAll(/regulamento_versao:\s*sistema === "A" \? "([^"]+)" : "([^"]+)"/g)]
    .flatMap(m => [m[1], m[2]]);
  //   3. as três FAMÍLIAS carimbáveis do motor. Entraram em 19/09/2026: até
  //      então a derivação coincidia com a união delas por ACIDENTE, e quem
  //      acrescentasse uma v03-14 a VERSOES_DO_BH sem publicar o .md ficava
  //      verde — enquanto o motor passaria a carimbar uma versão que some o
  //      Cap. 10 do BH (fora de VERSOES_COM_TORNEIO), exibe "valor integral"
  //      (fora de VERSOES_COM_DESCONTO_ETAPA) e TRAVA A VIRADA PARA SEMPRE
  //      (fora de VERSOES_SEM_DESCONTO_ETAPA). É o caso perigoso que o
  //      comentário acima descreve, reaberto pela porta que o carimbo criou.
  //      (Guardião de Regulamento, R7.)
  const listaDoMotor = (nome) => {
    const m = motorTxt.match(new RegExp(`const ${nome} = new Set\\(\\[([^\\]]*)\\]`));
    return m ? [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]) : null;
  };
  const familias = ["VERSOES_DO_BH", "VERSOES_DE_RATING_NOVO", "VERSOES_DO_SISTEMA_B"].map(n => {
    const l = listaDoMotor(n);
    ok(Array.isArray(l) && l.length > 0, `a família ${n} foi lida do motor`);
    return l || [];
  }).flat();
  const CONHECIDAS = [...new Set([...dosDocumentos, ...doCriarCircuito, ...familias])];
  ok(CONHECIDAS.length >= 4,
    `as versões conhecidas foram derivadas do acervo e do motor (achadas: ${CONHECIDAS.join(", ")})`);
  const nasDuas = (prometem || []).filter(v => (naoPrometem || []).includes(v));
  igual(nasDuas, [],
    "nenhuma versão está nas duas listas — tela e servidor não se contradizem");
  const emNenhuma = CONHECIDAS.filter(v => !(prometem || []).includes(v) && !(naoPrometem || []).includes(v));
  igual(emNenhuma, [],
    "toda versão com .md publicado ou carimbável pelo motor está classificada numa das duas listas");

  // E a do motor é de PERMISSÃO: a v03-12, que promete 80%, não pode estar nela.
  ok(!(naoPrometem || []).includes("v03-12"),
    "a v03-12 NÃO libera a virada — é a versão que promete o desconto");
}

secao("O carimbo da versão: só o super-admin, com o nome, e só da família certa");
{
  // Até 17/09/2026 `regulamento_versao` só era escrito no CRIAR_CIRCUITO, e
  // destravar a virada do BH exigiria `UPDATE` manual em produção — proibido
  // pela regra 1. Esta ação é o caminho legítimo, e nasce com as três guardas
  // que os guardiões especificaram antes de ela existir.
  const carimbar = async (circ, payload) => {
    const { banco, motor } = await montarMotor({
      circuitos: [circuito(BH, { nome_circuito: "Circuito BH", regulamento_versao: "v03-12" }),
                  circuito("22222222-2222-2222-2222-222222222222", { slug: "pontos", sistema: "B", nome_circuito: "Circuito SP", regulamento_versao: "vB-01" })],
      funcoes: { arquivar_partidas_temporada_circuito: () => null },
    });
    const r = await comoAdmin(motor, "DEFINIR_REGULAMENTO_VERSAO", { circuitoId: circ, ...payload });
    return { banco, r, versaoAgora: banco.acha("circuitos", c => c.id === circ)?.regulamento_versao };
  };

  // 1. O caminho feliz: destrava a virada do BH.
  {
    const { r, versaoAgora } = await carimbar(BH, { versao: "v03-13", confirmacaoNome: "Circuito BH" });
    ok(r.corpo?.sucesso === true, `o carimbo funciona (veio: ${JSON.stringify(r.corpo?.erro ?? true)})`);
    igual(versaoAgora, "v03-13", "e o circuito passa a declarar a v03-13");
    igual(r.corpo?.dados, { de: "v03-12", para: "v03-13" }, "a resposta diz de onde para onde");
  }

  // 2. `trim`, porque o valor é digitado à mão. Sem ele o carimbo "v03-13 " faz
  //    o Cap. 10 sumir da tela do BH — o torneio é dele.
  {
    const { versaoAgora } = await carimbar(BH, { versao: "  v03-13  ", confirmacaoNome: "Circuito BH" });
    igual(versaoAgora, "v03-13", "espaço em volta é aparado antes de gravar");
  }

  // 3. Branco NUNCA é gravado: o INSCREVER recusa 409 sem versão, então um
  //    carimbo vazio fecharia as inscrições do circuito em silêncio.
  for (const [v, rotulo] of [["", "vazio"], ["   ", "só espaços"], [null, "nulo"]]) {
    const { r, versaoAgora } = await carimbar(BH, { versao: v, confirmacaoNome: "Circuito BH" });
    igual(r.status, 400, `carimbo ${rotulo} é recusado`);
    igual(versaoAgora, "v03-12", `e a versão anterior fica intacta com carimbo ${rotulo}`);
  }

  // 4. Confirmação-com-nome, e NO MOTOR — não só na tela. Trocar o regulamento
  //    muda o contrato que o atleta aceita.
  for (const [nome, rotulo] of [["", "sem nome"], ["circuito bh", "minúscula"], ["Circuito B", "nome incompleto"]]) {
    const { r, versaoAgora } = await carimbar(BH, { versao: "v03-13", confirmacaoNome: nome });
    igual(r.status, 409, `carimbo recusado com confirmação "${rotulo}"`);
    igual(versaoAgora, "v03-12", `e nada muda com confirmação "${rotulo}"`);
  }

  // 5. A versão tem de ser DA FAMÍLIA do circuito. É outra pergunta que a da
  //    trava: `vA-nc-01` passa na lista "não promete desconto" e mesmo assim
  //    apagaria o Cap. 10 do BH.
  {
    const { r, versaoAgora } = await carimbar(BH, { versao: "vA-nc-01", confirmacaoNome: "Circuito BH" });
    igual(r.status, 409, "carimbar a versão de circuito novo NO BH é recusado");
    ok(/não é deste circuito/.test(String(r.corpo?.erro || "")), "e a mensagem diz o porquê");
    igual(versaoAgora, "v03-12", "o BH continua na versão dele");
  }
  {
    const { r, versaoAgora } = await carimbar("22222222-2222-2222-2222-222222222222", { versao: "v03-13", confirmacaoNome: "Circuito SP" });
    igual(r.status, 409, "carimbar a versão do BH num circuito de PONTOS é recusado");
    igual(versaoAgora, "vB-01", "o circuito B continua na versão dele");
  }

  // 6. Carimbar a mesma versão é inócuo, não erro — o admin pode repetir sem medo.
  {
    const { r, versaoAgora } = await carimbar(BH, { versao: "v03-12", confirmacaoNome: "Circuito BH" });
    ok(r.corpo?.sucesso === true && r.corpo?.dados?.inalterado === true,
      "recarimbar a mesma versão responde 'inalterado' em vez de erro");
    igual(versaoAgora, "v03-12", "e não muda nada");
  }

  // 7. NÃO é do organizador. Default-deny: o que não está em ACOES_ORG é só
  //    super-admin. Trocar regulamento não é operação de organizador.
  const motorTxt2 = fs.readFileSync(path.join(RAIZ, "supabase", "functions", "admin-action", "index.ts"), "utf8");
  const iOrg = motorTxt2.indexOf("const ACOES_ORG = new Set([");
  const listaOrg = motorTxt2.slice(iOrg, motorTxt2.indexOf("]);", iOrg));
  ok(!/DEFINIR_REGULAMENTO_VERSAO/.test(listaOrg),
    "o carimbo NÃO está na allowlist do organizador — é só do super-admin");
}

secao("A tela do carimbo: só o super-admin a vê, e ela não é o portão");
{
  // Sem tela, a ação do motor era inalcançável e o admin continuava cego para a
  // versão que o circuito declara — que era o 0.10.7. As asserções abaixo travam
  // as três decisões da tela; a guarda de verdade está no servidor.
  const i = fonte.indexOf("function RegulamentoDoCircuitoCard");
  ok(i > 0, "o card do regulamento foi encontrado");
  const card = fonte.slice(i, fonte.indexOf("function AdminDashboard"));

  ok(/Em vigor:/.test(card) && /versaoAtual \|\| "não definida"/.test(card),
    "a tela MOSTRA a versão em vigor — o admin deixa de ser cego para ela");

  // Confirmação-com-nome na tela, além da do motor. O botão não habilita sem
  // ela; não é a guarda, é para o admin não descobrir o erro depois de apertar.
  ok(/confirmacao\.trim\(\) === nomeReal/.test(card),
    "o botão só habilita com o nome do circuito digitado igual");
  ok(/disabled=\{!podeSalvar\}/.test(card),
    "e fica desabilitado até lá");

  // A mensagem do motor é específica (versão de outra família, nome errado,
  // branco) e serve para o admin ler. Trocar por genérico foi o defeito que a
  // Onda 0.6.1 corrigiu noutro lugar.
  ok(/e\?\.message \|\| "Não deu para trocar a versão\."/.test(card),
    "a recusa do servidor chega ao admin com o texto do servidor, não genérico");

  // E só o super-admin vê o card: o motor recusa o organizador por default-deny,
  // e a tela não oferece o que ele não pode fazer.
  ok(/\{!modoOrg && \(\s*<RegulamentoDoCircuitoCard/.test(fonte),
    "o card só aparece para o super-admin, não para o organizador");

  // A tela recarrega depois de carimbar — senão o admin continua vendo a versão
  // antiga e acha que não funcionou.
  ok(/await loadFromSupabase\(\);/.test(card),
    "depois de carimbar, a tela relê do banco");
}

secao("O re-aceite: o atleta lê o texto inteiro, e o recibo não é forjável");
{
  // 0.10.15(b). Nasceu porque o ROADMAP afirmava que a renovação já servia de
  // re-aceite — falso: o RENOVAR grava só `quer_renovar`, sem texto, sem caixa,
  // sem carimbar versão. Sem isto, os atletas entram na temporada nova com
  // preço novo tendo aceitado textos de várias versões atrás.
  const aa = fs.readFileSync(path.join(RAIZ, "supabase", "functions", "athlete-action", "index.ts"), "utf8");
  const iAc = aa.indexOf('case "ACEITAR_REGULAMENTO"');
  ok(iAc > 0, "a ação de re-aceite existe no athlete-action");
  const acao = aa.slice(iAc, aa.indexOf('case "RENOVAR"', iAc));

  // 1. TOKEN, não athleteId. As outras ações desta função confiam no id do
  //    payload, e os ids são públicos no ranking — para um recibo de
  //    consentimento isso significaria que qualquer um aceita pelo outro.
  ok(/const atletaId = await atletaPorTokenAA\(p\.token\);/.test(acao),
    "o re-aceite é autenticado por token de sessão, não pelo athleteId do payload");
  ok(!/p\.athleteId|payload\.athleteId/.test(acao),
    "e não aceita athleteId vindo do cliente");

  // 2. Fail-closed, como o INSCREVER.
  ok(/if \(!versaoAtual\)/.test(acao),
    "sem versão no circuito, não se colhe re-aceite");

  // 3. O atleta declara QUAL versão está aceitando. Se ela mudou entre a tela
  //    carregar e o clique, recusa — senão carimbaria um texto que ele não leu.
  ok(/versaoVista !== versaoAtual/.test(acao),
    "recusa se a versão mudou entre a leitura e o clique");

  // 4. Grava os três campos do aceite, os mesmos que o INSCREVER grava.
  for (const campo of ["aceite_regulamento: true", "data_aceite_regulamento:", "versao_regulamento: versaoAtual"]) {
    ok(acao.includes(campo), `o re-aceite grava ${campo.replace(/:.*/, "")}`);
  }
  ok(/if \(!vinc\)/.test(acao),
    "e só de quem é membro do circuito — aceite sem objeto não vale");

  // ── A TELA DO ATLETA ────────────────────────────────────────────────────
  const iCard = fonte.indexOf("function ReAceiteRegulamentoCard");
  ok(iCard > 0, "o card de re-aceite do atleta foi encontrado");
  const cardAtleta = fonte.slice(iCard, fonte.indexOf("function AthleteView"));

  // Só aparece quando há divergência de verdade, e nunca sem saber as duas pontas.
  ok(/const precisa = !!versaoCircuito && versaoCircuito !== versaoAceita/.test(cardAtleta),
    "o card só aparece quando o circuito declara versão diferente da aceita");

  // Exibe o REGULAMENTO INTEIRO, não o resumo do portão de inscrição — o resumo
  // carrega a frase que TIRA o desconto e não a que PROTEGE (Jurídico).
  ok(/<RegulamentoView onBack=\{\(\)=>setLendo\(false\)\} versao=\{versaoCircuito\}/.test(cardAtleta),
    "o re-aceite exibe o regulamento completo, não o resumo");

  // Caixa DESENHADA, não `<input type="checkbox">` — o nativo renderiza azul,
  // cor fora do manual, e era a única caixa de consentimento do app fora do
  // padrão usado nos aceites de LGPD e CPF. (Designer visual, 19/09/2026.)
  ok(/role="checkbox" aria-checked=\{marcou\}/.test(cardAtleta) && /disabled=\{!marcou \|\| enviando\}/.test(cardAtleta),
    "exige a caixa de seleção marcada antes de habilitar o aceite");
  ok(!/type="checkbox"/.test(cardAtleta),
    "e a caixa é a do projeto, não a nativa do navegador");
  // O botão que carimba o aceite legal usa a cor com contraste AA — havia duas
  // terracotas no tema e ele usava a que reprova (3.87:1 contra 5.34:1).
  ok(/color=\{T\.terracotaBtn\} full/.test(cardAtleta),
    "e o botão de confirmar usa a terracota de contraste AA, não a de destaque");
  ok(/versaoVista: versaoCircuito/.test(cardAtleta),
    "e manda ao servidor QUAL versão o atleta viu");
  // Minúscula porque a frase foi reordenada: primeiro tranquiliza, depois
  // oferece o contato. A ordem antiga pedia uma ação ANTES de dizer que nenhuma
  // era necessária, e o Juliano decidiu que ignorar é opção legítima.
  ok(/não aceitar não é abandono/i.test(cardAtleta),
    "diz que recusar não é abandono — o Cap. 12 pune abandono sem comunicação, e recusar é comunicação");
  const iTranquiliza = cardAtleta.search(/não aceitar não é abandono/i);
  const iContato = cardAtleta.indexOf("fale com o organizador");
  ok(iTranquiliza > 0 && (iContato < 0 || iTranquiliza < iContato),
    "e tranquiliza ANTES de oferecer o contato — pedir ação antes vira obrigação na cabeça do atleta");
  ok(/não gera cobrança/.test(cardAtleta),
    "e que não gera cobrança");

  // ── Os consertos dos guardiões, 18/09 ───────────────────────────────────

  // O `circuitoId` vai DENTRO do payload. O motor lê `payload.circuitoId` e,
  // sem ele, cai em `bhId()` — o aceite seria gravado contra o BH, qualquer que
  // fosse o circuito do atleta. Hoje passaria "certo" porque o BH é o único.
  // (Guardião de Segurança; NO-GO da 1ª rodada.)
  ok(/payload: \{ circuitoId: CIRCUITO_ATIVO, token: cred\.token, versaoVista: versaoCircuito \}/.test(cardAtleta),
    "o circuitoId vai dentro do payload, que é de onde o motor lê");
  ok(!/acao: "ACEITAR_REGULAMENTO", circuitoId:/.test(cardAtleta),
    "e não no nível de cima, onde o motor o ignora e cai no BH");

  // O card reaparecia depois de aceito: as abas são sub-árvores diferentes no
  // mesmo slot, e o estado local se perdia na remontagem.
  ok(/dispatch\(\{ type: "ACEITE_REGULAMENTO_REGISTRADO"/.test(cardAtleta),
    "o aceite atualiza o espelho local — senão o card volta ao trocar de aba");
  ok(/case "ACEITE_REGULAMENTO_REGISTRADO"/.test(fonte),
    "e o reducer sabe tratar isso");

  // O card fica FORA da aba: ele só renderizava sob `meus_jogos`, e a aba é
  // restaurada do localStorage — quem fechou no Ranking nunca o encontrava.
  ok(/\{hub\}<ReAceiteRegulamentoCard/.test(fonte),
    "o card de re-aceite é renderizado fora da aba, acima do conteúdo");

  // A garantia que tranquiliza estava só no WhatsApp.
  ok(/A temporada em andamento <span style=\{\{fontWeight:700\}\}>não muda<\/span>/.test(cardAtleta),
    "o card carrega a mesma garantia da mensagem: a temporada em andamento não muda");

  ok(/✓ Aceite registrado/.test(cardAtleta),
    "e confirma visivelmente o sucesso — para consentimento, sumir não basta");

  // ── A TELA DO ADMIN ─────────────────────────────────────────────────────
  const cardAdmin = fonte.slice(fonte.indexOf("function RegulamentoDoCircuitoCard"), fonte.indexOf("function AdminDashboard"));
  ok(/ainda não aceitaram a/.test(cardAdmin),
    "o admin vê quantos e QUEM ainda não aceitou — sem isso o aviso prévio é cego");
  // Os PENDENTES DE INCLUSÃO entram na conta. O filtro antigo os excluía com a
  // justificativa de que "ainda vão passar pelo portão de inscrição normal" — e
  // o INCLUIR_NO_CIRCUITO do motor não recolhe aceite nenhum, só apaga a flag.
  // O painel podia dizer "✓ todos os 12 aceitaram" com dois membros em v03-11 e
  // v03-8. (Guardião de Regulamento, R5, 19/09/2026.)
  ok(!/a\.status === "ativo" && !a\.pendenteCircuito/.test(cardAdmin),
    "o painel não exclui mais quem está pendente de inclusão da conta");
}

secao("O re-aceite RODANDO: sete cenários contra o athlete-action de verdade");
{
  // Esta seção existe porque a de cima NÃO BASTA — e isso foi provado, não
  // suposto. Em 19/09/2026 o guardião de regulamento sabotou a regra de três
  // jeitos e a bateria ficou VERDE nos três, porque toda a proteção do re-aceite
  // era regex sobre o fonte:
  //
  //   `versaoVista !== versaoAtual` → `versaoVista && versaoVista !== versaoAtual`
  //        a regex /versaoVista !== versaoAtual/ continua casando, e um
  //        `versaoVista` vazio passa a carimbar uma versão que o atleta nunca
  //        declarou ter lido.
  //   `if (!vinc)` → `if (false && !vinc)`
  //        a regex /if \(!vinc\)/ continua casando, e quem não é do circuito
  //        aceita.
  //   enfraquecer `if (!atletaId)`
  //        a regex ancorada na linha do `atletaPorTokenAA` continua casando, e o
  //        recibo volta a ser forjável — que é exatamente o que a ação existe
  //        para impedir.
  //
  // Não havia desculpa de infraestrutura: o `athlete-action` já é carregado de
  // verdade neste mesmo arquivo, e `atleta_sessao` já existe no banco falso.
  //
  // Sessão de mentira, cripto de verdade: o token é gravado como SHA-256 hex,
  // o mesmo formato que `sha256hexAA` produz. O teste não inventa um atalho.
  const sha256hex = async (txt) => {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
  };
  const daquiAUmaHora = () => new Date(Date.now() + 3600e3).toISOString();
  const ontem = () => new Date(Date.now() - 86400e3).toISOString();

  const ATL = "aaaaaaaa-0000-0000-0000-000000000001";
  const FORA = "aaaaaaaa-0000-0000-0000-000000000002";
  const OUTRO_CIRC = "44444444-4444-4444-4444-444444444444";
  const TOKEN = "token-de-teste-do-re-aceite";

  // Os campos de competição entram com valor conhecido para a asserção poder
  // afirmar que o re-aceite NÃO ENCOSTA neles — a Regra 2 do projeto.
  const COMPETICAO = { rating: 777, saldo_sets: 42, vitorias: 3, derrotas: 1, chave_id: "chave1", wo_count: 1 };

  const montarCenario = async ({ versaoCirc = "v03-13", circuitoAlvo = BH, sessao = true, expirada = false, membro = true } = {}) => {
    const { banco } = await montarMotor({
      circuitos: [
        circuito(BH, { regulamento_versao: versaoCirc }),
        circuito(OUTRO_CIRC, { slug: "outro", regulamento_versao: versaoCirc }),
      ],
      atletas: [atleta(ATL, { nome: "Fulano", status: "ativo", versao_regulamento: "v03-3", aceite_regulamento: true, ...COMPETICAO })],
      circuito_atletas: [
        ...(membro ? [{ circuito_id: BH, atleta_id: ATL, status: "ativo", versao_regulamento: "v03-3", ...COMPETICAO }] : []),
        ...(membro ? [{ circuito_id: OUTRO_CIRC, atleta_id: ATL, status: "ativo", versao_regulamento: "v03-3", ...COMPETICAO }] : []),
      ],
      outras: {
        atleta_sessao: sessao
          ? [{ id: "s1", atleta_id: ATL, token_hash: await sha256hex(TOKEN), expira_em: expirada ? ontem() : daquiAUmaHora() }]
          : [],
      },
    });
    const atletaFn = await carregarFuncao("athlete-action", banco);
    const chamar = (p) => atletaFn.chamar({ acao: "ACEITAR_REGULAMENTO", payload: { circuitoId: circuitoAlvo, ...p } });
    const versaoGravada = (circId = BH) => {
      const v = banco.tabelas.circuito_atletas.find(x => x.circuito_id === circId && x.atleta_id === ATL);
      return v ? v.versao_regulamento : null;
    };
    return { banco, chamar, versaoGravada };
  };

  // 1. CAMINHO FELIZ — e a prova de que competição não se mexe.
  {
    const { banco, chamar, versaoGravada } = await montarCenario();
    const r = await chamar({ token: TOKEN, versaoVista: "v03-13" });
    igual(r.status, 200, "o aceite legítimo é aceito");
    igual(r.corpo?.dados?.versao, "v03-13", "e devolve a versão carimbada");
    igual(versaoGravada(), "v03-13", "a versão do vínculo passa a ser a nova");
    const glob = banco.tabelas.atletas.find(a => a.id === ATL);
    igual(glob.aceite_regulamento, true, "o aceite fica registrado");
    ok(!!glob.data_aceite_regulamento, "com data — sem data o recibo não prova quando");
    // Regra 2: o BH não é prejudicado. Aqui isso é aritmético.
    for (const [campo, esperado] of Object.entries(COMPETICAO)) {
      igual(glob[campo], esperado, `o re-aceite não encosta em ${campo}`);
    }
  }

  // 2. `versaoVista` VAZIA — a mutação nº 1 do guardião.
  {
    const { chamar, versaoGravada } = await montarCenario();
    const r = await chamar({ token: TOKEN, versaoVista: "" });
    igual(r.status, 409, "sem declarar qual versão leu, o aceite é recusado");
    igual(versaoGravada(), "v03-3", "e nada é carimbado — a versão antiga continua lá");
  }

  // 3. `versaoVista` DESATUALIZADA (o regulamento mudou enquanto ele lia).
  {
    const { chamar, versaoGravada } = await montarCenario();
    const r = await chamar({ token: TOKEN, versaoVista: "v03-12" });
    igual(r.status, 409, "declarar uma versão que não é a do circuito é recusado");
    igual(versaoGravada(), "v03-3", "e nada é carimbado");
  }

  // 4. SEM TOKEN, TOKEN ERRADO e TOKEN EXPIRADO — a mutação nº 3.
  {
    const { chamar, versaoGravada } = await montarCenario();
    const semToken = await chamar({ versaoVista: "v03-13" });
    igual(semToken.status, 401, "sem token, o recibo não é emitido");
    const errado = await chamar({ token: "token-inventado", versaoVista: "v03-13" });
    igual(errado.status, 401, "com token inventado, também não");
    igual(versaoGravada(), "v03-3", "e nenhuma das duas tentativas gravou nada");
  }
  {
    const { chamar, versaoGravada } = await montarCenario({ expirada: true });
    const r = await chamar({ token: TOKEN, versaoVista: "v03-13" });
    igual(r.status, 401, "sessão expirada não carimba aceite");
    igual(versaoGravada(), "v03-3", "e não deixa rastro");
  }

  // 5. NÃO-MEMBRO — a mutação nº 2.
  {
    const { banco, chamar } = await montarCenario({ membro: false });
    const r = await chamar({ token: TOKEN, versaoVista: "v03-13" });
    igual(r.status, 403, "quem não participa do circuito não aceita o regulamento dele");
    igual(banco.tabelas.circuito_atletas.length, 0, "e nenhum vínculo é criado pela recusa");
  }

  // 6. CIRCUITO NÃO-BH — o aceite é do circuito, não global.
  {
    const { banco, chamar, versaoGravada } = await montarCenario({ circuitoAlvo: OUTRO_CIRC });
    const r = await chamar({ token: TOKEN, versaoVista: "v03-13" });
    igual(r.status, 200, "o aceite vale em circuito que não é o BH");
    igual(versaoGravada(OUTRO_CIRC), "v03-13", "e carimba o vínculo daquele circuito");
    igual(versaoGravada(BH), "v03-3", "sem contaminar o vínculo do BH");
    igual(banco.tabelas.atletas.find(a => a.id === ATL).versao_regulamento, "v03-3",
      "nem a identidade global — aceite é sazonal, não identidade");
  }

  // 7. IDEMPOTÊNCIA — aceitar duas vezes não quebra nem duplica.
  {
    const { banco, chamar, versaoGravada } = await montarCenario();
    await chamar({ token: TOKEN, versaoVista: "v03-13" });
    const r2 = await chamar({ token: TOKEN, versaoVista: "v03-13" });
    igual(r2.status, 200, "aceitar de novo continua respondendo 200");
    igual(versaoGravada(), "v03-13", "e a versão segue a mesma");
    igual(banco.tabelas.circuito_atletas.filter(x => x.circuito_id === BH && x.atleta_id === ATL).length, 1,
      "sem duplicar o vínculo");
  }
}

secao("O par (versão, preço) não pode mentir — nem pelo carimbo, nem pelo financeiro");
{
  // Achado do guardião de regulamento em 19/09/2026, SIMULADO contra este motor:
  // a trava do NOVA_TEMPORADA protege UMA ação, não o par. Em três passos
  // legítimos — carimbar v03-13, virar (o preço vai a 100), carimbar v03-12 de
  // volta — chega-se exatamente ao estado que a trava existe para proibir: texto
  // prometendo 80% na 2ª etapa, app cobrando 100%. Contra o atleta.
  const PCT_DESC = 80, PCT_CHEIO = 100;

  // O carimbo, pela ponta do super-admin.
  {
    const { banco, motor } = await montarMotor({
      circuitos: [circuito(BH, { regulamento_versao: "v03-13", percentual_entrada_meio: PCT_CHEIO, nome_circuito: "Clube do Tênis de Mesa" })],
    });
    const r = await comoAdmin(motor, "DEFINIR_REGULAMENTO_VERSAO", { versao: "v03-12", confirmacaoNome: "Clube do Tênis de Mesa" });
    igual(r.status, 409, "carimbar de volta uma versão que promete desconto, cobrando 100%, é recusado");
    igual(banco.tabelas.circuitos.find(c => c.id === BH).regulamento_versao, "v03-13",
      "e a versão gravada não muda — a recusa não deixa rastro");
  }

  // O estado de HOJE tem de continuar carimbável: v03-12 com 80% é coerente.
  {
    const { banco, motor } = await montarMotor({
      circuitos: [circuito(BH, { regulamento_versao: "v03-11", percentual_entrada_meio: PCT_DESC, nome_circuito: "Clube do Tênis de Mesa" })],
    });
    const r = await comoAdmin(motor, "DEFINIR_REGULAMENTO_VERSAO", { versao: "v03-12", confirmacaoNome: "Clube do Tênis de Mesa" });
    igual(r.status, 200, "versão que promete desconto, com desconto cobrado, é carimbável");
    igual(banco.tabelas.circuitos.find(c => c.id === BH).regulamento_versao, "v03-12", "e grava");
  }

  // A JANELA DE TRANSIÇÃO não pode ser barrada, senão vira impasse: a trava
  // exige carimbar a v03-13 ANTES de virar, e quem leva o preço a 100 é a virada.
  {
    const { banco, motor } = await montarMotor({
      circuitos: [circuito(BH, { regulamento_versao: "v03-12", percentual_entrada_meio: PCT_DESC, nome_circuito: "Clube do Tênis de Mesa" })],
    });
    const r = await comoAdmin(motor, "DEFINIR_REGULAMENTO_VERSAO", { versao: "v03-13", confirmacaoNome: "Clube do Tênis de Mesa" });
    igual(r.status, 200, "carimbar a v03-13 com 80% ainda cobrado é PERMITIDO — é a janela de transição");
    igual(banco.tabelas.circuitos.find(c => c.id === BH).regulamento_versao, "v03-13",
      "senão não daria para carimbar nem para virar, e a temporada travaria para sempre");
  }

  // O financeiro, pela ponta do ORGANIZADOR — caminho mais curto que o carimbo.
  {
    const { banco, motor } = await montarMotor({
      circuitos: [circuito(BH, { regulamento_versao: "v03-12", percentual_entrada_meio: PCT_DESC })],
    });
    const r = await comoAdmin(motor, "DEFINIR_FINANCEIRO", { percentualMeio: PCT_CHEIO });
    igual(r.status, 409, "tirar o desconto sem trocar o texto que o promete é recusado");
    igual(banco.tabelas.circuitos.find(c => c.id === BH).percentual_entrada_meio, PCT_DESC,
      "e o percentual gravado não muda");
  }

  // Sob a v03-13 o percentual cheio é o esperado — a guarda não pode travar isso.
  {
    const { motor } = await montarMotor({
      circuitos: [circuito(BH, { regulamento_versao: "v03-13", percentual_entrada_meio: PCT_CHEIO })],
    });
    const r = await comoAdmin(motor, "DEFINIR_FINANCEIRO", { percentualMeio: PCT_CHEIO });
    igual(r.status, 200, "sob a v03-13, cobrar 100% é exatamente o que o texto diz");
  }
}

secao("O app e o motor concordam sobre quais versões existem — lista a lista");
{
  // R3: o aviso prévio é a PROVA CONTRATUAL de que o Clube avisou. Ele não pode
  // aplicar padrão mais frouxo que o ato que anuncia. Antes desta guarda, o
  // admin podia anunciar "V03-13" (V maiúsculo) para os 12 ativos e só descobrir
  // no carimbo que o motor recusa — e a maiúscula NÃO é normalizada de propósito
  // lá ("V03-13" é typo, e typo tem de barrar).
  //
  // Esta asserção compara as listas DOS DOIS LADOS. Se o motor ganhar uma
  // família ou uma versão e o app não, fica vermelho — que é o único jeito de a
  // cópia não apodrecer.
  const motorFamilias = fs.readFileSync(path.join(RAIZ, "supabase", "functions", "admin-action", "index.ts"), "utf8");
  const doMotor = (nome) => {
    const m = motorFamilias.match(new RegExp(`const ${nome} = new Set\\(\\[([^\\]]*)\\]`));
    return m ? [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]).sort() : null;
  };
  const doApp = (nome) => {
    const m = fonte.match(new RegExp(`const ${nome} = new Set\\(\\[([^\\]]*)\\]`));
    return m ? [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]).sort() : null;
  };
  for (const [noMotor, noApp] of [
    ["VERSOES_DO_BH", "VERSOES_CARIMBAVEIS_BH"],
    ["VERSOES_DE_RATING_NOVO", "VERSOES_CARIMBAVEIS_RATING_NOVO"],
    ["VERSOES_DO_SISTEMA_B", "VERSOES_CARIMBAVEIS_SISTEMA_B"],
  ]) {
    const a = doMotor(noMotor), b = doApp(noApp);
    ok(Array.isArray(a) && a.length > 0, `${noMotor} foi lida do motor`);
    igual(b, a, `${noApp} no app é idêntica a ${noMotor} no motor`);
  }

  // E a escolha da família segue a MESMA regra do motor: BH primeiro, senão o
  // sistema decide. Escrito com as variáveis de módulo que existem de verdade —
  // `state.circuitoSlug` e `state.sistema` NÃO existem, e foi o primeiro jeito
  // que escrevi.
  const escolha = fonte.slice(fonte.indexOf("function versoesCarimbaveis"), fonte.indexOf("function RegulamentoView"));
  ok(/CIRCUITO_ATIVO === CIRCUITO_BH_ID/.test(escolha),
    "a família do BH é escolhida pelo id do circuito ativo");
  ok(/SISTEMA_ATIVO === "B"/.test(escolha),
    "e o resto pelo sistema — a mesma ordem de decisão do motor");

  // O disparo é BLOQUEADO com alvo fora da família: fila vazia, não lembrete
  // disfarçado. Anunciar versão que o motor vai recusar é prometer aos atletas
  // uma coisa que não acontece.
  ok(/if \(cat === "regulamento" && alvoForaDaFamilia\) return \[\];/.test(fonte),
    "alvo fora da família não gera mensagem nenhuma");
  ok(/const alvoForaDaFamilia = !!alvoLimpo && !versoesCarimbaveis\(\)\.has\(alvoLimpo\);/.test(fonte),
    "e a checagem usa a família do circuito, não um formato genérico");

  // A LEGENDA do campo decide pela mesma condição do gerador. Antes decidia só
  // por o campo estar preenchido: digitar a versão JÁ EM VIGOR fazia a legenda
  // prometer "avisando todos" enquanto saía o lembrete. Nenhuma mensagem errada
  // era enviada, mas o admin podia acreditar que avisou com antecedência sem ter
  // avisado nada. (Operações, 19/09/2026.)
  ok(/const alvoEhPrevio = !!alvoLimpo && !alvoForaDaFamilia &&\s*\n\s*alvoLimpo !== String\(state\.regulamentoVersao \|\| ""\)\.trim\(\);/.test(fonte),
    "a legenda do campo decide pela mesma condição do gerador, não por o campo estar preenchido");
  const legenda = fonte.slice(fonte.indexOf("{alvoForaDaFamilia"), fonte.indexOf("Em branco, avisa só"));
  ok(/já é<\/b> a versão em vigor/.test(legenda),
    "e diz na cara quando a versão digitada já é a em vigor — aí não é aviso prévio");

  // A descrição da categoria conta que existem DOIS modos. Sem isso, o campo só
  // aparece depois de clicar, e o caminho de descoberta dependia de o admin já
  // saber que o botão existe — sendo que a consequência de não descobrir é a
  // violação jurídica que o pacote inteiro existe para evitar.
  ok(/desc:"Avisa ANTES de trocar \(todos\) ou cobra quem não aceitou a versão em vigor"/.test(fonte),
    "a descrição da categoria menciona o modo de aviso prévio");
}

secao("A virada pede o nome do circuito — o padrão que o projeto exige das ações destrutivas");
{
  // 0.10.20. O CLAUDE.md já mandava ("Mudança destrutiva pede
  // confirmação-com-nome"), e a ação MAIS destrutiva do app era a que não pedia.
  // A incoerência: trocar o TEXTO do regulamento exige digitar o nome e é
  // reversível (recarimba); virar a temporada apaga partidas e zera stats sem
  // volta e pedia um clique. E o botão VIZINHO já usava confirm().
  const painel = fonte.slice(fonte.indexOf("function NovaTemporadaPanel"), fonte.indexOf("function NovaTemporadaPanel") + 6000);
  ok(/const nomeConfere = confirmacaoNome\.trim\(\) === nomeRealVirada;/.test(painel),
    "a virada compara o nome digitado com o nome real do circuito");
  ok(/disabled=\{virando \|\| !nomeConfere\}/.test(painel),
    "e o botão de virar fica desabilitado enquanto o nome não bate");
  // A guarda tem de estar DENTRO do onClick também: `disabled` é da tela, e tela
  // não é portão. (Mesma lição do carimbo.)
  const iGuardaNome = painel.indexOf("if (virando || !nomeConfere) return;");
  const iDispatch = painel.indexOf('dispatch({type:"NOVA_TEMPORADA"');
  ok(iGuardaNome > 0 && iGuardaNome < iDispatch,
    "e a checagem do nome roda ANTES do dispatch, não só no disabled");
  // Fechar o modal limpa o campo: senão o nome digitado sobrevive ao cancelar, e
  // o próximo "Virar…" abre já confirmado — o atrito valeria uma vez só.
  ok(/const fecharModal = \(\) => \{ setConfirmando\(false\); setConfirmacaoNome\(""\); \};/.test(painel),
    "e fechar o modal limpa o nome digitado, para o atrito não valer só uma vez");
}

secao("O aviso prévio: os três conteúdos, e o registro que é a prova");
{
  // 0.10.15(c). Não é cortesia: o portão do aceite promete, no texto que os
  // atletas assinaram, que "o regulamento pode ser atualizado com aviso prévio"
  // — e o ônus de provar que avisou é do Clube. O registro em
  // `mensagens_enviadas` (atleta + data + texto + categoria) É a prova.
  ok(/\{id:"regulamento", icon:"📋", label:"Mudança de Regulamento"/.test(fonte),
    "existe a categoria de aviso de mudança de regulamento");

  const i = fonte.indexOf('case "regulamento": {');
  ok(i > 0, "o gerador do aviso foi encontrado");
  const aviso = fonte.slice(i, fonte.indexOf('case "lembretes"', i));

  // Os TRÊS conteúdos obrigatórios que o Jurídico especificou.
  ok(/O que muda:/.test(aviso), "o aviso diz O QUE muda");
  ok(/A temporada em andamento não muda/.test(aviso),
    "diz que a temporada em andamento NÃO muda — é a garantia que protege quem já está dentro");
  ok(/O que fazer:/.test(aviso) && /confirme o aceite/.test(aviso),
    "e diz O QUE FAZER: ler no app e confirmar");
  ok(/versão \*\$\{versaoEmVigor\}\*/.test(aviso),
    "nomeia a versão que passou a valer");

  // O aviso NÃO resume o regulamento — manda ler. Resumir foi o que o Jurídico
  // apontou como perigoso: o resumo carrega a frase que TIRA o desconto e não a
  // que PROTEGE.
  ok(!/80%/.test(aviso),
    "o aviso não tenta resumir cláusulas — manda ler o texto em vigor");

  // Fail-closed: sem versão em vigor, não se manda aviso nenhum.
  ok(/if \(!versaoEmVigor\) return \[\];/.test(aviso),
    "sem saber a versão em vigor, nenhum aviso é gerado");

  // A categoria só aparece quando há alguém para avisar — senão o admin não
  // sabe se é porque todos aceitaram ou porque algo quebrou.
  // ATUALIZADA em 19/09: a categoria passou a estar disponível sempre que há
  // atleta ativo, não só quando há divergência. O motivo é o achado J1 do
  // Jurídico: **antes do carimbo ninguém diverge**, e é justamente aí que o
  // aviso prévio precisa sair. Com a condição antiga, o aviso só existia depois
  // da mudança — e por construção nunca podia ser prévio, que é exatamente o
  // que o portão de aceite promete aos atletas.
  ok(/if \(c\.id === "regulamento"\) return \(state\.athletes \|\| \[\]\)\.some\(a => a\.status === "ativo" && !a\.pendenteCircuito\);/.test(fonte),
    "a categoria é oferecida sempre que há atleta ativo — senão o aviso nunca pode ser prévio");

  // ── O MODO AVISO PRÉVIO ─────────────────────────────────────────────────
  const iAviso = fonte.indexOf('case "regulamento": {');
  const blocoAviso = fonte.slice(iAviso, fonte.indexOf('case "lembretes"', iAviso));

  ok(/function gerarMensagensCategoria\(cat, state, telefones = \{\}, versaoAlvo = ""\)/.test(fonte),
    "o gerador aceita uma versão-alvo, que é o que liga o modo prévio");
  ok(/if \(alvo && alvo !== versaoEmVigor\) \{/.test(blocoAviso),
    "e troca de modo quando a versão-alvo ainda não foi carimbada");

  // No modo prévio vai para TODOS os ativos, não só os divergentes — antes do
  // carimbo ninguém diverge, então filtrar por divergência daria lista vazia.
  ok(/const ativos = \(state\.athletes \|\| \[\]\)\.filter\(a => a\.status === "ativo"\);/.test(blocoAviso),
    "o aviso prévio vai para TODOS os ativos, não só para quem diverge");
  // E grava categoria PRÓPRIA: os dois modos gravavam "regulamento", e a chave
  // de "já enviada" é (atleta, categoria, mês) — então avisar antes marcava o
  // LEMBRETE posterior como já enviado para todo mundo, e a única mensagem
  // acionável nunca entrava na fila.
  ok(/categoria: "regulamento_previo"/.test(blocoAviso),
    "e o aviso prévio se registra com categoria própria, sem colidir com o lembrete");

  // E o tempo verbal importa: é anúncio, não comunicação de fato consumado.
  ok(/\*passará a valer\*/.test(blocoAviso),
    "o aviso prévio está no futuro — 'passará a valer', não 'passou a valer'");
  ok(/nada agora/.test(blocoAviso),
    "e diz que o atleta não precisa fazer nada ainda");
  ok(/passou a valer pela versão/.test(blocoAviso),
    "o modo lembrete, para depois do carimbo, continua existindo no passado");

  // A MESMA função escolhe quem recebe o aviso e quem aparece como pendente no
  // painel do admin. Duas listas divergentes seria o pior dos mundos: avisar
  // quem já aceitou, ou dizer que faltam 3 e mandar para 2.
  // Medido DENTRO do card do admin, não no arquivo inteiro: contar ocorrências
  // globais deixava a mutação verde, porque sobravam três usos noutros lugares.
  // É a mesma armadilha da asserção que contava `percentual_entrada_meio`.
  const cardAdm = fonte.slice(fonte.indexOf("function RegulamentoDoCircuitoCard"), fonte.indexOf("function AdminDashboard"));
  ok(/const pendentes = atletasSemAceite\(/.test(cardAdm),
    "o painel do admin usa a MESMA função do aviso para listar os pendentes");
  // As TRÊS listas — esta, a do aviso e a do card do atleta — passam a
  // coincidir. Era a divergência entre elas o achado R5.
  const corpoSemAceite = fonte.slice(fonte.indexOf("function atletasSemAceite"), fonte.indexOf("function todasMensagensPendentes"));
  ok(!/!a\.pendenteCircuito/.test(corpoSemAceite),
    "atletasSemAceite não exclui mais quem está pendente de inclusão");
  ok(/a\.status === "ativo" &&/.test(corpoSemAceite),
    "mas continua contando só quem está ativo");

  // O aviso tem de estar na FILA UNIFICADA e no contador. Estava fora: a única
  // mensagem com promessa contratual pendurada era a única que o admin tinha de
  // lembrar sozinho. O Jurídico apontou que esta asserção não existia — e que a
  // bateria passaria com o aviso fora da fila, que era o estado real.
  const ordem = fonte.match(/const ORDEM_DISPARO = \[([^\]]*)\]/);
  ok(!!ordem, "a ordem de disparo foi encontrada");
  const cats = [...(ordem ? ordem[1] : "").matchAll(/"([^"]+)"/g)].map(x => x[1]);
  ok(cats.includes("regulamento"),
    `o aviso de regulamento está na fila unificada e no contador (achadas: ${cats.join(", ")})`);
}

secao("A trava é lista de PERMISSÃO — typo no carimbo fecha o portão, não abre");
{
  // A 1ª versão desta guarda perguntava "esta versão promete desconto?" e barrava
  // se sim. Três guardiões, cada um por um caminho, mostraram o mesmo buraco: tudo
  // que não estivesse na lista PASSAVA — inclusive a v03-11 e a v03-4, que são
  // versões reais antigas do BH e também prometiam 80%, e inclusive um typo do
  // carimbo manual, que é a única operação de que o plano inteiro depende.
  //
  // Estas asserções falhariam contra o código de ontem. É o ponto delas.
  const cenario = async (versao) => montarMotor({
    circuitos: [circuito(BH, { regulamento_versao: versao, percentual_entrada_meio: 80 })],
    atletas: [atleta("p1"), atleta("p2")],
    partidas: [partida("j1", { atleta1_id: "p1", atleta2_id: "p2", placar1: 3, placar2: 1, validado: true, calculado: true })],
    funcoes: { arquivar_partidas_temporada_circuito: () => null },
  });

  const devemBarrar = [
    [null, "versão nula"],
    ["", "versão vazia"],
    ["v03-12", "a versão que promete 80%"],
    ["v03-11", "versão antiga real do BH, que também prometia 80%"],
    ["v03-4", "versão antiga real do BH, que também prometia 80%"],
    ["V03-13", "typo de maiúscula no carimbo manual"],
    ["v03-14", "versão futura que ninguém classificou ainda"],
    ["qualquer-coisa", "lixo digitado no carimbo"],
  ];
  for (const [versao, porque] of devemBarrar) {
    const { banco, motor } = await cenario(versao);
    const r = await comoAdmin(motor, "NOVA_TEMPORADA", { circuitoId: BH });
    ok(r.corpo?.sucesso === false && r.status === 409,
      `a virada do BH é recusada com ${JSON.stringify(versao)} — ${porque}`);
    igual(banco.tabelas.partidas.length, 1,
      `e nada foi destruído com ${JSON.stringify(versao)} — a guarda agiu antes de arquivar`);
  }

  // O espaço sobrando é o único caso perdoado: não é decisão de ninguém, é o
  // teclado. `trim` resolve, e errar para o lado de deixar passar aqui é seguro
  // porque o número da versão está certo.
  {
    const { banco, motor } = await cenario("v03-13 ");
    const r = await comoAdmin(motor, "NOVA_TEMPORADA", { circuitoId: BH });
    ok(r.corpo?.sucesso === true,
      `espaço sobrando no carimbo não barra a virada (veio: ${JSON.stringify(r.corpo?.erro ?? true)})`);
    igual(banco.acha("circuitos", c => c.id === BH)?.percentual_entrada_meio, 100,
      "e a virada com v03-13 leva o ESPELHO em `circuitos` a 100");
  }

  // ── E se o espelho falhar? ────────────────────────────────────────────────
  // O `mirrorConfig` engole o erro com um `console.warn` e segue, de propósito:
  // é para nunca quebrar a operação do BH. Mas o app lê `circuitos` — o espelho —
  // MESMO PARA O BH (`App.jsx:216`, `getConfig`). Ninguém lê
  // `configuracao.percentual_entrada_meio`: nem o app, nem o athlete-action, nem
  // o login-atleta, nem a RPC de preço.
  //
  // Então uma falha silenciosa do espelho tem um efeito preciso: a `configuracao`
  // diz 100, o `circuitos` fica em 80, e **o BH continua cobrando 80%** — que é
  // exatamente o que o pacote existe para acabar. Sem erro para ninguém.
  //
  // Esta asserção não conserta isso: ela torna a divergência VISÍVEL e
  // documentada, para ninguém afirmar que a virada garante o preço novo.
  // (Pedida pelo supervisor do guardião de Segurança, que notou que a
  // ferramenta de injeção de falha já existia e estava a quatro linhas.)
  {
    const { banco, motor } = await cenario("v03-13");
    banco.recusar("circuitos", "update", { message: "simulando falha do espelho", code: "XX000" });
    const r = await comoAdmin(motor, "NOVA_TEMPORADA", { circuitoId: BH });
    ok(r.corpo?.sucesso === true,
      "a virada NÃO quebra quando o espelho falha — é best-effort de propósito");
    igual(banco.acha("configuracao", c => c.id === 1)?.percentual_entrada_meio, 100,
      "o lugar autoritativo (`configuracao`) recebe o 100");
    igual(banco.acha("circuitos", c => c.id === BH)?.percentual_entrada_meio, 80,
      "mas o ESPELHO fica para trás — e é ele que o app lê, então o BH seguiria cobrando 80%");
  }
}

secao("A virada bem-sucedida faz o que promete — não só deixa de recusar");
{
  // Até aqui a bateria só provava que a trava RECUSA. O que acontece quando ela
  // DEIXA passar não tinha asserção nenhuma: nada verificava histórico, posição
  // final, totais acumulados nem preservação de rating — na ação mais destrutiva
  // do motor, que é irreversível e que esta onda alterou.
  //
  // A prova existiu: o guardião de Regulamento rodou a simulação na 1ª rodada e
  // mostrou estado byte-idêntico. Mas ficou na sessão dele e **nunca virou
  // asserção** — contra a regra da casa. O supervisor dele cobrou, com razão:
  // "verificado uma vez" não é "protegido".
  const { banco, motor } = await montarMotor({
    circuitos: [circuito(BH, { regulamento_versao: "v03-13", percentual_entrada_meio: 80 })],
    atletas: [
      atleta("venceu", { rating: 620, rating_pico: 640, vitorias: 3, derrotas: 1, saldo_temp: 40, vitorias_total: 10, derrotas_total: 5, historico: [{ temporada: "3/2025", pos: 2 }], pagamento_proxima_confirmado: true }),
      atleta("perdeu", { rating: 480, rating_pico: 500, vitorias: 1, derrotas: 3, saldo_temp: -40, vitorias_total: 7, derrotas_total: 9, historico: [], pagamento_proxima_confirmado: false }),
    ],
    partidas: [partida("j1", { atleta1_id: "venceu", atleta2_id: "perdeu", placar1: 3, placar2: 1, validado: true, calculado: true })],
    funcoes: { arquivar_partidas_temporada_circuito: () => null },
  });
  const r = await comoAdmin(motor, "NOVA_TEMPORADA", { circuitoId: BH });
  ok(r.corpo?.sucesso === true, `a virada aconteceu (veio: ${JSON.stringify(r.corpo?.erro ?? true)})`);

  const venceu = banco.acha("atletas", a => a.id === "venceu");
  const perdeu = banco.acha("atletas", a => a.id === "perdeu");

  // 1. O RATING é o patrimônio do atleta — a virada não pode encostar.
  igual(venceu.rating, 620, "o rating do vencedor é PRESERVADO na virada");
  igual(perdeu.rating, 480, "o rating do perdedor é PRESERVADO na virada");
  igual(venceu.rating_pico, 640, "o rating de pico também");

  // 2. O que é da TEMPORADA zera.
  igual([venceu.saldo_temp, venceu.vitorias, venceu.derrotas], [0, 0, 0],
    "saldo, vitórias e derrotas da temporada zeram");
  igual(venceu.chave, null, "a chave é desfeita");
  igual(venceu.wo_culposos_temporada, 0, "os W.O. culposos da temporada zeram");

  // 3. Os TOTAIS acumulam o que a temporada produziu — se isto quebrar, o
  //    histórico de carreira do atleta é apagado em silêncio.
  igual(venceu.vitorias_total, 13, "vitórias da temporada somam ao total de carreira (10 + 3)");
  igual(venceu.derrotas_total, 6, "derrotas idem (5 + 1)");
  igual(perdeu.vitorias_total, 8, "e para o outro atleta também (7 + 1)");

  // 4. A POSIÇÃO FINAL entra no histórico, na frente, com o rótulo da temporada
  //    que acabou. É o que alimenta a carta colecionável do atleta.
  igual(venceu.historico[0], { temporada: "1/2026", pos: 1 },
    "quem venceu entra no histórico como 1º da temporada 1/2026");
  igual(perdeu.historico[0], { temporada: "1/2026", pos: 2 },
    "e quem perdeu como 2º");
  igual(venceu.historico[1], { temporada: "3/2025", pos: 2 },
    "o histórico anterior continua atrás, não é sobrescrito");

  // 5. O PAGAMENTO da próxima vira o pagamento da atual.
  igual(venceu.pagamento_confirmado, true, "quem pagou a próxima entra pago na temporada nova");
  igual(perdeu.pagamento_confirmado, false, "quem não pagou, não");

  // E o campo da PRÓXIMA tem de ser consumido, não só copiado. Sem este reset,
  // o atleta fica pré-pago para sempre e **ganha uma temporada grátis a cada
  // virada** — e a bateria ficava verde, porque o campo aparecia só como
  // ENTRADA do cenário, nunca como saída. É dinheiro sumindo em silêncio.
  // (Supervisor do guardião de Regulamento; severidade crítica no mandato dele.)
  igual(venceu.pagamento_proxima_confirmado, false,
    "o pagamento da próxima é CONSUMIDO na virada — senão o atleta vira pré-pago eterno");
  igual(perdeu.pagamento_proxima_confirmado, false,
    "e para quem não tinha, continua falso");
  igual([venceu.quer_renovar, venceu.renovacao_em], [false, null],
    "a intenção de renovar é limpa — ela é da temporada que acabou");

  // Zeragem conferida nos DOIS atletas, não só no vencedor — a assimetria era
  // minha, e o supervisor apontou.
  igual([perdeu.saldo_temp, perdeu.vitorias, perdeu.derrotas], [0, 0, 0],
    "saldo, vitórias e derrotas zeram também para quem perdeu");
  igual(perdeu.chave, null, "e a chave é desfeita para os dois");

  // 6. A temporada avança e as partidas somem da mesa.
  const cfg = banco.acha("configuracao", c => c.id === 1);
  igual([cfg.temporada_numero, cfg.temporada_ano], [2, 2026], "a temporada avança para 2/2026");
  igual(cfg.fase, "inscricoes", "e a fase volta para inscrições");
  igual(banco.tabelas.partidas.length, 0, "as partidas da temporada que acabou saem da mesa");
}

secao("A posição final respeita o critério de desempate, nível a nível");
{
  // A asserção anterior provava o ENCANAMENTO (a posição entra na frente do
  // histórico, o anterior fica atrás) mas não a REGRA que decide quem é 1º: no
  // cenário de dois atletas, o vencedor ganhava por saldo, por vitórias, pelo
  // confronto direto E pelo rating ao mesmo tempo. O supervisor testou e mostrou
  // que **apagar o `cmpRankingDB` inteiro deixava o bloco verde**.
  //
  // Aqui cada par vizinho é decidido por UM nível só, e desempatado ao contrário
  // nos demais — então remover qualquer nível troca a ordem e acende.
  //   cmpRankingDB: saldo_temp -> vitorias -> confronto direto -> rating
  //
  //   A  saldo 30  vit 0  rating 100   1º  (ganha de B só no SALDO; perde em tudo)
  //   B  saldo 20  vit 5  rating 100   2º  (ganha de C só no CONFRONTO DIRETO)
  //   C  saldo 20  vit 5  rating 200   3º  (ganha de D só nas VITÓRIAS)
  //   D  saldo 20  vit 3  rating 900   4º  (ganha de E só no RATING)
  //   E  saldo 20  vit 3  rating 400   5º
  const sazonal = (id, saldo, vit, rating, extra = {}) =>
    atleta(id, { saldo_temp: saldo, vitorias: vit, derrotas: 0, rating, rating_pico: rating, historico: [], ...extra });

  const { banco, motor } = await montarMotor({
    circuitos: [circuito(BH, { regulamento_versao: "v03-13" })],
    // INSERIDOS NA ORDEM INVERSA da esperada, de propósito. Com a ordem de
    // inserção igual à esperada, apagar o `.sort(cmpRankingDB(...))` inteiro
    // deixava a bateria VERDE — a lista já saía certa por acidente. Foi o que
    // aconteceu na 1ª tentativa desta asserção.
    atletas: [
      sazonal("E", 20, 3, 400),
      sazonal("D", 20, 3, 900),
      sazonal("C", 20, 5, 200),
      sazonal("B", 20, 5, 100),
      sazonal("A", 30, 0, 100),
      // ── E os dois FILTROS do ranking, que também não tinham asserção ──
      // `rankingFinal` filtra `!pendente_circuito && idsComPartida.has(id)`.
      sazonal("pendente", 999, 9, 999, { pendente_circuito: true }),   // saldo altíssimo de propósito
      sazonal("naoJogou", 999, 9, 999, { historico: [{ temporada: "3/2025", pos: 7 }] }),
      sazonal("soRejeitada", 999, 9, 999),
    ],
    partidas: [
      // B ganhou de C no confronto direto — é o 3º nível do desempate.
      partida("h2h", { atleta1_id: "B", atleta2_id: "C", placar1: 3, placar2: 1, validado: true, calculado: true }),
      // As demais existem só para os atletas entrarem em `idsComPartida`.
      partida("q1", { atleta1_id: "A", atleta2_id: "D", placar1: 3, placar2: 0, validado: true, calculado: true }),
      partida("q2", { atleta1_id: "E", atleta2_id: "A", placar1: 1, placar2: 3, validado: true, calculado: true }),
      partida("q3", { atleta1_id: "pendente", atleta2_id: "A", placar1: 0, placar2: 3, validado: true, calculado: true }),
      // Partida REJEITADA não qualifica ninguém para o ranking.
      partida("rej", { atleta1_id: "soRejeitada", atleta2_id: "A", placar1: 3, placar2: 0, validado: true, rejeitado: true, calculado: true }),
    ],
    funcoes: { arquivar_partidas_temporada_circuito: () => null },
  });
  const r = await comoAdmin(motor, "NOVA_TEMPORADA", { circuitoId: BH });
  ok(r.corpo?.sucesso === true, `a virada aconteceu (veio: ${JSON.stringify(r.corpo?.erro ?? true)})`);

  // Procura a entrada DESTA temporada, não a primeira do histórico: quem não
  // jogou mantém a entrada antiga na posição 0, e ler `historico[0]` confundiria
  // "não recebeu posição nova" com "recebeu a posição antiga". Meu atalho errou
  // nisso na 1ª tentativa e a asserção acusou.
  const pos = id => (banco.acha("atletas", a => a.id === id)?.historico || [])
    .find(h => h.temporada === "1/2026")?.pos ?? null;
  igual([pos("A"), pos("B"), pos("C"), pos("D"), pos("E")], [1, 2, 3, 4, 5],
    "a ordem final respeita saldo → vitórias → confronto direto → rating, nesta ordem");

  // Os filtros: nenhum dos três entra no ranking, apesar do saldo altíssimo.
  igual(pos("pendente"), null,
    "quem está pendente no circuito NÃO recebe posição, mesmo com o maior saldo da temporada");
  igual(pos("naoJogou"), null,
    "quem não jogou NÃO recebe posição — o entrante tardio não vira campeão por não ter jogado");
  igual(banco.acha("atletas", a => a.id === "naoJogou").historico[0], { temporada: "3/2025", pos: 7 },
    "e o histórico antigo de quem não jogou fica intacto, sem entrada nova");
  igual(pos("soRejeitada"), null,
    "partida rejeitada não qualifica ninguém para o ranking final");
}

secao("A virada do Sistema B também ordena pelo critério dele");
{
  // O `cmpRankingB` só é chamado no ramo NÃO-BH com `sistema === "B"`
  // (`admin-action:1219`). Nenhum teste do projeto montava esse cenário — o fim
  // de temporada do Sistema B inteiro estava sem cobertura, e é a fronteira A×B,
  // que é onde o projeto mais teme errar (rating vazando para circuito de
  // pontos, e vice-versa). (Supervisor do guardião de Regulamento.)
  //
  // Critério do B: pontos -> MENOS W.O. culposo -> confronto direto ->
  // aproveitamento -> saldo de sets -> id. Cada par vizinho decidido por um
  // nível, e inseridos na ordem inversa da esperada.
  //   p1  20 pts, 1 wo            1º  (ganha de p2 só nos PONTOS — e PERDE dele
  //                                   no W.O., de propósito: com wo 0 ele ficava
  //                                   em 1º por acidente mesmo sem os pontos, e a
  //                                   mutação do nível primário ficava verde)
  //   p2  10 pts, 0 wo            2º  (ganha de p3 só no W.O.: p3 tem 1)
  //   p3  10 pts, 1 wo, 3v/0d     3º  (ganha de p4 no APROVEITAMENTO: 1,00 x 0,33;
  //                                   sem confronto direto entre os dois)
  //   p4  10 pts, 1 wo, 1v/2d     4º
  const CIRC_B = "22222222-2222-2222-2222-222222222222";
  const doB = (id, pts, wo, v, d) => ({
    id: "cb-" + id, circuito_id: CIRC_B, atleta_id: id,
    status: "ativo", pendente_circuito: false, chave: "chaveB",
    saldo_temp: pts, vitorias: v, derrotas: d, vitorias_total: 0, derrotas_total: 0,
    wo_culposos_temporada: wo, pagamento_confirmado: true, isento: false,
    historico: [], posicao_historico: [],
  });

  const { banco, motor } = await montarMotor({
    circuitos: [circuito(BH), circuito(CIRC_B, { slug: "pontos", sistema: "B", pareamento: "sorteio",
      regulamento_versao: "vB-01", fase: "temporada", temporada_numero: 1, temporada_ano: 2026 })],
    atletas: ["p1", "p2", "p3", "p4"].map(id => atleta(id, { rating: 500, rating_pico: 500 })),
    circuito_atletas: [doB("p4", 10, 1, 1, 2), doB("p3", 10, 1, 3, 0), doB("p2", 10, 0, 1, 1), doB("p1", 20, 1, 1, 1)],
    chaves: [{ id: "chaveB", nome: "B", rodada_atual: 1, circuito_id: CIRC_B }],
    // p3 e p4 NÃO jogam entre si, de propósito: com confronto direto entre eles,
    // o 3º nível decidiria e o aproveitamento nunca seria consultado — foi o que
    // aconteceu na 1ª tentativa, e a mutação do aproveitamento ficou verde.
    // Os sets favorecem p4 (+2 contra −2), para que remover o aproveitamento
    // INVERTA o par e acenda.
    partidas: [partida("b1", { circuito_id: CIRC_B, atleta1_id: "p1", atleta2_id: "p3", placar1: 3, placar2: 1, validado: true, calculado: true }),
               partida("b2", { circuito_id: CIRC_B, atleta1_id: "p4", atleta2_id: "p2", placar1: 3, placar2: 1, validado: true, calculado: true })],
    funcoes: { arquivar_partidas_temporada_circuito: () => null },
  });
  const r = await comoAdmin(motor, "NOVA_TEMPORADA", { circuitoId: CIRC_B });
  ok(r.corpo?.sucesso === true, `a virada do circuito B aconteceu (veio: ${JSON.stringify(r.corpo?.erro ?? true)})`);

  const posB = id => (banco.acha("circuito_atletas", c => c.atleta_id === id && c.circuito_id === CIRC_B)?.historico || [])
    .find(h => h.temporada === "1/2026")?.pos ?? null;
  igual([posB("p1"), posB("p2"), posB("p3"), posB("p4")], [1, 2, 3, 4],
    "o Sistema B ordena por pontos → menos W.O. culposo → confronto direto → aproveitamento");

  // E a fronteira A×B: circuito de pontos NÃO pode escrever rating na tabela
  // global — é a regra que o CLAUDE.md chama de contaminação do rating do BH.
  igual(banco.acha("atletas", a => a.id === "p1").rating, 500,
    "a virada do circuito B não encosta no rating global do atleta");
  igual(banco.acha("circuito_atletas", c => c.atleta_id === "p1" && c.circuito_id === CIRC_B).saldo_temp, 0,
    "e zera os pontos da temporada que acabou");
}

secao("Campo de percentual vazio não vira número inventado");
{
  // Três comportamentos diferentes, e a bateria confundia os três. O `|| 80`
  // original concedia desconto que ninguém pediu; o `|| 100` que o substituiu
  // (1ª tentativa deste pacote) COBRAVA MAIS de quem digitou 0. Regra: vazio não
  // grava; número válido grava o que foi digitado, zero inclusive.
  const NOVO = "11111111-1111-1111-1111-111111111111";
  const cenario = async () => montarMotor({
    circuitos: [circuito(BH), circuito(NOVO, { slug: "novo", percentual_entrada_meio: 55 })],
    funcoes: { arquivar_partidas_temporada_circuito: () => null },
  });
  const pct = (banco) => banco.acha("circuitos", c => c.id === NOVO)?.percentual_entrada_meio;

  for (const [valor, esperado, porque] of [
    [0,    0,  "zero digitado de propósito é entrada grátis, e tem de ser gravado"],
    ["0",  0,  "zero como texto, que é o que o input manda"],
    [40,   40, "número normal grava o que foi digitado"],
    [null, 55, "campo vazio (null) NÃO grava — o valor de antes fica"],
    ["",   55, "campo vazio (string) NÃO grava"],
    ["abc",55, "lixo NÃO grava"],
  ]) {
    const { banco, motor } = await cenario();
    await comoAdmin(motor, "DEFINIR_FINANCEIRO", { circuitoId: NOVO, valorTemporada: 12000, percentualMeio: valor });
    igual(pct(banco), esperado, `DEFINIR_FINANCEIRO com ${JSON.stringify(valor)}: ${porque}`);
  }
}

secao("O texto que protege o atleta está NA TELA, não só no documento");
{
  // O Jurídico: as cláusulas de vigência e de não-retroatividade viviam só no
  // .md, e o que o atleta lê e aceita sai do App.jsx. A proteção não chegava a
  // quem ela protege. E ela é da v03-13 e só dela — num circuito novo não houve
  // 80% para deixar de cobrar.
  // ⚠️ A CAIXA DE TRANSIÇÃO SAIU DO REGULAMENTO EM 29/09/2026, e estas asserções
  // existiam para protegê-la — então elas trocam de lado, com o motivo escrito.
  //
  // Decisão do Juliano: "o regulamento deve desvincular totalmente de circuitos
  // anteriores e só tratar o circuito que o atleta está se inscrevendo". A caixa
  // era o ÚNICO lugar do regulamento de rating que falava de outra versão e de
  // outra temporada; o de pontos já nascera sem nada disso.
  //
  // O princípio, que vale além dela: texto que fala do PASSADO apodrece; texto que
  // descreve o PRESENTE, não. Quase todo defeito de regulamento desta semana foi
  // dessa família.
  //
  // E o "o que mudou" NÃO foi jogado fora — mudou de lugar. Sem isso, o re-aceite
  // ficaria menos informado, que é pior que o problema que a mudança resolve.
  ok(!/ehTransicaoV0313/.test(fonte),
    "o regulamento não tem mais caixa de transição — ele só fala do circuito em que o atleta está entrando");
  ok(!/Transição da v03-12 para a v03-13/.test(fonte),
    "e o título dela não sobrou");
  ok(/const MUDANCAS_POR_VERSAO = \{/.test(fonte),
    "o 'o que mudou' passou a viver no card de RE-ACEITE, que é sobre a pessoa e some quando ela aceita");
  // ⚠️ Ancorada na CONDIÇÃO que renderiza, não numa referência qualquer ao nome.
  // A primeira redação casava `/MUDANCAS_POR_VERSAO\[versaoCircuito\]/`, que
  // aparece também dentro do `.map()` — então trocar a guarda por `false &&`
  // deixava a bateria verde com o bloco morto na tela. Quinta vez neste dia que
  // uma asserção minha passa pelo motivo errado.
  ok(/\{\(MUDANCAS_POR_VERSAO\[versaoCircuito\] \|\| \[\]\)\.length > 0 && \(/.test(fonte),
    "e é o card que o consome, sob a condição de haver o que mostrar — não é constante morta");
  ok(/O que mudou nesta versão/.test(fonte),
    "com título que diz o recorte: o que mudou NESTA versão");
  ok(/Ele não substitui a leitura/.test(fonte),
    "e dizendo que o resumo não substitui o regulamento inteiro");
  // O limite tem de estar na tela, não só no comentário: 11 dos 15 atletas do BH
  // estão em v03-3, e aquele texto nunca existiu. Prometer diff completo seria
  // mentir.
  ok(/Este resumo é do que mudou <strong[^>]*>nesta versão<\/strong>/.test(fonte),
    "o limite do resumo é dito ao atleta, não escondido no código");
  // ⚠️ A CLÁUSULA DE DIREITO ADQUIRIDO SAIU EM 29/09/2026, e o motivo tem de ficar
  // aqui, porque estas asserções existiam justamente para impedir que ela saísse.
  //
  // Pedido do Juliano: "quero retirar qualquer menção a 80% e resolver isso de uma
  // vez". A cláusula dizia: "quem ingressou sob o regulamento anterior e ainda não
  // quitou paga os 80% prometidos". Ela é de direito adquirido — apagá-la com
  // alguém devendo significaria cobrar mais do que a pessoa foi prometida, e eu
  // teria recusado.
  //
  // Ela saiu porque ficou SEM SUJEITO, e isso foi MEDIDO no banco, não suposto:
  // os 12 pagamentos da temporada 1/2026 estão TODOS `confirmado` e a soma dos
  // valores é ZERO (a temporada é gratuita por decisão do Juliano, desconto global
  // em 100%). Dois carregam `percentual = 80` e os dois estão quitados. Ninguém
  // "ainda não quitou".
  //
  // A não-retroatividade CONTINUA no texto, sem o número: o Clube não cobra
  // diferença de ninguém. O que saiu foi a promessa de cobrar 80% de quem devesse —
  // porque não há quem.
  ok(!/paga os 80% prometidos/.test(fonte),
    "a promessa de cobrar 80% de quem não quitou saiu da tela — ela não tinha mais sujeito");
  ok(!/80%/.test(fonte.slice(fonte.indexOf("ehTransicaoV0313 && ("), fonte.indexOf("💵 Valor conforme o momento de entrada"))),
    "e a caixa de transição não menciona 80% em lugar nenhum");
  // A vigência ("a partir da temporada 2/2026") saiu da TELA junto com a caixa —
  // ela é, por definição, uma afirmação sobre o passado e sobre outra temporada.
  // Continua no DOCUMENTO, que é o registro e onde ela tem efeito.
  ok(!/a partir da temporada 2\/2026<\/span>/.test(fonte),
    "a tela não fala mais de qual temporada a versão passa a valer — isso é do documento");
  ok(/temporada 2\/2026/.test(fs.readFileSync(path.join(RAIZ, "docs", "REGULAMENTO_TENIS_DE_MESA_v03-13.md"), "utf8")),
    "e o documento continua dizendo, porque lá é registro e não contrato de leitura");

  // E o documento tem de dizer o mesmo, com a mesma força.
  const t13 = fs.readFileSync(path.join(RAIZ, "docs", "REGULAMENTO_TENIS_DE_MESA_v03-13.md"), "utf8");
  ok(/O Clube \*\*não cobrará\*\* diferença de valor/.test(t13),
    "o documento OBRIGA o clube, em vez de só descrever o que vai acontecer");
  ok(!/paga os 80% prometidos/.test(t13),
    "e o documento também não promete mais cobrar 80% de quem não quitou");
  ok(/temporada 2\/2026 do Circuito\nBH/.test(t13) || /temporada 2\/2026/.test(t13),
    "o documento nomeia a temporada de vigência");
  ok(!/já é o ajuste/.test(t13),
    "saiu do documento a justificativa que admitia contrapartida menor por mesmo preço");
  ok(/Regulamento v03-13\*$/m.test(t13),
    "o rodapé da v03-13 assina o próprio número");
}

secao("Nenhuma tela de regulamento adivinha a versão");
{
  // O link "Regulamento oficial" da tela inicial — público, antes do login — era
  // renderizado SEM versão e caía num "v03-12" cravado. Acertava por coincidência
  // e passaria a mentir no dia do carimbo. Achado pelo guardião do Regulamento e
  // pelo do Atleta, cada um por um caminho.
  // `[^>]*` não serve: as props contêm `=>`, e o regex parava na seta. Recorta
  // da tag até o `/>` que a fecha.
  const chamadas = [];
  for (let i = fonte.indexOf("<RegulamentoView"); i >= 0; i = fonte.indexOf("<RegulamentoView", i + 1)) {
    chamadas.push(fonte.slice(i, fonte.indexOf("/>", i) + 2));
  }
  ok(chamadas.length >= 2, `as chamadas da RegulamentoView foram encontradas (achadas: ${chamadas.length})`);
  const semVersao = chamadas.filter(c => !/versao=/.test(c));
  igual(semVersao, [],
    "toda chamada da RegulamentoView passa a versão — nenhuma cai em fallback cravado");

  ok(/const versaoEfetiva = String\(versao \|\| ""\)\.trim\(\) \|\| null;/.test(fonte),
    "sem versão, a tela não assume a do BH — e apara o espaço, como o motor faz");
  ok(/versaoIncerta && \(/.test(fonte),
    "e avisa na tela que não conseguiu confirmar a versão");
}

secao("O servidor recusa a inscrição sem versão — rodando o servidor, não lendo");
{
  // As asserções da seção seguinte leem o arquivo. Estas rodam o `athlete-action`
  // de verdade e cobrem o que o regex não alcança: que o `trim()` faz `"   "` ser
  // fail-closed, e que **nada é gravado** na recusa. O supervisor do Regulamento
  // rodou primeiro e mostrou que custava 12 linhas com o harness que já existe.
  //
  // Armadilha que ele avisou e que me pouparia uma rodada: o `circuitoId` vem de
  // `payload.circuitoId` (`athlete-action:147`), não do nível de cima — sem ele
  // no payload a função resolve para o BH em silêncio e o teste passa pelo
  // motivo errado.
  const CIRC_SEM_VERSAO = "33333333-3333-3333-3333-333333333333";
  const cenarioInscricao = async (versao) => {
    const { banco } = await montarMotor({
      circuitos: [circuito(BH), circuito(CIRC_SEM_VERSAO, { slug: "novo", regulamento_versao: versao, inscricoes_abertas: true })],
    });
    const atleta = await carregarFuncao("athlete-action", banco);
    const r = await atleta.chamar({
      acao: "INSCREVER",
      payload: { circuitoId: CIRC_SEM_VERSAO, nome: "Fulano de Tal", telefone: "31999990000", aceiteRegulamento: true, aceiteLGPD: true },
    });
    return { banco, r };
  };

  for (const [versao, rotulo] of [[null, "versão nula"], ["", "versão vazia"], ["   ", "só espaços"]]) {
    const { banco, r } = await cenarioInscricao(versao);
    igual(r.status, 409, `a inscrição é recusada com ${rotulo}`);
    igual(banco.tabelas.atletas.length, 0,
      `e NADA é gravado na tabela atletas com ${rotulo} — recusa não deixa rastro`);
  }

  // E com versão válida ela passa da guarda (segue adiante no fluxo).
  {
    const { r } = await cenarioInscricao("vA-nc-01");
    ok(r.status !== 409 || !/versão do regulamento/.test(String(r.corpo?.erro || "")),
      "com versão válida a guarda da versão não barra a inscrição");
  }
}

secao("O servidor também não carimba aceite sem saber a versão");
{
  // A Onda 0.10.1 fechou isto na TELA. Mas a tela não é o portão: qualquer um
  // chama a Edge Function direto. O `athlete-action` carimbava
  // `circ.regulamento_versao || "v03-12"` — ou seja, na dúvida gravava a versão
  // do BH, com torneio e com os 80%, no aceite de um circuito que não tem nem um
  // nem outro. O recibo ficaria provadamente falso.
  //
  // Achado pelo guardião de Segurança em 13/09/2026, que também notou que o
  // `login-atleta` fazia o OPOSTO no mesmo campo (`|| null`): as duas funções
  // discordavam entre si sobre a mesma regra.
  const atleta = fs.readFileSync(path.join(RAIZ, "supabase", "functions", "athlete-action", "index.ts"), "utf8");

  ok(!/regulamento_versao \|\| VERSAO_REGULAMENTO/.test(atleta),
    "o carimbo do aceite não tem mais fallback para a versão do BH");
  ok(!/const VERSAO_REGULAMENTO = /.test(atleta),
    "e a constante do fallback foi removida — const declarada é arma carregada");
  ok(/versao_regulamento: versaoDoCircuito,/.test(atleta),
    "o aceite carimba a versão que o circuito declara, e só ela");

  const iGuarda = atleta.indexOf("const versaoDoCircuito");
  ok(iGuarda > 0 && /if \(!versaoDoCircuito\)/.test(atleta.slice(iGuarda, iGuarda + 400)),
    "sem versão, a inscrição é recusada em vez de carimbar um palpite");

  // A ORDEM importa tanto quanto a guarda: se ela ficar depois de uma escrita,
  // a recusa deixa lixo para trás. Ela tem de vir antes de qualquer insert.
  const iPrimeiraEscrita = Math.min(
    ...[".insert(", ".update(", ".rpc("].map(t => {
      const i = atleta.indexOf(t, atleta.indexOf('case "INSCREVER"'));
      return i < 0 ? Number.MAX_SAFE_INTEGER : i;
    })
  );
  ok(iGuarda < iPrimeiraEscrita,
    "a guarda roda ANTES da primeira escrita da inscrição — recusa não deixa rastro");

  // ── O que esta asserção dizia antes, e era MENTIRA ──────────────────────
  // Eu tinha escrito aqui: "o PARTICIPAR do login-atleta segue fail-closed — as
  // duas funções concordam agora". As duas afirmações são falsas, e o guardião
  // de Segurança pegou. O `PARTICIPAR` grava `aceite_regulamento: true` com
  // `versao_regulamento: null` quando não sabe a versão: um recibo de
  // consentimento que não aponta para texto nenhum. Gravar nulo NÃO é recusar.
  //
  // Isso viola a regra 6 do CLAUDE.md — "nenhuma afirmação do tipo 'o app
  // garante X' sem a linha de código que sustenta" — e era pior por estar na
  // bateria, que é onde a afirmação vira verdade institucional.
  //
  // Não consertei o código nesta onda por escolha de escopo: o `PARTICIPAR`
  // recusa o BH por construção e não existe 2º circuito, então o caminho é
  // inalcançável hoje. Está registrado como 0.10.18, com gatilho no dia em que
  // o primeiro circuito não-BH abrir inscrições.
  // ── O PARTICIPAR foi consertado em 17/09/2026 ──────────────────────────
  // Esta asserção já teve duas formas erradas antes desta. A 1ª afirmava que a
  // função era fail-closed, o que era FALSO nas duas metades (ela gravava
  // `aceite_regulamento: true` com `versao_regulamento: null` — recibo de
  // consentimento que não aponta para texto nenhum, e gravar nulo não é
  // recusar). A 2ª exigia que o defeito PERMANECESSE, ou seja, a bateria
  // bloqueava a própria correção. Agora exige o conserto.
  const login = fs.readFileSync(path.join(RAIZ, "supabase", "functions", "login-atleta", "index.ts"), "utf8");
  const iPart = login.indexOf('acao === "PARTICIPAR"');
  const trechoPart = iPart > 0 ? login.slice(iPart) : login;

  ok(/const versaoDoCircuito = String\(circ\.regulamento_versao \?\? ""\)\.trim\(\);/.test(trechoPart),
    "o PARTICIPAR lê a versão com trim, como o INSCREVER e o carimbo fazem");
  ok(/if \(!versaoDoCircuito\)/.test(trechoPart),
    "e RECUSA quando não sabe a versão, em vez de gravar nulo");
  ok(/versao_regulamento: versaoDoCircuito,/.test(trechoPart),
    "o aceite carimba a versão lida, sem fallback");
  ok(!/versao_regulamento: circ\.regulamento_versao/.test(trechoPart),
    "não sobrou o carimbo antigo, que aceitava nulo");

  // A ORDEM: a guarda tem de vir antes de qualquer escrita, senão a recusa
  // deixa rastro — inclusive o backfill de CPF, que grava dado pessoal.
  // Medido contra as escritas DA INSCRIÇÃO, não contra qualquer escrita: antes
  // da guarda há `update` em `atletas` que são o contador de tentativas de PIN —
  // autenticação, acontecem de qualquer jeito e não têm a ver com inscrever.
  // A primeira medição que escrevi não fazia essa distinção e acusou por isso.
  const iGuardaP = trechoPart.indexOf("const versaoDoCircuito");
  const escritasDaInscricao = ['from("atleta_documento").insert', 'from("circuito_atletas").insert', 'rpc("dedup_por_cpf_hash"'];
  const iPrimeiraDaInscricao = Math.min(...escritasDaInscricao.map(t => {
    const k = trechoPart.indexOf(t);
    return k < 0 ? Number.MAX_SAFE_INTEGER : k;
  }));
  ok(iPrimeiraDaInscricao < Number.MAX_SAFE_INTEGER, "as escritas da inscrição foram localizadas");
  ok(iGuardaP > 0 && iGuardaP < iPrimeiraDaInscricao,
    "a guarda roda ANTES de gravar CPF ou matrícula — recusa não registra dado pessoal");

  // E as duas funções passam a concordar de verdade — que era a afirmação
  // falsa que a bateria carimbou por dois dias.
  const atletaAction = fs.readFileSync(path.join(RAIZ, "supabase", "functions", "athlete-action", "index.ts"), "utf8");
  ok(/const versaoDoCircuito = String\(circ\.regulamento_versao \?\? ""\)\.trim\(\);/.test(atletaAction),
    "o INSCREVER do athlete-action usa a mesma forma — agora as duas funções concordam");
}

secao("A tela não mente sobre a virada antes do servidor responder");
{
  // O app muda a tela ANTES do servidor responder — otimista, e é o padrão certo
  // para ação frequente. Para a virada de temporada, não: o reducer local zera
  // stats e apaga partidas e chaves NA HORA. Enquanto a recusa era erro raro de
  // rede, dava para conviver. Com a trava do regulamento, a recusa virou o
  // caminho GARANTIDO na próxima virada do BH — o admin apertaria o botão e veria
  // a temporada "virada" por alguns segundos antes do erro chegar.
  //
  // O guardião do Admin classificou como bloqueante, e estava certo: a proteção
  // do motor (que age antes de destruir) era anulada na tela.
  ok(/const ACOES_SEM_OTIMISMO = new Set\(\["NOVA_TEMPORADA"\]\)/.test(fonte),
    "a virada de temporada está na lista de ações sem dispatch otimista");

  const i = fonte.indexOf("async function dispatchAndSync");
  const corpo = fonte.slice(i, i + 900);
  ok(i > 0, "o dispatchAndSync foi encontrado");
  ok(/const otimista = !ACOES_SEM_OTIMISMO\.has\(action\.type\);/.test(corpo),
    "o dispatchAndSync consulta a lista antes de mudar a tela");
  ok(/if \(otimista\) dispatch\(action\);/.test(corpo),
    "e só faz o dispatch otimista quando a ação permite");
  ok(!/^\s*dispatch\(action\);\s*\/\/ otimista/m.test(corpo),
    "não sobrou o dispatch incondicional que mudava a tela para toda ação");

  // E o botão: sem esperar a resposta, o modal fecharia antes de saber se deu
  // certo — o admin sairia da tela achando que virou.
  const botao = fonte.slice(fonte.indexOf("Sim, virar temporada") - 600, fonte.indexOf("Sim, virar temporada") + 120);
  ok(/await dispatch\(\{type:"NOVA_TEMPORADA"/.test(botao),
    "o botão ESPERA o servidor antes de fechar o modal");
  ok(/virando \? "Virando…"/.test(botao),
    "e diz que está esperando, em vez de parecer travado");
  ok(/if \(virando \|\| !nomeConfere\) return;/.test(botao),
    "clique repetido não dispara duas viradas");

  // As três asserções acima checam PRESENÇA DE TEXTO, e por isso ficaram verdes
  // enquanto o modal fechava na recusa. O guardião de Operações recusou assinar
  // o item como fechado por causa disso, e o do Regulamento achou o mesmo por
  // outro caminho: o comentário do código afirmava "na recusa o modal FICA
  // aberto", e era falso — `dispatchAndSync` não lança, devolve `{ok:false}`,
  // então um `await` seco fecha o modal dos dois jeitos.
  //
  // Estas duas olham a ESTRUTURA: o fechamento tem de estar preso ao resultado.
  const iFecha = botao.indexOf("fecharModal()");
  const iGuarda = botao.indexOf("if (!r || r.ok !== false)");
  ok(iGuarda > 0 && iGuarda < iFecha,
    "o modal só fecha DEPOIS de conferir que o servidor aceitou — não fecha na recusa");
  ok(/const r = await dispatch\(\{type:"NOVA_TEMPORADA"/.test(botao),
    "o resultado do dispatch é capturado, não descartado");

  // E o padrão tem de ser o MESMO que o arquivo já usa nas outras ações que
  // esperam resposta — senão cada tela inventa o seu e a próxima erra de novo.
  // São DUAS grafias no arquivo, uma o inverso da outra: `!r || r.ok !== false`
  // (segue quando deu certo) e `r && r.ok === false` (desfaz quando deu errado).
  // Contei 3 na primeira versão desta asserção e ela ficou vermelha — eram 2 de
  // uma e 2 da outra. Conto as duas.
  const seguiuNoSucesso = (fonte.match(/if \(!r \|\| r\.ok !== false\)/g) || []).length;
  const desfezNaFalha = (fonte.match(/if \(r && r\.ok === false\)/g) || []).length;
  ok(seguiuNoSucesso + desfezNaFalha >= 4,
    `as ações que esperam resposta conferem o resultado antes de seguir (achadas: ${seguiuNoSucesso} + ${desfezNaFalha})`);
}

secao("O regulamento de PONTOS diz a verdade sobre o que o motor faz");
{
  // Decisão do Juliano, 27/09/2026: "já está definido que são 3 meses por temporada e
  // dois jogos por mês, ajustar tudo o que fala diferente".
  //
  // O Guardião do Regulamento leu o vB-01 inteiro e achou DUAS promessas falsas e TRÊS
  // silêncios. Promessa falsa é pior que silêncio: o atleta lê, confia, e um dia cobra.
  // Deu para corrigir o texto NO LUGAR porque nenhum atleta havia aceitado o vB-01
  // (zero circuitos de pontos, zero aceites conferidos no banco) — não se reescreveu
  // documento assinado.
  //
  // ⚠️ São checagens por REGEX no texto fonte, e aqui é a ferramenta certa: a
  // afirmação é literalmente "esta frase está (ou não está) no regulamento".

  // ── as duas promessas falsas, que não podem voltar ────────────────────────
  ok(!/O número de etapas da temporada é configurável por circuito/.test(fonte),
    "o regulamento NÃO diz mais que o número de etapas é configurável — o motor fixa 6 e recusa mudar");
  ok(!/Sorteio registrado pelo admin/.test(fonte),
    "e NÃO promete mais um 'sorteio registrado pelo admin' que não existe no motor");

  // ── o que ele passou a dizer, e tem de bater com o motor ──────────────────
  const motorFixa6 = /const rodadas = 6;/.test(
    fs.readFileSync(path.join(RAIZ, "supabase", "functions", "admin-action", "index.ts"), "utf8"));
  ok(motorFixa6, "o motor fixa 6 rodadas por temporada");
  ok(/3 meses[\s\S]{0,120}2 jogos por mês/.test(fonte),
    "e o regulamento de pontos diz 3 meses e 2 jogos por mês");
  ok(/6 rodadas[\s\S]{0,160}3 etapas/.test(fonte),
    "traduzindo em 6 rodadas e 3 etapas");
  ok(/Esse número é fixo/.test(fonte),
    "e dizendo com letra que é FIXO, não configurável");

  // ── os três silêncios: regras que o motor aplica e o texto calava ─────────
  ok(/O circuito tem um teto de 20 atletas por temporada[\s\S]{0,80}regra da plataforma/.test(fonte),
    "o teto de atletas está escrito no regulamento de pontos — e como 20 fixo, que é o que o motor faz");
  ok(/fila de espera[\s\S]{0,200}aprovação não é o mesmo que vaga garantida/.test(fonte),
    "e a fila de espera, com o aviso de que aprovação não é vaga");
  ok(/Não há entrada nas duas últimas rodadas/.test(fonte),
    "o corte de entrada nas duas últimas rodadas está escrito");
  ok(/no mínimo 8 atletas/.test(fonte),
    "e o mínimo de 8 para a temporada começar");

  // ── e o empate absoluto passou a apontar para casos omissos ───────────────
  ok(/Decisão do administrador, registrada \(Cap\. 13\)/.test(fonte),
    "o 6º critério de desempate aponta para casos omissos, que é a regra que existe de verdade");
  ok(/empate absoluto[\s\S]{0,400}informado aos envolvidos/.test(fonte),
    "e o Cap. 13 explica o empate absoluto, prometendo o critério informado a quem empatou");
}

secao("A correção das rodadas fixas entra na v03-13 e NÃO reescreve a v03-12");
{
  // Decisão do Juliano, 27/09/2026. O regulamento do BH tinha a MESMA frase falsa do
  // vB-01 — "6 rodadas (número definido pelo administrador)" —, mas aqui existem
  // atletas reais que assinaram. Então a correção entra na **v03-13**, que ainda não
  // foi carimbada, e vai junto do re-aceite que a Onda 0.10.15 construiu.
  // A v03-12 fica como está: reescrever texto de versão aceita apagaria a prova do que
  // cada pessoa leu — foi o argumento com que o Guardião Jurídico derrubou, na mesma
  // semana, uma correção parecida no texto do consentimento.
  ok(/const VERSOES_COM_RODADAS_FIXAS = new Set\(\["v03-13", "vA-nc-01"\]\)/.test(fonte),
    "existe o conjunto de versões cujo texto diz que as 6 rodadas são fixas");
  ok(!/VERSOES_COM_RODADAS_FIXAS = new Set\(\[[^\]]*"v03-12"/.test(fonte),
    "e a v03-12 NÃO está nele — ela é a versão em vigor, aceita por atletas reais");
  ok(/rodadasFixas\s*$|rodadasFixas = VERSOES_COM_RODADAS_FIXAS\.has\(versaoEfetiva\)/m.test(fonte),
    "a tela resolve o conjunto pela versão efetiva, como faz com torneio e desconto");
  ok(/rodadasFixas[\s\S]{0,400}2 jogos por mês[\s\S]{0,120}Esse número é fixo/.test(fonte),
    "no ramo corrigido o texto diz 6 rodadas, 2 jogos por mês, e que o número é fixo");
  ok(/número definido pelo administrador/.test(fonte),
    "e o ramo da v03-12 preserva a redação histórica — de propósito, não por esquecimento");

  // O documento arquivado da v03-13 acompanha; o da v03-12 não pode ser tocado.
  const v13 = fs.readFileSync(path.join(RAIZ, "docs", "REGULAMENTO_TENIS_DE_MESA_v03-13.md"), "utf8");
  const v12 = fs.readFileSync(path.join(RAIZ, "docs", "REGULAMENTO_TENIS_DE_MESA_v03-12.md"), "utf8");
  // A frase antiga APARECE na v03-13 — dentro do bloco "O que muda", que a cita para
  // explicar a correção. O que não pode é ela estar no CORPO do regulamento. Minha
  // primeira versão desta asserção não fazia essa distinção e acusava o certo.
  const iBloco = v13.indexOf("## O que muda");
  const iDepois = v13.indexOf("\n## ", iBloco + 5);
  const corpoV13 = v13.slice(0, iBloco) + v13.slice(iDepois > 0 ? iDepois : v13.length);
  ok(!/6 rodadas \(número definido pelo administrador\)/.test(corpoV13),
    "o CORPO da v03-13 não tem mais a frase falsa");
  ok(/6 rodadas \(número definido pelo administrador\)/.test(v13.slice(iBloco, iDepois > 0 ? iDepois : v13.length)),
    "e o bloco de transição a cita, para o atleta saber exatamente o que mudou");
  ok(/2 jogos por mês/.test(v13), "e passou a dizer 2 jogos por mês");
  ok(/6 rodadas \(número definido pelo administrador\)/.test(v12),
    "o documento da v03-12 continua com a redação original — é registro do que foi assinado");
}

secao("A janela de renovação prioritária — EXECUTANDO a conta, não lendo o texto");
{
  // Item 0.6.15. O Cap. 13 (v03-12:318 / v03-13:343, e o texto que o atleta lê) diz:
  //   "nos 7 dias ANTERIORES ao início ... têm prioridade para renovar"
  //   "APÓS o prazo de prioridade, as vagas não confirmadas abrem para a fila"
  // Logo a janela vai de início−7 ATÉ o início. O app tratava início−7 como o FIM, em
  // TRÊS contas separadas — e eram três justamente porque nada as obrigava a concordar.
  // Efeito: o atleta recebia ZERO dos 7 dias, e o lembrete "dos últimos 3 dias"
  // disparava ANTES de a janela abrir.
  //
  // ⚠️ E AQUI A BATERIA FAZ ALGO QUE NÃO FAZ EM NENHUM OUTRO PEDAÇO DO APP: `App.jsx`
  // não é executado por teste nenhum, mas `janelaRenovacao` é uma função PURA — só
  // depende de `Date`. Então ela é extraída do fonte e EXECUTADA aqui. Não é regex:
  // são datas reais entrando e saindo. É o único jeito de proteger conta de data, que
  // é exatamente onde o erro morava.
  const inicioFn = bruto.indexOf("const DIAS_PRIORIDADE_RENOVACAO");
  const fimFn = bruto.indexOf("function avisoFaseInscricao", inicioFn);
  ok(inicioFn > 0 && fimFn > inicioFn, "a função da janela foi localizada no fonte");
  const codigoJanela = bruto.slice(inicioFn, fimFn);
  const janelaRenovacao = new Function(`${codigoJanela}; return janelaRenovacao;`)();

  const emDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); };

  // ── o formato da janela ───────────────────────────────────────────────────
  {
    const j = janelaRenovacao(emDias(30));
    const diasEntre = (j.inicio - j.abre) / (1000*60*60*24);
    igual(Math.round(diasEntre), 7, "a janela dura 7 dias: abre em início−7 e fecha no início");
    igual(j.fecha.getTime(), j.inicio.getTime(), "o PRAZO é o próprio início — não 7 dias antes dele");
  }

  // ── o dia a dia, que é onde o erro se via ────────────────────────────────
  {
    const longe = janelaRenovacao(emDias(30));
    ok(!longe.jaAbriu, "faltando 30 dias, a janela ainda NÃO abriu");
    ok(!longe.aberta, "e não está aberta");
    ok(!longe.encerrada, "nem encerrada");

    const dentro = janelaRenovacao(emDias(3));
    ok(dentro.jaAbriu && dentro.aberta, "faltando 3 dias para o início, a janela está ABERTA");
    ok(!dentro.encerrada, "e o prazo NÃO passou — era exatamente aqui que o app dizia que tinha passado");

    const vespera = janelaRenovacao(emDias(1));
    ok(vespera.aberta && !vespera.encerrada, "na véspera do início, ainda dá tempo de renovar");

    const comecou = janelaRenovacao(emDias(-1));
    ok(comecou.encerrada, "depois de a temporada começar, a janela encerrou");
    ok(!comecou.aberta, "e deixou de estar aberta — é só aqui que as vagas abrem para a fila");
  }

  // ── o lembrete dos "últimos 3 dias" ──────────────────────────────────────
  {
    const dispara = (d) => { const j = janelaRenovacao(emDias(d)); return j.diasAteFechar <= 3 && j.diasAteFechar >= 0; };
    ok(!dispara(10), "o lembrete NÃO dispara faltando 10 dias — antes ele disparava justo aí, fora da janela");
    ok(!dispara(7),  "nem faltando 7, que é quando a prioridade apenas COMEÇA");
    ok(dispara(2),   "dispara faltando 2 dias para o prazo");
    ok(!dispara(-1), "e não dispara depois que a temporada começou");
  }

  // ── entrada inválida não vira data mágica ────────────────────────────────
  // `try/catch` de propósito: sem a guarda de data inválida, a função LANÇA
  // (`toISOString` de Invalid Date é RangeError) e derruba o arquivo de teste inteiro
  // antes de imprimir falha nenhuma. Sabotar a guarda parecia "verde" no meu aferidor
  // de mutação por causa disso — o defeito era do aferidor. Capturando, a mesma
  // sabotagem vira uma asserção vermelha limpa, que é o que se quer ler.
  const janelaSegura = (entrada) => { try { return janelaRenovacao(entrada); } catch (e) { return `LANÇOU: ${e.message}`; } };
  igual(janelaSegura(null), null, "sem data de início, não há janela");
  igual(janelaSegura(""), null, "data vazia idem");
  igual(janelaSegura("abacaxi"), null, "e data inválida devolve null — não inventa prazo nem explode");
  igual(janelaSegura("2026-13-45"), null, "data impossível idem");

  // ── UMA conta só: era a multiplicidade que permitia a divergência ────────
  // Nenhuma subtração literal de 7 sobrou: a única existe dentro da função, e usa a
  // CONSTANTE nomeada. Era a multiplicidade de contas soltas que permitia as três
  // telas discordarem entre si sem ninguém notar.
  const soltas = (fonte.match(/getDate\(\)\s*-\s*7\b/g) || []).length;
  igual(soltas, 0, "não sobrou nenhuma subtração de 7 dias solta pelas telas");
  ok(/const DIAS_PRIORIDADE_RENOVACAO = 7;/.test(fonte),
    "o prazo de 7 dias é uma constante nomeada, num lugar só");
  ok(/getDate\(\) - DIAS_PRIORIDADE_RENOVACAO/.test(fonte),
    "e a única subtração do app usa essa constante");
  const usos = (fonte.match(/janelaRenovacao\(/g) || []).length;
  ok(usos >= 4, `e as telas a chamam em vez de refazer a conta (${usos} ocorrências: a declaração e os usos)`);

  // ── COMO AS TELAS LEEM a janela: a função certa não basta se quem a usa lê
  //    o campo errado. Sabotar o card para `jaAbriu` passava verde antes disto.
  ok(/const prazoPassou = !!jan && jan\.encerrada;/.test(fonte),
    "o card do admin chama de 'prazo passou' o FECHAMENTO da janela, não a abertura dela");
  ok(!/prazoPassou = !!jan && jan\.jaAbriu/.test(fonte),
    "e não o contrário — que é exatamente o significado invertido que tirava os 7 dias do atleta");
  ok(/const diasAteEnc = janLem\.diasAteFechar;/.test(fonte),
    "o lembrete conta os dias até o FECHAMENTO");
  ok(/prazoStr = janLem\.fechaTxt;/.test(fonte),
    "e anuncia ao atleta a data de fechamento, não a de abertura");
  // A forma antiga era `fmtDate(janLem.fechaISO)`, e `fechaISO` saía de
  // `inicio.toISOString()` — `inicio` é meia-noite LOCAL, então a leste de
  // Greenwich a data exibida vinha UM DIA ANTES (Asia/Tokyo: 01/11 virava
  // "2026-10-31"). As fronteiras da janela estavam certas em qualquer fuso; só o
  // texto que o atleta LÊ apodrecia. Esta asserção impede a volta.
  // Tira os comentários antes de olhar: o próprio comentário que EXPLICA a
  // armadilha cita `toISOString()`, e uma asserção que se afoga na própria
  // explicação não protege nada.
  const janelaSemComentario = codigoJanela.replace(/\/\/[^\n]*/g, "");
  ok(!/toISOString/.test(janelaSemComentario),
    "e a conta da janela não deriva NENHUM texto de toISOString — isso erra o dia a leste de Greenwich");
  ok(!/fechaISO/.test(fonte),
    "e o campo frágil não sobrou em lugar nenhum do app");

  // ── e a tela deixou de se contradizer ────────────────────────────────────
  ok(/A janela de renovação prioritária abre 7 dias antes da data/.test(fonte),
    "a frase que já estava CERTA continua lá");
  ok(/— ela vale até \*\$\{janRen\.fechaTxt\}\*/.test(fonte),
    "e a mensagem de renovação deixou de mandar confirmar até o dia em que a prioridade começa");

  // ── A VAGA NÃO É GARANTIDA POR SINALIZAR (Cap. 13) ───────────────────────
  // "A vaga só é garantida com o pagamento da temporada confirmado pelo
  // administrador". As duas mensagens diziam "Garanta sua vaga: toque em Quero
  // renovar" / "Pra garantir, é rapidinho" — prometendo o que o regulamento nega,
  // e contradizendo o card do atleta e o próprio regulamento.
  ok(!/Garanta sua vaga: abra o app/.test(fonte),
    "nenhuma mensagem promete que tocar em 'Quero renovar' garante a vaga");
  ok(!/Pra garantir, é rapidinho/.test(fonte),
    "nem o lembrete promete isso");
  igual((fonte.match(/que é o que garante a vaga/g) || []).length, 2,
    "as duas mensagens dizem o que o Cap. 13 diz: quem garante a vaga é o pagamento confirmado");

  // ── A FRASE DO CARD DO ADMIN — o rótulo ao lado do número ────────────────
  // Cinco das oito duplas pegaram a mesma linha: a conta foi corrigida e a prosa
  // em volta dela ficou apontando para o modelo velho. Eram DOIS defeitos:
  //  (a) "(7 dias antes do início)" passou a glosar a data do PRÓPRIO início —
  //      o card ensinava uma data que não existe, e discordava em 7 dias do card
  //      do atleta logo abaixo;
  //  (b) a frase só conhecia DOIS estados e a função entrega TRÊS, então tudo que
  //      não estava encerrado virava "Janela aberta." — inclusive as semanas ANTES
  //      de ela abrir, que é o estado mais longo e mais comum.
  // As asserções acima provavam a CONTA e a LIGAÇÃO. Nenhuma olhava para a FRASE,
  // e foi exatamente por aí que a meia-correção passou verde.
  ok(!/\(7 dias antes do início\)/.test(fonte),
    "o card não glosa mais a data do início como se ela fosse 7 dias antes dele");
  ok(/Renovação prioritária: de <b[^>]*>\{jan\.abreTxt\}<\/b> a <b[^>]*>\{jan\.fechaTxt\}<\/b>/.test(fonte),
    "ele mostra o INTERVALO — e aí 'os N dias antes do início' fica verdadeiro por construção");
  ok(/: jan\.aberta\n/.test(fonte) || /: jan\.aberta$/m.test(fonte),
    "e ramifica nos TRÊS estados que a função calcula, não em dois");
  ok(/Ainda não abriu — começa em \$\{jan\.abreTxt\}/.test(fonte),
    "antes de abrir, o card diz que ainda não abriu — e em que dia abre");
  ok(!/"Janela aberta\." : /.test(fonte) && !/ : "Janela aberta\."/.test(fonte),
    "e 'Janela aberta' deixou de ser o galho que abraça tudo que não está encerrado");
  // ⚠️ Ancorada no RAMO do card, não na frase solta: a mesma frase existe no texto
  // do regulamento (Cap. 13) e no comentário da função, então `/frase/.test(fonte)`
  // ficava verde com o card sabotado — passava pelo motivo errado, que é o defeito
  // que esta bateria já cometeu três vezes.
  ok(/\? " Prazo encerrado: as vagas não confirmadas abrem para a fila de espera\."/.test(fonte),
    "o ramo encerrado do card diz a CONSEQUÊNCIA do Cap. 13, não só que o tempo passou");
  ok(!/o prazo de renovação está sendo conferido contra o regulamento/.test(fonte),
    "e o texto do botão desabilitado não diz mais que o prazo está em revisão — ele foi corrigido nesta fatia");
  ok(/Esta ação ainda não existe no servidor \(ROADMAP 0\.6\.11\)/.test(fonte),
    "ele diz o impedimento de verdade: a ação não existe no motor");
}

secao("A PORTA DA FRENTE: o INSCREVER passa a exigir responsável de menor (0.6.24)");
{
  // Achado por dois guardiões em 27/09/2026, e os dois o classificaram ACIMA do que
  // eles mesmos tinham vindo cobrar: o `PARTICIPAR` (a porta de serviço, para quem já
  // tem cadastro) tinha acabado de ganhar a guarda de menor, e o `INSCREVER` — a porta
  // da frente, por onde entra TODO atleta novo e o único caminho para o BH — não tinha
  // nenhuma. A única linha era `if (p.responsavelCpf)`, que validava o dígito SE o
  // campo viesse. A trava era só a tela. **A porta de serviço ficou mais rígida que a
  // porta da frente.**
  const CIRC_INSC = "44444444-4444-4444-4444-444444444444";
  const CPF_BOM = "52998224725";      // dígitos verificadores válidos — o servidor revalida
  const CPF_RESP = "11144477735";
  const FUNCOES = {
    get_cpf_pepper: () => "pimenta-de-teste",
    dedup_por_cpf_hash: () => [{ existe: false, atleta_id: null }],
  };
  const inscrever = async (extra) => {
    const { banco } = await montarMotor({
      circuitos: [circuito(BH), circuito(CIRC_INSC, { slug: "novo", regulamento_versao: "vA-nc-01", inscricoes_abertas: true })],
      funcoes: FUNCOES,
      outras: { atleta_documento: [], tentativas_busca_cpf: [] },
    });
    const fn = await carregarFuncao("athlete-action", banco);
    const r = await fn.chamar({
      acao: "INSCREVER",
      payload: {
        circuitoId: CIRC_INSC, nome: "Fulano de Tal", telefone: "31999990000",
        aceiteRegulamento: true, aceiteLGPD: true,
        cpf: CPF_BOM, cpfConsent: true, cpfConsentVersao: "cpf-2026-08-v1",
        ...extra,
      },
    });
    return { banco, r };
  };
  const anosAtras = (anos, diasExtra = 0) => {
    const d = new Date(); d.setFullYear(d.getFullYear() - anos); d.setDate(d.getDate() + diasExtra);
    return d.toISOString().slice(0, 10);
  };

  // ── data de nascimento obrigatória (fail-closed, como no PARTICIPAR) ──────
  {
    const { banco, r } = await inscrever({});
    igual(r.status, 400, "inscrição SEM data de nascimento é recusada pelo servidor");
    ok(/Informe a data de nascimento/.test(String(r.corpo?.erro || "")),
      "e a recusa diz ao atleta o que fazer");
    igual(banco.tabelas.atletas.length, 0, "e NADA é gravado — nem o atleta");
    igual(banco.linhas("atleta_documento").length, 0, "nem o documento");
  }
  {
    const { r } = await inscrever({ dataNascimento: "" });
    igual(r.status, 400, "data vazia também");
  }
  {
    const { r } = await inscrever({ dataNascimento: "1850-01-01" });
    ok(/o ano informado não parece válido/.test(String(r.corpo?.erro || "")),
      "data absurda no passado é recusada");
    const { r: r2 } = await inscrever({ dataNascimento: "2040-01-01" });
    ok(/o ano informado não parece válido/.test(String(r2.corpo?.erro || "")),
      "e no futuro também");
  }

  // ── A SEGUNDA CAMADA DO FAIL-CLOSED — asserção de FONTE, e o porquê ──────
  // Esta é a única asserção de texto desta seção, e ela existe porque o
  // comportamento é INALCANÇÁVEL por construção: com a guarda da data ausente de
  // pé, a linha do responsável nunca recebe nulo, então nenhuma asserção de
  // comportamento distingue `idadeInsc < 18` de `idadeInsc !== null && idadeInsc < 18`.
  // O Guardião de Segurança aplicou a reescrita que o comentário do motor proibia
  // em letras garrafais e A BATERIA FICOU VERDE. Comentário não é portão.
  // O conserto foi tornar a regra explícita (`=== null ||`, sem depender da coerção
  // `null < 18`); esta asserção é o portão que impede a volta da forma frouxa.
  {
    const fonteMotor = await import("node:fs/promises")
      .then(f => f.readFile("supabase/functions/athlete-action/index.ts", "utf-8"));
    const semComentario = fonteMotor.replace(/\/\/[^\n]*/g, "");
    ok(/if \(idadeInsc === null \|\| idadeInsc < 18\)/.test(semComentario),
      "a guarda do responsável recusa idade DESCONHECIDA explicitamente, sem depender de coerção de tipo");
    ok(!/idadeInsc !== null/.test(semComentario),
      "e a reescrita que transforma idade desconhecida em liberação silenciosa não voltou");
  }

  // ── menor sem responsável: recusa, e nada gravado ────────────────────────
  {
    const { banco, r } = await inscrever({ dataNascimento: anosAtras(15) });
    igual(r.status, 400, "menor de 15 sem responsável é recusado pelo SERVIDOR");
    ok(/a lei exige o consentimento de um responsável legal/.test(String(r.corpo?.erro || "")),
      "com a frase que a tela mostra inteira — e que diz POR QUE, não só que é proibido");
    ok(/Volte ao passo 1/.test(String(r.corpo?.erro || "")),
      "e diz ONDE preencher: os campos ficam no passo 1 e o erro aparece no passo 3");
    igual(banco.tabelas.atletas.length, 0, "e o atleta NÃO é criado");
  }
  {
    const { r } = await inscrever({ dataNascimento: anosAtras(15), responsavelNome: "Mãe do atleta" });
    igual(r.status, 400, "só o nome do responsável não basta");
    const { r: r2 } = await inscrever({ dataNascimento: anosAtras(15), responsavelCpf: CPF_RESP });
    igual(r2.status, 400, "e só o CPF também não");
  }

  // ── A FRONTEIRA DOS 18, que é o caso real mais provável ──────────────────
  {
    const { r } = await inscrever({ dataNascimento: anosAtras(18, 1) });
    igual(r.status, 400, "faltando UM DIA para 18, ainda é menor: recusa sem responsável");
    const { r: r2 } = await inscrever({ dataNascimento: anosAtras(18, -1) });
    ok(r2.status !== 400 || !/responsável legal/.test(String(r2.corpo?.erro || "")),
      "e um dia DEPOIS de completar 18, passa da guarda do responsável");
  }

  // ── menor COM responsável entra, e o CPF do responsável vai como hash ────
  {
    const { banco, r } = await inscrever({
      dataNascimento: anosAtras(15), responsavelNome: "Mãe do atleta", responsavelCpf: CPF_RESP,
    });
    igual(r.status, 200, "com nome e CPF do responsável, o menor se inscreve");
    const doc = banco.acha("atleta_documento", () => true);
    ok(!!doc, "o documento foi gravado");
    igual(doc.responsavel_nome, "Mãe do atleta", "com o nome do responsável");
    ok(!!doc.responsavel_cpf_hash, "e o CPF do responsável como hash");
    ok(!JSON.stringify(doc).includes(CPF_RESP), "o CPF do responsável NÃO aparece em claro");
    ok(!JSON.stringify(doc).includes(CPF_BOM), "nem o do atleta");
  }
  {
    const { r } = await inscrever({ dataNascimento: "1990-05-10" });
    igual(r.status, 200, "e maior de idade se inscreve sem responsável");
  }
}

secao("Os dois silêncios que sobraram no regulamento de pontos (0.6.27)");
{
  // Achados pelo Guardião do Regulamento em 27/09/2026, revisando a própria correção.
  // Cada um com a linha do motor que o sustenta — o texto não afirma nada que eu não
  // tenha visto rodando.

  // ── 1) pagamento confirmado é pré-requisito para SER PAREADO ──────────────
  const motor = fs.readFileSync(path.join(RAIZ, "supabase", "functions", "admin-action", "index.ts"), "utf8");
  ok(/exigePagamento\) q = q\.eq\("pagamento_confirmado", true\)/.test(motor),
    "o motor filtra por pagamento_confirmado ao montar os ativos do circuito");
  const chamadasComFinanceiro = (motor.match(/getAtivosNoCircuito\(circuitoId, !!\w+\?\.financeiro_ativo\)/g) || []).length;
  ok(chamadasComFinanceiro >= 2,
    `e passa o flag do financeiro ao iniciar etapa e ao avançar rodada (${chamadasComFinanceiro} chamadas)`);
  ok(/O pagamento é <span style=\{s\.dest\}>confirmado pelo administrador<\/span>[\s\S]{0,240}não é incluído nos confrontos<\/span>/.test(fonte),
    "e o regulamento de PONTOS passou a dizer isso — era o 4º silêncio da mesma família");
  ok(!/após a aprovação do administrador, passa a ser pareado nas rodadas/.test(fonte),
    "a primeira frase do Cap. 10 não implica mais que APROVAÇÃO BASTA");
  ok(/depois de aprovado pelo administrador, entra na fila para ser pareado/.test(fonte),
    "ela diz que o aprovado entra na FILA — não que já está pareado");

  // ── 2) a temporada continua se os ativos caírem abaixo de 8 ───────────────
  ok(/São necessários ao menos 2 atletas ativos para gerar uma rodada/.test(motor),
    "o motor exige apenas 2 ativos para avançar a rodada — ou seja, a temporada continua abaixo de 8");
  ok(/cair abaixo de 8, a temporada <span style=\{s\.dest\}>continua normalmente<\/span>/.test(fonte),
    "e o regulamento de pontos passou a dizer que continua — era o 5º silêncio");
  ok(/a queda não interrompe o circuito/.test(fonte),
    "com a frase que fecha a dúvida do atleta pagante de um circuito que esvazia");
}

secao("A promessa 'esse número é fixo' é obrigada no motor, não só escrita");
{
  // O PREÇO DE TER CORRIGIDO O TEXTO, achado pelo Guardião Jurídico em 27/09/2026.
  // Antes, o regulamento dizia "número definido pelo administrador" e o motor fazia 6:
  // texto frouxo, motor firme. Agora o texto PROMETE ao atleta que o número é fixo — e
  // a única coisa que sustentava essa promessa era um `return` solto.
  //
  // A asserção que existia guardava o EIXO ERRADO: `testes/permissoes.mjs` confere que
  // o ORGANIZADOR leva 403 no DEFINIR_RODADAS. Isso guarda QUEM, não SE. Ele provou:
  // reabrindo a ação para o super-admin, a bateria inteira ficava VERDE — porque
  // permissão não mudou. Um "vamos reabrir o número de rodadas" deixaria o regulamento
  // mentindo de novo, para atletas que acabaram de re-aceitar exatamente essa frase.
  const { motor, banco } = await montarMotor();
  const antes = banco.acha("configuracao", (l) => l.id === 1).rodadas_por_temporada;
  const r = await comoAdmin(motor, "DEFINIR_RODADAS", { rodadas: 8 });
  igual(r.status, 400, "nem o SUPER-ADMIN muda o número de rodadas");
  ok(/fixas em 6 por temporada/.test(String(r.corpo?.erro || "")),
    "e a recusa diz o mesmo que o regulamento promete: fixas em 6 por temporada");
  igual(banco.acha("configuracao", (l) => l.id === 1).rodadas_por_temporada, antes,
    "e nada foi gravado — a promessa do texto é obrigada no banco, não só na tela");
  const r2 = await comoAdmin(motor, "DEFINIR_RODADAS", { rodadas: 6 });
  igual(r2.status, 400, "a ação recusa até quando pedem o próprio 6 — ela não existe mais");
}

process.exit(placar("Regulamento por circuito"));
