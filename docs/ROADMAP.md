# Roadmap — a fonte de verdade sobre o que fazer a seguir

Estado: **07/09/2026**. Este arquivo manda. Se outro documento discordar dele,
este está certo — ou este precisa ser corrigido. Consulte antes de propor
qualquer coisa, inclusive a seção **Fora do escopo** no fim, que registra o que
já foi decidido *não* fazer, e por quê.

Os planos das fases já concluídas estão em `historico/`, com o motivo de terem
saído de cena. Eles continuam valendo como registro de *por que* cada decisão
foi tomada.

## Onde estamos

O multi-circuito **está funcional de ponta a ponta no código** — criar circuito,
inscrever, parear, processar rodada, virar temporada, organizador com login
próprio, atleta em mais de um circuito. Mas **nenhum segundo circuito real
rodou ainda**: existe 1 circuito no banco (o BH), com 15 atletas.

Pronto tecnicamente, não validado em campo. Essa distinção importa em tudo que
for comunicado como pronto.

---

## Onda 0 — Dívidas que ninguém escolheu contrair

Não estavam em plano nenhum; apareceram ao mapear o banco e o repositório em
07/09/2026. Nenhuma é urgente hoje; todas cobram juros.

- **0.1 — A bateria cobre o motor e começou a cobrir o front.** São **154
  asserções** (`npm run teste`), ligadas ao `atualizar.sh`. O `src/App.jsx` saiu
  do zero: `pacote.mjs` (11) e `erros-na-tela.mjs` (12) leem o fonte e travam
  decisões. Falta cobrir: o resto do front, o `athlete-action`, o
  `login-atleta`, o pareamento (`INICIAR_ETAPA`/`AVANCAR_RODADA`), os desempates
  do ranking e o financeiro. O carregador já serve para todas — faltam as
  asserções. Ver `testes/README.md`.
- **0.2 — O Instagram não tem dono.** `instagram_config` guarda credenciais da
  Meta, `instagram_publicacoes` tem 42 publicações registradas, e nada disso
  aparece em plano, roadmap ou changelog. O token da Meta **expira a cada ~60
  dias** e nada avisa quando. Decidir: documentar e manter, ou desligar.
- **0.3 — Tabelas de tentativa só crescem.** `tentativas_login_admin` passou de
  mil linhas; `tentativas_busca_telefone` e `tentativas_busca_cpf` também não
  têm limpeza. Falta uma rotina que apague registro velho.
- **0.4 — `partidas_historico` sem chave primária.** Nada impede a mesma partida
  ser arquivada duas vezes numa virada de temporada repetida.
- **0.5 — Os mandatos dos agentes estão em dois lugares.** `.claude/agents/` (o
  que o Claude lê) e `docs/agente-*.md` (cópia). Vão divergir. Decidir quem é a
  cópia oficial e deixar só um.
- **0.6 — RPC `arquivar_partidas_temporada` virou código morto** depois que a
  virada passou a usar a versão escopada por circuito. Restringir ou remover.

## Onda 0.5 — O que os guardiões abriram em 07-08/09/2026

Tudo isto saiu de revisões supervisionadas destes dois dias, não de suposição.
Cada item diz o que é, por que importa e quando morde.

- **0.5.1 — As decisões de permissão do organizador não estão no ar.** ⬅️ *a mais séria*
  Em 07/09 o Juliano decidiu, item a item, tirar do organizador: `EXCLUIR_ATLETA`,
  `ABRIR_PROXIMA_TEMPORADA`, `CANCELAR_PROXIMA` e `DEFINIR_RODADAS`; e criar o
  portão `org_ve_financeiro` (padrão desligado) para as ações de dinheiro. Isso
  está no repositório e **não foi publicado** — a produção ainda concede tudo
  aquilo. Hoje é inofensivo: **zero organizadores cadastrados**. Vira falha de
  autorização no minuto em que existir o primeiro. **Publicar antes de nomear
  qualquer organizador.** Achado do Supervisor de Segurança.

- **0.5.2 — A conferência de senha devolve telefones.** O login do admin confere
  a senha chamando `LISTAR_ORGANIZADORES`, que devolve `nome` e `telefone` dos
  organizadores. Hoje volta vazio (zero organizadores). Criar uma ação
  `VERIFICAR_PIN` que só responde sim ou não. Cuidado de ordem: a função tem de
  subir **antes** do app que a chama.

- **0.5.3 — Teto de 200 mensagens.** `LISTAR_MENSAGENS` lê no máximo 200 linhas;
  só agosto gravou 165. Quando o teto estourar, mensagem antiga sai da janela e
  **volta a aparecer como pendente** — o sintoma de 08/09, por outra causa.
  Subir o limite ou escopar a leitura por mês.

- **0.5.4 — O token do atleta sobrevive ao logout.** `clearAtletaCred()` e
  `revogarSessaoAtleta()` existem em `src/App.jsx` e **nunca são chamadas**: ao
  sair, o token continua no aparelho e válido no servidor por 90 dias.

- **0.5.5 — Qualquer pessoa na internet pode trancar o painel.** O freio do PIN
  de admin conta falhas **globalmente**: 5 tentativas erradas de qualquer origem
  bloqueiam o painel por 15 minutos, inclusive para o Juliano. Avaliar contagem
  por origem. Aconteceu de verdade em 08/09.

- **0.5.6 — Falta `Vary: Origin`** nas respostas das Edge Functions. Sem ele, um
  cache intermediário pode servir a uma origem a resposta dada a outra. Risco
  baixo hoje (sem CDN na frente), uma linha para resolver.

- **0.5.7 — Decidir o destino do `localhost` na lista de origens.** Ou tentar o
  proxy do Vite (que exigiria tirar a URL fixa do `src/App.jsx:104`) e remover as
  linhas, ou registrar que ficam e por quê. Condição levantada e não cumprida.

- **0.5.8 — A bateria não testa o arquivo que vai ao ar.** `carregarFuncao` lê
  sempre `supabase/functions/<nome>/index.ts`. Enquanto o repositório estiver à
  frente da produção, o deploy é montado à mão e testá-lo exige trocar arquivos
  de lugar. Fazer `carregarFuncao` aceitar um caminho.

- **0.5.9 — Reconciliar a fila ao voltar do WhatsApp.** O `keepalive` faz o
  pedido chegar, mas não garante que a resposta seja processada — no iPhone a
  aba pode ser descartada. A prova real seria recarregar `mensagens_enviadas` do
  servidor quando a página volta a ficar visível. A verdade passaria a vir do
  banco, não da promessa.

## Onda 0.6 — Antes de nomear o primeiro organizador ⛔

O Juliano pretende nomear o primeiro organizador **em dias** (08/09/2026). A
rodada completa dos 6 guardiões, nesse mesmo dia, deu **NO-GO** para isso — não
para o código, que já foi ao ar na v58, mas para o ato de nomear. A lista abaixo
é o que falta, em ordem de quem trava o quê.

**Nada aqui é urgente enquanto o número de organizadores for zero.** Vira falha
real no minuto em que deixar de ser. Conferido no banco em 27/09/2026:
`circuito_organizadores` = **0 linhas**, `circuitos` = **1** (só o BH).

**O ⛔ continua depois da fatia de 27/09/2026** — e o porquê precisa ficar escrito,
senão a próxima leitura vê cinco ✅ e conclui que dá para nomear. Aquela fatia
tirou do caminho o que impedia o organizador de **trabalhar**; não tirou o que
impede **nomear**. Seguem de pé: **0.6.6** (com a cobrança ligada, o atleta pago
fica fora do pareamento), **0.6.7** (base jurídica — pede advogado, não código),
**0.6.8** (PIX e desconto passam com o financeiro bloqueado), **0.6.5**, **0.6.9**,
**0.6.10**, **0.6.11**, **0.6.12**, e o gatilho paralelo "antes de nomear o 1º
organizador" da Onda 0.10.

**E dois travões NOVOS, nascidos na própria fatia de 27/09** — por isso ela fechou
5 itens e o ⛔ ficou mais longe, não mais perto: **0.6.17** (o escopo do comprovante
de W.O. é derrotável; o código já está em produção na v3, inalcançável só porque
não existe organizador) e **0.6.18** (`writeAtleta` respondendo sucesso com a
escrita falhada). É honesto dizer que a Onda 0.6 fechou 6 itens e abriu 6.

### Trava o organizador de trabalhar

- **0.6.1 — ✅ RESOLVIDO em 08/09/2026.** O app não mostrava os erros do
  servidor. `dispatchAndSync` grava a
  mensagem de erro sem ligar o estado que a barra de aviso lê, e o `dispatch`
  otimista já mudou a tela antes. Efeito: o organizador clica em excluir um
  atleta, o atleta some da lista, o servidor recusa com 403 e **nada aparece**.
  Ele acredita que excluiu. É uma linha de conserto, e enquanto ela não existir
  toda a proteção da v58 é invisível para quem esbarra nela. *(Experiência do Admin)*
- **0.6.2 — ✅ RESOLVIDO em 27/09/2026 *(no ar: `admin-action` v62, `comprovante-url` v3)*.** Duas metades: (a) `LISTAR_TELEFONES`
  entrou na `ACOES_ORG` **escopada por circuito** (lê os membros em
  `circuito_atletas` e filtra), com o ramo do BH byte-idêntico ao anterior;
  (b) o erro deixou de morrer no `console.warn` — agora usa a barra de aviso do
  admin, com texto próprio ("não deu para carregar os telefones"), e não repete o
  aviso a cada troca de aba. 9 asserções em `testes/permissoes.mjs`, uma delas
  travando que a ação devolve **só `id` e `telefone`** (nunca `pin_hash`).
  *Era:* A tela de inscrições nunca carrega. O organizador não pode ler
  telefones, então todo telefone fica em "carregando…" para sempre, sem
  mensagem, e o botão de WhatsApp fica morto. Cuidado ao corrigir:
  `LISTAR_TELEFONES` hoje devolve o telefone de **todos** os atletas da
  plataforma, sem filtro de circuito — precisa de uma versão escopada primeiro.
- **0.6.3 — ✅ RESOLVIDO em 27/09/2026 *(no ar: `admin-action` v62, `comprovante-url` v3)*.** Ação `DESARQUIVAR_ATLETA` no motor, na
  allowlist e no `ORG_MEMBRO_FIELD`. Devolve o atleta ao **backlog** (`status`
  "ativo" + `pendente_circuito` true), não para dentro do circuito: entrar numa
  rodada já pareada é `INCLUIR_NO_CIRCUITO`, e só o caminho do backlog respeita o
  corte do último terço (Cap. 11) e o teto de 20. Recusa quem pediu exclusão de
  dados e quem já foi anonimizado. 18 asserções, incluindo a de ponta a ponta
  (desarquivar → `INICIAR_ETAPA` → o atleta recebe chave e é pareado) e a do
  caminho do BH.
  **Lição registrada:** a primeira versão gravava a string `"ativo_backlog"`, que
  é **rótulo do `<select>` da tela** e não existe no banco. Nenhuma lista casava,
  o `promoverBacklog` nunca o promovia e, no BH, o atleta **perdia o login**. As
  asserções iniciais exigiam justamente a string errada — carimbavam o defeito.
  Pego pelos guardiões antes de subir.
  *Era:* Arquivar é porta de mão única. Ele arquiva um atleta e não
  consegue desarquivar: o botão "Reativar" chama `EDITAR_ATLETA`, que ele não
  tem. Falta uma ação `DESARQUIVAR_ATLETA`.
- **0.6.4 — ✅ RESOLVIDO em 27/09/2026 *(no ar: `admin-action` v62, `comprovante-url` v3)*.** `comprovante-url` passou a aceitar
  telefone+PIN de organizador, com escopo por recurso: só assina comprovante
  cujo `solicitacoes_wo.circuito_id` é o circuito dele, e a autorização corre
  **antes** do storage. 16 asserções rodando a função de verdade, incluindo as
  que provam que **nada é assinado** quando recusa.
  *Era:* Ele decide W.O. sem ver a prova. Abrir o comprovante do W.O.
  justificado exige o PIN do super-admin.
- **0.6.5 — A janela de pré-inscrição.** Perder `ABRIR_PROXIMA_TEMPORADA` não
  tira dele a virada de temporada (essa nunca foi dele) — tira a capacidade de
  **vender a temporada seguinte enquanto joga a atual**, 3 vezes por ano, com
  prazo colado (a renovação prioritária fecha 7 dias antes do início — ⚠️ **esta frase reproduz
  a inversão do item 0.6.15**: pelo Cap. 13 a janela **abre** em `início−7` e as
  vagas só abrem a partir do início). Enquanto
  a janela estiver fechada, **o card "Quero renovar" não existe no app do
  atleta**. Pior: se a temporada virar sem essa janela ter sido aberta, todos os
  atletas viram como **não-pagos**. Desenho proposto: devolver a ação com filtro
  **por campo** — calendário livre, valores e chave PIX só com o portão ligado.

- **0.6.15 — ✅ RESOLVIDO em 28/09/2026 (no fonte).** *A janela dos 7 dias estava
  invertida, e isso atingia o atleta todo dia.* Decisão do Juliano: *"arrumar esses dois
  pontos"*.
  **A causa de fundo eram TRÊS contas separadas** — o card do admin, a mensagem de
  renovação e o lembrete —, e eram três justamente porque nada as obrigava a concordar.
  Agora é **uma** função, `janelaRenovacao()`, com a constante `DIAS_PRIORIDADE_RENOVACAO`
  num lugar só. A janela **abre** em `início − 7` e **fecha no início**; as vagas só
  abrem depois disso, como o Cap. 13 manda.
  O que mudou na prática: o card deixou de dizer "prazo encerrado" no dia em que a
  prioridade **começa**; a mensagem de renovação deixou de mandar *"confirme até
  {início−7}"* e passou a dizer *"ela vale até {início}"*; e o lembrete
  "dos últimos 3 dias", que disparava entre `início−10` e `início−7` — **antes de a
  janela abrir** —, passou a disparar nos 3 dias antes do fim.
  **29 asserções, e são de um tipo que o projeto não tinha:** `App.jsx` não é executado
  por teste nenhum, mas `janelaRenovacao` é função **pura**, então ela é extraída do
  fonte e **executada** com datas reais. Conta de data só se protege assim.
  **8 mutações, 8 vermelhas** — cada uma reintroduz uma metade do defeito original.
  **A revisão das 8 duplas (28/09) achou a meia-correção que sobrou:** a conta estava
  certa e a **frase em volta dela** continuava apontando para o modelo velho — o card
  glosava a data do início como "(7 dias antes do início)", e o ternário de dois
  galhos anunciava "Janela aberta" durante as semanas **antes** de ela abrir. Cinco das
  oito duplas pegaram a mesma linha. Corrigido: o card mostra o **intervalo** e ramifica
  nos três estados que a função já calculava (`jaAbriu`, `aberta`, `encerrada`), que até
  então eram testados e **não consumidos**.
  *Descrição original, mantida como registro:*
  ⬅️ *achado de 27/09/2026, na revisão do 0.6.11* — **decisão do Juliano, não minha.**
  O Cap. 13 (v03-12 §prioridade de renovação, idem v03-13, e é o texto que o
  atleta lê na tela) diz: *"nos 7 dias anteriores ao início, os atletas do
  circuito atual têm prioridade para renovar"* e *"após o prazo de prioridade, as
  vagas não confirmadas abrem para a fila de espera"*. Logo a janela **vai de**
  `início−7` **até** `início`, e as vagas abrem **a partir do início**.
  O app trata `início−7` como o **fim** do prazo, em quatro lugares — o card de
  renovação do admin, a mensagem `renovacao` ("confirme até {início−7}"), o
  `lembrete_renovacao` (cujo "empurrão nos últimos 3 dias" cai **antes** de a
  janela abrir) e o cálculo do botão de liberar vagas. **Efeito prático: o atleta
  recebe 0 dos 7 dias de prioridade que o regulamento promete.**
  **Tamanho certo do problema, para decidir com ele na mão** (precisado pelo
  Guardião do Regulamento em 27/09/2026): hoje **nenhuma vaga é tirada errado**. A
  ação que tirava saiu do motor, e na virada de temporada a vaga é decidida pelo
  **pagamento** — que é exatamente o que o Cap. 13 manda. O que está errado hoje é
  o **prazo que o atleta lê**, em quatro lugares. É erro de informação, não de vaga
  nem de dinheiro. Continua sendo o único prazo do app que *virá* a custar a vaga
  dele, e por isso tem de ser resolvido antes de a ação voltar.
  E o app se contradiz na mesma tela: um texto diz *"a janela abre 7 dias antes"*
  e o outro trata a mesma data como encerramento. Um dos dois está errado.
  Dois caminhos: (a) corrigir o app nos quatro pontos (a leitura do regulamento
  é a que vale), ou (b) mudar o Cap. 13 nas duas versões **com aviso prévio e
  re-aceite** — que é a máquina que a Onda 0.10.15 construiu. Não dá para deixar
  como está: é o único prazo do app que custa a vaga do atleta.

