# Inscrição por circuito / região — mini-spec

**Objetivo:** o atleta clica em "Inscreva-se", vê os circuitos **com inscrições abertas na sua região**, escolhe um e se inscreve nele (fica pendente → o admin daquele circuito aprova). Resolve o buraco de hoje (a inscrição sempre cai no BH).

**Prioridade absoluta: footprint-zero pro BH.** Com só o BH existindo, o fluxo continua de um toque; nada muda pro atleta do BH.

---

## Fluxo de entrada (decidido)
Ao apertar **"Inscreva-se"**, a PRIMEIRA coisa é **checar se há circuito aberto** — não abrir o formulário direto:
- **Nenhum aberto** → tela "não há circuitos abertos no momento" (+ captura de interesse). O formulário nem aparece.
- **Há aberto(s)** → tela de seleção (auto-seleciona se for só um) → confirmação de região → formulário.
> O corte por região (Fatia 4) é um SEGUNDO filtro, aplicado depois dessa checagem de existência.

## Princípios de design (decididos)
- **"Inscrições abertas" é uma flag do admin**, desacoplada de "em andamento". Um circuito aceita inscrição na pré-temporada E durante (respeitando a regra do último terço). O gatilho é a flag + a fase — não "estar rodando".
- **Sistema (A/B) é propriedade do circuito, não escolha do atleta.** O atleta escolhe um circuito; o sistema vem junto. Ele vê o modelo pela primeira vez no **card de seleção** (selo "Rating (A)" / "Pontos (B)" + 1 linha). A comparação A x B fica na **descoberta** ("Entenda os dois modelos"), fora do fluxo de inscrição.
- **Regulamento é o do circuito escolhido.** Antes de confirmar, o atleta lê a RegulamentoView ramificada pelo `sistema` + `regulamento_versao` daquele circuito (não um genérico).
- **Aceite carimbado pelo servidor (integridade).** O cliente NÃO manda a versão aceita. No `INSCREVER`, o servidor lê `circuitos.regulamento_versao` (fonte da verdade) e carimba versão + data no aceite (em `circuito_atletas`: `aceite_regulamento`, `data_aceite_regulamento`, `versao_regulamento`). Aceite é **snapshot** — atualizar o regulamento depois não mexe em quem já aceitou. (Entra na Fatia 5.)
- **Gap a corrigir junto:** hoje o `CRIAR_CIRCUITO` seta `regulamento_versao` = `v03-12` (A) / `null` (B) — precisa virar a variante A-sem-torneio e a `vB-01`; e cabear a `RegulamentoView` por sistema/versão. Pré-requisito do aceite correto.
- **Região = autodeclaração + confirmação leve.** O atleta declara cidade/UF; o app mostra os circuitos daquela região e pede uma confirmação informativa ("Você consegue jogar presencialmente em [cidade]?"). Sem GPS, sem trava rígida.
- **O admin é o gate real.** Toda inscrição entra pendente e o admin aprova — se alguém escolher a região errada, é barrado ali.
- **Casos da lista:** 0 circuitos → mensagem + captura de interesse; 1 → seleciona automático (um toque); vários → lista com nome + cidade + status.

## Modelo de dados
- **Nova coluna** `circuitos.inscricoes_abertas boolean not null default false` (BH = `true` na migração).
- **Região:** já existe (`cidade`, `uf`). Talvez um `regiao_label` opcional pra exibição/agrupamento (região metropolitana).
- ⚠️ **Lição do incidente anterior:** qualquer coluna nova numa tabela lida pelo anon (`circuitos`) **precisa do GRANT na MESMA migração** (`grant select (inscricoes_abertas) on public.circuitos to anon, authenticated; notify pgrst,'reload schema'`), senão o `select=*` do app quebra com "permission denied".

## Segurança (não negociável)
- **O servidor valida o circuito escolhido.** O `INSCREVER` não pode confiar no cliente: só aceita `circuitoId` de um circuito que existe E tem `inscricoes_abertas = true` E está dentro da janela (fase/último terço/vagas). Hoje o `INSCREVER` força `circuitoId = CIRCUITO_ATIVO`; passa a aceitar o escolhido, **revalidando no servidor**.
- **Leitura pública mínima:** a lista de circuitos abertos expõe só campos públicos (id, nome, cidade, uf, inscricoes_abertas, vagas?). Nada sensível.
- **Sem dado pessoal em query string;** cidade/UF autodeclarados vão no corpo da inscrição, como hoje.

## Fatias (ordem sugerida, cada uma verificada — footprint-zero no BH)
1. **Dado + flag + grant. — ✅ FEITA (backend deployado).** Migração aplicada: coluna `inscricoes_abertas` (BH=true) + GRANT column-level anon/authenticated + reload; verificado com `SET ROLE anon` (não quebra o `select=*`). Ação `DEFINIR_INSCRICOES_ABERTAS` grava direto em `circuitos` (evita o landmine do `configuracao` do BH) — **admin-action v45 ACTIVE**, BH data hash inalterado, marcadores conferidos. Novo circuito nasce com `inscricoes_abertas=false` (admin abre). Front: estado + reducer + toggle "📝 Inscrições abertas" no painel — **falta rodar `atualizar.sh`**.
2. **Leitura dos circuitos abertos. — ✅ FEITA (no arquivo local).** `db.getCircuitosAbertos()` lê `circuitos` com `ativo=true & inscricoes_abertas=true`, só campos públicos (id, slug, nome, cidade, uf, sistema).
3. **Tela de seleção na inscrição. — ✅ FEITA (no arquivo local).** `SelecaoCircuitoInscricao`: "Inscreva-se" checa os abertos ANTES do formulário; 0 → tela "sem circuitos abertos" (+ IG); 1 → auto-seleciona; vários → cards com selo Rating/Pontos. Fallback pro BH se a leitura falhar. O `circuitoId` escolhido é injetado no `INSCREVER` (via `chamarAtletaAction` que agora respeita `payload.circuitoId`). Sintaxe validada (delta de delimitadores 0/0/0 vs. commit). **Falta `atualizar.sh`.**

