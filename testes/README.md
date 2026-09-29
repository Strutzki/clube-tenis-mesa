# A bateria de testes

```bash
npm run teste
```

Hoje são 813 asserções (28/09/2026). O `atualizar.sh` roda isso antes de publicar e se
recusa a subir com teste vermelho. Confira rodando; não cite de memória.

## O que ela testa — e por que isso é diferente do que havia antes

A bateria **carrega e executa as Edge Functions de verdade**: os mesmos arquivos
que o `npm run motor:publicar` sobe. Hoje são quatro — `admin-action` (o grosso),
`athlete-action`, `comprovante-url` e `login-atleta` — e `montarMotor({ funcao: "..." })` escolhe
qual. Não há cópia da lógica dentro do teste.

Isso importa porque o harness anterior
(`harnesses/desfazer-processamento.harness.mjs`) faz o contrário: ele reescreve
a lógica do motor dentro dele mesmo — inclusive com uma tabela de rating
inventada, diferente da tabela real da CBTM. Um teste assim **continua verde
mesmo se o motor quebrar**. Ele prova que a ideia do recálculo é reversível, o
que é útil; não prova nada sobre o código que está no ar.

| Arquivo | Cobre |
|---|---|
| `rating.mjs` | Sistema A: tabela da CBTM (favorito, zebra, fronteiras de faixa), rating de pico, histórico, W.O. +8/-15, o que o motor se recusa a processar |
| `sistema-b.mjs` | Sistema B: pontos V=2/D=1, W.O. que não anula, bye do ímpar, e a garantia de que um circuito de pontos **nunca** escreve rating |
| `isolamento.mjs` | Operar um circuito não toca em outro; escopo do organizador; exclusão global × por circuito; virada de temporada; freio do PIN |
| `permissoes.mjs` | A allowlist do organizador, o portão do financeiro, e o escopo por circuito do `LISTAR_TELEFONES` (inclusive: a ação devolve só `id` e `telefone`) |
| `participar-outro-circuito.mjs` | Atleta existente entrando num 2º circuito (`PARTICIPAR` do `login-atleta`, rodando de verdade): aceite do regulamento declarado, versão conferida contra a do circuito, e responsável legal obrigatório para menor de 18 |
| `onda-06.mjs` | Onda 0.6: desarquivar (e a prova de que o desarquivado volta a ser pareado), as duas guardas de LGPD, a recusa do BH na leitura da cobrança, e o comprovante de W.O. do organizador — este roda a função `comprovante-url` |
| `mensagens.mjs` | Registro de mensagens enviadas: o motor não pode responder "sucesso" com a gravação falhando |
| `contador-mensagens.mjs` | O contador de pendentes e os textos da barra de aviso do admin (checagem por regex no fonte do app) |
| `erros-na-tela.mjs` | Que o app não esconde erro do servidor atrás de um dispatch otimista |
| `nomes-que-nao-existem.mjs` | Que nenhum teste chame função que não existe |
| `regulamento-por-circuito.mjs` | Versão de regulamento por circuito, carimbo e re-aceite (a maior seção da bateria) |
| `pacote.mjs` | O que está no pacote publicado |
| `ferramentas.mjs` | Asserções e o cenário de partida (atletas, partidas, circuitos com defaults reais) |
| `carrega-motor.mjs` | Carrega a Edge Function real no Node |
| `banco-falso.mjs` | Um Supabase em memória que imita o PostgREST |
| `cliente-falso.mjs` | Fica no lugar do `@supabase/supabase-js` durante os testes |

## Como o motor roda fora do Supabase

O `carrega-motor.mjs` resolve três coisas e não toca em mais nada do arquivo:

1. o import vem de uma URL (`esm.sh`) → aponta para o banco de mentira;
2. `Deno.env.get(...)` → responde com valores de teste;
3. `Deno.serve(handler)` → em vez de subir servidor, guarda o handler.

O Node 22.6+ apaga os tipos do TypeScript sozinho, então o arquivo roda como
está. Se o import do Supabase mudar de forma no motor, o carregador para com
erro claro em vez de testar a coisa errada.

## Todo teste novo nasce com teste de mutação

Escreveu asserção nova? Sabote a linha do motor que ela protege e exija que a
bateria **fique vermelha**. Se continuar verde, a asserção não está testando o
que você acha que está.

As mutações já verificadas nesta bateria.