- **0.6.21 — ✅ RESOLVIDO em 27/09/2026, NO AR** (`login-atleta` v10, bundle `index-xuSt1ncM.js`).** *"Participar de outro
  circuito" gravava aceite de um regulamento que o atleta nunca viu.*
  Achado pelo Juliano em 27/09/2026, testando a inscrição, ao perguntar: *"como vou
  saber se é o regulamento correto?"*. O fluxo tinha três telas — identificação,
  CPF, pronto — e **nenhuma mencionava regulamento**; o `login-atleta` gravava
  `aceite_regulamento: true` com a versão certa do circuito. Recibo de
  consentimento apontando para um texto que o atleta nunca abriu. E a rede do
  re-aceite **não pegava**, porque a versão gravada já era a do circuito: não havia
  divergência para o app detectar.
  Ficou urgente com a **decisão do Juliano de criar o 2º circuito por PONTOS**
  (caminho 1 da 0.6.22): um atleta vindo do BH (rating) entraria "aceitando" um
  regulamento com pontuação, pareamento e encerramento diferentes.
  **Conserto:** a tela mostra o regulamento do circuito ALVO, com o sistema dele,
  e exige o aceite antes do PIN; o servidor passou a exigir que o atleta
  **declare** qual versão aceitou e compara com a do circuito (molde do
  `ACEITAR_REGULAMENTO`), recusando divergência. **De carona, a brecha do menor de
  idade:** o responsável legal era exigido só pela tela — o servidor aceitava um
  menor sem responsável se o pedido viesse sem os campos. Agora é o servidor que
  exige.
  **38 asserções rodando o `login-atleta` de verdade** — é a primeira vez que essa
  função é executada pela bateria — mais 6 checagens de fonte na tela. 8 testes de
  mutação, 8 vermelhos.

- **0.6.23 — ✅ RESOLVIDO em 27/09/2026, NO AR** (bundle `index-CBpXC3qt.js`).** *O `vB-01` mentia em dois pontos
  e calava em três.* **Decisão do Juliano, 27/09/2026:** *"já está definido que são 3
  meses por temporada e dois jogos por mês, ajustar tudo o que fala diferente"* — e
  ajustar o regulamento.
  **Deu para corrigir NO LUGAR, sem trocar de versão e sem re-aceite,** porque o banco
  mostra **zero** atletas com `vB-01` e **zero** circuitos de sistema B: não havia texto
  assinado sendo reescrito. Se houvesse, o caminho seria outro — carimbar uma versão
  nova e colher re-aceite, que é a máquina da Onda 0.10.15.
  **As duas falsas, corrigidas:** (a) "o número de etapas é configurável por circuito"
  virou *"3 meses e 2 jogos por mês — 6 rodadas em 3 etapas; esse número é fixo"*, que
  é o que o motor faz; (b) o 6º critério de desempate deixou de prometer um "sorteio
  registrado pelo admin" que não existe e passa a apontar para o **Cap. 13 (casos
  omissos)**, com o Cap. 13 explicando o empate absoluto e prometendo o critério
  **informado aos envolvidos**.
  **Os três silêncios, escritos:** teto de 20 com fila de espera (e o aviso de que
  *aprovação não é vaga garantida*), sem entrada nas duas últimas rodadas, e mínimo de
  8 para a temporada começar.
  **12 asserções novas** em `testes/regulamento-por-circuito.mjs` travando as duas
  frases que não podem voltar e as cinco que passaram a existir, mais a que confere que
  o motor realmente fixa 6. 3 mutações, 3 vermelhas.
  *Descrição original, mantida como registro:* Achado do Guardião do Regulamento em 27/09/2026, ao
  revisar o 0.6.21. Ele leu o texto inteiro, não só os títulos: **a matemática está
  certa** (pontuação, pareamento por sorteio ou grupos, bye rotativo, W.O., os cinco
  primeiros desempates — tudo confere com o motor). O que falta é a camada
  administrativa. **Fechar antes de `inscricoes_abertas = true` no circuito novo** —
  não antes de criá-lo: ele pode existir fechado enquanto o texto é escrito.

  **Duas afirmações FALSAS — o texto promete o que o motor recusa. Piores que silêncio:**
  1. Cap. 12: *"O número de etapas da temporada é **configurável por circuito**."* O
     motor fixa 6 rodadas e o `DEFINIR_RODADAS` recusa de saída. A mesma promessa
     falsa está em `docs/REGULAMENTOS_NOVOS_CIRCUITOS.md` e precisa cair junto.
  2. Cap. 09, 6º critério de desempate: *"**Sorteio registrado pelo admin**"*. O motor
     ordena por UUID (`localeCompare`). Não há sorteio, não há registro, e nada
     aparece na tela. Precisa de empate quíntuplo para bater — raro, não impossível
     num circuito pequeno.

  **Três omissões que o motor aplica CONTRA o atleta:** teto de 20 e fila de espera
  (ser aprovado e **não entrar**); corte do último terço (entrar tarde e esperar a
  virada); mínimo de 8 para abrir (a temporada não começar).

  Ou se corrige o texto, ou se corrige o motor — mas as duas falsas não podem
  sobreviver ao primeiro atleta que aceitar o `vB-01`.

- **0.6.27 — ✅ RESOLVIDO em 27/09/2026, NO AR.** *Dois silêncios que sobraram no
  `vB-01`, e o primeiro era o que mais provavelmente morderia num circuito pago.*
  **Decisão do Juliano: "resolver as duas coisas pendentes".**
  1. **Pagamento como pré-requisito de pareamento, escrito no Cap. 11:** *"O pagamento é
     confirmado pelo administrador. Enquanto não confirmado, o atleta não é incluído nos
     confrontos da rodada — nem na entrada, nem nas rodadas seguintes."* Espelha a frase
     que o regulamento de rating já tinha. **E a primeira frase do Cap. 10 foi
     corrigida**: dizia *"após a aprovação do administrador, passa a ser pareado"*, o que
     implicava que aprovação basta; agora diz que o aprovado *"entra na fila para ser
     pareado"*.
  2. **A temporada continua abaixo de 8, escrito no Cap. 10:** *"se, durante a temporada,
     o número de ativos cair abaixo de 8, a temporada continua normalmente com quem
     ficou: a queda não interrompe o circuito."*
  8 asserções novas, cada uma com a linha do motor que a sustenta
  (`exigePagamento) q = q.eq("pagamento_confirmado", true)`, as duas chamadas com
  `!!financeiro_ativo`, e o `São necessários ao menos 2 atletas ativos` do
  `AVANCAR_RODADA`). 3 mutações, 3 vermelhas.
  *Descrição original, mantida como registro:* Achados pelo Guardião do Regulamento em 27/09/2026, na revisão da
  própria correção — são o 4º e o 5º da mesma família, e o primeiro é o que mais
  provavelmente morde num circuito **vendido**:
  1. **Pagamento confirmado é pré-requisito para ser pareado**, e o `vB-01` não diz.
     `getAtivosNoCircuito(circuitoId, exigePagamento)` filtra `pagamento_confirmado`, e
     é chamado com `!!financeiro_ativo` no `INICIAR_ETAPA` e no `AVANCAR_RODADA`; o
     `promoverBacklog` filtra igual. O texto do Sistema A diz isso com letra (*"enquanto
     não confirmado, o atleta não é incluído nos confrontos"*); o de pontos, nada.
     **E é pior que silêncio neutro:** a primeira frase do Cap. 10 diz *"após a
     aprovação do administrador, passa a ser pareado nas rodadas"* — o que implica que
     aprovação basta, quando com o financeiro ligado falta o pagamento. Corrigir a
     frase junto.
  2. **A temporada CONTINUA se os ativos caírem abaixo de 8.** O `vB-01` só diz que o
     *início* é adiado; o `AVANCAR_RODADA` exige apenas 2 ativos. O texto do Sistema A
     já explica isso. É a pergunta que um atleta pagante de um circuito que esvazia faz
     na hora.

- **0.6.28 — Registros que não podem ser redescobertos.** Todos de 27/09/2026:
  1. **A promessa do "critério informado aos envolvidos"** (Cap. 13 do `vB-01`, empate
     absoluto) é **compromisso humano, sem mecanismo**: não existe ação no motor para
     registrar desempate manual, não há campo, e nenhuma tela avisa que houve empate
     nos cinco critérios — o administrador só sabe se notar. É coerente com o que
     "casos omissos" sempre foi aqui, mas **nada pode escrever que o app garante isso**.
     Melhoria barata quando alguém passar por ali: o painel sinalizar o empate.
  2. **O BH segue com a cláusula falsa das rodadas até carimbar a v03-13.** É assumido,
     não esquecido: a v03-12 está em vigor e foi aceita, e reescrevê-la apagaria a prova
     do que cada pessoa leu (regra 7 do `CLAUDE.md`). Fecha no carimbo, e o card de
     re-aceite alcança **todos os 15** aceites, porque o gatilho é divergência de
     versão, não uma versão específica.
  3. **O Sistema A é MENOS determinístico que o B no empate absoluto.** `cmpRankingDB`
     termina em `rating − rating`, que devolve 0 no empate total → a ordem fica a da
     consulta ao banco. É silêncio, não promessa falsa — mas quando o BH trocar de
     versão, o A merece herdar o mesmo apontamento para casos omissos que o B ganhou.
  4. **Quando o `vB-01` ganhar a prioridade de renovação (ver 0.6.15), os dois textos
     precisam aterrissar juntos.** Hoje o motor não aplica prazo nenhum
     (`LIBERAR_NAO_RENOVANTES` não existe), mas a tela e as mensagens já falam de prazo
     — inclusive para atleta de circuito B, cujo regulamento não menciona prioridade.

- **0.6.24 — ✅ RESOLVIDO em 28/09/2026 (no fonte).** *O `INSCREVER` não tinha guarda de
  menor de idade nenhuma.* Decisão do Juliano: *"arrumar esses dois pontos"*.
  A porta da frente passou a exigir, **no servidor**: data de nascimento obrigatória
  (fail-closed — idade que não dá para calcular é recusa), data absurda recusada, e nome
  **e** CPF do responsável para menor de 18. Mesmo desenho do `PARTICIPAR`, inclusive o
  comentário que proíbe reescrever `idade < 18` como `idade !== null && idade < 18`,
  que pareceria limpeza e transformaria idade desconhecida em liberação silenciosa.
  As três recusas entraram na lista de mensagens que o app mostra inteiras ao atleta,
  porque cada uma diz o que ele precisa fazer.
  **21 asserções rodando o `athlete-action` de verdade**, incluindo a fronteira dos 18
  (véspera e dia seguinte) e a prova de que a recusa **não grava nada** — nem o atleta,
  nem o documento. **6 mutações, 6 vermelhas.**
  **FECHA INTEIRO, e só depois da revisão das 8 duplas (28/09).** O Guardião Jurídico
  avisou que o item **não** podia ser marcado fechado enquanto a ressalva do
  `login-atleta` estivesse de pé — porque o próprio 0.6.24 amarrou a ressalva a ele
  (*"a ressalva morre quando o `INSCREVER` exigir a data"*). O gatilho disparou no mesmo
  commit e o texto tinha ficado. Agora morreu de verdade: `idadeArquivo === null` recusa
  com `cadastro_sem_data_nascimento`, e a recusa **nomeia o remédio** (falar com o
  organizador), porque aquela tela não tem campo para corrigir a data.
  **E o comentário que proibia a reescrita `idade !== null && idade < 18` não bastava.**
  O Guardião de Segurança aplicou a reescrita proibida e a bateria ficou **verde**: com
  a guarda de cima de pé, a linha nunca recebe nulo, e nenhuma asserção de comportamento
  consegue distinguir as duas formas. A regra passou a ser explícita
  (`idadeInsc === null || idadeInsc < 18`), com asserção de fonte impedindo a volta.
  **Comentário não é portão** — foi a lição da rodada.
  *Descrição original, mantida como registro:* Achado
  independente do Guardião Jurídico e do de Segurança em 27/09/2026, e os dois o
  classificaram acima do que eles mesmos vieram cobrar. A comparação é o que dói:
  **a porta de serviço ficou mais rígida que a porta da frente.**
  O `PARTICIPAR` (atleta existente entrando num 2º circuito) passou a exigir data de
  nascimento e, se menor, nome e CPF do responsável — pelo servidor. O `INSCREVER`,
  que é a **porta de entrada de todo atleta novo** e o **único caminho para o BH**,
  não tem nada: a única linha é `if (p.responsavelCpf)`, que valida o dígito **se o
  campo vier**. A trava é só a tela.
  E há um efeito de ordem que anula parte do conserto: o documento do atleta nasce no
  `INSCREVER`; quando ele depois chama o `PARTICIPAR`, a guarda nova lê a idade **do
  arquivo** — que o `INSCREVER` pode ter gravado nula. Hoje isso passa de propósito
  (recusar trancaria adulto de cadastro antigo), e a ressalva morre quando este item
  fechar. **PRAZO, e não é "algum dia"** (precisado pelo Guardião Jurídico): a ressalva do
  0.6.21 — documento com data nula passa — é inócua **hoje** porque
  `atleta_documento` tem 0 linhas, mas fica **viva na primeira inscrição nova em
  produção**, porque o CPF é obrigatório desde a Fatia 5 e todo `INSCREVER` novo cria
  documento. E o que vai gerar inscrições novas é justamente **o 2º circuito de
  pontos abrindo**. Logo: **fechar antes de o 2º circuito abrir inscrições.**
  Art. 14 da LGPD: dado de criança e adolescente pede consentimento específico e
  destacado de um dos pais. Amarrado ao **0.6.7** e ao **0.7.2**.

- **0.6.25 — O `login-atleta` tem seis ações sem asserção nenhuma.** A fatia 0.6.21
  fez a bateria executar essa função pela primeira vez, mas só no `PARTICIPAR`.
  Seguem descobertas: **`SESSAO`** (prioridade — é o caminho silencioso de todo
  atleta que reabre o app; uma quebra ali **desloga todo mundo** sem ninguém clicar
  em nada), **`LOGIN`**, **`PRECO`** (devolve preço: é dinheiro), `DEFINIR_PIN`,
  `LOGIN_ORGANIZADOR` e `LOGOUT_SESSAO`. Não é condição de nenhuma onda: a regra da
  casa é "regra **nova** nasce com asserção", não "toda regra antiga vira asserção
  nesta onda". *(Correção de escopo: o `RENOVAR` não é desta função — mora no
  `athlete-action`.)*

- **0.6.26 — `INSCRICAO_VALIDAR` escreve `rating_inicial` na tabela GLOBAL, mesmo em
  circuito de pontos.** Achado da Experiência do Admin em 27/09/2026. O guard do
  Sistema B no `writeAtleta` apaga `rating`, `rating_pico` e `rating_historico` da
  escrita de identidade — **mas não `rating_inicial`**, que também não está nas
  colunas sazonais. Então aprovar um atleta **federado** num circuito de **pontos**
  sobrescreve o `atletas.rating_inicial` dele, que é global e compartilhado com o BH.
  Alcance real, para não superdimensionar: `rating_inicial` não entra em conta de
  competição nenhuma — aparece no perfil e na exportação de dados do atleta. E o
  gatilho é estreito (circuito B + federado + entrando pela inscrição, não pelo
  `PARTICIPAR`). Mas é escrita de identidade cruzando circuito, que é exatamente o
  que a regra 2 do `CLAUDE.md` existe para impedir. Conserto: um
  `delete identidade.rating_inicial` junto dos outros três.
  **No mesmo lugar, e da mesma família:** num circuito de pontos, o painel do admin
  exibe e **ordena por** rating, e o gate "Rating obrigatório para federado" obriga o
  admin a digitar um número que o circuito nunca lê.

