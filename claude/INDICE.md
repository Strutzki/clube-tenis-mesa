# INDICE — fonte canônica do projeto Clube do Tênis de Mesa

**Leia este arquivo ANTES de reescrever qualquer documento.** Ele traz (1) a hierarquia de fontes de verdade e (2) o inventário do que está atual vs. superado. Mantido pelo agente `curador-projeto`; toda revisão é registrada em `claude/curadoria-log.md`. Estado: 05/09/2026.

## 1. Hierarquia de fontes de verdade
Quando dois documentos divergem, vale a fonte mais alta:
1. **Realidade em produção** — o que o app faz e o que está no banco/edge (Supabase `eultwfzzlgcmcikobmmy`). Fonte final.
2. **Código** — `src/App.jsx` (front) e `supabase/functions/*` (backend). É o que roda.
3. **Docs de referência viva** — regulamentos, manual da marca, ESPEC_CPF. Definem regra/conteúdo.
4. **Governança e planos** — `GOVERNANCA_AGENTES.md`, `ROADMAP_MULTICIRCUITO.md`, `PLANO_*.md`. Registram decisão e histórico.

Regra permanente: **BH em produção nunca é prejudicado** (comparador byte-idêntico); nada vai a produção sem revisão supervisionada + OK do Juliano.

## 2. Mapa rápido (qual arquivo manda em quê)
- **Front:** `src/App.jsx` (SPA único, Vite/rolldown). Deploy: `atualizar.sh` → Vercel. Cache: `vercel.json`.
- **Backend:** `supabase/functions/` (Deno). Versões no ar (conferir com list_edge_functions): admin-action **v54**, athlete-action **v17**, login-atleta **v5**, circuito-dados **v2**; + comprovante-url, anonimizar-atleta, resetar-pin-atleta, backup.
- **Banco (Modelo B):** identidade+rating global em `atletas`; sazonal por circuito em `circuito_atletas`; config em `circuitos` (BH em `configuracao`); histórico em `partidas_historico`; CPF em `atleta_documento`; papéis em `circuito_organizadores`; sessão em `atleta_sessao`.
- **Regulamento A (rating/CBTM):** versão **v03-12**. **Regulamento B (pontos):** versão **vB-01**. Texto no `App.jsx` (RegulamentoView) + docs `REGULAMENTO_*`.
- **Marca:** `marca/Manual_Aplicacao_Marca_Clube_Tenis_Mesa_v2.pdf` (única). Slogan "Vem pro Clube"; 4 cores; sem "BH" na marca nacional; "cortada"=smash.
- **LGPD/CPF:** `ESPEC_CPF_SEGURANCA.md`; consentimento `cpf-2026-08-v1`; controlador Juliano Strutzki (PF).

## 3. Inventário — o que está ATUAL vs SUPERADO
### Ativo / referência viva (consultar e manter)
- `claude/INDICE.md` (este), `claude/curadoria-log.md`, `CHANGELOG.md`
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
