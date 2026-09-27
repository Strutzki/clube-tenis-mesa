> **Consolidado em 10/09/2026, por decisão do Juliano:** `docs/` é o registro
> ÚNICO do curador. A pasta `claude/` (que tinha um par índice+log congelado
> desde 05/09) foi removida e a entrada dela de 08/09 foi trazida para cá. O
> follow-up aberto em 06/09 — "alinhar referências a `claude/`" — fica assim
> encerrado. O histórico do que foi removido continua no git.
>
> **Auto-correção, mesma data:** a primeira versão desta consolidação colou o
> "2026-09-05 — Bootstrap" e o "Antes de 2026-09-05" de `claude/curadoria-log.md`
> logo abaixo da entrada de 08/09 — sem notar que esse mesmo conteúdo, byte a
> byte, já vivia mais abaixo neste arquivo (era o par congelado desde 05/09,
> idêntico nos dois lados). Resultado: as duas entradas apareciam duplicadas.
> Achado na auditoria do Curador do Projeto e removida a cópia recém-colada;
> a cópia original (mais abaixo, sob "2026-09-05 — Bootstrap da curadoria...")
> é a que fica.

## 2026-09-19 (rodada final) — 3ª revisão do 0.10.15: colisão de numeração e quatro itens fantasma

Segunda passagem minha no mesmo dia, sobre a árvore da **rodada final**. A
entrada anterior (logo abaixo) continua válida para o que ela cobriu; esta
registra o que mudou depois dela.

**Congelamento conferido, não aceito de palavra.** Os **8 md5** que o
coordenador declarou batem com o que li: `src/App.jsx`, `admin-action`,
`athlete-action`, `regulamento-por-circuito.mjs`, `contador-mensagens.mjs`,
`ROADMAP.md`, `CLAUDE.md`, `testes/README.md`. Editei `docs/**` e `CLAUDE.md`
(mandato); **não toquei** em `src/`, `supabase/` nem `testes/`.

**Bateria somada por mim, seção a seção** — 4 + 38 + 20 + 24 + 25 + 24 + 11 + 16
+ 22 + 351 = **535, 0 falhas**. Confere com o número que o coordenador já tinha
posto no `CLAUDE.md` e no `testes/README.md`. Build não rerrodei: a árvore de
código está intocada desde a verificação dele.

### O achado da rodada: o ROADMAP tinha quatro itens e dois números

Os dois itens criados nesta rodada nasceram `0.10.23` e `0.10.24` — **ocupados
desde 15/09** por outros dois. Renumerei os **novos** (os antigos já estavam
citados neste log e em pareceres): marca no cabeçalho da `RegulamentoView` →
**0.10.25**; link do card do admin → **0.10.26**. Cada um levou nota de
procedência, para quem procurar o número antigo num parecer de hoje.

Vale como lição de curadoria, não só como conserto: **numerar item novo sem
varrer os números já usados** é barato de fazer e caro de achar depois — dois
pareceres podem citar "0.10.23" querendo dizer coisas opostas. Um `grep` de dez
segundos evita.

### O padrão que se repetiu: "feito no bloco de status, aberto na entrada-mãe"

O coordenador me avisou de **um** caso (0.10.20) e pediu que eu conferisse os
demais. Eram **quatro**, todos com a mesma forma — o bloco de status do 0.10.15
registrava o feito, e a entrada-mãe do item seguia no texto original, lendo como
trabalho pendente:

| Item | Como lia | Verdade em 19/09 |
|---|---|---|
| 0.10.20 | "a virada não pede confirmação-com-nome" | FEITO no fonte |
| 0.10.18 | "grava aceite sem saber a versão" + "por que não foi corrigido" | FEITO (`login-atleta:266-276`, 409) |
| 0.10.19 | "o arquivo **não foi tocado** nesta onda" | **falso** — foi tocado; item SUPERADO |
| 0.10.6 | "o repo difere do ar em **uma coisa**: `org_ve_financeiro`" | **invertido** — esse trecho saiu do repo |

O 0.10.19 e o 0.10.6 são os graves, porque não são "status atrasado": são
**afirmações que o código contradiz**. O `login-atleta` recebeu a guarda do
0.10.18 e perdeu o `veFinanceiro`; com isso ele **volta para dentro do pacote**
(v8 → v9) e a razão pela qual estava fora deixou de existir. Quem publicasse
lendo só o 0.10.19 concluiria que o `login-atleta` não sobe.

### 0.10.22: premissa corrigida, item segue aberto

Dizia "só existem **dois** pontos de entrada da `RegulamentoView`". São três
(`App.jsx:1595`, `:1690`, `:9897`) — o terceiro nasceu do 0.10.15(b). Não fecha
o item: é **condicional**, só renderiza para quem diverge da versão vigente.
Quem está em dia — todo mundo, depois do primeiro re-aceite — continua sem
porta. Reescrevi mantendo o item aberto e dizendo por quê.

### CLAUDE.md: três correções

1. "A bateria cobre o motor, não o app" ficou imprecisa de novo. Hoje a bateria
   **executa** `admin-action` e `athlete-action` (esta com **8 cenários**, não
   só a guarda do `INSCREVER`) e **nada do app**. Reescrita com a distinção que
   importa: o que é executado × o que é lido por regex.
2. O texto citava `carregarMotor`. **Essa função não existe** — é
   `carregarFuncao` (`testes/carrega-motor.mjs:31`), conferido por `grep`, e é
   chamada para exatamente duas funções. Um nome errado num documento que
   instrui sessões futuras manda a próxima pessoa procurar o que não há.
3. A convenção de confirmação-com-nome dizia "padrão já adotado nas ações que
   apagam" — a virada era a exceção silenciosa, e deixou de ser. Passou a
   nomear os três pontos e a pedir registro de qualquer exceção nova.

### Governança: três lições registradas

(a) **Asserção por regex fica verde com a regra quebrada** — com a tabela das 3
mutações nomeadas que provaram isso no re-aceite. (b) **Duas guardas
fail-closed cercando o mesmo estado = impasse** (nem carimbar nem virar), visto
só ao rodar a bateria; é a origem do procedimento obrigatório da virada.
(c) **`no-undef` não pega propriedade inexistente** em objeto que existe.
Conferi (c) antes de registrar: `state.circuitoSlug` e `state.sistema` de fato
não existem (o `state` está em `App.jsx:755`) **e não chegaram à árvore
congelada** — registrei como lição de portão, explicitamente **não** como
defeito no ar, para o documento não acusar um bug que não existe.

### CHANGELOG: rascunho, não histórico

Escrevi a entrada da publicação **no topo, marcada ⏳ RASCUNHO — NÃO
PUBLICADO**, com aviso em citação para quem abrir o arquivo querendo saber o
que está no ar. Traz versões (`admin-action` v60→v61, `athlete-action` v20→v21,
`login-atleta` v8→v9), a **ordem** (as três funções primeiro, app depois, com o
porquê), o procedimento obrigatório da virada, as fontes de rollback (a pasta
`BACKUPS/`, **não** o git, para o `login-atleta`) e uma **linha em branco para
o registro datado do carimbo** — o passo (e), que enquanto o J5 não existir no
banco é a única prova de quando o contrato mudou. No dia: datar e mover.

**Nada foi publicado.** O histórico real continua terminando em 16/09, e
conferi que a entrada de 16/09 descreve só o que de fato foi ao ar.

### 0.10.27: o achado sem número ganhou número

O `entrypoint_path` de `circuito-dados` (v4) e `despachos-do-dia` (v6)
apontando para pasta de rascunho do projeto de torneios — achado meu na rodada
anterior — vivia **só neste índice**. Virou o ROADMAP **0.10.27**, porque quem
procura trabalho a fazer olha o ROADMAP, não o log do curador. Sinalizado, não
corrigido: deploy não é mandato do Curador.

