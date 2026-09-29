# Motor que estava NO AR em 29/09/2026, antes da onda multi-circuito

Cópia do **fonte que o Supabase estava executando**, baixado pela API do próprio
Supabase (não copiado do repositório) — a condição irreversível levantada pelos
guardiões na Onda 0.6 e recobrada pelo Guardião de Confiabilidade nesta rodada.

**Por que isto existe:** Edge Function **não tem rollback**. "Voltar" é republicar
o código antigo, criando uma versão nova (o número sempre sobe). Se o fonte do ar
não estiver salvo em lugar nenhum, não há para onde voltar. Foi exatamente o
buraco de 19/09/2026 com o `login-atleta`.

| Função | Versão no ar | Arquivo | MD5 |
|---|---|---|---|
| `admin-action` | **v64** | `ar-admin-action-v64.ts` | `2fefff57e8a2f78cbb5d85e3509d7ac4` |
| `athlete-action` | **v22** | `ar-athlete-action-v22.ts` | `099b94a294dfd8ef97f18b02ae8f2517` |
| `circuito-dados` | **v4** | `ar-circuito-dados-v4.ts` | `bdd87260ebd542e5b0e69bf9587867b4` |
| `anonimizar-atleta` | **v2** | `ar-anonimizar-atleta-v2.ts` | `ce32b8aa017f3c6ace25ed0f6fcbf889` |

## ⚠️ PARA ESTAS DUAS, O GIT NÃO É ROLLBACK

`circuito-dados` e `anonimizar-atleta` **não foram publicadas deste repositório**
— o Guardião de Confiabilidade conferiu o `entrypoint_path` de cada uma:

- `circuito-dados` v4 saiu de uma pasta de rascunho do **projeto de TORNEIOS**;
- `anonimizar-atleta` v2 saiu de um **diretório temporário**, de repositório nenhum.

É o mesmo cenário do `login-atleta` de 19/09/2026: o que está no ar não
corresponde a commit nenhum. Para estas duas, **só o arquivo baixado aqui serve
de rollback.**

## ⚠️ CARGA EXTRA: publicar `anonimizar-atleta` leva DUAS coisas

O `diff` contra o repositório mostra que a **v2 que está no ar NÃO tem as origens
de CORS de desenvolvimento** (`http://localhost:5173` e `http://127.0.0.1:5173`),
que o repositório tem desde 07/09/2026. Então publicar esta função leva junto:

1. a correção de LGPD desta onda (apagar foto, CPF, sessões, nome nas mensagens);
2. **a liberação de CORS do localhost**, que nunca subiu nesta função.

Não é perigoso — a liberação já está no ar em outras 5 funções, e a casa já
decidiu que é segura ("CORS só vale para navegador; PIN continua exigido aqui
dentro"). Mas **reverter para a v2 desfaz as duas**, e quem reverter no susto
precisa saber disso. Mesmo precedente do `comprovante-url` v2→v3 (LEIA-ME de
27/09).

O `circuito-dados` v4 no ar **já tem** as origens de localhost — lá não há carga
extra por esse lado.

## Verificação feita (não presumida)

Os dois foram comparados com `diff` contra o commit `16cdf58` e deram
**byte-idênticos**:

```bash
diff <(git show 16cdf58:supabase/functions/admin-action/index.ts)   docs/backups/motor-no-ar-2026-09-29/ar-admin-action-v64.ts
diff <(git show 16cdf58:supabase/functions/athlete-action/index.ts) docs/backups/motor-no-ar-2026-09-29/ar-athlete-action-v22.ts
```

Ou seja: para ESTAS duas funções, o `16cdf58` também serve de fonte de reversão.
A cópia continua aqui porque a regra da casa pede o fonte **do ar**, e porque o
repositório pode divergir do ar sem aviso — já aconteceu duas vezes.

## Como reverter

**O app (front):**
```bash
git revert --no-edit <os commits da onda>
git push origin main          # a Vercel republica em ~1 min
```

**O motor** — republica o código antigo; o número da versão SOBE sempre.
⚠️ Para `circuito-dados` e `anonimizar-atleta` use O ARQUIVO DESTA PASTA, não o
git — ver acima.
```bash
cp docs/backups/motor-no-ar-2026-09-29/ar-admin-action-v64.ts supabase/functions/admin-action/index.ts
npm run motor:publicar -- admin-action
npm run motor:conferir        # tem de dar 0 divergências

cp docs/backups/motor-no-ar-2026-09-29/ar-athlete-action-v22.ts supabase/functions/athlete-action/index.ts
npm run motor:publicar -- athlete-action
npm run motor:conferir

cp docs/backups/motor-no-ar-2026-09-29/ar-circuito-dados-v4.ts supabase/functions/circuito-dados/index.ts
npm run motor:publicar -- circuito-dados
npm run motor:conferir

cp docs/backups/motor-no-ar-2026-09-29/ar-anonimizar-atleta-v2.ts supabase/functions/anonimizar-atleta/index.ts
npm run motor:publicar -- anonimizar-atleta
npm run motor:conferir
```

⚠️ **Não há rollback de DADO** para o que a `anonimizar-atleta` já tiver apagado
(foto, documento, sessões, nome nas mensagens). Republicar a v2 muda o efeito
futuro; o que já saiu, saiu.

⚠️ `npm run motor:conferir` depois de CADA função. Se der divergência, o
`verify_jwt` ligou e o app inteiro para para todo mundo — reverter na hora.

## Não coberto por esta pasta

`despachos-do-dia` (v6) continua com `entrypoint_path` apontando para uma pasta de
rascunho do projeto de TORNEIOS — achado de 19/09, reconferido pelo Curador em
29/09. **Não há rollback confiável para ela.** Não foi tocada por esta onda.
