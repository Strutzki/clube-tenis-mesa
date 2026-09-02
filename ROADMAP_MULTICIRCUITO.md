# Roadmap — do multi-circuito à comercialização

Mapa do caminho até (A) o multi-circuito funcionar de ponta a ponta e (B) o produto poder ser vendido. Estado em 01/09/2026.

---

## ✅ O que já está pronto (no ar e verificado)

**Fundação multi-circuito (backend)**
- `circuitos` + `circuito_atletas` + Modelo B (identidade/rating global; sazonal por circuito).
- Roteamento por `circuitoId` em todas as ações; BH resolve por padrão (footprint-zero).

**Criação e operação de circuito (admin)**
- A1: `CRIAR_CIRCUITO` + formulário "Novo circuito" (sistema A/rating ou B/pontos trava na criação).
- A2: seletor de circuito no painel + guardas de concorrência + confirmação-com-nome nas ações destrutivas.

**Motor Sistema B (pontos, sem rating)** — completo
- Pareamento (sorteio/grupos) + bye rotativo, pontuação V=2/D=1, ranking + desempates, **W.O. automatizado** (adversário +2, ausente +1/0), regulamento vB-01.

**Inscrição por circuito**
- Gate "Inscreva-se" → checa circuitos abertos → seleção → confirmação → formulário do circuito certo.
- `INSCREVER` revalida o circuito no servidor e carimba a versão do regulamento.
- Nome de exibição do circuito separado do rótulo de mensagens.

**CPF como identidade nacional (Fatias 1-5)** — completo
- Tabela blindada `atleta_documento` (RLS deny), pepper no Vault + HMAC no edge, dedup anti-oráculo, rate-limit.
- Coleta no formulário (DV + consentimento LGPD específico + menores), obrigatório no servidor. Controlador: Juliano (PF).

**Participar (atleta existente entra em 2º circuito)** — completo
- Ação `PARTICIPAR` (login-atleta) autenticada por PIN, reusa a identidade (sem duplicar atleta/rating), cria só a matrícula.
- Front: detecta no "Inscreva-se" (não-BH) + card na área do atleta. **Backfill de CPF acontece aqui**, naturalmente.

**Papéis — Fatia 1**
- Tabela `circuito_organizadores` (vínculo organizador↔circuito), inerte. Decisões: organizador usa telefone+PIN; super-admin segue no PIN global por enquanto.

**Governança**: cada fase revisada (Guardião/Advogado/Designer) com veredito documentado; BH provado byte-idêntico em toda mudança.

---

## 🚧 Falta para o MULTI-CIRCUITO ficar completo

Ordem sugerida. Cada item é footprint-zero pro BH e segue o rito de revisão.

### 1. Papéis e autorização — Fatias 2-3 (crítico, em andamento)
- **Fatia 2 (enforcement):** `admin-action` aceita o caminho do organizador (telefone+PIN) **ao lado do PIN global** e valida `circuito_organizadores` por ação. Super-admin (PIN global) segue podendo tudo. *A mudança mais sensível — revisão ação a ação + teste ao vivo.*
- **Fatia 3 (front):** troca de modo "atleta ↔ organizador" no perfil; painel do organizador preso ao circuito dele.
- **Fatia 4 (opcional/depois):** aposentar o PIN global e migrar o super-admin pra sua conta de atleta — só quando você confirmar.

### 2. Acesso do atleta a múltiplos circuitos (hub)
- Hoje o login do atleta cai no BH. Falta: quando a pessoa está em >1 circuito, **ver e trocar** entre os circuitos dela (ranking/jogos/comunidade por circuito). É o que fecha a experiência do atleta multi-circuito.

### 3. Admin de circuito não-BH (fechar o ciclo do organizador)
- Confirmar/ajustar as telas do admin para um circuito **não-BH**: aprovar inscrições, incluir do backlog, processar rodada, virar temporada. Boa parte já é escopada por `circuitoId`, mas precisa de um passe de teste ponta-a-ponta num circuito real.
- **Virada de temporada (`NOVA_TEMPORADA`) para não-BH** (hoje é só BH).

### 4. Inscrição — fatias que faltam
- **Região (Fatia 4):** cidade/UF + filtro por região + confirmação leve (mostrar circuitos perto do atleta).
- **Janela e vagas (Fatia 6):** regra do último terço + `max_atletas` (cheio → fila de espera ou não aparece).

### 5. Piloto real
- Abrir **um 2º circuito de verdade** (Sistema B, outra cidade), rodar uma temporada curta com atletas reais, caçar bugs de operação. É o teste que nenhum harness substitui.

---

## 💰 Falta para COMERCIALIZAR (vender o produto)

Depende de 1-3 acima prontos + o piloto. São frentes novas.

### A. Pagamento e planos (o coração da monetização)
- Hoje: financeiro por temporada é **Pix manual** (admin confirma na mão). Para SaaS, precisa de:
  - **Assinatura/planos recorrentes** (referência da sua estratégia: básico R$15-25/mês, premium R$35-50, plano clube R$150-300).
  - **Gateway de pagamento real** (cartão/Pix automático) — ex.: Stripe, Pagar.me, Asaas, Mercado Pago. Decidir quem paga: organizador (por circuito) e/ou atleta.
  - Cobrança, faturas, inadimplência, upgrade/downgrade, período de teste.
- **Guardião obrigatório aqui** — dados financeiros são sensíveis; nunca guardar cartão (tokenizar no gateway).

### B. Onboarding de organizador (self-serve)
- Hoje o super-admin (você) cria circuito. Para escalar, o organizador precisa **criar o próprio circuito** sozinho (com limites do plano), nomear-se organizador e configurar. Fluxo de cadastro de organizador + termos.

### C. Legal e marca
- **Termos de uso + contrato de organizador** + política de privacidade revisada (CPF, pagamento).
- **Registro de marca no INPI** (já sinalizado como prioridade — o símbolo gráfico é o ativo mais protegível; nome é descritivo).
- Marca sem identificador geográfico (regra já adotada) — o app hoje é "Clube do Tênis de Mesa BH"; para nacional, resolver nome/branding neutro e, se for o caso, domínio.

### D. Confiabilidade e operação
- **Painel de gestão/analytics** (já no backlog, com cuidado LGPD): acessos, origem, funil de inscrição, engajamento.
- Monitoramento/alertas, backups verificados (já existem no Drive), plano de incidente.
- Suporte e documentação para organizadores.

### E. Escala técnica
- Revisar limites (quantos circuitos/atletas), performance das leituras, e um passe de segurança geral antes de abrir cadastro de terceiros.

---

## Sequência recomendada (resumo)
1. **Papéis Fatia 2-3** (organizador funcional) →
2. **Acesso do atleta multi-circuito (hub)** + **admin não-BH testado** →
3. **Região + vagas** (fecha a inscrição) →
4. **Piloto real** (2º circuito) →
5. **Pagamento/planos + onboarding de organizador** (destrava a venda) →
6. **Legal/marca + analytics + suporte** (pronto pra comercializar).

> Regra que não muda em nenhuma etapa: o **BH em produção nunca é prejudicado** (comparador byte-idêntico) e nada vai a produção sem a revisão supervisionada + seu OK.