### Varredura além do pacote: três docs que ninguém citou nesta onda

Fui olhar o que a onda não tocou, e é onde estava o drift mais silencioso.

**`ESTADO-DEV-app-tenis-de-mesa.md` — o pior caso do dia.** É o documento que o
`CLAUDE.md` manda ler primeiro ("Comece por ele") e listava as Edge Functions
**seis deploys atrasadas** (admin-action v54, athlete-action v17, login-atleta
v5, circuito-dados v2, sem `despachos-do-dia`). Um doc de entrada errado é pior
que um doc de canto errado: ele calibra tudo que a pessoa lê depois. Corrigido,
com aviso de que a linha envelhece a cada deploy e ponteiro para
`npm run motor:listar` — porque a correção de hoje também envelhece. Marquei o
resto do documento como não-revisado (segue sendo o retrato de 05/set), para a
correção pontual não dar ao arquivo inteiro uma aparência de atualidade que ele
não tem.

**Referências órfãs a `INDICE_PROJETO.md`.** O arquivo foi removido em
06/09/2026; o próprio `curadoria-log.md` abriu o "alinhar referências" como
follow-up opcional naquele dia e **ninguém fechou em duas semanas**. Corrigi em
`docs/agente-curador-projeto.md` e `docs/GOVERNANCA_AGENTES.md`.

⚠️ **Deixei duas de propósito, e elas são as que mais doem:**
`.claude/agents/curador-projeto.md:55` e `.claude/agents/supervisor-curador.md:27`
mandam manter/consultar `INDICE_PROJETO.md`. Isso é **configuração de agente**,
não acervo — fora do meu mandato, e não é coisa que eu mude por conta própria
nem a pedido de outro agente. O efeito prático é concreto: todo Curador e todo
Supervisor-Curador que nascer vai procurar um arquivo inexistente e pode
concluir que o índice "sumiu". **Precisa do OK do Juliano** — é uma troca de
nome em duas linhas.

**`LEIA-ME.md`** dizia "40 documentos"; contei: são 37 + o LEIA-ME, mais 12 em
`historico/`. Era a outra metade da mesma pendência de 06/09. Fechada.

**VEREDITO: Curador GO (curadoria) — supervisor-curador APROVADO na 2ª
iteração.** A 1ª devolveu REVISAR com dois itens (a contradição 12×14 e uma
órfã que eu tinha deixado passar); ambos fechados, detalhe abaixo.

### Devolvido pelo supervisor (REVISAR) — e ele estava certo

**"12" × "14" atletas ativos do BH, na mesma entrada do rascunho.** Eu propaguei
"14 ativos" para o CHANGELOG copiando a frase do ROADMAP **sem conferir**, e a
entrada ficou se contradizendo a duas dezenas de linhas de distância. É
exatamente a falha que a regra da casa proíbe: número por impressão.

**Fui ao banco** (leitura, `select` em `circuito_atletas` do BH, 19/09/2026). Os
dois números estavam **certos** — mediam coisas diferentes, e nenhum documento
dizia qual. São **três**:

| Nº | O que é | Onde vale |
|---|---|---|
| **12** | `status='ativo'` **e** `pendente_circuito=false` | o **roster** — o que o motor pareia (`getAtivosNoCircuito`, `admin-action:177`, que filtra `pendente_circuito=false`) e o que o painel conta |
| **14** | `status='ativo'`, incluindo os **2 pendentes de inclusão** (v03-11, v03-8) | quem **vê** a pergunta do re-aceite no app — a origem do bug "o painel dizia ✓ todos aceitaram" da 2ª rodada |
| **15** | **todas** as linhas do BH, incluindo **1 suspenso** (v03-3) | o escopo certo do **snapshot do J2** |

Consequência que só apareceu por causa disso: **o snapshot do J2 que eu tinha
escrito estava com o escopo errado.** Eu dizia "os 14 ativos"; o certo é copiar
as **15 linhas, sem filtrar por status** — pendente e suspenso também carregam
versão antiga e também conseguem logar, logo também podem sobrescrever o campo.
Um snapshot filtrado teria perdido exatamente as 3 pessoas mais fáceis de
esquecer. Corrigido no ROADMAP e no CHANGELOG, com a tabela acima embutida no
rascunho para o choque não voltar.

Verifiquei também todas as outras ocorrências de 12/14/15 nos documentos: são
consistentes com esse modelo (o "14 atletas ativos" do CHANGELOG de 10/09 é
`status='ativo'` e segue correto como registro histórico).

**Erro meu, achado na mesma varredura:** escrevi "a tabela do `testes/README.md`
lista 7 de **15** arquivos". São **14** (`ls testes/*.mjs`). Contei e corrigi no
índice e no `CLAUDE.md`. Eu tinha acabado de criticar contagem não conferida e
cometi uma na mesma página.

**Órfã que eu deixei passar:** o supervisor apontou que corrigi
`docs/agente-curador-projeto.md` e esqueci `docs/agente-supervisor-curador.md:10`
— o espelho do mandato dele, com a mesma referência a `INDICE_PROJETO.md`, e
dentro de `docs/`, ou seja, do meu mandato. Corrigido. Ele concordou com o
limite que tracei em `.claude/agents/` (configuração, não acervo).

### O que precisa do OK do Juliano (não fiz)

Nada de conteúdo com efeito real foi alterado por mim: não toquei em texto de
regulamento, política, marca nem código. Tudo acima é acervo — status, números,
numeração, procedência e registro de lição.

Depende dele: **(1)** a publicação em si; **(2)** o preenchimento do carimbo
datado no dia; **(3)** o **snapshot do J2 antes do push**, que é o único aberto
irreversível; e **(4)** trocar `INDICE_PROJETO.md` pelo nome real do índice nas
duas linhas de `.claude/agents/` — configuração, que eu não mexo.

## 2026-09-19 — Curadoria do 0.10.15 (a)+(b)+(c): construído, nada publicado

**Árvore congelada, provada por hash (md5, duas leituras idênticas), antes e
depois desta rodada:** `src/App.jsx`, `admin-action`, `athlete-action`,
`login-atleta`, `testes/regulamento-por-circuito.mjs`, `testes/erros-na-
tela.mjs` — nenhum tocado por mim. `docs/ROADMAP.md` também estava na lista
de hashes congelados (para prova de proveniência dos guardiões), mas é
acervo — editei, como o meu mandato permite e esta rodada pediu.

**Números conferidos ao vivo, não só lidos:** `npm run teste` → **474
asserções, 0 falhas** (soma das 10 suítes, batendo com o número que me foi
passado). `npm run build` → OK.

