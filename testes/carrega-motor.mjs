// Carrega uma Edge Function DE VERDADE (o arquivo que vai para produção) dentro
// do Node, para os testes chamarem as ações dela.
//
// Por que isto importa: o harness antigo (harnesses/desfazer-processamento)
// reescrevia a lógica do motor dentro do próprio teste. Um teste assim continua
// verde mesmo se o motor quebrar — ele testa a cópia, não o original. Aqui não
// há cópia: lemos `supabase/functions/<nome>/index.ts`, o mesmo arquivo que o
// `npm run motor:publicar` sobe.
//
// Três coisas precisam ser resolvidas para o arquivo rodar fora do Supabase:
//   1. o import vem de uma URL (esm.sh) — trocamos pelo nosso banco de mentira;
//   2. `Deno.env.get(...)` — respondemos com valores de teste;
//   3. `Deno.serve(handler)` — em vez de subir servidor, guardamos o handler.
// O resto do arquivo é executado exatamente como está.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, "..");

export const PIN_DE_TESTE = "1234";

/**
 * @param {string} nomeDaFuncao  ex.: "admin-action"
 * @param {object} banco         o objeto devolvido por criarBancoFalso()
 * @returns {Promise<{chamar: Function, handler: Function}>}
 */
export async function carregarFuncao(nomeDaFuncao, banco) {
  const origem = path.join(RAIZ, "supabase", "functions", nomeDaFuncao, "index.ts");
  if (!fs.existsSync(origem)) throw new Error(`nao achei a funcao: ${origem}`);

  let codigo = fs.readFileSync(origem, "utf8");

  // 1. O import de URL não existe no Node. Apontamos para um módulo local que
  //    devolve o banco de mentira no lugar do cliente do Supabase.
  const antes = codigo;
  codigo = codigo.replace(
    /from\s+["']https:\/\/esm\.sh\/@supabase\/supabase-js@\d+["']/g,
    `from ${JSON.stringify(pathToFileURL(path.join(AQUI, "cliente-falso.mjs")).href)}`
  );
  if (codigo === antes) {
    throw new Error(`carrega-motor: nao achei o import do supabase-js em ${nomeDaFuncao}. O arquivo mudou de forma?`);
  }

  // 2 e 3. O ambiente do Deno, montado antes do arquivo rodar.
  let handlerCapturado = null;
  globalThis.Deno = {
    env: {
      get: (chave) => ({
        SUPABASE_URL: "http://banco-de-mentira.teste",
        SUPABASE_SERVICE_ROLE_KEY: "chave-de-teste",
        ADMIN_PIN: PIN_DE_TESTE,
      }[chave] ?? `valor-de-teste:${chave}`),
    },
    serve: (fn) => { handlerCapturado = fn; },
  };
  globalThis.__bancoFalsoDoTeste = banco;

  // O arquivo temporário mantém a extensão .ts para o Node apagar os tipos
  // sozinho (Node 22.6+). Fica fora do projeto, em pasta temporária.
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "motor-teste-"));
  const destino = path.join(pasta, `${nomeDaFuncao}-${Date.now()}.ts`);
  fs.writeFileSync(destino, codigo);

  try {
    await import(pathToFileURL(destino).href);
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true });
  }

  if (!handlerCapturado) {
    throw new Error(`carrega-motor: ${nomeDaFuncao} nao chamou Deno.serve — nada para testar`);
  }

  /**
   * Chama a função como o app chama: um POST com JSON.
   * Devolve { status, corpo } já com o JSON lido.
   */
  async function chamar(corpoDoPedido, cabecalhos = {}) {
    const resposta = await handlerCapturado(new Request("http://teste/", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cabecalhos },
      body: JSON.stringify(corpoDoPedido),
    }));
    let corpo = null;
    try { corpo = await resposta.json(); } catch { corpo = null; }
    return { status: resposta.status, corpo };
  }

  return { chamar, handler: handlerCapturado };
}
