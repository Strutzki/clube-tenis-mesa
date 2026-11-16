# O que estava no ar em 15/11/2026, antes da troca da porta do app

Cópia do **fonte que o servidor estava executando**, não do que o repositório
dizia. É a única coisa que permite voltar atrás: **Edge Function não tem
rollback** — "voltar" é republicar o código antigo, e o número da versão sempre
sobe.

| arquivo | função | versão no ar | md5 |
|---|---|---|---|
| `ar-login-atleta-v12.ts` | `login-atleta` | **12** | `f08b6b76b465a991ce7390545865256f` |
| `ar-admin-action-v67.ts` | `admin-action` | **67** | `a961b6cb5d3ef7a8d7f61dc746f0f909` |

⚠️ **O `admin-action` entrou aqui DEPOIS**, em 15/11/2026, quando o W.O. duplo
passou a exigir publicar a v67 → v68. A primeira versão deste arquivo dizia que
ele "não é tocado nesta onda e por isso não ganha cópia, a dele está em
`motor-no-ar-2026-10-12/`" — **e aquela pasta tem a v65, não a v67**. O Guardião
de Confiabilidade pegou: sem esta cópia não haveria para onde voltar a v67, que é
exatamente o que esta pasta existe para impedir.

`athlete-action` segue **v24** e **não sobe** — a alteração dele nesta onda é só
de comentário.

## Como esta cópia foi obtida E conferida

Extraída do git (`git show HEAD:…`, HEAD = `87c1e95`, que é o último commit
antes da onda) e depois **conferida contra o fonte vivo**, lido pelo conector do
Supabase (`get_edge_function`) em 15/11/2026.

⚠️ O comando oficial `supabase functions download` continua **quebrado** (achado
em 12/10/2026) — o caminho que funciona é o conector.

A conferência foi por **marcadores**, a mesma técnica usada para a v11 em
12/10/2026. O que separa a v12 das vizinhas:

- **tem** `PRIVACIDADE_VERSAO = "privacidade-2026-10-v1"` (não existe na v11);
- **tem** o `PRECO` chamando a RPC com **dois** argumentos
  (`p_id` + `p_circuito`) — na v11 era um só;
- **tem** `aceite_privacidade_obrigatorio` e o `COLS` terminando em
  `privacidade_versao`;
- **não tem** `temAcessoAoApp`, `motivoDoBloqueio` nem o campo `acesso:` —
  os três nascem na v13, e a ausência deles é o que prova que esta cópia é a
  versão **anterior** à onda, e não a nova por engano.

## Para reverter

A porta nova é **só do motor** nesta metade: o app novo tolera a ausência do
campo `acesso` (cai no caminho velho, `found.status`). Então dá para voltar o
motor sozinho, sem mexer no app — e é essa a ordem segura:

```bash
cp docs/backups/motor-no-ar-2026-11-15/ar-login-atleta-v12.ts \
   supabase/functions/login-atleta/index.ts
npm run motor:publicar -- login-atleta        # vira v14, não v12
git checkout -- supabase/functions/login-atleta/index.ts
npm run motor:conferir                         # sempre, depois de republicar
```

⚠️ **Voltar o motor devolve o defeito.** Com a v12 no ar, atleta aprovado no
circuito cujo `atletas.status` ficou `pendente` volta a ser trancado para fora —
foi o que aconteceu com um atleta real do bh2 entre 31/10 e 15/11/2026. Se
precisar reverter, confira antes quem está nesse estado:

```sql
select a.nome from circuito_atletas ca
  join atletas a on a.id = ca.atleta_id
 where ca.status = 'ativo' and a.status <> 'ativo';
```

Se o app também precisar voltar: `git revert --no-edit <sha-da-onda> &&
git push origin main`, e confira com `-L` (sem ele o domínio responde 308 e a
leitura vem **vazia**, que é falha de medição, não "versão antiga"):

```bash
curl -sL https://clubedotenisdemesabh.com.br/ | grep -oE 'index-[A-Za-z0-9_-]+\.js'
```

## Voltar o `admin-action` (W.O. duplo)

```bash
cp docs/backups/motor-no-ar-2026-11-15/ar-admin-action-v67.ts \
   supabase/functions/admin-action/index.ts
npm run motor:publicar -- admin-action        # vira v69, não v67
git checkout -- supabase/functions/admin-action/index.ts
npm run motor:conferir
```

⚠️ **O que acontece com uma partida já marcada como `duplo_culposo`** — medido
pelo Guardião de Confiabilidade, não deduzido:

- o `PROCESSAR_RODADA` da v67 **não a enxerga** (o `in("wo_tipo", …)` dela não
  tem o tipo): ela fica `calculado: false`, sem pontos e sem derrota, **ignorada
  em silêncio**. Não corrompe nada;
- o `recontarWoCulposos` da v67 **não conta o duplo** e sobrescreve
  `wo_culposos_temporada`, então a falta **some** no primeiro recálculo;
- **republicar a v68 recupera tudo**: a linha continua no banco e o recálculo
  volta a contá-la.

Antes de reverter, veja se existe alguma:

```sql
select id, rodada, wo_tipo, calculado from partidas where wo_tipo = 'duplo_culposo';
```

### Migrações

**Nenhuma.** Nenhuma das duas ondas cria, altera ou apaga coluna — nem toca na
tabela `circuitos`, então a armadilha nº 1 do `CLAUDE.md` (coluna nova sem grant
para o `anon` derruba o app inteiro) não se aplica.

O W.O. duplo grava um **valor novo** numa coluna que já existe
(`partidas.wo_tipo`, `text`). Medido em 15/11/2026: a tabela **não tem CHECK nem
trigger** nessa coluna, e as 44 partidas existentes estão todas com `wo_tipo`
nulo — ou seja, não há dado a migrar e nada a violar.
