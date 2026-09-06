# Fase 4B — Parte acoplada (dual-write) · Análise de risco + plano

**Objetivo:** tornar o motor e a config multi-circuito (Modelo B: identidade/rating compartilhados, estado sazonal por circuito), **sem congelar nem alterar o circuito do BH em andamento.**

**Decisão que rege tudo (Modelo B):** uma pessoa = um cadastro em `atletas` (rating, login, foto, LGPD compartilhados). O que é da temporada de cada circuito (saldo, vitórias, pagamento, renovação, posição) mora em `circuito_atletas`, por circuito.

**Princípio de segurança nº 1:** enquanto o app ainda lê de `atletas`/`configuracao`, o servidor grava **nos dois lugares** (dual-write). O BH continua idêntico porque continua sendo alimentado exatamente como hoje; a versão nova (`circuito_atletas`/`circuitos`) é preenchida em paralelo, sem ninguém depender dela ainda.

**Princípio de segurança nº 2:** **nenhum segundo circuito é criado** enquanto qualquer leitura ainda misturar tenants. Até lá o sistema é single-tenant e o `DEFAULT = BH` garante que tudo cai no BH.

---

## 1. Mapa de colunas — identidade × sazonal

**Identidade (fica em `atletas`, compartilhada entre circuitos — NÃO muda):**
id, nome, telefone, apelido, federado, rating, rating_inicial, rating_pico, rating_historico, foto_url, estilo_jogo, aceite_lgpd, data_aceite_lgpd, inscrito_em (1º cadastro), atualizado_em, exclusao_solicitada_em, pin_hash, pin_definido_em, pin_tentativas, pin_bloqueado_ate.

**Sazonal / por-circuito (fonte da verdade passa a ser `circuito_atletas`):**
saldo_temp, vitorias, derrotas, vitorias_total, derrotas_total, wo_culposos_temporada, status, motivo_reprovacao, chave, pendente_circuito, ultima_recusa_circuito_em, aceite_regulamento, data_aceite_regulamento, versao_regulamento, pagamento_confirmado, pagamento_proxima_confirmado, desconto_pct, isento, quer_renovar, renovacao_em, inscrito_em (entrada neste circuito).

**Lacuna a corrigir:** `circuito_atletas` ainda **não** tem `historico` (jsonb — posições de temporadas passadas neste circuito) nem `posicao_historico` (jsonb — snapshots de posição no ranking). Ambas são por-circuito e o motor as usa. → **Adicionar as 2 colunas** em `circuito_atletas` (aditivo, na abertura da fase).

**Observação sobre rating:** como o rating é compartilhado, o motor continua gravando `rating`/`rating_pico`/`rating_historico` em `atletas` (isso serve a todos os circuitos). Só o que é da temporada do circuito vai pra `circuito_atletas`.

---

## 2. Estratégia dual-write (o que grava onde)

Durante a transição, cada ação que hoje grava estado sazonal em `atletas` passa a gravar **tanto** em `atletas` (mantém o BH vivo) **quanto** na linha de `circuito_atletas` daquele `(circuito_id, atleta_id)`. Idem config: grava em `configuracao` (id=1) **e** em `circuitos` (BH).

- **Leituras** de "ativos do circuito" passam a filtrar pela participação em `circuito_atletas` (quem é `circuito_id = X`). Pro BH, isso devolve os mesmos 15 → no-op.
- **Escritas de rating** (compartilhado) → só `atletas`, como hoje.
- **Escritas sazonais** → `atletas` **e** `circuito_atletas` (dual-write).
- **Config** → `configuracao` **e** `circuitos` (dual-write).

Quando o app migrar a leitura (passo 4C, depois) para `circuito_atletas`/`circuitos`, aí sim removemos o lado `atletas`/`configuracao` do dual-write (numa Fase 5 controlada). Até lá, nada no BH depende das tabelas novas.

---

## 3. Leituras que mudam (de `atletas` para "membros do circuito")

