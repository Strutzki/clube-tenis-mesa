# Auditoria de RPCs SECURITY DEFINER expostas ao anon (chave publicável)

Feita após dois achados externos. Todas as funções `SECURITY DEFINER` em `public` foram auditadas.
Revisão do Guardião (supervisionado) antes de aplicar. Mudanças **só de banco, retrocompatíveis** — nenhum deploy de front necessário. Verificadas ao vivo pela chave anon.

## 1. `arquivar_partidas_temporada(p_rotulo text)` — CORRIGIDO
- **Risco:** SECURITY DEFINER, EXECUTE aberto ao `anon`. Faz `insert into partidas_historico select * from partidas` com qualquer rótulo. Qualquer um com a chave pública podia **poluir/corromper o histórico** (não apaga a temporada — o delete é etapa separada — mas despeja cópias sob rótulos falsos).
- **Uso legítimo:** só o servidor (NOVA_TEMPORADA, via service_role). O front nunca chama.
- **Fix:** `revoke execute ... from anon, authenticated`. ACL agora `{postgres, service_role}`. Fechado sem quebrar nada.

## 2. `buscar_atleta_por_telefone(telefone_busca text)` — CORRIGIDO
- **Risco:** devolvia a **linha inteira do atleta** (nome, telefone, rating, histórico...) pra quem soubesse o telefone. Rate-limit existia (60/5min global). Vazamento de PII por telefone.
- **Uso real:** só checagem de duplicidade na inscrição (2 pontos), ambos só testam existência. Login real é a edge `login-atleta` (não usa este RPC).
- **Fix:** reduzida a devolver **só `id`** (público). Mantém rate-limit + log. DROP+CREATE em transação (evita janela de erro em produção) + `revoke from public` + grant a anon/authenticated/service_role. Retrocompatível: o front só checa se veio linha.
- **Verificado:** match → 1 linha só com id; sem match → 0 linhas; anon 200.

## 3. `preco_temporada_atleta(p_id uuid)` — HIGIENE (não é o fix real)
- **Risco:** SECURITY DEFINER, aberta ao anon. Como os ids de atleta são públicos (roster), qualquer um enumera `isento`/`desconto`/preço de qualquer atleta. Dado financeiro individual.
- **Feito:** enxugado o retorno para `{isento, valor_base_cent, preco_final_cent}` (removidos `desconto_pct` e `financeiro_ativo`, que o front não usa). **Honestamente cosmético** — o preço final já revela o desconto. O vazamento continua aberto.
- **NÃO** foi adicionado rate-limit: o padrão global (como o do telefone) **quebraria a exibição de preço** no circuito ativo (vários atletas abrindo o card ao mesmo tempo estourariam o teto).

## Backlog — o fix real (fase de contas / CPF)
- **Autorização por chamador** nas RPCs de dado financeiro: exigir que o `p_id` bata com o atleta autenticado (sessão/JWT), em vez de aberto por id ao anon. É o único fix que resolve o vazamento do #3 **e** viabiliza rate-limit por-usuário sem quebrar o circuito.
- Migrar o rate-limit **global** do telefone para **por chamador/IP** na mesma fase.
- Considerar `revoke ... from public` explícito em toda RPC SECURITY DEFINER (não depender do default do Postgres).

## Lição de processo
Toda função `SECURITY DEFINER` exposta ao anon é uma superfície de dados: ao revisar mudança de banco, mapear **o que ela retorna** e **quem a chama no front**, não só "vaza ou não". Rodar a auditoria completa de `pg_proc where prosecdef` periodicamente.
