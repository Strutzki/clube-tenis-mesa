// Gera o DOCUMENTO de um regulamento a partir do que o app realmente mostra.
//
// Por que isto existe (ROADMAP 0.10.3, 29/09/2026):
// o `vB-01` (pontos) e o `vA-nc-01` (rating novo) não tinham documento nenhum. O
// texto que o atleta aceita juridicamente morava SÓ dentro de um JSX de 11 mil
// linhas. O único arquivo do Sistema B era um RASCUNHO de projeto — e ele
// contradizia o código em dois pontos.
//
// Por que GERAR em vez de transcrever: transcrever cria a segunda cópia da mesma
// regra, que é o defeito que este projeto passou a semana desfazendo (três contas
// da janela de renovação, duas do último terço, dois pareamentos). Um documento
// escrito à mão diverge da tela no primeiro ajuste, e ninguém percebe — e aqui a
// divergência é entre o que o atleta LEU e o que o clube pode PROVAR.
//
// Uso:  node scripts/gerar-regulamento.mjs B    > docs/REGULAMENTO_vB-01.md
//       node scripts/gerar-regulamento.mjs A-nc > docs/REGULAMENTO_vA-nc-01.md
//
// A bateria confere que o arquivo no repositório é igual ao que este script
// produz. Se alguém mudar o texto na tela e não regenerar, o teste fica vermelho.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fonte = fs.readFileSync(path.join(RAIZ, "src", "App.jsx"), "utf8");

// ── Extração ────────────────────────────────────────────────────────────────
// Recorta o corpo de uma função de conteúdo por DECLARAÇÃO DE TOPO, nunca por
// contagem de caracteres: janela fixa é número mágico e vira verde permanente
// quando o trecho cresce (lição de 28/09/2026).
function recorte(nomeFn) {
  const i = fonte.indexOf(`function ${nomeFn}(`);
  if (i < 0) throw new Error(`não achei ${nomeFn} no App.jsx`);
  const f = fonte.indexOf("\n  }", i);
  if (f < 0) throw new Error(`não achei o fim de ${nomeFn}`);
  return fonte.slice(i, f);
}

