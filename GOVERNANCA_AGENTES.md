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
- EXCLUIR_ATLETA escopado por circuito (não-BH apaga só a matrícula `circuito_atletas`; BH inalterado) — Guardião (supervisionado): GO-com-condições → admin-action v43. BH byte-idêntico (verificado vs git HEAD), ramo não-BH inerte até o A2, injeção fechada por validação UUID, C1 (FKs) verificado (nada referencia circuito_atletas → sem 500/cascata). Condições p/ o A2 ligar o ramo: C3 = autorização por circuito (o PIN é global; validar que o admin pode operar o circuitoId antes do app enviá-lo).
- Auditoria de RPCs SECURITY DEFINER (ver `SEGURANCA_RPC_AUDIT.md`) — Guardião: arquivar_partidas_temporada fechada ao anon; buscar_atleta_por_telefone reduzida a só id; preco_temporada_atleta enxugada (higiene). Fix real (autorização por chamador) no backlog da fase de contas.
- Fase A2 (seletor de circuito) — plano em `PLANO_FASE_A2.md`. Guardião: GO-com-condições. Base footprint-zero verificada (CIRCUITO_ATIVO === bhId()). Condições: Passo 1 inerte (let+setter+injeção circuitoId, default BH); Passo 2 seletor com guarda de concorrência (desabilitar em loading/sync, descartar loads fora de ordem); C9 dura = atletas de teste DISJUNTOS do BH (rating global). Verificação entre passos: hash das tabelas BH antes/depois (0-diff) + smoke anon.
- Fase A1 (CRIAR_CIRCUITO + coluna pareamento) — Guardião (supervisionado): GO-com-condições → migração aplicada, admin-action v41 no ar, teste de dados OK (circuito A e B inserem, constraint rejeita valor inválido, BH byte-idêntico, teste limpo). Front (card "Novo circuito" no painel admin) no ar. Suporta os dois sistemas (A rating / B pontos), com o sistema travando na criação. B só fica operável no passo 2 (motor + regulamento).
  - **INCIDENTE (corrigido):** a migração adicionou `pareamento` sem grant ao anon. O `db.getConfig` lê `circuitos` com `select=*` (sem lista de colunas), então a coluna nova NÃO concedida quebrou a query inteira pro anon → "permission denied for table circuitos" (42501) → app não carregava (banner de erro) pra todos, até o fix. **Corrigido** com `grant select (pareamento) on circuitos to anon, authenticated` + reload do schema (pareamento não é sensível). **LIÇÃO PERMANENTE:** o app lê `circuitos` (e outras tabelas públicas) com `select=*` — QUALQUER coluna nova numa tabela lida pelo anon precisa de `grant select (coluna) to anon, authenticated` + `notify pgrst` na MESMA migração, senão derruba a leitura. O Guardião checou "vaza pro anon?" mas não "quebra o select=*?" — incluir essa checagem em toda mudança de schema de tabela lida publicamente.
- CPF Fatias 1-2 (fundação de dados + núcleo cripto) — Guardião da Segurança (supervisionado): **GO (com notas)**. Provas: `atleta_documento` RLS deny-all (anon *permission denied*); pepper no Vault; `get_cpf_pepper`/`dedup_por_cpf_hash` service-role-only (anon barrado); `cpf_hash` UNIQUE; `cpf_verificado` COM grant de coluna (select=* do app não quebra — lição da Fase A1 aplicada); dados do BH byte-idênticos (hash 43-col `3f4f9540…`). Notas: cpf_verificado visível ao anon (booleano não-sensível, ok); hash de referência calculado com CPF sintético (regra: com CPF real, hash só no edge); documentar rotação do pepper antes do go-live; `atleta_documento` nunca em view pública/join 4C/grant anon.
- CPF Fatia 3 (plano — INSCREVER + consentimento) — Guardião + Advogado do Atleta (supervisionado): **GO-com-condições**. Guardião: HMAC só no edge (CPF nunca em SQL); retrocompatível (sem CPF = comportamento de hoje, caminho novo gated); UNIQUE→erro genérico `cpf_duplicado`; nunca `e.message` cru nem log de CPF/IP. Advogado: consentimento específico separado do genérico (finalidade/retenção/direitos/controlador + versão/data/IP); menores→data de nascimento→responsável; minimização (só hash); cascade na exclusão; número nunca exibido. **Decisões do Juliano:** controlador de dados = decidir depois (texto de consentimento/Fatia 4 fica pendente; código da Fatia 3 segue); CPF duplicado na inscrição → "já existe cadastro — entre pelo acesso" (revela ao portador, exige PIN, rate-limited).
- Prazo da R2 (dia 25 → dia 27) — Advogado do Atleta (supervisionado): AJUSTES → aplicados. Achados: 3 pontos de cálculo (não 2; incluía App.jsx L1100 escondido), calendário do regulamento reescrito (conferência R2 26-29 → 28-29), versão v03-11 → v03-12 sem re-aceite bloqueante (versão é só carimbo, nenhum código força re-aceite). Forward-looking. Edge (admin-action v40, athlete-action v14) deployado e verificado ao vivo; front aguardando atualizar.sh.

## Honestidade / limites
- Os agentes são baseados em IA: **amplificam** o rigor, não substituem a verificação. O olho do Juliano no que é crítico continua valendo.
- A ativação é **disciplina de processo**, não um portão automático do sistema. O Juliano pode **auditar** a qualquer momento com um **teste-isca** (plantar um erro conhecido e ver se o agente pega).
- Os mandatos vivem em `.claude/agents/*.md` (mantê-los afiados = manter os agentes bons).
