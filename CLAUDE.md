# Como se trabalha neste projeto

Plataforma de circuitos de tênis de mesa, **em produção**. O circuito de Belo
Horizonte (`slug: bh`) roda com atletas reais, pagantes, e é o circuito legado:
tudo que existe hoje foi construído em volta dele. A arquitetura e o estado do
desenvolvimento estão em `docs/ESTADO-DEV-app-tenis-de-mesa.md` e no
`README.md` — não repita aqui. Este arquivo é sobre **como mexer sem quebrar**.

O Juliano não é programador de formação: construiu o app conversando com o
Claude. Explique termos técnicos na primeira vez que aparecerem.

## Regras que não se quebram

1. **Nunca publicar sem o de acordo dele**, e só depois do **rito de subida**
   (seção própria abaixo): bateria verde, guardiões revisados com o supervisor
   de cada um, e o resumo aprovado por ele. Publicar o app é `./atualizar.sh` —
   o que troca o app que os atletas estão usando naquele momento.
   Ao contrário do app de torneios, **aqui não há véspera de congelamento**: o
   circuito é assíncrono, os atletas jogam ao longo do mês, e ele publica a
   qualquer hora — decisão dele, 07/09/2026. O portão é o de acordo, não a data.
2. **O BH nunca é prejudicado.** Qualquer mudança que toque o motor, o banco ou
   a leitura do roster precisa ser comparada antes/depois no BH — o padrão do
   projeto é provar que o BH ficou **byte-idêntico** (mesmo hash dos dados de
   competição). Está nos vereditos de `docs/GOVERNANCA_AGENTES.md`.
3. **Nada vai a produção sem revisão supervisionada.** A regra permanente é a
   do `docs/GOVERNANCA_AGENTES.md`: o agente relevante (e o supervisor dele)
   emite veredito documentado **antes** do OK do Juliano e do deploy. A tabela
   "quem revisa o quê" está lá; os mandatos, em `.claude/agents/`.
4. **Coluna nova em tabela lida pelo visitante derruba o app inteiro.** Detalhe
   em "Armadilhas" — já tirou o app do ar uma vez.
5. **Rodar a bateria antes de commitar**, e dizer o resultado em números.
6. **Nenhuma afirmação do tipo "o app garante X"** entra em documento sem a
   linha de código que sustenta.

## A bateria de testes

```bash
npm run teste
```

Hoje são **672 asserções** (conferido ao vivo em 27/09/2026, somando as 12
seções que a bateria imprime). **Não cite este número de memória** — ele mudou em
sete ondas seguidas; rode `npm run teste` e leia. O `atualizar.sh` roda isso
antes de publicar e se recusa a subir com teste vermelho. O `testes/README.md`
traz o mesmo número, e desde 27/09/2026 a tabela de arquivos dele está completa
(todos os que existem — confira com `ls testes/*.mjs`, não pelo número: esta frase
já nasceu velha uma vez, no mesmo dia) — era a dívida antiga registrada em
`docs/curadoria-indice-app-tenis-de-mesa.md`.

Ela carrega **quatro Edge Functions de verdade** — `admin-action`,
`athlete-action`, `comprovante-url` e `login-atleta`, os mesmos arquivos que vão
para o ar — e
roda contra um banco em memória. Detalhe em `testes/README.md`.

O banco em memória **projeta colunas** desde 27/09/2026: se o código pede
`select("id, telefone")`, o teste recebe só essas duas. Sem isso, trocar por
`select("*")` numa ação lida pelo organizador passava **verde** mesmo passando a
devolver o `pin_hash` de todos os atletas do circuito.