- **0.6.22 — Decisão tomada em 27/09/2026: o 2º circuito será de PONTOS, e será um
  circuito NOVO.** Não é o BH mudando de sistema.
  A pergunta do Juliano foi se o BH poderia virar pontos na próxima temporada. Não
  pode, hoje, e por dois motivos que valem ficar escritos:
  1. **O sistema do BH está cravado no motor**: `getSistema` faz
     `if (circuitoId === bh) return "A"` e nem lê a coluna `circuitos.sistema`.
  2. **Não existe ação para trocar o sistema** de circuito nenhum — ele é definido
     só no `CRIAR_CIRCUITO`.
  **E mudar a coluna na mão seria o pior cenário:** o app lê a coluna
  (`setSistemaAtivo`) e passaria a mostrar pontos — selo, desempates do ranking,
  regulamento `vB-01` — enquanto o motor continuaria calculando **rating**. Tela e
  motor discordando.
  O que o caminho 2 (o BH virar pontos) exigiria, se um dia for a decisão: ação
  nova para trocar o sistema, só entre temporadas e com confirmação-por-nome;
  tirar a linha cravada; um regulamento (o `vB-01` não descreve o BH — sem torneio
  de encerramento, entrada diferente) e re-aceite dos 14; e duas decisões de dado:
  **`saldo_temp` muda de significado** (no A acumula variação de rating; no B são
  pontos, 2/1) e **o rating congela** (no B o motor nunca escreve rating), com o
  histórico de posições das temporadas antigas calculado por outro critério. O
  pareamento também muda: rating por proximidade no A, sorteio ou grupos no B.

- **0.6.17 — O escopo por recurso do comprovante de W.O. é derrotável.** ⛔ *bloqueia
  nomear o primeiro organizador* — achado do Guardião de Segurança em 27/09/2026,
  na revisão do 0.6.4.
  O `comprovante-url` confere que o caminho pedido consta de um W.O. do circuito do
  organizador. Só que `comprovante_url` **é gravável por quem chama**: o
  `athlete-action`, no `SOLICITAR_WO`, copia o valor cru do payload, e esse caso
  **não exige token de sessão** (é a metade habilitante, já registrada no 0.7.1).
  Então o organizador planta um W.O. no circuito dele apontando para o caminho de
  **outro** circuito, e a conferência casa com a linha que ele mesmo plantou — e ele
  baixa a foto/print do W.O. alheio. As três peças, com as linhas: o `.eq`
  auto-referente em `comprovante-url` (busca por `comprovante_url`), o
  `comprovante_url: p.comprovanteUrl || null` do `athlete-action`, e o
  `SOLICITAR_WO` que só exige que o `athleteId` participe do `matchId`.
  **Inalcançável hoje:** `circuito_organizadores` = 0 linhas e **nenhum** dos 5 W.O.
  do banco tem comprovante. Passa a existir por um ato deliberado — nomear o
  primeiro organizador.
  **Conserto desenhado, e cabe inteiro dentro do `comprovante-url`** (não toca o
  caminho do atleta): validar no ramo do organizador o formato que o app gera —
  `wo-<matchId>-<timestamp>.jpg`, e os ids de partida em produção são
  `[A-Za-z0-9_]+`, sem hífen, então a extração é sem ambiguidade —, tirar o
  `matchId` do caminho e exigir que **a partida** seja deste circuito. É o mesmo
  escopo-por-partida que o `admin-action` já faz no `ORG_MATCH_FIELD`, e é prova que
  o atacante não controla. Não há comprovante legado para acomodar.
  **Asserção que precisa nascer com ele** (hoje ficaria vermelha): plantar em
  `solicitacoes_wo` uma linha do circuito do organizador apontando para o caminho de
  outro circuito, e exigir **403 com zero assinaturas**. Com teste de mutação.
  Amarrado ao **0.6.7** (base jurídica) e ao **0.7.1** (`athlete-action` sem token).

- **0.6.18 — `writeAtleta` responde "sucesso" quando a única escrita falhou.**
  Achado do Guardião de Confiabilidade em 27/09/2026. Em circuito **não-BH**,
  `status` e `pendente_circuito` são colunas sazonais, então `identidade` sai vazio
  e a única escrita é o `mirrorSazonal` — que é *best-effort* e **engole o erro**
  (só registra no console e segue). A ação responde `sucesso: true` e o atleta
  continua como estava. A decisão de best-effort vem da Fase 4B e tem justificativa
  no BH ("nunca quebrar a operação do BH"); **em circuito não-BH o espelho não é
  espelho, é o registro principal**, e ali o best-effort está errado.
  Vale para `ARQUIVAR_ATLETA`, `DESARQUIVAR_ATLETA`, `INCLUIR_NO_CIRCUITO`,
  `RECUSAR_CIRCUITO` e `DEFINIR_DESCONTO_ATLETA` — é classe, não caso.
  **Inalcançável hoje:** existe 1 circuito (o BH), e no ramo do BH o `writeAtleta`
  **lança** o erro de verdade. A tela também se autocorrige, porque roda
  `loadFromSupabase()` depois da ação — o admin vê "sucesso" e o atleta como antes:
  confuso, mas sem perda nem corrupção de dado.
  **Conserto:** `mirrorSazonal` propagar o erro quando `identidade` estiver vazio.
  Mexe no `writeAtleta`, usado por quase toda ação que escreve atleta → exige as
  **8 duplas completas**. Nenhuma asserção pega hoje: o upsert do banco falso nunca
  falha, então o conserto precisa nascer com `banco.recusar(...)`.

- **0.6.19 — Número de capítulo errado em toda tela de circuito não-BH.**
  Achado do Guardião do Regulamento em 27/09/2026. O `RegulamentoView` **renumera**
  os capítulos por versão (o `vA-nc-01` tira o capítulo do torneio e reindexa; o
  `vB-01` tem lista própria de 13), mas as telas de admin citam a numeração do BH,
  fixa. É off-by-one **sistemático**, não avulso:

  | regra | BH (v03-12/v03-13) | `vA-nc-01` e `vB-01` | o app cita |
  |---|---|---|---|
  | Como Participar (último terço, teto, fila) | Cap. 11 | **Cap. 10** | Cap. 11 |
  | Valor da Temporada | Cap. 12 | Cap. 11 | — |
  | Estrutura das Rodadas (mínimo 8, nº de rodadas) | Cap. 13 | **Cap. 12** | Cap. 13 |

  **Não é urgente porque nenhum atleta vê número errado** — o texto que ele aceita
  é internamente coerente; os números errados só aparecem em tela de admin, e
  apontam para regras que são verdadeiras nas três famílias. É ponteiro errado para
  regra certa.
  **O que vale promover ao topo deste item**, porque não é typo: o `IniciarEtapaPanel`
  diz *"os confrontos serão gerados por **proximidade de rating** … (Cap. 03)"*. O
  **número está certo** (Cap. 03 é Sistema de Pareamento nas duas famílias) e a
  **afirmação está errada**: em circuito Sistema B o pareamento é por sorteio ou
  grupos, nunca por rating. É declaração falsa sobre o que o motor vai fazer, no
  primeiro botão que um organizador novo aperta.

- **0.6.20 — `autenticarOrganizador` virou cópia em dois lugares.**
  Achado do Guardião Jurídico em 27/09/2026, ao revisar o 0.6.4. O `comprovante-url`
  recebeu uma cópia fiel de `autenticarOrganizador` + `_verifyPin` do
  `admin-action`. **O risco não é elegância:** as duas cópias implementam a trava de
  5 tentativas e o bloqueio de 15 minutos. Um conserto nessa trava numa não chega na
  outra, e o sintoma seria silencioso — a função "esquecida" continuaria aceitando
  tentativas. Cópia fiel hoje, conferida linha a linha; o risco é o tempo.
  Fica junto do **0.7.1**, que é da mesma família (código de autenticação).
  As duas também leem a tabela `atletas` inteira, **sem limite**, para achar um
  atleta por telefone — o hash de PIN de todo mundo em memória a cada tentativa. E
  o 429 do bloqueio é um oráculo de "este telefone está cadastrado", que também
  permite travar o PIN de qualquer atleta por 15 minutos. Pré-existente; agora em
  dois endpoints.

- **0.6.16 — O atleta em backlog não sabe que está em backlog.**
  Achado de 27/09/2026. Quem está `ativo` + `pendente_circuito` (aprovado
  aguardando vaga — o estado em que o desarquivado cai, e em que a inscrição
  aprovada já caía antes desta fatia) vê a POSIÇÃO virar "—" no card, sem o selo
  de classificação, **mas com pontos e rating ainda na tela**. Fica com cara de
  defeito, não de decisão, e não existe uma linha explicando. Não há categoria de
  mensagem para o evento. Pré-existente, não criado pela 0.6.3 — mas a 0.6.3 cria
  um caminho novo para esse estado. O projeto já decidiu duas vezes contra si
  mesmo nesse ponto ("a garantia que tranquiliza estava SÓ no WhatsApp").

### Trava o atleta

- **0.6.6 — Com a cobrança ligada, o atleta pago fica fora do pareamento.** Só o
  super-admin confirma pagamento quando o portão está fechado, e o pareamento é
  fotografado no início da rodada: quem não estava confirmado naquele instante
  **perde a rodada inteira**. E os textos apontam para o lado errado — o card do
  atleta manda "combinar com o admin" e o botão do organizador diz "registre o
  pagamento antes de incluir", que é justamente o que ele não pode. *(Atleta)*

### Trava juridicamente

- **0.6.7 — Não há base formal para um terceiro tratar esses dados.**
  `TERMOS_ORGANIZADOR.md` é minuta declarada, com prazos em branco, **sem
  revisão de advogado**; `NOMEAR_ORGANIZADOR` grava três campos e **nenhum
  aceite** (o atleta tem aceite versionado com data — o organizador não tem
  nada); e o acervo dá **três respostas diferentes** sobre quem é o controlador.
  Isso precisa de advogado, não de código. *(Jurídico)*

  **A fatia de 27/09/2026 AUMENTOU a superfície que este item não cobre**, e é
  preciso dizer com letra: o organizador passou a poder ler o **telefone** dos
  atletas do circuito dele e a abrir o **comprovante de W.O.** (foto do local,
  print de conversa entre dois atletas — dado pessoal de quem nem pediu nada).
  Inerte hoje, porque não existe organizador. Mas some-se que o organizador é
  obrigatoriamente **um atleta ativo do mesmo circuito** (`NOMEAR_ORGANIZADOR`
  recusa quem não está ativo): quem abre a prova que decide pontuação é um
  competidor do mesmo ranking. Três coisas concretas que o Guardião Jurídico
  levantou e que são **decisão do Juliano**:
  1. A tela que colhe o consentimento diz *"seus dados não são vendidos nem
     compartilhados com terceiros"*, sem ressalva, e é o **único** texto que o
     atleta vê — a `docs/POLITICA_PRIVACIDADE.md` (que prevê o compartilhamento
     com o organizador) **não está linkada em lugar nenhum do app**. No dia em que
     existir um organizador, essa frase fica falsa. Corrigi-la mexe no texto do
     aceite, então provavelmente pede versão nova e re-aceite.
  2. A política não lista o **comprovante de W.O.** entre os dados tratados.
  3. `NOMEAR_ORGANIZADOR` grava três campos e **nenhum aceite versionado** — o
     atleta tem aceite com data e versão; o organizador, que vai tratar o dado de
     dezenas, não tem nada. Recomendação do guardião: a ação **recusar** enquanto
     não gravar, para o portão ser o servidor e não a memória de alguém.
  E o modal "Não vou conseguir jogar" diz que *"o **admin** vai analisar"* — o
  atleta precisa saber, **antes de anexar a foto**, que quem vai abrir é o
  organizador.

### Fresta no portão do dinheiro

- **0.6.8 — Duas ações escapam do portão.** `DEFINIR_CONFIG_CIRCUITO` permite
  reescrever a **chave PIX** — o destino do dinheiro do atleta — e
  `DEFINIR_DESCONTO_ATLETA` grava `desconto_pct` e `isento`. As duas passam com
  o financeiro bloqueado. Hoje a tela não oferece o campo do PIX, mas o portão é
  o servidor, não a tela. *(Segurança)*

### Pequenos, e baratos

- **0.6.9 —** `veFinanceiro` é uma foto do login guardada na sessão: ligar o
  portão não tem efeito até o organizador sair e entrar de novo.
- **0.6.10 —** A aba de pagamentos some sem explicação. O texto que explica
  existe só na tela do super-admin. Para um cliente pagante, aba ausente sem
  aviso lê como defeito.
- **0.6.11 —** `LIBERAR_NAO_RENOVANTES` é despachado pelo app e **não existe no
  servidor** — cai em "Ação desconhecida". Pré-existente. **CONTINUA ABERTO.**
  Foi implementado e depois **retirado** em 27/09/2026, antes de subir, porque a
  revisão desenterrou que a regra do prazo está invertida (item 0.6.15) e que a
  tela e o motor não concordam. Implementar antes de decidir a regra seria
  carimbar a regra errada em cima de vaga vendida — e no BH, com `writeAtleta`
  escrevendo na tabela global, **12 de 12 atletas ativos** estavam no alvo do
  filtro, num clique, sem desfazer. O que precisa vir junto quando voltar:
  (a) ~~a decisão do 0.6.15~~ — **RESOLVIDA em 28/09/2026**: a janela vai de
  `início−7` até o início, e `prazoPassou` passou a significar "a janela fechou";
  (b) gate do BH ou asserção provando o caminho do BH;
  (c) confirmação-com-nome na tela (é escrita destrutiva em massa);
  (d) o retorno dizendo quantas vagas saíram, e quantas falharam — o laço não tem
  transação; (e) gate na tela igual ao do motor: a condição de habilitar é
  `prazoPassou` **E** `state.proximaAberta`, porque o painel também renderiza com
  `phase === "inscricoes"` e `proximaAberta === false`, estado em que o motor recusa
  com 409 e o botão acenderia à toa *(precisado pelo Guardião do Regulamento e pelo
  de Admin, 28/09)*; (f) um único cálculo de prazo, num único fuso — e a
  recomendação concreta, que é melhor que "usar hora local no motor": **a regra tem
  granularidade de DIA, não de instante.** O Cap. 13 fala de um prazo que é uma
  **data**. Então o motor deve **comparar datas, não instantes** — derivar `hoje` no
  fuso do circuito e comparar `AAAA-MM-DD` com `proxima_data_inicio` como string.
  Isso elimina a costura de 3h **por construção**, em vez de tentar alinhar dois
  relógios que nunca vão bater. *(Guardião do Regulamento, 28/09/2026.)*
  **(g) — novo, 28/09:** a janela do **lembrete** deveria ser **7 dias, não 3**, para
  o primeiro aviso coincidir com a **abertura** da prioridade e não com a véspera de
  perdê-la — e porque o que garante a vaga é o admin registrar o pagamento, um passo
  que não depende do atleta. Três dias atravessando um fim de semana é apertado.
  *(Experiência do Atleta.)*
  **(h) — novo, 28/09:** decidir se este card deve aparecer quando **não** há próxima
  temporada aberta. Ele renderiza em dois modos, e no modo `phase === "inscricoes" &&
  !proximaAberta` ele calcula a janela sobre a temporada **corrente** (cuja renovação
  já passou) enquanto as duas mensagens devolvem `[]` — ninguém está sendo avisado de
  nada. A leitura do Guardião de Admin, que eu subscrevo: o card só faz sentido com
  `proximaAberta`. *(Experiência do Admin.)*
  **E continua aberto, do 0.6.16:** não há aviso nenhum quando o atleta **perde** a
  vaga. Hoje o único texto que menciona a consequência é o lembrete — enviado
  **antes** do fato. Depois do fato, silêncio. Quando o 0.6.11 voltar, esse par
  precisa nascer junto.
- **0.6.12 —** Ovo e galinha: `NOMEAR_ORGANIZADOR` exige um atleta ativo, e
  circuito novo nasce vazio. A ordem obrigatória (abrir inscrições → o futuro
  organizador se inscreve → aprovar → nomear) não está escrita em lugar nenhum.
- **0.6.13 — ✅ RESOLVIDO em 27/09/2026 *(no ar: `admin-action` v62, `comprovante-url` v3)*.** `LER_COBRANCA_PLATAFORMA` recusa o BH
  com 400, como a irmã que escreve. Inerte na tela (o card já é escondido para o
  BH): é defesa em profundidade. 2 asserções.
