-- ============================================================================
-- FASE 4C · Passo 1 — reabrir LEITURA de circuito_atletas/circuitos pro app (anon)
-- ============================================================================
-- ADITIVO e INVISÍVEL pro app atual (que ainda lê de atletas/configuracao).
-- Só habilita a leitura nova. NÃO executar antes de fechar a rodada em andamento.
-- Aprovado pelo Guardião (GO-com-condições): grants de COLUNA (nunca table-level),
-- excluindo as 3 sensíveis de circuito_atletas; policies de SELECT molde partidas_historico.
--
-- Rollback (na ordem certa): reverter o FRONT primeiro (git), DEPOIS rodar
--   revoke select on public.circuito_atletas from anon, authenticated;
--   revoke select on public.circuitos from anon, authenticated;
--   drop policy leitura_publica_circuito_atletas on public.circuito_atletas;
--   drop policy leitura_publica_circuitos on public.circuitos;
-- ============================================================================

-- 1) circuito_atletas — 23 colunas seguras; EXCLUI desconto_pct, isento, wo_culposos_temporada
grant select (
  id, circuito_id, atleta_id, status, motivo_reprovacao, pendente_circuito,
  ultima_recusa_circuito_em, chave, saldo_temp, vitorias, derrotas,
  vitorias_total, derrotas_total, aceite_regulamento, data_aceite_regulamento,
  versao_regulamento, pagamento_confirmado, pagamento_proxima_confirmado,
  quer_renovar, renovacao_em, inscrito_em, historico, posicao_historico
) on public.circuito_atletas to anon, authenticated;

-- 2) circuitos — grant de COLUNA (todas as 28 são não-sensíveis; evita foot-gun de table-level)
grant select (
  id, slug, cidade, uf, sistema, regulamento_versao, ativo, nome_circuito, fase,
  temporada_numero, temporada_ano, rodadas_por_temporada, auto_validar_placar,
  financeiro_ativo, valor_temporada, desconto_global_pct, percentual_entrada_meio,
  max_atletas, data_inicio_temporada, proxima_aberta, proxima_nome,
  proxima_data_inicio, proxima_rotulo, proxima_valor_cheio, proxima_valor_desconto,
  pix_chave, criado_em, atualizado_em
) on public.circuitos to anon, authenticated;

-- 3) Policies de SELECT (leitura pública — molde partidas_historico)
create policy leitura_publica_circuito_atletas on public.circuito_atletas for select to public using (true);
create policy leitura_publica_circuitos        on public.circuitos        for select to public using (true);

-- 4) Recarregar o schema do PostgREST (pra o embed e os grants de coluna valerem já)
notify pgrst, 'reload schema';

-- ============================================================================
-- TESTE ANON obrigatório APÓS aplicar (com a publishable key, NÃO com service_role):
--   circuito_atletas?select=desconto_pct           -> deve dar 401/permission denied
--   circuito_atletas?select=isento                 -> 401
--   circuito_atletas?select=wo_culposos_temporada  -> 401
--   circuito_atletas?select=status,atletas(nome,rating)&circuito_id=eq.<BH> -> 15 linhas
--   circuitos?select=pix_chave&id=eq.<BH>          -> OK (paridade com hoje)
--   PATCH/POST anon em qualquer das duas            -> negado
-- ============================================================================