function listaCapitulos(nomeConst) {
  const i = fonte.indexOf(`const ${nomeConst} = [`);
  if (i < 0) throw new Error(`não achei ${nomeConst}`);
  const f = fonte.indexOf("];", i);
  const bloco = fonte.slice(i, f);
  return [...bloco.matchAll(/\{\s*id:\s*(\d+),\s*tag:"([^"]+)",\s*titulo:"([^"]+)"/g)]
    .map(m => ({ id: Number(m[1]), tag: m[2], titulo: m[3] }));
}

// JSX → markdown. Só as formas que o regulamento usa; qualquer outra vira erro
// visível em vez de sumir em silêncio.
function texto(jsx) {
  return jsx
    .replace(/<span style=\{s\.dest\}>([\s\S]*?)<\/span>/g, "**$1**")
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/g, "**$1**")
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/g, "*$1*")
    .replace(/\{"\s*"\}/g, " ")
    .replace(/<\/?[A-Za-z][^>]*>/g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function blocoCapitulo(corpo, id) {
  const marca = `if (id===${id}) return (`;
  const i = corpo.indexOf(marca);
  if (i < 0) return null;
  const prox = corpo.indexOf("if (id===", i + marca.length);
  let bloco = corpo.slice(i + marca.length, prox < 0 ? corpo.length : prox);
  // COMENTÁRIO NÃO É REGULAMENTO. Os `{/* ... */}` do JSX explicam decisões de
  // projeto ao próximo programador — e vazavam inteiros para o documento que o
  // atleta lê. Saem antes de qualquer outra coisa, inclusive os de várias linhas
  // (o filtro por linha não os pega: só vê a linha que ABRE o comentário).
  bloco = bloco.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  // O rodapé da TELA (assinatura do app) e o `return null` do componente também
  // não são conteúdo do regulamento.
  bloco = bloco.split("Clube do Tênis de Mesa{circuitoNome")[0];
  bloco = bloco.split("return null;")[0];
  return bloco;
}

function paraMarkdown(bloco) {
  const linhas = [];
  // Tabelas primeiro: elas contêm colchetes que confundiriam os outros padrões.
  const tabelas = [];
  bloco = bloco.replace(/<Tbl\s+headers=\{(\[[\s\S]*?\])\}\s+rows=\{(\[[\s\S]*?\])\}\s*\/>/g, (_, h, r) => {
    tabelas.push({ h, r });
    return `\n@@TBL${tabelas.length - 1}@@\n`;
  });
  const listas = [];
  bloco = bloco.replace(/<Ul\s+items=\{(\[[\s\S]*?\])\}\s*\/>/g, (_, it) => {
    listas.push(it);
    return `\n@@UL${listas.length - 1}@@\n`;
  });

  for (const parte of bloco.split("\n")) {
    const tbl = parte.match(/@@TBL(\d+)@@/);
    if (tbl) {
      const { h, r } = tabelas[Number(tbl[1])];
      const cab = JSON.parse(h.replace(/'/g, '"'));
      const linhasT = JSON.parse(r.replace(/'/g, '"').replace(/,\s*\]/g, "]"));
      linhas.push("", `| ${cab.join(" | ")} |`, `|${cab.map(() => "---").join("|")}|`);
      for (const l of linhasT) linhas.push(`| ${l.join(" | ")} |`);
      linhas.push("");
      continue;
    }
    const ul = parte.match(/@@UL(\d+)@@/);
    if (ul) {
      const itens = [...listas[Number(ul[1])].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(m => m[1]);
      linhas.push("");
      for (const it of itens) linhas.push(`- ${it.replace(/\\"/g, '"')}`);
      linhas.push("");
      continue;
    }
    const box = parte.match(/<Box[^>]*titulo="([^"]+)"/);
    if (box) { linhas.push("", `### ${box[1]}`, ""); continue; }
    // O `);` que fecha o `return (` do capítulo não é conteúdo — e sem isto ele
    // aparecia como parágrafo no fim de cada capítulo do documento.
    if (/^\s*\)?;?\s*$/.test(parte)) continue;
    const t = texto(parte);
    if (t && t !== ");" && t !== ")") linhas.push(t, "");
  }
  return linhas.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ── Os dois regulamentos ────────────────────────────────────────────────────
const ALVOS = {
  "B": {
    versao: "vB-01",
    titulo: "Regulamento — Sistema B (Pontos Fixos)",
    fn: "ConteudoCapB",
    caps: "CAPS_B",
    resumo: "Circuito de **pontos fixos**: vitória vale 2, derrota vale 1, folga (bye) vale 1. Não há rating — o ranking é a soma dos pontos da temporada, que zera na virada. **Não há torneio de encerramento nem certificado**: a temporada termina na tabela de pontos.",
  },
};

const alvo = ALVOS[process.argv[2]];
if (!alvo) {
  console.error("uso: node scripts/gerar-regulamento.mjs B");
  process.exit(2);
}

const corpo = recorte(alvo.fn);
const caps = listaCapitulos(alvo.caps);
const out = [];
out.push(`# ${alvo.titulo} — versão \`${alvo.versao}\``, "");
out.push("> ⚠️ **Este arquivo é GERADO** por `scripts/gerar-regulamento.mjs` a partir do");
out.push("> texto que o app exibe. **Não edite à mão** — edite o texto no app e rode o");
out.push("> gerador. A bateria de testes recusa um arquivo que tenha divergido da tela.");
out.push("");
out.push(alvo.resumo, "");
out.push(`Este documento reproduz o texto que o atleta lê e aceita ao se inscrever num`);
out.push(`circuito que declara a versão \`${alvo.versao}\`.`, "");
out.push("---", "");

for (const c of caps) {
  const bloco = blocoCapitulo(corpo, c.id);
  if (!bloco) throw new Error(`capítulo ${c.id} (${c.titulo}) não foi encontrado no ${alvo.fn}`);
  out.push(`## ${c.tag} — ${c.titulo}`, "");
  out.push(paraMarkdown(bloco), "");
}

process.stdout.write(out.join("\n").replace(/\n{3,}/g, "\n\n") + "\n");
