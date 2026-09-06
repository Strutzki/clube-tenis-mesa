# Regulamento — Sistema B (Pontos Fixos) · RASCUNHO v2 (pós-revisão do Advogado do Atleta)

Base: Sistema A **v03-12** (o do BH, já com R2 = dia 27). O sistema (A/B) trava na criação do circuito.
> Filosofia do B: simples e direto. Vitória vale mais que derrota, **toda partida conta**, não existe rating — só a tabela de pontos da temporada, que zera na virada.

## ⚠️ Correção estrutural (achado do Advogado): NÃO são "9 idênticos"
Auditando o texto real do A, **só 3 capítulos são realmente idênticos**: Cap. 04 (Reputação), Cap. 06 (Regras das Partidas), Cap. 14 (Casos Omissos).
**Precisam de adaptação (citam rating):** Cap. 02, 08, 11, 12, 13 — além dos já reescritos (01, 03, 05, 07, 09).

## 🏆 Torneio de encerramento — REMOVIDO do regulamento do B *(decisão do Juliano)*
Nos novos circuitos, o **torneio dos 8 melhores é opcional, a critério do administrador do circuito** — e **não consta no regulamento** (nem para mencionar que existe). O antigo **Cap. 10 (Torneio de Encerramento) sai** do Sistema B; os capítulos renumeram sem ele ao cabear no app. O **ranking final da temporada é a classificação oficial** do circuito.
> **Decidido:** os novos circuitos **Sistema A também** retiram a menção ao torneio (variante nova do regulamento A; o **BH permanece** com o dele na v03-12, intacto). **Visual do ranking:** manter o **corte dos 8 primeiros** (marcador/linha após a 8ª posição) em **A e B** — é referência visual, independente de o circuito rodar torneio ou não.

---

## Cap. 01 — Ciclo do Ranking *(adaptado)*
Pares mensais: dia 1º publica os dois confrontos do mês. Vitória = 2 pts, derrota = 1 pt. O **ranking é a soma dos pontos** da temporada; não há rating. Zera na virada. Os pontos entram quando o admin processa a rodada.

## Cap. 02 — Elegibilidade *(adaptado — era sobre rating de entrada)*
No B **ninguém tem rating de entrada**: todos começam a temporada em **0 pontos**. Some a distinção federado/não-federado para efeito de pontuação inicial (pode manter só como informação de perfil, se quiser).

## Cap. 03 — Pareamento *(reescrito)*
Método escolhido na criação, para a temporada toda:
- **Sorteio aleatório** a cada rodada, sem repetir adversário na temporada. *(era "equilibrado" — corrigido: a spec diz aleatório, e sem rating não há como "equilibrar".)*
- **Grupos por faixa** de posição na tabela de pontos, sem repetir adversário.
- **Regra dos dois confrontos:** como o par mensal sai no dia 1º, a faixa/pareamento da R2 é fotografado na tabela **do início do mês (antes de processar a R1)** — igual à lógica do A.

## Cap. 05 — Pontuação *(substitui "Rating CBTM")*
Vitória **2** · Derrota **1**. Toda partida jogada conta (nunca anula). Sem rating permanente — só a tabela da temporada, que zera na virada. Pontos entram no processamento da rodada.

## Cap. 07 — W.O., Faltas & Penalidades *(reescrito)*
Herda **todo o procedimento de classificação do A** (foto do local, print da conversa, prazo, decisão do admin) — muda só a consequência em pontos:

| Situação | Ausente | Adversário |
|---|---|---|
| W.O. **injustificado** | 0 | 2 |
| W.O. **justificado e aprovado** | 1 | 2 |
| **Ambos injustificados** *(novo)* | 0 | 0 |
| **Ambos justificados** *(novo)* | 1 | 1 |
| **Partida não registrada no prazo** *(novo)* | sem comprovação → duplo injustificado (0/0); com comprovação, o admin imputa o resultado (Cap. 08) |

