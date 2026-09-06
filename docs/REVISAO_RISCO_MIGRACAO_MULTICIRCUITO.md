# Revisão minuciosa de risco — Fundação Multi-Circuito

**Objetivo:** rodar a migração multi-circuito **sem qualquer risco** para o banco em produção e para o circuito de BH em andamento. Este documento é o resultado da auditoria feita ANTES de qualquer migração. Nada foi executado no banco — BH está intacto.

**Data:** 2026-08-09 · **Projeto Supabase:** `eultwfzzlgcmcikobmmy`

---

## Resumo executivo

O plano herdado do handoff **quebraria o BH em produção** se rodado como estava. Encontrei 3 riscos críticos e 4 pontos de atenção. Todos têm correção — o plano revisado abaixo é aditivo, reversível e não interrompe o circuito. **Ainda não executei nada; aguardo seu OK.**

---

## O que auditei no banco real (fatos, não suposições)

**RLS (Row Level Security) por tabela:**
- Ligado com policy de leitura pública (`qual = true`, role `public`, SELECT): `atletas`, `configuracao`, `partidas`, `chaves`, `solicitacoes_wo`. → é assim que o app lê via anon.
- Ligado com **zero policies**: `mensagens_enviadas`, `pagamentos`, `tentativas_busca_telefone`, `tentativas_login_admin`. → NÃO são lidas por anon; só via edge function (service-role, que ignora RLS).
- **Desligado**: `partidas_historico` (lê via grant SELECT pro anon — é assim que o "consultar partidas passadas" funciona).

**Foreign keys que apontam para `atletas` (regra ON DELETE):**
- `partidas.atleta1_id` / `atleta2_id` → **NO ACTION** (bloqueia excluir atleta com partidas).
- `mensagens_enviadas.atleta_id` → **NO ACTION**.
- `solicitacoes_wo.atleta_id` → **NO ACTION**.
- `pagamentos.atleta_id` → **SET NULL**.

**Blindagem:** `desconto_pct` / `isento` não têm grant SELECT pro anon (revogados). O preço individual só sai pela RPC `preco_temporada_atleta` (SECURITY DEFINER).

---

## RISCOS CRÍTICOS (quebrariam o BH)

### 🔴 A — `SET NOT NULL` em `circuito_id` derruba os inserts do app
As edge functions em produção hoje inserem em `chaves`, `partidas`, `pagamentos`, `mensagens_enviadas`, `solicitacoes_wo` e `partidas_historico` **sem** informar `circuito_id`. Se a coluna virar `NOT NULL` antes das funções serem atualizadas, **todo insert falha** (null violation) — pareamento, placar, pagamento, mensagens, W.O. e arquivamento param.

**Correção:** depois de criar o circuito BH (Fase 2), dar `DEFAULT = <id do BH>` à coluna `circuito_id` nessas 6 tabelas. Aí:
- inserts atuais (sem `circuito_id`) → recebem BH automaticamente;
- `SET NOT NULL` (Fase 3) passa a ser seguro;
- na Fase 4 as funções passam a mandar `circuito_id` explícito (ganha do default);
- na Fase 5, com todo mundo explícito, remove-se o default.

### 🔴 B — FK nova de `circuito_atletas → atletas` trava o EXCLUIR_ATLETA
Depois do backfill, **todo atleta** terá uma linha em `circuito_atletas`. Se a FK for NO ACTION (padrão), excluir qualquer atleta passa a ser bloqueado — inclusive as exclusões que funcionam hoje (inscrições novas/rejeitadas sem partidas).

**Correção:** criar `circuito_atletas.atleta_id` com **ON DELETE CASCADE**. Assim, ao excluir um atleta, a participação some junto — sem regressão. (Atletas com partidas já são bloqueados pela FK de `partidas`, comportamento que continua igual.)

### 🔴 C — Backfill de `circuito_atletas` é uma "foto" que envelhece
`circuito_atletas` copia o estado sazonal de `atletas` (saldo, pagamento, renovação) num instante. Qualquer atividade do admin entre a Fase 2 e a virada da Fase 4 (validar placar, registrar pagamento, aprovar renovação) atualiza `atletas`, mas **não** `circuito_atletas` → a foto fica desatualizada.

