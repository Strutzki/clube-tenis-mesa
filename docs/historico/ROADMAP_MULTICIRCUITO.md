> **HISTÓRICO — não é o que fazer a seguir.** Substituido pelo docs/ROADMAP.md, que incorporou o conteudo vigente deste arquivo.
> O que vale hoje está em `docs/ROADMAP.md`. Guardado em 07/09/2026 porque registra *por que* as decisões foram tomadas.

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

> **Atualização 06/09/2026:** os itens 1–4 e 6 abaixo estão **✅ FEITOS**. O multi-circuito está funcional de ponta a ponta no código; o que resta é o **Piloto real** (item 5, ação do Juliano). Ver detalhes por item.

### 1. Papéis e autorização — Fatias 2-3 — ✅ FEITO
- **Fatia 2 (enforcement):** ✅ `admin-action` aceita o organizador (telefone+PIN) ao lado do PIN global, validando `circuito_organizadores` por ação (v49).
- **Fatia 3 (front):** ✅ modo "atleta ↔ organizador"; painel preso ao circuito do organizador; UI de nomear/remover/listar (super-admin).
- **Fatia 4 (opcional/depois):** aposentar o PIN global e migrar o super-admin pra conta de atleta — só quando você confirmar. (Não começado, opcional.)

### 2. Acesso do atleta a múltiplos circuitos (hub) — ✅ FEITO
- ✅ Switcher `HubCircuitosAtleta` (aparece com >1 circuito); leitura por circuito via porteiro (circuito privado) ou anon (aberto); "continuar conectado" por token de sessão. login-atleta v5, circuito-dados v2.

### 3. Admin de circuito não-BH — ✅ FEITO E AUDITADO (06/09/2026)
- ✅ **Virada de temporada (`NOVA_TEMPORADA`) para não-BH E BH — provada ao vivo** (v53 não-BH + v54 BH escopado). RPC `arquivar_partidas_temporada_circuito` escopado.
- ✅ **Passe de teste "admin não-BH" (06/09/2026):** auditoria de escopo de TODAS as ações mutantes do `admin-action` — cada `delete`/`update`/RPC destrutivo é filtrado por `circuito_id`. Confirmado ainda que o fluxo de inscrição/aprovação não-BH grava `status` **só em `circuito_atletas`** (SEASONAL_COLS), nunca na tabela global `atletas` → atleta de circuito não-BH **não vaza** pro roster do BH. Achado colateral (semente de teste legada contaminando o BH) resolvido: circuito `demo-juliano` removido, BH provado byte-idêntico. Ver GOVERNANCA_AGENTES.md.

### 4. Inscrição — ✅ FEITO (fatias 1–6)
- ✅ **Região (Fatia 4):** aviso de jogos presenciais por cidade/UF na confirmação (informativo; organizador é o gate real).
- ✅ **Janela e vagas (Fatia 6):** RPC `circuitos_abertos_vagas()`; circuito cheio marca "🎟️ fila de espera" (o teto é aplicado na promoção do backlog, não na inscrição).

### 5. Piloto real — ⬅️ **PRÓXIMO (ação do Juliano)**
- Abrir **um 2º circuito de verdade** (Sistema B, outra cidade), rodar uma temporada curta com atletas reais, caçar bugs de operação. É o teste que nenhum harness substitui. O código e o dado já estão destravados (item 3).

### 6. Despachos do Dia — ✅ FEITO (Fatias 1–3)
- ✅ Agregador `despachos-do-dia` (só-leitura, por papel) + card no admin com processar-na-hora + lembrete diário agendado. Push nativo no app fica como evolução futura.

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
1. ✅ **Papéis Fatia 2-3** (organizador funcional) →
2. ✅ **Acesso do atleta multi-circuito (hub)** + **admin não-BH testado/auditado** →
3. ✅ **Região + vagas** (inscrição fechada) →
4. ⬅️ **Piloto real** (2º circuito) — **VOCÊ ESTÁ AQUI** (ação do Juliano) →
5. **Pagamento/planos + onboarding de organizador** (destrava a venda) →
6. **Legal/marca + analytics + suporte** (pronto pra comercializar).

> Regra que não muda em nenhuma etapa: o **BH em produção nunca é prejudicado** (comparador byte-idêntico) e nada vai a produção sem a revisão supervisionada + seu OK.
