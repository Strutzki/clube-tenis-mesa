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

**O motor** — republica o código antigo; o número da versão SOBE (vira v65+/v23+):
```bash
cp docs/backups/motor-no-ar-2026-09-29/ar-admin-action-v64.ts supabase/functions/admin-action/index.ts
npm run motor:publicar -- admin-action
npm run motor:conferir        # tem de dar 0 divergências

cp docs/backups/motor-no-ar-2026-09-29/ar-athlete-action-v22.ts supabase/functions/athlete-action/index.ts
npm run motor:publicar -- athlete-action
npm run motor:conferir
```

⚠️ `npm run motor:conferir` depois de CADA função. Se der divergência, o
`verify_jwt` ligou e o app inteiro para para todo mundo — reverter na hora.

## Não coberto por esta pasta

`circuito-dados` (v4) e `despachos-do-dia` (v6) continuam com `entrypoint_path`
apontando para uma pasta de rascunho do projeto de TORNEIOS — achado de 19/09,
reconferido pelo Curador em 29/09. **Não há rollback confiável para essas duas.**
Elas não foram tocadas por esta onda.
