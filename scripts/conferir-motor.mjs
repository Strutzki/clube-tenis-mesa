#!/usr/bin/env node
// Confere se o supabase/config.toml bate com o que esta REALMENTE no ar.
//
// POR QUE ISTO EXISTE: o config.toml decide o `verify_jwt` de cada funcao — o
// portao de entrada. Se ele divergir do ar, a proxima publicacao muda o portao
// sem ninguem pedir; nas cinco funcoes que o app chama isso derruba login,
// painel e telas publicas para todos. Ate hoje a conferencia era manual, feita
// uma vez. Isto transforma a conferencia numa regra que falha em vermelho.
//
//   npm run motor:conferir
//
// Sai 0 quando bate; sai 1 e explica quando diverge.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PROJETO = "eultwfzzlgcmcikobmmy";

// --- o que o config.toml declara ---
const toml = fs.readFileSync(path.join(RAIZ, "supabase", "config.toml"), "utf8");
const declarado = new Map();
for (const m of toml.matchAll(/\[functions\.([a-z0-9-]+)\]\s*\r?\n\s*verify_jwt\s*=\s*(true|false)/g)) {
  declarado.set(m[1], m[2] === "true");
}
if (declarado.size === 0) {
  console.error("  conferir-motor: nao achei nenhuma funcao no supabase/config.toml. O arquivo mudou de forma?");
  process.exit(1);
}

// --- o que esta no ar ---
const cli = path.join(RAIZ, "node_modules", ".bin", "supabase");
const r = spawnSync(cli, ["functions", "list", "--project-ref", PROJETO, "--output", "json"], { cwd: RAIZ, encoding: "utf8" });
if (r.status !== 0) {
  console.error("  conferir-motor: nao consegui falar com o Supabase.");
  console.error("  Se disser que falta token, rode:  npx supabase login");
  console.error((r.stderr || r.stdout || "").trim().split("\n").slice(0, 3).map((l) => "    " + l).join("\n"));
  process.exit(1);
}
let noAr;
try {
  noAr = new Map(JSON.parse(r.stdout).map((f) => [f.slug, f.verify_jwt]));
} catch {
  console.error("  conferir-motor: nao entendi a resposta do Supabase.");
  process.exit(1);
}

// --- comparacao ---
let divergencias = 0, ausentes = 0;
console.log("\n  funcao                      no ar     declarado");
console.log("  ---------------------------------------------------");
for (const [nome, valor] of [...declarado].sort()) {
  const ar = noAr.get(nome);
  if (ar === undefined) {
    console.log(`  ${nome.padEnd(26)} (nao existe no projeto)`);
    ausentes++;
    continue;
  }
  const bate = ar === valor;
  if (!bate) divergencias++;
  console.log(`  ${nome.padEnd(26)} ${String(ar).padEnd(9)} ${String(valor).padEnd(9)} ${bate ? "ok" : "<<< DIVERGE"}`);
}

// funcoes que existem no Supabase e ninguem declarou — sao dos outros apps que
// dividem a mesma conta. Avisar, nunca publicar nem apagar.
const naoDeclaradas = [...noAr.keys()].filter((n) => !declarado.has(n)).sort();
if (naoDeclaradas.length) {
  console.log("\n  Tambem no ar, de outros apps (nunca publicar nem apagar daqui):");
  for (const n of naoDeclaradas) console.log(`    - ${n} (verify_jwt: ${noAr.get(n)})`);
}

if (divergencias > 0) {
  console.error(`\n  ${divergencias} DIVERGENCIA(S). NAO publique nada ate resolver.`);
  console.error("  Publicar com o config.toml errado troca o portao de entrada da funcao.\n");
  process.exit(1);
}
if (ausentes > 0) {
  console.error(`\n  ${ausentes} funcao(oes) declarada(s) que nao existe(m) no projeto. Confira o config.toml.\n`);
  process.exit(1);
}
console.log(`\n  Tudo bate: ${declarado.size} funcoes conferidas, 0 divergencias.\n`);
