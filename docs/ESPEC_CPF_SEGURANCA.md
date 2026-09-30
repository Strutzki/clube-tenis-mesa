# Especificação de segurança — CPF como identidade nacional
Validada pelo Guardião (supervisionado, Opus). **VEREDITO: GO-com-condições.** spec para guiar o código.

⚠️ **REVISADO PELO SUPERVISOR DE CURADORIA EM 29/09/2026 (noite), commit `60ccc86`** — este
documento **não havia sido olhado** nas curadorias de 19/09, 27/09 nem 29/09 (tarde), e duas
coisas nele estavam vencidas. As correções estão marcadas com esta data. O documento continua
sendo a **spec de como o CPF é blindado**; o que mudou é o fim da vida do dado.

## ⚠️ MUDANÇA DE PREMISSA — 29/09/2026: o `cpf_hash` É APAGADO na exclusão, e isso tem preço

**Decisão do Juliano em 29/09/2026** (commit `5bc6703`, fechando o ROADMAP 0.7.2):
*"vamos excluir quando o cliente pedir, mas deixar claro os impactos que pode causar caso
resolva voltar no futuro."* A §5 abaixo já dizia *"eliminação — purgar na exclusão"*; o que
faltava neste documento é **a consequência**, e ela contradiz a premissa do §3 (dedup).

A `anonimizar-atleta` passou a apagar, de `atleta_documento`, o **`cpf_hash`**, a
`data_nascimento`, e o **nome e o `responsavel_cpf_hash`** do responsável legal. O código do
CPF era **o que permitia reconhecer a mesma pessoa num cadastro novo**. Sem ele:

- **a trava de duplicata do §3 deixa de reconhecê-la** — ela pode se recadastrar do zero, e o
  `dedup_por_cpf_hash` responderá `existe: false` corretamente, porque o hash não está mais lá;
- **em consequência, um banimento por fraude deixa de ser aplicável automaticamente a um
  cadastro novo.** O Capítulo de Fraude do regulamento **parou de prometer banimento
  permanente automático** na mesma onda — sem o CPF guardado o app não tem como cumprir, e
  passou a ser **decisão do clube**, não do sistema.

**Isto é custo REAL da decisão, não defeito**, e está registrado no comentário da função para
não ser descoberto por acidente: **o controlador escolheu o direito do titular** (art. 18 da
LGPD) sobre a capacidade de dedup. O titular lê a consequência **antes** de confirmar, em
caixa destacada: se voltar, é cadastro novo, o clube não reconhece que ele já participou, o
histórico e os pontos não voltam, e não dá para desfazer.

**E o titular pode CANCELAR o pedido enquanto ele está pendente** (art. 18, IX) — o
irreversível é o passo do admin, não o clique dele. Resolve junto o ROADMAP 0.7.3.

⛔ **No fonte, não no ar:** `anonimizar-atleta` v2 é o que está rodando. A versão que faz
tudo isto é a **2ª peça** da ordem de subida, e publicá-la **leva junto a liberação de CORS
do localhost** — carga extra declarada. **`git checkout` não é rollback dela**: ela nunca foi
publicada deste repositório; o fonte do ar está em `docs/backups/motor-no-ar-2026-09-29/`.

