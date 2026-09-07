# Estratégia de Monetização & Pagamentos — Clube do Tênis de Mesa

Documento de **decisão** (não de implementação). Estado: 06/09/2026. Serve pra você decidir com calma o modelo antes de escrever qualquer código. Nada aqui está implementado.

> Regra que não muda: dado financeiro é sensível — **nunca guardamos cartão** (tokeniza no gateway); tudo passa pelo Guardião de Segurança + Jurídico antes de ir a produção; o BH em produção nunca é prejudicado.

---

## 1. Onde estamos hoje (o que já existe)

O app já tem um **financeiro por temporada**, manual:

- `valor_temporada` por circuito; **80%** pra quem entra na 2ª etapa (Rodada 3); descontos (global, individual, isento); chave Pix do clube.
- O atleta paga por fora (Pix), e **o admin confirma na mão** (`CONFIRMAR_PAGAMENTO` / `ESTORNAR`). Enquanto não confirmado, o atleta **não é pareado**.
- Tabela `pagamentos`, flags `pagamento_confirmado` / `pagamento_proxima_confirmado`, pré-abertura da próxima temporada com valores próprios.
- O regulamento diz, hoje, **"valor único por temporada, sem mensalidade"** (isso vale pro atleta).

Ou seja: a cobrança do atleta **já existe** — só é manual. O que falta é (a) automatizar essa cobrança e/ou (b) criar um modelo de receita pra você (a plataforma).

---

## 2. Os dois eixos de receita (a decisão-mãe)

São coisas diferentes. Dá pra fazer um, o outro, ou os dois — mas o build e o preço mudam.

### Eixo A — Atleta paga o circuito (automatizar o que já existe)
- **Quem paga:** o atleta, pra jogar uma temporada.
- **O que muda:** troca a confirmação manual de Pix por **cobrança automática** (Pix/link). O dinheiro cai na conta do **organizador daquele circuito** (no BH, você).
- **Modelo:** mantém "por temporada" (casa com o regulamento atual). Pode virar recorrente por temporada.
- **Ganho:** menos trabalho manual, menos inadimplência, confirmação na hora.
- **Sua receita:** zero direto — a menos que você fique com uma **taxa da plataforma** (split) sobre cada cobrança (ver Eixo B).

### Eixo B — Organizador assina a plataforma (vender o produto / SaaS)
- **Quem paga:** o organizador de cada clube/circuito paga **você** pra usar o app.
- **Modelos possíveis:**
  - **Assinatura recorrente** (mensal/anual) por circuito — ex.: básico / premium / plano clube.
  - **OU comissão por atleta** (você fica com X% ou R$Y de cada inscrição paga — via *split*), sem mensalidade fixa. Costuma ser mais fácil de vender no começo ("só pago quando ganho").
  - **OU híbrido** (mensalidade baixa + comissão).
- **Conflito a resolver:** "sem mensalidade" no regulamento vale pro **atleta**. Cobrar do **organizador** é outra relação (contrato B2B) — não fere isso, mas precisa de **termos de uso do organizador** próprios.
- **Pré-requisito:** onboarding de organizador self-serve (item já no roadmap).

**A pergunta central:** você quer, primeiro, **facilitar a operação** (Eixo A) ou **abrir a torneira de receita** (Eixo B)? A recomendação está na seção 6.

---

## 2.5. Modelo decidido pelo Juliano (06/09/2026)

Dois casos, conforme quem administra o circuito:

**Caso 1 — circuitos que o Juliano administra direto (ex.: BH).**
- **Cobrança única por atleta por temporada** (Eixo A). Mantém o modelo atual; muda só o meio (automático em vez de Pix manual). O dinheiro é do Juliano (ele é o organizador). Sem taxa de plataforma aqui (é ele mesmo).

**Caso 2 — circuitos vendidos a um organizador terceiro (ele capta e gere os atletas).**
- **Parte fixa:** um **valor por temporada por circuito** que o organizador paga ao Juliano (taxa de plataforma).
- **Parte variável:** um **valor por atleta** que entra na receita do Juliano.
- É um híbrido "base + uso" — **faz sentido** e é comum em SaaS/marketplace.

