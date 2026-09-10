# Log de Curadoria

Registro do que o `curador-projeto` revisou, quando, e o que mudou em cada documento. Mais recente no topo. Antes de reescrever qualquer doc, consultar `claude/INDICE.md`.

## 2026-09-08 — Auditoria do nome ("Clube do Tênis de Mesa", sem BH) + "Circuito BH"

**⚠️ Achado prévio, antes do resto:** este arquivo e `claude/INDICE.md` estavam
**congelados desde 2026-09-05** — idênticos, byte a byte, aos gêmeos em
`docs/curadoria-indice-app-tenis-de-mesa.md` / `docs/curadoria-log.md`. Só que
o log de `docs/` **continuou sendo escrito** até 07/09 (inclusive um registro
de 06/09 dizendo que a consolidação passou a fonte única para `docs/`, com um
follow-up "alinhar referências a `claude/`" que nunca foi feito). Resultado:
dois pares de índice/log, um dos quais (o daqui, `claude/`) desatualizado há 3
dias de trabalho (admin-action v54→v58, permissões do organizador, registro de
mensagens…), embora `.claude/agents/curador-projeto.md` (a minha própria
instrução) ainda aponte para cá como canônico. **Não resolvi sozinho** qual
dos dois vira o único — precisa de decisão do Juliano. Registrando aqui para
não se perder de novo.

**Revisado:** a decisão de nome de 08/09/2026 (app = "Clube do Tênis de Mesa",
sem BH; circuito = "Circuito BH", sem número) contra o diff já feito em
`index.html`, `public/manifest.json`, `src/App.jsx`; contra o manual da marca;
contra `REGULAMENTOS_NOVOS_CIRCUITOS.md` / `REGULAMENTO_SISTEMA_B.md` (qual
regulamento é do BH e qual é genérico); contra o banco de produção (leitura:
`circuitos`, `configuracao`) e a bateria (154 asserções rodadas de novo, 0
falhas; build OK, confirmado nesta sessão, não só relatado).

**Achado principal (conteúdo, não rotina — fica para o Juliano decidir):** o
regulamento **v03-12 é o do BH especificamente** (com o torneio presencial,
"intacto" — `REGULAMENTO_SISTEMA_B.md` linha 12 e 68), não um "Sistema A
genérico". Novos circuitos Sistema A usam `vA-nc-01`, **sem** torneio. O rodapé
do app foi trocado de "Clube do Tênis de Mesa · Circuito BH · Regulamento
v03-12" para "Clube do Tênis de Mesa · Regulamento v03-12" — hoje inofensivo
(só existe o BH), mas o texto de `RegulamentoView` no `App.jsx` (torneio, Cap.
10) só está pronto para o BH; não há ramificação por circuito ainda
(`circuitos.regulamento_versao` existe na tabela mas o componente só lê
`sistema`). Ver relato completo na conversa; não decidido aqui.

**Corrigido (rotina, baixo risco — já aplicado):**
- `v03-11` → `v03-12` (regulamento vigente estava desatualizado em 4 arquivos:
  `.claude/agents/experiencia-atleta.md`, `.claude/agents/supervisor-atleta.md`
  e os gêmeos em `docs/agente-*.md`). Confirmado contra o banco
  (`circuitos.regulamento_versao = 'v03-12'` para o BH).
- `docs/ROADMAP.md`, Onda 4: separei "nome" (resolvido em 08/09, pendente só de
  publicar) de "domínio" (`clubedotenisdemesabh.com.br`, ainda com "bh" —
  decisão de negócio, segue pendente para a Onda 4, confirmado adequado assim).

**Pendente de decisão do Juliano (não é rotina):**
- Se o rodapé/aceite do regulamento devem voltar a nomear "Circuito BH" (dado
  que v03-12 é texto do BH, não do Sistema A em geral) — ou se a correção
  certa é a app-level branch por `regulamento_versao` antes de valer a pena
  generalizar o texto.
- A UPDATE em `circuitos.nome_exibicao`/`nome_circuito` e `configuracao.nome_circuito`
  para "Circuito BH" — redigida pela sessão, não aplicada (é o que troca de
  fato a tela de inscrição). Fora do meu mandato aplicar.
- `claude/` vs `docs/` como registro único (achado acima).

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
