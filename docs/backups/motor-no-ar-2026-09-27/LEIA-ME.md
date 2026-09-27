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
