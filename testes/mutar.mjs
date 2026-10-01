#!/usr/bin/env node
// MUTAR — aplica UMA sabotagem, roda a bateria, restaura pelo git, e RECUSA
// trabalhar com árvore suja.
//
// Existe desde 30/09/2026 porque eu destruí trabalho não comitado DUAS VEZES na
// mesma noite, do mesmo jeito: rodei `git checkout -- <arquivo>` para desfazer
// uma sabotagem enquanto o CONSERTO do mesmo arquivo ainda não estava comitado.
// O checkout levou os dois. Na primeira vez escrevi a lição num commit; na
// segunda repeti mesmo tendo escrito. Lição escrita não é portão.
//
// Os três portões, todos fail-closed:
//  1. árvore suja no arquivo alvo -> RECUSA antes de tocar em nada;
//  2. âncora que não casa -> ERRO ALTO (o `sabotar.mjs` antigo pulava em
//     silêncio, e quem lia contava sabotagens que nunca rodaram);
//  3. restauração SEMPRE por `git checkout --`, nunca por cópia guardada (os
//     snapshots do ferramental antigo estavam defasados em até 506 linhas, e
//     re-rodar uma sabotagem reverteria código vivo).
//
// Uso:
//   node testes/mutar.mjs <arquivo> <regex> <substituicao> ["rotulo"]

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const [arquivo, de, para, rotulo = "sabotagem"] = process.argv.slice(2);
if (!arquivo || de === undefined || para === undefined) {
  console.error("uso: node testes/mutar.mjs <arquivo> <regex> <substituicao> [rotulo]");
  process.exit(2);
}

const git = (...a) => execFileSync("git", a, { encoding: "utf-8" });

// PORTÃO 1 — árvore suja no alvo.
const sujo = git("status", "--porcelain", "--", arquivo).trim();
if (sujo) {
  console.error(`✗ RECUSADO: ${arquivo} tem trabalho não comitado.\n` +
    `  Uma sabotagem restaura por 'git checkout --', que levaria esse trabalho junto.\n` +
    `  Comite o conserto ANTES de sabotar. (git status: ${sujo})`);
  process.exit(2);
}

const antes = readFileSync(arquivo, "utf-8");
const re = new RegExp(de, "s");

// PORTÃO 2 — âncora que não casa é FALHA, não "nada a fazer".
if (!re.test(antes)) {
  console.error(`✗ RECUSADO: a âncora não casa em ${arquivo}.\n` +
    `  Sabotagem que não aplica não é sabotagem que passou: é medição que não aconteceu.\n  /${de}/`);
  process.exit(2);
}

// PORTÃO 2b — ÂNCORA AMBÍGUA É FALHA. Acrescentado depois de eu sabotar a linha
// ERRADA: havia duas `if (r.error) return r;` no mesmo arquivo, o `replace` troca só
// a PRIMEIRA, e a bateria ficou verde — então a ferramenta me disse "a asserção não
// protege a regra" sobre um conserto que estava protegido. Sabotar o lugar errado
// não é resultado: é medição que não aconteceu, mesma regra do portão acima.
const quantas = (antes.match(new RegExp(de, "sg")) || []).length;
if (quantas > 1) {
  console.error(`✗ RECUSADO: a âncora casa ${quantas} vezes em ${arquivo}, e só a PRIMEIRA seria trocada.`);
  console.error('  Sabotar o lugar errado dá verde falso. Torne a âncora única — no modo "s" o "." atravessa linha.');
  process.exit(2);
}

// PORTÃO 2c — a substituição não pode trazer barra-n literal. TRÊS medições minhas
// foram perdidas assim nesta sessão: o shell passa `\n` como DOIS caracteres, o
// `replace` o insere cru no fonte, o arquivo quebra de sintaxe, e a bateria "fica
// vermelha" por motivo nenhum — a sabotagem nunca foi testada e eu quase concluí
// coisa errada sobre a asserção.
if (para.includes(String.fromCharCode(92) + "n")) {
  console.error('✗ RECUSADO: a substituição contém barra-n literal, que entraria cru no arquivo e quebraria a sintaxe.');
  console.error('  Use o modo "s" com "." para atravessar a linha, ou passe a substituição sem quebra de linha.');
  process.exit(2);
}

writeFileSync(arquivo, antes.replace(re, para));

// PORTAO 2d — MOSTRAR O QUE FOI SABOTADO, sempre.
// Acrescentado depois de tres medicoes perdidas na mesma sessao, todas por sabotar
// algo diferente do que eu pensava: duas por barra-n literal quebrando a sintaxe, e
// uma porque a ancora casou dentro de um COMENTARIO que citava o proprio codigo.
// Nos tres casos a saida parecia um resultado e nao era. Imprimir o diff torna o
// erro visivel na hora, em vez de virar conclusao errada sobre uma assercao.
try {
  const diff = execFileSync("git", ["diff", "--unified=0", "--", arquivo], { encoding: "utf-8" });
  const linhas = diff.split("\n").filter((l) => /^[+-][^+-]/.test(l));
  console.log("   sabotagem aplicada:");
  linhas.slice(0, 6).forEach((l) => console.log("     " + l.trim().slice(0, 100)));
  if (linhas.length > 6) console.log(`     … e mais ${linhas.length - 6} linha(s)`);
  if (linhas.length === 0) console.log("     ⚠️ NENHUMA linha mudou — a sabotagem nao fez nada.");
} catch (e) { console.log("   (nao consegui mostrar o diff: " + e.message + ")"); }
let saida = 0, texto = "";
try {
  texto = execFileSync("npm", ["run", "teste"], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
} catch (e) {
  saida = e.status ?? 1;
  texto = (e.stdout || "") + (e.stderr || "");
} finally {
  // PORTÃO 3 — restaura pelo git, sempre, mesmo se a bateria explodir.
  git("checkout", "--", arquivo);
}

const vermelhas = (texto.match(/✗/g) || []).length;
console.log(`── ${rotulo}`);
(texto.match(/^.*✗.*$/gm) || []).slice(0, 3).forEach((l) => console.log("   " + l.trim()));
console.log(`   vermelhas: ${vermelhas} · saída: ${saida}`);
if (saida === 0) {
  console.log("   ⚠️ A BATERIA FICOU VERDE COM A SABOTAGEM APLICADA — a asserção não protege a regra.");
  process.exit(1);
}
process.exit(0);
