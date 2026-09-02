# Papéis e autorização — organizador por circuito (Bloqueador 2)

## Objetivo
Três papéis, **um login só**:
1. **Super-admin (Juliano):** age em tudo, qualquer circuito. Permanente.
2. **Organizador (por circuito):** gere só o(s) circuito(s) dele. Criador de um circuito = organizador.
3. **Atleta:** joga.

O **servidor valida a autorização por circuito** em toda ação de admin (vínculo organizador↔circuito) — substitui o atual "confia no circuitoId do cliente + PIN global".

## Princípio de segurança (não-negociável)
**Migração FASEADA.** O **PIN global de admin (super-admin/Juliano) continua funcionando** o tempo todo da transição — o Juliano nunca perde acesso. A autorização por organizador entra **ao lado**, sem desligar nada. Só aposentar o PIN global quando o Juliano confirmar. Nenhuma fatia pode quebrar o admin do BH.

## Modelo de dados (proposto)
- **`circuito_organizadores`**: `circuito_id` (FK) + `atleta_id` (FK) + `papel` ('organizador') + `criado_em`. PK (circuito_id, atleta_id). RLS deny p/ anon; só service_role.
- **Super-admin:** marcar em algum lugar seguro — opção `atletas.super_admin boolean` (a conta de atleta do Juliano vira super-admin) OU manter o PIN global como super-admin por enquanto (sem coluna). **Decisão do Juliano.**
- Organizador **é um atleta** (telefone + PIN já existentes). Não há login separado.

## Como o organizador se autentica no admin-action (DECISÃO)
Hoje o `admin-action` exige o **PIN global**. Pro organizador, duas opções:
- (a) **Reusar telefone + PIN do atleta** — o admin-action passa a aceitar, além do PIN global, um par (telefone+PIN) que ele verifica (como o `login-atleta`) e então cruza com `circuito_organizadores` pro `circuitoId` alvo. Um credencial só por pessoa. *Recomendado.*
- (b) **PIN próprio de organizador por circuito** — mais isolado, porém mais um segredo pra gerir.

## Fatias (faseado, footprint-zero pro BH)
1. **Fundação de dados (INERTE).** — ✅ **FEITA (migração aplicada, verificada).** `circuito_organizadores` (circuito_id, atleta_id, papel, criado_em; PK composta; FK cascade), RLS deny (anon *permission denied*), 0 policies, grant só service_role. **Decisões Juliano:** organizador autentica por telefone+PIN do atleta; super-admin = **PIN global por enquanto** (sem coluna `super_admin`, sem migrar seu acesso agora). Sem `NOMEAR_ORGANIZADOR`/enforcement ainda — o PIN global manda em tudo; a tabela é populada por SQL até a Fatia 2. BH byte-idêntico (`3f4f9540…`, 15 atletas). Verificado.
2. **Enforcement ao lado do PIN.** — ✅ **FEITA na 2ª versão (admin-action v48, provada AO VIVO).** super-admin (PIN global) byte-idêntico ao v47; organizador autentica por telefone+PIN (PBKDF2), com **allowlist** (default-deny) + **escopo por recurso**: cada ação com matchId/atletaId confere que a partida/atleta pertence ao circuito do organizador. Teste isolado (circuito+organizador+partida descartáveis): ação permitida no próprio circuito → 200; CRIAR_CIRCUITO → 403 super-admin; agir no BH → 403 "não organiza"; partida própria → 200; partida alheia → 403; atleta de fora → 403; PIN errado → 401. Tudo apagado; BH byte-idêntico (`3f4f9540…`), 0 resíduo. **Edge-only e dormente até a Fatia 3** (o front ainda não manda credencial de organizador; e `circuito_organizadores` está vazia).
   ⚠️ **ACHADO DO GUARDIÃO (1ª tentativa revertida):** validar só "o organizador é dono do circuitoId" **não basta**. Muitas ações recebem um `matchId`/`atletaId` e operam nele **sem conferir se o recurso está naquele circuito** — um organizador poderia mexer em partida/atleta de OUTRO circuito (inclusive o BH). Ações inseguras hoje: `VALIDATE_RESULT`, `ADMIN_IMPUTAR_RESULTADO`, `DESFAZER_VALIDACAO`, `MARCAR_RESULTADO_COMUNICADO`, `APLICAR_WO` (mexem em `partidas` por `matchId` sem `.eq(circuito_id)`), `EDITAR_ATLETA` (identidade global), `INSCRICAO_VALIDAR` (rating global no A), `LISTAR_TELEFONES` (telefones de todos). **A Fatia 2 correta exige:** (a) super-admin (PIN global) inalterado; (b) organizador autentica por telefone+PIN; (c) **allowlist** de ações do organizador (default-deny); (d) **escopo por RECURSO** — cada ação permitida confere que a `partida`/`atleta`/`membership` pertence ao `circuitoId` do organizador (partidas: `.eq(circuito_id)`; atleta: existe em `circuito_atletas(circuitoId, atletaId)`); (e) `LISTAR_TELEFONES` escopado ao circuito do organizador. Verificar ação a ação; teste ao vivo do caminho organizador (pode/não pode) antes de confiar. A 1ª versão (só checava dono do circuito) foi **revertida — admin-action segue v47, intocado**.
