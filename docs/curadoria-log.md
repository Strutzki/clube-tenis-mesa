## 2026-09-07 — PONTO DE RETOMADA (parada do dia)
**Pendente de publicar (rodar `atualizar.sh`):** rótulos do modo organizador (front) + docs. O `atualizar.sh` agora testa o build antes de publicar (rede de segurança).
**Edge `admin-action` — fonte à frente do que está no ar:** tem a revisão de acesso do organizador (removidos EXCLUIR_ATLETA, ABRIR/CANCELAR próxima, DEFINIR_RODADAS da allowlist) + as ações de cobrança da plataforma (LER/DEFINIR_COBRANCA_PLATAFORMA). **Não deployado de propósito** — deploya junto com o 1º circuito vendido (inerte hoje, sem organizador em produção). Live segue na versão anterior.
**Já no ar e verificado hoje:** vazamento de preço fechado (login-atleta v6 + revoke anon), despachos v3/v4 (só ações do dia), cobranças/config inertes, remoção do circuito demo (BH byte-idêntico).

### Retomar por aqui (fatias mapeadas, footprint-zero, revisão dos Guardiões)
1. **Financeiro por circuito** — flag `org_ve_financeiro` (padrão OFF) + toggle do super-admin; torna condicionais os itens financeiros do organizador (config financeira, pagamentos) e esconde a aba "Pagam." quando OFF. Ref: `ORGANIZADOR_ACESSO_COMPARATIVO.md`.
2. **Desfazer processamento (C)** — desfazer o cálculo de uma rodada até a virada, recalculando; com harness provando reprodução exata do rating e BH byte-idêntico. Ref: mesmo doc.
3. **Pagamentos (Asaas) — backlog** — aguardando conta Sandbox + chave + revisão jurídica das minutas. Ref: `PLATAFORMA_BACKLOG.md`, `PLANO_PAGAMENTOS_FATIA5_INTEGRACAO.md`.

# curadoria-log — registro do Curador do Projeto

## 2026-09-06 — Consolidação da documentação (dedup raiz × docs/)
- **Problema:** ~20 `.md` estavam duplicados na raiz do repo E em `docs/` (a base canônica sincronizada com o projeto do Claude via GitHub). Risco de editar a cópia errada e divergir (aconteceu: `PLANO_INSCRICAO` mais novo na raiz; `CHANGELOG`/`GOVERNANCA`/`ROADMAP` mais novos em `docs/`).
- **Ação:** antes de remover, comparei cada par. Sincronizei o único que estava mais novo na raiz (`PLANO_INSCRICAO_POR_CIRCUITO.md` → `docs/`). Removi as 22 duplicatas da raiz (19 idênticas + CHANGELOG/GOVERNANCA/ROADMAP obsoletas na raiz) e o stub superado `INDICE_PROJETO.md`. Mantido só `README.md` na raiz (é o README do código Vite, não é doc de projeto).
- **Resultado:** raiz do repo sem docs de projeto soltos; `docs/` segue com os 42 `.md` canônicos + `docs/backups/`. Fonte única de verdade documental = `docs/` (→ projeto do Claude). Nada perdido.
- **Follow-up opcional:** algumas referências internas ainda citam caminhos antigos (`claude/INDICE.md`, `claude/curadoria-log.md`); alinhar aos nomes reais em `docs/` numa próxima passada. `LEIA-ME.md` diz "40 documentos" (hoje 42) — atualizar quando conveniente.

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
