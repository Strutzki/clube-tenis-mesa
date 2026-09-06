# Fase A — CRIAR_CIRCUITO + Seletor (4D) · Análise de risco + plano

**Objetivo:** você (super-admin, pelo PIN atual) cria um 2º circuito e transita entre ele e o BH no app — a plataforma "aparece" ponta a ponta, **sem mexer em autenticação** (organizador terceiro = Fase B). Footprint-zero pro BH.

## Estado atual (levantado)
- Front **não envia `circuitoId`** em nenhuma ação de escrita → o servidor usa o default `payload.circuitoId ? ... : bhId()` = **BH**. As leituras usam a constante `CIRCUITO_ATIVO` (BH).
- `CRIAR_CIRCUITO` não existe. Servidor já é multi-tenant (motor ramificado, writeAtleta, getCfg/setCfg). `NOVA_TEMPORADA` é **travada só no BH** (erro pros outros).
- Fase 0 já provou isolamento; 4C já abriu leitura pública de `circuito_atletas`/`circuitos`.

## Dividir em 2 passos (o A1 é seguro; o A2 é o que exige cautela)

### A1 — `CRIAR_CIRCUITO` (servidor, admin-action, PIN) — BAIXO risco
Insere uma linha em `circuitos` com **defaults sãos** (espelhando o BH): slug único, cidade/uf, `fase='inscricoes'`, `temporada_numero=1`, `temporada_ano`, `rodadas_por_temporada=6`, `auto_validar_placar=false`, `financeiro_ativo=false`, `max_atletas`, `ativo=true`, `regulamento_versao`. **Não toca no BH.** Reversível (delete, como na Fase 0).
- Validar: slug único (senão erro), nome obrigatório, números sãos.
- Só super-admin cria (PIN atual). Sem auth nova.

### A2 — Seletor de circuito (front) — MÉDIO risco (mexe no caminho de escrita)
- `CIRCUITO_ATIVO` deixa de ser constante e vira **estado** (circuito selecionado). Ao selecionar BH → idêntico a hoje.
- **Toda ação de escrita passa a mandar `payload.circuitoId = <selecionado>`** (em `chamarAdminAction`/`chamarAtletaAction`/`dispatchAndSync`). Com BH selecionado, o servidor recebe `circuitoId=BH` explícito = **mesmo comportamento de hoje** (footprint-zero).
- **Contexto explícito e inconfundível** (como no mockup do organizador): topo fixo "Gerenciando: Circuito X" + **confirmação que repete o nome** nas ações destrutivas ("Processar a rodada do **Circuito X**?"). É a trava contra agir no circuito errado.

## Riscos e mitigações
| Risco | Mitigação |
|---|---|
| Super-admin processa rodada/edita no **circuito errado** | Contexto fixo e explícito no topo + confirmação reafirmando o nome do circuito nas ações destrutivas. Default = BH. |
| Circuito criado incompleto → app quebra ao selecionar | `CRIAR_CIRCUITO` grava defaults completos (espelha o BH); testar carregar o novo circuito antes de operar. |
| Quebrar o BH ao parametrizar as escritas | Com BH selecionado, `circuitoId=BH` explícito = default de hoje. Comparador + verificação ao vivo (BH idêntico). |
| Ação destrutiva não escopada por circuito (ex.: EXCLUIR_ATLETA) | Só super-admin usa, no circuito que gerencia; escopar por circuito fica no backlog (Fase B). Registrar. |
| Circuito novo vazio → ranking/roster em branco | Estados vazios ("circuito novo, sem partidas ainda"). |
| `NOVA_TEMPORADA` em circuito ≠ BH | Já travado no servidor (erro). Limitação conhecida; virada multi-circuito é fase futura. |
| Reversão | Front via git; circuito de teste deletável (como Fase 0); seletor default BH. |

## Ordem
1. **A1** — `CRIAR_CIRCUITO` no admin-action + deploy edge. Testar criando um circuito e conferindo isolamento (BH intacto). Reversível.
2. **A2** — seletor no front + parametrizar as escritas. Footprint-zero com BH selecionado; contexto explícito + confirmação. Deploy só com comparador verde + verificação ao vivo.
3. Guardião valida o plano (foco: BH intacto, escrita no circuito certo, nada de auth nova indevida) antes de codar.

