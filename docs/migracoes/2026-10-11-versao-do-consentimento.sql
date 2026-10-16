-- A POLÍTICA DE PRIVACIDADE PASSA A TER VERSÃO
-- 11/10/2026 — condição C5 do Guardião Jurídico, aprovada pelo Juliano ("suba junto").
--
-- O BURACO, medido e não deduzido:
--
--   `atletas` tinha só `aceite_lgpd` e `data_aceite_lgpd`. O regulamento tem
--   `versao_regulamento`; o CPF tem `atleta_documento.cpf_consent_versao`
--   ('cpf-2026-08-v1', com data e IP). A POLÍTICA DE PRIVACIDADE não tinha nada.
--   Ou seja: 15 recibos apontando para "o texto que estiver na tela hoje".
--
-- E o texto JÁ MUDOU, sem versão e sem re-aceite. Prova (git):
--   commit 2a8938d, 05/08/2026 — o último a tocar o App.jsx antes do último
--   aceite (09/08/2026 11:48 UTC) — dizia:
--     "❌ Não coletamos CPF, endereço, e-mail ou dados financeiros"
--   hoje diz:
--     "❌ Não coletamos endereço, e-mail ou dados financeiros"
--   A palavra CPF foi apagada quando o app passou a coletar CPF. As 15 pessoas
--   detêm um recibo que resolve para um texto OPOSTO ao que leram, justamente
--   sobre o dado mais sensível.
--
--   Atenuante conferido no banco: nenhum dos 15 tem CPF guardado, e os 3 que
--   deram CPF (os do bh2) têm consentimento específico versionado, com data e
--   IP, e `cpf_cifrado` nulo nos três — só o hash, como o texto promete. O que
--   está incoerente é o recibo, não a prática.
--
-- SEM ESTA COLUNA, toda melhoria futura no texto repete o mesmo defeito: não há
-- onde registrar QUAL texto cada pessoa aceitou.
--
-- ⚠️ ARMADILHA Nº 1 DO CLAUDE.md — por que esta coluna NÃO derruba o app:
-- a armadilha é a de `circuitos`, que o visitante lê com `SELECT *`. Em
-- `atletas` não existe grant de TABELA para `anon`/`authenticated`: o acesso é
-- COLUNA A COLUNA (36 de 44 para `anon`). Logo uma coluna nova não é herdada
-- pelo `anon` e não quebra leitura nenhuma. Medido pelo Guardião Jurídico em
-- 11/10/2026 e conferido de novo antes de escrever isto.
-- E DE PROPÓSITO NÃO DAMOS GRANT AO `anon`: nenhuma leitura pública precisa da
-- versão de consentimento, e alargar a superfície sem necessidade medida é o
-- contrário de proteger. As 8 colunas deliberadamente fora do `anon` são o que
-- protege `pin_hash` e companhia.

alter table public.atletas
  add column if not exists privacidade_versao text;

comment on column public.atletas.privacidade_versao is
  'Versão do texto de privacidade que ESTE atleta aceitou. NULL = aceite anterior '
  'a 11/10/2026, quando a política não tinha versão — o recibo existe (aceite_lgpd '
  '+ data_aceite_lgpd) mas não se sabe a qual texto aponta. Carimbada pelo '
  'INSCREVER e pelo PARTICIPAR a partir da constante PRIVACIDADE_VERSAO.';

-- Quem já aceitou NÃO é carimbado retroativamente, e isso é o ponto.
-- Preencher `privacidade_versao` dos 15 com a versão de hoje seria inventar um
-- fato: eles não leram este texto. NULL é a informação verdadeira — "aceitou
-- antes de existir versão" — e é o que permite o app pedir o re-aceite de quem
-- está sem carimbo, em vez de presumir que está em dia.

-- CONFERÊNCIA depois de aplicar:
--
--   select privacidade_versao, count(*) from atletas group by 1;
--   -- esperado AGORA: 15 linhas com NULL, nenhuma com versão.
--
--   select count(*) from information_schema.column_privileges
--    where table_schema='public' and table_name='atletas'
--      and column_name='privacidade_versao' and grantee in ('anon','authenticated');
--   -- esperado: 0 — a coluna não é legível por visitante nem por anônimo logado.
