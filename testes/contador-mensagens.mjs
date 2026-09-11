// Bateria — O CONTADOR DE MENSAGENS NÃO PODE INVENTAR NÚMERO.
//
// Em 10/09/2026 o Juliano reportou que o painel cobrava mensagens pendentes que
// ele já tinha enviado. A causa não era o dado: conferidas as oito categorias no
// banco, havia ZERO pendências reais.
//
// O histórico de envios saiu da carga geral do app por LGPD e passou a ser
// buscado sob demanda (`garantirMensagensEnviadas`, com PIN). Só que o contador
// do painel continuou somando contra ele. Enquanto o histórico não chegava,
// `state.mensagensEnviadas` era `[]` — e `mensagemJaEnviada` não achava registro
// nenhum, então TODA mensagem possível aparecia como pendente.
//
// O contador não estava lendo mensagens: estava contando na ausência delas.
//
// A regra que estas asserções travam: **enquanto o app não souber, ele não
// mostra número** — nem zero, nem o total. E a falha do carregamento não pode
// morrer num aviso de console, porque um contador cego é indistinguível de um
// contador correto.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ok, secao, placar } from "./ferramentas.mjs";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bruto = fs.readFileSync(path.join(RAIZ, "src", "App.jsx"), "utf8");

// Remove linhas comentadas antes de verificar. Sem isto, comentar a linha que a
// asserção protege deixa o texto no arquivo e a bateria continua verde — foi
// exatamente o que aconteceu ao testar a mutação desta asserção pela 1ª vez.
function semComentarios(txt) {
  return txt
    .split("\n")
    .filter(l => !/^\s*(\/\/|\{?\/\*)/.test(l))
    .join("\n");
}
const fonte = semComentarios(bruto);

secao("O contador só conta quando tem histórico para comparar");
{
  // O selo da barra inferior. Sabote trocando por
  // `mensagens: todasMensagensPendentes(state, {}).length` e a bateria fica
  // vermelha — que é exatamente a forma do defeito de 10/09.
  ok(/mensagens:\s*msgsStatus\s*===\s*["']ok["']\s*\?\s*todasMensagensPendentes/.test(fonte),
    "o selo 'Msgs' só recebe número quando o histórico está carregado");

  // O número no card do painel, mesma regra.
  ok(/const\s+pendentesMensagensCount\s*=\s*msgsStatus\s*===\s*["']ok["']\s*\?/.test(fonte),
    "o contador do painel só recebe número quando o histórico está carregado");

  // E o card de detalhe não pode tratar "não sei" como "zero pendentes".
  ok(/pendentesMensagensCount\s*!==\s*null\s*&&\s*pendentesMensagensCount\s*>\s*0/.test(fonte),
    "o card de pendentes distingue 'não sei' de 'nenhuma'");
}

secao("O carregamento do histórico registra o desfecho");
{
  const trecho = fonte.slice(
    fonte.indexOf("async function garantirMensagensEnviadas"),
    fonte.indexOf("async function garantirTelefones")
  );
  ok(trecho.length > 0, "a função de carregar o histórico foi encontrada");

  // Sem marcar sucesso, o contador nunca sai de "não sei" e o app fica mudo
  // para sempre — o defeito oposto, igualmente ruim.
  ok(/setMsgsStatus\(["']ok["']\)/.test(trecho),
    "o sucesso do carregamento é registrado");

  // Sem marcar erro, uma falha vira silêncio: o contador some e ninguém
  // descobre por quê.
  ok(/setMsgsStatus\(["']erro["']\)/.test(trecho),
    "a falha do carregamento é registrada");

  // A falha tem de APARECER. Era um console.warn invisível — o mesmo padrão que
  // a Onda 0.6.1 removeu de outros pontos do app.
  ok(/setAcaoErro\(/.test(trecho),
    "a falha do carregamento acende o aviso na tela, não só no console");
}

secao("O histórico é buscado quando o admin entra");
{
  // Se só a tela de Mensagens carregasse, o painel continuaria sem número até o
  // admin passar por lá — tecnicamente honesto, mas inútil no lugar onde ele
  // olha primeiro.
  const efeito = fonte.slice(fonte.indexOf("if (!isAdmin) return;"), fonte.indexOf("if (!isAdmin) return;") + 800);
  ok(/garantirMensagensEnviadas\(\);/.test(efeito),
    "a entrada do admin dispara o carregamento do histórico");

  // E SÓ com o PIN em cache. No login por biometria o app entra sem senha de
  // propósito; sem esta guarda, uma leitura de fundo abriria o modal de PIN em
  // tela cheia — dizendo "primeira ação de escrita" — sem o admin ter pedido
  // nada. Sabote tirando o `if (getPinCache())` e a bateria fica vermelha.
  ok(/if\s*\(getPinCache\(\)\)\s*garantirMensagensEnviadas\(\);/.test(efeito),
    "a busca de fundo só roda com PIN já em cache — nunca abre prompt sozinha");
}

secao("Trocar de circuito zera o que se sabe");
{
  // O histórico é por circuito. Sem zerar o status junto com a lista, o contador
  // do circuito novo seria calculado contra o histórico do circuito anterior.
  const i = fonte.indexOf('SET_MENSAGENS_ENVIADAS", payload: [] }');
  ok(i > 0, "o ponto que limpa o histórico na troca de circuito foi encontrado");
  ok(/setMsgsStatus\(["']nao-carregado["']\)/.test(fonte.slice(i, i + 400)),
    "trocar de circuito volta o contador para 'não sei'");
}

secao("Falha de LEITURA não diz que algo não foi salvo");
{
  // A barra de erro nasceu para AÇÕES do admin ("não foi salvo — o servidor
  // recusou"). Reaproveitá-la para uma falha de LEITURA em segundo plano faz o
  // app afirmar que uma gravação falhou quando nada estava sendo gravado — e
  // aparece sozinha na entrada do admin, sem ele ter clicado em nada.
  ok(/leitura:\s*true/.test(fonte),
    "a falha de carregar o histórico é marcada como leitura");

  ok(/acaoErro\.leitura\s*\?\s*["']⚠️ Não deu para carregar/.test(fonte),
    "a barra usa cabeçalho próprio para falha de leitura, não 'Não foi salvo'");

  // E a linha de apoio da barra de escrita ("a tela já voltou ao que está no
  // banco") também não cabe: não houve gravação para desfazer.
  const i = fonte.indexOf("acaoErro.leitura ? (");
  ok(i > 0 && /O contador de pendentes fica sem número/.test(fonte.slice(i, i + 400)),
    "a falha de leitura explica a consequência real, sem falar em gravação");
}

secao("Não se dispara mensagem contra histórico vazio");
{
  // Aqui o defeito deixa de ser "número errado numa tela": a fila é CONGELADA
  // no clique (setFilaCongelada), então disparar antes de o histórico chegar
  // leva o admin a reenviar, no WhatsApp, mensagem para atleta que já recebeu.
  // As duas portas de disparo precisam travar, e o botão precisa dizer por quê.
  ok(/const\s+historicoPronto\s*=\s*msgsStatus\s*===\s*["']ok["']/.test(fonte),
    "a tela de Mensagens sabe se o histórico já chegou");

  const iniciar = fonte.slice(fonte.indexOf("function iniciarDisparo()"), fonte.indexOf("function proxMensagem"));
  const guardas = (iniciar.match(/if\s*\(!historicoPronto\)\s*return;/g) || []).length;
  ok(guardas === 2,
    `as DUAS portas de disparo recusam rodar sem histórico (achadas: ${guardas})`);

  const botoes = (fonte.match(/disabled=\{!historicoPronto\}/g) || []).length;
  ok(botoes === 2,
    `os dois botões de disparo ficam desabilitados enquanto carrega (achados: ${botoes})`);

  // "carregando" e "falhou" são estados diferentes. Dizer "carregando" depois de
  // um PIN cancelado é o mesmo vício que esta onda inteira corrige: afirmar
  // andamento de uma coisa que já parou.
  ok(/msgsStatus\s*===\s*["']erro["']\s*\?\s*["']não deu para carregar/.test(fonte),
    "o botão distingue 'ainda carregando' de 'falhou'");
}

placar("Contador de mensagens");
