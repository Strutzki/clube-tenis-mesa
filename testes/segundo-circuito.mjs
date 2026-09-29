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

const fonte = readFileSync("src/App.jsx", "utf-8");
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
  ok(!/O teto é fixo em 20 atletas por circuito/.test(fonte),
    "a afirmação 'o teto é fixo em 20 atletas por circuito' saiu da tela — ela era falsa desde que a criação passou a perguntar");

  // O campo novo, e o bloqueio em vez do aparo silencioso.
  ok(/Máximo de atletas no circuito/.test(fonte),
    "o card de configuração tem campo para o teto");
  ok(/const tetoValido = Number\(tetoEdit\) >= 8 && Number\(tetoEdit\) <= 20;/.test(fonte),
    "e a tela valida a mesma faixa do motor (8 a 20)");
  ok(/disabled=\{!tetoValido\}/.test(fonte),
    "e BLOQUEIA o salvamento fora da faixa, em vez de deixar o motor aparar em silêncio");
  ok(/maxAtletas:Number\(tetoEdit\)/.test(fonte),
    "e manda o teto junto do nome no DEFINIR_CONFIG_CIRCUITO");

  // O aviso de baixar o teto com o circuito mais cheio que ele.
  ok(/const tetoAbaixoDoAtual = tetoValido && Number\(tetoEdit\) < ativosNoCircuito;/.test(fonte),
    "a tela detecta o teto abaixo do número de atletas que já estão dentro");
  ok(/não tira ninguém/.test(fonte),
    "e diz o que acontece de verdade — não tira ninguém, só fecha a entrada");
}
{
  // 0.10.7 — o admin VÊ a versão. Só leitura, e a tela diz por quê.
  ok(/Regulamento em vigor neste circuito/.test(fonte),
    "o card de configuração mostra a versão do regulamento do circuito");
  ok(/\{state\.regulamentoVersao \|\| "não definido"\}/.test(fonte),
    "lendo do estado do circuito carregado, não de uma constante");
  ok(/não se troca aqui/.test(fonte),
    "e explica por que é só leitura: trocar um texto já aceito invalidaria os recibos");
  ok(!/DEFINIR_CONFIG_CIRCUITO",payload:\{[^}]*regulamento/.test(fonte),
    "e nenhum botão desta tela manda trocar a versão");
}
{
  // 0.10.7 — o AVISO na criação, antes de criar. A parte que o Guardião do Admin
  // chamou de "não é avisado".
  const criar = fonte.slice(fonte.indexOf("function CriarCircuitoCard"), fonte.indexOf("function CriarCircuitoCard") + 9000);
  ok(/Regulamento que este circuito vai usar/.test(criar),
    "o formulário de criação diz qual regulamento o circuito vai usar, ANTES de criar");
  ok(/vA-nc-01/.test(criar) && /vB-01/.test(criar),
    "e nomeia as duas versões possíveis");
  ok(/não tem Torneio Presencial de Encerramento/.test(criar),
    "e avisa a diferença que só aparece no documento: circuito de rating NOVO nasce sem o torneio do BH");
  ok(/não muda depois/.test(criar),
    "e que o regulamento não muda depois");
  ok(/\{criado\.regulamento_versao\}/.test(criar),
    "e a confirmação mostra a versão que o SERVIDOR gravou");
}

// ───────────────────────────────────────────────────────────────────────────────
secao("O que NÃO mudou: o BH e o carimbo de quem já aceitou");
{
  // O motor continua sem ação para trocar o sistema de um circuito (0.6.22), e
  // sem ação para trocar a versão do regulamento pela tela. Se um dia alguma das
  // duas nascer, estas asserções ficam vermelhas — e é o sinal de que a decisão
  // do 0.6.22 está sendo tomada, não de que algo quebrou.
  ok(!/case "TROCAR_SISTEMA"/.test(motorFonte),
    "não existe ação para trocar o sistema de um circuito — o 2º circuito é NOVO, não o BH convertido");
  ok(/if \(p\.maxAtletas !== undefined\) upd\.max_atletas/.test(motorFonte),
    "e o teto continua sendo a única coisa nova que a configuração escreve");
  const trechoCfg = motorFonte.slice(motorFonte.indexOf('case "DEFINIR_CONFIG_CIRCUITO"'), motorFonte.indexOf('case "DEFINIR_CONFIG_CIRCUITO"') + 1200);
  ok(!/regulamento_versao/.test(trechoCfg),
    "o DEFINIR_CONFIG_CIRCUITO não toca regulamento_versao — o recibo do atleta não se reescreve por um salvamento de configuração");
}

process.exit(placar("O segundo circuito"));
