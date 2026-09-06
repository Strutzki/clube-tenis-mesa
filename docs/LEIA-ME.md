# LEIA-ME — pacote para subir ao projeto do Claude

Esta pasta reúne **tudo que a sessão de desenvolvimento produziu** sobre o app do Clube do Tênis de Mesa, pronto para ser **adicionado** ao projeto do Claude. São 40 documentos + este LEIA-ME.

## Regra de ouro (por que é seguro)
Você só vai **ADICIONAR arquivos novos** ao projeto. **Não apague nem substitua nada** que já está lá. Adicionar arquivo novo não quebra nada.

## Por onde começar a ler (depois de subir)
1. `ESTADO-DEV-app-tenis-de-mesa.md` — o retrato atual do que já foi feito. **Comece por ele.**
2. `ROADMAP_MULTICIRCUITO.md` — o que falta e em que ordem.
3. `GOVERNANCA_AGENTES.md` — como os agentes revisam o trabalho.
4. `CHANGELOG.md` — histórico do que foi ao ar.

## O que tem na pasta
- **Estado e planejamento:** ESTADO-DEV, ROADMAP, CHANGELOG, PLATAFORMA_BACKLOG.
- **Planos por fase (histórico + ativos):** PLANO_* (Fase A, A2, Motor B, Inscrição, Papéis, Participar, Virada, Despachos, dual-write, 4C).
- **Regulamento e testes:** REGULAMENTO_SISTEMA_B, REGULAMENTOS_NOVOS_CIRCUITOS, ROTEIRO_TESTE_SISTEMA_B, REGISTRO_VALIDACAO_2026-08.
- **Segurança/risco:** ESPEC_CPF_SEGURANCA, SEGURANCA_RPC_AUDIT, REVISAO_RISCO_MIGRACAO_MULTICIRCUITO.
- **Governança:** GOVERNANCA_AGENTES + 16 arquivos `agente-*` (os mandatos das 8 duplas de guardiões).
- **Curadoria:** curadoria-indice-app-tenis-de-mesa (o índice do dev) + curadoria-log.

## ⚠️ Duas coisas para você decidir (não mexi sozinho)
1. **"Sistema B / plataforma estão prontos?"** O índice do projeto diz para **não anunciar como pronto**. Na prática já subimos o motor B e boa parte do multi-circuito — mas nenhum 2º circuito real rodou ainda. Só você decide o que pode ser dito como pronto. (Detalhe no ESTADO-DEV.)
2. **Marcar os docs velhos do projeto.** Depois de subir estes, vale marcar como ⛔/⚠️ (não apagar) os de julho no projeto: `RETOMADA-app-clube-tenis-mesa.md`, o `App.jsx` antigo e o `spec_plataforma_multi_circuito.md` — o ESTADO-DEV é a versão atual deles.

## O que este pacote NÃO inclui (de propósito)
- Nada de marketing/Instagram nem de beach tennis — são de outras sessões.
- O `App.jsx` (código) — a fonte de verdade do código é a pasta no seu Mac + o app em produção, não o projeto.
