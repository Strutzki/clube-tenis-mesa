# Registro — Rodada de validação + correções (ago/2026)

## Time de validação (4 agentes, salvos em `.claude/agents/`)
- **guardiao-seguranca** (Opus) — segurança, integridade, isolamento multi-tenant, go/no-go.
- **designer-visual** (Sonnet) — marca, consistência, responsividade, acessibilidade (via Claude no Chrome).
- **experiencia-atleta** (Sonnet) — jornada do atleta vs atrito e regulamento.
- **experiencia-admin** (Sonnet) — fluxos admin/sub-admin, guard-rails.

Regra do portão: rodam em paralelo a cada avanço, **somente leitura em produção**, e consolido num único go/no-go antes da aprovação do Juliano.

## Parecer da 1ª rodada
**GO** para o avanço multi-circuito. BH intocado (só atividade legítima), dual-write 0 divergências, blindagem de leitura intacta, 1 circuito. A maioria dos achados é **pré-existente**, não introduzida pela migração.

## Correções aplicadas nesta sessão

### Item 1 — `partidas_historico` blindado ✅ (banco, valendo)
RLS ligado + policy `leitura_publica_partidas_historico` (o arquivo segue legível pro app) + revogadas todas as escritas (INSERT/UPDATE/DELETE/TRUNCATE) do público. Arquivamento roda via service_role. Verificado: anon só com SELECT.

### Item 6 — escrita pública em `atletas` removida ✅ (banco, valendo)
Havia grant de escrita no **nível da tabela** (anon: INSERT; authenticated: INSERT/UPDATE/DELETE) — por isso o revoke por coluna não bastava. Helpers de escrita direta no front são código morto (tudo via edge function/service_role). Removidos os grants de escrita do público. Verificado: 0 grants de escrita, leitura das colunas seguras mantida, blindagem de desconto_pct/isento intacta.

### Item 7 — bug "Inscrição enviada!" falsa ✅ (front, requer `atualizar.sh`)
O formulário passava pro passo de sucesso sem esperar o servidor. Agora aguarda a resposta; em falha (telefone duplicado / conexão) mostra erro claro na própria tela e permanece no passo; botão vira "Enviando…". Arquivos: `src/App.jsx` (`dispatchAndSync`, `syncToSupabase` INSCRICAO_ADD, `InscricaoForm`).

