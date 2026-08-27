# Especificação de segurança — CPF como identidade nacional
Validada pelo Guardião (supervisionado, Opus). **VEREDITO: GO-com-condições.** Nada implementado — spec para guiar o código.

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