> ⚠️ **TRAVA OPERACIONAL até a Fatia 5:** só o **BH** deve ficar com inscrições abertas. O `athlete-action` (INSCREVER) ainda NÃO revalida/roteia/carimba para circuito não-BH — isso é a Fatia 5. Não ligar o toggle "Inscrições abertas" em nenhum circuito não-BH antes disso.
4. **Região.** Campo cidade/UF na inscrição + filtro por região + confirmação leve. *Verificar: mismatch não trava; só informa.*
5. **Roteamento seguro do INSCREVER. — ✅ FEITA (athlete-action v15, deployado).** Revalida no servidor: existe (404), ativo, `inscricoes_abertas`. Carimba `circ.regulamento_versao` (fallback constante). BH reconciliado v03-11→v03-12 antes; BH byte-idêntico (v03-12), data hash inalterado. Guardião: condições atendidas. `max_atletas` pulado de propósito (o teto é do backlog na promoção, não da inscrição). **Circuito fechado agora é recusado no servidor.**

## Regulamento do Sistema B — ✅ FEITO (front) / edge pendente
- `RegulamentoView` ramificada por `sistema`: A (v03-12, BH intocado) / B (vB-01, pontos) — 13 capítulos de pontos (ciclo, elegibilidade, pareamento+bye, pontuação V=2/D=1, W.O. por pontos, ranking+desempate, etc.).
- Tela de confirmação da inscrição ganhou **"Ver regulamento"** que abre a versão certa (A/B) do circuito escolhido.
- `CRIAR_CIRCUITO`: `regulamento_versao` do B = `vB-01` (era null) — **commitado no fonte, edge admin-action a deployar só quando for criar o 1º circuito B**.
- **P0 (consentimento) — ✅ RESOLVIDO:** o `InscricaoForm` agora recebe `sistema` e ramifica todos os textos A×B — versão do aceite, resumo do regulamento (bullets de pontos no B), texto LGPD (sem "rating de entrada" no B), e esconde a pergunta de federado/rating no B. Para A/BH renderiza o texto original idêntico. (Auditoria do Advogado do Atleta, revisão pós-integridade.)
- **Pendências do Advogado — ✅ FECHADAS:**
  - **P1 (W.O. no B) — ✅ AUTOMATIZADO (admin-action v47, deployado).** O motor de W.O. no B agora pontua sozinho: W.O. **não anula** — adversário +2 (V+1); ausente +1 se **justificado**, +0 se **culposo/a_favor** (sempre D+1). Culposo e a_favor contam `wo_culposos_temporada` (desempate + suspensão); justificado não conta. `APLICAR_WO`, `RESPONDER_WO` (aprovado pontua em vez de rejeitar) e o `PROCESSAR_RODADA` (quem pontuou por W.O. entra no ranking da rodada) ramificam por sistema. Caminho A/BH **byte-idêntico** (todos os ramos gated em `sistema==="B"`); BH data hash inalterado antes/depois do deploy. Lógica validada em harness (culposo→2/0, justificado→2/1, ranking A>C>B>D). O modal do atleta e o Cap. 07 do vB-01 podem sair do "🛠️ Em implementação" quando um circuito B for operar de fato.
  - **P2 (entrante tardio):** nota de transparência adicionada ao Cap. 02 do vB-01.
  - **P2 (desempate final):** mantido — "sorteio do admin" é a regra oficial pra um empate real de 6º nível (raríssimo); a ordem-de-id do código é só o desempate estável de exibição. Sem conflito.

> ✅ **TRAVA ATUALIZADA:** já é seguro abrir um circuito **Sistema A** não-BH para inscrição (servidor valida + carimba a versão dele). **Sistema B ainda NÃO:** `CRIAR_CIRCUITO` deixa `regulamento_versao=null` no B → carimbaria a constante A; e a `RegulamentoView` do front ainda mostra o regulamento do A. Antes de abrir um B: setar `vB-01` no CRIAR_CIRCUITO e cabear a RegulamentoView por sistema.
6. **Janela e vagas.** Respeitar regra do último terço e `max_atletas` (cheio → não aparece como aberto, ou aparece como "fila de espera"). *Verificar: circuito cheio/fora da janela não recebe inscrição.*
7. **(Opcional, depois) Captura de interesse** quando não há circuito na região — vira gancho de crescimento ("te aviso quando abrir perto de você").

## Footprint-zero pro BH (prova)
- BH = `inscricoes_abertas true`, região BH. Se ele for o único aberto na região do atleta → auto-seleção → fluxo de um toque, byte-idêntico ao atual. Nenhuma tela nova no caminho do BH quando não há outro circuito.

## Governança
- Agentes supervisores revisam cada fatia antes do deploy (Guardião da Segurança no roteamento do INSCREVER e no grant; Experiência do Admin no toggle; Designer/Marca na tela de seleção). Veredito documentado, como nas fases anteriores.

## Questões abertas (decidir no caminho)
- **Cidade exata x região metropolitana** — provável: agrupar por UF e exibir a cidade, ou um `regiao_label` por circuito (BH + Contagem + Betim = "Grande BH").
- **Circuito cheio:** esconder x mostrar como "fila de espera".
- **Preço/plano** (modelo pago futuro) aparece antes de inscrever? Fica pra fase de contas/pagamento — não nesta.
