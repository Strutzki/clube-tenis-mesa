# Sub-admin (organizador) — acesso hoje × proposta

Comparativo pra você decidir antes de mexer. Foco (escolha do Juliano): **simplificar as telas** e **rede de "voltar atrás"**. Permissões ficam como estão por ora (não vamos enxugar agora). Estado: 07/09/2026. Nada implementado — é só o quadro.

Lembrete: tudo do organizador já é **escopado só ao circuito dele** (nunca toca o BH nem outro circuito). Isso não muda.

---

## Parte 1 — Telas (simplificar)

O organizador vê hoje as **mesmas 8 abas** do super-admin. No dia a dia dele, boa parte é ruído.

| Aba | Pra que serve | Ele usa? | Proposta |
|---|---|---|---|
| 🏠 Início | Despachos do dia + visão geral | Sim (é o começo do dia) | **Manter e virar a "casa" dele** — abre já no Despachos (o que precisa de ação), sem os cards de dono (criar circuito, etc., já escondidos). |
| 📝 Inscr. | Aprovar/incluir inscrições | Sim | **Manter.** |
| 🏓 Etapa | Gerar/avançar rodada | Às vezes | **Manter, mas com trava** (é onde estão as ações sem volta — ver Parte 2). |
| 🏆 Ranking | Ver o ranking | Consulta | **Manter.** |
| ⚠️ Pend. | Validar placar, processar, W.O. | Sim | **Manter** (é o núcleo do trabalho). |
| 📋 Hist. | Consultar histórico | Raramente | **Manter** (consulta, inofensivo). |
| 💬 Msgs | Disparar mensagens | Sim | **Manter.** |
| 💰 $ (Financeiro) | Registrar/estornar pagamento | Depende de quem cuida do dinheiro | **Decisão sua:** se **você** cuida do dinheiro do circuito vendido (via split, no futuro), **esconde** essa aba do organizador; se o organizador cobra e concilia, **mantém**. |

**Simplificações propostas (sem tirar poder, só reduzir ruído):**
1. **Início vira o painel do organizador:** título "Você organiza [circuito]", Despachos do dia aberto, e só. Sem os cards de super-admin (já ocultos).
2. **Rótulos mais diretos** nas abas pro organizador (ex.: "Pend." → "A fazer").
3. **Esconder a aba $** pra organizador quando o dinheiro for da plataforma (decisão sua acima).
4. **Unificar o caminho do dia** pelo Despachos (já leva pra tela certa) — o organizador quase não precisa navegar sozinho.

> Nenhuma dessas mexe em permissão de servidor — é só o que ele **vê**. Footprint-zero pro BH.

---

## Parte 2 — "Voltar atrás" (rede de segurança do organizador)

| Ação do organizador | Tem volta hoje? | Proposta |
|---|---|---|
| Validar placar | ✅ **Desfazer** (até processar a rodada) | Manter. |
| Rejeitar placar | ✅ reversível (valida de novo) | Manter. |
| Registrar pagamento | ✅ **Estornar** | Manter. |
| Arquivar atleta | ✅ reversível (reativar) | Confirmar que o botão de reativar aparece pro organizador. |
| Configs (inscrições, público, auto-validar…) | ✅ é só religar | Manter. |
| Aprovar/recusar inscrição | ✅ em geral reversível | Manter. |
| **Processar rodada** | ❌ **SEM volta** (calcula pontos/rating) | **Ponto crítico.** Hoje tem confirmação, mas não dá pra desfazer. Opções abaixo. |
| **Gerar/avançar confrontos** | ❌ sem desfazer explícito | Confirmação + permitir "refazer sorteio" **enquanto ninguém lançou placar**. |
| Excluir atleta | parcial (some do circuito; identidade nacional fica) | **Confirmação-com-nome** (digitar o nome) também pro organizador. |

**O ponto que mais dói: "processar rodada" não tem desfazer.** Três níveis possíveis (do mais leve ao mais completo):