**Corrigido (rotina, baixo risco):**
- `CLAUDE.md`: contagem de asserções "385" → **474**. A justificativa do
  guard-rail de `motor:publicar` ("~178 linhas do financeiro do organizador
  ainda não liberadas") estava **vencida** — o financeiro foi ao ar na
  v57→v58 (08/09/2026, ver `CHANGELOG.md`) — troquei por uma razão que não
  expira a cada deploy: o fonte fica rotineiramente à frente do ar pelo
  próprio rito de subida (bateria/guardiões/resumo/OK antes de publicar).
  Também corrigi a afirmação "`athlete-action` e `login-atleta` ainda não
  têm asserção nenhuma": `testes/regulamento-por-circuito.mjs` passou a
  rodar o `athlete-action` de verdade (`carregarMotor`) para a guarda do
  `INSCREVER` — só o `App.jsx` e o `login-atleta` seguem sem execução real,
  só checagem por regex no texto fonte.
- `CLAUDE.md`, Armadilhas: estendida a entrada "o fonte pode não ser o que
  está no ar" com o achado do Guardião de Segurança — o `login-atleta` que
  está no ar não corresponde a nenhum commit deste repositório (publicado de
  uma pasta de rascunho do **projeto de torneios**, HEAD deste repo já dois
  commits à frente). Cópia salva em `JULIANO/CLUBE DO TÊNIS DE MESA/BACKUPS/
  motor-no-ar-2026-09-19/ar-login-atleta-v8.ts` — confirmei que o arquivo
  existe nesse caminho antes de escrever a referência.
- `docs/curadoria-indice-app-tenis-de-mesa.md`: versões de edge corrigidas
  para as reais (`list_edge_functions` ao vivo no projeto
  `eultwfzzlgcmcikobmmy`, não `npm run motor:listar` — mesmo efeito, outra
  ferramenta): admin-action **v60**, athlete-action **v20** (o índice estava
  em v58/v19, atrás da Onda 0.10 que foi ao ar em 16/09). "Estado" e o
  parágrafo do Regulamento A atualizados para 19/09.

**Achado meu, além do que foi pedido — confirmado ao vivo, não inferido:**
lendo o `entrypoint_path` de cada função no `list_edge_functions`, o mesmo
padrão do `login-atleta` (achado do Guardião de Segurança) também vale para
**`circuito-dados`** e **`despachos-do-dia`** — as três com `updated_at` de
08/09/2026 e `entrypoint_path` apontando para a mesma pasta de rascunho do
projeto de torneios (`.../JULIANO-APP-TORNEIO/.../scratchpad/publicar-so-
cors/...`). `admin-action` e `athlete-action`, redeployados em 17/09, já
apontam corretamente para `/Users/strutzki/clube-tenis-mesa-v2/...`. Não fiz
cópia de segurança de `circuito-dados`/`despachos-do-dia` equivalente à do
`login-atleta` — sinalizado em `docs/curadoria-indice-app-tenis-de-mesa.md`,
não corrigido: mexer em deploy/backup de motor não é rotina do meu mandato.

**Registrado em `docs/ROADMAP.md`, item 0.10.15** (não é rotina — é decisão e
progresso de conteúdo, mas registrar o que já foi decidido/construído está
dentro do meu mandato, diferente de decidir por conta própria):
- Bloco de status "construído, não publicado" para (a) `DEFINIR_REGULAMENTO_
  VERSAO`, (b) `ACEITAR_REGULAMENTO` e (c) o aviso prévio (dois modos),
  verificado por leitura direta do diff de cada arquivo contra `HEAD`
  (`git diff HEAD -- src/App.jsx supabase/functions/**`), não por relato.
- A decisão do Juliano de 19/09 ("segue") e as três decisões tomadas em nome
  dele, com o motivo de cada uma — igual ao formato já usado para a decisão
  de 18/09 ("não tira do pareamento").
- Os itens abertos nomeados como o que ficaram: **J5** (registro da data do
  carimbo — confirmei por leitura do diff do `admin-action` que
  `DEFINIR_REGULAMENTO_VERSAO` só grava `regulamento_versao`, nenhuma
  coluna de data), **J2** (snapshot dos aceites de hoje — não achei nada no
  diff que grave um snapshot antes do primeiro re-aceite), **(b2)** (não
  reverificado nesta rodada — só sinalizado que precisa ser conferido antes
  do carimbo), e **0.10.22** — conferi que o botão "Ler o regulamento"
  construído nesta rodada só existe **dentro do card de re-aceite**
  (aparece só quando a versão do atleta diverge da vigente); quem já está em
  dia não ganhou entrada nenhuma para o regulamento estando logado. Registrei
  isso como o item continuando aberto, não fechado por engano.

**Não escrevi no `CHANGELOG.md`** — confirmado que é a decisão certa: a
última entrada (16/09) descreve só o que foi ao ar (`athlete-action`
v19→v20, `admin-action` v59→v60), e o trabalho desta rodada (0.10.15
(a)+(b)+(c)) não subiu. Escrever agora anteciparia uma entrada de publicação
sem publicação — contra o rito.

**Não escrevi vereditos de guardião** — não é meu mandato; a tabela "J1..J5"
citada nesta rodada veio de achados do Guardião Jurídico/Segurança ainda não
formalizados em `docs/GOVERNANCA_AGENTES.md` (não encontrei essas siglas lá
nem em nenhum outro doc — vieram só da conversa desta sessão). Sinalizo que,
quando a rodada de revisão fechar, a entrada de veredito da Onda 0.10.15
nesse arquivo é o lugar certo para formalizá-las — não escrevi por conta
própria porque não sou eu quem redige veredito de guardião.

**Verificação final:** reconferi os mesmos 6 hashes congelados ao terminar —
idênticos aos do início. Só `docs/` foi editado (`CLAUDE.md`,
`docs/ROADMAP.md`, `docs/curadoria-indice-app-tenis-de-mesa.md`, este log).

## 2026-09-15 — Supervisão do parecer R1+R2: pendência de R3 antes de seguir

**Não sou o curador-projeto — sou o Supervisor de Curadoria, registrando aqui
porque não fazer isso repetiria exatamente o erro que este arquivo descreve
abaixo (mover a árvore sem registrar).** Avaliei as duas rodadas de 13/09 e
14/09 (Onda 0.10) contra o estado do repositório **nesta manhã, 15/09**.
Vereditos: **R1 e R2, como entregues, são fiéis e corretamente delimitadas** —
o índice bate com o que os md5 e a bateria mostram no momento em que cada
rodada rodou, os itens fora de mandato (`testes/**`) foram corretamente
sinalizados e não tocados, e a entrada nova do `GOVERNANCA_AGENTES.md` não
ameniza nada (achei o oposto: ela é autocrítica a ponto de admitir uma
reincidência que nenhum dos outros sete guardiões notou).

**Mas a árvore andou de novo depois da R2, sem uma R3 para reconferir:**
- `src/App.jsx` mudou uma **terceira vez** desde a R2. R2 congelou em
  `8a9b2f2e7b459c808256ecaae5314eb1`; a entrada nova do `GOVERNANCA_AGENTES.md`
  documenta uma reincidência movendo para `7bdd826c8c809eddbc85a27295c082ec`
  (a correção da tela branca). O hash de agora é **nenhum dos dois**:
  `9b3966d91e7e8867fc2894aed59e54a4` (`md5 -q`, conferido ao vivo). Pelo
  conteúdo (grep em `resultado_comunicado`/`matchId` e o novo item 0.9.5 do
  `ROADMAP.md`), a mudança adicional parece ser o conserto do "defeito irmão"
  que o 0.9.5 credita a 14/09 — mas isso é inferência por contexto, não
  confirmação por diff, porque não há hash intermediário registrado em lugar
  nenhum para comparar.
- A bateria real subiu de 326 (hash da R2) para **341** (rodei `npm run teste`
  ao vivo: 341 OK, 0 falharam). `CLAUDE.md` ainda dizia 326 — **corrigido nesta
  supervisão** para 341, é rotina de baixo risco. `testes/README.md` também diz
  326 e segue fora do alcance desta sessão (congelado para quem mexe em
  `testes/**`) — mas registre-se: quando descongelar, o número certo a colocar
  é 341, não 326 (o card antigo já estava desatualizado quando a R2 fechou o
  parecer; ficou mais desatualizado ainda depois).

**Não é acusação contra a R2** — a árvore que ela auditou era essa outra,
mais antiga, e ela mesma registrou os hashes que congelou. É um apontamento de
que **o presente momento** (o que vai para os guardiões e depois para o
Juliano) precisa de uma rodada nova do curador batendo o índice/log contra o
estado de agora, não contra o de ontem à noite — nominalmente para: (a)
confirmar que a 3ª mudança do `src/App.jsx` é mesmo só o conserto do 0.9.5 e
nada mais escapou sem asserção; (b) atualizar a contagem da bateria nos
lugares que ainda citam 326 (fora de `testes/**`); (c) decidir, junto com quem
tem alçada em `testes/**`, se a tabela e a frase falsa do `testes/README.md`
sobem junto ou ficam para depois — não é bloqueio técnico, é higiene, e o
próprio `curador-projeto` já deixou a recomendação pronta.

## 2026-09-16 — Supervisão da R3: fecha o que foi devolvido

**Supervisor de Curadoria, não o curador.** A R3 (abaixo) fechou exatamente o
que eu tinha pedido: reconferiu a v03-13 por `diff -u` completo (continua
cópia fiel fora do valor), atualizou índice e log para 16/09, escreveu a
entrada que faltava no `GOVERNANCA_AGENTES.md` sobre as duas passagens não
registradas do `App.jsx`, e corrigiu o `CLAUDE.md` (341→370). Reconferi a
árvore #4 (a que veio depois da R3, já com `regulamento-por-circuito.mjs` e
`erros-na-tela.mjs` crescendo mais uma vez) e os sete hashes batem com o que
o pedido trouxe; a bateria real hoje é **385** (rodei `npm run teste` ao
vivo), 15 acima do que a R3 tinha fechado — de novo, a árvore andou depois
do parecer, desta vez por um motivo concreto e nomeado (critério de
desempate nível a nível, virada do Sistema B, reset de
`pagamento_proxima_confirmado`), não por reincidência silenciosa.