Hoje o motor faz `atletas WHERE status='ativo' AND pendente_circuito=false`. Passa a ser "atletas que são membros ativos **deste circuito**", via join com `circuito_atletas` (`circuito_id = X`). Os campos sazonais (saldo, vitórias, pendente, pagamento) passam a vir de `circuito_atletas`; os de identidade (rating, nome) continuam de `atletas`.

Sites afetados (todos hoje implicitamente BH): `promoverBacklog`, `INICIAR_ETAPA`, `AVANCAR_RODADA`, `PROCESSAR_RODADA`, `NOVA_TEMPORADA`, `INCLUIR_NO_CIRCUITO`, e as leituras de config em `INICIAR/AVANCAR/promoverBacklog/INCLUIR/ABRIR_PROXIMA/NOVA/DEFINIR_*`.

---

## 4. Inventário ação-por-ação (o que muda)

**Motor (rating + temporada) — dual-write sazonal + leitura por membro:**
- `PROCESSAR_RODADA` — lê ativos por membro; grava rating em `atletas`, e saldo/vitórias/derrotas/posicao_historico em `atletas` **e** `circuito_atletas`.
- `INICIAR_ETAPA` — lê membros; grava `chave`/fase; cria partidas (já carimba `circuito_id`); dual-write de `chave` e fase.
- `AVANCAR_RODADA` — idem; escopar leituras de partidas por `circuito_id`.
- `NOVA_TEMPORADA` — a virada: zera sazonais e carrega `historico` — dual-write; **escopar** o `delete` de partidas/chaves por `circuito_id` (hoje apaga tudo → precisa ser só do circuito); `arquivar_partidas_temporada` por circuito.

**Membership / inscrição — dual-write:**
- `INSCRICAO_VALIDAR`, `INCLUIR_NO_CIRCUITO`, `RECUSAR_CIRCUITO`, `ARQUIVAR_ATLETA`, `EDITAR_ATLETA` (campo `pendente_circuito`), `INSCREVER` (athlete): status/pendente/motivo em `atletas` **e** `circuito_atletas`.

**Financeiro / renovação — dual-write:**
- `REGISTRAR_PAGAMENTO`, `ESTORNAR_PAGAMENTO` (flags de pagamento), `DEFINIR_DESCONTO_ATLETA` (desconto/isento), `RENOVAR` (athlete, quer_renovar): em `atletas` **e** `circuito_atletas`.

**Config — dual-write `configuracao` + `circuitos`:**
- `DEFINIR_CONFIG_CIRCUITO`, `DEFINIR_FINANCEIRO`, `DEFINIR_RODADAS`, `DEFINIR_AUTO_VALIDAR`, `ABRIR_PROXIMA_TEMPORADA`, `CANCELAR_PROXIMA`, e a parte de config do `NOVA_TEMPORADA`.

**RPCs:**
- `preco_temporada_atleta` — passa a ler desconto/isento de `circuito_atletas` (por circuito) + valores de `circuitos`.
- `arquivar_partidas_temporada` — escopar por `circuito_id`.
- `buscar_atleta_por_telefone` (login) — identidade, permanece por `atletas` (não muda).

**Não mudam:** `ENVIAR_PLACAR`, `VALIDATE_RESULT`, `ADMIN_IMPUTAR_RESULTADO`, `DESFAZER_VALIDACAO`, `APLICAR_WO`, `MARCAR_*`, `LISTAR_*` (já tratados no 4A ou operam por id único de partida/pagamento).

---

## 5. Ordem de execução (cada sub-passo testável, BH intocado)

1. **DB aditivo:** adicionar `historico` e `posicao_historico` em `circuito_atletas` + re-sincronizar `circuito_atletas` a partir de `atletas` (foto fresca antes de ligar o dual-write).
2. **Servidor — dual-write de escrita** (sazonal + config), mantendo as **leituras ainda em `atletas`/`configuracao`**. Deploy. Efeito no BH: **zero** (continua lendo e gravando em `atletas`; só ganha uma gravação-espelho a mais). Testar footprint-zero.
3. **Servidor — leituras por membro/circuito** (motor passa a ler de `circuito_atletas`, com os dois lados já sincronizados pelo passo 2). Deploy. Pro BH, devolve o mesmo conjunto → no-op. Testar.
4. **App (4C) — leitura de `circuito_atletas`/`circuitos`** com `circuito_id` do circuito ativo (fixo em BH). Ainda sem seletor. Testar.
5. **Encerrar dual-write** (Fase 5): remover o lado `atletas`/`configuracao` das escritas quando ninguém mais o lê. Só então dropar colunas/`configuracao`.

