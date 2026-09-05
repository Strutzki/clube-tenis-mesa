# Despachos do Dia — mini-spec

**Objetivo:** uma tela única onde quem administra vê e resolve tudo que precisa de ação no dia, **agregado de todos os circuitos que a pessoa gerencia**, priorizado. Reduz o operacional e destrava tocar muitos circuitos. Estado: proposta (05/09/2026).

## Escopo por papel (decidido pelo Juliano)
- **Super-admin (PIN):** despachos de **todos** os circuitos.
- **Organizador (telefone+PIN):** despachos **só do(s) circuito(s) que organiza** — reusa o escopo já provado no admin-action v48 (allowlist + recurso do circuito).
- Cada item mostra **de qual circuito é**.

## O que a fila agrega (tudo já existe, hoje espalhado por aba/circuito)
- Inscrições a aprovar/reprovar
- Atletas do backlog para incluir
- Placares aguardando validação
- Rodadas com prazo fechado, prontas para processar
- Solicitações de W.O.
- Mensagens de WhatsApp pendentes (lembrete de prazo, cobrança)
- Resultados a divulgar
- Pagamentos a confirmar (Pix manual)

## Arquitetura
- **Endpoint agregador** novo (edge, ex. `despachos-do-dia`): autentica por PIN (super → todos os circuitos) OU orgTelefone+orgPin (organizador → só os dele), e devolve **numa resposta só** os itens pendentes agrupados por tipo + circuito, com contagens. Evita carregar circuito-por-circuito no front; escala.
- **Segurança:** o agregador nunca devolve item de circuito fora do escopo do chamador (mesma trava do v48). Só leitura; as ações continuam nas ações já existentes (INSCRICAO_VALIDAR, VALIDATE_RESULT, PROCESSAR_RODADA, etc.), agora disparadas da tela de despacho com o circuitoId certo.
- **BH footprint-zero:** endpoint novo + tela nova; não altera nada do fluxo atual.

## Fases sugeridas
1. **Fatia 1 — Ver tudo num lugar (read-only).** Endpoint agregador + tela "Despachos do dia" que lista as pendências por tipo/circuito, com contagens. Já entrega o "raio-x do dia". Botões levam para a tela detalhada existente.
2. **Fatia 2 — Agir na hora.** Ações inline no próprio despacho (aprovar, validar, processar, enviar mensagem) chamando as ações existentes com o circuitoId do item. Estado "tudo limpo".
3. **Fatia 3 — Lembrete no celular.**
   - *Interim rápido:* lembrete diário via WhatsApp para a própria pessoa ("hora do despacho" + link).
   - *Push nativo (obra à parte):* PWA + service worker + permissão de notificação + inscrição por aparelho + função agendada (VAPID). Funciona no Android/Chrome do Juliano; iOS tem restrições. Entra depois da tela pronta.

## Governança
- Toca **Experiência do Admin** (a tela/fluxo) e **Confiabilidade** (infra de push, agendamento). Curador atualiza índice/CHANGELOG ao entregar.
- Rito de sempre: análise de risco → revisão supervisionada → OK do Juliano → execução → verificação (BH byte-idêntico) → registro.

## Perguntas em aberto (resolver antes de codar a Fatia 1)
- Quais tipos entram já na v1 e quais ficam pra depois (ex.: financeiro pode ser fase 2)?
- Ordenação/prioridade da fila (por prazo? por circuito? por tipo?).
- A tela é uma aba nova no admin, ou vira a tela inicial do painel?
- Push: começar pelo lembrete via WhatsApp (rápido) ou já ir pro push nativo?
