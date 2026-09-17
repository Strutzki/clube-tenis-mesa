// Bateria — NOME QUE NÃO EXISTE DERRUBA O APP, E NADA AVISA.
//
// Em 13/09/2026 eu liguei a versão do regulamento à tela de entrada e escrevi
// `sistemaAtivo={sistemaAtivo}` supondo um state com esse nome. Não existe: a
// variável real é `SISTEMA_ATIVO`, de módulo. Resultado:
//
//   ReferenceError: sistemaAtivo is not defined
//
// ...na primeira renderização do ramo `!isAdmin && !currentAthlete &&
// !isVisitante` — ou seja, TELA BRANCA para todo visitante novo, todo atleta
// deslogado e toda sessão expirada. A porta de entrada do app.
//
// O que torna isso digno de bateria própria não é o erro; é o que NÃO o pegou:
//   - `npm run build` passou. JSX é JS válido: ninguém confere escopo de nome.
//   - as 326 asserções passaram. Elas cobrem o motor; o App.jsx quase não.
//   - `npm run lint` passou, porque `no-undef` não estava ligada.
//
// Dois guardiões acharam ao vivo, abrindo o app. Foi o único portão que
// funcionou — e depende de alguém lembrar de deslogar antes de publicar.
//
// Esta asserção liga o portão que faltava. É a terceira vez que um erro só-de-
// execução atravessa build verde neste projeto (a anterior foi o TDZ do
// `versaoRetry`, em 12/09), e as duas vezes o sintoma foi o mesmo: o app não
// abre, e nada na bateria acusa.

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ok, igual, secao, placar } from "./ferramentas.mjs";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

secao("Nenhum nome usado no app deixou de existir");
{
  // Roda o oxlint do próprio projeto. `no-undef` está ligada em `.oxlintrc.json`
  // com os globais de navegador declarados — sem isso a regra afoga em falso
  // positivo (`URL`, `location`, `cancelAnimationFrame`) e vira ruído ignorado.
  let saida = "";
  let rodou = true;
  try {
    // Cobre o app, a bateria E o motor. O motor entrou porque lá o mesmo erro
    // acontece em PRODUÇÃO: as Edge Functions rodam sem build e sem tipo, então
    // um nome errado só aparece quando um atleta clica. (`Deno` está declarado
    // como global no .oxlintrc.json — sem isso as 9 funções afogam a regra.)
    // O `testes/` entrou porque o primeiro uso desta asserção foi eu escrever um
    // teste chamando `igual` sem importar: mesma classe de erro, dentro do
    // arquivo que deveria proteger contra ela.
    saida = execFileSync("npx", ["oxlint", "--format", "default", "src/", "testes/", "supabase/functions/"], {
      cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    // oxlint sai com código != 0 quando acha erro — a saída é o que interessa.
    saida = String(e.stdout || "") + String(e.stderr || "");
    if (!saida) rodou = false;
  }
  ok(rodou, "o oxlint rodou e devolveu saída");

  const indefinidos = saida.split("\n").filter(l => /eslint\(no-undef\)/.test(l));
  igual(indefinidos, [],
    `nenhum identificador indefinido no app, na bateria ou no motor (achados: ${indefinidos.length})`);

  // E a regra tem de continuar LIGADA. Sem esta asserção, alguém a desliga no
  // config e a de cima fica verde para sempre, sem verificar nada — foi
  // exatamente assim que o defeito passou: a regra existia e estava desligada.
  const cfg = JSON.parse(
    (await import("node:fs")).readFileSync(path.join(RAIZ, ".oxlintrc.json"), "utf8")
  );
  igual(cfg?.rules?.["no-undef"], "error",
    "a regra no-undef continua ligada no .oxlintrc.json");
  ok(cfg?.env?.browser === true,
    "os globais de navegador continuam declarados — sem isso a regra vira ruído");
}

placar("Nomes que não existem");
