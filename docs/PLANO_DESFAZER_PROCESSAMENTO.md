# Desfazer processamento de rodada (C) — design + prova (Guardião)

Estado: 07/09/2026. Rede de "voltar atrás" da rodada, pedida na revisão do organizador. É sensível (mexe em pontos/rating), então o design vem **provado** antes de tocar produção.

## Estratégia
Desfazer o processamento de uma rodada = **recalcular a temporada do zero** a partir do estado de início: reseta cada atleta ao rating/estado de início de temporada, marca as partidas das rodadas ≥ alvo como não-calculadas, e **reprocessa as rodadas anteriores em ordem** usando exatamente o mesmo cálculo. O resultado é idêntico a "como se a rodada nunca tivesse sido processada".

- **Sistema B (pontos fixos):** trivial e exato (pontos não dependem de ordem).
- **Sistema A (rating):** o rating depende da ordem/rating-do-momento; por isso NÃO dá pra reverter uma partida isolada — só recalcular. Como o `calcElo` é **tabela inteira determinística** (sem float), o recálculo reproduz bit a bit.

## Prova (harness) — ✅ 240/240
`harnesses/desfazer-processamento.harness.mjs`: 20 cenários × 6 rodadas × 2 sistemas. Para cada rodada J, "reset + reprocessa 1..J-1" bate **exatamente** (rating, saldo, vitórias/derrotas, pico, histórico) com o estado capturado antes de J ter sido processado. 0 divergência.

## Travas que o Guardião exige (condições da reprodução exata)
1. **Snapshot de início de temporada:** guardar o rating de cada participante quando a etapa começa (saldo/vitórias/derrotas já nascem 0). Sem snapshot, não há como recompor o rating do Sistema A.
2. **Determinismo do timestamp:** o `rating_historico` carimba `admin_aprovado_em` da partida (determinístico) — o recálculo **reusa** esse mesmo carimbo, **nunca** `new Date()`. (O `PROCESSAR_RODADA` já usa `admin_aprovado_em || new Date()`; garantir que, nas partidas processáveis, `admin_aprovado_em` está setado — está, pela validação.)
3. **Mesma ordem:** reprocessar as partidas por `admin_aprovado_em` asc (igual ao processamento original).
4. **Escopo por circuito:** a ação opera só no circuito do organizador; nunca toca o BH nem outro (padrão do projeto). `vitorias_total`/`derrotas_total` (acumulados entre temporadas) NÃO são tocados — só os campos sazonais.

## Caveat importante (decisão)
O snapshot só passa a existir para **temporadas iniciadas depois** desta feature. A **temporada ATUAL do BH** (já em andamento, rodada 6/6) **não tem** ponto de restauração — então o "desfazer" não ficaria disponível para ela (a menos que a gente reconstrua o rating de início do histórico, o que é frágil e eu não recomendo). Circuitos vendidos (organizadores) começam do zero já com o snapshot, então terão o desfazer normalmente.

## Fatias de implementação (footprint-zero, revisão do Guardião)
1. **Snapshot (inerte):** no `INICIAR_ETAPA`, gravar `rating_inicio_temporada` por participante (coluna nova). Não muda nada operacional.
2. **Ação `DESFAZER_PROCESSAMENTO(round)`:** recompõe (reset ao snapshot + reprocessa 1..round-1), escopada por circuito; recusa se a temporada não tem snapshot. Reusa o mesmo motor de cálculo.
3. **Front:** botão "↩️ Desfazer processamento da rodada N" (confirmação forte) na tela de Pendências, pro organizador e super-admin.
4. **Teste ao vivo** num circuito descartável (A e B), provando reprodução exata e BH byte-idêntico; veredito do Guardião registrado.
