# INDICE — fonte canônica do projeto Clube do Tênis de Mesa

**Leia este arquivo ANTES de reescrever qualquer documento.** Ele traz (1) a hierarquia de fontes de verdade e (2) o inventário do que está atual vs. superado. Mantido pelo agente `curador-projeto`; toda revisão é registrada em `docs/curadoria-log.md`. Estado: 16/09/2026.

⚠️ **`src/App.jsx` andou várias vezes durante as auditorias de 14 e 16/09/2026** (registrado em `docs/GOVERNANCA_AGENTES.md`, seção de vereditos da Onda 0.10). Se você está lendo isto entre rodadas, **não presuma que o hash mais recente que você tem é o de agora** — reconfira.

## 1. Hierarquia de fontes de verdade
Quando dois documentos divergem, vale a fonte mais alta:
1. **Realidade em produção** — o que o app faz e o que está no banco/edge (Supabase `eultwfzzlgcmcikobmmy`). Fonte final.
2. **Código** — `src/App.jsx` (front) e `supabase/functions/*` (backend). É o que roda.
3. **Docs de referência viva** — regulamentos, manual da marca, ESPEC_CPF. Definem regra/conteúdo.
4. **Governança e planos** — `GOVERNANCA_AGENTES.md`, `docs/ROADMAP.md`, `PLANO_*.md`. Registram decisão e histórico.

Regra permanente: **BH em produção nunca é prejudicado** (comparador byte-idêntico); nada vai a produção sem revisão supervisionada + OK do Juliano.

## 2. Mapa rápido (qual arquivo manda em quê)
- **Front:** `src/App.jsx` (SPA único, Vite/rolldown). Deploy: `atualizar.sh` → Vercel. Cache: `vercel.json`.
- **Backend:** `supabase/functions/` (Deno). Versões no ar (conferido com `npm run motor:listar` em 10/09/2026): admin-action **v58**, athlete-action **v19**, login-atleta **v8**, circuito-dados **v4**, despachos-do-dia **v6**; + comprovante-url, anonimizar-atleta, resetar-pin-atleta, backup. (Corrigido: estava anotado v54/v17/v5/v2 — desatualizado.)
- **Banco (Modelo B):** identidade+rating global em `atletas`; sazonal por circuito em `circuito_atletas`; config em `circuitos` (BH em `configuracao`); histórico em `partidas_historico`; CPF em `atleta_documento`; papéis em `circuito_organizadores`; sessão em `atleta_sessao`.
- **Regulamento A (rating/CBTM):** BH roda hoje a versão **v03-12** (com Cap. 10, Torneio Presencial, e o desconto de 80% para quem entra na 2ª etapa). Existe uma versão nova, **v03-13** (`docs/REGULAMENTO_TENIS_DE_MESA_v03-13.md`, criada 13/09/2026, revisada em 14 e 16/09) — mesmo texto, só tira o desconto por etapa (valor único em qualquer etapa); mantém o Cap. 10 e o resto do texto do BH intacto. **Ainda não é a versão do BH**: o motor recusa (409) virar a temporada do BH enquanto `circuitos.regulamento_versao` continuar `v03-12` — falta o carimbo manual pra `v03-13`, que **ainda não existe como ação** (`DEFINIR_REGULAMENTO_VERSAO`, conferido ausente do `admin-action` em 16/09) — (ROADMAP 0.10.15, gatilho: antes da próxima virada do BH; agora com passo **(b2)**, liquidar as pendências de pagamento da temporada 1/2026 antes de carimbar, e a ordem de publicação corrigida em (e): **motor primeiro, app depois**). O `v03-12.md` continua intocado de propósito: é o registro do que os atletas de hoje aceitaram. Circuito de rating **novo** (não-BH) = versão **`vA-nc-01`** — mesmo texto de v03-12 **menos o Cap. 10** e, desde 12/09/2026, também sem o desconto por etapa; é a diferença de conteúdo definida em `docs/REGULAMENTOS_NOVOS_CIRCUITOS.md`, mas **sem `.md` canônico próprio** — mora só dentro desse arquivo, compartilhado com o texto do B (ROADMAP 0.10.3). **Regulamento B (pontos):** versão **vB-01**, sem torneio, texto completo em `REGULAMENTOS_NOVOS_CIRCUITOS.md` (há também um `REGULAMENTO_SISTEMA_B.md` separado, mas é o **rascunho anterior** que originou aquele texto, incompleto e desatualizado — ver Inventário). A escolha do texto é por `circuitos.regulamento_versao`; no `App.jsx`, `RegulamentoView` usa **duas listas**, não uma: `VERSOES_COM_TORNEIO = new Set(["v03-12","v03-13"])` decide se o Cap. 10 aparece, e `VERSOES_COM_DESCONTO_ETAPA = new Set(["v03-12"])` decide se os 3 textos de valor prometem 80% — a v03-13 é o primeiro caso em que as duas divergem (tem torneio, não tem desconto). As duas são fail-closed (versão desconhecida não ganha nem o capítulo nem o desconto). Texto no `App.jsx` (RegulamentoView) + docs `REGULAMENTO_*` / `REGULAMENTOS_NOVOS_CIRCUITOS.md`.
- **Marca:** `marca/Manual_Aplicacao_Marca_Clube_Tenis_Mesa_v2.pdf` (única). Slogan "Vem pro Clube"; 4 cores; sem "BH" na marca nacional; "cortada"=smash.
- **LGPD/CPF:** `ESPEC_CPF_SEGURANCA.md`; consentimento `cpf-2026-08-v1`; controlador Juliano Strutzki (PF).

## 3. Inventário — o que está ATUAL vs SUPERADO
### Ativo / referência viva (consultar e manter)
- `docs/curadoria-indice-app-tenis-de-mesa.md` (este), `docs/curadoria-log.md`, `CHANGELOG.md`
- `GOVERNANCA_AGENTES.md` + `.claude/agents/*.md` (8 duplas de agentes)
- `docs/ROADMAP.md` — a fonte de verdade do que fazer a seguir (substituiu `ROADMAP_MULTICIRCUITO.md` e `PLATAFORMA_BACKLOG.md`, que **não existem mais** como arquivos; corrigido aqui em 13/09/2026 — as duas referências antigas ainda apareciam neste índice)
- `REGULAMENTO_TENIS_DE_MESA_v03-12.md` (BH, vigente hoje — intocado de propósito), `REGULAMENTO_TENIS_DE_MESA_v03-13.md` (BH, próxima temporada — ver 0.10.15)
- `REGULAMENTOS_NOVOS_CIRCUITOS.md` (texto canônico completo de `vA-nc-01` e `vB-01`), `ESPEC_CPF_SEGURANCA.md`, `SEGURANCA_RPC_AUDIT.md`
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
- ~~`max_atletas` configurável, mas o Cap. 11 crava "20"~~ — **RESOLVIDO**,
  decisão do Juliano de 10/09/2026: deixou de ser configurável por circuito —
  teto fixo 8..20 para todos, e o texto "teto de 20" também é fixo (não
  ramifica). Motor e tela travam a faixa (`testes/regulamento-por-circuito.mjs`,
  seção "Teto do circuito"). O item ficava aberto no índice desde 10/09; a
  correção não tinha sido refletida aqui.
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
- **`testes/README.md` — não resolvido, e piorou.** Em 14/09 achei que dizia
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
