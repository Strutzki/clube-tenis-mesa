# Fase 4C — App lê do circuito ativo · Análise de risco + plano

**Objetivo:** o app passa a carregar os dados lendo de `circuito_atletas`/`circuitos` do **circuito ativo** (fixo em BH, sem seletor ainda), em vez de ler direto de `atletas`/`configuracao`. É a última peça da migração de leitura — sem ela o app nunca exibe um circuito ≠ BH. **Footprint-zero:** pro BH, as tabelas novas devolvem os mesmos dados (dual-write com 0 divergências + prova da Fase 0).

## 1. Estado atual (levantado)
- RLS **ligado** em `atletas`, `circuito_atletas`, `circuitos`.
- `circuito_atletas` e `circuitos`: **sem policies e sem grants pro anon** → hoje o app (anon) **não lê nada** delas. São só-escrita via service_role (edge functions). Foi assim que a blindagem (item 40) fechou o furo.
- `atletas` é lido pelo app por **grant de coluna** (sem `desconto_pct`/`isento` — blindados).
- O app lê hoje: `db.getAtletas()` (tabela `atletas`, select explícito sem as sensíveis), `db.getConfig()` (`configuracao?id=eq.1`), `db.getPartidas()`, `db.getChaves()`, `db.getSolicitacoesWo()`, `db.getMensagensEnviadas()`.

## 2. O ponto crítico (segurança — a reabertura da leitura)
Pra 4C, precisamos reabrir leitura de `circuito_atletas`/`circuitos` pro anon — **com a mesma blindagem de `atletas`**:
- **Grants de COLUNA** (nunca table-level), exatamente o mesmo conjunto seguro que o app já lê de `atletas`, **excluindo `desconto_pct` e `isento`** em `circuito_atletas`.
- **RLS policy de SELECT** pro anon nessas tabelas (leitura pública do roster/estado sazonal), como já existe a policy de leitura pública em `partidas_historico`.
- Confirmar, com teste anon real, que `desconto_pct`/`isento` **continuam invisíveis** (blindagem intacta) e que nenhuma coluna sensível vaza.

Risco nº 1 = reabrir de forma frouxa (table grant / policy ampla) e re-expor o que a blindagem fechou. Mitigação = coluna-a-coluna + teste anon + revisão do Guardião.

## 3. O que muda nas leituras (inventário)
- `getAtletas()` → `circuito_atletas?circuito_id=eq.<BH>&select=<sazonais seguros>,atletas(<identidade segura>)` e o `mapAtletaFromDb` passa a montar a partir do join (identidade de `atletas`, sazonal de `circuito_atletas`) — espelhando o `mergeAtletaCircuito` do servidor.
- `getConfig()` → `circuitos?id=eq.<BH>` (mesmos nomes de coluna).
- `getPartidas()` / `getChaves()` → acrescentar `circuito_id=eq.<BH>` (já têm a coluna).
- `getSolicitacoesWo()` / `getMensagensEnviadas()` → escopar por `circuito_id` (já carimbadas no 4A).
- O `circuito_id` ativo entra como constante (BH) num único ponto de config do front — depois vira o seletor (4D).

## 4. Footprint-zero (como provo)
- **Antes do deploy:** comparador SQL confirma, atleta a atleta e campo a campo, que o roster/estado do BH via `circuito_atletas` == via `atletas` (já rodou com 0 divergências; re-rodar).
- **Depois do deploy:** o app carrega os mesmos 15 atletas, mesma config, mesmas partidas/chaves. Prints/diff da tela vs antes.
- Build do Vercel é o portão de sintaxe.

## 5. Ordem de execução (cada passo reversível, BH intocado)
1. **DB (aditivo, invisível pro app atual):** criar RLS policy de SELECT anon + grants de coluna seguros em `circuito_atletas`/`circuitos`. O app hoje lê das tabelas antigas, então isso **não muda nada** pra ele ainda — só habilita a leitura nova. Testar com anon que as sensíveis não vazam.
2. **Front:** trocar as leituras do `db.*` + `mapAtletaFromDb` pra montar do join. Deploy só depois do comparador verde.
3. **Footprint-zero + deploy.**
4. **Manter o dual-write** (Fase 5, depois, remove o lado antigo — só quando ninguém mais o lê).

