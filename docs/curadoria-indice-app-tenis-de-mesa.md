# INDICE — fonte canônica do projeto Clube do Tênis de Mesa

**Leia este arquivo ANTES de reescrever qualquer documento.** Ele traz (1) a hierarquia de fontes de verdade e (2) o inventário do que está atual vs. superado. Mantido pelo agente `curador-projeto`; toda revisão é registrada em `docs/curadoria-log.md`. **Estado: 29/09/2026** (revisão da auditoria multi-circuito, árvore congelada em `707c40f`) — as seções não marcadas com essa data continuam com o retrato de 19/09/2026.

⚠️ **`src/App.jsx` andou várias vezes durante as auditorias de 14 e 16/09/2026** (registrado em `docs/GOVERNANCA_AGENTES.md`, seção de vereditos da Onda 0.10). Se você está lendo isto entre rodadas, **não presuma que o hash mais recente que você tem é o de agora** — reconfira. Em 19/09/2026 a árvore foi provada congelada por hash (duas leituras idênticas) antes desta curadoria — ver Novo em 19/09/2026 abaixo.

## 1. Hierarquia de fontes de verdade
Quando dois documentos divergem, vale a fonte mais alta:
1. **Realidade em produção** — o que o app faz e o que está no banco/edge (Supabase `eultwfzzlgcmcikobmmy`). Fonte final.
2. **Código** — `src/App.jsx` (front) e `supabase/functions/*` (backend). É o que roda.
3. **Docs de referência viva** — regulamentos, manual da marca, ESPEC_CPF. Definem regra/conteúdo.
4. **Governança e planos** — `GOVERNANCA_AGENTES.md`, `docs/ROADMAP.md`, `PLANO_*.md`. Registram decisão e histórico.

Regra permanente: **BH em produção nunca é prejudicado** (comparador byte-idêntico); nada vai a produção sem revisão supervisionada + OK do Juliano.

