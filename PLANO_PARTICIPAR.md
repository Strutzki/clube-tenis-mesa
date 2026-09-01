# "Participar" — atleta existente entra em 2º circuito (Bloqueador estrutural 1)

## Objetivo
Atleta já cadastrado (BH ou outro) entra num circuito novo **sem criar atleta/rating novo**: reusa a identidade nacional (`atletas`), cria só o vínculo (`circuito_atletas`). É o que faz o multi-circuito funcionar de verdade — e o ponto de **backfill do CPF** (decisão Juliano: recolher o CPF do atual só nesse momento).

## Fluxo
Ao querer entrar num circuito com inscrições abertas:
1. **Identifica-se** (telefone e/ou CPF).
2. Se **já existe** cadastro → **prova de identidade por PIN** (não-negociável; ninguém adiciona outro atleta a um circuito).
3. Após PIN correto → se o atleta ainda **não tem CPF**, recolhe CPF + consentimento (backfill) e anexa `atleta_documento` ao atleta **existente**.
4. Cria `circuito_atletas` (status pendente, saldo 0, `pendente_circuito=true`) no circuito escolhido. O **admin daquele circuito aprova**.
5. Rating: **A** = rating nacional do atleta (compartilhado, não zera); **B** = pontos começam em 0 no circuito.

## GATILHO — decisão do Juliano
- (a) **Pelo "Inscreva-se":** ao informar telefone/CPF, o sistema detecta "você já tem cadastro" e oferece **Participar** em vez de criar um novo.
- (b) **Botão "Participar de outro circuito"** na área do atleta logado (já autenticado).
- (c) **Ambos.**

## Segurança (Guardião — condições, GO-com-condições esperado)
- **PIN obrigatório** antes de criar qualquer vínculo (reusa `login-atleta`). Sem PIN, nada de membership. Resolve o "identidade só após PIN" da spec de CPF.
- **Não confiar em `atletaId` do cliente:** o servidor resolve o atleta a partir do telefone/CPF **autenticado**.
- Bloquear entrar num circuito onde **já é membro** (idempotência + erro claro).
- Circuito tem que **existir + ativo + inscrições abertas** (revalida no servidor, como o `INSCREVER`).
- **Cross-tenant:** cria só o `circuito_atletas` do circuito alvo; nunca toca no rating global nem em outros circuitos (`writeAtleta` já blinda B contra rating).
- **CPF:** mesma blindagem (hash no edge, dedup, consentimento). Se o CPF informado casar com **outro** atleta → conflito → **revisão manual**, nunca auto-mesclar.
- Rate-limit no PIN (o `login-atleta` já tem trava de tentativas — reusar).

## Advogado do Atleta (condições)
- Deixar claro na UI que "Participar" **reusa o cadastro nacional** (mesma pessoa, vários circuitos) — não é um cadastro novo.
- Consentimento de CPF no backfill = **o mesmo texto específico** da inscrição (versão `cpf-2026-08-v1`).
- Estado "inscrição enviada / em análise" visível; não fica reoferecendo "Participar" pra quem já pediu.

## Fatias (footprint-zero pro BH; cada uma verificada)
1. **Backend — ação `PARTICIPAR`** — ✅ **FEITA (login-atleta v2, provada AO VIVO).** telefone+PIN (reusa a trava de tentativas) → resolve atleta existente → valida circuito aberto/não-BH/não-duplicado → cria `circuito_atletas` (status ativo, pendente_circuito true, saldo 0) SEM tocar no rating nacional + backfill de CPF se faltar (dedup; `cpf_conflito` se o CPF for de outro cadastro). Teste isolado (circuito+atleta descartáveis): happy path gravou o vínculo + anexou o CPF ao atleta EXISTENTE (hash == referência), rating intacto (250), **zero atleta duplicado**; recusas OK (`ja_participa` 409, `pin_incorreto` 401, `circuito_nao_encontrado` 404). Tudo apagado; BH byte-idêntico (`3f4f9540…`), 0 resíduo. Gatilho decidido: **ambos** (Inscreva-se detecta + botão na área logada).
2. **Front — gatilhos A+B + tela de Participar** — ✅ **CODADA (aguarda `atualizar.sh` + smoke).** `ParticiparFlow` (2 fases: telefone+PIN → se o servidor pedir, coleta CPF/consentimento e reenvia → tela de sucesso). **Gatilho A:** no `InscricaoForm`, quando o telefone já tem cadastro E o circuito não é o BH, aparece o link "participe deste circuito reusando seu cadastro". **Gatilho B:** card `ParticiparOutroCircuito` na aba "meus jogos" lista os circuitos abertos não-BH e abre o `ParticiparFlow`. Ambos ficam **dormentes até existir um circuito não-BH aberto** (correto). Balanço de delimitadores vs HEAD = 0.
3. **Verificação** — dados-level + ao vivo; BH byte-idêntico; membership criado só no circuito alvo.

## Dependências / notas
- Reusa `login-atleta` (verificação de PIN) e a fundação de CPF (Fatias 1-5, já no ar).
- O admin do circuito alvo precisa conseguir aprovar/gerir membros não-BH — já coberto pelo A2 (seletor de circuito) e pelas ações escopadas por `circuitoId`.
- Não cobre ainda: co-organizadores, papéis (Bloqueador 2) — segue no backlog.
