# Plataforma nacional — decisões a fechar antes do FRONT (Fase 4C+)

Achados da revisão supervisionada (Designer + Advogado do Atleta) sobre o conceito. NÃO bloqueiam a Fase 0 (prova de isolamento, backend), mas precisam estar decididos antes de mexer no app.

## DECISÃO — CPF como identidade nacional (Bloqueador 1)
Tomada pelo Juliano. CPF vira a **base de identidade do atleta** na plataforma.

- **Obrigatório** para novos atletas, **próximas temporadas e novos circuitos**. Chave de dedup nacional (um CPF = uma pessoa; não muda, ao contrário do telefone).
- **Telefone continua** como contato (WhatsApp) e login (telefone + PIN). CPF é a chave de identidade, não o login.
- **Transição:** os atletas atuais (base por telefone) seguem funcionando; CPF é exigido daqui pra frente. Coleta do CPF dos existentes é gradual (ex.: na renovação/virada de temporada). Durante a transição: casa por CPF quando houver, telefone como fallback.
- **Fluxo "Participar":** casa por CPF → se existe, login por PIN e vira participação no circuito; se não, inscrição do zero (com CPF).

### Cuidados de segurança/LGPD com o CPF (dado sensível) — Guardião atento
- **Blindagem máxima:** CPF **nunca** legível por `anon`, **nem por organizador** (nem o do próprio circuito). Acesso só via `service_role` (dedup no servidor) e, no máximo, o **próprio atleta** via RPC segura (own-row). Jamais no roster público, no join do 4C, ou em qualquer select exposto.
- **Armazenamento protegido:** avaliar **hash** (para o matching de dedup, evitando guardar o CPF em claro) e/ou **criptografia** do valor. Nunca em texto puro exposto.
- **Validação de dígito verificador** (cliente + servidor) — pega erro de digitação e reduz colisão.
- **UNIQUE** no CPF (a chave de dedup).
- **Consentimento LGPD específico** na inscrição, explicando o uso (identidade nacional, anti-duplicado, integridade do rating), retenção e direitos. **Menores:** CPF/consentimento do responsável.
- **Nunca** logar CPF em console/erro, nem trafegar em URL/query string.
- Guardião revisa a modelagem (grants, RLS, storage, RPC) **antes** de implementar.

## DECISÃO — Papéis e autorização (Bloqueador 2)
Tomada pelo Juliano. Três níveis de papel, um login só:
1. **Super-admin (dono da plataforma — Juliano):** vê e age em tudo, qualquer circuito. Permanente. Atrelado à **conta/identidade** dele (não a um PIN global compartilhado).
2. **Organizador (por circuito):** gere só o circuito dele. Criador de um circuito = organizador. Co-organizadores: depois.
3. **Atleta:** joga.

- **Um login só** (identidade CPF/telefone + PIN); "organizador" e "super-admin" são **papéis anexados à conta**, não logins separados. Troca de modo = botão no perfil/hub (só aparece pra quem tem o papel).
- **Servidor valida autorização por circuito** em toda ação de admin (vínculo organizador↔circuito) — substitui o "confia no circuitoId do cliente". Resolve o item "[Alto] sub-admin sem autorização real".
- **Migração FASEADA (crítico):** manter o **PIN global de admin funcionando** durante a transição (Juliano nunca perde acesso); adicionar a autorização por organizador ao lado; só aposentar o PIN global e migrar o super-admin pra conta do Juliano **quando ele confirmar**.
- **Segurança:** essa é a parte pesada — Guardião especifica a blindagem da autorização (como hoje no CPF) ANTES de codar. Auditoria por pessoa ("quem fez o quê") como ganho.

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
