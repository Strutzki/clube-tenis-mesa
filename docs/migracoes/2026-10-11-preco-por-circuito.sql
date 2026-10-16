-- O PREÇO QUE O ATLETA VÊ PASSA A SER O DO CIRCUITO DELE
-- 11/10/2026 — piloto do CIRCUITO BH 2, com atletas reais se inscrevendo.
--
-- O DEFEITO, medido em produção e não deduzido:
--
--   select preco_temporada_atleta(atleta_id) para os 3 atletas do bh2 devolvia
--   {"isento":false,"valor_base_cent":10000,"preco_final_cent":0}
--   enquanto circuitos.valor_temporada do bh2 é 5000.
--
--   O app mostrava ao atleta "Sua temporada: R$ 100,00 (riscado) R$ 0,00 (100% off)"
--   com a chave PIX logo abaixo, e o painel do organizador mostrava R$ 50,00.
--   A MESMA tela de pagamento, dois números diferentes — porque o organizador lê
--   `circuitos` e o atleta lia `configuracao`.
--
-- A CAUSA: a função tinha uma assinatura só, `p_id uuid`, sem circuito. Ela lia
-- `from configuracao where id = 1` — a configuração LEGADA DO BH, com o
-- `desconto_global_pct = 100` que sobrou da temporada 1/2026, que foi de teste e
-- gratuita. Todo atleta de todo circuito recebia o preço do BH.
-- E lia o desconto individual de `atletas` (global), não de `circuito_atletas`:
-- desconto dado num circuito valia em todos.
--
-- CONSEQUÊNCIA REAL: 2 dos 3 atletas do bh2 não pagaram. Não ignoraram o pedido —
-- o app disse que não havia o que pagar.
--
-- A REGRA, nas palavras do Juliano em 11/10/2026:
--   "o atleta precisa ver o valor que o admin configurou para aquele circuito que
--    ele está se inscrevendo"
--
-- POR QUE LÊ `circuitos` E NÃO `configuracao`, inclusive para o BH:
-- é a casa que o painel do organizador lê, então as duas telas passam a não poder
-- divergir — que é o defeito que esta migração conserta. O BH grava nos dois
-- lugares (escrita dupla, espelho best-effort), e hoje os dois concordam:
-- `configuracao id=1` e `circuitos slug=bh` têm 10000/100. Conferido antes de
-- escrever isto. O BH, além disso, encerrou (ver topo do CLAUDE.md).
--
-- POR QUE A FUNÇÃO ANTIGA CONTINUA DE PÉ:
-- o `login-atleta` que está no ar (v11) chama a de 1 argumento. Apagá-la aqui
-- derrubaria o preço para todo mundo até a v12 subir. As duas convivem por uma
-- etapa — é a regra do CLAUDE.md para quando nenhum dos dois lados tolera o
-- outro. Não dei DEFAULT ao parâmetro novo de propósito: um segundo argumento
-- opcional tornaria AMBÍGUA a chamada de um argumento só.
-- A de 1 argumento sai numa migração seguinte, depois de a v12 estar no ar e
-- confirmada por `npm run motor:listar`.
--
-- SEM RISCO DA ARMADILHA Nº 1 do CLAUDE.md: não cria coluna em tabela nenhuma,
-- então não há `SELECT *` de visitante para quebrar.

create or replace function public.preco_temporada_atleta(p_id uuid, p_circuito uuid)
returns json
language sql
security definer
set search_path to 'public'
as $function$
  select json_build_object(
    'isento', coalesce(v.isento, false),
    'valor_base_cent', c.valor_temporada,
    'preco_final_cent', case
        -- Sem valor configurado não se inventa preço: devolve null e a tela
        -- fica calada, em vez de afirmar "R$ 0,00", que é uma promessa.
        when c.valor_temporada is null then null
        when coalesce(v.isento, false) then 0
        -- O desconto individual vem de `circuito_atletas` (é sazonal, por
        -- circuito), e só na ausência dele vale o desconto global DO CIRCUITO.
        else round(c.valor_temporada * (1 - coalesce(v.desconto_pct, c.desconto_global_pct, 0)::numeric / 100))
      end
  )
  from circuito_atletas v
  join circuitos c on c.id = v.circuito_id
  where v.atleta_id = p_id
    and v.circuito_id = p_circuito;
$function$;

-- MESMAS permissões da função antiga, conferidas em `pg_proc.proacl` antes:
-- {postgres=X/postgres,service_role=X/postgres} — nem `anon` nem `authenticated`.
-- O comentário do `login-atleta` registra por quê: os ids dos atletas são
-- públicos no ranking, então uma função de preço chamável por anônimo deixaria
-- qualquer um ler o preço e a isenção de qualquer atleta. Só a Edge Function
-- (service_role) chama.
revoke all on function public.preco_temporada_atleta(uuid, uuid) from public;
revoke all on function public.preco_temporada_atleta(uuid, uuid) from anon;
revoke all on function public.preco_temporada_atleta(uuid, uuid) from authenticated;
grant execute on function public.preco_temporada_atleta(uuid, uuid) to service_role;

-- CONFERÊNCIA depois de aplicar (o número tem de bater com o do painel):
--
--   select ca.circuito_id,
--          preco_temporada_atleta(ca.atleta_id, ca.circuito_id) as atleta_ve,
--          (select valor_temporada from circuitos where id = ca.circuito_id) as admin_ve
--   from circuito_atletas ca
--   where ca.circuito_id = (select id from circuitos where slug = 'bh2');
--
-- Esperado: preco_final_cent = 5000 nos três, admin_ve = 5000.
-- E a de 1 argumento continua devolvendo 0 — é o que prova que a v11 no ar
-- segue sendo a razão do número errado, até a v12 subir.