⚠️ **O portão do `atualizar.sh` já esteve cego para 68% da bateria.** Descoberto
em 27/09/2026 pelo Guardião de Confiabilidade: `placar()` **devolve** 0 ou 1, não
sai do processo, e quatro arquivos chamavam `placar(...)` sem `process.exit(...)`
— então saíam com código 0 mesmo com falha, o `&&` do `npm run teste` seguia
adiante, e o `atualizar.sh` (que lê o código de saída) publicaria. Eram 395 das
581 asserções de então, incluindo os **351** do `regulamento-por-circuito.mjs`.
Corrigido nos quatro, e provado: sabotar uma asserção do regulamento agora faz
`npm run teste` sair com **1**. **Regra: todo arquivo de teste novo termina em
`process.exit(placar("..."))`** — imprimir "Falhas:" e sair 0 é pior que não ter
teste, porque parece proteção.

**Todo teste novo nasce com teste de mutação**: sabote a linha do motor que ele
protege e exija que a bateria fique vermelha. O harness antigo em `harnesses/`
não faz isso: ele reescreve a lógica do motor dentro dele, e por isso continua
verde mesmo com o motor quebrado.

## O rito de subida — vale para todo avanço

Pedido do Juliano, 07/09/2026: **todo avanço no app passa por esta rotina antes
de subir.** Não espere ele pedir; é o caminho padrão, e eu conduzo sozinho até o
passo 4.

**1. Bateria e build.** `npm run teste` e `npm run build`. Resultado **em
números**. Vermelho aqui encerra o assunto — não se leva mudança quebrada para
revisão.

**2. Asserção nova.** Mexeu numa regra da competição? Ela nasce com asserção na
bateria **e com teste de mutação** (sabotar a linha, ver a bateria ficar
vermelha, restaurar). Sem isso, a regra não está protegida.

**3. Revisão pelos guardiões.** ⚠️ **Congele a árvore num commit e mande o SHA**,
nunca um diff de árvore viva — e **se a árvore andar durante a revisão, avise o
guardião com o SHA novo em vez de deixá-lo descobrir.** As duas coisas foram
aprendidas do jeito caro em 27/09/2026: na primeira rodada três guardiões
auditaram uma versão que deixou de existir no meio do parecer, e um deles mediu a
árvore vermelha sem haver regressão (era mutação de outro agente de pé na árvore
compartilhada); na segunda, um guardião só percebeu o commit novo porque confere o
`HEAD` no fim por hábito — sem isso teria dado GO para um código que ninguém tinha
revisado. E cada agente que mutar usa pasta de scratchpad com **nome próprio**,
senão um sobrescreve a prova do outro.
 Chame os agentes de `.claude/agents/`, cada
guardião **com o supervisor dele**. Se o supervisor devolver (REVISAR), corrija
e refaça — o parecer só vale depois de APROVADO pelo supervisor.

- **Sempre:** `guardiao-confiabilidade` + `supervisor-confiabilidade`.
- **Mais as duplas da área tocada**, pela tabela de `docs/GOVERNANCA_AGENTES.md`
  (regulamento/motor, segurança, jurídico, admin, atleta, visual, curador).
- **As 8 duplas completas** quando a mudança tocar em **motor, banco, dinheiro
  ou dado pessoal** — as quatro coisas que não dá para consertar depois.

**4. Resumo para o de acordo.** Traga ao Juliano, no formato abaixo, e **pare**.

**5. Ele diz que pode subir.** Só então publicar, e registrar no
`docs/CHANGELOG.md` com a versão da função que subiu.

### O formato do resumo (curto, sempre igual)

```
O QUE MUDA
  Uma a três linhas, na língua dele, sem jargão.

O QUE ELE VAI NOTAR
  O que o atleta e o organizador veem de diferente. Se nada muda na
  tela, dizer isso — mudança inerte é informação, não silêncio.

O QUE SOBE
  App (git push) / motor (qual função, de qual versão para qual) /
  banco (qual migração). Se for mais de um, em que ordem.

BATERIA
  N asserções, N falhas. Build OK ou não.

VEREDITOS
  Guardião X: GO (supervisor: APROVADO)
  Guardião Y: GO-com-condições — qual condição, e se foi atendida

RISCO E VOLTA ATRÁS
  O que pode dar errado e o comando exato para reverter.
```

