// Bateria — QUEM VÊ QUAL MENSAGEM DE ERRO.
//
// Em 08/09/2026 o app passou a MOSTRAR os erros que o servidor devolve (antes
// eram gravados num estado que nada lia). Isso levantou uma pergunta que ninguém
// tinha feito: quem pode ler esse texto?
//
// O organizador NÃO é o Juliano. É um terceiro, e o Supabase é compartilhado —
// o app de torneios mora no mesmo projeto. O texto de um erro 500 carrega nome
// de tabela, de coluna e de constraint ("null value in column \"texto\" of
// relation \"mensagens_enviadas\""). Nada disso é assunto dele.
//
// O que NÃO vaza, e foi verificado no esquema de produção pelo Guardião de
// Segurança: CPF e telefone. O Postgres põe o valor que violou a regra no campo
// DETAIL, e nenhuma Edge Function devolve `details`/`hint` — só `.message`.
//
// Estas asserções travam a decisão para ela não se desfazer em silêncio. O
// App.jsx não tem bateria que rode o app; então, como o pacote.mjs já faz, elas
// leem o FONTE.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ok, secao, placar } from "./ferramentas.mjs";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FONTE = path.join(RAIZ, "src", "App.jsx");
const FUNCOES = path.join(RAIZ, "supabase", "functions");
const fonte = fs.readFileSync(FONTE, "utf8");

// ── A3 — o texto cru é do super-admin, não de todo mundo que é "admin" ──────
secao("O organizador não vê o texto de máquina do banco");
{
  // O organizador entra por onOrganizadorLogin, que faz setIsAdmin(true): sem o
  // !modoOrg, "admin" o inclui e ele cai no ramo cru. Sabote trocando por
  // `isAdmin &&  true` e esta asserção fica vermelha.
  ok(/const\s+souSuperAdmin\s*=\s*isAdmin\s*&&\s*!modoOrg/.test(fonte),
    "o ramo do texto cru é guardado por isAdmin && !modoOrg, não por isAdmin");

  // O organizador só recebe frase de 4xx — escrita para ser lida. O 500 é texto
  // de máquina e nunca chega nele.
  ok(/acaoErro\.status\s*>=\s*400\s*&&\s*acaoErro\.status\s*<\s*500/.test(fonte),
    "só resposta 4xx conta como frase autoral; 500 fica de fora");

  // Sem status (rede caída, CORS derrubado, PIN cancelado) tem de cair no piso.
  // Se `autoral` deixasse de exigir número, um erro sem status viraria autoral.
  ok(/typeof\s+acaoErro\.status\s*===\s*["']number["']/.test(fonte),
    "erro sem status HTTP não é tratado como autoral (fail-closed)");

  // O piso: quem não é operador passa pela lista branca, sempre.
  ok(/return\s+mensagemParaAtleta\(acaoErro\.msg\)/.test(fonte),
    "o último caso do gate é a lista branca, não o texto cru");
}

// ── O escopo que a decisão cobre ────────────────────────────────────────────
secao("O escopo alcançado pela barra é o que foi auditado");
{
  // O Guardião de Segurança mediu o escopo (admin-action, athlete-action e
  // resetar-pin-atleta) e auditou os 4xx dessas três. Uma função NOVA chamada
  // do syncToSupabase escaparia dessa auditoria sem ninguém notar — foi assim
  // que a primeira versão do parecer perdeu oito respostas 500.
  const alcancadas = [...fonte.matchAll(/functions\/v1\/([a-z-]+)/g)].map(m => m[1]);
  const esperadas = new Set([
    "admin-action", "athlete-action", "login-atleta", "circuito-dados",
    "despachos-do-dia", "resetar-pin-atleta", "anonimizar-atleta", "comprovante-url",
  ]);
  const novas = alcancadas.filter(f => !esperadas.has(f));
  ok(novas.length === 0,
    `nenhuma Edge Function nova no App.jsx sem revisão de exposição (achadas: ${novas.join(", ") || "nenhuma"})`);

  // Os três pontos que a barra alcança precisam carimbar o status, senão o
  // discriminador 4xx/500 não tem o que ler e tudo vira não-autoral.
  const carimbos = (fonte.match(/err\.status\s*=\s*res\.status/g) || []).length;
  ok(carimbos >= 4,
    `o status HTTP é anexado ao erro nos pontos que a barra alcança (achados: ${carimbos})`);
}

// ── A1 — nenhum 4xx carrega texto de máquina ───────────────────────────────
secao("Resposta 4xx não concatena mensagem do banco");
{
  // O ramo do organizador confia em que 4xx é sempre frase escrita à mão. Se um
  // 4xx passar a concatenar error.message, essa confiança quebra e o texto de
  // máquina chega nele. Sabote acrescentando `+ error.message` a um 4xx do
  // admin-action e esta asserção fica vermelha.
  // Varre PARA A FRENTE a partir de cada `.message`, parando no fim da
  // instrução. A primeira versão desta asserção casava só dentro de um objeto
  // (`[^}\n]*`) e por isso NÃO enxergava template literal — que é justamente a
  // forma idiomática deste repositório (as sete mensagens interpoladas do
  // admin-action são todas assim). Ou seja: ela era cega ao jeito mais provável
  // de o defeito entrar. O corte no `;` evita vazar para a instrução seguinte,
  // que produzia falso positivo no `const msg = String(error.message||"")`
  // seguido de um 409 legítimo em admin-action:1540.
  //
  // LIMITE CONHECIDO, para esta asserção não prometer mais do que alcança: não
  // pega variável intermediária nem objeto montado antes da resposta. Isso é
  // limite de regex sem parser de verdade.
  function quatroXXComMensagem(src) {
    const achados = []; const re = /\.message/g; let m;
    while ((m = re.exec(src))) {
      const resto = src.slice(m.index);
      const fim = resto.indexOf(";");
      const inst = resto.slice(0, fim === -1 ? 400 : fim);
      const st = inst.match(/,\s*(\d{3})\s*\)/);
      if (st && /^4/.test(st[1])) achados.push(st[1]);
    }
    return achados;
  }

  for (const nome of ["admin-action", "athlete-action", "resetar-pin-atleta"]) {
    const arq = path.join(FUNCOES, nome, "index.ts");
    if (!fs.existsSync(arq)) continue;
    const ruins = quatroXXComMensagem(fs.readFileSync(arq, "utf8"));
    ok(ruins.length === 0,
      `${nome}: nenhuma resposta 4xx carrega .message (achadas: ${ruins.length})`);
  }
}