## Condições do Guardião (GO-com-condições — obrigatórias)
Validado com leitura de código + SQL real. `CIRCUITO_ATIVO` = id do BH (confirmado); só existe 1 circuito.

**O achado central (footprint-zero):** o vetor de contaminação do BH **não** são os ids de partida (esses são auto-escopados pela própria linha). É o **rating compartilhado (Modelo B)**: `writeAtleta` para não-BH grava **identidade** (`rating`/`rating_pico`/`rating_historico`) direto em `atletas` (tabela única). Então processar rodada / editar rating num circuito novo altera o `atletas.rating` que o BH exibe — **se o atleta estiver nos dois**. → **O circuito de teste TEM que usar atletas DISJUNTOS do BH** (inscrições novas, ids novos). Condição dura, não opcional. (Sazonais — saldo/vitórias/posição — vão só pra `circuito_atletas`, isolados.)

**A1 `CRIAR_CIRCUITO`:** slug único e **≠ 'bh'** (erro amigável, não 500); nunca `nome_circuito=null` nem `sistema` fora de A/B; setar `temporada_ano`; gravar todos os defaults do BH (circuito vazio é válido). Não toca o BH; reversível por DELETE (cascade só nos filhos do próprio circuito). Sem grant/policy novo.

**A2 seletor:** `CIRCUITO_ATIVO` vira estado com **default BH**; o seletor envia o **UUID exato** (nunca slug/vazio — slug quebraria as queries em silêncio) em `chamarAdminAction`/`chamarAtletaAction`/`dispatchAndSync`. `circuitoId=BH` explícito é **byte-idêntico** ao default de hoje. **Confirmação reafirmando o nome** em: PROCESSAR_RODADA, INICIAR_ETAPA, AVANCAR_RODADA, NOVA_TEMPORADA, EXCLUIR_ATLETA, ARQUIVAR_ATLETA, EDITAR_ATLETA, ESTORNAR_PAGAMENTO, DEFINIR_FINANCEIRO/CONFIG. **Comparador BH antes/depois = 0 diff** + verificação ao vivo antes do deploy.

**Limitações conhecidas → backlog Fase B (registrar, não corrigir agora):**
- `EXCLUIR_ATLETA` é **global** (deleta identidade compartilhada; cascade em `circuito_atletas` de TODOS os circuitos; `RESTRICT` em partidas). ALTO risco cross-tenant — mitigado na Fase A por operador único + confirmação-com-nome + atletas disjuntos; escopar/trocar por arquivamento na Fase B.
- `LISTAR_TELEFONES` é global (leitura cross-circuito) — só super-admin; escopar depois.
- `AVANCAR_RODADA` faz fallback `keyId="key_1"` (chave do BH) se `chaveAtual` vier null num não-BH — endurecer pra nunca cair em key_1 fora do BH.
- `ENVIAR_PLACAR`/auto-validar lê `configuracao(id=1)` (BH) pra qualquer circuito — não fere o BH; circuito novo herda o auto-validar do BH.
- `NOVA_TEMPORADA` travada fora do BH (virada multi-circuito é fase futura).

**Reclassificado como seguro-por-construção:** `VALIDATE_RESULT`, `ADMIN_IMPUTAR_RESULTADO`, `DESFAZER_VALIDACAO`, `MARCAR_RESULTADO_COMUNICADO`, `APLICAR_WO`, `RESPONDER_WO` — agem pelo `matchId`/id da linha (que carrega o próprio `circuito_id`); o `circuitoId` do payload é ignorado. Proteção = o front só exibe ids do circuito selecionado.

## Status
Plano + condições do Guardião aprovados no papel (GO-com-condições). **Aguardando OK do Juliano** pra executar **A1 (`CRIAR_CIRCUITO`)** — que o Guardião confirmou ser inerte pro BH e reversível. A2 (seletor) vem depois, com as travas acima.