Se algum guardião der **NO-GO**, não traga o resumo pedindo o de acordo: traga o
problema. Pedir autorização com um NO-GO em aberto transfere para ele uma
decisão técnica que é minha.

## O que publica e o que não publica

Só **duas** coisas trocam o que os atletas estão usando:

| Comando | Troca | Quando |
|---|---|---|
| `git push origin main` — **inclusive o que o `atualizar.sh` faz no fim** | o app (as telas) | ~1 minuto depois, sozinho |
| `npm run motor:publicar -- <função>` | o motor (as regras) | na hora |

O `atualizar.sh` **não fala com a Vercel**: ele testa, comita e dá `git push`.
Quem republica o site é a Vercel, ao ver o push na `main`. Logo, **empurrar para
o GitHub é publicar** — não existe "só guardar no GitHub" nesta configuração.

Não trocam nada: editar arquivos, `npm run teste`, `npm run build`,
`git commit`, e ler o banco. **Commit é marcador de página, não publicação.**

⚠️ **`npm run dev` conversa com o banco de produção.** A URL do Supabase está
fixa no `src/App.jsx` (linha 104) e não há ambiente separado de teste. Abrir e
olhar, tranquilo; lançar placar ali mexe no circuito de verdade.

✅ **Existe uma trava, além do combinado.** Desde 07/09/2026 um hook do Claude
Code (`~/.claude/hooks/trava-publicacao.sh`, ligado em `~/.claude/settings.json`)
intercepta todo comando que publica — `git push`, `publicar.command`,
`vercel --prod`, `motor:publicar` — e a publicação de Edge Function ou migração
pela conexão do Supabase. Ele não deixa o comando rodar direto: para e pede a
confirmação do Juliano na tela, dizendo o que iria ao ar. Vale para comandos que
saem do Claude; não impede o Juliano de publicar pela própria máquina.

## A ordem de publicar NÃO é fixa

Regra formulada pelo Guardião de Confiabilidade em 27/09/2026, depois de duas ondas
seguidas em que a ordem foi **oposta**:

> **Sobe primeiro o lado que TOLERA a versão antiga do outro.**
> - Se o app novo **chama** o que o motor velho não tem → **motor primeiro**
>   (Onda 0.6: o botão "Reativar" chamava uma ação nova).
> - Se o motor novo **recusa** o que o app velho manda → **app primeiro**
>   (item 0.6.21: o servidor passou a exigir o aceite declarado; o app novo é
>   compatível para frente, porque o motor velho **ignora** campos que não conhece).
> - Se **nenhum dos dois** tolera o outro, a mudança precisa de **duas etapas**: o
>   servidor aceita as duas formas → sobe o app → o servidor aperta.
> - E quando o caminho novo ainda é **inalcançável** (circuito que não existe, papel
>   que ninguém ocupa), a melhor jogada não é escolher a ordem: é **subir os dois
>   antes de ligar o gatilho**.

Não confie na memória da onda anterior. Pergunte, para cada metade: *o que acontece
se esta subir e a outra ainda não?* — e leia o código do que está no ar, não o do
repositório.

## Publicar tem duas metades — e elas andam separadas

- **O app (front)**: `./atualizar.sh` roda `npm run build`, e **só publica se
  compilar**. Se falhar, nada sobe e o site atual continua no ar. Depois faz
  `git add .`, commit e `git push origin main`; a Vercel publica em ~1 minuto
  em `clubedotenisdemesabh.com.br`.
