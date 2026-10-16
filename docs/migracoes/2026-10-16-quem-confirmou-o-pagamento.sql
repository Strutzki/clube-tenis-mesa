-- QUEM CONFIRMOU O PAGAMENTO
-- 16/10/2026. Nasceu de uma pergunta do Juliano que o app não sabia responder.
--
-- O QUE ACONTECEU: ele entrou como atleta, viu "pagamento confirmado" e disse
-- "não lembro de ter pago". O registro existia — 03/10/2026 21:03:47, R$ 50,00,
-- PIX, criado e confirmado no MESMO milissegundo (assinatura do botão do
-- painel, não de um PIX recebido). Mas a tabela guarda valor, método e data e
-- NÃO guarda quem clicou. Então o melhor que dava para responder era "foi pelo
-- painel, nesse instante" — nunca "foi você".
--
-- Num registro de dinheiro isso é lacuna: o app afirma que está pago e não tem
-- como mostrar a origem da afirmação. E vai doer mais quando houver
-- organizador: hoje só o Juliano clica; amanhã, duas pessoas.
--
-- O QUE ESTA COLUNA NÃO É: ela não muda quem está pago, nem valor, nem a trava
-- do pareamento. É registro de autoria, aditivo. Nenhum cálculo depende dela.
--
-- VALORES:
--   'super-admin'  -> confirmado por quem entra com o PIN de administrador
--   <uuid>         -> id do atleta-organizador que confirmou
--   NULL           -> confirmado ANTES de 16/10/2026, quando não se registrava
--                     a autoria. É a informação verdadeira, e é por isso que as
--                     linhas antigas NÃO são preenchidas retroativamente:
--                     carimbar 'super-admin' nelas seria afirmar um fato que
--                     ninguém mediu.
--
-- ⚠️ ARMADILHA Nº 1 DO CLAUDE.md: não se aplica. `pagamentos` não é lida pelo
-- visitante — medido: `anon` não tem grant algum nesta tabela, e o Guardião de
-- Segurança confirmou isso rodando `set role anon` em 12/10/2026. Logo coluna
-- nova aqui não quebra leitura nenhuma. Não damos grant ao `anon` de propósito.

alter table public.pagamentos
  add column if not exists confirmado_por text;

comment on column public.pagamentos.confirmado_por is
  'Quem registrou a confirmação: ''super-admin'' (PIN de administrador) ou o '
  'uuid do atleta-organizador. NULL = confirmado antes de 16/10/2026, quando a '
  'autoria não era registrada. Campo de AUDITORIA: nenhum cálculo depende dele.';

notify pgrst, 'reload schema';

-- CONFERÊNCIA depois de aplicar:
--
--   select confirmado_por, count(*) from pagamentos group by 1;
--   -- esperado AGORA: tudo NULL (nenhum pagamento novo ainda).
--
--   select count(*) from information_schema.column_privileges
--    where table_schema='public' and table_name='pagamentos'
--      and column_name='confirmado_por' and grantee in ('anon','authenticated');
--   -- esperado: 0.
--
-- PARA REVERTER:
--   alter table public.pagamentos drop column if exists confirmado_por;
--   (seguro: nenhuma leitura anônima a alcança e nenhum cálculo depende dela)