// ── A4 — a lista branca não pode apodrecer em silêncio ─────────────────────
secao("A lista branca acompanha o texto do motor");
{
  const arq = path.join(FUNCOES, "athlete-action", "index.ts");
  const motor = fs.readFileSync(arq, "utf8");

  // Recorta o bloco antes de casar, em vez de varrer o arquivo inteiro por
  // indentação — assim a leitura não quebra se alguém reindentar o código.
  const bloco = fonte.split("const MSGS_ATLETA = new Set([")[1].split("]);")[0];
  const lista = [...bloco.matchAll(/"([^"]+)"/g)].map(m => m[1]);

  ok(lista.length > 0, "a lista branca de mensagens foi encontrada no App.jsx");

  // Toda frase da lista tem de existir literalmente no motor. Sabote mudando a
  // pontuação de uma mensagem no athlete-action e esta asserção fica vermelha —
  // que é exatamente a dívida técnica que o comentário do App.jsx assume.
  const orfas = lista.filter(t => !motor.includes(t));
  ok(orfas.length === 0,
    `toda mensagem da lista branca existe no athlete-action (órfãs: ${orfas.join(" | ") || "nenhuma"})`);

  // E o contrário: frase em prosa do motor que ficou de fora vira texto
  // genérico para o atleta sem ninguém perceber.
  const doMotor = [...motor.matchAll(/erro:\s*"([^"]*[a-zà-ú] [^"]*\.)"/g)].map(m => m[1]);
  const fora = doMotor.filter(t => !lista.includes(t));
  ok(fora.length === 0,
    `nenhuma frase do athlete-action ficou fora da lista (fora: ${fora.join(" | ") || "nenhuma"})`);
}

placar("Erros na tela");