3. **Front — troca de modo + painel do organizador.** — 🟡 **CONSTRUÍDA, aguardando OK do Juliano + smoke ao vivo (não deployada).** Entrada pela tela de Admin → link "Organizo um circuito →" → `OrganizadorLogin` (telefone+PIN) chama `login-atleta` **LOGIN_ORGANIZADOR** (v3, no ar), que devolve só os circuitos que a pessoa organiza. Credencial de organizador guardada só em sessionStorage (como o PIN do super-admin). `chamarAdminAction` no modo organizador manda `orgTelefone+orgPin` e **trava o circuitoId** no dele (nunca envia o PIN global); o servidor revalida (allowlist+escopo do v48). Painel escopado: seletor de circuito, "Novo circuito" e "Organizadores" ficam **escondidos**; aparece o banner "Você é organizador de [circuito]". UI de nomear/remover/listar (`GerenciarOrganizadoresCard`) só pro super-admin, em circuito ≠ BH, batendo em `NOMEAR/REMOVER/LISTAR_ORGANIZADORES` (admin-action v49, super-admin-only). Reabrir a aba sem credencial → não restaura admin (re-login). Backend (v49 + login-atleta v3) já no ar; **falta só o deploy do front (`atualizar.sh`)**. Balanço de delimitadores 0 vs HEAD (`{}`, `()`, `[]` deltas casados; balanço global idêntico ao HEAD). **Nota conhecida (Fatia 2):** `LISTAR_TELEFONES` não está na allowlist do organizador → no modo organizador os links de WhatsApp saem sem telefone (falha graciosa, sem crash); escopar por circuito é follow-up.
4. **(Só quando o Juliano confirmar) Aposentar o PIN global** e migrar o super-admin pra conta do Juliano (atleta + super_admin). Reversível até aqui.

## Segurança / Guardião (condições esperadas)
- Autorização **checada no servidor** em TODA ação de escrita, contra o circuitoId alvo. Nunca confiar em papel/circuito vindos do cliente.
- Organizador **não** vira super-admin por engano: escopo estrito ao(s) circuito(s) dele; ações globais (ex.: virar temporada do BH) só super-admin.
- Rate-limit no PIN do organizador (reusa a trava do login-atleta).
- Auditoria "quem fez o quê" como ganho (registrar autor da ação).
- `circuito_organizadores`/`super_admin` nunca no grant anon; sem vazar quem é organizador na leitura pública, se não for necessário.

## Advogado do Atleta / Experiência do Admin
- Troca de modo clara e reversível; o organizador entende que só gere o circuito dele.
- Não confundir "sou atleta" com "sou organizador" — a mesma conta, papéis diferentes.

## Fora de escopo agora
- Co-organizadores (vários por circuito) — depois.
- Convite/aprovação de organizador — por ora o super-admin (Juliano) nomeia via banco/ação.