- **A) Confirmação reforçada (leve, rápido):** antes de processar, um resumo claro ("vou calcular a rodada N: X partidas, isso mexe no ranking e **não dá pra desfazer**") + confirmar. Já existe algo; a proposta é deixar mais explícito e à prova de toque acidental.
- **B) Janela de desfazer curta (médio):** logo após processar, um botão "↩️ Desfazer processamento" por alguns minutos, que reverte o cálculo daquela rodada (recoloca as partidas como validadas-não-calculadas e zera o efeito no ranking). Cobre o erro humano na hora.
- **C) Desfazer sempre (completo, mais trabalho):** poder desfazer o processamento de uma rodada a qualquer momento antes da virada, recalculando o ranking do zero. Mais robusto, porém mais código e testes.

**Recomendação:** **A + B** — confirmação forte + janela de desfazer logo após. Cobre o caso real (organizador processou sem querer / errou a rodada) sem a complexidade do C. O super-admin (você) continua com a rede completa e pode intervir.

---

## Decisões do Juliano (07/09/2026)
1. **Aba financeiro:** **depende do circuito** — o super-admin liga/desliga a aba financeiro do organizador por circuito.
2. **"Voltar atrás" do processar:** **C — desfazer sempre** (poder desfazer o processamento de qualquer rodada até a virada, recalculando o ranking).
3. **Rótulos das abas:** **sim, simplificar** no modo organizador.

## Validação item a item — RESULTADO (07/09/2026)
Revisado com o Juliano, uma a uma. Aplicado na fonte do `admin-action` (allowlist `ACOES_ORG`); **inerte hoje** (não há organizador em produção), deploya junto com o 1º circuito vendido.

| # | Ação | Decisão |
|---|---|---|
| 1 | Excluir atleta | 🔒 **Tirado** (só super-admin) |
| 2 | Nº de rodadas | ✅ já fixo em **6** (nada a fazer) |
| 3 | Abrir/cancelar próxima temporada | 🔒 **Tirado** (só super-admin) |
| 4 | Config financeira (valor/Pix) | 💰 **depende do financeiro por circuito** |
| 5 | Desconto do atleta | ✅ **Mantido** (regra: taxa da plataforma é por atleta inscrito, independe do desconto — ver PLANO_PAGAMENTOS) |
| 6 | Pagamentos (registrar/estornar/editar/listar) | 💰 **depende do financeiro por circuito** |
| 7 | Público/privado | ✅ **Mantido** |
| 8 | Config geral (nome/datas) | ✅ **Mantido** |

Também mantidos (operacional): iniciar etapa, avançar/processar rodada, validar/rejeitar/imputar/desfazer placar, W.O., aprovar/incluir/recusar inscrição, arquivar atleta, auto-validação, inscrições abertas, mensagens.

**Feito na fonte:** removidos de `ACOES_ORG` → `EXCLUIR_ATLETA`, `ABRIR_PROXIMA_TEMPORADA`, `CANCELAR_PROXIMA` (e `DEFINIR_RODADAS`, que já era ação bloqueada). Os itens 4 e 6 (financeiro) seguem na lista por ora e viram **condicionais ao flag** na Fatia 2 abaixo.

## Plano de fatias (footprint-zero, revisão dos Guardiões)
- **Fatia 1 — Rótulos (front). ✅ EM ANDAMENTO.** Nomes mais diretos no modo organizador.
- **Fatia 2 — Financeiro por circuito.** Coluna `circuitos.org_ve_financeiro` (default OFF) + toggle do super-admin + `LOGIN_ORGANIZADOR` devolve o flag + front esconde a aba $ pro organizador quando OFF.
- **Fatia 3 — Desfazer processamento (C).** A mais sensível (mexe em pontos/rating). Ação `DESFAZER_PROCESSAMENTO(round)` que reverte o cálculo da rodada e **recalcula do zero** as rodadas afetadas, em ordem. **Risco:** o rating (Sistema A) depende da ordem/rating-do-momento — precisa reproduzir exatamente. Por isso vai com **harness** provando que recompor dá o mesmo resultado, e teste ao vivo num circuito descartável, BH byte-idêntico. Confirmação forte + escopado ao circuito do organizador (nunca o BH).