## 2. Mapa rápido (qual arquivo manda em quê)
- **Front:** `src/App.jsx` (SPA único, Vite/rolldown). Deploy: `atualizar.sh` → Vercel. Cache: `vercel.json`.
- **Backend:** `supabase/functions/` (Deno). **Versões no ar — conferido ao vivo em 29/09/2026** (`npm run motor:listar`, projeto `eultwfzzlgcmcikobmmy`): admin-action **v64**, athlete-action **v22**, login-atleta **v11**, comprovante-url **v3**, circuito-dados **v4**, despachos-do-dia **v6**. ⚠️ **Em 29/09/2026 o FONTE de `admin-action` e `athlete-action` está à frente do ar** (a auditoria multi-circuito, commits `f1cd61c`/`6266f11`/`707c40f`, não publicados) — ver `docs/CHANGELOG.md`. **Novo e sem dono documentado:** uma função **`arte` v1** apareceu no projeto em 29/09/2026 (11h52 BRT), sem pasta neste repositório; sinalizada, não tocada. *(Números anteriores desta linha: v62/v21/v9 em 19/09, que já estavam três deploys atrás em 29/09.)* Lista anterior mantida como registro: + comprovante-url, anonimizar-atleta, resetar-pin-atleta, backup, torneios-api (outro produto, mesmo projeto). (Corrigido: estava anotado v58/v19 — a Onda 0.10 de 16/09 já tinha subido v59→v60/v19→v20 e o índice não tinha acompanhado.) **Achado novo nesta rodada:** o `entrypoint_path` ao vivo de `login-atleta`, `circuito-dados` e `despachos-do-dia` — as três sem redeploy desde 08/09/2026 — ainda aponta para uma pasta de **rascunho do projeto de torneios** (`.../JULIANO-APP-TORNEIO/.../scratchpad/publicar-so-cors/...`), não para este repositório. O `CHANGELOG.md` (08/09) já registrava esse padrão ("deploys anteriores saíram de cópias montadas à mão... entrypoint_path apontava para pastas temporárias") e dizia tê-lo corrigido — mas só para `admin-action` (que hoje aponta corretamente para `/Users/strutzki/clube-tenis-mesa-v2/...`, junto com `athlete-action`). As outras três nunca foram republicadas desde então, então continuam com a origem antiga. Sem rollback confiável para essas três enquanto isso não for corrigido — é o mesmo achado do Guardião de Segurança sobre o `login-atleta` (ver `CLAUDE.md`, Armadilhas), só que abrange mais funções do que ele tinha nomeado.
- **Banco (Modelo B):** identidade+rating global em `atletas`; sazonal por circuito em `circuito_atletas`; config em `circuitos` (BH em `configuracao`); histórico em `partidas_historico`; CPF em `atleta_documento`; papéis em `circuito_organizadores`; sessão em `atleta_sessao`.
- **Regulamento A (rating/CBTM):** BH roda hoje a versão **v03-12** (com Cap. 10, Torneio Presencial, e o desconto de 80% para quem entra na 2ª etapa). Existe uma versão nova, **v03-13** (`docs/REGULAMENTO_TENIS_DE_MESA_v03-13.md`, criada 13/09/2026, revisada em 14 e 16/09) — mesmo texto, só tira o desconto por etapa (valor único em qualquer etapa); mantém o Cap. 10 e o resto do texto do BH intacto. **Ainda não é a versão do BH**: o motor recusa (409) virar a temporada do BH enquanto `circuitos.regulamento_versao` continuar `v03-12`. **Atualizado 19/09/2026:** o carimbo (`DEFINIR_REGULAMENTO_VERSAO`, super-admin, confirmação-com-nome), o re-aceite do atleta (`ACEITAR_REGULAMENTO`, token de sessão) e o aviso prévio (dois modos, antes/depois do carimbo) — 0.10.15 (a)+(b)+(c) — **estão construídos no fonte** (árvore provada por hash, bateria 474/0, build OK — **hoje 535/0**, ver a seção da rodada final), em revisão pelos sete guardiões, **ainda não publicados nem carimbados**. Seguem abertos: o registro da DATA do carimbo (decisão de schema, fica como gatilho), o snapshot dos aceites de hoje antes do 1º re-aceite, e o passo **(b2)**, liquidar as 3 pendências de pagamento da temporada 1/2026 (não reverificado nesta rodada) — antes de carimbar, e com a ordem de publicação de (e): **motor primeiro, app depois**. Detalhe em ROADMAP 0.10.15 e `docs/curadoria-log.md`, entrada de 19/09/2026. O `v03-12.md` continua intocado de propósito: é o registro do que os atletas de hoje aceitaram. Circuito de rating **novo** (não-BH) = versão **`vA-nc-01`** — mesmo texto de v03-12 **menos o Cap. 10** e, desde 12/09/2026, também sem o desconto por etapa; é a diferença de conteúdo definida em `docs/REGULAMENTOS_NOVOS_CIRCUITOS.md`, mas **sem `.md` canônico próprio** — mora só dentro desse arquivo, compartilhado com o texto do B (ROADMAP 0.10.3). **Regulamento B (pontos):** versão **vB-01**, sem torneio. ⚠️ **Corrigido em 29/09/2026:** o texto canônico **deixou de ser** o de `REGULAMENTOS_NOVOS_CIRCUITOS.md` e passou a ser **`docs/REGULAMENTO_vB-01.md`, GERADO** do que o app exibe por `scripts/gerar-regulamento.mjs` — **não se edita à mão**; edita-se a tela e regenera-se, e a bateria fica vermelha se os dois divergirem. Se os três arquivos discordarem, vale o gerado. (`REGULAMENTO_SISTEMA_B.md` é o **rascunho anterior**, hoje marcado como nota de projeto — ver Inventário.) **O `vB-01` tem ZERO aceites gravados** em `circuito_atletas` (conferido no banco em 29/09/2026 antes da correção do Cap. 03), e é por isso que aquela edição pôde ser feita **no lugar** sem versão nova — regra 7. A escolha do texto é por `circuitos.regulamento_versao`; no `App.jsx`, `RegulamentoView` usa **duas listas**, não uma: `VERSOES_COM_TORNEIO = new Set(["v03-12","v03-13"])` decide se o Cap. 10 aparece, e `VERSOES_COM_DESCONTO_ETAPA = new Set(["v03-12"])` decide se os 3 textos de valor prometem 80% — a v03-13 é o primeiro caso em que as duas divergem (tem torneio, não tem desconto). As duas são fail-closed (versão desconhecida não ganha nem o capítulo nem o desconto). Texto no `App.jsx` (RegulamentoView) + docs `REGULAMENTO_*` / `REGULAMENTOS_NOVOS_CIRCUITOS.md`.
- **Marca:** `marca/Manual_Aplicacao_Marca_Clube_Tenis_Mesa_v2.pdf` (única). Slogan "Vem pro Clube"; 4 cores; sem "BH" na marca nacional; "cortada"=smash.
- **LGPD/CPF:** `ESPEC_CPF_SEGURANCA.md`; consentimento `cpf-2026-08-v1`; controlador Juliano Strutzki (PF).

