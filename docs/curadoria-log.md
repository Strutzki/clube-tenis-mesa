# Log de Curadoria

Registro do que o `curador-projeto` revisou, quando, e o que mudou em cada documento. Mais recente no topo. Antes de reescrever qualquer doc, consultar `claude/INDICE.md`.

## 2026-09-05 — Bootstrap da curadoria + convenção `claude/`
**Revisado:** estrutura do repositório (raiz, `src/`, `supabase/functions/`, `marca/`, `.claude/agents/`); versões de edge no ar; versões de regulamento e consentimento no `App.jsx`.

**Criado:**
- `claude/INDICE.md` — fonte canônica: hierarquia de fontes + inventário atual/superado. (Antes não existia; havia só `INDICE_PROJETO.md` na raiz.)
- `claude/curadoria-log.md` — este log.

**Alterado:**
- `INDICE_PROJETO.md` (raiz) → reduzido a **ponteiro** para `claude/INDICE.md` (evita dois índices competindo = drift).
- `.claude/agents/curador-projeto.md` → passou a apontar `claude/INDICE.md` (canônico) e `claude/curadoria-log.md`.

**Drift encontrado e sinalizado (não corrigido — precisa de decisão/OK):**
- Clutter no repositório: dezenas de `src/App.jsx HH.MM.SS`, `App.jsx 20.13.44` na raiz, `files.zip` órfão. Candidatos a remoção.
- RPC global `arquivar_partidas_temporada` virou código morto (substituído pelo escopado em admin-action v54) — dropar/restringir.
- Pendências jurídicas abertas (controlador, canal de direitos, política de privacidade, backfill de CPF) — registradas no índice.

**Verdade confirmada nesta data:** admin-action v54, athlete-action v17, login-atleta v5, circuito-dados v2; regulamento A=v03-12, B=vB-01; consentimento CPF=cpf-2026-08-v1; 8 duplas de agentes na governança.

## Antes de 2026-09-05 (curadoria retroativa, registrada agora)
- **Docs criados/atualizados nas sessões recentes** (detalhe no `CHANGELOG.md`): `GOVERNANCA_AGENTES.md` (vereditos da virada não-BH + check geral + registro dos guardiões novos), `ROADMAP_MULTICIRCUITO.md` (virada não-BH concluída + item Despachos do Dia), `CHANGELOG.md` (criado), `PLANO_VIRADA_NAOBH.md` (criado), `PLANO_DESPACHOS.md` (criado), 8 arquivos novos em `.claude/agents/` (Regulamento, Jurídico, Confiabilidade, Curador + supervisores).
- **Correção de drift já aplicada:** texto "Sistema B ainda não é operável" no formulário de novo circuito estava desatualizado → substituído (o motor B já funciona).
