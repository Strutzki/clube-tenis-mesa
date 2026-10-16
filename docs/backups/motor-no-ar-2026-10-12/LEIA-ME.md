# O que estava no ar em 12/10/2026, antes da onda da inscrição

Cópia do **fonte que o servidor estava executando**, não do que o repositório
dizia. É a única coisa que permite voltar atrás: **Edge Function não tem
rollback** — "voltar" é republicar o código antigo, e o número da versão sempre
sobe. Sem esta pasta, não há de onde republicar.

| arquivo | função | versão no ar | publicada em (UTC) |
|---|---|---|---|
| `ar-admin-action-v65.ts` | `admin-action` | **65** | 2026-10-03 10:27:49 |
| `ar-athlete-action-v23.ts` | `athlete-action` | **23** | 2026-10-03 (mesma subida) |
| `ar-login-atleta-v11.ts` | `login-atleta` | **11** | 2026-09-29 |

## ⚠️ O comando oficial de baixar está QUEBRADO — use o conector

`supabase functions download` falha nas duas formas (`exit 101` no normal,
`LegacyGoChildExitError` com `--legacy-bundle`). Achado pelo Guardião de
Confiabilidade em 12/10/2026.

**O caminho que funciona** é o conector do Supabase (`get_edge_function`), que
devolve o fonte inteiro do ar. Foi assim que estas três cópias foram conferidas.
Se um dia o conector também falhar, o último recurso é o git: o fonte do ar
existe como blob no repositório (ver abaixo) — mas isso é arqueologia sob
pressão, com o app fora do ar, e é exatamente o que esta pasta existe para
evitar.

## Como cada cópia foi obtida E conferida

Não foram deduzidas por data de commit. Cada uma foi extraída do git e depois
**comparada com o fonte vivo**:

- **`admin-action` v65** — `git show 7f43ddc:…`.
  Conferência: md5 do arquivo = md5 do fonte devolvido pelo conector =
  **`bef0776c2e5fb38fb40187127bba3a9f`**. Byte-idêntico.
- **`login-atleta` v11** — `git cat-file blob d8c623e095a07234ac78cbb4bdb3ad55185be1f0`
  (o blob vive no commit `d4901d1`).
  Conferência contra o fonte vivo, por marcadores que separam a v11 da v12:
  o `COLS` termina em `exclusao_solicitada_em` (sem `motivo_reprovacao`);
  o `PRECO` chama a RPC com **um** argumento (`{ p_id }`); não existe
  `aceite_privacidade_obrigatorio`; não existe `PRIVACIDADE_VERSAO`.
- **`athlete-action` v23** — `git show HEAD:…` (o blob do HEAD **é** o que está
  no ar). Conferência: não contém `privacidade_versao`, e contém o `INSCREVER`.

## Para reverter (depois de publicar a onda)

A ordem de volta é o **espelho** da de subida — motor primeiro, app depois:

```bash
cp docs/backups/motor-no-ar-2026-10-12/ar-athlete-action-v23.ts \
   supabase/functions/athlete-action/index.ts
npm run motor:publicar -- athlete-action        # vira v25, não v23
git checkout -- supabase/functions/athlete-action/index.ts

cp docs/backups/motor-no-ar-2026-10-12/ar-login-atleta-v11.ts \
   supabase/functions/login-atleta/index.ts
npm run motor:publicar -- login-atleta          # vira v13
git checkout -- supabase/functions/login-atleta/index.ts

npm run motor:conferir                           # sempre, depois de republicar
git revert --no-edit <sha-da-onda> && git push origin main
```

Conferir o app voltou, com `-L` (sem ele o domínio responde 308 e a leitura vem
**vazia** — e leitura vazia é falha de medição, não "versão antiga"):

```bash
curl -sL https://clubedotenisdemesabh.com.br/ | grep -oE 'index-[A-Za-z0-9_-]+\.js'
```

### As migrações

- **Preço** — `drop function if exists public.preco_temporada_atleta(uuid, uuid);`
  Seguro sempre: a função de **1 argumento** não é tocada. Mas com a v12 no ar o
  `PRECO` passa a devolver 500 e a tela fica calada sobre dinheiro — por isso a
  Edge Function volta **antes**.
- **Consentimento** — **o caminho de volta é NÃO desfazer.** A coluna é aditiva,
  sem grant para `anon`, fora de todo select anônimo. Só derrubar se nada foi
  escrito, e conferindo antes:

```sql
select count(*) from atletas where privacidade_versao is not null;  -- tem de dar 0
alter table public.atletas drop column if exists privacidade_versao;
```

  Derrubar **depois** de alguém aceitar destrói recibo de consentimento real.

## O que o CHANGELOG não registrou

A subida de **03/10/2026** (`admin-action` v64→v65, `athlete-action` v22→v23)
nunca entrou no `docs/CHANGELOG.md`: a versão mais recente que ele nomeia é
v64/v22. Quem fosse investigar um bug do motor começaria **três deploys atrás** —
e é justamente essa a memória de que o rollback depende. Achado pelo Curador e
pela Confiabilidade, independentemente, em 12/10/2026.
