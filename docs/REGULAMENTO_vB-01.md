# Regulamento — Sistema B (Pontos Fixos) — versão `vB-01`

> ⚠️ **Este arquivo é GERADO** por `scripts/gerar-regulamento.mjs` a partir do
> texto que o app exibe. **Não edite à mão** — edite o texto no app e rode o
> gerador. A bateria de testes recusa um arquivo que tenha divergido da tela.

Circuito de **pontos fixos**: vitória vale 2, derrota vale 1, folga (bye) vale 1. Não há rating — o ranking é a soma dos pontos da temporada, que zera na virada. **Não há torneio de encerramento nem certificado**: a temporada termina na tabela de pontos.

Este documento reproduz o texto que o atleta lê e aceita ao se inscrever num
circuito que declara a versão `vB-01`.

---

## Cap. 01 — Como Funciona: O Ciclo do Ranking

Este circuito funciona em **pares mensais de rodadas**. No dia 1º de cada mês são publicados os **dois confrontos do mês**. Vitória vale **2 pontos**, derrota vale **1 ponto** — toda partida jogada conta.

O **ranking é a soma dos pontos** da temporada. Não há rating: o que vale é a tabela de pontos, que **zera na virada da temporada**. Os pontos entram quando o administrador processa a rodada.

| Etapa | 1ª Rodada | 2ª Rodada |
|---|---|---|
| Janela para jogar e registrar | Dias 1 a 15 | Dias 1 a 27 |
| Conferência do admin | Dias 16 a 19 | Dias 28 a 29 |
| Ranking divulgado | Dia 20 | Último dia do mês |

## Cap. 02 — Elegibilidade — Quem Pode Participar

Todos os inscritos começam a temporada em **0 pontos** — não existe rating de entrada. A distinção entre federado e não-federado é apenas informativa no perfil e não altera a pontuação.

Quem entra com a temporada já em andamento também começa em 0 pontos — como o título é por pontos acumulados, há uma desvantagem matemática; o % de aproveitamento no desempate ajuda a equilibrar.

## Cap. 03 — Sistema de Pareamento

O método de pareamento é escolhido na criação do circuito e vale para a temporada toda:

- Sorteio aleatório: a ordem do rodízio é sorteada no início de cada temporada, e a partir dela todos os confrontos são montados de uma vez — sem repetir adversário na temporada.
- Grupos por faixa: o pareamento segue a posição na tabela de pontos (níveis próximos) e é refeito a cada rodada, evitando repetir adversário.

No **sorteio**, a única situação em que um confronto pode se repetir é se o número de atletas mudar no meio da temporada, porque aí o rodízio precisa ser refeito com quem está ativo. Nos **grupos por faixa** é diferente: como o pareamento acompanha a tabela de pontos, ele é montado rodada a rodada e não consegue olhar as seguintes — a repetição é rara, mas possível mesmo com o grupo completo (medido em 8 atletas: cerca de 1 temporada em 11, com um confronto repetido).

### 🎟️ Bye (número ímpar de atletas)

Quando o número de atletas é ímpar, um atleta fica de fora na rodada (bye) e ganha **1 ponto de participação**. O bye tem **rotação**: ninguém recebe um segundo bye antes de todos terem recebido um. Quem entra com a temporada já em andamento é o último da fila do bye.

Os dois confrontos do mês são fotografados no início do mês (antes de processar a 1ª rodada), então a faixa da 2ª rodada usa a tabela do começo do mês.

## Cap. 04 — Reputação & Comprovação

Para dar confiança aos resultados, o Circuito adota um sistema simples de **reputação por comprovação fotográfica** — totalmente opcional, mas recomendado. Uma foto do placar/local ajuda a resolver eventuais divergências.

## Cap. 05 — Pontuação — Como se Ganham Pontos

### 🎯 Pontuação

- Vitória: 2 pontos
- Derrota: 1 ponto (perder jogando ainda pontua)
- Bye: 1 ponto de participação

Não há rating permanente — só a tabela de pontos da temporada, que zera na virada. Os pontos entram no processamento da rodada pelo administrador.

## Cap. 06 — Regras das Partidas

As partidas seguem as regras oficiais do tênis de mesa: melhor de **5 sets** (quem faz 3 primeiro), cada set até **11 pontos** com 2 de diferença. Combine local e horário com o adversário dentro da janela da rodada.

## Cap. 07 — W.O., Faltas & Penalidades

