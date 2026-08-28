# Fase A2 — Seletor de circuito (transitar e administrar) · Plano

**Objetivo:** o super-admin (PIN atual) transita entre o BH e os circuitos criados no A1 e administra cada um. **Footprint-zero pro BH:** com o BH selecionado, o app é byte-idêntico a hoje.

## Arquitetura atual (levantada)
- **Leituras (5):** `db.getAtletas/getPartidas/getChaves/getConfig/getSolicitacoesWo` usam `const CIRCUITO_ATIVO` (L77) em template literal avaliado **em tempo de chamada**. `loadFromSupabase` (L3602) chama todas.
- **Escritas:** passam por `dispatchAndSync` → `syncToSupabase` → `chamarAdminAction`/`chamarAtletaAction` (L3707/3729), que hoje **não** enviam `circuitoId` → o servidor usa o default BH. O servidor já é multi-tenant (motor ramificado por circuito).
- **Sessão:** `ctm_sessao` guarda isAdmin/athleteId/isVisitante/tab.

## Mecanismo (mínimo e reversível)
1. `const CIRCUITO_ATIVO` → **`let CIRCUITO_ATIVO`** (módulo, default = UUID do BH). Um setter `setCircuitoAtivo(uuid)`. As leituras passam a mirar o valor atual — com BH, idênticas.
2. `chamarAdminAction`/`chamarAtletaAction`: injetar **`circuitoId: CIRCUITO_ATIVO`** no payload (uma linha em cada). Pega **todas** as escritas de uma vez. Com BH, o servidor recebe `circuitoId=BH` explícito = **default de hoje** (idêntico).
3. **SEMPRE o UUID exato** (nunca slug/vazio — slug quebraria as queries em silêncio). O seletor guarda o UUID.
4. **Não persistir** o circuito na sessão nesta fase: recarrega sempre no BH. Reduz o risco de agir no circuito errado após um reload. Trocar é ação consciente dentro da sessão.

## Seletor (UI) — só super-admin
- Fonte: `circuitos?select=id,slug,nome_circuito,sistema&ativo=eq.true&order=nome_circuito`.
- Aparece só pra admin e só se houver **>1 circuito** (senão o BH é o único e nada muda).
- **Contexto fixo e inconfundível:** faixa no topo do painel "Gerenciando: **Circuito X**". Trocar = `setCircuitoAtivo(uuid)` + `loadFromSupabase()` + atualizar a faixa. Default/base = BH.

## Confirmação-com-nome (trava contra circuito errado)
Nas ações destrutivas/estruturais, o diálogo **repete o nome do circuito**: "Processar a rodada do **Circuito X**?". Ações: PROCESSAR_RODADA, INICIAR_ETAPA, AVANCAR_RODADA, NOVA_TEMPORADA, EXCLUIR_ATLETA, ARQUIVAR_ATLETA, EDITAR_ATLETA, ESTORNAR_PAGAMENTO, DEFINIR_FINANCEIRO/CONFIG.

## Riscos e mitigações
| Risco | Mitigação |
|---|---|
| Agir no circuito errado | Contexto fixo no topo + confirmação-com-nome + default BH + não-persistência |
| Quebrar o BH ao parametrizar escrita | BH selecionado = `circuitoId=BH` explícito = idêntico. **Comparador BH antes/depois = 0** + verificação ao vivo |
| Rating global (Modelo B) contamina o BH | Circuito de teste com **atletas DISJUNTOS** (inscrições novas). O teste2 está vazio → seguro |
| `NOVA_TEMPORADA` fora do BH | Já travada no servidor (erro). Limitação conhecida |
| Seletor manda slug/vazio | Sempre o UUID exato; nunca slug |
| EXCLUIR_ATLETA / LISTAR_TELEFONES globais | Já no backlog (Fase B); mitigado por operador único + confirmação-com-nome + atletas disjuntos |
| Reversão | Front via git; seletor default BH; teste2 deletável |

## Ordem de implementação (passos verificáveis)
1. **Passo 1 — mecanismo, sem seletor visível.** `let CIRCUITO_ATIVO` + setter + injeção de `circuitoId` nas duas funções de escrita. Default BH → app idêntico. **Verificar:** comparador BH antes/depois = 0 diff; smoke test anon; app carrega e opera igual.
2. **Passo 2 — seletor UI + reload + faixa "Gerenciando: X".** Testar trocar pro teste2 (vazio) e voltar pro BH; conferir BH intacto.
3. **Passo 3 — confirmação-com-nome nas destrutivas.**

Cada passo: deploy próprio + verificação ao vivo antes do seguinte. Guardião valida o plano e o código real antes de subir.

## Status
Plano escrito. **Aguardando veredito do Guardião** e OK do Juliano antes de codar o Passo 1.