## STATUS de implementação
- **Fatia 1 — ✅ FEITA (migração aplicada, verificada).** `atleta_documento` criada (RLS on, 0 policies = deny-all, `revoke all` de anon/authenticated/public, `grant all` a service_role, FK cascade). `atletas.cpf_verificado boolean default false` + **grant de coluna** a anon/authenticated (senão o `select=*` quebraria). Provas: anon lê `cpf_verificado` (15/15) mas leva *permission denied* em `atleta_documento`; dados originais do `atletas` byte-idênticos (hash 43-col `3f4f9540…` inalterado). Só schema — BH intocado.
- **Fatia 2 — ✅ FEITA (migração aplicada, verificada).** Pepper de 64 hex no `supabase_vault` (gerado no banco, nunca em código/log). `get_cpf_pepper()` e `dedup_por_cpf_hash(text)` são SECURITY DEFINER com `search_path=''`, `revoke all` de public/anon/authenticated e `grant execute` só a service_role — anon leva *permission denied* nas duas. `dedup` devolve só `existe/atleta_id` (anti-oráculo). `tentativas_busca_cpf` (RLS on, service_role-only; anon *permission denied*). **HMAC (pgcrypto) mora em `extensions`.** Hash de referência pra cross-check do edge na Fatia 3 — CPF de teste `11144477735` → `1ff4c79ebe35a3eb011e38e1fcb2035226065dd033540bc620a6a7e33d7e2f75` (o edge com `crypto.subtle` HMAC-SHA256(cpf, pepper) deve bater exatamente).
- **Fatia 3 — ✅ FEITA (athlete-action v16, deployada, provada AO VIVO).** INSCREVER retrocompatível: sem CPF, fluxo idêntico ao de hoje (`cpf_verificado:false`=default). Com CPF: normaliza 11díg + DV no servidor (rejeita sequências), HMAC no edge (`crypto.subtle`, pepper via `get_cpf_pepper`), rate-limit por IP, dedup via `dedup_por_cpf_hash`, grava `atleta_documento` (hash + consentimento em/versão/IP + data_nascimento + responsável-hash p/ menor) e seta `cpf_verificado`; corrida no UNIQUE desfaz o atleta (sem órfão). CPF nunca em SQL/log/erro (só o hash). **Prova ao vivo (BH, com limpeza):** inscrição com CPF de teste → `sucesso`; `atleta_documento.cpf_hash` **== referência `1ff4c79e…`** (HMAC do edge bate com o do banco), `cpf_verificado=true`, consentimento+IP gravados; 2ª inscrição mesmo CPF → **409 `cpf_duplicado`**; CPF inválido → **400 `cpf_invalido`** (nenhum dos dois criou atleta). Tudo apagado depois; BH byte-idêntico (hash 43-col `3f4f9540…`), 0 docs, 0 resíduo. **Decisões Juliano:** duplicado mostra "já existe cadastro — entre pelo acesso" (front traduz o código `cpf_duplicado`); controlador = PF por enquanto (texto na Fatia 4).
- **Fatia 4 — ✅ FEITA (deployada + smoke ao vivo OK).** Verificado em produção: app carrega sem erro; campos CPF+data renderizam; máscara ok; CPF inválido bloqueia e válido libera; passo 2 mostra o consentimento específico de CPF, "não coletamos CPF" corrigido, controlador visível, e "Continuar" exige os dois aceites (só LGPD não basta). Sem submit (0 resíduo). CPF agora é obrigatório em toda inscrição nova. `InscricaoForm`: passo 1 ganhou **CPF** (máscara + DV no cliente, `cpfDVFront`) e **data de nascimento**; se menor de 18 → nome + CPF do **responsável**. Passo 2: corrigido o texto "não coletamos CPF" (agora coletamos, cifrado) + bloco de **consentimento específico** de CPF com checkbox próprio (`aceiteCpf`), separado do LGPD genérico; "Continuar" exige os dois. Submit envia `cpf`, `dataNascimento`, `responsavelNome/Cpf`, `cpfConsent`, `cpfConsentVersao` (=`cpf-2026-08-v1`). Erros traduzidos: `cpf_duplicado` → "já existe cadastro, entre pelo acesso"; `cpf_invalido` → "confira os números". Balanço de delimitadores vs HEAD = 0. **CPF vira OBRIGATÓRIO pra toda inscrição nova assim que o front subir** (o servidor da Fatia 3 é retrocompat, mas o form passa a exigir). **PENDÊNCIAS:** confirmar com o Juliano o nome legal exato do controlador ("Juliano Strutzki" foi inferido do e-mail) e o canal de direitos; smoke ao vivo do form renderizando (não dá pra buildar no ambiente).
- **Fatia 5 — ✅ FEITA (athlete-action v17, deployada, provada AO VIVO).** Decisão Juliano: **exigir CPF de todos já** (sem flag/coluna nova — mais simples que o §6 original). O `INSCREVER` agora barra no servidor: sem CPF → `cpf_obrigatorio` (400); com CPF sem consentimento → `cpf_consentimento_obrigatorio` (400) — ambos antes de qualquer escrita (0 resíduo). É o backstop além do front. Prova ao vivo: os dois 400 retornaram e o BH ficou byte-idêntico (`3f4f9540…`), 0 docs, 0 tentativas. Controlador confirmado: **Juliano Strutzki (PF)**.
- **Backfill (decisão Juliano):** NÃO haverá prompt separado de "complete seu CPF". O CPF dos 15 atuais é recolhido **quando eles se inscreverem num circuito novo** (inscrições abertas) — o INSCREVER já exige. Isso depende do fluxo **"Participar"** (atleta existente entra em 2º circuito): casar o atleta por telefone/CPF → anexar `atleta_documento` ao atleta EXISTENTE + criar só `circuito_atletas`, **sem duplicar atleta nem rating**. ~~Enquanto o "Participar" não existir, os atuais seguem por telefone (cpf_verificado=false).~~
  ✅ **Corrigido em 29/09/2026 (noite): o "Participar" EXISTE** — está no `login-atleta` e é executado pela bateria desde 27/09/2026 (**151 asserções** em `testes/participar-outro-circuito.mjs`, rodando a função de verdade: aceite do regulamento declarado, comparação com a versão do circuito, responsável legal obrigatório para menor de 18, e as duas funções de banco `get_cpf_pepper`/`dedup_por_cpf_hash`). Ele usa as duas RPCs desta spec, então o caminho do §3 está exercitado por teste.
  ⚠️ **O que o backfill ainda espera não é o "Participar" — é o 2º circuito.** O BH era de teste e **encerrou** (Juliano, 29/09/2026), então os 15 atuais só entregam CPF quando houver circuito novo aberto para eles entrarem. Até lá seguem com `cpf_verificado = false`, e agora com um motivo diferente do que esta linha dizia.