- **0.6.14 — ✅ RESOLVIDO em 27/09/2026 *(no ar: `admin-action` v62, `comprovante-url` v3)*.** `CobrancaPlataformaCard` desempacotava
  a resposta duas vezes e mostrava tudo em branco mesmo com configuração salva.
  **Sem asserção** — é front, e nenhum teste executa `src/App.jsx`.
  Consertar isto **acendeu** três coisas que ficavam escondidas atrás dos campos
  vazios, e as três foram corrigidas na mesma fatia: o card guardava a
  configuração do circuito ANTERIOR ao trocar de circuito (e "Salvar" gravaria no
  novo) — resolvido com `key={circuitoSelId}`; os valores reabriam com ponto
  decimal ("49.9") num campo de real; e o negativo saía "R$ -50,00" em vez de
  "-R$ 50,00".

## Onda 0.7 — O que a revisão da 0.6.1 desenterrou (08/09/2026)

Nada disto foi criado pela 0.6.1. Apareceu porque seis duplas de guardiões foram
olhar o fluxo de erro de ponta a ponta, e **está tudo em produção hoje**. A
0.6.1 subiu sem esperar por estes itens — decisão do Juliano em 08/09, caminho
"subir o conserto e separar o resto": segurá-la não consertava nenhum deles.

### Autenticação — o mais sério

- **0.7.1 — O `athlete-action` não autentica ninguém.** Não há token de sessão
  nem PIN: o `athleteId` vem do corpo da requisição, e a chave que o app manda
  está no pacote que todo visitante baixa. Vale para **todas** as ações do
  atleta — `ENVIAR_PLACAR`, `SOLICITAR_WO`, `RENOVAR`, `ATUALIZAR_PERFIL` —, não
  só a exclusão. Onde dói mais: qualquer pessoa pode marcar **qualquer** atleta
  como tendo pedido exclusão de dados, e o admin não tem como distinguir pedido
  legítimo de forjado antes de executar uma anonimização **irreversível**.
  Vetores: assédio (marcar um rival) e indução do controlador ao erro.
  A peça já existe — o `login-atleta` emite token de sessão e o `circuito-dados`
  já sabe consumi-lo (`body.sessionToken`); o `athlete-action` é que não exige.
  *(Guardião Jurídico, confirmado pelo supervisor.)*

### Exclusão de dados (LGPD)

- **0.7.2 — A anonimização não toca `atleta_documento`.** Sobrevivem à exclusão:
  `cpf_hash`, `data_nascimento`, `responsavel_nome`, `responsavel_cpf_hash` e
  `cpf_consent_ip` — inclusive dado de **menor** e de **terceiro** (o responsável,
  que não é quem pediu). A `POLITICA_PRIVACIDADE.md` §7 prometia que o hash de
  CPF era purgado; **o texto foi corrigido em 08/09** para descrever o que o
  sistema faz. Falta decidir o código.
  **Decisão pendente do Juliano** (o jurídico separou o que é e o que não é opção):
  - *Não é opção* — `responsavel_nome`, `responsavel_cpf_hash`, `data_nascimento`
    e `cpf_consent_ip` devem ser apagados em qualquer cenário.
  - *É opção* — o `cpf_hash`: apagar (libera recadastro e derruba a dedup
    nacional), reter por prazo declarado (ex.: 2 anos, alinhado ao consentimento),
    ou reter enquanto a plataforma existir (o mais frágil frente ao art. 6º, III).
- **0.7.3 — Segundo pedido de exclusão reinicia o prazo legal.**
  `athlete-action` grava `exclusao_solicitada_em` incondicionalmente, então um
  clique novo apaga a data do primeiro e empurra o vencimento do art. 18 §3º
  para frente. Correção: só gravar se estiver nulo.
- **0.7.4 — Sucesso silencioso com zero linhas.** O update tem
  `.neq("status","arquivado")` e ninguém confere quantas linhas mudaram: pode
  responder `sucesso: true` sem ter gravado nada. Mesma família do defeito que a
  0.6.1 consertou, um degrau abaixo.
- **0.7.5 — O porteiro não devolve `exclusao_solicitada_em`.** Em circuito
  privado não-BH, `circuito-dados` e `porteiroRankingToCa` não carregam o campo,
  então o recibo do pedido não tem de onde vir. Contornado no front pela 0.6.1
  (um sinalizador que só liga com confirmação do servidor); a correção de raiz é
  o porteiro passar a devolver o campo.

  > **Verificado e DESCARTADO em 08/09:** a suspeita de que o botão "Finalizar
  > exclusão" nunca funcionara (o `verify_jwt` da `anonimizar-atleta` está ligado
  > e o app manda chave publicável, não JWT). Teste sem escrita — POST com corpo
  > vazio — devolveu **HTTP 400 "pin e id são obrigatórios"**: o portão deixa
  > passar e a função roda. Os zero POSTs em 24h eram ausência de pedidos, não
  > recusa. Fica o registro para não se reinvestigar isso.

### Mensagem de erro na tela — as quatro portas

A 0.6.1 fechou a porta nova. Três continuam abertas, e a correção certa das
quatro é **um saneador compartilhado**, não quatro remendos.

- **0.7.6 — `DbBar` mostra o corpo inteiro do PostgREST, com `details` e `hint`,
  para todo mundo — inclusive o visitante.** É estruturalmente a pior das quatro
  (`details` é justamente o campo que carrega o valor que violou a regra) e já
  está no ar. **Fazer primeiro.**
- **0.7.7 — Login do atleta** (`setErr(e.message)`) e **troca de foto**
  (`Erro: ${errMsg}`, ecoando o corpo do Storage) mostram texto cru ao atleta.
- **0.7.8 — `erroCod` estável no `athlete-action`.** Hoje o app casa mensagens
  por texto (lista branca em `MSGS_ATLETA`). Funciona e está travado por
  asserção, mas o certo é o motor devolver um código estável ao lado da frase.
  Quando entrar, a asserção de paridade é aposentada.
- **0.7.9 — `resetar-pin-atleta` sem catch-all:** o `throw` vira 500 do Deno sem
  cabeçalho CORS, o navegador corta e o erro chega sem status nem corpo.
- **0.7.10 — Dívidas das asserções novas:** escopar a asserção de escopo ao corpo
  do `syncToSupabase` (hoje varre o `App.jsx` inteiro, então uma chamada nova a
  uma função já existente passa verde).

### Tela

- **0.7.11 — `NovaTemporadaPanel` não filtra por `modoOrg`.** O painel de virada
  de temporada aparece para o organizador, que sempre levará 403 (o motor é
  fail-closed, `NOVA_TEMPORADA` não está em `ACOES_ORG`). Não é falha de
  segurança; é botão que nunca funciona, com um aviso de "não pode ser desfeita"
  para uma ação que não é dele. Desde a 0.6.1 ele ao menos **vê** o 403.
- **0.7.12 — O padrão otimista é sistêmico.** Todo o admin muda a tela antes de o
  servidor confirmar (`NOVA_TEMPORADA`, `AVANCAR_RODADA`, `PROCESSAR_RODADA`,
  `APLICAR_WO`, `ARQUIVAR_ATLETA`). A 0.6.1 fez a reversão acontecer e ficar
  visível; o padrão em si continua.
- **0.7.13 — Dívida de marca:** `#c25a45` é uma 5ª cor, fora da paleta de 4 do
  manual, usada ~37 vezes. Ou o manual ganha seção de "cor semântica de sistema",
  ou o app migra. Decisão do Juliano, via curador.

## Onda 0.8 — O que a correção de nomes desenterrou (10/09/2026)

O Juliano reportou que a tela de inscrição oferecia "Clube do Tênis de Mesa BH"
em vez do circuito. A causa era o nome gravado, não o código — mas a revisão
achou que o mesmo circuito tinha **cinco nomes diferentes** pelo app, e destravou
uma pilha de coisas cravadas em texto que deviam vir do dado.

Decisões dele, para o registro: **o app é "Clube do Tênis de Mesa"**, sem "BH";
**o circuito é "Circuito BH"**, sem número (o número é da temporada, e cravá-lo
faria o nome envelhecer sozinho na virada).

### Precisam de decisão dele

- **0.8.1 — ✅ RESOLVIDO em 10/09/2026.** Havia dois pares de índice+log do
  curador (`claude/` e `docs/`), divergidos: o de `claude/` congelado desde 05/09,
  o de `docs/` escrito até 07/09. Decisão do Juliano: **`docs/` é o registro
  único**. A pasta `claude/` foi removida (histórico no git), a entrada de 08/09
  que só existia lá foi trazida, e o mandato do curador passou a apontar para o
  lugar certo — senão ele voltaria a escrever numa pasta que não existe.
- **0.8.2 — ✅ RESOLVIDO em 10/09/2026.** O nome da marca aparecia com "de Mesa"
  em terracota itálico na tela de entrada — tratamento que o manual reserva ao
  slogan, e que ficava duas linhas acima do slogan de verdade, os dois brigando
  pelo mesmo destaque. O nome ficou inteiro em off-white. *(Designer)*

### Texto cravado que devia vir do dado

- **0.8.3 — "masculino adulto (18+)" está cravado em três lugares**, incluindo o
  regulamento que o atleta assina (Cap. 02 e Cap. 11) e o mini-resumo do passo 3.
  É fato do BH, não regra da plataforma, e `circuitos` não tem coluna de
  categoria — então é trabalho de banco, não de texto. Três `// TODO` deixados no
  código em 10/09 para não repetir o esquecimento que causou esta onda.
- **0.8.4 — "Temporada 1" cravada** no mini-resumo do passo 3 e no Cap. 02 do
  regulamento. Envelhece sozinha na virada.
- **0.8.5 — ✅ RESOLVIDO em 10/09/2026** (era: `RegulamentoView` não ramifica por
  `regulamento_versao`). A coluna
  existe e está preenchida (`v03-12` no BH), mas o componente escolhe o texto só
  por sistema (A/B). Consequência: um 2º circuito de rating herdaria o
  regulamento do BH, **com o capítulo do torneio presencial**, que não é dele —
  o correto seria `vA-nc-01`. **Bloqueia vender um 2º circuito Sistema A.**
  *(Curador)*
- **0.8.6 — Fallback cravado no `SeletorCircuito`:** `"Circuito BH"` em texto,
  usado quando o circuito atual não é encontrado. Inofensivo hoje (é o valor
  real), fica velho se o BH for renomeado de novo. *(Confiabilidade)*

### Instagram — tem dono agora, e tem data

Complementa a Onda 0.2, que dizia "o Instagram não tem dono". Verificado em
10/09: **está vivo e publicando** (53 peças, a última no próprio dia 10/09).

- **0.8.7 — O token vence em 29/10/2026** e nada avisa quando se aproxima. Se
  vencer sem troca, as publicações param em silêncio.
- **0.8.8 — A anotação em `instagram_config` está desatualizada e engana.** Diz,
  desde 30/08: "Acesso do app revogado pela conta; aguardando novo token. Religar
  ativo=true depois de gravar o token novo e testar." Mas `ativo` já está ligado
  e as publicações saem normalmente. A rotação terminou e o bilhete ficou.
- Verificado e **descartado**: as 53 publicações não citam "Temporada BH" nem
  "BH" — o rename do circuito não desencosta nada do Instagram.

### Campo em edição × recarga

- **0.8.9 — Campo do admin perde o que está sendo digitado se outro admin salvar.**
  O `nomeEdit` ganhou resync em 10/09 (era ele que desfazia o rename sozinho), e
  isso troca um defeito por um risco menor: com dois admins logados — possível
  desde a v58 — o texto não salvo de um é descartado quando o outro grava.
  `nomeNova` em `AbrirProximaPanel` não tem resync nenhum, e é o defeito antigo.
  Só vira uso real quando houver organizador. *(Confiabilidade)*

## Onda 0.9 — Dívidas do contador de mensagens (10/09/2026)

Saíram do conserto do contador (ver `CHANGELOG.md`, 10/09). Nenhuma bloqueia nada
hoje; todas são do mesmo padrão — **estado carregado sob demanda sendo lido por
quem não checa se já chegou**.

- **0.9.1 — A corrida do `msgsCircRef`.** `msgsCircRef.current = CIRCUITO_ATIVO`
  lê a variável global no momento em que a RESPOSTA chega, não no início da
  chamada. Se o super-admin trocar de circuito com um `LISTAR_MENSAGENS` em voo,
  a resposta tardia é carimbada para o circuito errado. Pré-existente, só
  super-admin multi-circuito, autocorrige na busca seguinte. Correção: capturar
  `const circAlvo = CIRCUITO_ATIVO` antes do `await` e só aplicar se ainda bater —
  o mesmo espírito do `loadGenRef` que o arquivo já usa noutro fluxo.
  *(Confiabilidade)*
- **0.9.2 — Card em "···" a sessão inteira.** Quem entra por biometria e nunca
  visita Inscrições, Mensagens ou W.O. fica sem o número no painel até a primeira
  ação. É o preço de não abrir modal de PIN numa leitura de fundo, e é o lado
  certo do erro — mas um "toque para carregar" no card resolveria.
  *(Confiabilidade)*
- **0.9.3 — Chamada dupla de `LISTAR_MENSAGENS`** quando o admin clica em "Msgs"
  logo após entrar: o guard do ref só é setado no sucesso. Leitura idempotente,
  desperdício de uma chamada. *(Admin)*
- **0.9.4 — Rótulo do botão de disparo fora do padrão local.** "carregando o
  histórico…" não tem emoji nem maiúscula, ao contrário dos outros botões da
  tela. Estética. *(Admin)*
- **0.9.5 — `resultado_comunicado` é por JOGO, mas são DUAS mensagens.** Gatilho:
  quando alguém reclamar que um dos dois atletas não recebeu o resultado.
  Cada jogo validado gera uma mensagem por atleta, e o filtro que esconde o que
  já foi enviado é `m.validated && !m.resultadoComunicado` — um campo só, do jogo
  inteiro. Enviar a do **primeiro** atleta marca o jogo, e a do segundo some da
  lista de pendentes.

  **Por que não morde hoje:** a fila é congelada no clique (`setFilaCongelada`),
  então dentro de um disparo normal as duas mensagens já estão na fila e são
  percorridas. Conferido no banco em 14/09/2026: todos os jogos com mensagem de
  resultado têm exatamente **duas**, nunca uma. Morde se o disparo for
  interrompido entre os dois atletas (fechar a aba, perder conexão, sair do
  WhatsApp e não voltar) — aí o segundo atleta nunca mais aparece como pendente.

  **Correção:** o "já enviei" do resultado tem de ser por atleta, não por jogo —
  o log em `mensagens_enviadas` já grava `atleta_id` + `match_id`, que é
  exatamente o par necessário. O campo `resultado_comunicado` continuaria útil
  como marca persistente do jogo (é o que impede o resultado antigo de voltar a
  pendente a cada par mensal de rodadas), mas o filtro da lista deveria consultar
  o log por atleta.

  **Contexto:** achado em 14/09/2026 ao consertar o defeito irmão — o
  `if (atual.matchId)` que deixava um **lembrete** marcar o resultado como
  comunicado (reportado pelo Juliano: Fabio x Juliano, rodada 5, mensagem de
  resultado nunca apareceu). Aquele foi corrigido e travado com asserção; este
  é o resíduo do mesmo mecanismo, e ficou registrado em vez de corrigido junto
  para não misturar dois defeitos num conserto só.

## Onda 0.10 — Antes de abrir o 2º circuito ⛔ (10/09/2026)

Saiu da revisão da 0.8.5 pelas 8 duplas. **Nada aqui morde hoje** — existe um
circuito, o BH, e ele está provado intocado. Tudo aqui tem **gatilho**, não data:
o dia em que nascer o segundo circuito, ou em que for nomeado o primeiro
organizador. Registrado com gatilho a pedido do Guardião Jurídico: *"se virar
backlog sem gatilho, o defeito volta a ser descoberto no pior momento — com
atleta inscrito."*

### Gatilho: antes de criar o 1º circuito Sistema A que não seja o BH

