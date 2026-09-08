// Bateria — O PACOTE QUE O VISITANTE BAIXA.
//
// Em 08/09/2026 descobriu-se que a senha do super-admin era uma constante no
// src/App.jsx e, portanto, ia dentro do arquivo que o site entrega a QUALQUER
// visitante. Como essa mesma senha e o PIN mandado ao servidor, quem a lesse
// podia agir como admin por chamada direta — sem navegador, sem CORS.
//
// Estas assercoes existem para isso nunca mais voltar em silencio. Elas nao
// carregam o app; compilam o projeto de verdade e leem o resultado.

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ok, igual, secao, placar } from "./ferramentas.mjs";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FONTE = path.join(RAIZ, "src", "App.jsx");

secao("O código-fonte não guarda senha");
{
  const fonte = fs.readFileSync(FONTE, "utf8");

  // A forma exata do defeito antigo: uma constante com a senha.
  ok(!/const\s+ADMIN_PASS\s*=/.test(fonte),
    "não existe constante ADMIN_PASS no App.jsx");

  // E a consequencia dela: o app conferindo a senha por conta propria.
  ok(!/pass\s*===\s*ADMIN_PASS/.test(fonte),
    "o app não compara a senha localmente — quem decide é o servidor");
  ok(!/===\s*["'][0-9]{4,}["']/.test(fonte),
    "nenhuma comparação com um número solto entre aspas (o formato do PIN antigo)");

  // A porta que abria o painel sem senha nenhuma.
  ok(!/onClick=\{doAdmin\}/.test(fonte),
    "o botão Entrar não passa o evento do clique como 'entrar sem conferir'");

  // O campo precisa aceitar senha de verdade: 4 digitos sao 10 mil combinacoes.
  ok(!/maxLength=\{4\}/.test(fonte),
    "nenhum campo de senha limitado a 4 caracteres");
}

secao("O pacote publicado não carrega segredo");
{
  execSync("npm run build", { cwd: RAIZ, stdio: "pipe" });
  const pasta = path.join(RAIZ, "dist", "assets");
  const arquivos = fs.readdirSync(pasta).filter((f) => f.endsWith(".js"));
  ok(arquivos.length > 0, "o build gerou o pacote de JavaScript");

  const tudo = arquivos.map((f) => fs.readFileSync(path.join(pasta, f), "utf8")).join("\n");

  // A senha que vazou. Fica aqui de proposito: e o unico jeito de a assercao
  // provar que ela nao voltou. Ja esta no historico publico do GitHub e foi
  // trocada no servidor em 08/09/2026 — nao autentica mais nada.
  ok(!tudo.includes("2073"), "a senha antiga do admin não está no pacote publicado");
  ok(!/ADMIN_PASS/.test(tudo), "o nome ADMIN_PASS não aparece no pacote");

  // A chave publicavel PODE estar (e publica por definicao); a de servico NUNCA.
  ok(!/service_role/.test(tudo), "nenhuma chave de serviço do Supabase no pacote");
  ok(!/\bsb_secret_/.test(tudo), "nenhuma chave secreta do Supabase no pacote");
  igual(/eyJ[A-Za-z0-9_-]{30,}/.test(tudo), false,
    "nenhum token no formato JWT embutido no pacote");
}

process.exit(placar("Pacote publicado"));