⚠️ **Com que régua cada linha foi medida.** As linhas **anteriores a 28/09/2026** foram
aferidas por um instrumento defeituoso: ele só classificava como *vermelho* quando havia
falha impressa **e** saída ≠ 0. Sabotagem que **quebra o arquivo de teste** antes de
imprimir qualquer falha era classificada como **verde** — falso conforto exatamente no
caso pior. As linhas que falham **por asserção** continuam válidas; as que poderiam
**derrubar** o arquivo (referência a símbolo inexistente, erro de sintaxe, exceção não
capturada) podem ter sido falsos verdes e não foram refeitas. Não cite uma linha antiga
como prova sem saber disto. Da linha de **28/09/2026** em diante, a régua é: **saída ≠ 0
é vermelho, qualquer que seja a causa.**

| Sabotagem na função | Resultado |
|---|---|
| `benef.rating + 8` → `+ 7` | 2 asserções vermelhas |
| tabela CBTM `{max:24, v:10}` → `v:11` | 5 vermelhas |
| tirar o `.eq("validado", true)` do processamento | 8 vermelhas |
| `falt.rating - 15` → `- 0` | 1 vermelha |
| tirar o `.eq("circuito_id", ...)` ao processar rodada | 3 vermelhas |
| exclusão em circuito não-BH apagando `atletas` | 2 vermelhas |
| tirar a checagem `ehOrganizadorDe` | 3 vermelhas |
| freio de tentativas de PIN nunca disparar | 1 vermelha |
| **Onda 0.6 — 27/09/2026 (16 sabotagens, 16 vermelhas)** | |
| `select("id, telefone")` → `select("*")` em `LISTAR_TELEFONES` | 1 vermelha — **e esta ficava VERDE até o banco falso projetar colunas**; devolvia `pin_hash` e `isento` de todo atleta do circuito |
| `status: "ativo"` → `"ativo_backlog"` no `DESARQUIVAR_ATLETA` | 6 vermelhas — 4 delas comportamentais (o atleta não é promovido, não recebe chave, não é pareado), que pegariam o defeito mesmo se alguém "consertasse" a asserção do valor |
| `DESARQUIVAR` entrando direto no circuito (`pendente_circuito: false`) | 2 vermelhas |
| `LISTAR_TELEFONES` sem o `.in("id", idsTel)` | 3 vermelhas |
| `LISTAR_TELEFONES` sem o ramo do BH (regra 2) | 1 vermelha |
| `LISTAR_TELEFONES` fora da `ACOES_ORG` | 3 vermelhas |
| `DESARQUIVAR` sem a guarda "está arquivado?" | 1 vermelha |
| `DESARQUIVAR` sem a guarda do pedido de exclusão (LGPD) | 2 vermelhas |
| `DESARQUIVAR` sem a guarda do cadastro anonimizado (LGPD) | 1 vermelha |
| `DESARQUIVAR` fora do `ORG_MEMBRO_FIELD` | 1 vermelha |
| `LER_COBRANCA_PLATAFORMA` voltando a aceitar o BH | 1 vermelha |
| `comprovante-url` sem o escopo por recurso | 2 vermelhas, incluindo "nada é assinado" |
| `comprovante-url` sem conferir o vínculo de organizador | 2 vermelhas |
| `comprovante-url` assinando caminho diferente do pedido | 1 vermelha |
| `NOMEAR_ORGANIZADOR`/`REMOVER_ORGANIZADOR` concedidas ao organizador | 2 vermelhas — e revelou que `REMOVER_ORGANIZADOR` responderia **200**: um organizador removeria outro |
| **Participar de outro circuito — 27/09/2026 (15 sabotagens, 15 vermelhas)** | |
| `idade < 18` → `idade < 17` (a FRONTEIRA) | 2 vermelhas — ficava **verde** antes: os cenários eram 15 e 36 anos, nenhum encostava nos 18 |
| data de nascimento volta a ser opcional (era **fail-open**) | 1 vermelha |
| data absurda (1850, 2030) volta a passar | 4 vermelhas |
| menor que JÁ TEM documento volta a passar | 3 vermelhas |
| guarda do BH removida | 2 vermelhas — ficava **verde** antes: o cenário do BH não espelhava a produção e a chamada morria em `inscricoes_fechadas` |
| app: qualquer das DUAS portas do fluxo perde o `circ` | 1 vermelha cada — ficava **verde** antes: as checagens olhavam o corpo da função, não os pontos de chamada |
| app: o sistema volta a cair no padrão "A" | 1 vermelha |
| app: a coluna `sistema` sai do select dos circuitos | 1 vermelha |
| app: o aceite volta a ser cravado como `true` | 2 vermelhas |
| **combinação**: tirar a guarda do `null` **e** acrescentar `!== null` no `< 18` | 5 vermelhas — o `!== null` **sozinho** é inócuo (verde, e corretamente), mas o par abriria a porta |
| cai a exigência do aceite do regulamento | 5 vermelhas |
| "aceite" passa a bastar qualquer valor verdadeiro em vez de `true` | 1 vermelha |
| cai a exigência de o atleta declarar QUAL versão aceitou | 1 vermelha |
| cai a comparação entre a versão declarada e a do circuito | 4 vermelhas |
| circuito sem regulamento carimbado passa a aceitar gente | 1 vermelha |
| cai a guarda do menor de idade inteira | 6 vermelhas |
| responsável: cai a exigência do nome | 1 vermelha |
| responsável: cai a exigência do CPF | 1 vermelha |
| uma asserção qualquer do `regulamento-por-circuito.mjs` | **prova do portão**: `npm run teste` agora sai com código **1**; antes saía **0** |
| **0.6.24 + 0.6.15 — 28/09/2026 (14 sabotagens, 14 vermelhas)** | |
| `INSCREVER`: data de nascimento volta a ser opcional | 1 vermelha |
| `INSCREVER`: data absurda (ano 1850 / 3000) volta a passar | 2 vermelhas |
| `INSCREVER`: menor sem responsável volta a passar | 2 vermelhas |
| `INSCREVER`: a fronteira `< 18` vira `< 17` | 2 vermelhas |
| `INSCREVER`: exige só o nome, perde o CPF do responsável | 1 vermelha |
| `INSCREVER`: a recusa passa a gravar o atleta antes de recusar | 1 vermelha |
| janela: volta a inverter (`fecha = início−7`) | 3 vermelhas |
| janela: os 7 dias viram 10 | 2 vermelhas |
| janela: `aberta` perde o limite superior | 2 vermelhas |
| janela: `encerrada` volta a disparar em `início−7` | 2 vermelhas |
| janela: `diasAteFechar` volta a contar da abertura | 2 vermelhas |
| janela: a data inválida deixa de ser recusada | **ficava VERDE no aferidor velho**: a sabotagem *quebrava* o arquivo antes de imprimir falha. Corrigido nos dois lados — o aferidor passou a tratar saída ≠ 0 como vermelho, e a asserção passou a capturar a exceção |
| card do admin: sabotagem que derruba o arquivo (`janelaRenovacaoQueNaoExiste`) | **ficava VERDE no aferidor velho**, pelo mesmo motivo. Hoje 1 vermelha |
| **Revisão das 8 duplas — 28/09/2026 (15 sabotagens, 15 vermelhas)** | |
| card: volta o parêntese "(7 dias antes do início)" ao lado da data do **início** | 1 vermelha |
| card: volta a data solta, sem o intervalo | 1 vermelha |
| card: volta aos DOIS estados ("Janela aberta" abraça tudo que não encerrou) | 3 vermelhas |
| card: some a consequência do Cap. 13 no ramo encerrado | 1 vermelha — **ficava VERDE**: a asserção casava com a frase do **regulamento**, três mil linhas acima, e não com o card. Ancorada no ramo, passou a acusar |
| botão desabilitado: volta a dizer que o prazo está em revisão | 2 vermelhas |
| mensagem: volta a derivar a data de `toISOString` (erra o dia a leste de Greenwich) | 2 vermelhas |
| mensagem: volta a prometer que sinalizar garante a vaga | 2 vermelhas |
| lembrete: volta a prometer o mesmo | 2 vermelhas |
| motor: a reescrita proibida `idadeInsc !== null && idadeInsc < 18` | 2 vermelhas — **ficava VERDE** enquanto a regra dependia da coerção `null < 18`; hoje a regra é explícita e há asserção de fonte |
| motor: a frase do menor perde o POR QUÊ (art. 14) e o ONDE (passo 1) | 2 vermelhas |
| `login-atleta`: volta o fail-open da ressalva vencida (`!== null`) | 2 vermelhas |
| `login-atleta`: a recusa perde o código certo | 1 vermelha |
| app: a recusa nova deixa de ser traduzida e cai no genérico | 2 vermelhas |
| app: a tradução deixa de mandar falar com o organizador | 1 vermelha |
| **[aferidor]** sabotagem que quebra o arquivo antes de imprimir falha | 1 vermelha — **é a prova de que o conserto da régua funciona** |
| **O 2º circuito — 28/09/2026 (14 sabotagens, 14 vermelhas)** | |
| motor: o teto volta a ser ignorado no `DEFINIR_CONFIG_CIRCUITO` | 1 vermelha |
| motor: o mínimo de 8 cai (um teto de 3 passaria) | 1 vermelha |
| motor: `CRIAR_CIRCUITO` deixa de devolver `regulamento_versao` (o recibo) | 2 vermelhas — **ficava VERDE antes**: o banco falso não recortava colunas no retorno de `insert(...).select(...)`, então a asserção do recibo não tinha como enxergar a diferença. Mesmo furo do `select("*")` de `LISTAR_TELEFONES`, cujo conserto de 27/09 só cobriu metade do caminho |
| motor: circuito de pontos volta a nascer com o regulamento do BH (`v03-12`) | 2 vermelhas |
| motor: a configuração passa a reescrever `regulamento_versao` | 1 vermelha — é a regra 7: o recibo do atleta não se reescreve por um salvamento de configuração |
| **[instrumento]** o banco falso volta a NÃO projetar colunas na escrita | 2 vermelhas — **ficava VERDE antes** das 4 asserções que dão portão ao próprio instrumento |
| tela: a frase falsa "o teto é fixo em 20 atletas por circuito" volta | 1 vermelha |
| tela: o campo do teto deixa de mandar o valor | 1 vermelha |
| tela: o bloqueio fora da faixa 8–20 cai (o motor apararia em silêncio) | 1 vermelha |
| tela: o aviso "não tira ninguém" some | 1 vermelha |
| tela: a versão do regulamento deixa de aparecer na configuração | 2 vermelhas |
| tela: o aviso do regulamento na CRIAÇÃO some | 1 vermelha |
| tela: o aviso perde a parte do torneio (a diferença que só o documento mostra) | 1 vermelha |
| tela: a confirmação deixa de mostrar o que o servidor gravou e volta a adivinhar | 1 vermelha |

