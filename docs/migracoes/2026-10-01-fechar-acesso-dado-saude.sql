-- ═══════════════════════════════════════════════════════════════════════════════
-- FECHA O ACESSO ANÔNIMO AO DADO DE SAÚDE DO W.O.
--
-- ⚠️ ESTE É O ÚLTIMO PASSO DA PUBLICAÇÃO. NÃO RODE ANTES DO APP NOVO ESTAR NO AR.
--
-- Por quê: a `justificativa` de um W.O. é texto livre onde o atleta explica por que
-- não vai jogar — dado de SAÚDE (art. 5º, II da LGPD). A tabela tem SELECT para
-- `anon`, e até 01/10/2026 a leitura do app não nomeava coluna nenhuma: sem `select`
-- o PostgREST devolve tudo que a chave pode ler. O texto de cinco pessoas reais
-- ficou legível por qualquer visitante do site.
--
-- O texto já foi saneado do banco em 30/09 (5 linhas em `solicitacoes_wo` e 5 cópias
-- em `partidas.motivo_rejeicao`; o original está em `arquivo_wo_justificativas`, que
-- tem RLS ligada e nenhuma policy). Isto fecha a PORTA.
--
-- A ORDEM, e ela não é negociável:
--   1º  motor      — `admin-action` com a ação `LER_JUSTIFICATIVA_WO`
--   2º  app        — a leitura nomeia colunas e a tela usa a ação nova
--   3º  ESTE ARQUIVO
--
-- Rodar isto ANTES do passo 2 quebra produção na hora: o app que está no ar lê a
-- tabela sem nomear coluna, e o PostgREST recusa a leitura INTEIRA quando a chave
-- perde acesso a uma coluna pedida. É a armadilha que derrubou o app em 07/09.
--
-- COMO CONFERIR QUE O PASSO 2 JÁ ESTÁ NO AR, antes de rodar:
--   abrir o app, entrar como admin, ir em Pendências, e ver uma solicitação de W.O.
--   O texto da justificativa tem de aparecer depois de um instante de "Carregando a
--   justificativa…". Se aparecer o texto IMEDIATAMENTE, o app no ar ainda é o antigo
--   (o novo busca sob demanda) — PARE e publique o app primeiro.
-- ═══════════════════════════════════════════════════════════════════════════════

-- As duas colunas de dado sensível saem do alcance do visitante e do usuário logado.
-- O `service_role` (que as Edge Functions usam) NÃO é afetado: ele contorna grants.
revoke select (justificativa)    on solicitacoes_wo from anon, authenticated;
revoke select (comprovante_url)  on solicitacoes_wo from anon, authenticated;

-- CONFERÊNCIA — tem de devolver `false` nas duas primeiras e `true` nas duas últimas.
select
  has_column_privilege('anon','solicitacoes_wo','justificativa','SELECT')    as anon_le_justificativa,
  has_column_privilege('anon','solicitacoes_wo','comprovante_url','SELECT')  as anon_le_comprovante,
  has_column_privilege('anon','solicitacoes_wo','status','SELECT')           as anon_le_status,
  has_column_privilege('anon','solicitacoes_wo','atleta_nome','SELECT')      as anon_le_nome;

-- E a conferência de que o app continua funcionando: esta leitura é a MESMA que o
-- `getSolicitacoesWo` faz. Tem de devolver linhas, não erro de permissão.
select id, match_id, atleta_id, atleta_nome, adversario_id, adversario_nome,
       round, status, criado_em, respondido_em, motivo_recusa,
       notificado_solicitante, notificado_adversario
from solicitacoes_wo
limit 5;
