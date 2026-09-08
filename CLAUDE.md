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

Hoje são **82 asserções**. O `atualizar.sh` roda isso antes de publicar e se
recusa a subir com teste vermelho.

Ela carrega o `admin-action` **de verdade** — o mesmo arquivo que vai para o ar —
e roda contra um banco em memória. Detalhe em `testes/README.md`.

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

**3. Revisão pelos guardiões.** Chame os agentes de `.claude/agents/`, cada
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

⚠️ **A regra 1 é combinado, não cadeado.** O Claude continua com acesso que
permite publicar uma Edge Function pela conexão do Supabase. O que impede é esta
página, não uma trava técnica. Se um dia isso não bastar, o caminho é um hook do
Claude Code que barre o comando.

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
  44 ações do organizador (INICIAR_ETAPA, AVANCAR_RODADA, PROCESSAR_RODADA,
  APLICAR_WO, NOVA_TEMPORADA, financeiro, papéis) saem de um `switch (acao)`.
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
  o que o `CHANGELOG.md` diz.
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
- **A bateria cobre o motor, não o app.** `npm run teste` protege as regras da
  competição no `admin-action`. O `src/App.jsx`, o `athlete-action` e o
  `login-atleta` ainda não têm asserção nenhuma — ali o único portão continua
  sendo "compila?".

## Convenções

- **Tudo em português do Brasil**: nomes de função, comentários, mensagens de
  tela. As ações do motor são MAIÚSCULAS com underscore (`PROCESSAR_RODADA`).
- **Comentários explicam a regra, não o código** — por que a CBTM ou o
  regulamento exige aquilo, com a versão do regulamento quando houver. O padrão
  do `admin-action` é bom: cada guarda diz o que ela está impedindo.
- **Um só arquivo.** O `App.jsx` não se divide em módulos.
- **O motor é o servidor.** Regra de competição se decide na Edge Function; o
  front só reflete. Não recalcule rating nem pontuação no `App.jsx`.
- **Mudança destrutiva pede confirmação-com-nome** (digitar o nome do circuito),
  padrão já adotado nas ações que apagam.

## Git

Trabalho direto na `main` — é o fluxo dele, e o `atualizar.sh` empurra a main
para o GitHub. As mensagens de commit hoje são automáticas
(`atualização 07/09/2026 00:03`): elas não dizem o que mudou, então o
`CHANGELOG.md` é que carrega essa memória — mantenha-o.

Commits pedem autorização.