## O portão: todo arquivo termina em `process.exit(placar(...))`

`placar()` **devolve** 0 ou 1 — não sai do processo. Um arquivo que chame
`placar("...")` sem `process.exit(...)` **sai com código 0 mesmo imprimindo
"Falhas:"**, o `&&` do `npm run teste` segue para o próximo, e o `atualizar.sh`,
que lê o código de saída, publica.

Isso aconteceu de verdade, e ficou assim por semanas: até 27/09/2026 quatro
arquivos estavam nessa condição — `nomes-que-nao-existem.mjs`,
`erros-na-tela.mjs`, `contador-mensagens.mjs` e `regulamento-por-circuito.mjs` —,
o que cegava o portão para **395 das 581** asserções, incluindo os **351** do
regulamento. Corrigido, e provado sabotando uma asserção do regulamento: o
`npm run teste` passou a sair com **1**.

## O que ainda não é testado

- O front (`src/App.jsx`) — não é **executado** por teste nenhum. O que existe são
  checagens por regex no texto fonte (ver `erros-na-tela.mjs`,
  `contador-mensagens.mjs`, `nomes-que-nao-existem.mjs` na tabela acima), e regex
  registra que um trecho de texto está lá — **não** prova comportamento. Para
  **texto de tela** isso é o certo, porque a afirmação é literalmente "esta frase
  está aqui"; para regra, não serve.
- `circuito-dados` — o carregador já serve para ela; faltam as asserções. E o
  `login-atleta` só é coberto no `PARTICIPAR`: o `LOGIN`, o `SESSAO` e o
  `RENOVAR` seguem sem asserção nenhuma. O `athlete-action` **já é executado** (8 cenários: os 7 do
  `ACEITAR_REGULAMENTO` mais o do `INSCREVER`), e o `comprovante-url` também
  (16 asserções, desde 27/09/2026).
- Pareamento e geração de jogos (`INICIAR_ETAPA`, `AVANCAR_RODADA`).
- Desempates do ranking (`cmpRankingDB` / `cmpRankingB`).
- O financeiro.