## 3. Inventário — o que está ATUAL vs SUPERADO
### Ativo / referência viva (consultar e manter)
- `docs/curadoria-indice-app-tenis-de-mesa.md` (este), `docs/curadoria-log.md`, `CHANGELOG.md`
- `GOVERNANCA_AGENTES.md` + `.claude/agents/*.md` (8 duplas de agentes)
- `docs/ROADMAP.md` — a fonte de verdade do que fazer a seguir (substituiu `ROADMAP_MULTICIRCUITO.md` e `PLATAFORMA_BACKLOG.md`, que **não existem mais** como arquivos; corrigido aqui em 13/09/2026 — as duas referências antigas ainda apareciam neste índice)
- `REGULAMENTO_TENIS_DE_MESA_v03-12.md` (BH, vigente hoje — intocado de propósito), `REGULAMENTO_TENIS_DE_MESA_v03-13.md` (BH, próxima temporada — ver 0.10.15)
- **`REGULAMENTO_vB-01.md`** — *(novo em 29/09/2026)* o **regulamento canônico do Sistema B**, **gerado** por `scripts/gerar-regulamento.mjs` a partir do `App.jsx`. **Nunca editar à mão.** ⚠️ Uma frase dele — o campo `resumo` — é escrita **à mão dentro do gerador** e **não** é protegida pela comparação (ela está nos dois lados). Ver ROADMAP, "Decisões ainda em aberto".
- `REGULAMENTOS_NOVOS_CIRCUITOS.md` (texto de `vA-nc-01`; para o `vB-01` é **referência de projeto**, não mais a fonte — ver acima), `ESPEC_CPF_SEGURANCA.md`, `SEGURANCA_RPC_AUDIT.md`
- `PLANO_DESPACHOS.md` (proposta ativa), `PLANO_INSCRICAO_POR_CIRCUITO.md` (parcial: falta Região/vagas)
- `ROTEIRO_TESTE_SISTEMA_B.md`

### Ativo, mas com status ambíguo — precisa de decisão de conteúdo (não é rotina)
- `REGULAMENTO_SISTEMA_B.md` — é o **rascunho** ("RASCUNHO v2", linha 1 do arquivo) que originou o texto do `vB-01` hoje publicado em `REGULAMENTOS_NOVOS_CIRCUITOS.md`. Ficou **incompleto** de propósito (só lista o que muda do A pro B, não o texto corrido dos 13 capítulos) e sua própria última linha diz "Próximo passo (sessão futura): cabear no app" — passo que já aconteceu. O índice o listava como "Ativo" ao lado do texto completo, o que sugere dois documentos concorrentes definindo o mesmo `vB-01`. Nenhum teste depende dele. Recomendação: mover para `historico/` como registro de decisão (mantém o "porquê"), deixando `REGULAMENTOS_NOVOS_CIRCUITOS.md` como o único texto corrido do B — mesma lógica que já vale para `vA-nc-01` faltando o seu próprio `.md` (ROADMAP 0.10.3). Fica para o Juliano decidir; sinalizado, não movido.

### Histórico (fase concluída — manter como registro, não como plano ativo)
- `PLANO_FASE4B_DUALWRITE.md`, `PLANO_FASE4C.md`, `PLANO_FASE_A.md`, `PLANO_FASE_A2.md`
- `PLANO_MOTOR_B.md`, `PLANO_PAPEIS.md`, `PLANO_PARTICIPAR.md`, `PLANO_VIRADA_NAOBH.md`
- `REVISAO_RISCO_MIGRACAO_MULTICIRCUITO.md`, `REGISTRO_VALIDACAO_2026-08.md`
- SQLs de migração já aplicados: `fase4c_reabrir_leitura.sql`, `faseA1_pareamento.sql`

### Clutter / a limpar (NÃO são fonte de verdade)
- `files.zip` na raiz (194.897 bytes, 28/06/2026 — `logo-192.png`/`logo-512.png`/`manifest.json`/`index.html` de antes da decisão de nome de 10/09) — órfão, **sinalizado pela 3ª vez** (05/09, 10/09, 14/09) sem ação. Candidato a remoção; recomendo executar desta vez, mediante OK.
- ~~`INDICE_PROJETO.md` na raiz~~ — **removido em 06/09/2026** (curadoria-log), não apenas "virou ponteiro". Corrigido aqui em 13/09/2026: este índice ainda descrevia o arquivo como existente.
- ~~Backups datados do front (`src/App.jsx HH.MM.SS`, dezenas, + `App.jsx 20.13.44` na raiz)~~ — **RESOLVIDO em 07/09/2026** (CLAUDE.md, seção Armadilhas: "foram removidas... continuam no histórico do git"). Achado nesta rodada (14/09/2026): este índice ainda os listava como clutter pendente uma semana depois de terem sido removidos — conferido agora (`find` na raiz e em `src/`): zero arquivos desse padrão. Corrigido.

### Novo em 16/09/2026 (R3)
- **`ROADMAP.md` 0.10.15 ganhou o passo (b2)** — liquidar as 3 pendências de
  pagamento da temporada 1/2026 antes de carimbar a v03-13 (decisão do
  Juliano, 15/09: "nada muda do circuito atual") — e o (e) foi corrigido:
  a ordem de publicação é **motor primeiro, app depois** (o texto anterior
  dizia o contrário; o guardião de Confiabilidade tinha avisado e a inversão
  não tinha sido levada ao documento — agora está, com a comparação dos dois
  cenários).
