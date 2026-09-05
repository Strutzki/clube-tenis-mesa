# Virada de temporada para circuitos não-BH — análise de risco + plano

**Objetivo:** `NOVA_TEMPORADA` passar a funcionar em qualquer circuito (hoje recusa != BH), **escopado por `circuito_id`**, sem jamais tocar dados de outro circuito. Fecha o ciclo do admin não-BH e destrava o piloto.

## Estado atual (o que a ação faz hoje) — e o perigo
`NOVA_TEMPORADA` (admin-action) hoje:
1. Recusa se `circuitoId != bhId`.
2. Lê `atletas` (status ativo), `configuracao` (id=1), **todas** as `partidas`.
3. Calcula ranking final (só `cmpRankingDB` = Sistema A), grava histórico/totais e zera sazonais por atleta.
4. `arquivar_partidas_temporada(rotulo)` — **RPC GLOBAL**: `insert into partidas_historico select p.* from partidas p` **sem filtro de circuito**.
5. `delete from partidas` e `delete from chaves` com `.neq(id,'__none__')` = **apaga TUDO**.
6. Atualiza `configuracao`.

**Perigo já presente:** os passos 4 e 5 são globais. Como o circuito `demo-juliano` já tem 2 partidas, uma virada do BH **hoje** arquivaria e apagaria as partidas do demo junto. Não é só "adicionar o não-BH": é tornar a virada **escopada**.

## Fatos verificados (banco)
- `partidas` sem `circuito_id`: **0**; `chaves` sem `circuito_id`: **0** → escopar por `circuito_id` é completo (nada órfão).
- `partidas_historico` já tem `circuito_id` (e está com 0 linhas — BH nunca virou nesta base).
- `circuito_atletas` tem todos os sazonais (saldo_temp, vitorias, derrotas, vitorias_total, derrotas_total, wo_culposos_temporada, chave, historico, posicao_historico, flags de pagamento, quer_renovar, renovacao_em).
- `circuitos` tem toda a config (temporada_numero/ano, proxima_*, fase, nome, valor, desconto).

## Desenho (escopado por circuito_id — vale para BH e não-BH)
1. **Remover a recusa** `circuitoId != bhId`.
2. **Membros:** todos com `status='ativo'` no circuito (BH: `atletas`; não-BH: `circuito_atletas`).
3. **Partidas da temporada:** `partidas WHERE circuito_id = X` (não mais global).
4. **Ranking final** ramifica por sistema: `cmpRankingB` (B) / `cmpRankingDB` (A).
5. **Reset por membro** via `writeAtleta` (já escopado: BH→atletas+espelho; não-BH→circuito_atletas): acumula totais, zera saldo/vitórias/derrotas/wo/chave, grava histórico+posição, aplica regra de renovação de pagamento.
6. **Arquivar** com **novo RPC escopado** `arquivar_partidas_temporada_circuito(rotulo, circuito)` → `where p.circuito_id = circuito`.
7. **Apagar** `partidas WHERE circuito_id = X` e `chaves WHERE circuito_id = X` (nunca mais global).
8. **Config** via `setCfg(circuitoId, ...)` (BH→configuracao; não-BH→circuitos): fase=inscricoes, temporada++ (regra 3/ano), limpa/aplica `proxima_*`.

**Decisão de desenho:** escopar TAMBÉM o caminho do BH. Resultado para o BH é **idêntico** (todas as 34 partidas do BH têm circuito_id=BH → mesmo conjunto arquivado/apagado), só que deixa de causar dano colateral a outros circuitos. É estritamente mais seguro que hoje.

## Pareceres dos guardiões (revisão supervisionada)
- **Guardião de Segurança — GO-com-condições.** Condições: (C1) os dois deletes e o arquivamento SÓ por `circuito_id=X`, nunca global; (C2) BH: conjunto arquivado/apagado == suas 34 partidas, outros circuitos com contagem inalterada (provar antes/depois); (C3) novo RPC SECURITY DEFINER, service-role-only, sem grant anon, só move as linhas do circuito passado; (C4) writeAtleta mantém escopo (sem escrita cross-tenant).
- **Guardião do Regulamento — GO-com-condições.** Condições: (R1) ranking final ramifica por sistema (A/B); (R2) zeramento e acúmulo de totais corretos, rating preservado no A, sem rating no B; (R3) histórico registra a posição final com o rótulo/circuito certos; (R4) provar num circuito B e num A de teste (mini-temporada → virar → conferir totais/histórico/zeramento) antes do deploy.
- **Guardião de Confiabilidade — GO-com-condições.** Condições: (F1) **NOVA_TEMPORADA é irreversível** (apaga partidas) → testar SÓ em circuito descartável, **nunca no BH**, até provado; (F2) migração do RPC com grant service_role (sem anon); (F3) admin-action redeploy é código puro (balanço vs HEAD); (F4) backup do BH presente antes de qualquer virada real.

## Passos de execução (após OK do Juliano)
1. Migração: criar `arquivar_partidas_temporada_circuito(rotulo, circuito)` (scoped), grant service_role.
2. Reescrever `NOVA_TEMPORADA` escopado por circuito_id (deploy admin-action vNN).
3. Teste em circuito DESCARTÁVEL (criar B de teste, 8+ atletas, iniciar, lançar, processar, **virar**), conferir invariantes; repetir num A de teste.
4. Verificar BH intacto (contagens antes/depois) e outros circuitos intocados.
5. Front: garantir que o botão de virar temporada aparece/funciona para o admin num circuito não-BH (injeção de circuitoId já existe).
6. Registrar veredito no GOVERNANCA_AGENTES.md.

**Regra fixa:** rodar a NOVA_TEMPORADA no BH de verdade só quando o Juliano quiser virar a temporada do BH — a generalização não obriga a virar nada.
