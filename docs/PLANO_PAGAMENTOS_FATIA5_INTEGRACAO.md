# Fatia 5 — Integração de pagamento (Asaas) · design (MINUTA TÉCNICA)

> Estado: 07/09/2026. **Nada implementado.** É o desenho da integração real de cobrança. É a única fatia onde **dinheiro se move** — só vai a produção depois dos pré-requisitos abaixo, com **Guardião de Segurança** obrigatório em cada passo.

## 0. Pré-requisitos pra LIGAR (bloqueiam o go-live)
- [ ] **Revisão jurídica** das minutas (`TERMOS_ORGANIZADOR.md`, `POLITICA_PRIVACIDADE.md`).
- [ ] **Conta Asaas** — ação do Juliano: criar conta, ativar **sandbox** e produção, concluir KYC. (Não posso criar conta.)
- [ ] **Chaves de API** do Asaas guardadas no **Supabase Vault** (nunca no código/front).
- [ ] Para o Caso 2 (circuito vendido): cada **organizador** com conta/carteira Asaas (wallet id) pro split.
- [ ] Valores preenchidos no admin (Fatia 3, já pronta) no(s) circuito(s) que forem cobrar.

## 1. Objetivo
Automatizar a cobrança que hoje é Pix manual:
- **Caso 1 (circuito próprio, ex.: BH):** o atleta paga a inscrição da temporada; o valor vai pro Juliano; sem split.
- **Caso 2 (circuito vendido):** o atleta paga; **split** separa a fatia por-atleta da plataforma e o resto vai pro organizador; a **taxa fixa** do organizador é uma cobrança separada dele pra plataforma.
- Meio principal: **Pix Automático** (recorrente por temporada); Pix avulso/cartão como evolução.

## 2. Modelo de dados (novo, inerte até ligar)
Tabela **`cobrancas`** (ledger ligado ao gateway):
- `id` (uuid), `circuito_id`, `atleta_id` (nullable — a taxa fixa do organizador não tem atleta), `tipo` (`inscricao_atleta` | `taxa_fixa_organizador`), `valor_cent`, `moeda='BRL'`.
- `status` (`pendente` | `pago` | `estornado` | `falhou` | `cancelado`), `metodo` (`pix_automatico` | `pix` | `cartao`).
- `asaas_id` (id da cobrança no gateway, **UNIQUE** — idempotência), `asaas_customer_id`, `asaas_subscription_id` (recorrência), `split_json` (config do rateio aplicada).
- `temporada_rotulo`, `criado_em`, `pago_em`, `atualizado_em`.
- **RLS:** deny-all ao anon; só service role (edge) escreve/lê. Nada de dado de cobrança no broadcast público.

Colunas de vínculo com o gateway:
- `atletas.asaas_customer_id` (opcional; ou guardado em `cobrancas`).
- `circuito_organizadores.asaas_wallet_id` (carteira do organizador pro split) — ou em `circuitos`.

> **Nunca** guardamos dados de cartão. O gateway tokeniza; a gente guarda só ids e status.

## 3. Edge functions
1. **`criar-cobranca`** (autenticada por PIN/organizador ou disparada no INSCREVER):
   - Cria/recupera o customer no Asaas, cria a cobrança (Pix Automático por padrão), com **split** quando `circuitos.cobranca_plataforma_ativa` (usa o cálculo da Fatia 2 pra fatia por-atleta + wallet do organizador).
   - Grava em `cobrancas` (status `pendente`, `asaas_id`).
   - Devolve o link/QR ou a autorização de Pix Automático pro atleta.
2. **`webhook-asaas`** (público, mas **verifica assinatura/token do Asaas**):
   - Recebe eventos (`PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_REFUNDED`, etc.).
   - **Idempotente** (usa `asaas_id`); atualiza `cobrancas.status` + `pago_em`.
   - Ao confirmar `inscricao_atleta`: seta `pagamento_confirmado=true` no atleta/circuito (o motor já libera o pareamento — regra existente).
   - Nunca confia no cliente; só o webhook assinado muda status pra `pago`.

## 4. Fluxos
**Atleta paga a inscrição:** inscreve → `criar-cobranca` → atleta paga (Pix) → `webhook-asaas` confirma → `pagamento_confirmado=true` → segue o fluxo normal (aprovação/backlog/inclusão). Enquanto `pendente`, não é pareado (trava já existente).

**Taxa fixa do organizador:** no início da temporada, `criar-cobranca` (`tipo=taxa_fixa_organizador`) cobra o organizador; webhook confirma.

**Recorrência (temporada seguinte):** Pix Automático renova; um evento de nova cobrança gera novo registro em `cobrancas`.

## 5. Segurança (Guardião obrigatório)
- Chaves só no Vault; edge com service role; **webhook com verificação de assinatura**; idempotência por `asaas_id` UNIQUE.
- RLS deny-all em `cobrancas`; nada financeiro ao anon.
- Rate-limit no `criar-cobranca`; logs sem dados sensíveis.
- Estorno/cancelamento só via ação auditada.

## 6. Plano de teste (sandbox, sem dinheiro real)
- Asaas **sandbox**: criar cobrança de teste, simular pagamento, conferir o `webhook-asaas` (status → `pago`, idempotência com evento repetido).
- Split de teste (Caso 2 fictício): conferir que a fatia da plataforma e a do organizador batem com o cálculo da Fatia 2.
- **BH intocado:** BH tem `cobranca_plataforma_ativa=false` → sem split, cobrança direta pro Juliano; provar que o caminho do BH não muda e o dado de competição fica byte-idêntico.

## 7. Fatias de implementação (footprint-zero, revisão dos Guardiões)
1. **5a — modelo de dados `cobrancas` (inerte) — ✅ FEITA.** Tabela `cobrancas` (ledger com ids do gateway, RLS deny-all, anon sem acesso, 0 registros) + `circuito_organizadores.asaas_wallet_id`. Nada chama gateway; nenhum dado existente tocado.
2. **5b — `criar-cobranca` (sandbox)** + registro em `cobrancas`.
3. **5c — `webhook-asaas` (assinado, idempotente)** + liberação do atleta.
4. **5d — split (Caso 2)** usando a Fatia 2 + wallet do organizador.
5. **5e — recorrência (Pix Automático)** + inadimplência/estorno.
6. **5f — go-live** (produção) só depois de sandbox provado + jurídico fechado + seu OK.

> Posso começar a **5a (modelo de dados inerte)** a qualquer momento — não depende da conta Asaas. As demais precisam do sandbox.