### Refinamentos a decidir (para o Caso 2 ficar redondo)
1. **Como cobrar a parte variável:** o jeito mais limpo é **split** — quando o atleta paga a inscrição pro organizador, o gateway já separa a sua fatia (R$Y ou Y%) automaticamente, e o resto vai pro organizador. Assim você **não fatura o organizador por atleta** (menos atrito) e só recebe de atleta que **realmente pagou**.
2. **"Por atleta inscrito" = quem pagou/foi confirmado, não pendente.** Cobrar por "inscrito" incluiria pendentes/recusados. Melhor: por atleta **ativo/pago** na temporada (casa com o valor entregue).
3. **A parte fixa é um compromisso antes de saber quantos atletas virão.** Pra baixar a barreira de um organizador novo, considere **fixo baixo** (ou **1ª temporada grátis/simbólica**) + variável "paga conforme cresce". Você pode subir o fixo depois que o modelo provar valor.
4. **Reembolso do fixo** se o circuito for cancelado no meio da temporada — definir (ex.: proporcional, ou não-reembolsável após o início).

### Fluxos de dinheiro no Caso 2 (resumo)
- Atleta → paga a inscrição → **split**: maior parte pro **organizador**, sua fatia por-atleta pra **você**.
- Organizador → paga a **parte fixa por temporada** direto pra você (assinatura/cobrança separada).
- Requer que cada organizador tenha conta de recebimento no gateway (KYC).

---

## 3. Estratégia de preços (rascunho pra discutir)

Números do roadmap como ponto de partida — **a validar no piloto**, não são definitivos.

**Se Eixo B por assinatura (organizador → você):**
| Plano | Faixa (mês) | Ideia |
|---|---|---|
| Básico | R$ 15–25 | 1 circuito, limite de atletas, sem marca própria |
| Premium | R$ 35–50 | + relatórios, + atletas, marca do clube |
| Clube | R$ 150–300 | vários circuitos, multi-organizador, prioridade |

**Se Eixo B por comissão (mais simples de começar):**
- Você fica com **R$ X por atleta pago** ou **Y%** de cada inscrição, via split automático. Sem mensalidade → adesão mais fácil; sua receita cresce com o uso.

**Eixo A (atleta):** mantém o valor por temporada que o organizador já define; a novidade é só o meio de pagamento.

> Decisão de preço não precisa ser final agora — precisa ser **testável** no piloto (1 número simples pra validar disposição a pagar).

---

## 4. Meios de pagamento & gateway (fatos de 2026)

### O trunfo novo: **Pix Automático**
O Banco Central lançou o **Pix Automático** (junho/2025, obrigatório desde out/2025): o cliente **autoriza uma vez** no app do banco e as cobranças recorrentes passam a ser debitadas sozinhas, **sem cartão e sem boleto**. É explicitamente indicado pra **clubes de assinatura, academias, escolas e SaaS** — exatamente o nosso caso. Em maio/2026 já movimentava ~2 mi de transações/mês e crescia rápido. É o trilho ideal pra recorrência barata no Brasil (dispensa a taxa de cartão).

### Comparativo rápido de gateways (perfil pequeno, recorrente, com split)
| Gateway | Forte em | Pix | Cartão | Recorrência | Split | Mensalidade |
|---|---|---|---|---|---|---|
| **Asaas** | SaaS / cobrança recorrente / PME | ~R$0,99 promo → R$1,99 | ~2,99% +R$0,49 | Sim (assinatura ~1,99%) | Sim (Pix/boleto/cartão) | Não |
| **Mercado Pago** | Checkout pronto, varejo | competitivo | competitivo | Sim | Sim | Não |
| **Pagar.me** | Marketplace / split flexível | sim | sim | Sim | Sim (referência) | Não |
| **Stripe** | SaaS / internacional | sim | sim | Forte | Sim | Não |

**Leitura:** pro nosso perfil (clubes pequenos, recorrência, e um dia **split** entre plataforma e organizador), **Asaas** é o candidato mais natural (feito pra cobrança recorrente de PME, split nativo em Pix/boleto/cartão, sem mensalidade, taxa de Pix baixa). **Mercado Pago/Pagar.me** entram se a prioridade for checkout de varejo ou split de marketplace mais complexo; **Stripe** se houver mira internacional. Nada disso é irreversível — dá pra começar com um e trocar.

### Split de pagamento (por que importa pro Eixo B)
Com *split*, quando o atleta paga a inscrição, o gateway **divide automaticamente**: a fatia da plataforma cai pra você e o resto pro organizador, na mesma transação. É o que torna a comissão (seção 3) operacional sem você tocar em dinheiro dos outros.

---

## 5. Segurança & Jurídico (não-negociável)

- **Nunca guardar cartão** — o gateway tokeniza; o app só guarda um `id`/token e o status.
- **Webhooks assinados** — a confirmação de pagamento vem do gateway (server-to-server), validada por assinatura; nunca confiar no cliente.
- **Split e repasse** exigem cadastro/KYC de cada organizador no gateway (conta de recebimento).
- **Jurídico:** termos de uso do organizador (B2B), política de reembolso/estorno, nota fiscal, e a política de privacidade atualizada (pagamento é novo tratamento de dado). Já há pendências jurídicas abertas (controlador, canal de direitos) que entram junto.
- **Guardião obrigatório** em toda fatia desta fase.

