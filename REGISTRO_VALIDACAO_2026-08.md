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

## Backlog priorizado (pendente)

### Segurança / dados
- **[Alto] Contaminação cross-tenant latente:** escritas de estado sazonal ainda vão sempre para `atletas` global sem guarda BH-only. Inócuo hoje (só BH); **pré-requisito antes do 2º circuito** (junto com escopar o roster do BH por participação).
- **[Alto] Sub-admin sem autorização real:** PIN único global; servidor confia no `circuitoId` do cliente. Pré-requisito para operar circuitos com sub-admins.
- **[Alto] `NOVA_TEMPORADA` não atômica:** falha no meio deixa estado híbrido. Envolver numa RPC transacional.
- **[Alto] `EXCLUIR_ATLETA` hard delete** mesmo para atleta com histórico, sem diferenciar do fluxo de anonimização (LGPD).

### Experiência do atleta
- **[Alto] Elegibilidade (piloto masculino 18+)** só aparece no fim do funil de inscrição.
- **[Médio] Prazo de 24h do placar** não é validado no servidor (incoerência com regulamento).
- **[Médio] Checkbox de aceite** não acessível (leitor de tela/teclado); falta feedback "número disponível"; race "nenhum atleta ativo" no Visitante.

### Visual
- **[Alto] Contraste WCAG AA** no botão terracota (3.87:1) e placeholders (4.41:1 — trocar `cinza` por `cinzaSuave`).
- **[Médio] Emojis genéricos** destoam do tom; subtítulo "RANKING · RODADAS" parece menu; inscrição perde a logo.

### Admin
- **[Médio] Config financeira sem histórico de alteração**; **[Médio] teto sem lock** (corrida teórica); **[Baixo] biometria admin sem `adminId`**; **[Baixo] `DEFINIR_RODADAS` sem aviso** no meio da etapa.

## Estado do sistema
- Edge functions: admin-action v37, athlete-action v9. Front: item 7 aguardando `bash ~/clube-tenis-mesa-v2/atualizar.sh`.
- Backup: schema `backup_pre_mc`. Rollback edge: v36/v8.