- **As Edge Functions** (o motor, em `supabase/functions/`): **não sobem pelo
  `atualizar.sh`**. Vão pelo terminal, uma por vez:

  ```bash
  npm run motor:listar                     # que versão está no ar agora
  npm run motor:publicar -- admin-action   # sobe uma função
  ```

  O CLI do Supabase está fixado como dependência do projeto (2.117.0), e o
  número do projeto já vai dentro do comando.

  **O comando exige o nome da função** e recusa rodar sem ele — porque o comando
  cru do Supabase, sem nome, publica **todas**, e a fonte deste repositório
  fica **rotineiramente** à frente do que está no ar: o rito de subida (bateria,
  guardiões, resumo, OK do Juliano) roda com o código já commitado, antes de
  publicar — então em qualquer momento pode haver função pronta no fonte que
  ainda não foi liberada. (Justificativa anterior aqui citava "~178 linhas do
  financeiro do organizador ainda não liberadas" — venceu: o financeiro subiu
  na v57→v58, ver `docs/CHANGELOG.md` 08/09/2026. O guard-rail continua certo;
  só a razão citada tinha ficado velha.) O que está pendente de subir, e por
  quê, está sempre em `docs/CHANGELOG.md`. Ele também recusa `--prune`, que
  apagaria as funções dos outros apps na mesma conta.

  **Confira sempre depois de publicar:** `npm run motor:conferir` compara o
  `verify_jwt` de cada função com o `supabase/config.toml` e falha em vermelho na
  divergência. Esse arquivo é o portão de entrada: sem ele, o CLI **liga** a
  verificação por padrão, e as cinco funções que o app chama estão no ar com ela
  desligada — ligá-las faria o Supabase exigir um token que o app não manda, e
  login, painel e telas públicas parariam para todo mundo. Pior: a chave que o
  app envia não é um JWT, então a queda seria total, não parcial.

  Estreou em 07/09/2026 publicando 5 funções (a liberação do `localhost`), com
  conferência a cada uma. Precisa de `supabase login` feito nesta máquina — sem
  credencial não há deploy **nem rollback**.

  ⚠️ **Não há rollback de Edge Function.** "Voltar" é republicar o código antigo,
  criando uma versão nova — o número sempre sobe. E `git checkout` não serve,
  porque o fonte está à frente do ar. Uma cópia do que está rodando hoje está em
  `JULIANO/CLUBE DO TÊNIS DE MESA/BACKUPS/motor-no-ar-2026-09-07/`.

  **Desde 27/09/2026 há DOIS lugares, e é de propósito:** o fonte do que está no
  ar passa a ser salvo **dentro do repositório**, em
  `docs/backups/motor-no-ar-<data>/` — versionado pelo git, sobrevive à máquina e
  aparece no diff de quem for reverter. As pastas anteriores (07/09, 07/09
  pós-CORS, 08/09-v57, 19/09) ficam **fora** dele, no caminho acima. Ao reverter,
  procure nos dois. E antes de publicar uma função pela primeira vez depois desta
  data, salve o fonte do ar na pasta nova: foi a única condição **irreversível**
  que os guardiões levantaram na Onda 0.6.

