# Estado do desenvolvimento — App do Clube do Tênis de Mesa (multi-circuito)

**Atualizado: 05/set/2026.** Documento de estado escrito pela sessão de desenvolvimento (pasta do código). **Fonte de verdade continua sendo o app em produção + Supabase**, não este doc. Substitui, em atualidade, o `RETOMADA-app-clube-tenis-mesa.md` de julho (que está superado).

## Regra vigente
- Regulamento **A (rating/CBTM): v03-12** — 1ª rodada até dia **15**, 2ª rodada até dia **27**.
- Regulamento **B (pontos fixos): vB-01**.
- BH em produção **nunca é prejudicado**; toda mudança é comparada byte-a-byte antes de subir.

## Arquitetura (Modelo B — multi-circuito)
- Identidade + **rating global**: tabela `atletas`. Sazonal **por circuito**: `circuito_atletas`. Config: `circuitos` (o BH usa `configuracao`).
- Supabase: projeto `clube-tenis-mesa`, id `eultwfzzlgcmcikobmmy`, schema `public`.
- Front: `src/App.jsx` (SPA único, ~9 mil linhas). Deploy: `atualizar.sh` → Vercel.
- Backend (Edge Functions) no ar: **admin-action v54**, **athlete-action v17**, **login-atleta v5**, **circuito-dados v2**, + comprovante-url, anonimizar-atleta, resetar-pin-atleta, backup.

## O que JÁ está no ar (desde julho até 05/set)
- Fundação multi-circuito (Modelo B) + roteamento por circuito.
- Criar circuito + formulário "Novo circuito" + seletor de circuito no admin.
- **Motor do Sistema B** (pontos V=2/D=1, pareamento sorteio/grupos + bye rotativo, W.O. automatizado) — validado em 400 temporadas simuladas.
- Inscrição por circuito (o atleta escolhe o circuito aberto).
- **CPF como identidade nacional** — blindado (só hash), consentimento LGPD específico.
- **Participar** — atleta existente entra num 2º circuito sem duplicar identidade/rating.
- **Papéis** — organizador de circuito (login próprio, escopo travado no circuito dele).
- **Circuito privado + hub do atleta** — visibilidade controlada + troca entre circuitos.
- **Gerir circuito** — encerrar/reativar/excluir; alternar público/privado.
- **Virada de temporada para qualquer circuito** (escopada por circuito; BH intocado) — provada ao vivo.
- "Continuar conectado" do atleta (token de sessão, sem guardar PIN).

## Governança
- **8 duplas de agentes** (guardião + supervisor): Segurança, Atleta, Admin, Marca, Regulamento/Motor, Jurídico/LGPD, Confiabilidade/Deploy, Curador. Detalhe em `GOVERNANCA_AGENTES.md`.

## ⚠️ Divergência a confirmar com o Juliano (não resolver sozinho)
O `INDICE.md` do projeto diz "**não anunciar o Sistema B nem a plataforma como prontos**". Na prática, o motor B e boa parte do multi-circuito **já estão no ar** — mas **nenhum 2º circuito real rodou ainda** (o piloto é o próximo passo). Ou seja: pronto tecnicamente, ainda não validado em campo. **O Juliano decide o que pode ser comunicado como pronto.**

## Próximos passos (roadmap)
1. **Piloto real** — abrir um 2º circuito de verdade e rodar uma temporada curta.
2. **Inscrição por região + vagas**.
3. **Despachos do Dia** — tela única de ações do dia por papel (ver `PLANO_DESPACHOS.md`).
4. Decisão de arquitetura: **rating nacional × rating por circuito**.

## Pendências anotadas
- Jurídico: confirmar nome legal do controlador + canal de direitos; política de privacidade formal; backfill de CPF dos atuais.
- Técnico: dropar/restringir o RPC global `arquivar_partidas_temporada` (virou código morto).
- Limpeza: backups datados de `App.jsx` no repositório do código.