**Correção:** `atletas` continua sendo a fonte da verdade até a Fase 4. **Re-sincronizar** `circuito_atletas` a partir de `atletas` imediatamente antes de virar o app na Fase 4 (um `UPDATE ... FROM`). Não há perda de dado — só é preciso re-sincronizar antes do corte.

---

## PONTOS DE ATENÇÃO (sem estes o resto falha em silêncio)

### 🟡 D — Tabelas novas precisam do mesmo caminho de leitura
Na Fase 4 o app vai ler `circuitos` (no lugar de `configuracao`) e `circuito_atletas` (ranking/status) via anon. Elas precisam replicar o padrão atual:
- `circuitos`: RLS ligado + policy `leitura_publica` (`qual = true`, SELECT, public). Igual `configuracao`.
- `circuito_atletas`: RLS ligado + policy pública **porém mantendo a blindagem por grant de coluna** — `desconto_pct` e `isento` SEM grant SELECT pro anon (idêntico ao que `atletas` faz hoje). Preço individual continua só pela RPC.

### 🟡 E — Backfill precisa ser idempotente
Se algum passo rodar duas vezes, não pode duplicar. `INSERT ... ON CONFLICT DO NOTHING` em `circuito_atletas` (chave única `circuito_id, atleta_id`).

### 🟡 F — Ordem de remoção na Fase 5 (destrutiva)
Só dropar `configuracao` e as colunas migradas de `atletas` **depois** que todos os leitores (app + RPCs `preco_temporada_atleta` e `buscar_atleta_por_telefone`) já estiverem usando as tabelas novas. Fora de ordem, as RPCs quebram.

### 🟡 G — Locks de ALTER/CREATE INDEX
`ALTER TABLE` e `CREATE INDEX` pegam lock ACCESS EXCLUSIVE por instantes. Nas tabelas atuais (poucas centenas de linhas) é imperceptível. Ainda assim, rodar fora de horário de pico e usar `CREATE INDEX CONCURRENTLY` onde der.

---

## Plano revisado (ordem segura)

Backup completo **antes de tudo** (função `backup-clube-tenis-mesa`).

**Fase 1 — Estrutura (aditiva, invisível ao app)**
- Criar `circuitos` e `circuito_atletas` (FK `atleta_id` com **ON DELETE CASCADE**; único `(circuito_id, atleta_id)`).
- Adicionar coluna `circuito_id` **nullable, sem default** nas 6 tabelas.

**Fase 2 — Circuito BH + backfill**
- Inserir o circuito BH (absorve `configuracao` id=1) → capturar o id.
- Backfill `circuito_atletas` a partir de `atletas` (`ON CONFLICT DO NOTHING`).
- Backfill `circuito_id = BH` nas 6 tabelas.
- `ALTER ... SET DEFAULT = <id BH>` nas 6 colunas `circuito_id`. ← destrava o risco A.

**Checkpoint — verificações de integridade**
- 0 linhas com `circuito_id` nulo nas 6 tabelas.
- `count(circuito_atletas) == count(atletas)`.
- Grants/policies das tabelas novas conferidos.

**Fase 3 — Restrições (agora seguro)**
- `SET NOT NULL` em `circuito_id` (default já cobre inserts atuais).
- Índices por `circuito_id`.
- RLS + policies + grants de coluna nas tabelas novas (blindagem preservada).

**Fase 4 — Motor (via circuito de teste descartável)**
- Re-sincronizar `circuito_atletas` ⟵ `atletas` (risco C).
- Branch A/B no motor, seletor de circuitos, criar circuito, funções passam a mandar `circuito_id` explícito. Testar tudo num circuito-teste isolado; BH segue por tenancy.

**Fase 5 — Limpeza destrutiva (só com tudo migrado e testado)**
- Remover default de `circuito_id`, dropar `configuracao` e colunas migradas de `atletas`, na ordem certa (risco F).

---

## Reversibilidade
Fases 1–3 são puramente aditivas: se algo destoar, `DROP` das tabelas novas e das colunas `circuito_id` devolve o banco ao estado atual, sem tocar em nenhum dado de BH. A Fase 5 (única destrutiva) só roda depois de BH comprovadamente rodando sobre a estrutura nova.

**Status: nada executado. Aguardando OK para o backup + Fase 1.**