Entre 2 e 3, o BH roda sobre `atletas` (fonte da verdade); as tabelas novas são preenchidas em paralelo e **verificadas** contra `atletas` antes de virar a chave da leitura.

---

## 6. Como testar sem tocar no BH

- **Consistência do dual-write:** após o passo 2, rodar um comparador SQL que confirma que, pra cada atleta do BH, os campos sazonais em `atletas` e em `circuito_atletas` são **iguais**. Qualquer divergência = bug do dual-write, antes de qualquer leitura depender disso.
- **Footprint-zero:** cada deploy passa pelo build (erro de sintaxe não sobe); e como só existe BH, toda leitura escopada devolve o mesmo conjunto.
- **Circuito-teste:** só depois do passo 3 verde, criar um circuito descartável (Sistema A) e exercitar o motor nele — as escritas caem só nas linhas de `circuito_atletas`/`partidas` daquele tenant; o BH (outro `circuito_id`) não é tocado. Verificar que o BH não mudou (comparação vs snapshot). Apagar o teste no fim.

---

## 7. Rollback

- Cada deploy de edge function reverte pra versão anterior (tenho v35/v8 salvos, e as intermediárias ficam versionadas).
- DB aditivo (2 colunas) é reversível por `DROP COLUMN`.
- App via git.
- O dual-write **nunca remove** o lado `atletas`/`configuracao` até a Fase 5 — então, a qualquer momento antes disso, desligar o dual-write devolve o comportamento exatamente ao de hoje.
- Snapshot `backup_pre_mc` continua de pé.

---

## 8. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Dual-write divergir (grava num lado e não no outro) | Cada ação grava os dois lados na mesma requisição; comparador SQL de consistência após o passo 2, antes de qualquer leitura nova. |
| Leitura por membro devolver conjunto diferente no BH | Passo 3 só entra após o passo 2 provado idêntico; footprint-zero confirma mesmo conjunto (15 atletas). |
| `NOVA_TEMPORADA` apagar partidas de todos os circuitos | Escopar o `delete` por `circuito_id` (parte do passo 3); testado no circuito-teste, com o BH isolado. |
| App congelar (lê `atletas`, servidor grava só em `circuito_atletas`) | É justamente o que o dual-write impede: durante toda a transição o `atletas` continua sendo gravado. |
| Blindagem (`desconto_pct`/`isento`) vazar ao reabrir leitura | No 4C, reabrir só as colunas seguras de `circuito_atletas` (excluindo as duas), como já é em `atletas`. |
| Erro no motor de rating (o mais crítico) | O passo 2 não altera o cálculo do rating — só acrescenta a gravação-espelho; o cálculo em si só é revisitado no passo 3, com o circuito-teste como campo de prova antes de qualquer segundo circuito. |

---

## 9. Pontos a confirmar antes de codar

1. **`vitorias_total`/`derrotas_total` (recorde histórico) são por-circuito** (seu recorde naquele circuito) — confirmado pelo Modelo B. OK?
2. **`historico` de temporadas** também por-circuito (suas posições passadas naquele circuito). OK?
3. Ordem: começar pelo **passo 1 (DB aditivo)** + **passo 2 (dual-write de escrita, leituras inalteradas)** — o de menor risco, invisível pro BH — e parar pra validar a consistência antes do passo 3. OK?

---

**Status:** nada executado nesta fase. Documento para revisão. Assim que você aprovar (e confirmar os 3 pontos acima), começo pelo passo 1+2, que são invisíveis pro BH.