- **0.10.1 — ✅ FEITO (13/09/2026). O fallback da versão do regulamento não é fail-closed.** Se a
  leitura de `circuitos.regulamento_versao` falhar, o app cai em `v03-12` — e
  mostraria ao atleta de um circuito novo o regulamento do BH, **com torneio e
  com a taxa**, enquanto o servidor carimba `vA-nc-01`. O recibo ficaria
  provadamente falso. Consentimento é a última coisa que pode ser fail-open.
  *Achado independentemente pelo Guardião Jurídico E pelo de Segurança — os dois
  chegaram nele por caminhos diferentes, o que é sinal de que é real.*
- **0.10.2 — ✅ FEITO (13/09/2026), por outro caminho. O "80%" está cravado em três textos que o atleta aceita**
  (`src/App.jsx` ~2200 no portão do aceite, ~2675, ~2697), e
  `percentual_entrada_meio` é configurável por circuito. Organizador que puser
  50% terá atletas com aceite prometendo 80%. **Mesma classe do teto** — e o
  Jurídico recomendou o mesmo remédio que funcionou lá: em vez de o texto seguir
  a configuração, **a configuração passar a caber dentro do que o atleta
  aceitou**.

  **Como foi resolvido:** não fazendo a configuração caber no texto, e sim
  **abolindo a regra**. Decisão do Juliano, 12/09/2026: o atleta paga o mesmo
  valor entrando em qualquer etapa; desconto vira ato do organizador, por atleta.
  Circuito novo nasce com `percentual_entrada_meio: 100`, a virada o devolve a
  100, e o valor-padrão do motor deixou de ser 80. Para o **BH**, que tinha o 80%
  prometido no v03-12 já aceito, criou-se a **v03-13** e uma **trava**: a virada
  do BH é recusada (409) enquanto ele declarar uma versão que promete o desconto.
  Ver 0.10.15 para o que falta (carimbo + aviso).
- **0.10.3 — O regulamento `vA-nc-01` não tem texto canônico.** Ele existe como
  prosa no `REGULAMENTOS_NOVOS_CIRCUITOS.md` e como ramificação no `App.jsx`.
  Não há `docs/REGULAMENTO_vA-nc-01.md`. Um documento que o atleta aceita
  juridicamente mora só dentro de um JSX de 9.700 linhas. *(Jurídico)*
- **0.10.4 — Duas referências a capítulo nas telas do admin ficam off-by-one**
  num circuito sem torneio: `App.jsx:7672` ("Cap. 13", vira 12) e `:8031`
  ("Cap. 11", vira 10). As de "(Cap. 03)" e "(Cap. 07)" **não** quebram — são
  anteriores ao capítulo removido. Conserto: nomear o capítulo, como foi feito
  dentro do regulamento. Não tocado porque alteraria a tela do BH.
- **0.10.5 — O corte dos 8 no ranking vira promessa vazia.** `RankingView`
  desenha "Zona de classificação" e "C = classificado para o torneio final"
  incondicionalmente. Num circuito sem torneio, é rótulo sem referente. Saída sem
  tocar o BH: prop opcional com default que preserva o comportamento atual.

### Gatilho: antes de nomear o 1º organizador

- **0.10.6 — `login-atleta` precisa subir como v9.** ⚠️ **Descrição corrigida em
  19/09/2026 — o diff contra o ar se inverteu.** Quando este item foi escrito, o
  repositório estava **à frente** do ar por conter o `org_ve_financeiro` no
  `LOGIN_ORGANIZADOR`. Hoje é o contrário: esse trecho foi **removido do
  repositório** (decisão 3 do 0.10.15 — a liberação do financeiro do organizador
  segue amarrada ao 1º circuito vendido), e o que o repositório tem a mais que o
  ar é a **guarda fail-closed do `PARTICIPAR`** (0.10.18). Ou seja: a v9 sobe por
  causa do regulamento, **não** do financeiro.

  **O que continua pendente deste item:** a aba Financeiro **nunca apareceria**
  para o organizador, porque nem o ar nem o repositório devolvem
  `org_ve_financeiro`. Dormente (0 organizadores, e o BH é excluído desse fluxo
  por `slug !== "bh"`), e o portão real do servidor está no ar desde a v58.
  Gatilho: o 1º circuito vendido — não esta onda.
  *Nota de método, do Guardião de Segurança:* `supabase functions download`
  devolve o código **transpilado** — para comparar fonte com o que está no ar,
  só pela MCP.
- **0.10.7 — ⚠️ RESOLVIDO EM DUAS DAS TRÊS PONTAS em 28/09/2026 (no fonte).** *O
  admin é cego para o regulamento do próprio circuito.* Eram três coisas — *não é
  avisado, não vê, não muda* — e duas foram fechadas:
  - **não é avisado → resolvido.** O formulário de criação passou a dizer, **antes**
    de criar, qual versão o circuito vai usar (`vA-nc-01` ou `vB-01`), que é o texto
    que **todo atleta daquele circuito vai aceitar**, e a diferença que só aparece no
    documento: **circuito de rating NOVO nasce sem o Torneio Presencial de
    Encerramento**, porque aquele capítulo é do BH.
  - **não vê → resolvido.** O card "⚙️ Configuração do circuito" mostra a versão em
    vigor, lida do circuito carregado. E o `CRIAR_CIRCUITO` passou a **devolver** o
    campo no `select`, então a tela de confirmação mostra o que o **servidor gravou**,
    não o que a tela mandou.
  - **não muda → NÃO FEITO, e de propósito.** Trocar a versão de um regulamento já
    aceito muda retroativamente o que o recibo do atleta prova — é exatamente o que a
    **regra 7** do `CLAUDE.md` proíbe. A tela diz isso ao admin, em vez de oferecer o
    botão. Se um dia precisar existir, é com aviso prévio e re-aceite, como a v03-13
    fez, não como um salvamento de configuração. Há asserção provando que o
    `DEFINIR_CONFIG_CIRCUITO` **não toca** `regulamento_versao`.
  **11 asserções** — 1 rodando o motor (o recibo que ele devolve) e 10 de fonte —
  dentro das 37 de `testes/segundo-circuito.mjs`. *(Admin)*
- **0.10.8 — O torneio virou decisão de ninguém.** O
  `REGULAMENTOS_NOVOS_CIRCUITOS.md` promete que ele é "a critério do admin do
  circuito"; o código entrega "sempre não", travado na criação. Um organizador
  que queira fazer torneio não tem caminho. *(Admin)*
- **0.10.9 — ❌ DESFEITO em 29/09/2026, por decisão do Juliano. O item deixa de
  existir.** *Não havia campo para editar o teto de um circuito existente.*
  A fatia chegou a ser escrita e revisada pelas 8 duplas (commit `f229432`), e foi
  **desfeita antes de subir**. O motivo não é técnico: perguntei ao Juliano se a
  decisão dele de **10/09/2026** — *o teto é regra da plataforma, 20 para todos* —
  ficava revogada pelo código, que tinha ido para o outro lado em duas ondas. Ela
  **fica de pé**.
  Ou seja: **não havia campo porque não deve haver campo.** O item era uma lacuna
  aparente, criada por eu ter lido a divergência entre código e decisão como defeito
  do código. O conserto certo foi o inverso: o motor voltou a cravar 20, nenhuma tela
  pergunta, e os três textos do regulamento voltaram a dizer "20".
  **O que sobrou de bom da fatia desfeita, e por isso ela valeu:**
  (a) o defeito de **ressincronização** que ela expôs — campo inicializado a partir do
  estado sem `useEffect`, que fazia o Salvar gravar o valor de um circuito no outro —
  virou asserção **genérica**: todo campo do painel nessa condição precisa
  ressincronizar, e ela pega o próximo que nascer torto;
  (b) a frase falsa do card (*"é o texto que os atletas **aceitaram**"*, falso para 14
  de 15 no BH) foi achada e corrigida, e o card passou a **contar** quem não aceitou;
  (c) o **0.10.7** foi resolvido em duas pontas e fica (ver acima);
  (d) e o terceiro furo de instrumento em 48h foi encontrado — o banco falso não
  recortava colunas na escrita.
  **E desfez um desvio da regra 7 que não estava registrado:** a linha do teto é
  conteúdo compartilhado do Sistema A e renderiza para o **v03-12**, que tem aceite.
  A troca de 27/09 alterou o texto que aquele recibo aponta, sem re-aceite. Restaurar
  a frase original devolve o texto ao que era quando os aceites foram colhidos.

### Gatilho: antes do 1º circuito de terceiro (e pede advogado)

- **0.10.10 — ✅ RESOLVIDO em 27/09/2026, pelo item 0.6.21, e NO AR.** O mesmo defeito
  chegou por outra porta: o Juliano o achou **usando o app**, testando a inscrição,
  ao perguntar "como vou saber se é o regulamento correto?". O conserto fechou as
  duas pontas (a tela mostra o regulamento do circuito alvo e exige o aceite; o
  servidor exige que o atleta declare a versão e a compara com a do circuito).
  Detalhe e as 38 asserções em 0.6.21. *Descrição original, mantida como registro:*
  Ao entrar num
  **segundo** circuito, `login-atleta:314` grava `aceite_regulamento: true` com
  data e versão — e o `ParticiparFlow`, única tela desse fluxo, **nunca mostra o
  regulamento** nem tem checkbox. Hoje a exposição é **exatamente zero** (o
  fluxo recusa o BH por construção) e passa a ser **100% no dia 1 do circuito 2**.
  Não há zona cinzenta. *(Jurídico — e é ele quem nota que a 0.8.5 transforma
  isso de inofensivo em falso: com versões diferentes por circuito, o registro
  passa a afirmar que o atleta aceitou um documento que só existe lá e que ele
  nunca viu.)*
- **0.10.11 — Os 15 aceites do BH estão desatualizados.** Nenhum atleta tem
  `v03-12` gravado: 12 têm `v03-3`, 1 tem `v03-5`, 1 tem `v03-8`, 1 tem `v03-11`
  — e todos jogam sob o v03-12, que traz cláusulas penais (W.O. culposo −15,
  suspensão, **banimento permanente** por fraude). `RENOVAR` não re-colhe aceite
  nem atualiza a versão. **Recomendação do Jurídico: re-colher na próxima
  renovação** (o ponto de contato já existe; falta ele gravar), e fazer isso
  **depois** de 0.10.12, senão gasta-se o atrito sem comprar a proteção.
- **0.10.12 — Falta a regra "texto mudou → versão nova".** Hoje a string de
  versão não identifica um texto com segurança: este próprio avanço quase
  alterou o v03-12 sem trocar a versão. Proposta do Jurídico: a regra, mais
  `docs/REGULAMENTO_<versao>.md` como texto de registro, mais uma asserção que
  compare o documento com o fonte.
- **0.10.13 — O consentimento de CPF do `ParticiparFlow` é mais fino que o do
  cadastro**, sob o **mesmo** rótulo de versão: uma linha, sem controlador, sem
  retenção, sem direitos. Dois textos materialmente diferentes com uma etiqueta
  só. *(Jurídico)*

### Sem gatilho — higiene

- **0.10.26 — ✅ RESOLVIDO em 29/09/2026 pela decisão do teto fixo.** *O teto editável
  alcançava o BH, cujo regulamento crava "20" sem ressalva.* Com o teto voltando a ser
  regra da plataforma, o texto do BH está **correto** e o campo que o contradizia
  deixou de existir. O item nasceu e morreu no mesmo dia, e fica como registro de que
  a pergunta foi feita.
- **0.10.27 — O "✅ Incluir agora" oferece o que o servidor recusa quando o circuito
  está cheio.** *(Admin, 28/09/2026 — continua aberto, e é pré-existente.)* O gate da
  tela (`podeIncluirBacklog`) confere o último terço e o pagamento, **não o teto**. O
  admin clica e o motor recusa com *"Circuito cheio (N/X)."* A mensagem do servidor é
  boa, então não quebra nada — mas é o padrão "a tela oferece, o servidor recusa" que
  já apareceu três vezes nesta onda. Alcançável com o circuito cheio em 20, que é o
  caso do BH quando lotar. `motivoBloqueioInclusao` já tem o formato para dizer
  "circuito cheio (N/X)".
- **0.6.29 — O rate-limit do CPF é chaveado num cabeçalho que o cliente pode
  escolher.** *(Segurança, 28/09/2026 — precisa de verificação AO VIVO, não de
  código.)* `athlete-action` toma `ipReq` do **primeiro** elemento do
  `X-Forwarded-For`. A convenção é que cada proxy **acrescenta** ao cabeçalho, então o
  primeiro elemento tende a ser o que o próprio cliente mandou. Se for esse o caso na
  borda do Supabase, um atacante escolhe a própria chave de cota e roda 12 tentativas
  por valor inventado — e a segunda camada anti-oráculo do `cpf_duplicado` deixa de
  valer. **Pré-existente, não desta fatia.** O passo é medir na borda (mandar dois
  `X-Forwarded-For` diferentes e ver qual vira linha em `tentativas_busca_cpf`), não
  mexer no código antes de saber.
- **0.6.30 — O campo de data de nascimento não tem `min`/`max`.** *(Confiabilidade,
  28/09/2026 — uma linha.)* `<input type="date">` sem limites aceita 1850 ou 2030; a
  tela deixa passar e só o servidor recusa. É o **único** caminho em que o atleta
  encontra a guarda nova de idade. Pôr os limites no input faz a tela recusar antes,
  sem tirar o backstop do servidor.
- **0.6.31 — O admin não tem como saber que um atleta é menor.** *(Experiência do
  Admin, 28/09/2026.)* Ele conversa com os atletas por WhatsApp direto do painel e hoje
  trataria um menor exatamente como um adulto. **Não** é para expor CPF nem nome do
  responsável na tela — seria andar para trás na minimização que acabou de ser
  acertada. O que resolve é um **sinal** derivado da data de nascimento (um selo
  `🔞 menor` no card), sem trazer nenhum campo do responsável. Ninguém está sendo
  prejudicado hoje; é preparação para quando houver menores de verdade.
- **0.6.32 — O carimbo do responsável prova que alguém digitou, não que consentiu.**
  *(Jurídico, 28/09/2026 — decisão de política do Juliano, não condição técnica.)*
  A tela **já faz a parte difícil**: quando é menor, o texto do aceite muda para a
  primeira pessoa do responsável (*"Na condição de responsável legal, consinto…"*).
  Mas isso é carimbado em `cpf_consent_em` / `_versao` / `_ip` — campos cujo nome diz
  que são o consentimento **do atleta**. O registro contradiz a tela. A versão barata é
  gravar `responsavel_consent_em` + versão no mesmo clique: não é tela nova nem recurso
  novo, é **registrar o que já acontece**. O conserto de verdade — confirmar com o
  responsável pelo canal **dele**, o WhatsApp que o app já usa — é decisão maior.
- **0.10.14 — `circuitos` tem RLS `USING (true)` e `pix_chave` legível pelo
  `anon`.** Pré-existente, não desta mudança. *(Segurança)*
- **0.10.25 — A `RegulamentoView` vira porta de entrada e não está pronta pra
  isso.** Três violações do manual da marca, todas **pré-existentes**, todas no
  cabeçalho, apontadas pelo designer visual em 19/09/2026 com print ao vivo em
  390px. Deixaram de ser canto esquecido porque o card de re-aceite do 0.10.15(b)
  leva os 12 atletas do BH para lá, obrigatoriamente, no primeiro acesso:
  1. **terracota como fundo de largura inteira** (`App.jsx`, `header` da
     `RegulamentoView`) — o manual diz "usar com moderação, **nunca como fundo
     grande**";
  2. **logo na versão SELO renderizado a 38px** (`logoWrap`) — o manual pede
     mínimo de 120px de diâmetro e a versão ÍCONE abaixo disso; o texto do selo
     já está ilegível nesse tamanho;
  3. ~~branco puro no título~~ **FEITO em 19/09** — trocado por `T.offwhite`.
  Os dois primeiros são decisão de design, não conserto óbvio: mexer no
  cabeçalho muda uma tela que todo mundo vê. Fica para uma rodada com o Visual
  decidindo o desenho, não para o meio de uma onda de regulamento.

  *(Nasceu numerado **0.10.23** em 19/09/2026, mas `0.10.23` e `0.10.24` já
  estavam ocupados desde 15/09 — o documento ficou com quatro itens e dois
  números. Renumerado para 0.10.25 pelo Curador na mesma data; um parecer do
  Visual que diga "0.10.23" e fale de marca refere-se a **este** item.)*