- **Quatro itens novos**: `0.10.20` (`NOVA_TEMPORADA` não pede
  confirmação-com-nome, ao contrário do padrão da casa), `0.10.21`
  (`DEFINIR_FINANCEIRO` muda o preço da temporada aberta sem checar a versão
  do regulamento — severidade baixa hoje, por configuração, não por código),
  `0.10.22` (atleta logado não tem link para reler o regulamento — bloqueia
  o aviso prévio do 0.10.15(c)), `0.10.23` (trocar de circuito e salvar o
  financeiro na mesma janela grava no circuito errado — inalcançável hoje,
  só 1 circuito existe). Também apareceram, fora do pacote desta rodada mas
  já no ROADMAP, `0.10.18` (`PARTICIPAR` do `login-atleta` grava aceite sem
  versão) e `0.10.19` (`login-atleta` fica de fora do pacote da Onda 0.10 de
  propósito — tem mudança de escopo alheia pendente).
- **Conferi 3 das citações de linha de código do ROADMAP contra o `App.jsx`
  atual** (0.10.20 cita `App.jsx:7313-7398` para o padrão de
  confirmação-com-nome; 0.10.23 cita `:4953-4963`, `:6604`, `:6646`).
  A substância bate em todos os casos (confirmação-com-nome existe em
  `CancelarCircuitoCard`; `trocarCircuito` de fato faz
  `setCircuitoSelId` antes do `await loadFromSupabase()`) — mas os números de
  linha estão levemente errados em alguns pontos (ex.: o padrão
  confirmação-com-nome fica em ~7404-7419, não 7313-7398, que é a seção do
  "Encerrar", mais simples; `AdminFinanceiro key={circuitoSelId}` está em
  `:6608`, não `:6604`). **Não é erro de conteúdo** — é `App.jsx` se movendo
  enquanto o ROADMAP era escrito (ver item abaixo). Não é rotina corrigir
  número de linha a cada movimento do arquivo; sinalizo o padrão, não cada
  ocorrência.
- **`src/App.jsx` mudou de hash durante a própria auditoria, de novo** — a
  2ª e 3ª vez, depois da reincidência que eu tinha achado na R2. Detalhe
  completo, com a honestidade que pedi de volta, em `docs/GOVERNANCA_AGENTES.md`
  (seção de vereditos da Onda 0.10) — registrado por mim nesta rodada, a
  pedido do supervisor do Curador. Consequência prática: qualquer parecer de
  guardião ancorado no hash de `App.jsx` da R2 precisa ser reconfirmado
  contra o hash desta R3 antes de valer para publicação.

### Novo em 19/09/2026 — RODADA FINAL (3ª revisão do 0.10.15)

Árvore congelada conferida por md5 contra a lista do coordenador: **os 8 hashes
batem**. Bateria **535/0** — somada por mim, seção a seção (4+38+20+24+25+24+11
+16+22+351 = 535), não lida do resumo. Só `docs/` e `CLAUDE.md` foram editados.

- **⚠️ COLISÃO DE NUMERAÇÃO NO ROADMAP, corrigida.** Os dois itens criados
  nesta rodada nasceram como `0.10.23` e `0.10.24` — **números já ocupados
  desde 15/09**. O documento ficou com quatro itens e dois números.
  Renumerados: marca no cabeçalho da `RegulamentoView` → **0.10.25**; link do
  card do admin para Mensagens → **0.10.26**. Os antigos mantêm os números
  (já citados neste índice e em pareceres). Cada item novo levou uma nota de
  procedência, para quem procurar pelo número antigo num parecer de 19/09.
- **Quatro itens liam como ABERTOS depois de terem sido FEITOS.** O
  coordenador tinha atualizado só o bloco de status do 0.10.15; as
  entradas-mãe seguiam no texto original. Corrigidos:
  - **0.10.20** (confirmação-com-nome na virada) — FEITO no fonte;
  - **0.10.18** (fail-closed do `PARTICIPAR`) — FEITO no fonte
    (`login-atleta:266-276`, 409 `versao_regulamento_indisponivel`);
  - **0.10.19** — **SUPERADO**: dizia "o arquivo **não foi tocado** nesta
    onda", e o `login-atleta` **foi** tocado (ganhou a guarda do 0.10.18 e
    perdeu o `veFinanceiro`). Ele volta para dentro do pacote, como v8 → v9;
  - **0.10.6** — a descrição do diff contra o ar **se inverteu** e estava
    errada: o repositório já não está à frente por causa do
    `org_ve_financeiro` (esse foi *removido* do repo), e sim por causa da
    guarda do regulamento. A v9 sobe por regulamento, não por financeiro.
