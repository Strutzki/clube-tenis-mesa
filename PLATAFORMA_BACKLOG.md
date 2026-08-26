# Plataforma nacional — decisões a fechar antes do FRONT (Fase 4C+)

Achados da revisão supervisionada (Designer + Advogado do Atleta) sobre o conceito. NÃO bloqueiam a Fase 0 (prova de isolamento, backend), mas precisam estar decididos antes de mexer no app.

## Bloqueadores estruturais
1. **Inscrição = 1 cadastro nacional (Modelo B).** "Participar" de um circuito novo não pode criar atleta/rating novo. Deve casar por telefone e **reusar o atleta + rating nacional**, criando só o vínculo por circuito (`circuito_atletas`: status/saldo/pendente). Hoje `INSCREVER` cria `atletas` com rating 250 — precisa de um caminho "atleta existente entra em novo circuito".
2. **Papel duplo atleta↔organizador.** Hoje `isAdmin`/`currentAthlete`/`isVisitante` são exclusivos. Uma pessoa é as duas coisas. Definir a troca de modo (a partir do perfil/hub; não login separado).
3. **Léxico do Modelo B.** Rating = "nacional" (só topo do hub/perfil). Posição/saldo = "neste circuito". Explicador único quando entra no 2º circuito. (Parcialmente refletido no mockup.)

## Casos de borda / itens de apoio
- Estados vazios: atleta com 0 circuitos; circuito sem atletas (ranking em branco); novato sem rating (o "#128 no Brasil" pressupõe ranking).
- Inscrição pendente visível no hub ("em análise") e na lista (vira "inscrição enviada", não segue oferecendo "Participar").
- **Checklist de privacidade da página pública** (auditar no código): nunca vazar telefone (é vetor de login!), placar em aberto, financeiro/PIX, PII de inscrição, dados sob `aceite_lgpd`/menores.
- Ação destrutiva do admin reafirma o nome do circuito ("Processar a rodada do **Circuito BH**?").
- Deep-link: circuito restrito respeita visibilidade; quem já é membro cai na visão de membro (não na página pública).
- Visibilidade por circuito (público/restrito) = config do organizador; padrão sugerido: público.
- Consolidar os dois trocadores de circuito num só padrão; porta de entrada do organizador na tela inicial.

## Marca (pendências do mockup → build)
- Exportar o arquivo da **versão ícone** (raquetes) das SVGs mestras pra usar dentro do app (headers ≥32px). Selo completo só ≥120px (entrada).

## Reaproveitamento
- Alto reuso: telas dentro do circuito (ranking/jogos/comunidade), ações de temporada do admin, motor de rating, inscrição, visitante/comunidade read-only, mensagens WhatsApp.
- Novo: hub, descoberta/lista + busca por cidade, flag de visibilidade, roteamento de deep-link, trocador de contexto, troca de modo, superfície de pendência.
- Fundação (já construída): `circuitos` + `circuito_atletas` + Modelo B no backend.