**A pergunta que a R3 devolveu tem resposta agora, e não era "exatamente os
dois achados"**: veio uma lista de cinco mudanças reais (modal que fechava
na recusa, mensagem do passo 3, bloco de transição do Cap. 12, tabela de
valores desatualizada, roteamento de `regulamentoVersao`). Escrevi essa
lista no `GOVERNANCA_AGENTES.md`, na seção que a R3 já tinha aberto para
isso, em vez de deixá-la só na conversa — é o mesmo princípio que motivou a
R3 inteira: resposta dada fora do documento é resposta que se perde na
próxima rodada.

**`docs/CHANGELOG.md` — a entrada nova do `admin-action` v58→v59 é
verificada, não só citada.** Conferi ao vivo via Supabase (`list_edge_functions`,
projeto `eultwfzzlgcmcikobmmy`): `admin-action` está em produção na
**versão 59** agora. A entrada não é uma inferência a partir do commit
`c43f327` — está confirmada contra o que está no ar, que é o padrão mais
alto que este projeto reconhece. Honesta sobre o atraso (diz "seis dias
errado" e não apaga as três menções antigas a "v58" nos itens de datas
anteriores, porque elas descreviam a verdade do dia em que foram escritas).

**Números:** `CLAUDE.md` ficou em 370 quando a real já é 385 — corrijo isto
aqui. `testes/README.md` segue em 326, congelado, cada vez mais atrás (agora
59 asserções). Nenhum dos dois bloqueia publicação: nenhum superestima
proteção que não existe (a regra 6 do `CLAUDE.md` proíbe a direção perigosa,
não esta), então é higiene a fechar antes do resumo final, não portão.

## 2026-09-16 — Onda 0.10, REVISÃO 3: a árvore andou de novo, sem registro

**Motivo da rodada:** o supervisor do Curador aprovou a R1 e a R2 como fiéis
e rigorosas, mas devolveu — a árvore andou de novo depois da R2, e ninguém
tinha reconferido. Ele tem razão: `src/App.jsx` mudou **mais duas vezes**
desde o parecer dele, as duas com conhecimento de quem editava, nenhuma
registrada quando aconteceu.

**Árvore congelada #3 revisada** (conferidos por `md5 -q`, não copiados do
pedido): `src/App.jsx` `f2bed23474699149ef93298523d35fad`, `admin-action/index.ts`
`dda8ea977570b25b573eeb6857981cde` (idêntico à R2 — não mudou), `athlete-action/index.ts`
`a58fcebdde7dcaec187b8af7b5c0bcac` (idêntico à R2), `testes/regulamento-por-circuito.mjs`
`7552da99569aa3315a48481a9f374ee3`, `testes/erros-na-tela.mjs`
`b799e394746341088048d4c6e3c5d149`, `testes/nomes-que-nao-existem.mjs`
(novo) `8defb12c016ec2835287d693ca524f06`, `REGULAMENTO_TENIS_DE_MESA_v03-13.md`
`f08c04655bc80bb6368b7804210b8e21`, `ROADMAP.md` `af53cd1d8f91179b7c76a0f9525ed030`.
Bateria rodada ao vivo: **370 asserções, 0 falhas**. Build rodado ao vivo:
**OK**. Não toquei `src/App.jsx`, `supabase/functions/**` nem `testes/**`.

### O achado da R2, reconfirmado
`admin-action` e `athlete-action` **não mudaram** desde a R2 — mesmos md5.
Só `App.jsx` e os arquivos de teste andaram.