### Consertos rápidos (2ª leva) ✅ (front requer `atualizar.sh`; banco/servidor já valendo)
- **Contraste WCAG AA:** token novo `terracotaBtn` (#B8461F, ~5,3:1) nos CTAs de texto claro (inscrição/login, "Sou atleta", biometria) + regra global `::placeholder` (cinzaSuave, 6,63:1). *(front)*
- **Elegibilidade no funil:** aviso "Temporada 1 · piloto masculino 18+" no passo 1 da inscrição. *(front)*
- **Prazo de 24h → sinalizar (não bloquear):** decisão do Juliano = o placar entra, mas marcado "fora do prazo", e o admin decide. Coluna `partidas.fora_do_prazo` ✅ (banco); athlete-action marca a flag quando o envio é após o prazo (fuso São_Paulo), sem bloquear ✅ (servidor); selinho "⏰ fora do prazo" no card *Aguardando Validação* do admin *(front)*. Corte: data posterior ao prazo (lenient, ajustável).

### Blindagem cross-tenant (roteamento de escrita) ✅ (servidor, valendo — admin-action v38 / athlete-action v11)
Helper `writeAtleta` ramifica por circuito: BH grava em `atletas`+espelho (byte-idêntico ao antigo); não-BH grava **identidade** em `atletas` e **sazonal só** em `circuito_atletas`. Isso impede vazamento cross-tenant e torna o BH imune a atletas-teste (ficam `atletas.status='pendente'`, excluídos das leituras do BH). Cobriu 12 escritas do admin + RENOVAR do athlete. BH intacto, 0 divergências de dual-write.

## Rodada de validação SUPERVISIONADA (2ª rodada)
Estreia do time supervisionado: cada agente (Guardião/Admin) passou por um supervisor exigente, loop até 3 rodadas.
- **Guardião:** GO homologado na 2ª rodada (o supervisor exigiu e o agente entregou: prova de que a FK `circuito_atletas→atletas` é `ON DELETE CASCADE`; citação do gate de PIN do `EXCLUIR_ATLETA`; mapa das FKs que barram exclusão de atleta com histórico).
- **Admin:** aprovado de 1ª — **pegou um furo real** que fora introduzido no recurso "fora do prazo".

### Consertos da rodada supervisionada ✅
- **[Alto] Auto-validação ignorava o prazo:** placar enviado fora do prazo com auto-validação ligada era validado direto, pulando a decisão do admin. Corrigido (athlete-action v12): fora do prazo **não** auto-valida, cai em *Aguardando Validação*. *(servidor, valendo)*
- **[Médio] Selinho de prazo** agora também aparece no card *Aguardando Cálculo* e no `MatchCard` (visão por chave). *(front)*

## Backlog priorizado (pendente)

### Segurança / dados
- ~~[Alto] Contaminação cross-tenant latente~~ ✅ **resolvido** pelo roteamento de escrita (`writeAtleta`).
- **[Alto] Sub-admin sem autorização real:** PIN único global; servidor confia no `circuitoId` do cliente. Pré-requisito para operar circuitos com sub-admins.
- **[Alto] `NOVA_TEMPORADA` não atômica:** falha no meio deixa estado híbrido. Envolver numa RPC transacional.
- **[Alto] `EXCLUIR_ATLETA` hard delete** mesmo para atleta com histórico, sem diferenciar do fluxo de anonimização (LGPD); e **escopar por `circuito_id`** (relevante no 2º circuito).
- **[Baixo] `promoverBacklog`** duplica a lógica do `writeAtleta` (branch BH manual) — refatorar pra reusar o helper.
- **[Baixo] Documentar** que `rating`/`rating_pico`/`rating_historico` são identidade GLOBAL no Modelo B (rating de um circuito afeta os outros) — hoje só num comentário de 2 linhas.

### Experiência do atleta
- **[Médio] Checkbox de aceite** não acessível (leitor de tela/teclado); falta feedback "número disponível"; race "nenhum atleta ativo" no Visitante.
- *(feito) Elegibilidade e prazo-de-24h — ver "Consertos rápidos (2ª leva)".*

### Visual
- **[Médio] Emojis genéricos** destoam do tom; subtítulo "RANKING · RODADAS" parece menu; inscrição perde a logo.
- *(feito) Contraste WCAG dos CTAs e placeholders — ver "Consertos rápidos (2ª leva)".*

### Admin
- **[Médio] Config financeira sem histórico de alteração**; **[Médio] teto sem lock** (corrida teórica); **[Baixo] biometria admin sem `adminId`**; **[Baixo] `DEFINIR_RODADAS` sem aviso** no meio da etapa.

## Estado do sistema
- Edge functions: admin-action **v38**, athlete-action **v12**. Banco: coluna `partidas.fora_do_prazo` + RLS/grants de `partidas_historico` e `atletas` ajustados (itens 1 e 6).
- Multi-circuito: servidor pronto e multi-tenant (leituras+escritas escopadas/roteadas, BH byte-idêntico). Próximo passo = circuito-teste (via seletor no app / prova SQL).
- Front pendente de build (`bash ~/clube-tenis-mesa-v2/atualizar.sh`): item 7 (inscrição) + contraste + elegibilidade + selinho fora-do-prazo (3 pontos).
- Backup: schema `backup_pre_mc`. Rollback edge: admin v37 / athlete v11.
- Time de validação: 4 agentes + 4 supervisores (loop teto 3 rodadas), em `.claude/agents/`.
