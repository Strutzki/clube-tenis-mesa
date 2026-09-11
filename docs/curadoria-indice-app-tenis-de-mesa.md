# INDICE — fonte canônica do projeto Clube do Tênis de Mesa

**Leia este arquivo ANTES de reescrever qualquer documento.** Ele traz (1) a hierarquia de fontes de verdade e (2) o inventário do que está atual vs. superado. Mantido pelo agente `curador-projeto`; toda revisão é registrada em `docs/curadoria-log.md`. Estado: 10/09/2026.

## 1. Hierarquia de fontes de verdade
Quando dois documentos divergem, vale a fonte mais alta:
1. **Realidade em produção** — o que o app faz e o que está no banco/edge (Supabase `eultwfzzlgcmcikobmmy`). Fonte final.
2. **Código** — `src/App.jsx` (front) e `supabase/functions/*` (backend). É o que roda.
3. **Docs de referência viva** — regulamentos, manual da marca, ESPEC_CPF. Definem regra/conteúdo.
4. **Governança e planos** — `GOVERNANCA_AGENTES.md`, `ROADMAP_MULTICIRCUITO.md`, `PLANO_*.md`. Registram decisão e histórico.

Regra permanente: **BH em produção nunca é prejudicado** (comparador byte-idêntico); nada vai a produção sem revisão supervisionada + OK do Juliano.

## 2. Mapa rápido (qual arquivo manda em quê)
- **Front:** `src/App.jsx` (SPA único, Vite/rolldown). Deploy: `atualizar.sh` → Vercel. Cache: `vercel.json`.
- **Backend:** `supabase/functions/` (Deno). Versões no ar (conferido com `npm run motor:listar` em 10/09/2026): admin-action **v58**, athlete-action **v19**, login-atleta **v8**, circuito-dados **v4**, despachos-do-dia **v6**; + comprovante-url, anonimizar-atleta, resetar-pin-atleta, backup. (Corrigido: estava anotado v54/v17/v5/v2 — desatualizado.)
- **Banco (Modelo B):** identidade+rating global em `atletas`; sazonal por circuito em `circuito_atletas`; config em `circuitos` (BH em `configuracao`); histórico em `partidas_historico`; CPF em `atleta_documento`; papéis em `circuito_organizadores`; sessão em `atleta_sessao`.
- **Regulamento A (rating/CBTM):** BH = versão **v03-12** (com Cap. 10, Torneio Presencial). Circuito de rating **novo** = versão **`vA-nc-01`** — mesmo texto de v03-12 **menos o Cap. 10**; é a ÚNICA diferença definida (`docs/REGULAMENTOS_NOVOS_CIRCUITOS.md`). **Regulamento B (pontos):** versão **vB-01**, sem torneio. A escolha é por `circuitos.regulamento_versao`; no `App.jsx`, `RegulamentoView` lê esse valor e `VERSOES_COM_TORNEIO = new Set(["v03-12"])` decide se o Cap. 10 aparece (fail-closed: versão desconhecida não ganha o capítulo). Texto no `App.jsx` (RegulamentoView) + docs `REGULAMENTO_*` / `REGULAMENTOS_NOVOS_CIRCUITOS.md`.
- **Marca:** `marca/Manual_Aplicacao_Marca_Clube_Tenis_Mesa_v2.pdf` (única). Slogan "Vem pro Clube"; 4 cores; sem "BH" na marca nacional; "cortada"=smash.
- **LGPD/CPF:** `ESPEC_CPF_SEGURANCA.md`; consentimento `cpf-2026-08-v1`; controlador Juliano Strutzki (PF).

## 3. Inventário — o que está ATUAL vs SUPERADO
### Ativo / referência viva (consultar e manter)
- `docs/curadoria-indice-app-tenis-de-mesa.md` (este), `docs/curadoria-log.md`, `CHANGELOG.md`
- `GOVERNANCA_AGENTES.md` + `.claude/agents/*.md` (8 duplas de agentes)
- `ROADMAP_MULTICIRCUITO.md`, `PLATAFORMA_BACKLOG.md`
- `REGULAMENTO_SISTEMA_B.md`, `REGULAMENTOS_NOVOS_CIRCUITOS.md`, `ESPEC_CPF_SEGURANCA.md`, `SEGURANCA_RPC_AUDIT.md`
- `PLANO_DESPACHOS.md` (proposta ativa), `PLANO_INSCRICAO_POR_CIRCUITO.md` (parcial: falta Região/vagas)
- `ROTEIRO_TESTE_SISTEMA_B.md`

### Histórico (fase concluída — manter como registro, não como plano ativo)
- `PLANO_FASE4B_DUALWRITE.md`, `PLANO_FASE4C.md`, `PLANO_FASE_A.md`, `PLANO_FASE_A2.md`
- `PLANO_MOTOR_B.md`, `PLANO_PAPEIS.md`, `PLANO_PARTICIPAR.md`, `PLANO_VIRADA_NAOBH.md`
- `REVISAO_RISCO_MIGRACAO_MULTICIRCUITO.md`, `REGISTRO_VALIDACAO_2026-08.md`
- SQLs de migração já aplicados: `fase4c_reabrir_leitura.sql`, `faseA1_pareamento.sql`

### Clutter / a limpar (NÃO são fonte de verdade)
- Backups datados do front: `src/App.jsx HH.MM.SS` (dezenas) e `App.jsx 20.13.44` na raiz — ruído; candidatos a remoção.
- `files.zip` na raiz — órfão.
- `INDICE_PROJETO.md` na raiz — **superado por este arquivo**; virou ponteiro.

### Drift / follow-ups anotados (verdade atual que ainda não virou doc/código)
- RPC global `arquivar_partidas_temporada` virou código morto (substituído pelo escopado) — dropar/restringir.
- Jurídico: confirmar nome legal do controlador + canal de direitos; política de privacidade formal; decidir backfill de CPF dos atuais.
- `atleta_documento` com 0 registros (nenhum CPF coletado em produção ainda).
- **`vA-nc-01` ainda promete o torneio em 4 capítulos, mesmo sem o Cap. 10 (achado
  10/09/2026, auditoria da curadoria).** `RegulamentoView` filtra só o capítulo
  próprio do torneio (Cap. 10); mas os Caps. 09 ("Fim de Temporada... convocados
  para o torneio presencial"), 11 ("taxa individual do torneio presencial" +
  "elegível ao torneio... top 8"), 12 ("Elegibilidade para o torneio presencial")
  e 13 ("Torneio presencial: mês imediatamente seguinte...") reusam o texto do
  BH palavra por palavra — que menciona o torneio fora do Cap. 10 também. Um
  atleta de um circuito de rating novo (`vA-nc-01`, sem torneio por definição)
  leria essas menções e aceitaria uma regra que o circuito dele não tem.
  Precisa de decisão de conteúdo (reescrever os 4 capítulos por versão, não só
  filtrar o Cap. 10) antes de vender um 2º circuito Sistema A — **bloqueia o
  mesmo caso que o ROADMAP 0.8.5 descreve**, e não foi fechado por esta rodada.
- **`max_atletas` (`circuitos`) é configurável por circuito, mas o Cap. 11 do
  regulamento crava "20"** ("Cada circuito tem um teto de 20 atletas por
  temporada") — mesmo texto reusado por `vA-nc-01`. Fica errado no dia em que
  um circuito nascer com teto diferente de 20. Mesma família do TODO já
  registrado no código para "masculino adulto 18+" (ROADMAP 0.8.3).
