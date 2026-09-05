# CHANGELOG — Clube do Tênis de Mesa

Histórico do que foi a produção. Mantido pelo agente `curador-projeto`. Mais recente no topo.
Formato: **data — o quê** (versão do edge/regulamento, notas).

## 2026-09-05
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