## 6. Riscos e mitigações
| Risco | Mitigação |
|---|---|
| Reabrir leitura e vazar `desconto_pct`/`isento` (blindagem) | Grant de COLUNA excluindo as duas + RLS policy só de SELECT + teste anon real. Revisão do Guardião. |
| App congelar (lê tabela nova vazia/dessincronizada) | Dual-write mantém `circuito_atletas`/`circuitos` em sincronia; comparador prova 0 divergências ANTES de virar a leitura. |
| Join `circuito_atletas→atletas` devolver conjunto diferente | Footprint-zero: mesmos 15 atletas do BH; comparador campo a campo. |
| Sintaxe/erro no front derrubar o app | Brace-check + build do Vercel; e o `atualizar.sh` só sobe se buildar. |
| Precisar reverter | Reverter o front por git; as policies/grants novos podem ser `DROP POLICY`/`REVOKE` sem afetar o BH (que volta a ler das antigas); dual-write nunca parou de alimentar os dois lados. |

## 7. Rollback
- Front via git.
- DB: `DROP POLICY` + `REVOKE` das leituras novas (aditivas) devolve o estado atual.
- Dual-write intacto o tempo todo → desligar a leitura nova = comportamento de hoje.
- Snapshot `backup_pre_mc` de pé.

## 8. Condições do Guardião (GO-com-condições — obrigatórias)
Validado com SQL real. Provas: RLS ligado nas 5 tabelas; `atletas` é blindado por grant de COLUNA (padrão a copiar); `configuracao`/`partidas_historico` usam grant TABLE-LEVEL (NÃO replicar); footprint-zero BH = 15/15, 0 divergências; FK `circuito_atletas.atleta_id→atletas` e UNIQUE(circuito_id,atleta_id) existem.

1. **Excluir TRÊS colunas** no grant de `circuito_atletas` (não duas): `desconto_pct`, `isento` **e `wo_culposos_temporada`** (essa não é anon no `atletas` hoje — incluí-la ampliaria exposição). Grant de coluna com as 23 seguras: id, circuito_id, atleta_id, status, motivo_reprovacao, pendente_circuito, ultima_recusa_circuito_em, chave, saldo_temp, vitorias, derrotas, vitorias_total, derrotas_total, aceite_regulamento, data_aceite_regulamento, versao_regulamento, pagamento_confirmado, pagamento_proxima_confirmado, quer_renovar, renovacao_em, inscrito_em, historico, posicao_historico → `anon, authenticated`.
2. **`circuitos`: grant de COLUNA** (não table-level), listando todas as colunas não-sensíveis que o app lê (evita foot-gun de coluna nova auto-exposta, como acontece no `configuracao`). `pix_chave` já é público hoje via `configuracao` (paridade). `temporada`/`admin_bio_cred_ids` de `configuracao` não afetam (o app usa temporada_numero/ano; admin_bio_cred_ids é lido por chamada separada que o 4C não toca).
3. **Duas policies de SELECT** `TO public USING (true)`, molde `partidas_historico`: `leitura_publica_circuito_atletas` e `leitura_publica_circuitos`.
4. **Front:** montar do join respeitando `mergeAtletaCircuito` (sazonal de `circuito_atletas`, identidade do `atletas` aninhado); `wo_culposos_temporada`→0; **select explícito** (nunca `select=*`, que dá 401 sob grant de coluna).
5. **Teste anon REAL pós-DDL** (com a publishable key ou SET LOCAL ROLE anon): as 3 sensíveis → 401; roster BH via join → 15 linhas; PATCH/POST anon → negado. `NOTIFY pgrst,'reload schema'` após o DDL.
6. **Ordem de rollback:** SEMPRE front primeiro (git), depois `DROP POLICY`/`REVOKE`. Reverter DB com front novo no ar quebra o app.

## 9. Passo 2 — código do front PRONTO (aplicar DEPOIS da rodada; NÃO editar App.jsx antes)
> Não editar o `App.jsx` até a hora de virar a chave — o `atualizar.sh` faz `git add -A` e subiria a 4C sem querer. Estes snippets ficam aqui pra colar no momento certo, com o comparador verde na hora.

**a) Constante do circuito ativo** (perto de SUPA_URL):
```js
const CIRCUITO_ATIVO = "272dd67c-ea33-41a3-8fb9-1fd909d7f3fa"; // BH — depois vira o seletor (4D)
```