### 1. A v03-13 contra a v03-12, mais uma vez
Mudou três vezes desde a R2: citação de capítulo (Cap. 11 → **Cap. 12**,
correção real — é o 12 que tem "valor único... sem mensalidade nem
parcelamento"); a cláusula de não-retroatividade parou de nomear "v03-12" e
passou a proteger por **data de ingresso** (achado real registrado no
próprio teste: a redação antiga, ao pé da letra, não protegia nenhum dos 15
atletas do BH — nenhum tem `v03-12` gravado); a tabela de valores perdeu uma
linha redundante. `diff -u` completo contra a v03-12: **continua cópia fiel
fora da cláusula de valor** — nada no Cap. 10 (torneio) nem no resto dos 13
capítulos diverge. Detalhe completo no índice.

### 2. Índice e log atualizados para o estado de agora
`docs/curadoria-indice-app-tenis-de-mesa.md`: data → 16/09; aviso novo sobre
`App.jsx` se mover entre rodadas; os quatro itens novos do ROADMAP
(0.10.20-23) e o (b2)/(e) do 0.10.15 resumidos; `testes/README.md` marcado
como "não resolvido, piorou" (326 contra uma real de 370); `CLAUDE.md`
corrigido (341 → 370, é o único dos dois fora de `testes/**`).

### 3. `GOVERNANCA_AGENTES.md` — registrada a reincidência não registrada
Escrevi a entrada que falta: a árvore andou mais duas vezes depois do hash
que a reincidência da R2 tinha capturado como "final"
(`7bdd826c…` → `f2bed234…`), as duas com conhecimento de quem editava,
nenhuma registrada no momento. Não tenho os hashes intermediários — só o
inicial e o final desta janela — porque ninguém parou para registrar cada
passagem; disse isso no texto em vez de fingir precisão que não tenho. Não é
uma reconstrução meiga: registrei que a lição da R2 ("recongelar antes de
mexer de novo") **não foi seguida** da segunda vez.

### 4. Números
`CLAUDE.md`: corrigido (341 → 370, conferido rodando a bateria, não só
lendo). `testes/README.md`: **ainda 326** — na R2 esse número estava certo
(a bateria era 326 naquele momento); hoje está 44 asserções atrás da
realidade (370), porque o arquivo não acompanhou as duas rodadas que se
passaram. Não corrigi — `testes/**` congelado nesta árvore também.

### 5. Descompasso doc × app encontrado
Conferi 3 citações de linha do ROADMAP (`App.jsx:7313-7398`, `:4953-4963`,
`:6604`, `:6646`) contra o arquivo atual. A **substância** de todas bate
(confirmação-com-nome existe em `CancelarCircuitoCard`; `trocarCircuito` de
fato seta o circuito antes do `await`) — mas os **números de linha** estão
levemente defasados em alguns pontos (a UI de confirmação-com-nome fica em
~7404-7419, não 7313-7398; `AdminFinanceiro key=` está em `:6608`, não
`:6604`). Não é erro de conteúdo, é `App.jsx` se movendo enquanto o ROADMAP
era escrito — mesma causa-raiz do item 3. Não é rotina reescrever número de
linha a cada movimento do arquivo; registrei o padrão no índice, não cada
ocorrência, e recomendo ao ROADMAP não prometer precisão de linha num
arquivo que está mudando de hash a cada rodada.

**Não fiz e fica para quem revisar este parecer:** confirmar se as duas
passagens não registradas do `App.jsx` correspondem exatamente aos dois
achados listados no `GOVERNANCA_AGENTES.md` (mutação da virada otimista;
`ReferenceError sistemaAtivo`) ou se houve uma terceira coisa no meio —
não tenho como provar isso só com hash de início e fim.

## 2026-09-14 — Onda 0.10, REVISÃO 2: reaudição pós-conserto do rodapé

**Árvore congelada #2 revisada** (vinculando a estes md5, conferidos por
`md5 -q` nesta rodada, não copiados do pedido):
`REGULAMENTO_TENIS_DE_MESA_v03-13.md` `b9d00a62818e536b9caa4f27a945a680`,
`REGULAMENTO_TENIS_DE_MESA_v03-12.md` `262cbd30aeffca9ac04cc020d634ae8e`
(intocado, confirmado), `ROADMAP.md` `e0372d01a0bff35f2f1d1bb6ef0db5c8`,
`GOVERNANCA_AGENTES.md` `9e1d97b58b0187b3dd0909c869201b42`, `CLAUDE.md`
`8e53fefc81fffa8327711277c45a9651`, `testes/README.md`
`85203914bbe5d868ef2cf6fc1032f26d`, `src/App.jsx`
`8a9b2f2e7b459c808256ecaae5314eb1`, `admin-action/index.ts`
`dda8ea977570b25b573eeb6857981cde`, `athlete-action/index.ts`
`a58fcebdde7dcaec187b8af7b5c0bcac`. Bateria rodada ao vivo: **326 asserções, 0
falhas**. Build rodado ao vivo: **OK**. Nada em `src/App.jsx`,
`supabase/functions/**` ou `testes/**` foi tocado — mandato desta rodada é só
o acervo (`docs/curadoria-indice-app-tenis-de-mesa.md` e este log).

### O item devolvido na rodada anterior — resolvido, conferido
O rodapé errado da v03-13 (dizia "v03-12") foi corrigido **no `.md` e na
lista `esperadas` do teste juntos**, como eu tinha indicado que era o jeito
certo. `diff -u` linha a linha confirma: o rodapé agora diz "Regulamento
v03-13", e fora do bloco de cabeçalho/intro + as duas linhas de valor + o
rodapé, **a v03-13 é cópia byte-idêntica da v03-12** — Cap. 10 (torneio) e
todo o resto dos 13 capítulos intactos. A nova justificativa não contradiz
mais o Cap. 11/12 (o Cap. 12 confirma "valor único... sem mensalidade nem
parcelamento"). O teste (linhas 484-487 de `testes/regulamento-por-circuito.mjs`)
registra a lição em comentário, creditada a mim — fiel.

### Achado e corrigido nesta sessão (rotina, baixo risco)
- Índice (`docs/curadoria-indice-app-tenis-de-mesa.md`): três achados da
  rodada anterior fechados com prova (rodapé v03-13, contagem da bateria,
  entrada nova do `GOVERNANCA_AGENTES.md`) — ver detalhe abaixo. "Estado" →
  14/09/2026.
- **Achado NOVO, e é sobre o próprio índice**: a seção "Clutter" ainda listava
  "dezenas" de `src/App.jsx HH.MM.SS` como pendentes de remoção — **removidos
  em 07/09/2026** segundo o próprio `CLAUDE.md` (seção Armadilhas), há uma
  semana. Conferi (`find` na raiz e em `src/`): zero arquivos desse padrão.
  O índice registrava um clutter que já não existia. Corrigido.
- `files.zip` (raiz, 194.897 bytes, conteúdo conferido: logos + manifest +
  index.html de 28/06/2026, anteriores à decisão de nome de 10/09) segue
  órfão — **3ª vez sinalizado** (05/09, 10/09, 14/09) sem remoção. Não
  removi (mudança de conteúdo do repo não é rotina de doc); recomendo
  executar desta vez, mediante OK — está claramente superado e sem teste
  dependendo dele.

### Achado NOVO, não corrigido (fora do meu mandato — `testes/**` congelado)
- **`testes/README.md` tem duas imprecisões que não são as da rodada
  passada.** (1) A tabela de arquivos lista só 7 dos 14 arquivos que
  `testes/` realmente tem — faltam `regulamento-por-circuito.mjs`,
  `permissoes.mjs`, `pacote.mjs`, `erros-na-tela.mjs`, `mensagens.mjs`,
  `contador-mensagens.mjs` (confirmei os 14 contra `package.json`, que roda
  todos os 9 arquivos de teste em `npm run teste`, e contra `git ls-files
  testes/`). (2) A seção "O que ainda não é testado" afirma **"O front
  (`src/App.jsx`) — nada dele passa por aqui"**, e isso hoje é **falso**:
  `regulamento-por-circuito.mjs` lê `src/App.jsx` inteiro como `fonte` (com
  `fs.readFileSync(...App.jsx...)`, linha 23) e testa comportamento dele por
  regex — versão do regulamento fail-closed, `ACOES_SEM_OTIMISMO`/
  `dispatchAndSync` da virada, ramificação da `RegulamentoView`. Quem ler o
  README hoje é levado a achar que o front não tem proteção nenhuma; tem,
  pontual. Não corrigi porque `testes/**` está congelado para os outros sete
  guardiões nesta rodada — fica para quando a árvore descongelar.

### Resposta às 6 perguntas de conteúdo (a sessão que revisa este parecer tem o detalhe completo na conversa; aqui fica o resumo que sobrevive à sessão)
1. **Entrada nova do `GOVERNANCA_AGENTES.md` — fiel**, conferida linha a
   linha contra o `ROADMAP.md` e os testes. A tabela de 11 achados bate com
   o texto de `0.10.15` (mesmo "era falso" sobre o RENOVAR); a lição sobre a
   asserção que lia texto sem saber o ramo é consistente com os testes que
   hoje rodam o motor (`montarMotor`/`comoAdmin`) nas seções "lista de
   PERMISSÃO" e "Campo de percentual vazio". **Não confirmei** — e não
   encontrei em nenhum artefato do repositório (git, sem commits desta
   rodada; testes; este log) — se a "mutação da virada otimista que ficou
   verde porque o conserto não tinha asserção" de fato aconteceu. A única
   nota desse formato (sabotagem → ficou verde → corrigido) que existe no
   repositório é a do rodapé, creditada a mim. Isso não é uma acusação de
   omissão: é que não tenho como confirmar nem descartar pelos artefatos, e
   meu mandato proíbe inventar. Recomendo, se aconteceu de fato, registrar
   com a mesma forma da nota do rodapé (o que foi sabotado, que ficou verde,
   por quê) — falta hoje, e sem isso o próximo leitor não aprende a lição.
2. **0.10.15 é rastreável.** Li a-f + 0.10.16 + 0.10.17 inteiros; cada item
   tem gatilho, o que fazer, por quê, e quem achou. Conferi contra o código
   que (a) `DEFINIR_REGULAMENTO_VERSAO` de fato não existe no
   `admin-action` hoje (grep, zero ocorrência) — o texto não promete algo já
   feito. Alguém lendo em 3 meses sabe o que fazer.
3. **v03-13 confirmada cópia fiel da v03-12 fora da cláusula de valor** —
   `diff -u` completo, ver acima.
4. **0.10.15(f) — registro justo com o meu argumento**, até onde consigo
   avaliar sem o texto exato que escrevi na sessão original (não tenho
   acesso a ela). É coerente com o precedente do próprio projeto: as versões
   PDF antigas (v03-4, v03-11) já são tratadas como substituídas só pela nota
   na versão NOVA, sem editar as antigas. Um reforço que sugiro (não fiz,
   por estar na árvore congelada #2): apontar explicitamente que a v03-13 já
   funciona como o aviso de substituição (ela diz "a temporada 1/2026 segue
   integralmente pela v03-12") — o que torna concreto o "o padrão é o texto
   novo declarar o que substitui" citado em (f).
5. **`REGULAMENTO_SISTEMA_B.md` não virou item no `ROADMAP.md`** (busquei,
   zero ocorrência) **nem foi movido** — mas também não se perdeu: continua
   sinalizado no índice, mesma recomendação de 13/09 (mover para
   `historico/`), "fica para o Juliano decidir". Não é irmão do 0.10.3 no
   ROADMAP ainda; poderia ser, é decisão de conteúdo, não fiz.
6. **CHANGELOG confirmado parado** — topo em 2026-09-10, nada sobre a v03-13
   / Onda 0.10 / permissões do organizador (que também não subiram: o
   último publicado registrado é o admin-action v58 de 08/09, que bate com
   `git log`). Correto ficar assim até publicar.

### Não é rotina — fica para o Juliano
- `files.zip` (acima) — 3º sinal, sem ação.
- `GOVERNANCA_AGENTES.md`, achado 1 acima — confirmar se a mutação da
  virada otimista aconteceu e, se sim, registrar como se registrou a do
  rodapé.
- `testes/README.md`, tabela de arquivos + frase sobre o front — corrigir
  quando `testes/**` descongelar.

## 2026-09-13 — Onda 0.10 (0.10.1+0.10.2+0.10.6): a v03-13 e o descompasso doc×app

**Árvore congelada revisada** (vinculando a estes md5): `src/App.jsx`
`8f171fb3…`, `admin-action/index.ts` `93af0a01…`, `testes/regulamento-por-circuito.mjs`
`b6ea5456…`, `REGULAMENTO_TENIS_DE_MESA_v03-13.md` `50bc6549…` (novo),
`REGULAMENTO_TENIS_DE_MESA_v03-12.md` `262cbd30…` (intocado), `REGULAMENTOS_NOVOS_CIRCUITOS.md`
`72ac906e…`, `PLANO_PAGAMENTOS.md` `f61a5005…`, `ROADMAP.md` `1657c7ae…`,
`CLAUDE.md` `52dfc1dd…`. Bateria conferida ao vivo: **271 asserções, 0 falhas**
(rodei `npm run teste`, não só li o número reportado). Nada em `src/App.jsx`,
`supabase/functions/**` ou `testes/**` foi tocado — mandato desta rodada é só
o acervo.

**Contexto:** o Juliano decidiu, em 13/09/2026, entre três opções que o
Guardião Jurídico formulou, "BH vai a 100%, com regulamento novo antes". A
sessão criou `docs/REGULAMENTO_TENIS_DE_MESA_v03-13.md` (cópia do v03-12 com
uma cláusula de valor alterada: tira o desconto de 80% na 2ª etapa) e uma
trava no motor que recusa a virada do BH enquanto ele declarar `v03-12`.

### Achado, corrigido (rotina, baixo risco)
- **`docs/curadoria-indice-app-tenis-de-mesa.md` citava dois arquivos que não
  existem mais** (`ROADMAP_MULTICIRCUITO.md`, `PLATAFORMA_BACKLOG.md` — hoje é
  só `docs/ROADMAP.md`) e descrevia `INDICE_PROJETO.md` como "virou ponteiro"
  quando na verdade foi **removido** em 06/09/2026 (a própria entrada de
  06/09 deste log já dizia isso — o índice não tinha sido corrigido para
  bater com o próprio log). Corrigido nas três referências.
- **O mesmo índice não mencionava a v03-13** nem a divisão nova de
  `VERSOES_COM_TORNEIO` / `VERSOES_COM_DESCONTO_ETAPA` no `App.jsx` (duas
  listas agora, não uma — a v03-13 é o primeiro caso em que elas divergem:
  tem torneio, não tem desconto). Reescrevi o parágrafo do Regulamento A na
  seção 2 e adicionei a v03-13 ao inventário da seção 3.
- **Dois itens de drift do índice estavam resolvidos e não tinham sido
  fechados**: "`vA-nc-01` ainda promete o torneio em 4 capítulos" (a bateria
  hoje varre e trava as 9 menções, 0 falhas) e "`max_atletas` configurável
  mas o Cap. 11 crava 20" (decisão do Juliano de 10/09 fixou 8..20 para
  todos, não é mais configurável). Marcados `~~resolvido~~` com a prova.
- **`REGULAMENTO_SISTEMA_B.md` estava listado como "Ativo" par a par com
  `REGULAMENTOS_NOVOS_CIRCUITOS.md`**, mas é o **rascunho** que originou o
  texto do B hoje publicado lá (a própria 1ª linha do arquivo diz "RASCUNHO
  v2"; a última diz "próximo passo: cabear no app", já feito). Dois
  documentos concorrentes descrevendo o mesmo `vB-01`. Sinalizado no índice
  como status ambíguo, com recomendação (mover a `historico/`) — **não
  movido**, é decisão de conteúdo, não rotina.
- `docs/ROADMAP.md`: a linha da tabela final sobre `REGULAMENTO_*` ainda
  dizia só "A v03-12, B vB-01" — atualizada para citar a v03-13 e a ausência
  de `.md` canônico do `vA-nc-01`.
- `README.md` (linhas ~131 e ~153) e `docs/ESTADO-DEV-app-tenis-de-mesa.md`
  (linha 6) só citavam v03-12, sem apontar que existe uma v03-13 e quando ela
  passa a valer. Adicionada a ponte, sem reescrever o resto (o `ESTADO-DEV`
  já se declara desatualizado desde 05/09 — não é escopo desta rodada
  reescrevê-lo inteiro).

### Achado, NÃO corrigido — bug real, mas a correção quebra a árvore congelada
- **`docs/REGULAMENTO_TENIS_DE_MESA_v03-13.md` termina com o rodapé errado**:
  `*Clube do Tênis de Mesa · Circuito BH · Regulamento v03-12*` (sobrou do
  copiar-e-colar; devia dizer v03-13). Tentei corrigir e **rodei a bateria**:
  quebrou — `testes/regulamento-por-circuito.mjs`, seção "O documento da
  v03-13 muda UMA cláusula, e só", faz um diff linha a linha entre os dois
  `.md` e a lista `esperadas` (as únicas linhas que podem ter sumido do v12)
  não previa o rodapé mudando, porque hoje as duas versões têm o MESMO
  rodapé errado por coincidência — a linha nunca "some" do v12 para o teste
  notar. Resultado com a correção: 1 falha (`nada além da cláusula de valor e
  do cabeçalho saiu da v03-12 — esperava [], veio [".../Regulamento v03-12*"]`).
  **Revertido** — hash conferido de volta a `50bc6549…`, bateria de volta a
  271/0. A correção certa mexe nos dois arquivos juntos (o `.md` e a lista
  `esperadas` do teste), e `testes/**` está fora do meu mandato enquanto a
  árvore estiver congelada para os outros sete guardiões.

### Achado, NÃO corrigido — fora do meu mandato nesta janela
- **`testes/README.md` diz "Hoje são 82 asserções"; a bateria real é 271.**
  Mesma razão do item acima: `testes/**` congelado.
- **`docs/GOVERNANCA_AGENTES.md`, seção "Vereditos já emitidos (histórico)",
  não ganha entrada desde 07/09/2026** — seis dias sem registro, apesar de o
  `ROADMAP.md` documentar rodadas inteiras de revisão supervisionada depois
  disso (0.6 com seis guardiões em 08/09; 0.8.5 com oito duplas em 10/09; e a
  decisão desta própria rodada, 12-13/09). A decisão "BH vai a 100%, com
  regulamento novo antes" é exatamente o tipo de entrada que esse arquivo
  registra historicamente (ex.: as entradas de CPF Fatia 3, "Decisões do
  Juliano: controlador..."). **Não escrevi essa entrada**: não tenho o texto
  original das três opções que o Jurídico formulou — não fez parte do que
  esta sessão recebeu, e inventar a redação de um veredito de guardião seria
  o tipo de coisa que este mandato proíbe explicitamente ("nunca inventa
  fato"). Recomendo à sessão que tem esse texto (ou ao Juliano) registrar em
  `GOVERNANCA_AGENTES.md`, e decidir também se esse arquivo continua sendo o
  lugar dos vereditos granulares ou se essa função migrou de fato para o
  `ROADMAP.md` (onde as ondas 0.5–0.10 já registram achado por achado, com
  guardião nomeado) — hoje os dois padrões coexistem sem que ninguém tenha
  dito qual vale.

### Não é rotina — fica para o Juliano (via a sessão que revisa este parecer)
- **0.10.3 do ROADMAP** ("`vA-nc-01` não tem texto canônico") ficou mais
  visível: agora o BH tem DOIS `.md` cuidados (v03-12, v03-13) enquanto o
  regulamento que serve todo circuito NOVO — o que de fato escala — não tem
  nenhum próprio, e ainda descobri que `vB-01` tem uma situação parecida
  (rascunho + texto final, dois arquivos). Meu parecer: vale subir a
  prioridade dentro do próprio gatilho ("antes de criar o 1º circuito A que
  não seja o BH") — não porque o gatilho mudou, mas porque agora existe um
  modelo pronto (o par v03-12/v03-13, com a asserção de diff linha a linha)
  para copiar, o que baixa o custo de fazer certo. Não fiz — é decisão de
  conteúdo/prioridade, não correção de índice.
- **0.10.12** ("regra texto mudou → versão nova, + asserção que compare
  documento com fonte") — a nova seção "O documento da v03-13 muda UMA
  cláusula, e só" atende **parte**: existe o `.md` de registro por versão
  (como o Jurídico pediu) e uma asserção que impede o `.md` novo de divergir
  do antigo em mais do que a cláusula combinada. Mas ela compara **um doc
  contra o outro**, não "o documento contra o fonte" (o `App.jsx`) — que era
  o pedido original. O que existe hoje para ligar doc↔fonte é amostragem de
  frases específicas (ex.: "não é cobrado retroativamente" é checada só no
  `.md`; os textos de valor são checados só no `fonte`) — funciona porque
  alguém escreveu as duas listas de propósito, não porque há um mecanismo
  genérico. E é só para o par BH; `vA-nc-01`/`vB-01` não têm proteção
  equivalente (nem `.md` canônico, como acima). Também não existe nada que
  impeça editar a v03-13 de novo sem criar uma v03-14 — a disciplina
  "versão nova = arquivo novo" é humana, não travada em código.
- **Registro da decisão de 13/09** ("BH vai a 100%, com regulamento novo
  antes", as três opções do Jurídico) — recomendo `docs/GOVERNANCA_AGENTES.md`
  como o lugar (é onde decisões desse formato — guardião formula opções,
  Juliano escolhe — já são registradas, ver seção "Honestidade/limites"
  acima), MAS por quem tem o texto original das opções, não por mim
  reconstruindo. Ver item logo acima.

## 2026-09-10 — Auditoria da árvore atual: consolidação `claude/`→`docs/`, correção do dia 27, e `vA-nc-01` no código

**Revisado (árvore de trabalho, não commitada):** os três pontos pedidos —
(1) a consolidação `claude/`→`docs/` (índice + log únicos, referências
repontadas); (2) a correção de `REGULAMENTOS_NOVOS_CIRCUITOS.md` que tirou "dia
27" da lista de mudanças dos circuitos novos; (3) `RegulamentoView` ramificando
por `circuitos.regulamento_versao` e `VERSOES_COM_TORNEIO` no `App.jsx`.

**Achado e corrigido nesta sessão (rotina, baixo risco):**
- Duplicação de conteúdo neste arquivo (achado acima, já corrigido).
- `docs/curadoria-indice-app-tenis-de-mesa.md`: versões de edge estavam
  anotadas v54/v17/v5/v2 — conferidas ao vivo (`npm run motor:listar`) como
  **v58/v19/v8/v4** (+ despachos-do-dia v6). Corrigido. `vA-nc-01` registrado no
  mapa rápido (não existia lá). "Estado" atualizado para 10/09/2026.

**Achado, sinalizado, NÃO corrigido (precisa de decisão de conteúdo):**
- **`vA-nc-01` só filtra o Cap. 10 — os Caps. 09, 11, 12 e 13 continuam
  mencionando o torneio presencial** (herdado do texto do BH, que `RegulamentoView`
  reusa por `id`, não por versão). Um atleta de um circuito de rating novo leria
  "elegível ao torneio... top 8" e "taxa do torneio presencial" num regulamento
  que, por definição (`REGULAMENTOS_NOVOS_CIRCUITOS.md`), não tem torneio.
  Detalhe e trechos exatos em `docs/curadoria-indice-app-tenis-de-mesa.md`
  (seção Drift). Isso é a MESMA lacuna que o `ROADMAP.md` item 0.8.5 descreve —
  **não foi fechada por esta rodada**, só o mecanismo de filtro do Cap. 10 e o
  carimbo de `vA-nc-01` no `CRIAR_CIRCUITO` foram implementados.
- Cap. 11 crava "teto de 20 atletas" enquanto `max_atletas` é coluna
  configurável por circuito — mesma família do TODO já registrado para
  "masculino adulto 18+" (ROADMAP 0.8.3).
- A correção do "dia 27" em `REGULAMENTOS_NOVOS_CIRCUITOS.md` foi **conferida e
  está certa**: `v03-12` linha 3, `REGULAMENTO_SISTEMA_B.md` linha 3, e o banco
  de produção (`partidas`, rodada 5 = prazo 2026-09-15, rodada 6 = prazo
  2026-09-27) concordam. As versões com dia 25 (v03-4, v03-11) são mesmo as
  desatualizadas.
- Nenhuma referência órfã a `claude/INDICE.md` / `claude/curadoria-log.md`
  sobrou fora de texto histórico (registros datados descrevendo o que era
  verdade naquele dia — preservados como estavam, por serem histórico, não
  instrução ativa).
- `files.zip` na raiz segue sem remover — clutter já sinalizado desde 05/09,
  ainda não resolvido (fora do escopo desta rodada).

**Não corrigido por não ser rotina (decisão de conteúdo/produção, fica para o
Juliano):** os dois achados de `vA-nc-01` acima, e se/quando marcar o ROADMAP
0.8.5 como resolvido (recomendação: só marcar depois de fechar a lacuna dos 4
capítulos, não com o mecanismo de filtro sozinho).

**Revisado:** a decisão de nome de 08/09/2026 (app = "Clube do Tênis de Mesa",
sem BH; circuito = "Circuito BH", sem número) contra o diff já feito em
`index.html`, `public/manifest.json`, `src/App.jsx`; contra o manual da marca;
contra `REGULAMENTOS_NOVOS_CIRCUITOS.md` / `REGULAMENTO_SISTEMA_B.md` (qual
regulamento é do BH e qual é genérico); contra o banco de produção (leitura:
`circuitos`, `configuracao`) e a bateria (154 asserções rodadas de novo, 0
falhas; build OK, confirmado nesta sessão, não só relatado).

**Achado principal (conteúdo, não rotina — fica para o Juliano decidir):** o
regulamento **v03-12 é o do BH especificamente** (com o torneio presencial,
"intacto" — `REGULAMENTO_SISTEMA_B.md` linha 12 e 68), não um "Sistema A
genérico". Novos circuitos Sistema A usam `vA-nc-01`, **sem** torneio. O rodapé
do app foi trocado de "Clube do Tênis de Mesa · Circuito BH · Regulamento
v03-12" para "Clube do Tênis de Mesa · Regulamento v03-12" — hoje inofensivo
(só existe o BH), mas o texto de `RegulamentoView` no `App.jsx` (torneio, Cap.
10) só está pronto para o BH; não há ramificação por circuito ainda
(`circuitos.regulamento_versao` existe na tabela mas o componente só lê
`sistema`). Ver relato completo na conversa; não decidido aqui.

**Corrigido (rotina, baixo risco — já aplicado):**
- `v03-11` → `v03-12` (regulamento vigente estava desatualizado em 4 arquivos:
  `.claude/agents/experiencia-atleta.md`, `.claude/agents/supervisor-atleta.md`
  e os gêmeos em `docs/agente-*.md`). Confirmado contra o banco
  (`circuitos.regulamento_versao = 'v03-12'` para o BH).
- `docs/ROADMAP.md`, Onda 4: separei "nome" (resolvido em 08/09, pendente só de
  publicar) de "domínio" (`clubedotenisdemesabh.com.br`, ainda com "bh" —
  decisão de negócio, segue pendente para a Onda 4, confirmado adequado assim).

**Pendente de decisão do Juliano (não é rotina):**
- Se o rodapé/aceite do regulamento devem voltar a nomear "Circuito BH" (dado
  que v03-12 é texto do BH, não do Sistema A em geral) — ou se a correção
  certa é a app-level branch por `regulamento_versao` antes de valer a pena
  generalizar o texto.
- A UPDATE em `circuitos.nome_exibicao`/`nome_circuito` e `configuracao.nome_circuito`
  para "Circuito BH" — redigida pela sessão, não aplicada (é o que troca de
  fato a tela de inscrição). Fora do meu mandato aplicar.
- `claude/` vs `docs/` como registro único (achado acima).

---

## 2026-09-07 — PONTO DE RETOMADA (parada do dia)
**Pendente de publicar (rodar `atualizar.sh`):** rótulos do modo organizador (front) + docs. O `atualizar.sh` agora testa o build antes de publicar (rede de segurança).
**Edge `admin-action` — fonte à frente do que está no ar:** tem a revisão de acesso do organizador (removidos EXCLUIR_ATLETA, ABRIR/CANCELAR próxima, DEFINIR_RODADAS da allowlist) + as ações de cobrança da plataforma (LER/DEFINIR_COBRANCA_PLATAFORMA). **Não deployado de propósito** — deploya junto com o 1º circuito vendido (inerte hoje, sem organizador em produção). Live segue na versão anterior.
**Já no ar e verificado hoje:** vazamento de preço fechado (login-atleta v6 + revoke anon), despachos v3/v4 (só ações do dia), cobranças/config inertes, remoção do circuito demo (BH byte-idêntico).

### Retomar por aqui (fatias mapeadas, footprint-zero, revisão dos Guardiões)
1. **Financeiro por circuito** — flag `org_ve_financeiro` (padrão OFF) + toggle do super-admin; torna condicionais os itens financeiros do organizador (config financeira, pagamentos) e esconde a aba "Pagam." quando OFF. Ref: `ORGANIZADOR_ACESSO_COMPARATIVO.md`.
2. **Desfazer processamento (C)** — desfazer o cálculo de uma rodada até a virada, recalculando; com harness provando reprodução exata do rating e BH byte-idêntico. Ref: mesmo doc.
3. **Pagamentos (Asaas) — backlog** — aguardando conta Sandbox + chave + revisão jurídica das minutas. Ref: `PLATAFORMA_BACKLOG.md`, `PLANO_PAGAMENTOS_FATIA5_INTEGRACAO.md`.

# curadoria-log — registro do Curador do Projeto

## 2026-09-06 — Consolidação da documentação (dedup raiz × docs/)
- **Problema:** ~20 `.md` estavam duplicados na raiz do repo E em `docs/` (a base canônica sincronizada com o projeto do Claude via GitHub). Risco de editar a cópia errada e divergir (aconteceu: `PLANO_INSCRICAO` mais novo na raiz; `CHANGELOG`/`GOVERNANCA`/`ROADMAP` mais novos em `docs/`).
- **Ação:** antes de remover, comparei cada par. Sincronizei o único que estava mais novo na raiz (`PLANO_INSCRICAO_POR_CIRCUITO.md` → `docs/`). Removi as 22 duplicatas da raiz (19 idênticas + CHANGELOG/GOVERNANCA/ROADMAP obsoletas na raiz) e o stub superado `INDICE_PROJETO.md`. Mantido só `README.md` na raiz (é o README do código Vite, não é doc de projeto).
- **Resultado:** raiz do repo sem docs de projeto soltos; `docs/` segue com os 42 `.md` canônicos + `docs/backups/`. Fonte única de verdade documental = `docs/` (→ projeto do Claude). Nada perdido.
- **Follow-up opcional:** algumas referências internas ainda citam caminhos antigos (`claude/INDICE.md`, `claude/curadoria-log.md`); alinhar aos nomes reais em `docs/` numa próxima passada. `LEIA-ME.md` diz "40 documentos" (hoje 42) — atualizar quando conveniente.

# Log de Curadoria

Registro do que o `curador-projeto` revisou, quando, e o que mudou em cada documento. Mais recente no topo. Antes de reescrever qualquer doc, consultar `claude/INDICE.md`.

## 2026-09-05 — Bootstrap da curadoria + convenção `claude/`
**Revisado:** estrutura do repositório (raiz, `src/`, `supabase/functions/`, `marca/`, `.claude/agents/`); versões de edge no ar; versões de regulamento e consentimento no `App.jsx`.

**Criado:**
- `claude/INDICE.md` — fonte canônica: hierarquia de fontes + inventário atual/superado. (Antes não existia; havia só `INDICE_PROJETO.md` na raiz.)
- `claude/curadoria-log.md` — este log.

**Alterado:**
- `INDICE_PROJETO.md` (raiz) → reduzido a **ponteiro** para `claude/INDICE.md` (evita dois índices competindo = drift).
- `.claude/agents/curador-projeto.md` → passou a apontar `claude/INDICE.md` (canônico) e `claude/curadoria-log.md`.

**Drift encontrado e sinalizado (não corrigido — precisa de decisão/OK):**
- Clutter no repositório: dezenas de `src/App.jsx HH.MM.SS`, `App.jsx 20.13.44` na raiz, `files.zip` órfão. Candidatos a remoção.
- RPC global `arquivar_partidas_temporada` virou código morto (substituído pelo escopado em admin-action v54) — dropar/restringir.
- Pendências jurídicas abertas (controlador, canal de direitos, política de privacidade, backfill de CPF) — registradas no índice.

**Verdade confirmada nesta data:** admin-action v54, athlete-action v17, login-atleta v5, circuito-dados v2; regulamento A=v03-12, B=vB-01; consentimento CPF=cpf-2026-08-v1; 8 duplas de agentes na governança.

## Antes de 2026-09-05 (curadoria retroativa, registrada agora)
- **Docs criados/atualizados nas sessões recentes** (detalhe no `CHANGELOG.md`): `GOVERNANCA_AGENTES.md` (vereditos da virada não-BH + check geral + registro dos guardiões novos), `ROADMAP_MULTICIRCUITO.md` (virada não-BH concluída + item Despachos do Dia), `CHANGELOG.md` (criado), `PLANO_VIRADA_NAOBH.md` (criado), `PLANO_DESPACHOS.md` (criado), 8 arquivos novos em `.claude/agents/` (Regulamento, Jurídico, Confiabilidade, Curador + supervisores).
- **Correção de drift já aplicada:** texto "Sistema B ainda não é operável" no formulário de novo circuito estava desatualizado → substituído (o motor B já funciona).