## Princípio
CPF = chave de dedup nacional (estável, único por pessoa). Telefone = login/contato (inalterado). CPF é **dado sensível (LGPD)** → blindagem máxima.

## 1. Armazenamento — tabela separada + HMAC (não guardar CPF em claro)
CPF vive **fora** de `atletas`/`circuito_atletas` (que são lidos por `anon` via grant de coluna + join do 4C). Tabela dedicada:
```
public.atleta_documento
  atleta_id  uuid PK/FK -> atletas(id) ON DELETE CASCADE
  cpf_hash   text NOT NULL UNIQUE        -- HMAC-SHA256(cpf, pepper) — chave de dedup
  cpf_cifrado bytea NULL                 -- SÓ na fase 2, se recibo/nota exigir (pgcrypto/Vault)
  cpf_consent_em timestamptz, cpf_consent_versao text, cpf_consent_ip text
  data_nascimento date NULL              -- p/ identificar menores (lacuna atual do schema)
  responsavel_nome text NULL, responsavel_cpf_hash text NULL   -- menores
  criado_em, atualizado_em
```
- **Matching por HMAC-SHA256 com PEPPER secreto** — NUNCA SHA-256 puro (keyspace de CPF é pequeno → força bruta em segundos) nem salt-por-linha (quebraria o dedup determinístico).
- **Hash calculado no EDGE (Deno `crypto.subtle`)** — o CPF cru **nunca** entra em statement SQL (não vaza em query_logs) nem chega ao cliente com o pepper.
- **Pepper fora do banco:** secret de edge (`Deno.env`) e/ou `supabase_vault` (instalado). Plano de rotação documentado.
- **Minimização:** só `cpf_hash` até existir base legal (fiscal) pro valor real. Só então `cpf_cifrado` (fase 2).

## 2. Quem lê
- **`anon`: nunca.** `atleta_documento` sem grant a anon/authenticated; RLS deny (sem policy permissiva). CPF/hash jamais no grant de `atletas`/`circuito_atletas` nem no join 4C.
- **Organizador/admin: nunca o número.** No máximo um booleano **`cpf_verificado`** (não-reversível) em `atletas` pra UI mostrar "✓ CPF verificado".
- **service_role (edge): sim** — dedup, insert, (fase 2) decrypt.
- **Próprio atleta:** só via edge autenticado por PIN, **mascarado** (`***.***.***-NN`); completo só sob re-autenticação (direito LGPD).
- **RPCs de CPF:** `REVOKE EXECUTE FROM anon, authenticated, public` + GRANT só a service_role (Supabase concede EXECUTE a public por padrão — revogar).

## 3. Dedup seguro (anti-oráculo)
- RPC `dedup_por_cpf_hash(p_hash)` SECURITY DEFINER, service_role-only, recebe o **hash**, devolve só `existe` (+ `atleta_id` p/ login). **Nunca** vaza PII de quem já tem o CPF. (O RPC de telefone atual devolve a linha inteira — NÃO repetir esse defeito.)
- **Fluxo uniforme de 2 passos:** informa CPF → resposta idêntica exista ou não ("informe seu PIN"/"crie seu PIN"); identidade só confirmada **após PIN correto**. Sem PIN, ninguém aprende se um CPF está na base.
- Rate-limit em 2 camadas (tabela global tipo `tentativas_busca_cpf` + por IP/hash no edge).

## 4. Validação
Normalizar a 11 dígitos; **dígito verificador** no cliente E no servidor; rejeitar sequências inválidas; **UNIQUE no hash**; violação → erro genérico `cpf_duplicado`.

## 5. LGPD
Consentimento **específico** (separado do aceite_lgpd genérico) explicando finalidade; limitação de finalidade; minimização (hash-only; CPF nunca em log/erro/URL); retenção (ativo; fiscal 5 anos só do cifrado sob trava); direitos (acesso mascarado, correção, eliminação — purgar na exclusão); **menores** via responsável (requer data de nascimento).

