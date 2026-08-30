# Motor do Sistema B — plano de design

**Objetivo:** um circuito Sistema B (pontos fixos) roda de verdade — pareia, pontua e ranqueia por pontos. **Prioridade absoluta: footprint-zero pro BH.** Tudo ramifica em `sistema === 'B'`; o caminho do Sistema A (BH) fica **byte-idêntico**.

## Onde o motor vive
Servidor autoritativo = `admin-action` (edge). Peças que mudam:
- `INICIAR_ETAPA` / `AVANCAR_RODADA` → pareamento (`gerarPareamentoPorRating`).
- `PROCESSAR_RODADA` → cálculo (hoje `calcElo` + `saldo_temp`).
- `cmpRankingDB` → ordenação do ranking.
- `APLICAR_WO` / `RESPONDER_WO` → tratamento de W.O.
- (O reducer do front espelha parte disso de forma otimista — ver "Fatia 6".)

## Reuso do modelo de dados (sem coluna nova)
- **`saldo_temp` = pontos acumulados no B** (V=2, D=1). O ranking já ordena por `saldo_temp` — serve pros dois; só muda COMO ele é somado.
- **`rating`** = inerte no B (fica no valor de entrada; não é exibido).
- **`vitorias`/`derrotas`** = contadas (pro % de aproveitamento).
- **`wo_culposos_temporada`** = W.O. injustificados (desempate + suspensão).
- **Saldo de sets** = soma de `placar1`/`placar2` das partidas do atleta (sets vencidos − perdidos).

## Ramificações (todas gated em `sistema === 'B'`)

### 1. Config
`getCfg(circuitoId, "sistema,pareamento, …")` — carregar `sistema` e `pareamento` nas ações que precisam.

### 2. Pareamento — `gerarPareamentoB(athletes, matchesTemporada, pareamento, byeHistory)`
- **Sorteio aleatório:** embaralha; pareia sem repetir adversário (mesma trava anti-repetição do A, sem custo de rating).
- **Grupos por faixa:** ordena pela tabela de pontos (`saldo_temp`) e pareia posições próximas, sem repetir.
- **Bye (nº ímpar):** 1 atleta de fora, com **rotação** — preferir quem ainda não teve bye (histórico derivado das rodadas passadas: quem não aparece em nenhuma partida da rodada teve bye).
- Gera o par mensal (2 rodadas), igual ao A.

### 3. Pontuação — `PROCESSAR_RODADA`
- `if sistema B`: vencedor `saldo_temp += 2`, `vitorias++`; perdedor `saldo_temp += 1`, `derrotas++`. **Sem** mexer em `rating`/`rating_pico`/`rating_historico`.
- **Bye:** o atleta de fora ganha **+1** (`saldo_temp += 1`) no processamento da rodada.
- Snapshot de posição usa o comparador do B (abaixo).

### 4. Ranking — `cmpRankingB`
Ordem: (1) `saldo_temp` (pontos) → (2) **menos** `wo_culposos_temporada` → (3) confronto direto → (4) % aproveitamento (`vitorias/(vitorias+derrotas)`) → (5) saldo de sets → (6) determinístico (id, como fallback estável).

### 5. W.O. no B (mais delicado — o fluxo muda)
No A, W.O. justificado **anula** (rejeita a partida). No B, **sempre conta**:
- injustificado: ausente 0, adversário 2 · justificado: ausente 1, adversário 2 · ambos: 0/0 ou 1/1.
- Isso muda `APLICAR_WO`/`RESPONDER_WO` (justificado no B **não** rejeita) e o cálculo no `PROCESSAR_RODADA`.

## Footprint-zero (prova)
`sistema` do BH = 'A' → toda ramificação `if (B)` é ignorada → `calcElo`, `gerarPareamentoPorRating`, `cmpRankingDB` e o fluxo de W.O. rodam idênticos. Verificação: comparador de hash das tabelas do BH antes/depois + processar uma rodada de teste no BH em branch (não em produção).

## Fatias (ordem sugerida, cada uma verificada)
1. **Config + `cmpRankingB`** (prep, baixo risco; ninguém B ainda usa).
2. **Pontuação normal** (V=2/D=1) no `PROCESSAR_RODADA` — o núcleo.
3. **Pareamento** (sorteio primeiro; grupos depois) + rotação de bye.
4. **Bye +1 ponto** no processamento.
5. **W.O. no B** (mapa de pontos + justificado que não anula).
6. **Espelho no reducer do front** (estado otimista correto pro B) — ou aceitar recarregar do servidor após cada ação no B.