Consequência que já confundiu: **o código no repositório pode estar à frente do
que está no ar.** O `CHANGELOG.md` registra isso explicitamente (ex.: "edge
admin-action commitado no fonte, a deployar (v55) quando existir o 1º circuito
vendido"). Antes de investigar um bug do motor, **confirme qual versão está no
ar** — não presuma que é a do arquivo.

> **Termo:** *Edge Function* é um pedacinho de programa que roda no servidor do
> Supabase, não no celular do atleta. É onde vive o motor da competição —
> justamente para o atleta não conseguir mexer no resultado pelo navegador.

## Onde as coisas estão

- `src/App.jsx` — **o app inteiro**, ~9.700 linhas. Um arquivo só, React + Vite.
- `supabase/functions/admin-action/index.ts` — **o motor**, ~1.700 linhas. As
  ações do organizador (INICIAR_ETAPA, AVANCAR_RODADA, PROCESSAR_RODADA,
  APLICAR_WO, NOVA_TEMPORADA, financeiro, papéis) saem de um `switch (acao)`.
  São **46** hoje — e conte em vez de citar de memória, porque este número
  apodreceu em sete ondas seguidas:
  `grep -o '^      case "[A-Z_]*"' supabase/functions/admin-action/index.ts | sort -u | wc -l`
- `supabase/functions/athlete-action/index.ts` — o que o atleta pode fazer
  (ENVIAR_PLACAR, INSCREVER, RENOVAR, SOLICITAR_WO...).
- `supabase/functions/login-atleta/index.ts` — login por telefone + PIN, token
  de sessão, e as consultas que exigem sessão autenticada.
- `docs/GOVERNANCA_AGENTES.md` — a regra de revisão **e o histórico de
  vereditos**. É o documento com mais lição aprendida do projeto; leia os
  vereditos antes de mexer em segurança, motor ou banco.
- `docs/ESTADO-DEV-app-tenis-de-mesa.md` — o retrato atual. Comece por ele.
- `docs/ROADMAP.md` — **a fonte de verdade sobre o que fazer a seguir**, em
  ondas, com uma seção "Fora do escopo" que registra o que já foi decidido não
  fazer, e por quê. Consulte antes de propor qualquer coisa.
- `docs/CHANGELOG.md` — o que foi ao ar, com a versão da Edge Function.
- `docs/historico/` — os planos das fases concluídas, com aviso no topo. São
  registro do *porquê*, não plano ativo.
- `.claude/agents/` — 8 agentes revisores e 8 supervisores que aprovam ou
  devolvem o trabalho deles.

## O modelo de dados, em uma frase

A identidade e o rating do atleta são **globais** (tabela `atletas`); o que é da
temporada e do circuito é **por circuito** (`circuito_atletas`). A configuração
de um circuito está em `circuitos` — **menos a do BH, que está na tabela antiga
`configuracao`**. Essa exceção do BH é a origem de quase toda ramificação
`if (circuitoId === bh)` que você vai encontrar no motor.

Há **dois sistemas de competição**, travados na criação do circuito:
**A** (rating/CBTM, o do BH, regulamento v03-12) e **B** (pontos fixos V=2/D=1,
regulamento vB-01). `getSistema()` resolve qual é — e é **fail-closed**: se a
consulta falhar, ele lança erro em vez de assumir "A", justamente para nunca
gravar rating num circuito que não tem rating.

## Armadilhas conhecidas

- **Coluna nova numa tabela lida pelo visitante derruba o app para todo mundo.**
  O app lê `circuitos` sem dizer quais colunas quer, o que no PostgREST vira um
  `SELECT *`. Se existir **uma** coluna sem permissão de leitura para o visitante
  (`anon`), a consulta inteira falha e todo mundo vê "Erro de conexão com banco
  de dados". Aconteceu em 07/09/2026. Regra: ou a coluna nova recebe permissão
  para o `anon` **na mesma migração**, ou o dado sensível vai para uma tabela
  privada separada (foi o que fizeram com `circuito_cobranca`).
- **O roster do BH ainda é lido pelo jeito antigo** (`atletas` com
  `status='ativo'`), e `atletas` hoje é compartilhada entre circuitos. Já
  aconteceu de atleta de teste de outro circuito **vazar para o roster do BH**.
  Foi limpo em 06/09/2026, mas o vetor continua aberto: atleta criado com
  `status='ativo'` global aparece no BH.
- **Escrita dupla (*dual-write*).** O servidor grava o estado sazonal no lugar
  antigo (`atletas`/`configuracao`) **e** espelha no novo
  (`circuito_atletas`/`circuitos`). O espelho é *best-effort*: se falhar, só
  registra e segue, para nunca quebrar a operação do BH. Ou seja: os dois lugares
  podem divergir. Ao investigar número errado, olhe os dois.
- **O fonte pode não ser o que está no ar.** `circuito-dados` ficou tempos no ar
  sem código nenhum no repositório (recuperada em 07/09/2026, cópia fiel da v2).
  Antes de mexer numa função, rode `npm run motor:listar` e compare a versão com
  o que o `CHANGELOG.md` diz. **Segundo episódio, achado pelo Guardião de
  Segurança em 19/09/2026:** o `login-atleta` que estava no ar não correspondia
  a nenhum commit deste repositório — era o `0c91f4c` mais as origens de
  `localhost`, publicado de uma pasta de rascunho do **projeto de torneios**
  (que divide o mesmo Supabase), com o `HEAD` deste repo já dois commits à
  frente. Houve um período sem rollback possível para essa função: "voltar"
  precisa de uma cópia do que estava rodando, e não havia uma que batesse com
  nenhum commit. A versão viva foi copiada para
  `JULIANO/CLUBE DO TÊNIS DE MESA/BACKUPS/motor-no-ar-2026-09-19/ar-login-atleta-v8.ts`
  (mesma convenção do backup de 07/09 acima) antes do próximo deploy — sem
  isso, mesmo o "republicar o código antigo" (a única forma de rollback de
  Edge Function) não teria por onde voltar.
- **O app de torneios mora no mesmo Supabase.** A função `torneios-api` roda no
  mesmo projeto (`eultwfzzlgcmcikobmmy`) que o circuito. São dois produtos
  diferentes dividindo um banco: mexer em permissão, extensão ou tabela
  compartilhada aqui pode derrubar o app de torneios, e vice-versa. Ao alterar
  qualquer coisa fora das tabelas do circuito, verifique quem mais lê aquilo.
- **Não crie backup dentro de `src/`.** Havia 20 cópias de `App.jsx` com hora no
  nome; foram removidas em 07/09/2026 e continuam no histórico do git se
  precisar de alguma. O git já é o backup.
- **`atualizar.sh` publica tudo que estiver na pasta.** Desde 07/09/2026 ele
  lista os arquivos e espera você digitar `S` antes de mandar — leia a lista:
  arquivo temporário esquecido ali viaja junto.
- **A bateria executa quatro das funções, e nenhum pedaço do app.**
  Reconferido em 27/09/2026 rodando `grep` nos testes, não de memória. Quem
  carrega e executa código de verdade é `carregarFuncao(nome, banco)`
  (`testes/carrega-motor.mjs`) — **é esse o nome**, não `carregarMotor`, que não
  existe. `montarMotor({ funcao: "..." })` escolhe qual carregar (padrão:
  `admin-action`). Ela é chamada para quatro funções:
  - **`admin-action`** — é o grosso da bateria, e a razão de a frase antiga
    dizer "a bateria cobre o motor";
  - **`athlete-action`** — e isto **cresceu** em 19/09: já não é só a guarda de
    versão do `INSCREVER`. São **7 cenários comportamentais** do
    `ACEITAR_REGULAMENTO` (`testes/regulamento-por-circuito.mjs`, seção "O
    re-aceite RODANDO"), com sessão gravada como SHA-256 de verdade, mais o
    cenário do `INSCREVER`;
  - **`comprovante-url`** — novo em 27/09/2026 (item 0.6.4). São **16 asserções**
    em `testes/onda-06.mjs` rodando a função de verdade, com um `storage` de
    mentira (`testes/banco-falso.mjs`) que registra o que foi assinado —
    inclusive as asserções de que **nada é assinado** quando a autorização
    recusa, que é a ordem que importa;
  - **`login-atleta`** — novo em 27/09/2026. São **38 asserções** em
    `testes/participar-outro-circuito.mjs` rodando a função de verdade, cobrindo o
    `PARTICIPAR` (entrada de atleta existente num 2º circuito): o aceite do
    regulamento declarado pelo atleta, a comparação com a versão do circuito, e o
    responsável legal obrigatório para menor de 18. Precisa de duas funções de
    banco no cenário (`get_cpf_pepper` e `dedup_por_cpf_hash`), que o banco em
    memória serve pelo parâmetro `funcoes`.

  **`src/App.jsx` não é executado por teste nenhum** (o `login-atleta` passou a
  ser, em 27/09/2026, mas só no `PARTICIPAR` — o `LOGIN` e o `SESSAO` seguem sem
  asserção). O que
  existe para eles são checagens por regex no texto fonte (`fonte.indexOf(...)`),
  que pegam ausência/presença de um trecho — **não** comportamento em runtime. O
  portão dos dois continua sendo "compila?" mais leitura de texto.

  ⚠️ **Janela de asserção de fonte se ancora em fronteira sintática, nunca em
  contagem de caracteres** — e mesmo ancorada, ela é cega para os pontos de chamada.
  Duas lições de 27/09/2026, e a diferença entre elas importa. (a) Uma checagem
  recortava 9.000 caracteres a partir do início da função e a condição estava a
  9.524: ficou **vermelha**, ou seja falhou para o lado seguro, e por isso foi vista.
  (b) Pior: a janela ancorada na função é fiel ao **corpo** dela e por isso não vê
  quem a **invoca** — o defeito mais grave da fatia 0.6.21 era uma prop que faltava
  num ponto de chamada 300 linhas adiante, e dois guardiões provaram, independentes,
  que remover essa prop deixava a bateria **inteira verde**. Padrão: quando uma prop
  é o que faz a tela funcionar, **conte os pontos de chamada e exija a prop em
  todos**.

  ⚠️ **E regex passa verde com a regra quebrada** — isto não é teoria: em
  19/09/2026 o guardião de Regulamento sabotou o re-aceite de **três** jeitos
  (`versaoVista !== versaoAtual` → `versaoVista && versaoVista !== versaoAtual`;
  `if (!vinc)` → `if (false && !vinc)`; enfraquecer `if (!atletaId)`) e a bateria
  ficou **verde nas três**, porque a regex continuava casando. Por isso os 7
  cenários existem. **Regra: se a asserção é regex, ela não protege a regra — só
  registra que um trecho de texto está lá.**

## Convenções

- **Tudo em português do Brasil**: nomes de função, comentários, mensagens de
  tela. As ações do motor são MAIÚSCULAS com underscore (`PROCESSAR_RODADA`).
- **Comentários explicam a regra, não o código** — por que a CBTM ou o
  regulamento exige aquilo, com a versão do regulamento quando houver. O padrão
  do `admin-action` é bom: cada guarda diz o que ela está impedindo.
- **Um só arquivo.** O `App.jsx` não se divide em módulos.
- **O motor é o servidor.** Regra de competição se decide na Edge Function; o
  front só reflete. Não recalcule rating nem pontuação no `App.jsx`.
- **Mudança destrutiva pede confirmação-com-nome** (digitar o nome do circuito).
  Adotado nas ações que apagam (`CancelarCircuitoCard`), no carimbo do
  regulamento (`DEFINIR_REGULAMENTO_VERSAO`) e — **desde 19/09/2026, no fonte** —
  na **virada de temporada** (`NOVA_TEMPORADA`), que era a exceção: a ação mais
  destrutiva do app (arquiva o ranking, apaga partidas e chaves, zera stats de
  todos os ativos, **não se desfaz**) estava protegida só por dois botões num
  modal. Era o único ponto em que esta convenção era descrita como "padrão da
  casa" e não era cumprida — ver ROADMAP 0.10.20. **Não há exceção conhecida
  hoje**; se você abrir uma, registre aqui o porquê.

## Git

Trabalho direto na `main` — é o fluxo dele, e o `atualizar.sh` empurra a main
para o GitHub. As mensagens de commit hoje são automáticas
(`atualização 07/09/2026 00:03`): elas não dizem o que mudou, então o
`CHANGELOG.md` é que carrega essa memória — mantenha-o.

Commits pedem autorização.