- **0.10.26 — O card do admin aponta para as Mensagens por texto, não por link.**
  O `RegulamentoDoCircuitoCard` diz "vá em Mensagens → Mudança de Regulamento",
  mas não leva. Um link de verdade exige passar `setTab` como prop até o card.
  Pequeno, e fecha o caminho entre "vejo quem falta" e "aviso quem falta".
  (Operações, 19/09/2026. Nasceu numerado **0.10.24**, número já ocupado desde
  15/09 — renumerado para 0.10.26 pelo Curador em 19/09/2026.)

- **0.10.27 — `circuito-dados` e `despachos-do-dia` não têm rollback possível.**
  Gatilho: **antes do próximo deploy de qualquer uma das duas** — e, de todo
  modo, antes do 2º circuito, porque `circuito-dados` é o porteiro dos circuitos
  privados.

  Conferido ao vivo em 19/09/2026 (`list_edge_functions` no projeto
  `eultwfzzlgcmcikobmmy`, não lido de doc): o `entrypoint_path` das duas —
  `circuito-dados` **v4** e `despachos-do-dia` **v6**, ambas sem redeploy desde
  **08/09/2026** — ainda aponta para uma pasta de **rascunho do projeto de
  torneios**
  (`.../JULIANO-APP-TORNEIO/.../scratchpad/publicar-so-cors/...`), não para este
  repositório. `admin-action` e `athlete-action`, redeployadas em 17/09, já
  apontam para `/Users/strutzki/clube-tenis-mesa-v2/...`.

  **É o mesmo achado que o Guardião de Segurança fez no `login-atleta`** (ver
  `CLAUDE.md`, Armadilhas — "o fonte pode não ser o que está no ar"), só que
  abrange **mais funções do que ele nomeou**. E a consequência é a mesma: como
  não há rollback de Edge Function — "voltar" é republicar o código antigo — e o
  fonte do repositório pode não ser o que está rodando, **não existe por onde
  voltar**. Para o `login-atleta` isso foi resolvido salvando a versão viva em
  `BACKUPS/motor-no-ar-2026-09-19/ar-login-atleta-v8.ts`; para estas duas
  **não há cópia equivalente**.

  **Conserto:** baixar as duas pela MCP (o `supabase functions download` devolve
  código **transpilado** e não serve para comparar com o fonte — nota de método
  do Guardião de Segurança, 0.10.6), salvar em
  `BACKUPS/motor-no-ar-<data>/`, conferir contra o repositório, e republicar
  **deste** repositório para o `entrypoint_path` passar a apontar para cá.
  `circuito-dados` já esteve no ar **sem código nenhum no repositório** uma vez
  (recuperada em 07/09/2026); é a função com o pior histórico de procedência do
  projeto.

  *(Curador, 19/09/2026 — achado além do que a rodada pediu. Sinalizado, não
  corrigido: mexer em deploy não é mandato do Curador, e isto precisa do rito de
  subida como qualquer publicação.)*

- **0.10.15 — A virada do BH para a v03-13: o que falta, em ordem.**
  Gatilho: **antes da próxima virada de temporada do BH**. O motor já recusa a
  virada (409) enquanto `circuitos.regulamento_versao` do BH não estiver numa
  versão sem desconto por etapa — a trava existe para nenhum destes passos ser
  esquecido. **Não é uma lista de desejos: é pré-requisito.**

  **STATUS EM 19/09/2026 — construído, ainda não publicado.** (a), (b) e (c)
  estão no fonte (`src/App.jsx`, `admin-action`, `athlete-action`; árvore
  provada por hash, bateria **535/0**, build OK). **As 8 duplas fecharam** e as
  correções da 2ª rodada foram aplicadas, com **12 testes de mutação** (5 no
  motor, 7 no app) provando que cada regra nova fica vermelha quando sabotada.
  Nada disto está no ar.

  **O que a 2ª rodada de revisão mudou (19/09/2026):**
  - **O par (versão, preço) virou invariante do motor.** A trava do
    `NOVA_TEMPORADA` protegia UMA ação, não o par — o guardião de Regulamento
    SIMULOU e chegou ao estado proibido por outro caminho: carimbar v03-13 →
    virar (preço vai a 100) → carimbar v03-12 de volta = texto prometendo 80%
    com o app cobrando 100%. Agora o `DEFINIR_REGULAMENTO_VERSAO` e o
    `DEFINIR_FINANCEIRO` recusam (409) a combinação que prejudica o atleta. A
    direção inversa (texto integral, cobrança reduzida) continua **permitida de
    propósito**: é a janela de transição obrigatória, e barrá-la criaria um
    impasse em que não se pode carimbar nem virar.
  - **O aviso prévio deixou de colidir com o lembrete.** Os dois gravavam
    `categoria: "regulamento"`, e a chave de "já enviada" é (atleta, categoria,
    mês): avisar antes marcava o lembrete posterior como já enviado para todo
    mundo, e a única mensagem acionável nunca entrava na fila. O prévio agora se
    registra como `regulamento_previo`.
  - **A versão-alvo do aviso passou a ser validada** contra as mesmas três
    famílias do motor, espelhadas no app com asserção que compara as duas
    listas. Sem isso o admin podia anunciar "V03-13" aos 12 do roster e só descobrir
    no carimbo que o motor recusa (a maiúscula não é normalizada de propósito).
  - **As três listas de "quem falta aceitar" passaram a coincidir.** Os 2
    atletas pendentes de inclusão (em v03-11 e v03-8) ficavam fora do aviso e
    da conta do painel, mas viam a pergunta no app — o painel podia dizer "✓
    todos os 12 aceitaram". O comentário que justificava excluí-los era
    factualmente falso: o `INCLUIR_NO_CIRCUITO` não recolhe aceite nenhum.
  - **As asserções do re-aceite eram teatro.** Eram regex sobre o fonte; o
    guardião quebrou a regra de três jeitos (aceite sem declarar versão,
    não-membro aceitando, recibo forjável) e a bateria ficou VERDE nos três.
    Substituídas por **7 cenários comportamentais** rodando o `athlete-action`
    de verdade, cada um com mutação.
  - **0.10.20 FEITO** — a virada passou a exigir confirmação-com-nome. Era a
    ação mais destrutiva do app e a única sem o padrão que o `CLAUDE.md` manda;
    o botão vizinho ("Cancelar pré-abertura") já usava `confirm()`. Deixou de
    ser teórico porque a trava do regulamento cai no instante do carimbo.
  - **Visual:** o botão "Confirmar aceite" usava a terracota que reprova no
    WCAG AA (3.87:1) tendo `T.terracotaBtn` (5.34:1) definido para isto na linha
    10; a caixa do aceite era `<input type="checkbox">` nativa, que renderiza
    AZUL (cor fora do manual) e era a única caixa de consentimento do app fora do
    padrão; o rodapé jurídico estava no contraste mais fraco do card.

  **PROCEDIMENTO OBRIGATÓRIO NA VIRADA (R2, não é código):** a trava força
  carimbar a v03-13 **antes** de virar, e nessa janela o circuito declara uma
  versão cujo próprio texto diz que ainda não vigora — e a `RegulamentoView`
  sempre mostra a versão corrente, então o texto que de fato governa a temporada
  em curso deixa de ser exibível no segundo do carimbo. Duas consequências são
  benignas (a cláusula de transição resolve em favor do atleta); a terceira não:
  **quem se inscrever nessa janela recebe recibo `versao_regulamento = v03-13`
  para uma temporada que a v03-13 diz ter corrido pela v03-12.** Com as
  inscrições abertas (estão), é alcançável. Logo:
  **fechar inscrições → carimbar v03-13 → `NOVA_TEMPORADA` → reabrir**, ou
  carimbar e virar colados, na mesma sessão.

  **ROLLBACK — o `login-atleta` não sai do git.** Provado em 19/09 pelo guardião
  de Confiabilidade, com `diff`: o HEAD do git carrega o bloco
  `org_ve_financeiro`/`veFinanceiro` e **o que está no ar não carrega**. Um
  `git show HEAD:...` devolveria um estado que nunca esteve no ar — e liberaria
  o financeiro do organizador sem o gatilho do 1º circuito vendido, exatamente o
  que a Segurança mandou reverter. A fonte de rollback desta função é
  `JULIANO/CLUBE DO TÊNIS DE MESA/BACKUPS/motor-no-ar-2026-09-19/ar-login-atleta-v8.ts`.
  Para `admin-action` e `athlete-action` o git continua correto (conferido por
  duas vias), **mas copiar as duas para `BACKUPS/` antes de publicar** é um `cp`
  e acabamos de provar que "o git deveria bastar" falha em silêncio.

  **(e) — o carimbo precisa de registro datado.** Entre "avisar" e "carimbar",
  anotar em lugar durável (CHANGELOG + a pasta do Juliano) **qual versão foi
  carimbada, em que data e por quem**. Enquanto o J5 não existir no banco, este
  registro manual é a única prova de quando o contrato mudou. (Jurídico, C3.)
  - **(a) FEITO** — `DEFINIR_REGULAMENTO_VERSAO` (super-admin,
    confirmação-com-nome, `trim`, recusa versão fora da família do circuito).
    As três exigências (recusar vazio, recusar versão de outro circuito,
    `trim`) e os três consertos de tela (trim simétrico, fallback do BH morto,
    `PARTICIPAR` fechado = 0.10.18) — todos no fonte.
  - **(b) FEITO** — `ACEITAR_REGULAMENTO` no `athlete-action`: autenticado por
    TOKEN de sessão (não pelo `athleteId` do payload — recibo de consentimento
    não pode ser forjável), fail-closed sem versão, recusa se a versão mudou
    entre a tela carregar e o clique, grava `versao_regulamento` +
    `data_aceite_regulamento`. Mostra o bloco de transição do Cap. 12 (não o
    resumo do portão), como o Jurídico pediu (peça 1).
  - **(c) FEITO, com a decisão de 18/09 embutida** — aviso prévio com dois
    modos: ANTES do carimbo (mensagem a TODOS os ativos, no futuro do
    presente — é o que o torna de fato prévio) e DEPOIS (lembrete só a quem
    ainda não deu o re-aceite). Entra na fila de disparo do admin logo após
    "resultados" (antes ficava fora da lista e nunca aparecia).
  - **Ainda ABERTO dentro do 0.10.15:** **(J5)** não existe registro da DATA
    do carimbo — `DEFINIR_REGULAMENTO_VERSAO` só grava `regulamento_versao`,
    não quando trocou; decisão de schema (armadilha 4 do `CLAUDE.md` — coluna
    nova em `circuitos` derruba o app pro `anon` se o grant não vier junto),
    fica como gatilho separado, não decidida nesta rodada.

    **(J2) — 🚩 BLOQUEIA O PUSH. É o único item desta lista que não dá para
    fazer depois.** Não existe snapshot dos aceites de HOJE, e ele precisa ser
    tirado **antes de o app subir**, não antes de carimbar. Motivo: o
    `ACEITAR_REGULAMENTO` **sobrescreve** `versao_regulamento` no lugar, sem
    guardar o valor anterior — então **o primeiro atleta que re-aceitar apaga a
    prova** de sob qual texto ele estava. Como o card de re-aceite vai ao ar com
    o app, a janela entre o push e o primeiro clique é de minutos, e não é
    controlável. **Nenhum** atleta do BH está em v03-12 hoje (11 v03-3, 1 v03-5,
    1 v03-8, 1 v03-11, mais 1 suspenso em v03-3 — conferido no banco em
    19/09/2026); depois do push, esse estado só existe por arqueologia — e nem
    isso, se ninguém tiver copiado.

    **Conserto: um `SELECT` de `circuito_atletas` (atleta_id,
    versao_regulamento, data_aceite_regulamento, aceite_regulamento) salvo em
    `docs/backups/` antes do `git push` — das 15 linhas do BH, SEM FILTRAR POR
    STATUS.** Não são "as 12" nem "as 14": pendente e suspenso também carregam
    versão antiga e também logam.
    (Ver a tabela das três contagens no rascunho do `CHANGELOG.md`.) É
    leitura, não toca produção, e custa um comando. *(Jurídico J2; mesmo achado
    do Regulamento C2, que apontou o fallback do BH pelo outro lado.)*

    **(b2)**
    liquidar as 3 pendências de pagamento — não verificado nesta rodada,
    confirmar contagem antes de carimbar. **(d)/(e)/(f)** seguem como
    processo de publicação, não código — nada disto muda com o que foi
    construído. **0.10.22 continua aberto** — o (b) construído nesta rodada
    dá ao atleta um botão "Ler o regulamento" **só dentro do card de
    re-aceite**, ou seja, só quando a versão dele diverge da vigente. Quem já
    está em dia (inclusive todo mundo, hoje, antes do primeiro re-aceite)
    continua sem nenhum caminho para reler o texto estando logado — o item
    0.10.22 não foi fechado por este trabalho, só ficou mais visível que ele
    é pré-requisito do (c) também no sentido inverso: quem aceita hoje não
    consegue voltar a conferir o que aceitou.

  **(a) Construir o carimbo.** Hoje `regulamento_versao` é escrito em um lugar
  só, `CRIAR_CIRCUITO`. **Nenhuma ação altera a versão de um circuito existente**,
  então destravar exigiria `UPDATE` manual em produção — o que a regra 1 do
  projeto proíbe. Falta `DEFINIR_REGULAMENTO_VERSAO` (super-admin,
  confirmação-com-nome). *(Guardião de Segurança, 13/09/2026.)*

  Três exigências da ação, que só custam uma linha de especificação agora:
  **recusar valor vazio ou em branco** — hoje o único escritor do campo é o
  `CRIAR_CIRCUITO`, que sempre preenche; a ação nova vira um segundo escritor, e
  um carimbo em branco **fecharia as inscrições do circuito em silêncio** (o
  `INSCREVER` agora recusa 409 sem versão). **Recusar versão que não é daquele
  circuito** — carimbar `vA-nc-01` no BH hoje libera a virada E apaga o Cap. 10
  da tela; a lista do motor responde "esta versão promete desconto?", não "esta
  versão é deste circuito?", e a ação nova é o lugar certo para a segunda
  pergunta. E **`trim` no que for gravado**, porque o valor é digitado à mão.
  *(Jurídico e Regulamento, 14/09/2026.)*

  Junto com (a), três consertos de tela que o Regulamento condicionou ao mesmo
  momento, porque todos viram mentira no dia do carimbo:
  - **`trim` simétrico.** O motor perdoa espaço (`"v03-13 "` passa); a tela não
    normaliza nada. O mesmo carimbo que a bateria assevera que deve passar faz o
    **Cap. 10 sumir da tela do BH** e a cláusula de transição sumir junto —
    enquanto o `athlete-action`, que trima, carimbaria `"v03-13"` no aceite. O
    atleta receberia recibo de um texto que não viu. *(Regulamento C1.)*
  - **Matar o fallback do BH.** `App.jsx:1922` cai em `"v03-12"` quando a leitura
    falha, e `:1926` isenta o BH do aviso de versão desconhecida — com o
    argumento, escrito no próprio comentário, de que "no BH a versão É a do
    fallback". **Verdade hoje, falsa no segundo seguinte ao carimbo.**
    *(Regulamento C2; o guardião do Atleta achou o mesmo.)*
  - **Fechar o `PARTICIPAR`** — é o 0.10.18. *(Regulamento C3, Segurança A1.)*

  **(b) Construir o re-aceite.** O texto anterior deste item dizia que "a
  renovação é o momento natural de re-colher o aceite". **Era falso.**
  `athlete-action` → `RENOVAR` grava só `quer_renovar` e `renovacao_em`: não
  exibe texto, não pede caixa de seleção, não grava `versao_regulamento`. O
  aceite só é colhido no `INSCREVER`. E dos **14** com `status='ativo'` (os 12 do
  roster **mais** os 2 pendentes de inclusão — ver a tabela das três contagens no
  rascunho do `CHANGELOG.md`), **nenhum** tem v03-12: 11 em v03-3, 1 v03-5,
  1 v03-8, 1 v03-11. Sem construir isto, a
  temporada nova roda **com preço diferente** e os atletas entram tendo aceitado
  textos de várias versões atrás, cujo único ato terá sido apertar "quero
  renovar". O re-aceite tem de ser **passo próprio e obrigatório**, anterior ou
  simultâneo à virada. *(Guardião Jurídico, 13/09/2026.)*

  **DECISÃO DO JULIANO, 18/09/2026: quem não re-aceitar NÃO sai do pareamento.**
  *"não tira do pareamento se não der o aceite, mantém."* O Jurídico tinha
  sugerido travar a participação na temporada nova até o aceite ser dado. O
  Juliano decidiu o contrário, e a decisão é dele: o atleta continua sendo
  pareado e jogando normalmente, com ou sem re-aceite.

  O que sobra como mecanismo, e é o que foi construído: o atleta **vê** o aviso
  ao abrir o app, com o texto em vigor e a caixa de aceite; o admin **vê** quem
  ainda não aceitou; e o aviso prévio sai por mensagem, com registro. Ninguém é
  impedido de jogar. A consequência a registrar, para não haver surpresa depois:
  **o Clube pode chegar à temporada nova com atletas jogando sob uma versão que
  não aceitaram** — o risco que o (c) e a visibilidade do admin existem para
  reduzir, e que não some com eles.

  **DECISÃO DO JULIANO, 19/09/2026: "segue".** Com essa ordem curta, coube a
  mim decidir três coisas no lugar dele durante a construção — registradas
  aqui, com o motivo de cada uma, para não passarem por decisão dele sem
  terem sido:
  1. **Construí o aviso prévio (c)**, na forma que o Jurídico recomendou —
     dois modos, mensagem a todos antes do carimbo e lembrete a quem falta
     depois. Não era obrigatório para destravar a virada (só (a) e (b) são
     pré-requisito técnico), mas o Cap. 12 promete o aviso e o item já estava
     especificado; construir junto evita uma segunda rodada de revisão.
  2. **Não construí o registro da data do carimbo** — é decisão de schema
     (coluna nova em `circuitos`, armadilha 4 do `CLAUDE.md`: sem grant ao
     `anon` na mesma migração, o app cai para todo mundo) e muda o que fica
     gravado permanentemente. Fica como gatilho separado (J5, acima), não
     decisão implícita numa sessão sem ele.
  3. **Reverti o `veFinanceiro` que uma versão anterior do `login-atleta`
     tinha devolvido** — a liberação do financeiro do organizador está
     retida até o 1º circuito vendido, por decisão do Juliano já registrada
     no `CHANGELOG.md` (08 e 07/09/2026). Publicar o `login-atleta` para
     corrigir o fail-closed do `PARTICIPAR` (0.10.18) não pode, de passagem,
     antecipar uma liberação amarrada a outro gatilho — mesmo que o campo já
     estivesse no fonte antes desta sessão.

  Quatro peças que faltavam na primeira redação deste item, sem as quais ele se
  improvisa na hora *(Jurídico, 14/09/2026)*:
  1. **O que exibe:** o bloco de transição do **Cap. 12**, não o resumo do portão
     de aceite. O resumo já carrega a frase que **tira** o desconto e não carrega
     a que **protege** — no re-aceite o atleta leria só a metade ruim.
  2. **O que grava:** `versao_regulamento`, `data_aceite_regulamento` e IP — os
     mesmos campos que o `INSCREVER` escreve. Re-aceite que não grava a versão
     deixa aberto exatamente o buraco que ele existe para fechar.
  3. **Onde entra na ordem:** **depois** do carimbo (antes, a tela mostraria o
     texto da v03-12 enquanto pede aceite da v03-13) e **antes** de parear ou
     cobrar na temporada nova. A sequência do item (e) não o inclui hoje.
  4. **O que acontece com quem recusa:** recusar **não é abandono** (sem −30 de
     rating, sem bloqueio de temporada — o Cap. 12 pune "abandono sem
     comunicação", e recusar pelo app É comunicação, mas quem recusa não tem de
     deduzir isso) e **não gera cobrança**. As duas garantias ditas no aviso.

  E uma inversão de ênfase que vale corrigir: **o re-aceite é a prova**, não o
  log de envio. `REGISTRAR_MENSAGEM_ENVIADA` prova que o Clube **declarou** ter
  enviado — é registro do próprio clube. O atleta clicando "aceito a v03-13"
  prova ciência melhor que qualquer log. O item (c) é camada de apoio; este é a
  espinha.

  **E um mérito que este item não reivindicava:** hoje o Clube **não consegue
  produzir o texto que nenhum dos 14 aceitou** — `docs/` só tem v03-12 e v03-13;
  v03-3, v03-5, v03-8 e v03-11 não existem como documento em lugar nenhum, só por
  arqueologia no histórico do `App.jsx`. Depois do re-aceite, todos ficam numa
  versão cujo texto existe e está assinado. Isso promove (b) de higiene ao item
  de maior valor de todo o 0.10.15.

  **(b2) Liquidar as pendências da temporada 1/2026 ANTES do carimbo.**
  Decisão do Juliano, 15/09/2026: *"nada muda do circuito atual, todas as
  mudanças se houver vão ser para as próximas etapas"*. Isso não é só política —
  tem consequência mecânica, e ela é a razão de este passo existir.

  A v03-13 promete que quem ingressou na 2ª etapa e ainda não quitou **paga os
  80%**. O app **não consegue cumprir essa promessa depois da virada**, por dois
  motivos somados: `percentual_entrada_meio` é **um número por circuito, não por
  atleta** (vira 100 para todo mundo), e o `NOVA_TEMPORADA` sobrescreve
  `pagamento_confirmado` com `pagamento_proxima_confirmado || false`
  (`admin-action:1236` e `:1337`) — ou seja, **a dívida da temporada que acaba
  deixa de existir no modelo**. Ninguém é cobrado a mais; a conta é que some.

  Havia **3 atletas não pagos** em 15/09/2026. Enquanto a temporada 1/2026 está
  aberta, o percentual do BH é 80 e a tela de registro de pagamento calcula
  certo. Depois do carimbo e da virada, não.

  **CONTEXTO QUE ENCOLHE ESTE ITEM, e que estava faltando aqui:** a temporada
  **1/2026 foi gratuita de propósito — foi a temporada de teste**. Decisão do
  Juliano, dita mais de uma vez. Por isso `desconto_global_pct = 100` e os **12
  pagamentos registrados têm todos `valor = 0`**. Os 3 não pagos (2 ativos,
  1 suspenso) devem **R$ 0**.

  Logo: "liquidar as pendências" aqui são **três marcações de valor zero, não
  três cobranças**, e a cláusula de não-retroatividade não protege ninguém na
  1/2026 — ela vale a partir da 2/2026, que é quando o preço passa a ser
  cobrado de verdade. O passo continua obrigatório mesmo assim, porque a
  marcação precisa existir **antes** do carimbo: depois da virada o flag some.

  **Portanto, na sequência:** conferir as pendências (contagem antes), marcar ou
  baixar cada uma sob a regra da v03-12 — "baixar" == a regra que o Cap. 12 já
  define, o atleta fica **retido até regularizar**, não é sanção nova —, conferir
  de novo (contagem depois), e só então carimbar.

  *(O contexto da temporada de teste faltava aqui, e a falta custou caro: quatro
  agentes debateram 80% contra 100% sobre uma temporada de graça. O guardião de
  Segurança chegou a mencionar o `desconto_global_pct = 100` de passagem, como
  "contexto que ninguém escreveu", e ninguém ligou os pontos. Antes de escrever
  regra sobre valor: ler o valor.)*

  *(Achado pelo supervisor do guardião de Regulamento, que foi conferir o outro
  lado da cláusula que o Jurídico tinha redigido. O `pagamentos` guarda o
  histórico, então o registro contábil sobrevive — o que zera é o "quem deve".)*

  **(c) Dar o aviso prévio — e provar que deu.** Não é cortesia: o portão de
  aceite já promete, no texto que os 14 assinaram, que *"o regulamento pode ser
  atualizado com aviso prévio"*. O ônus de provar que cumpriu é do clube.
  - **Forma:** grupo oficial de WhatsApp **e** aviso dentro do app. Só o grupo é
    frágil — mensagem em grupo se perde e não prova entrega.
  - **Prazo:** antes da abertura das inscrições da temporada nova, com folga para
    o atleta escolher **não** renovar. Sugestão: **15 dias**. Não é prazo legal;
    é o que torna o aviso efetivo (CDC art. 46).
  - **Conteúdo, os três:** o que muda; a partir de qual temporada; e que quem
    ingressou na 2ª etapa da temporada em curso não é cobrado a mais.
  - **Prova:** usar `REGISTRAR_MENSAGEM_ENVIADA` — o registro nasce no banco, com
    data, em vez de num print.

  **(d) Carimbar e virar na MESMA sessão.** O app mostra a versão do circuito ao
  vivo. No instante do carimbo, quem se inscrever no meio da temporada corrente
  já lê o texto novo — enquanto a v03-13 declara que a temporada em curso segue
  pela v03-12. A janela entre carimbar e virar tem de ser de minutos, não de
  dias. *(Guardião de Segurança.)*

  **(e) Ordem em relação à publicação:** o app novo tem de estar **no ar antes**
  do carimbo. O app que está no ar hoje trata "tem torneio" e "tem desconto de
  etapa" como a mesma chave; carimbar v03-13 com ele no ar faria o BH **perder o
  Cap. 10 da tela**. Ordem: publicar → conferir a tela → liquidar as pendências
  (b2) → avisar → carimbar → virar. *(Guardião do Regulamento.)*

  **Dentro do "publicar", a ordem das duas metades é: MOTOR PRIMEIRO, APP
  DEPOIS.** Eu tinha escrito o contrário no resumo, e estava errado — o guardião
  de Confiabilidade tinha dito motor primeiro e eu sobrescrevi. A comparação que
  eu não tinha feito:

  - **Motor primeiro (certo):** a trava já está no ar quando o app antigo, que
    ainda faz dispatch otimista, manda `NOVA_TEMPORADA`. O servidor recusa com
    409 **antes de arquivar ou apagar qualquer coisa**; a tela pisca "virada" por
    segundos e o `loadFromSupabase` desfaz. **Nada é escrito no banco.** Glitch
    visual, autolimitado, confinado à aba do admin.
  - **App primeiro (o que eu tinha dito):** o app novo — já com o modal correto —
    manda a ação para o motor **velho, que não tem trava**. A virada **acontece
    de verdade**: arquiva, apaga partidas e chaves, zera stats e grava
    `percentual_entrada_meio: 100` sem ler o regulamento declarado. **Irreversível.**

  Um glitch de tela que não escreve nada é estritamente menos grave que uma
  virada irreversível com preço incompatível com o regulamento declarado.
  *(Supervisor do guardião de Confiabilidade, 15/09/2026.)*

  **(f) Decisão em aberto, dois guardiões discordam.** O Jurídico quer trocar o
  cabeçalho do `REGULAMENTO_TENIS_DE_MESA_v03-12.md` de "Versão vigente" para
  "Versão histórica — vigorou até a temporada 1/2026" no dia do carimbo, porque
  o rótulo passa a mentir. O Curador diz para **não** mexer: o v03-12 está
  intocado de propósito, é o registro do que os atletas aceitaram, e o padrão do
  projeto é o texto **novo** declarar o que substitui. **Decisão do Juliano.**