## Questões abertas (decidir no caminho)
- **Bye:** derivar histórico das rodadas (sem coluna) — confirmar que dá pra reconstruir de forma confiável.
- **Grupos por faixa:** com nº ímpar, quem leva o bye? (sugiro o último da tabela **respeitando a rotação**).
- **Teste:** precisa de um **circuito B com atletas DISJUNTOS do BH** (condição dura do Guardião — rating/identidade global). Criar um circuito B de teste com inscrições novas.
- **Front mirror:** decidir se replicamos a lógica no reducer (arriscado, duplicado) ou se, no B, o front só recarrega do servidor após cada ação (mais simples e seguro).

## ✅ Decisões aprovadas pelo Juliano
- **Espelho no front:** NÃO duplicar o motor no reducer. Nos circuitos B, o app **recarrega do servidor** após cada ação de admin (o servidor é a verdade). Mais simples e seguro.
- **Circuito de teste:** criar um **circuito B de teste com atletas NOVOS, disjuntos do BH** (condição dura do Guardião — identidade/rating global). Não reusar o `teste2` (que é Sistema A) nem os 15 atletas do BH.

## Progresso
- **Fatia 1 (fundação) — FEITA no arquivo local:** `getSistema` (fail-closed no erro), guard no `writeAtleta` (B nunca escreve rating), `cmpRankingB` + helpers.
- **Fatia 2 (pontuação) — FEITA no arquivo local:** ramo B no `PROCESSAR_RODADA` (+2/+1, sem rating, ranking por `cmpRankingB`, W.O. do B não consumido). **Guardião revisou o código real: BH byte-idêntico confirmado.**
- **Fatia 3 (pareamento) — FEITA no arquivo local:** `embaralhar` + `parearRodadaB` (backtracking, custo = só repetição + distância de posição no modo grupos) + `gerarPareamentoB` (par mensal, rotação de bye derivada das rodadas). `INICIAR_ETAPA`/`AVANCAR_RODADA` ramificados. BH cai em `gerarPareamentoPorRating` idêntico (getSistema→'A' sem query; getCfg do pareamento só no B). Sintaxe balanceada.
- **Bye:** no pareamento o atleta de fora é corretamente excluído das partidas; o **+1 ponto do bye ainda NÃO entra** (é a Fatia 4).
- **Fatia 4 (bye +1) — FEITA:** no `PROCESSAR_RODADA` do B, o atleta de fora ganha +1 (participação), idempotente por rodada (só na 1ª passada) com trava dupla (nº ímpar E exatamente 1 fora) p/ não premiar entrante tardio; entra ranqueado.
- **W.O. no B bloqueado até a Fatia 5:** `APLICAR_WO`/`RESPONDER_WO` recusam em circuito B ("em breve"); e o W.O. do B não é consumido no PROCESSAR.
- **✅ DEPLOYADO — admin-action v44 (ACTIVE).** Verificado: BH data hash inalterado (`256a774c50ce2a86ced1b7c94f2ba5ce`); marcadores B presentes e marcadores do BH (CBTM, gerarPareamentoPorRating) intactos. BH byte-idêntico.

## Falta
- **Fatia 5:** W.O. no Sistema B (mapa de pontos, justificado que não anula) — hoje bloqueado.
- **Fatia 6 (núcleo) — FEITA no front (não deployada):** o caminho de escrita já recarregava do servidor (INICIAR/AVANCAR/PROCESSAR/WO/validar → `loadFromSupabase`). Faltava a EXIBIÇÃO: `cmpRanking` agora ramifica pelo `SISTEMA_ATIVO` (setado no load) — desempate B (menos WO → h2h → % aproveitamento → saldo de sets → id); BH ('A') byte-idêntico. Testado (front 4/4). **Polimento cosmético pendente:** esconder coluna/gráfico de rating e rotular "Pontos" nas telas quando sistema B (não quebra, só estética).
- **Teste ponta a ponta:** criar circuito B com atletas NOVOS (disjuntos do BH), iniciar etapa, lançar placares, processar — conferir pontos/ranking/bye.
- Cabear os regulamentos (`RegulamentoView` por `sistema`/versão).

## Status / retomada
Plano escrito e aprovado. **Próximo passo ao retomar:** (1) Guardião revisa o plano (foco BH intacto); (2) implementar a **Fatia 1** (carregar `sistema`/`pareamento` na config + o comparador `cmpRankingB`), com verificação de 0-diff no BH; depois Fatia 2 (pontuação V=2/D=1).
