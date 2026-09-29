# Código que estava NO AR em 27/09/2026, antes da Onda 0.6

Não existe rollback de Edge Function no Supabase: republicar sempre cria uma
versão nova, com número maior. A única forma de "voltar" é republicar o código
antigo — e para isso ele precisa existir em algum lugar.

`ar-comprovante-url-v2.ts` é o fonte da **v2**, baixado da API do Supabase em
27/09/2026 antes de publicar a v3. Ele não existia em nenhuma pasta de backup **deste
repositório** — mas existe fora dele, em
`BACKUPS/motor-no-ar-2026-09-07/ar-comprovante-url.ts`, que é onde a convenção do
`CLAUDE.md` guarda os backups do motor. Conferido: aquele arquivo é
**byte-idêntico** a este. Ou seja, o rollback já tinha por onde voltar; eu afirmei
o contrário porque procurei só dentro do repositório. Esta cópia fica de qualquer
forma, datada do deploy.

**Atenção, e é o motivo de este arquivo existir:** a v2 no ar **não tem** as
origens de desenvolvimento (`http://localhost:5173`, `http://127.0.0.1:5173`).
Elas foram adicionadas ao fonte deste repositório em 07/09/2026 e
deliberadamente NÃO publicadas nesta função. Publicar a v3 leva as duas coisas
juntas: o caminho do organizador (item 0.6.4) e a liberação de CORS do
localhost. Voltar para este arquivo desfaz as duas.

Para reverter:

    cp docs/backups/motor-no-ar-2026-09-27/ar-comprovante-url-v2.ts \
       supabase/functions/comprovante-url/index.ts
    npm run motor:publicar -- comprovante-url

---

## `ar-login-atleta-v9.ts` — salvo em 27/09/2026, antes da v10

Não existia backup do `login-atleta` **v9** em lugar nenhum: as pastas anteriores
têm `ar-login-atleta.ts` (07/09), a `-pos-cors` (07/09) e `ar-login-atleta-v8.ts`
(19/09). E v9 é o que está rodando — a função do **login de todos os atletas**.
Apontado pelo Guardião de Confiabilidade.

**Como este arquivo foi produzido, e o limite honesto disso.** Ele é
`git show 52bd47b:supabase/functions/login-atleta/index.ts`, e a evidência de que
é o que está no ar é **convergente**, não um `diff` byte a byte:

- o `entrypoint_path` da v9 é `/Users/strutzki/clube-tenis-mesa-v2/supabase/functions/login-atleta/index.ts` — publicada **deste** repositório, ao contrário do episódio de 19/09;
- publicada em 27/09 16:36:37; o commit `4adc017` é de 16:37:16, 39 segundos depois;
- `git log 4adc017..52bd47b -- supabase/functions/login-atleta/index.ts` é **vazio**: o arquivo não mudou entre os dois;
- baixei o fonte do ar pela API e conferi marcador a marcador: as origens de `localhost`, o `versao_regulamento_indisponivel`, o comentário do `org_ve_financeiro`, o `bh_cadastro_direto` e o `preco_temporada_atleta` estão **todos** presentes aqui; e **nenhum** marcador do commit novo (`aceite_regulamento_obrigatorio`, `responsavel_obrigatorio`, `idadeDeISO`, `versao_regulamento_divergente`) aparece.

Ou seja: coincide em tudo que dá para conferir. **Não** está afirmado como
byte-idêntico, porque o `diff` não foi rodado contra o arquivo do ar.

Para reverter o `login-atleta`:

    git checkout 52bd47b -- supabase/functions/login-atleta/index.ts
    npm run motor:publicar -- login-atleta
    npm run motor:conferir      # tem de dar 0 divergências

Ou, se por algum motivo o git divergir do ar, republique **este** arquivo.

---

## `ar-athlete-action-v21.ts` — salvo em 28/09/2026, antes da v22

Não existia backup do `athlete-action` **v21** em lugar nenhum: as pastas
anteriores têm `ar-athlete-action.ts` (07/09), a `-pos-cors` (07/09) e
`ar-athlete-action-v20.ts` (19/09). E v21 é o que está rodando — a função da
**inscrição de todo atleta novo**, que é a porta da frente do BH. Apontado pelo
Guardião de Confiabilidade.

