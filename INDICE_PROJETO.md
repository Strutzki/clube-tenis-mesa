# Índice do Projeto — Clube do Tênis de Mesa

Mapa de **fontes de verdade**: qual arquivo/sistema manda em cada coisa. Mantido pelo agente `curador-projeto`. Estado: 05/09/2026.

## Aplicação
- **Front:** `src/App.jsx` — SPA único (React + Vite/rolldown). **É a fonte única do front.**
  - ⚠️ *Clutter conhecido:* há dezenas de backups datados (`src/App.jsx HH.MM.SS`) e um `App.jsx 20.13.44` na raiz + `files.zip` — são ruído, não fonte de verdade. Candidatos a remoção/limpeza (a decidir com o Juliano).
- **Deploy do front:** `atualizar.sh` (roda no Mac do Juliano) → push → Vercel builda. `vercel.json` controla cache (index.html revalida; assets imutáveis).
- **Backend (Edge Functions Deno):** `supabase/functions/` — projeto Supabase `eultwfzzlgcmcikobmmy`. Deploy pelo MCP do Supabase.

## Backend — versões no ar (conferir com list_edge_functions)
- `admin-action` **v54** — ações do admin/organizador + motor (rodadas, W.O., virada de temporada escopada por circuito).
- `athlete-action` **v17** — ações do atleta (INSCREVER com CPF, placar, W.O.).
- `login-atleta` **v5** — login/PIN, token de sessão, LOGIN_ORGANIZADOR, PARTICIPAR, SESSAO.
- `circuito-dados` **v2** — porteiro de leitura de circuito privado.
- Outras: `comprovante-url`, `anonimizar-atleta`, `resetar-pin-atleta`, `backup-clube-tenis-mesa`.

## Banco de dados (Modelo B — multi-circuito)
- Identidade + **rating global**: `atletas`.
- Sazonal **por circuito**: `circuito_atletas` (saldo, vitórias, derrotas, histórico, pagamento).
- Config de circuito: `circuitos`. Config do BH (legado): `configuracao`.
- Histórico de partidas: `partidas_historico` (escopado por `circuito_id`).
- CPF blindado: `atleta_documento` (RLS deny; só hash; `cpf_cifrado` vazio, reservado à fase 2).
- Papéis: `circuito_organizadores`. Sessão do atleta: `atleta_sessao`.
- RPC de arquivamento escopado: `arquivar_partidas_temporada_circuito(rotulo, circuito)`. (O global `arquivar_partidas_temporada` virou código morto — follow-up: dropar/restringir.)

## Regras da competição
- **Sistema A (rating/CBTM)** — regulamento **v03-12**. Rating global; ranking por saldo de pontos da temporada (por circuito). Usado pelo BH.
- **Sistema B (pontos fixos V=2/D=1)** — regulamento **vB-01**. Sem rating; tudo por circuito. Docs: `REGULAMENTO_SISTEMA_B.md`, `REGULAMENTOS_NOVOS_CIRCUITOS.md`.
- Texto do regulamento vive no `App.jsx` (RegulamentoView por sistema); os docs `REGULAMENTO_*` são a referência.
- **6 rodadas por temporada fixo** (Cap. 13).

## Marca
- **Fonte única:** `marca/Manual_Aplicacao_Marca_Clube_Tenis_Mesa_v2.pdf`.
- Regras fixas: slogan **"Vem pro Clube"** (nunca inventar outro); paleta de **4 cores**; logo nunca recriado de memória; **sem identificador geográfico** ("BH") na marca para o nacional; "cortada" = smash (nunca chop).

## Jurídico / LGPD
- `ESPEC_CPF_SEGURANCA.md`. Consentimento de CPF: versão `cpf-2026-08-v1`. Controlador de dados: **Juliano Strutzki (PF)**.
- Pendências jurídicas abertas: confirmar nome legal exato do controlador + canal de direitos; política de privacidade/retenção formal; decidir backfill de CPF dos atletas atuais.

## Governança e planejamento
- Governança dos agentes: `GOVERNANCA_AGENTES.md` + mandatos em `.claude/agents/*.md` (8 duplas: Segurança, Atleta, Admin, Marca, Regulamento, Jurídico, Confiabilidade, Curador).
- Roadmap: `ROADMAP_MULTICIRCUITO.md`. Backlog de plataforma: `PLATAFORMA_BACKLOG.md`.
- Planos por fase: `PLANO_*.md` (A, A2, Motor B, Inscrição, Papéis, Participar, Virada não-BH, dual-write, 4C).
- Segurança/risco: `SEGURANCA_RPC_AUDIT.md`, `REVISAO_RISCO_MIGRACAO_MULTICIRCUITO.md`.
- Validação/testes: `REGISTRO_VALIDACAO_2026-08.md`, `ROTEIRO_TESTE_SISTEMA_B.md`.

## Regra permanente
BH em produção **nunca** é prejudicado (comparador byte-idêntico) e nada vai a produção sem revisão supervisionada + OK do Juliano.