**b) `db.getAtletas`** — passa a ler de `circuito_atletas` com `atletas` aninhado, select EXPLÍCITO (nunca `select=*`):
```js
getAtletas: () => supaFetch(`circuito_atletas?circuito_id=eq.${CIRCUITO_ATIVO}&order=atletas(rating).desc&select=status,motivo_reprovacao,pendente_circuito,ultima_recusa_circuito_em,chave,saldo_temp,vitorias,derrotas,vitorias_total,derrotas_total,aceite_regulamento,data_aceite_regulamento,versao_regulamento,pagamento_confirmado,pagamento_proxima_confirmado,quer_renovar,renovacao_em,inscrito_em,historico,posicao_historico,atletas(id,nome,federado,rating,rating_inicial,apelido,foto_url,estilo_jogo,aceite_lgpd,data_aceite_lgpd,atualizado_em,rating_pico,rating_historico,exclusao_solicitada_em,bio_cred_ids)`),
```

**c) Novo mapper** (reaproveita o `mapAtletaFromDb`; espelha o `mergeAtletaCircuito` do servidor):
```js
function mapAtletaFromCircuito(ca) {
  const a = ca.atletas || {};
  return mapAtletaFromDb({
    ...a, id: a.id,
    status: ca.status, motivo_reprovacao: ca.motivo_reprovacao,
    pendente_circuito: ca.pendente_circuito, ultima_recusa_circuito_em: ca.ultima_recusa_circuito_em,
    chave: ca.chave, saldo_temp: ca.saldo_temp, vitorias: ca.vitorias, derrotas: ca.derrotas,
    vitorias_total: ca.vitorias_total, derrotas_total: ca.derrotas_total,
    aceite_regulamento: ca.aceite_regulamento, data_aceite_regulamento: ca.data_aceite_regulamento,
    versao_regulamento: ca.versao_regulamento,
    pagamento_confirmado: ca.pagamento_confirmado, pagamento_proxima_confirmado: ca.pagamento_proxima_confirmado,
    quer_renovar: ca.quer_renovar, renovacao_em: ca.renovacao_em,
    inscrito_em: ca.inscrito_em, historico: ca.historico, posicao_historico: ca.posicao_historico,
    // wo_culposos_temporada NÃO vem no read público -> mapAtletaFromDb faz ||0 (paridade com hoje)
  });
}
```
E no load (linha ~3593): `const athletesMapped = (atletas||[]).map(mapAtletaFromCircuito);`

**d) `db.getConfig`** — de `configuracao?id=eq.1` para `circuitos` do circuito ativo (mesmos nomes de coluna):
```js
getConfig: () => supaFetch(`circuitos?id=eq.${CIRCUITO_ATIVO}`),
```
(o `config?.[0]?.fase|temporada_numero|...` continua igual — `circuitos` tem os mesmos campos.) **Não** mexer no `buscarAdminBioCredIds` (segue lendo `configuracao` — biometria admin intacta).

**e) `db.getPartidas` / `db.getChaves` / `db.getSolicitacoesWo`** — escopar por circuito:
```js
getPartidas: () => supaFetch(`partidas?circuito_id=eq.${CIRCUITO_ATIVO}&order=rodada.asc,criado_em.asc`),
getChaves:   () => supaFetch(`chaves?circuito_id=eq.${CIRCUITO_ATIVO}&order=id.asc`),
getSolicitacoesWo: () => supaFetch(`solicitacoes_wo?circuito_id=eq.${CIRCUITO_ATIVO}&order=criado_em.desc&limit=200`),
```
(mensagens_enviadas já é carregada via admin-action escopada — não muda aqui.)

**f) Verificação antes do deploy:** rodar o comparador SQL (BH via circuito_atletas == via atletas, 0 divergências) NA HORA; brace-check no App.jsx; e o teste anon do Passo 1 já feito. Deploy só com tudo verde.

## Status
Tudo **preparado, nada executado**. Pronto pra aplicar assim que o Juliano fechar a rodada em andamento:
- Passo 1: rodar `fase4c_reabrir_leitura.sql` + teste anon.
- Passo 2: colar os snippets acima no `App.jsx` + comparador + `atualizar.sh`.
- Rollback sempre front-primeiro, depois DB.