O arquivo está nesta pasta, e não numa `motor-no-ar-2026-09-28`, porque **a v21 foi
publicada em 27/09** — esta pasta é o motor como ele estava no ar naquele dia.

**Como este arquivo foi produzido, e o limite honesto disso.** Ele é
`git show f1650d0:supabase/functions/athlete-action/index.ts`, e a evidência de que
é o que está no ar é **convergente**, não um `diff` byte a byte:

- o `entrypoint_path` da v21 é
  `/Users/strutzki/clube-tenis-mesa-v2/supabase/functions/athlete-action/index.ts`
  — publicada **deste** repositório;
- publicada em 27/09 às 16:35:53 (BRT); o commit `4adc017`, que contém a mudança
  daquele dia, é de 16:37:16 — **83 segundos depois**. O padrão da casa é publicar
  e commitar em seguida;
- `git log` mostra que o arquivo **não mudou** entre `4adc017` e `f1650d0` (o pai do
  commit desta fatia);
- baixei o fonte do ar pela API e li inteiro: as **9** ações estão lá, o
  `atletaPorTokenAA` do `ACEITAR_REGULAMENTO`, o `versaoDoCircuito` fail-closed, as
  origens de `localhost`, e o comentário antigo *"Menor de idade: hash do CPF do
  responsável (se enviado)"* — que é justamente a linha que esta fatia reescreve. E
  **zero** ocorrências de `idadeDeISO`, que o commit novo tem duas.

Ou seja: coincide em tudo que dá para conferir. **Não** está afirmado como
byte-idêntico, porque o `diff` não foi rodado contra o arquivo do ar — a resposta da
API não foi para o disco nesta sessão. Mesma situação e mesma honestidade do v9.

Para reverter o `athlete-action`:

    git checkout f1650d0 -- supabase/functions/athlete-action/index.ts
    npm run motor:publicar -- athlete-action    # sobe como v23 — o número sempre sobe
    npm run motor:conferir                      # tem de dar 0 divergências

Ou, se por algum motivo o git divergir do ar, republique **este** arquivo.

---

## `login-atleta` v10 → v11 nesta mesma subida

O backup do **v10** é o próprio `git show f1650d0:supabase/functions/login-atleta/index.ts`
(o arquivo não mudou entre a publicação da v10 e esta fatia). O rollback é:

    git checkout f1650d0 -- supabase/functions/login-atleta/index.ts
    npm run motor:publicar -- login-atleta
    npm run motor:conferir

---

## `ar-admin-action-v62.ts` — salvo em 28/09/2026, antes da v63

Terceira rodada seguida em que o Guardião de Confiabilidade acha um backup faltando.
Havia `ar-admin-action.ts` (07/09), `-pos-cors`, `-v57` e `-v60` (19/09). **v62 não**
— e v62 é o motor de quase tudo no painel do admin.

**Desta vez é `diff` byte a byte, não evidência convergente.** Ele baixou o fonte do
ar e comparou contra `git show cd5249a:supabase/functions/admin-action/index.ts`:
**118.181 caracteres, IDÊNTICOS** (idêntico também a `b4822c1`, o commit publicado
como v62). A reversibilidade está **provada**, não inferida — este arquivo é
escrituração da convenção da casa, não pré-requisito de segurança.

**E ele descobriu por que os dois anteriores ficaram com asterisco**, o que fecha uma
dúvida que estava aberta desde 27/09: quando a resposta da API é grande, a ferramenta
**salva em arquivo automaticamente** — e aí o `diff` é trivial. O `login-atleta` v9 e
o `athlete-action` v21 **couberam no contexto** e por isso não foram salvos em disco.
Era essa, e só essa, a razão do "não afirmo byte-idêntico". **Dá para fechar os dois
retroativamente**: buscar cada função, gravar o conteúdo em arquivo e rodar o `diff`.

Para reverter o `admin-action`:

    git checkout cd5249a -- supabase/functions/admin-action/index.ts
    npm run motor:publicar -- admin-action    # sobe como v64 — o número sempre sobe
    npm run motor:conferir                    # tem de dar 0 divergências
