# CHANGELOG — Clube do Tênis de Mesa

Histórico do que foi a produção. Mantido pelo agente `curador-projeto`. Mais recente no topo.
Formato: **data — o quê** (versão do edge/regulamento, notas).

## 2026-09-06
- **Despachos do Dia — Fatia 2 (agir na hora)** — agregador v2 devolve a rodada pronta pra processar por circuito (`processarRodada` + `processarPronta`); card ganhou botão "⚙️ Processar rodada N" com confirmação, escopado no circuito (super-admin foca via trocarCircuito; organizador no dele). Trava de segurança: só aparece se a rodada estiver 100% resolvida (o BH, com rodada incompleta, não mostra botão). Teste ao vivo num circuito B descartável, BH comparado por hash de competição.

## 2026-09-05
- **Despachos do Dia — Fatia 1** — novo edge `despachos-do-dia` (agregador só-leitura; super-admin vê todos os circuitos, organizador só os dele; devolve contagens por circuito, sem dado pessoal) + card "📋 Despachos do dia" no painel admin (mostra por circuito o que precisa de ação e leva à tela certa). Consultas provadas contra o BH (4 a processar, 2 backlog). Verificação ponta-a-ponta ao vivo com o PIN do Juliano.
- **Regulamento v03-12 (Sistema A) publicado como documento** — `docs/REGULAMENTO_TENIS_DE_MESA_v03-12.md`, extraído fielmente do texto do app (com 2ª rodada no **dia 27**). Preenche a lacuna do "regulamento vigente ausente do projeto". Os PDFs antigos (v03-4, v03-11, com dia 25) ficam superados — devem ser removidos/marcados no projeto.
- **Despachos do Dia (proposta)** — mini-spec em `PLANO_DESPACHOS.md` + item no roadmap. Tela única de ações do dia, agregada por papel (super-admin = todos os circuitos; organizador = o dele) + lembrete no celular. Ainda não iniciado.
- **Virada de temporada do BH escopada** — admin-action **v54**. O ramo do BH também passou a arquivar/deletar só por `circuito_id` (resultado idêntico pro BH; nunca toca outro circuito). Resolve a pendência do delete global. Leitura do ranking do BH também escopada.
- **Curador do Projeto** — novo par de agentes (`curador-projeto` + `supervisor-curador`); criados `INDICE_PROJETO.md` e este CHANGELOG.

## 2026-09-04
- **Virada de temporada para circuitos não-BH** — admin-action **v53** + RPC escopado `arquivar_partidas_temporada_circuito`. Provada ao vivo num circuito descartável, BH byte-idêntico.
- **3 guardiões novos** — Regulamento/Motor, Jurídico/LGPD, Confiabilidade/Deploy (+ supervisores). Check geral do projeto com eles (nada crítico; BH intacto).
- **Toggle Público/Privado do circuito** — admin-action **v52** (ação `DEFINIR_PUBLICO`) + card no admin.
- **Cancelar circuito** — admin-action **v51** (ENCERRAR/REATIVAR/EXCLUIR_CIRCUITO) + card no admin; seletor mostra circuitos encerrados.
- **Correções do visitante** — refresh mantém a lista da vitrine e o circuito aberto; vitrine mostra abertos/fechados com cadeado.
- **"Continuar conectado" do atleta** — token de sessão (não guarda PIN); login-atleta **v5**, circuito-dados **v2**.

## Antes de 2026-09-04 (marcos consolidados)
- **Circuito privado + hub do atleta** — coluna `publico`, porteiro `circuito-dados`, RLS de leitura, switcher multi-circuito, login-atleta v4.
- **Papéis (organizador)** — `circuito_organizadores`, enforcement no admin-action (allowlist + escopo por recurso), modo organizador no front.
- **Participar** — atleta existente entra em 2º circuito (login-atleta), com backfill de CPF.
- **CPF como identidade nacional** — `atleta_documento` blindado, HMAC no edge, consentimento `cpf-2026-08-v1`, obrigatório na inscrição.
- **Inscrição por circuito** — gate "Inscreva-se" → circuitos abertos → seleção → formulário do circuito certo.
- **Motor Sistema B** — pontos V=2/D=1, pareamento sorteio/grupos + bye, W.O. automatizado, regulamento vB-01.
- **Plataforma A1/A2** — CRIAR_CIRCUITO + formulário "Novo circuito" + seletor de circuito no admin.
- **Fundação multi-circuito** — Modelo B (`circuitos` + `circuito_atletas`), roteamento por `circuitoId`, dual-write.