⚠️ **Atualização de 29/09/2026 (noite) — o que saiu do plano e virou código:**
- **"purgar na exclusão" está IMPLEMENTADO**, e alcança o `cpf_hash`, a `data_nascimento` e
  os dados do responsável. Ver a seção "MUDANÇA DE PREMISSA" no topo — o preço está lá.
- **A exclusão MENTIA quando falhava**, e isso era pior que não excluir: os `delete` não
  checavam erro e rodavam **depois** do update que anonimiza, então uma falha deixava o CPF,
  destruía a identidade, respondia `sucesso: true` e — pior — `exclusao_solicitada_em` já
  tinha sido zerado, **o pedido sumia da fila do admin** e ninguém voltava lá. Hoje tudo o
  que pode falhar roda **antes**, cada falha **aborta inteira**, e o pedido **fica** na fila.
- **RETENÇÃO DE BACKUP: 6 MESES**, decidido pelo Juliano em 29/09/2026 — e a regra foi
  **escrita no código antes de entrar na política**, a pedido do Guardião Jurídico
  (*"escrever um prazo que não se cumpre é pior que não ter a frase"*). A
  `backup-clube-tenis-mesa` **não tinha retenção nenhuma**: 109 arquivos, o mais antigo de
  11/07/2026. As cópias contêm os dados **até serem substituídas pelo ciclo normal** e **não
  são usadas para restaurar cadastros individuais** — redação do Jurídico, na política de
  privacidade. ⚠️ **Inerte hoje:** o corte cai em 29/03, só morde em janeiro de 2027.
- ⚠️ **DADO SENSÍVEL FORA DO ESCOPO DESTA SPEC, e legível pelo anônimo hoje.** Esta spec
  blinda o CPF com rigor e **não cobre o outro dado sensível do app**: a **justificativa de
  W.O.**, texto livre onde cabe atestado médico. Em 29/09/2026 mediu-se que
  `partidas.motivo_rejeicao` tem `SELECT` para `anon`, que o BH é público, que **5 das 34
  partidas já carregam o texto**, e que `solicitacoes_wo` expõe ao `anon` a `justificativa`, o
  `comprovante_url` e os dois nomes. A anonimização passou a apagar a justificativa e o
  `RESPONDER_WO` passou a gravar só o rótulo — **mas a permissão de leitura continua aberta**,
  e fechá-la pede **migração** (o app lê a tabela com `select *`; tirar o grant de uma coluna
  quebraria a leitura inteira — a armadilha que já derrubou o app). **Está em
  `docs/ROADMAP.md`, "Decisões ainda em aberto", e é o item mais urgente de LGPD do projeto.**

## 6. Transição
1. Criar `atleta_documento` (RLS deny + revokes) + pepper + HMAC no edge.
2. `dedup_por_cpf_hash` + rate-limit + booleano `cpf_verificado`.
3. `cpf_hash` UNIQUE mas **NULLABLE** — atuais seguem por telefone; login inalterado.
4. `INSCREVER` valida/hasha CPF; matching: CPF se veio, senão telefone.
5. CPF **obrigatório** por **flag por circuito / data de corte** (não quebra legados).
6. Backfill gradual na renovação (checar unicidade antes de gravar).
7. Fase 2 (só com base legal): `cpf_cifrado` + RPC decrypt service_role-only.
- **Conflito CPF×telefone** (CPF é de X, telefone é de Y): **não** auto-mesclar → revisão manual.

## 7. Condições obrigatórias antes de implementar
1. CPF em tabela separada; nunca em atletas/circuito_atletas; RLS deny + revokes; fora do grant anon e do join 4C.
2. HMAC-SHA256 com pepper secreto (fora do DB), calculado no edge; UNIQUE no hash. Proibido SHA-256 puro/salt-por-linha.
3. Dedup service_role-only, resposta uniforme, identidade só após PIN; rate-limit duplo.
4. Organizador vê no máximo `cpf_verificado` (booleano).
5. DV cliente + servidor; normalização.
6. Consentimento LGPD específico + data de nascimento (menores).
7. Caminho de CPF não retorna `e.message` cru nem loga CPF; nunca CPF em SQL/URL.

## Achado bônus (pré-existente, fora do escopo CPF)
O RPC `buscar_atleta_por_telefone` devolve a **linha inteira do atleta (inclui telefone)** no match → é um oráculo: quem souber o telefone exato extrai o perfil. Registrar no backlog de segurança (não repetir no CPF; e considerar endurecer o de telefone).
