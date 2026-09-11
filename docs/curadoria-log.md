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