O procedimento de classificação do W.O. é o mesmo do Circuito (foto do local, print da conversa, prazo, decisão do admin). Muda só a consequência em pontos:

| Situação | Ausente | Adversário |
|---|---|---|
| W.O. injustificado | 0 | 2 |
| W.O. justificado e aprovado | 1 | 2 |
| Ambos injustificados | 0 | 0 |
| Ambos justificados | 1 | 1 |

### ⛔ Suspensão

2 W.O. **injustificados** na temporada levam à suspensão (justificados não contam). Há aviso formal no 1º injustificado.

Partida não registrada no prazo: sem comprovação vira duplo injustificado (0/0); com comprovação, o admin imputa o resultado.

### 🛠️ Em implementação

O tratamento automático de W.O. no app está sendo finalizado. Até lá, o administrador aplica as regras acima **manualmente**.

## Cap. 08 — Registro do Placar

Os **dois atletas registram o placar** no app. Se coincidirem, o resultado é confirmado; se divergirem, o administrador decide. Os pontos entram quando o admin **processa a rodada** — registrar e computar são etapas separadas (transparência).

## Cap. 09 — Ranking, Desempate & Publicação

O ranking é a **soma dos pontos**, do maior para o menor. Em caso de empate, o desempate segue esta ordem:

| Ordem | Critério de desempate |
|---|---|
| 1º | Total de pontos |
| 2º | Menos W.O. injustificados (premia presença) |
| 3º | Confronto direto |
| 4º | % de aproveitamento (vitórias ÷ jogos) |
| 5º | Saldo de sets |
| 6º | Decisão do administrador, registrada (Cap. 13) |

Como o W.O. injustificado vem antes do confronto direto, um atleta pode ter vencido o duelo direto e ainda ficar atrás por ter faltado mais — é a escolha consciente de valorizar a presença.

## Cap. 10 — Como Participar

A inscrição é feita pelo próprio app. O atleta entra em **0 pontos** e, depois de aprovado pelo administrador, entra na fila para ser pareado nas rodadas.

**O circuito tem um teto de 20 atletas por temporada** — regra da plataforma, igual para todos. Se estiver cheio, a inscrição aprovada fica em **fila de espera** e entra quando abrir vaga: aprovação não é o mesmo que vaga garantida.

**Não há entrada nas duas últimas rodadas** da temporada. Quem for aprovado nesse período estreia na temporada seguinte, e aí desde a primeira rodada.

A temporada só começa com **no mínimo 8 atletas** ativos. Com menos que isso, o início é adiado — o administrador pode prorrogar as inscrições ou esperar. Mas se, **durante** a temporada, o número de ativos cair abaixo de 8, a temporada **continua normalmente** com quem ficou: a queda não interrompe o circuito.

## Cap. 11 — Valor da Temporada, Pagamento & Desistência

Quando o circuito tem valor de temporada, ele é informado na inscrição/renovação. **Abandono** durante a temporada leva a **bloqueio de 1 temporada** (não há rating a debitar).

O pagamento é **confirmado pelo administrador**. Enquanto não confirmado, o atleta **não é incluído nos confrontos** da rodada — nem na entrada, nem nas rodadas seguintes. É um valor único por temporada, sem cobrança mensal nem parcelamento.

## Cap. 12 — Estrutura das Rodadas & Calendário

Cada temporada tem **3 meses** e **2 jogos por mês** — ou seja, **6 rodadas**, organizadas em 3 etapas de duas rodadas. Esse número é fixo: não muda de circuito para circuito nem de temporada para temporada.

No dia 1º de cada mês saem os dois confrontos do mês. A 1ª rodada vai até o **dia 15**; a 2ª, até o **dia 27**. Os meses de recesso são definidos pelo organizador do circuito.

## Cap. 13 — Casos Omissos

Situações não previstas são resolvidas pelo administrador do circuito, com bom senso e em favor da integridade da competição. A decisão do administrador em casos omissos é final e pode motivar uma nova regra em versão futura.

É também aqui que entra o **empate absoluto** no ranking: se dois atletas ficarem iguais nos cinco critérios do Cap. 09 — pontos, W.O., confronto direto, aproveitamento e saldo de sets —, a posição é decidida pelo administrador e o critério usado é **informado aos envolvidos**. Enquanto isso não acontecer, a lista é ordenada de forma estável, sempre do mesmo jeito.

