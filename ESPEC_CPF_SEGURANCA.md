# Especificação de segurança — CPF como identidade nacional
Validada pelo Guardião (supervisionado, Opus). **VEREDITO: GO-com-condições.** spec para guiar o código.

## STATUS de implementação
- **Fatia 1 — ✅ FEITA (migração aplicada, verificada).** `atleta_documento` criada (RLS on, 0 policies = deny-all, `revoke all` de anon/authenticated/public, `grant all` a service_role, FK cascade). `atletas.cpf_verificado boolean default false` + **grant de coluna** a anon/authenticated (senão o `select=*` quebraria). Provas: anon lê `cpf_verificado` (15/15) mas leva *permission denied* em `atleta_documento`; dados originais do `atletas` byte-idênticos (hash 43-col `3f4f9540…` inalterado). Só schema — BH intocado.
- **Fatia 2 — ✅ FEITA (migração aplicada, verificada).** Pepper de 64 hex no `supabase_vault` (gerado no banco, nunca em código/log). `get_cpf_pepper()` e `dedup_por_cpf_hash(text)` são SECURITY DEFINER com `search_path=''`, `revoke all` de public/anon/authenticated e `grant execute` só a service_role — anon leva *permission denied* nas duas. `dedup` devolve só `existe/atleta_id` (anti-oráculo). `tentativas_busca_cpf` (RLS on, service_role-only; anon *permission denied*). **HMAC (pgcrypto) mora em `extensions`.** Hash de referência pra cross-check do edge na Fatia 3 — CPF de teste `11144477735` → `1ff4c79ebe35a3eb011e38e1fcb2035226065dd033540bc620a6a7e33d7e2f75` (o edge com `crypto.subtle` HMAC-SHA256(cpf, pepper) deve bater exatamente).
- **Fatia 3 — ✅ FEITA (athlete-action v16, deployada, provada AO VIVO).** INSCREVER retrocompatível: sem CPF, fluxo idêntico ao de hoje (`cpf_verificado:false`=default). Com CPF: normaliza 11díg + DV no servidor (rejeita sequências), HMAC no edge (`crypto.subtle`, pepper via `get_cpf_pepper`), rate-limit por IP, dedup via `dedup_por_cpf_hash`, grava `atleta_documento` (hash + consentimento em/versão/IP + data_nascimento + responsável-hash p/ menor) e seta `cpf_verificado`; corrida no UNIQUE desfaz o atleta (sem órfão). CPF nunca em SQL/log/erro (só o hash). **Prova ao vivo (BH, com limpeza):** inscrição com CPF de teste → `sucesso`; `atleta_documento.cpf_hash` **== referência `1ff4c79e…`** (HMAC do edge bate com o do banco), `cpf_verificado=true`, consentimento+IP gravados; 2ª inscrição mesmo CPF → **409 `cpf_duplicado`**; CPF inválido → **400 `cpf_invalido`** (nenhum dos dois criou atleta). Tudo apagado depois; BH byte-idêntico (hash 43-col `3f4f9540…`), 0 docs, 0 resíduo. **Decisões Juliano:** duplicado mostra "já existe cadastro — entre pelo acesso" (front traduz o código `cpf_duplicado`); controlador = PF por enquanto (texto na Fatia 4).
- **Fatia 4 — ✅ FEITA (deployada + smoke ao vivo OK).** Verificado em produção: app carrega sem erro; campos CPF+data renderizam; máscara ok; CPF inválido bloqueia e válido libera; passo 2 mostra o consentimento específico de CPF, "não coletamos CPF" corrigido, controlador visível, e "Continuar" exige os dois aceites (só LGPD não basta). Sem submit (0 resíduo). CPF agora é obrigatório em toda inscrição nova. `InscricaoForm`: passo 1 ganhou **CPF** (máscara + DV no cliente, `cpfDVFront`) e **data de nascimento**; se menor de 18 → nome + CPF do **responsável**. Passo 2: corrigido o texto "não coletamos CPF" (agora coletamos, cifrado) + bloco de **consentimento específico** de CPF com checkbox próprio (`aceiteCpf`), separado do LGPD genérico; "Continuar" exige os dois. Submit envia `cpf`, `dataNascimento`, `responsavelNome/Cpf`, `cpfConsent`, `cpfConsentVersao` (=`cpf-2026-08-v1`). Erros traduzidos: `cpf_duplicado` → "já existe cadastro, entre pelo acesso"; `cpf_invalido` → "confira os números". Balanço de delimitadores vs HEAD = 0. **CPF vira OBRIGATÓRIO pra toda inscrição nova assim que o front subir** (o servidor da Fatia 3 é retrocompat, mas o form passa a exigir). **PENDÊNCIAS:** confirmar com o Juliano o nome legal exato do controlador ("Juliano Strutzki" foi inferido do e-mail) e o canal de direitos; smoke ao vivo do form renderizando (não dá pra buildar no ambiente).
- **Fatia 5 — ✅ FEITA (athlete-action v17, deployada, provada AO VIVO).** Decisão Juliano: **exigir CPF de todos já** (sem flag/coluna nova — mais simples que o §6 original). O `INSCREVER` agora barra no servidor: sem CPF → `cpf_obrigatorio` (400); com CPF sem consentimento → `cpf_consentimento_obrigatorio` (400) — ambos antes de qualquer escrita (0 resíduo). É o backstop além do front. Prova ao vivo: os dois 400 retornaram e o BH ficou byte-idêntico (`3f4f9540…`), 0 docs, 0 tentativas. Controlador confirmado: **Juliano Strutzki (PF)**.
- **Backfill (decisão Juliano):** NÃO haverá prompt separado de "complete seu CPF". O CPF dos 15 atuais é recolhido **quando eles se inscreverem num circuito novo** (inscrições abertas) — o INSCREVER já exige. Isso depende do fluxo **"Participar"** (atleta existente entra em 2º circuito): casar o atleta por telefone/CPF → anexar `atleta_documento` ao atleta EXISTENTE + criar só `circuito_atletas`, **sem duplicar atleta nem rating**. Enquanto o "Participar" não existir, os atuais seguem por telefone (cpf_verificado=false).

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