---

## 6. Recomendação

1. **Comece pelo Eixo A com Pix Automático**, no piloto: automatiza a cobrança que já existe, tira o trabalho manual, e valida na prática a disposição a pagar — sem prometer nada de SaaS ainda.
2. **Modele o Eixo B como comissão via split desde já** (não mensalidade): quando o 2º circuito real rodar, você liga o split e passa a ficar com uma fatia por atleta pago. Adesão fácil, receita atrelada ao uso, e evita o conflito com o "sem mensalidade" do atleta.
3. **Assinatura de organizador (mensal)** fica pra depois, quando houver vários clubes e valor claro pra cobrar fixo.
4. **Gateway:** prototipar com **Asaas** (recorrência + split + Pix Automático, sem mensalidade). Reavaliar contra Mercado Pago se o checkout de varejo pesar.

---

## 7. Checklist de decisões — FECHADO (06/09/2026)

- [x] **Foco:** os dois casos (Caso 1 direto + Caso 2 vendido), conforme seção 2.5.
- [x] **Modelo Caso 1:** cobrança única por atleta por temporada.
- [x] **Modelo Caso 2:** fixo por temporada por circuito **+** variável por atleta (via split).
- [x] **Valores:** **não fixar agora** — a lógica é parametrizada; o Juliano preenche os números depois (config no admin).
- [x] **Quem recebe:** Caso 1 → Juliano direto; Caso 2 → organizador (com split da fatia da plataforma) + fixo pago à parte.
- [x] **Gateway:** **Asaas** como aposta de trabalho (revisável na integração).
- [x] **Meio recorrente:** **Pix Automático** como principal; cartão como opção futura.
- [x] **Jurídico:** abrir termos do organizador + política de privacidade **em paralelo** ao desenvolvimento.

---

## 8. Plano de fatias (footprint-zero, revisão dos Guardiões)

Ordem sugerida. As primeiras são **inertes** (config sem valor = desligado) — não cobram nada, não tocam o BH.

1. **Fundação parametrizada (inerte).** Config de cobrança por circuito, sem valores: Caso 1 já tem `valor_temporada` (atleta); Caso 2 ganha campos novos em `circuitos` — taxa fixa da plataforma por temporada + taxa por atleta (fixo ou %) — tudo `null`/desligado por padrão. Só admin lê (nada exposto ao anon). BH (Caso 1) intocado.
2. **Cálculo (função pura, testável).** Dado o config + nº de atletas pagos, computa "quanto a plataforma recebe / quanto o organizador recebe / total". Sem mover dinheiro — só preview no admin. Harness de teste.
3. **Admin: definir valores.** Telas pra o Juliano/organizador preencher os números quando quiser (segue desligado até preencher).
4. **Jurídico em paralelo.** Termos do organizador (B2B) + política de privacidade atualizada (pagamento é novo tratamento). Guardião Jurídico/LGPD.
5. **Integração do gateway (Asaas) — cobrança real.** Conta/KYC, criar cobrança (Pix Automático), **webhook assinado** confirma pagamento (server-to-server), split automático da fatia da plataforma. Aqui é que dinheiro se move — Guardião de Segurança obrigatório, e só liga depois do jurídico.
6. **Recorrência por temporada + inadimplência.** Renovação automática, retenção (atleta não pago não é pareado — regra já existe), estorno.

> Fatias 1–3 podem ser construídas **agora** sem travar no gateway (a lógica é agnóstica). A fatia 5 é a única que depende do Asaas de fato.

---

## Fontes (pesquisa 06/09/2026)
- Pix Automático — visão geral e status 2026: [Asaas blog](https://blog.asaas.com/pix-automatico/), [EM](https://www.em.com.br/tecnologia/2026/01/7327097-pix-em-2026-pix-automatico-ja-e-realidade-e-novas-funcoes-sao-esperadas.html), [WEpayments](https://wepayments.com/pt/blog-br/pix-pt/pagamentos-recorrentes-no-brasil-a-transformacao-trazida-pelo-pix-automatico-no-mercado-de-assinatura/)
- Taxas Asaas 2026: [Asaas — preços e taxas](https://www.asaas.com/precos-e-taxas), [Asaas blog — Pix](https://blog.asaas.com/pix-asaas/)
- Comparativo de gateways / split 2026: [FWC Tecnologia](https://fwctecnologia.com/en/blog/post/payment-gateways-brazil-comparison-2026), [Asaas — split de pagamentos](https://blog.asaas.com/split-de-pagamento/)