- **0.10.22 — premissa corrigida, item segue ABERTO.** Dizia "só existem
  **dois** pontos de entrada da `RegulamentoView`". São **três**: os dois
  antigos (`App.jsx:1595` e `:1690`, antes anotados `:1575`/`:1670`) mais o
  novo `:9897`, dentro da `ReAceiteRegulamentoCard`. O terceiro **não fecha o
  item**, porque é condicional — só renderiza para quem está numa versão
  diferente da vigente. Quem está **em dia** continua sem caminho nenhum.
- **`CLAUDE.md` — três correções.** (1) "a bateria cobre o motor, não o app"
  reescrita: hoje a bateria **executa quatro** funções, atualizado em 27/09/2026 (`admin-action`, `athlete-action`, `comprovante-url` e `login-atleta` — este só no `PARTICIPAR`; antes eram só `admin-action` e
  `athlete-action`, esta com **8 cenários**, não só a guarda do `INSCREVER`) e
  **nenhum pedaço do app**; (2) a função carregadora chamava-se `carregarMotor`
  no texto e **não existe** — é `carregarFuncao` (`testes/carrega-motor.mjs:31`),
  conferido por `grep`; (3) a convenção "confirmação-com-nome, padrão já
  adotado nas ações que apagam" passou a nomear os três pontos onde vale,
  **incluindo a virada**, que era a exceção e deixou de ser.
- **`docs/GOVERNANCA_AGENTES.md` — regra nova de 19/09/2026, três lições**:
  (a) asserção por regex fica verde com a regra quebrada, com a tabela das
  **3 mutações nomeadas** que provaram isso no re-aceite; (b) duas guardas
  fail-closed cercando o mesmo estado criaram um **impasse** (nem carimbar nem
  virar), visto só ao rodar a bateria — daí o procedimento obrigatório da
  virada existir por escrito; (c) `no-undef` pega identificador inexistente
  mas **não** pega propriedade inexistente em objeto que existe. Conferi:
  `state.circuitoSlug` e `state.sistema` de fato não existem (o `state` está
  em `App.jsx:755`) **e não chegaram à árvore congelada** — é lição de portão,
  não defeito no ar.
- **`docs/CHANGELOG.md` — entrada escrita em RASCUNHO, marcada como NÃO
  PUBLICADA**, no topo, com aviso para quem só quer saber o que está no ar.
  Traz as versões (`admin-action` v60→v61, `athlete-action` v20→v21,
  `login-atleta` v8→v9), a **ordem** (as três funções primeiro, app depois),
  o procedimento obrigatório da virada, a linha em branco do **registro datado
  do carimbo** (passo (e)) e as fontes de rollback. No dia: datar e mover.
  **Nada foi publicado nesta rodada** — o histórico real continua terminando
  em 16/09.
- **`testes/README.md`** — o número foi corrigido pelo coordenador (535); o
  **corpo continua atrasado** e fora do meu alcance. Detalhe no Inventário.