- **0.10.16 — Não existe tela para dar desconto a um atleta.** Gatilho: **junto
  com 0.10.15**, e antes de afirmar que a regra nova está em pé.
  `DEFINIR_DESCONTO_ATLETA` está no motor, testada e na allowlist do organizador
  — e **não existe em tela nenhuma**. Enquanto o desconto de 80% era automático
  isso não doía (era o 0.6.8, adiado). Agora dói: depois de 12/09 é o **único**
  mecanismo declarado para conceder desconto ou isenção, e o texto que o atleta
  aceita **promete** que "eventual desconto é decisão exclusiva do organizador".
  Prometemos no contrato uma coisa que o app não consegue fazer. O contorno que
  existe (campo "Desconto individual (%)" ao registrar pagamento manual) grava
  `desconto_pct_aplicado` **naquele pagamento**, não em `atletas.desconto_pct` —
  então o atleta **nunca vê o preço combinado antes de pagar**, e não há isenção
  persistente. *(Guardião de Operações, 13/09/2026.)*

- **0.10.20 — ✅ FEITO (19/09/2026, no fonte — não publicado). A virada de
  temporada não pedia confirmação-com-nome.** Construído junto do 0.10.15, que
  é quando a trava sai da frente; sobe no mesmo pacote. O texto abaixo é o
  registro do porquê.
  O `CLAUDE.md` estabelece o padrão da casa: *"mudança destrutiva pede
  confirmação-com-nome (digitar o nome do circuito)"*, e o `CancelarCircuitoCard`
  já o implementa (`App.jsx:7313-7398`). A `NOVA_TEMPORADA` **não** — é a ação
  mais destrutiva do app (arquiva o ranking, apaga partidas e chaves, zera stats
  de todos os ativos, **não pode ser desfeita**) e hoje está protegida só por dois
  botões num modal. Não bloqueava agora porque a trava do regulamento impede
  qualquer virada do BH; vira a única barreira no dia em que a trava cair — e é
  exatamente por isso que foi fechado antes de a trava cair.
  *(Guardião de Operações, por iniciativa própria; o supervisor dele condicionou
  o APROVADO a este registro — eu tinha deixado o achado sem levar ao documento.)*

- **0.10.21 — `DEFINIR_FINANCEIRO` muda o preço da temporada ABERTA sem olhar o
  regulamento.** Gatilho: **antes de nomear o 1º organizador**, ou antes de
  afirmar em qualquer lugar que "o preço só muda com o carimbo".

  A trava da Onda 0.10 protege a **virada** (`NOVA_TEMPORADA` recusa 409 enquanto
  o circuito declarar uma versão que promete desconto). Ela **não protege o
  preço**. O `DEFINIR_FINANCEIRO` escreve `percentual_entrada_meio` direto na
  `configuracao` — a tabela viva da temporada em curso do BH — **sem checar
  `regulamento_versao` em momento nenhum**. É a mesma ação cujo defeito (J1)
  disparou metade desta onda: consertamos "campo vazio não vira número
  inventado", e não tratamos "esta ação muda o preço da temporada aberta a
  qualquer hora, sem carimbo, sem trava, fora da sequência do 0.10.15".

  **O item (d) do 0.10.15 não cobre isto** — ele fecha a janela entre carimbar e
  virar, e este caminho nem passa por ela.

  **Severidade hoje:** baixa, e por configuração, não por código.
  `org_ve_financeiro` do BH está `false`, então só o super-admin alcança a ação
  no BH. Nada no código impede o próprio Juliano de mudar o percentual da
  temporada 1/2026 amanhã, sem querer, sem que apareça em lugar nenhum que isso
  contraria o texto que os atletas aceitaram.

  **Duas saídas, e a escolha é do Juliano:** (a) espelhar a trava — recusar
  baixar o percentual do BH abaixo do que a versão declarada promete, enquanto
  ela estiver em `VERSOES_COM_DESCONTO_ETAPA`; ou (b) aceitar como está, e então
  **isto fica registrado como confiança operacional no super-admin, não garantia
  de código** — e ninguém pode escrever depois "o app garante que o preço só muda
  com o carimbo", porque a linha que sustentaria essa frase não existe
  (`CLAUDE.md`, regra 6).

  *(Levantado pelo guardião de Segurança (M4) e, independentemente, pelo
  supervisor do Jurídico, que o classificou como a resposta que faltava à
  pergunta "existe caminho em que alguém pague diferente do que aceitou?".)*