- **Suspensão:** 2 W.O. **injustificados** na temporada (justificados NÃO contam) = suspensão; aviso formal no 1º injustificado.
- **Aviso de incentivo:** W.O. justificado dá 1 pt ao ausente (= perder jogando). Por isso o critério de "justificado" é rigoroso — senão vira rota de fuga de derrota.

## Cap. 09 — Ranking & Publicação *(reescrito)*
Soma de pontos, do maior pro menor. Desempate (decisão do Juliano — presença primeiro):
1. Total de pontos → 2. **Menos W.O. injustificados** (premia presença/confiabilidade; já rastreado em `wo_culposos_temporada`) → 3. **Confronto direto** → 4. **% de aproveitamento** (justo com quem jogou menos rodadas) → 5. Saldo de sets/games → 6. **Sorteio registrado pelo admin** (critério final determinístico).
> Nota: com W.O. antes do confronto direto, um atleta pode ter vencido o duelo direto e ainda ficar atrás por ter faltado mais — é a escolha consciente de valorizar presença.
- Remover a "Escalada/Maior Salto" do A (era salto de rating) → redefinir como "melhor sequência de vitórias", ou omitir.
- **Entrante tardio:** começa em 0 pontos; como o ranking-título é por pontos acumulados, ele fica em desvantagem matemática — divulgar isso com transparência (o % de aproveitamento no desempate ameniza).

## Cap. 08, 11, 12, 13 — adaptações pontuais (trocar "rating" por "pontos")
- **Cap. 08 (Registro do Placar):** o box "Validação e Cálculo" fala em "rating" → reescrever mantendo as 2 etapas (confirmar placar → processar pontos), sem rating.
- **Cap. 11 (Como Participar):** "rating de entrada 250 / CBTM-Web" → "entra em 0 pontos".
- **Cap. 12 (Valor & Desistência):** penalidade de abandono era "−30 rating" → no B, **bloqueio de 1 temporada** (não há rating a debitar).
- **Cap. 13 (Calendário):** remover "Rating divulgado" da timeline; confirmar R2 = **dia 27**; nº de etapas é **configurável** por circuito (não fixo em 3).

## Bye (nº ímpar) *(decidido)*
Quem fica de fora ganha **1 ponto de participação** + **rotação obrigatória** (ninguém recebe 2º bye antes de todos terem recebido um) — evita "farmar" bye no sorteio.

---

## ✅ Decisões batidas pelo Juliano (todas)
1. **Desempate:** pontos → menos W.O. injustificados → confronto direto → % aproveitamento → saldo de sets → sorteio.
2. **Bye:** 1 ponto de participação + rotação obrigatória.
3. **Abandono (Cap. 12):** bloqueio de 1 temporada (equivalente ao "−30 rating" do A).
4. **Suspensão:** 2 W.O. injustificados na temporada + aviso formal no 1º.
5. **Torneio de encerramento:** removido do regulamento em **novos circuitos A e B** (opcional, critério do admin); o **BH mantém** o seu (v03-12). O **corte visual dos 8 primeiros** no ranking **permanece em A e B**.

## 🔍 Revisão final (2ª passada) — checado
- Sem menção a torneio/"8 melhores/qualificados" em nenhum capítulo. ✅
- `% de aproveitamento` = vitórias ÷ partidas jogadas (desempate justo com quem jogou menos rodadas).
- W.O.: tabela cobre um ausente, ambos ausentes e partida não registrada; procedimento de classificação herdado do A. ✅
- Nenhum "rating" residual no texto final do B (as menções restantes estão só nas notas de "o que trocar" dos Caps. 08/11/12/13). ✅
- Entrante tardio e farm de bye tratados. ✅

**Status:** conteúdo fechado como base do **`vB-01`**. Próximo passo (sessão futura): cabear no app — `RegulamentoView` ramificada pelo `sistema` do circuito — junto do motor de pontos do Sistema B.