- **Varredura além do pacote (achados meus).** Fui olhar os docs que ninguém
  citou nesta onda, e havia drift:
  - **`ESTADO-DEV-app-tenis-de-mesa.md` — o doc que o `CLAUDE.md` manda ler
    primeiro ("comece por ele") listava as Edge Functions **seis deploys
    atrasadas**: admin-action v54 / athlete-action v17 / login-atleta v5 /
    circuito-dados v2, e nem mencionava `despachos-do-dia`. Corrigido para
    v60 / v20 / v8 / v4 / v6, com aviso de que a linha envelhece a cada deploy
    e ponteiro para `npm run motor:listar`. Também citava um **`INDICE.md`**
    removido em 06/09/2026 — repontado para este índice. O resto do documento
    **não** foi revisado: continua o retrato de 05/set, e agora diz isso.
  - **Referências órfãs a `INDICE_PROJETO.md`** (arquivo removido em
    06/09/2026, pendência que o `curadoria-log.md` abriu como "follow-up
    opcional" naquela data e nunca fechou): corrigidas em
    `docs/agente-curador-projeto.md` e `docs/GOVERNANCA_AGENTES.md`.
    ⚠️ **Sobram duas, e são CONFIGURAÇÃO, não acervo** —
    `.claude/agents/curador-projeto.md:55` e
    `.claude/agents/supervisor-curador.md:27` ainda mandam manter/consultar
    `INDICE_PROJETO.md`. **Não editei de propósito**: `.claude/agents/` é a
    configuração dos agentes, fora do mandato do Curador. Consequência real:
    todo Curador e todo Supervisor-Curador que nascer vai procurar um arquivo
    que não existe há duas semanas. **Precisa do OK do Juliano.**
  - **`LEIA-ME.md`** dizia "40 documentos"; são **37** + o LEIA-ME, mais 12 em
    `historico/`. Contado, corrigido — era a outra metade da mesma pendência
    de 06/09.

**Itens ABERTOS, todos nomeados e acháveis** (confirmado um a um nesta rodada):
J5 (data do carimbo no banco); **J2 (snapshot dos aceites antes do push) — o
único ABERTO que BLOQUEIA e não tem conserto depois**, porque o
`ACEITAR_REGULAMENTO` sobrescreve `versao_regulamento` e o primeiro re-aceite
apaga o estado anterior (reforcei o texto dele no ROADMAP nesta rodada, que
dizia só "só existe por arqueologia", e repliquei no rascunho do CHANGELOG);
(b2) (3 pendências de pagamento) — dentro do ROADMAP 0.10.15,
seção "Ainda ABERTO"; 0.10.22 (reler o regulamento estando em dia); 0.10.25
(marca no cabeçalho da `RegulamentoView`); 0.10.26 (link do card para
Mensagens); e o `entrypoint_path` de `circuito-dados` e `despachos-do-dia`
apontando para pasta de rascunho do projeto de torneios, sem cópia do que está
no ar — que **ganhou número nesta rodada**: agora é o ROADMAP **0.10.27**
(antes vivia só neste índice, onde ninguém que procura trabalho a fazer ia
achar). Também está no rascunho do CHANGELOG e em "Backend", no topo.

### Novo em 19/09/2026 (curadoria do 0.10.15 (a)+(b)+(c))

- **Árvore congelada, provada por hash (duas leituras idênticas), 474
  asserções / 0 falhas, build OK.** *(Number superado na rodada final do mesmo
  dia: **535/0** — a 3ª rodada de revisão acrescentou 61 asserções.)* `testes/**` e `src/App.jsx` /
  `supabase/functions/**` não foram tocados por esta rodada — confirmado de
  novo ao final (mesmos 6 md5). Só `docs/` foi editado.
- **`docs/ROADMAP.md`, item 0.10.15** ganhou um bloco de status (19/09):
  (a) o carimbo (`DEFINIR_REGULAMENTO_VERSAO`), (b) o re-aceite
  (`ACEITAR_REGULAMENTO`, por token de sessão) e (c) o aviso prévio (dois
  modos) estão **construídos, não publicados**. Registrada a decisão do
  Juliano de 19/09 ("segue") e as três decisões tomadas em nome dele durante
  a construção, com o motivo de cada uma: aviso prévio construído por
  recomendação do Jurídico; registro da data do carimbo **não** construído
  (decisão de schema, vira gatilho J5); `veFinanceiro` **revertido** do
  `login-atleta` (a liberação segue amarrada ao 1º circuito vendido, decisão
  já no `CHANGELOG.md`). Ficaram nomeados como abertos: J5 (data do carimbo),
  J2 (snapshot dos aceites de hoje antes do 1º re-aceite), (b2) não
  reverificado nesta rodada, e o 0.10.22 (atleta em dia sem caminho para
  reler o regulamento) — o (b) construído dá um botão "Ler o regulamento",
  mas só dentro do card de re-aceite, que só aparece para quem diverge da
  versão vigente; quem já está em dia continua sem entrada nenhuma.
- **`CLAUDE.md` corrigido (rotina):** a contagem de asserções estava em
  "385" (real, conferido ao vivo na hora: **474**; hoje **535**); a justificativa do guard-rail de
  `motor:publicar` citava "~178 linhas do financeiro do organizador ainda
  não liberadas" — **venceu**, o financeiro foi ao ar na v57→v58 (08/09,
  `CHANGELOG.md`) — trocada por uma justificativa que não expira a cada
  deploy (o fonte fica rotineiramente à frente do ar pelo próprio rito de
  subida); e a frase "`athlete-action` e `login-atleta` ainda não têm
  asserção nenhuma" estava parcialmente errada — `testes/regulamento-por-
  circuito.mjs` passou a rodar o `athlete-action` de verdade (não só regex)
  para a guarda do `INSCREVER`. Achado (Guardião de Segurança) registrado
  como novo item da Armadilha "o fonte pode não ser o que está no ar": o
  `login-atleta` que está no ar hoje não corresponde a nenhum commit —
  publicado de uma pasta de rascunho do projeto de torneios, com o HEAD
  deste repo dois commits à frente; cópia salva em `JULIANO/CLUBE DO TÊNIS
  DE MESA/BACKUPS/motor-no-ar-2026-09-19/ar-login-atleta-v8.ts`.
- **Achado meu, além do que foi pedido** — conferido ao vivo (`list_edge_
  functions` no projeto `eultwfzzlgcmcikobmmy`, não só lido de doc): o mesmo
  padrão do `login-atleta` (achado do Guardião de Segurança) também vale
  para `circuito-dados` e `despachos-do-dia` — as três com `entrypoint_path`
  ainda apontando para a pasta de rascunho do projeto de torneios, sem
  redeploy desde 08/09/2026. `admin-action` e `athlete-action`, redeployados
  em 17/09, já apontam corretamente para este repositório. Sem cópia salva
  de `circuito-dados`/`despachos-do-dia` equivalente à do `login-atleta` —
  sinalizado, não corrigido (não é rotina: mexer em deploy não é mandato do
  curador). Versões confirmadas ao vivo: admin-action **v60**, athlete-action
  **v20** (o índice estava em v58/v19, atrás da Onda 0.10 de 16/09), demais
  inalteradas.
- **`CHANGELOG.md` — nada escrito.** Confirmado: a última entrada (16/09)
  descreve só o que de fato foi ao ar; o trabalho do 0.10.15 (a)+(b)+(c)
  desta rodada não tem entrada, como manda o rito (só se registra depois de
  publicar, com o OK do Juliano).

### Drift / follow-ups anotados (verdade atual que ainda não virou doc/código)
- RPC global `arquivar_partidas_temporada` virou código morto (substituído pelo escopado) — dropar/restringir.
- Jurídico: confirmar nome legal do controlador + canal de direitos; política de privacidade formal; decidir backfill de CPF dos atuais.
- `atleta_documento` com 0 registros (nenhum CPF coletado em produção ainda).
- ~~`vA-nc-01` ainda promete o torneio em 4 capítulos, mesmo sem o Cap. 10~~ —
  **RESOLVIDO**, verificado nesta rodada (13/09/2026): a bateria
  (`testes/regulamento-por-circuito.mjs`, seção "A premissa: nenhum resquício
  de torneio para quem não tem torneio") agora varre as 9 menções ao torneio no
  fonte e exige que todas estejam atrás do guarda `comTorneio`, com o conteúdo
  da lista (`VERSOES_COM_TORNEIO`) travado por asserção, não só a forma. Passa
  hoje, 0 falhas. O item ficava aberto no índice desde 10/09; a correção não
  tinha sido refletida aqui.
- ~~`max_atletas` configurável, mas o Cap. 11 crava "20"~~ — **RESOLVIDO DE VERDADE
  em 29/09/2026, e agora o código concorda.** Decisão do Juliano de 10/09/2026,
  **reconfirmada por ele em 29/09**: o teto é regra da **plataforma** — 20 para todo
  circuito — e não se configura por circuito.
  **O que tinha acontecido, e vale registrar porque foi um erro de leitura meu:** o
  índice dava o item por encerrado desde 10/09, mas o **código nunca foi alinhado** —
  a criação perguntava o teto (8 a 20) desde a Fatia A1. Em 27/09 o Guardião do
  Regulamento notou a divergência, e eu alinhei **o lado errado**: mudei o
  *regulamento* para *"até 20, definido pelo organizador"*, em vez de alinhar o
  código à decisão. Em 28/09 fui adiante e criei o campo do teto na tela (0.10.9).
  Em 29/09 perguntei ao Juliano, e a decisão de 10/09 **ficou de pé** — então a fatia
  foi **desfeita antes de subir** e o código voltou para a decisão: o motor crava 20,
  nenhuma tela pergunta, e os três textos do regulamento voltaram a dizer "20".
  **E isso desfez um desvio da regra 7 que eu não tinha registrado:** a linha do teto
  é conteúdo compartilhado do Sistema A, então a troca de 27/09 alterou o texto que o
  recibo do **v03-12** aponta, sem re-aceite. Restaurar a frase original devolve
  aquele texto ao que era quando os aceites foram colhidos.
- ~~`GOVERNANCA_AGENTES.md` — a seção "Vereditos já emitidos (histórico)" não
  ganha entrada desde 07/09/2026"~~ — **RESOLVIDO em 14/09/2026.** A entrada
  da Onda 0.10 (0.10.1+0.10.2+0.10.6) foi escrita, com as três opções do
  Jurídico e a escolha do Juliano (13/09), a tabela dos 11 achados dos oito
  guardiões, a lição sobre a asserção-que-lê-texto e o registro de processo
  sobre o congelamento por hash. Conferida linha a linha nesta rodada contra
  os testes e o `ROADMAP.md` — fiel, sem achado de amenização. Único ponto
  sem confirmação possível pelos artefatos do repo: se a "mutação da virada
  otimista" (linha "Bloqueou" da tabela) foi realmente testada e ficou verde
  antes do conserto ganhar asserção — não há vestígio disso em nenhum
  arquivo (a única nota desse tipo no repositório é a do rodapé da v03-13,
  creditada ao Curador). Não é uma alegação de que a entrada omitiu algo:
  é que não consigo confirmar nem descartar pelos artefatos — ver
  `docs/curadoria-log.md`, entrada de 14/09/2026.
- **`testes/README.md` — ⚠️ PARCIALMENTE RESOLVIDO em 19/09/2026 (rodada
  final): a contagem foi corrigida para 535 pelo coordenador, quando
  `testes/**` estava editável. **O corpo do arquivo continua atrasado** e
  segue fora do meu alcance (congelado de novo nesta árvore): a tabela lista
  **7 de 14** arquivos (contados: `ls testes/*.mjs` = 14 — eu tinha escrito
  "15" nesta mesma rodada, sem contar; corrigido) e a seção "O que ainda não é
  testado" tem **duas
  linhas hoje falsas** — "`athlete-action` (...) faltam as asserções" (são 8
  cenários rodando a função de verdade) e "Desempates do ranking
  (`cmpRankingDB`/`cmpRankingB`)" (o Sistema B tem cenário discriminando 3 dos
  5 níveis, ver ROADMAP 0.10.24). A tabela de mutações lista **8**; esta onda
  produziu **12**. Recomendação mantida para quando `testes/**` descongelar.
  Registro histórico do achado abaixo.**

- *(histórico)* **`testes/README.md` — não resolvido, e piorou.** Em 14/09 achei que dizia
  "82 asserções" contra uma bateria real de 271, e recomendei correção quando
  `testes/**` descongelasse. Em 16/09 segue dizendo **"326"**, contra uma
  bateria real de **370** (conferido rodando `npm run teste` ao vivo) — o
  arquivo não regrediu, só não acompanhou as duas rodadas que se passaram
  desde então. Os dois achados de 14/09 continuam de pé, sem correção
  possível pelo meu mandato (`testes/**` congelado nesta árvore também):
  a tabela de arquivos lista só 7 dos 14 que `testes/` tem hoje (faltam
  `regulamento-por-circuito.mjs`, `permissoes.mjs`, `pacote.mjs`,
  `erros-na-tela.mjs`, `mensagens.mjs`, `contador-mensagens.mjs` e agora
  também `nomes-que-nao-existem.mjs`, novo em 14/09); e a frase "**O front
  (`src/App.jsx`) — nada dele passa por aqui**" segue falsa — além de
  `regulamento-por-circuito.mjs` (regex sobre `App.jsx`), agora também
  `nomes-que-nao-existem.mjs` cobre o front inteiro (roda `oxlint --format
  default src/ testes/ supabase/functions/` e trava a regra `no-undef`).
  Recomendo, quando `testes/**` descongelar: as 14/15 linhas da tabela, a
  contagem 370, e a frase do front reescrita.
- **`CLAUDE.md` — corrigido nesta rodada.** Dizia "341 asserções"; a bateria
  real é 370 (conferida ao vivo, não só lida). É o único dos dois contadores
  fora de `testes/**`, então pude corrigir.
- ~~`docs/REGULAMENTO_TENIS_DE_MESA_v03-13.md` termina com o rodapé errado~~ —
  **RESOLVIDO em 14/09/2026**, reconferido em 16/09/2026. Rodapé confere
  "Regulamento v03-13"; `.md` e lista `esperadas` do teste corrigidos juntos;
  lição em comentário (linhas 490-493 de `testes/regulamento-por-circuito.mjs`).
  **A v03-13 mudou mais três vezes entre a R2 (14/09) e esta rodada (16/09) —
  reconferida linha a linha, `diff -u` completo, continua cópia fiel da
  v03-12 fora da cláusula de valor.** As três mudanças, todas correções reais:
  (1) a citação de capítulo da justificativa foi de "Cap. 11" para **"Cap. 12"**
  — conferido: é o Cap. 12 que tem "valor único por temporada — sem cobrança
  mensal nem parcelamento", o Cap. 11 não; (2) a cláusula de não-retroatividade
  parou de nomear "v03-12" e passou a dizer "**quem ingressou sob o regulamento
  anterior a esta versão**" — achado registrado no próprio teste (linhas
  549-561): a redação anterior, lida ao pé da letra, não protegia **nenhum**
  dos 15 atletas do BH, porque nenhum tem `v03-12` gravado (11 v03-3, 1 v03-5,
  1 v03-8, 1 v03-11, 1 v03-3 suspensa) — o protegido agora é definido por FATO
  (data de ingresso), não por rótulo de versão; (3) a tabela de valores perdeu
  a linha "Abertura da temporada (Rodada 1) | 100% do valor", redundante com
  "Entrada em qualquer etapa | Valor integral" já que não há mais desconto
  por etapa para contrastar. Nada além disso, do cabeçalho ao rodapé, diverge
  da v03-12 — Cap. 10 (torneio) e o resto dos 13 capítulos, intactos. O teste
  agora confere os dois lados do diff (o que saiu da v03-12 E o que foi
  colado na v03-13 fora do bloco "O que muda"), fechando o modo de falha que
  só olhava linhas removidas. Bateria (370/0) e build conferidos ao vivo
  nesta rodada, não só lidos do resumo.
