# A bateria de testes

```bash
npm run teste
```

Hoje são **82 asserções**. O `atualizar.sh` roda isso antes de publicar e se
recusa a subir com teste vermelho.

## O que ela testa — e por que isso é diferente do que havia antes

A bateria **carrega e executa o motor de verdade**: o mesmo
`supabase/functions/admin-action/index.ts` que o `npm run motor:publicar` sobe.
Não há cópia da lógica dentro do teste.

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

As mutações já verificadas nesta bateria:

| Sabotagem no `admin-action` | Resultado |
|---|---|
| `benef.rating + 8` → `+ 7` | 2 asserções vermelhas |
| tabela CBTM `{max:24, v:10}` → `v:11` | 5 vermelhas |
| tirar o `.eq("validado", true)` do processamento | 8 vermelhas |
| `falt.rating - 15` → `- 0` | 1 vermelha |
| tirar o `.eq("circuito_id", ...)` ao processar rodada | 3 vermelhas |
| exclusão em circuito não-BH apagando `atletas` | 2 vermelhas |
| tirar a checagem `ehOrganizadorDe` | 3 vermelhas |
| freio de tentativas de PIN nunca disparar | 1 vermelha |

## O que ainda não é testado

- O front (`src/App.jsx`) — nada dele passa por aqui.
- `athlete-action`, `login-atleta`, `circuito-dados` — o carregador já serve
  para elas; faltam as asserções.
- Pareamento e geração de jogos (`INICIAR_ETAPA`, `AVANCAR_RODADA`).
- Desempates do ranking (`cmpRankingDB` / `cmpRankingB`).
- O financeiro.
