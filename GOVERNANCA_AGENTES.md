# Governança dos agentes de validação — regra fixa do multi-circuito

Regra permanente: **nenhuma fase do desenvolvimento do multi-circuito vai a produção sem a revisão supervisionada do(s) agente(s) relevante(s), com veredito documentado, ANTES do OK do Juliano e do deploy.** Esta é a disciplina que o Juliano cobrou; vale daqui pra frente.

## Quem revisa o quê (obrigatório, sempre supervisionado)
| Tipo de mudança | Agente que revisa (antes de executar) |
|---|---|
| Banco, servidor, RLS/grants, autenticação, isolamento, dados sensíveis (CPF, PIN) | **Guardião da Segurança** (+ supervisor) — GO/NO-GO |
| UI, layout, identidade visual, cores/tipografia/logo, slogan | **Designer / Guardião da Marca** (+ supervisor) — contra o Manual v1 |
| Jornada do atleta e do visitante (inscrição, login, ranking, descoberta) | **Advogado do Atleta** (+ supervisor) |
| Fluxos do admin/organizador (criar circuito, processar, financeiro, papéis) | **Experiência do Admin** (+ supervisor) |

Mudanças que cruzam áreas → mais de um agente.

## Rito por fase (checklist)
1. **Análise de risco** escrita (PLANO_*.md).
2. **Revisão supervisionada** do(s) agente(s) → **veredito documentado** (GO / GO-com-condições / NO-GO + condições).
3. **OK do Juliano** com as condições à vista.
4. **Execução** com as condições atendidas.
5. **Verificação** (comparador/footprint-zero, teste anon, verificação ao vivo) antes e/ou depois do deploy.
6. **Registro** do resultado.

## Vereditos já emitidos (histórico)
- 4C (reabrir leitura) — Guardião: GO-com-condições → executado e verificado ao vivo.
- CPF (identidade nacional) — Guardião: GO-com-condições (espec de blindagem) → `ESPEC_CPF_SEGURANCA.md`.
- Fase A (CRIAR_CIRCUITO + seletor) — Guardião: GO-com-condições → `PLANO_FASE_A.md`.
- Conceito da plataforma (5 telas) — Designer + Advogado do Atleta (supervisionados).
- Teste-isca de marca — Designer pegou 4/4 dos erros plantados, 0 falso positivo.
- Fase A1 (CRIAR_CIRCUITO + coluna pareamento) — Guardião (supervisionado): GO-com-condições → migração aplicada, admin-action v41 no ar, teste de dados OK (circuito A e B inserem, constraint rejeita valor inválido, BH byte-idêntico, teste limpo). Front (card "Novo circuito" no painel admin) escrito; deploy via atualizar.sh pendente. Suporta os dois sistemas (A rating / B pontos), com o sistema travando na criação. B só fica operável no passo 2 (motor + regulamento).
- Prazo da R2 (dia 25 → dia 27) — Advogado do Atleta (supervisionado): AJUSTES → aplicados. Achados: 3 pontos de cálculo (não 2; incluía App.jsx L1100 escondido), calendário do regulamento reescrito (conferência R2 26-29 → 28-29), versão v03-11 → v03-12 sem re-aceite bloqueante (versão é só carimbo, nenhum código força re-aceite). Forward-looking. Edge (admin-action v40, athlete-action v14) deployado e verificado ao vivo; front aguardando atualizar.sh.

## Honestidade / limites
- Os agentes são baseados em IA: **amplificam** o rigor, não substituem a verificação. O olho do Juliano no que é crítico continua valendo.
- A ativação é **disciplina de processo**, não um portão automático do sistema. O Juliano pode **auditar** a qualquer momento com um **teste-isca** (plantar um erro conhecido e ver se o agente pega).
- Os mandatos vivem em `.claude/agents/*.md` (mantê-los afiados = manter os agentes bons).
