#!/usr/bin/env node
// Publica UMA Edge Function, e recusa qualquer outra coisa.
//
// POR QUE ISTO EXISTE (07/09/2026): `supabase functions deploy` sem nome de
// funcao publica TODAS. A fonte deste repositorio esta a frente do que esta no
// ar — a `admin-action` tem ~178 linhas do financeiro do organizador e da
// cobranca da plataforma que o Juliano ainda nao liberou. Um comando sem nome
// mandaria tudo isso ao ar de uma vez, sem ninguem ver.
//
// Regra da casa: uma funcao por vez, nomeada, com conferencia depois de cada uma.
// O rito completo esta no CLAUDE.md, secao "O rito de subida".

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PROJETO = "eultwfzzlgcmcikobmmy";
const PASTA = path.join(RAIZ, "supabase", "functions");

const disponiveis = fs.existsSync(PASTA)
  ? fs.readdirSync(PASTA).filter((d) => fs.existsSync(path.join(PASTA, d, "index.ts"))).sort()
  : [];

const argumentos = process.argv.slice(2);
const funcoes = argumentos.filter((a) => !a.startsWith("-"));
const extras = argumentos.filter((a) => a.startsWith("-"));

function recusar(motivo, detalhe) {
  console.error(`\n  RECUSADO: ${motivo}\n`);
  if (detalhe) console.error(detalhe + "\n");
  console.error("  Uso:  npm run motor:publicar -- <funcao>\n");
  console.error("  Funcoes deste projeto:");
  for (const f of disponiveis) console.error(`    - ${f}`);
  console.error("\n  Uma por vez, e confira depois de cada uma (npm run motor:conferir).\n");
  process.exit(1);
}

if (funcoes.length === 0) {
  recusar(
    "voce nao disse qual funcao publicar.",
    "  Sem nome, o comando do Supabase publicaria TODAS as funcoes deste repositorio —\n" +
    "  inclusive codigo que esta na pasta mas nunca foi liberado para o ar."
  );
}
if (funcoes.length > 1) {
  recusar(`voce pediu ${funcoes.length} funcoes de uma vez: ${funcoes.join(", ")}.`,
    "  A regra e uma por vez, conferindo entre elas.");
}
if (extras.includes("--prune")) {
  recusar("--prune apagaria funcoes do Supabase.",
    "  Este projeto divide a conta do Supabase com o app de torneios (torneios-api)\n" +
    "  e com o do beach tennis. --prune apagaria as funcoes deles.");
}

const alvo = funcoes[0];
if (!disponiveis.includes(alvo)) {
  recusar(`nao existe a funcao "${alvo}" neste projeto.`);
}

console.log(`\n  Publicando SO a funcao: ${alvo}`);
console.log(`  Projeto: ${PROJETO}`);
console.log(`  O verify_jwt vem do supabase/config.toml — nao mexa nele sem o Guardiao de Seguranca.\n`);

const cli = path.join(RAIZ, "node_modules", ".bin", "supabase");
const r = spawnSync(cli, ["functions", "deploy", alvo, "--project-ref", PROJETO, ...extras], {
  cwd: RAIZ, stdio: "inherit",
});
if (r.status !== 0) process.exit(r.status ?? 1);

console.log(`\n  Publicada. AGORA confira, antes de publicar qualquer outra:`);
console.log(`     npm run motor:conferir\n`);