- **0.10.22 — O atleta logado não tem como reler o regulamento.** Gatilho:
  **antes do aviso prévio do 0.10.15(c)** — é o mesmo momento e o mesmo público.
  **Contagem atualizada em 19/09/2026 (o item continua ABERTO).** Eram **dois**
  pontos de entrada da `RegulamentoView`; hoje são **três**, e o terceiro não
  fecha o item:
  - `App.jsx:1595` — link "Regulamento oficial" da tela de login;
  - `App.jsx:1690` — "Ver regulamento" do fluxo de inscrição;
  - `App.jsx:9897` — **novo**, dentro da `ReAceiteRegulamentoCard` (0.10.15(b)).

  Os dois primeiros seguem **inalcançáveis depois do login**. O terceiro é
  alcançável logado, mas **condicional**: o card só renderiza para quem tem
  `versao_regulamento` diferente da vigente do circuito. Quem está **em dia** —
  o que inclui *todo mundo* depois do primeiro re-aceite, e é justamente o
  estado em que a pessoa quer conferir o que aceitou — continua sem porta. Quem
  já é do clube e está em dia precisaria **deslogar** para ler o texto que
  aceitou. (As duas primeiras linhas diziam `:1575` e `:1670`; o arquivo andou.)

  Isso é mais grave do que "a cláusula de transição só aparece para quem abre o
  Cap. 12": a cláusula **não tem porta de entrada nenhuma** a partir de onde o
  atleta logado está — e o atleta logado que vai renovar é exatamente o grupo
  que ela protege. Some-se a isso que a `RenovacaoCard` mostra só o preço final
  calculado, sem versão de regulamento e sem aviso de que algo mudou.

  **Conserto:** um caminho **incondicional** para a `RegulamentoView` a partir
  da área do atleta — o `:9897` já provou que a tela recebe os parâmetros certos
  de dentro do logado (`versao`, `sistema`, `circuitoNome`); falta só um ponto
  de entrada que não dependa de a versão estar divergente.
  Barato, e destrava o 0.10.15(c) — não adianta avisar "mudou o regulamento" se
  a pessoa não consegue abrir o regulamento.

  *(Guardião do Atleta, 15/09/2026, respondendo a uma pergunta do supervisor
  dele. Ele varreu os pontos de entrada em vez de supor.)*

- **0.10.23 — Trocar de circuito e salvar o financeiro na mesma janela grava o
  preço do circuito errado.** Gatilho: **antes de existir o 2º circuito.**
  `trocarCircuito` (`App.jsx:4953-4963`) faz `setCircuitoSelId(circ.id)` **antes**
  do `await loadFromSupabase()`. Como `AdminFinanceiro` tem `key={circuitoSelId}`
  (`:6604`), ele remonta na hora e o `useEffect` de pré-preenchimento (`:6646`)
  enche os campos com o `state` daquele instante — ainda o do circuito
  **anterior** — enquanto o `chamarAdminAction` já aponta para o novo. Salvar
  nessa janela grava o preço do circuito A sobre o B.

  Janela de um round-trip, não de um frame, e **inalcançável hoje**: existe 1
  circuito, e `trocarCircuito` retorna cedo se o id for o ativo. Conserto de uma
  linha: mover o `setCircuitoSelId` para depois do `await`, junto do
  `setCircuitoAtivo` que já é revertido no `ok === false`.

  *(Supervisor do guardião de Segurança, 15/09/2026 — achado ao tentar salvar um
  achado maior que tinha caído na verificação. Ele registrou o próprio erro com a
  mesma precisão: o `grep` dele era sensível a maiúscula, não casou com
  `setDescGlobal`/`setPctMeio`, e ele leu a ausência de resultado como prova de
  ausência de código.)*

- **0.10.24 — O desempate do Sistema B está protegido em 3 dos 5 níveis.**
  Gatilho: **o dia em que o primeiro circuito de pontos abrir temporada** — o
  mesmo do 0.10.18.
  O cenário novo da virada do Sistema B discrimina **pontos → menos W.O. culposo
  → aproveitamento**, cada um com mutação que acende. Faltam dois níveis do
  `cmpRankingB` (`admin-action:392`):
  - **confronto direto** (nível 3): a função `confrontoDiretoDB` **já está
    discriminada** no bloco do Sistema A — lá, remover o nível acende. O que
    falta é provar a presença dela **na cadeia do B**, não a função em si.
  - **saldo de sets** (nível 5): `saldoSetsB` é exclusivo do Sistema B e está
    **de fato descoberto**. Remover o nível hoje deixa a bateria verde.

  Não bloqueia porque o Sistema B **não tem circuito em produção** — o próprio
  comentário do motor o chama de "inerte pro BH até a Fatia 2". Mas é débito
  conhecido, e a regra que a bateria já aplica ao `PARTICIPAR` (0.10.18) vale
  aqui: débito sem registro é débito esquecido.

  **A regra de teste que saiu desta rodada, e que generaliza:** cenário que
  discrimina N níveis roda **N mutações, inclusive a do primeiro** — a intuição
  de que "o nível primário obviamente decide" foi exatamente o que falhou três
  vezes aqui (a ordem de inserção acidental, o confronto direto comendo o
  aproveitamento, e o nível dos pontos do Sistema B). Vale para toda guarda em
  cadeia: permissões, validação de payload, desempates.

  *(Supervisor do guardião de Regulamento, 3ª rodada, condicionando o APROVADO a
  este registro.)*

- **0.10.17 — O banco ainda aplica a regra que o regulamento removeu.**
  Gatilho: **antes do próximo `CRIAR_CIRCUITO`**. `circuitos.percentual_entrada_meio`
  e `configuracao.percentual_entrada_meio` têm `DEFAULT 80` em produção
  (conferido em 13/09/2026). O motor grava 100 explícito, e isso está asseverado
  — mas qualquer linha inserida sem a coluna pega 80 do banco. Migração de uma
  linha: `SET DEFAULT 100` nas duas. *(Guardiões do Regulamento e de Segurança.)*

- **0.10.18 — ✅ FEITO (19/09/2026, no fonte — não publicado). O `PARTICIPAR`
  do `login-atleta` gravava aceite sem saber a versão.**
  A guarda está em `login-atleta/index.ts` (hoje `:266-276`): lê
  `String(circ.regulamento_versao ?? "").trim()`, recusa **409
  `versao_regulamento_indisponivel`** se vazio — colocada junto das outras
  guardas do circuito, **antes do backfill de CPF**, para uma tentativa recusada
  não chegar a registrar dado pessoal — e o insert em `circuito_atletas` (`:328`)
  passou a carimbar a variável em vez de `circ.regulamento_versao || null`.
  Isso muda o gatilho do 0.10.19: **o `login-atleta` deixou de estar fora do
  pacote** (ver abaixo). O texto original do achado segue como registro.

  Gatilho original: **antes do primeiro circuito não-BH abrir inscrições.**
  `login-atleta/index.ts:314` (numeração de antes do conserto) gravava
  `aceite_regulamento: true` com
  `versao_regulamento: circ.regulamento_versao || null`. Com a versão ausente,
  nasce um **recibo de consentimento que não aponta para texto nenhum**. É o
  mesmo defeito que a Onda 0.10 fechou no `athlete-action` (que agora recusa
  409), na função irmã — e o `PARTICIPAR` é um fluxo de aceite de verdade: é o
  card "Entre em outro circuito aberto reusando o seu cadastro".

  **Por que não foi corrigido junto — razão VENCIDA em 19/09/2026:** o
  `PARTICIPAR` recusa o BH por construção (`circ.slug === "bh"` → 400) e não
  existe 2º circuito, então era inalcançável. Corrigi-lo obrigaria a publicar o
  `login-atleta`, que carregava uma mudança de escopo alheio (`veFinanceiro`).
  **Essa objeção caiu quando o `veFinanceiro` foi revertido do arquivo** — sem
  a carona, publicar o `login-atleta` passou a custar só o que ele mesmo mudou.

  **Conserto:** a mesma guarda do `INSCREVER` — `String(circ.regulamento_versao
  ?? "").trim()`, recusar 409 se vazio, **antes** do insert em
  `circuito_atletas`, e carimbar a variável. Nasce com asserção e mutação.

  **Registro de honestidade:** a bateria afirmava que esta função "segue
  fail-closed — as duas funções concordam agora". Era falso nas duas metades.
  Achado pelo guardião de Segurança em 14/09/2026; a asserção foi reescrita para
  dizer o que o código faz, e agora exige que este item continue existindo aqui.
  *(Segurança A1; mesmo achado do Regulamento C3.)*

- **0.10.19 — ⚠️ SUPERADO em 19/09/2026. O `login-atleta` ficou fora do pacote
  da Onda 0.10 (16/09) de propósito — mas voltou para dentro.**
  Gatilho original: **quando alguém for publicar o financeiro do organizador.**

  **O que mudou.** Escrito em 16/09, este item dizia "o arquivo **não foi
  tocado** nesta onda". **Isso deixou de valer:** em 19/09 o `login-atleta`
  recebeu a guarda fail-closed do `PARTICIPAR` (0.10.18) — que é assunto da
  própria Onda 0.10 — e, no mesmo movimento, **perdeu** o `veFinanceiro` que era
  a única razão de ele estar de fora. A carona foi desfeita em vez de
  embarcada: ver a decisão 3 registrada dentro do 0.10.15.

  Resultado: o `login-atleta` **sobe com o pacote, como v8 → v9**, e o que ele
  carrega agora é exatamente o assunto da onda, com nome próprio no resumo — que
  era a condição que este item exigia. O que **continua** amarrado ao gatilho
  original é só o **financeiro do organizador** (`org_ve_financeiro` /
  `veFinanceiro`): esse não entra, e o 0.10.6 registra o que falta dele.

  **Texto original, como registro do critério** (ele continua certo; só não se
  aplica mais a este arquivo): o que o faria subir como "v9" era o repositório
  estar à frente do ar desde o pacote anterior, e o que estava à frente era
  **funcional e de outro assunto** — o `LOGIN_ORGANIZADOR` lia
  `org_ve_financeiro` e devolvia `veFinanceiro`, que o app usa para mostrar ou
  esconder a aba "Pagam." do organizador. Nada na 0.10 dependia disso, e o
  efeito é nulo (`org_ve_financeiro = false` no único circuito, e o BH não
  admite organizador). Entraria de carona numa onda sobre regulamento, sem
  asserção e sem constar do resumo aprovado — se desse errado, ninguém
  procuraria a causa ali. Quando subir, sobe com nome próprio.
  *(Segurança C1; o Juliano foi avisado e não objetou. Superação registrada
  pelo Curador em 19/09/2026.)*

## Onda 1 — Piloto real ⬅️ **é aqui que estamos**

**Abrir um 2º circuito de verdade** (Sistema B, outra cidade), com atletas
reais, e rodar uma temporada curta. É ação do Juliano — o código e o dado já
estão destravados.

É o teste que nenhum harness substitui: descobre o que quebra na operação, não
no cálculo. Tudo na Onda 2 fica melhor decidido depois dele.

## Onda 2 — Pagamento (o que destrava a venda)

Hoje o financeiro é Pix manual: o atleta paga por fora e o admin confirma na
mão. Enquanto não confirmado, o atleta não é pareado.

- **2.1 — Decidir o modelo.** `PLANO_PAGAMENTOS.md` é o documento de decisão, e
  ainda não foi decidido. Quem paga: o organizador, o atleta, os dois?
- **2.2 — Integração Asaas.** Desenhada em `PLANO_PAGAMENTOS_FATIA5_INTEGRACAO.md`,
  **nada implementado**. As tabelas `cobrancas` e `circuito_cobranca` já existem
  no banco, vazias. Pré-requisitos que bloqueiam o go-live estão listados lá —
  entre eles conta Asaas com KYC concluído e revisão jurídica das minutas.
- É a única frente onde **dinheiro se move**. Guardião de Segurança obrigatório
  em cada passo, e nunca guardar cartão — tokeniza no gateway.

## Onda 3 — Onboarding do organizador

Hoje só o super-admin cria circuito. Para escalar, o organizador precisa criar o
próprio, sozinho, com os limites do plano dele. Inclui cadastro de organizador e
aceite dos termos.

## Onda 4 — Legal e marca

- Revisão jurídica de `TERMOS_ORGANIZADOR.md` e `POLITICA_PRIVACIDADE.md`
  (também bloqueiam a Onda 2).
- Confirmar o nome legal do controlador e o canal de exercício de direitos.
- Registro da marca no INPI — o símbolo gráfico é o ativo protegível; o nome é
  descritivo.
- Domínio neutro: o site segue em `clubedotenisdemesabh.com.br` (com "bh"),
  enquanto a plataforma é nacional. Decisão de negócio, não técnica — troca de
  domínio junto com a Onda 4. *(O nome do app já foi resolvido em 08/09/2026:
  "Clube do Tênis de Mesa", sem "BH" — ver `docs/curadoria-log.md`. Só o
  domínio ficou pendente.)*

## Onda 5 — Operar em escala

Painel de números com cuidado de LGPD, monitoramento e alertas, backups
verificados, plano de incidente, suporte e documentação para organizadores.
Revisar limites (quantos circuitos e atletas aguentam) e um passe de segurança
geral antes de abrir cadastro para terceiros.

---

## Decisões ainda em aberto

- **Rating nacional × rating por circuito.** Hoje o rating é global: o atleta
  leva o dele para qualquer circuito. Faz sentido quando os circuitos jogam
  entre si; é discutível quando são independentes. Não decidido.
- **Aposentar o PIN global do super-admin** (Fatia 4 de `historico/PLANO_PAPEIS.md`).
  A autorização por organizador já funciona ao lado dele. Nunca foi feito, de
  propósito: o Juliano não pode perder acesso durante a transição.
- **O que pode ser anunciado como pronto.** O índice do projeto diz para não
  anunciar o Sistema B nem a plataforma como prontos; na prática estão no ar,
  sem piloto. Só o Juliano decide o que comunicar.

## Fora do escopo — decidido não fazer

- **Trocar a versão do regulamento de um circuito pelo card de configuração.**
  *(28/09/2026 — ver 0.10.7, terceira ponta.)* Não se faz por configuração. Trocar
  uma versão já aceita faria o aceite de cada atleta **apontar para um texto que ele
  nunca leu** — o recibo aponta para uma *string*, e a tela renderiza o texto de
  hoje para aquela string. O caminho legítimo **existe** e é outro:
  `DEFINIR_REGULAMENTO_VERSAO`, só super-admin, com confirmação pelo nome do
  circuito, no card **📋 Regulamento deste circuito** — e com aviso prévio e
  re-aceite, como a v03-12 → v03-13 vai usar. É a regra 7 do `CLAUDE.md`.

Registrado para não voltar à mesa a cada conversa. Cada item tem o porquê.

- **Push nativo no celular** para os despachos do dia. O lembrete diário
  agendado já resolve; push nativo exige app empacotado nas lojas.
- **Escolher o número de rodadas por temporada.** Fixo em 6 (Cap. 13 do
  regulamento). A ação `DEFINIR_RODADAS` continua existindo, mas só devolve
  erro — a escolha foi removida do app de propósito.
- **Região como trava de inscrição.** O aviso de cidade/UF é informativo; quem
  aprova ou recusa é o organizador. Trava automática rejeitaria atleta legítimo
  que joga fora da cidade.
- **Guardar dados de cartão.** Nunca. Tokeniza no gateway, sempre.
- **Reverter uma partida isolada no Sistema A.** Impossível por construção: o
  rating depende da ordem dos jogos. Desfazer é sempre recalcular a temporada do
  zero — ver `PLANO_DESFAZER_PROCESSAMENTO.md`, com a prova de que o recálculo
  reproduz o estado exato (240/240 cenários).
- **Dividir o `App.jsx` em módulos.** Não há build que justifique, e o arquivo
  único é o que o projeto sabe operar.

## O que está ativo em `docs/`

| Documento | É |
|---|---|
| `ROADMAP.md` | este arquivo — o que fazer a seguir |
| `PLANO_PAGAMENTOS.md` | decisão de modelo, **não decidida** |
| `PLANO_PAGAMENTOS_FATIA5_INTEGRACAO.md` | desenho da integração Asaas, **não implementada** |
| `PLANO_DESFAZER_PROCESSAMENTO.md` | design provado (240/240), **não implementado** |
| `GOVERNANCA_AGENTES.md` | quem revisa o quê + histórico de vereditos |
| `CHANGELOG.md` | o que foi ao ar, com a versão de cada função |
| `ESTADO-DEV-app-tenis-de-mesa.md` | retrato do desenvolvimento |
| `REGULAMENTO_*` | as regras da competição — A: v03-12 (BH, vigente) + v03-13 (BH, próxima temporada, ver 0.10.15); `vA-nc-01`/B `vB-01` (circuitos novos) em `REGULAMENTOS_NOVOS_CIRCUITOS.md`, sem `.md` canônico próprio ainda (ver 0.10.3) |
| `TERMOS_ORGANIZADOR.md`, `POLITICA_PRIVACIDADE.md` | minutas, **sem revisão jurídica** |
| `ESPEC_CPF_SEGURANCA.md`, `SEGURANCA_RPC_AUDIT.md` | como o CPF é blindado |
| `historico/` | planos concluídos, guardados pelo porquê |
