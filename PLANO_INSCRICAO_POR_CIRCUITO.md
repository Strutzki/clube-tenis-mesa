# Inscrição por circuito / região — mini-spec

**Objetivo:** o atleta clica em "Inscreva-se", vê os circuitos **com inscrições abertas na sua região**, escolhe um e se inscreve nele (fica pendente → o admin daquele circuito aprova). Resolve o buraco de hoje (a inscrição sempre cai no BH).

**Prioridade absoluta: footprint-zero pro BH.** Com só o BH existindo, o fluxo continua de um toque; nada muda pro atleta do BH.

---

## Princípios de design (decididos)
- **"Inscrições abertas" é uma flag do admin**, desacoplada de "em andamento". Um circuito aceita inscrição na pré-temporada E durante (respeitando a regra do último terço). O gatilho é a flag + a fase — não "estar rodando".
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
2. **Leitura dos circuitos abertos.** Consulta pública segura dos circuitos com `inscricoes_abertas=true` (campos públicos). *Verificar: anon lê; não vaza campo interno.*
3. **Tela de seleção na inscrição.** "Inscreva-se" → lista os abertos; trata 0/1/vários; auto-seleção quando 1. *Verificar: com só o BH, vira um toque (idêntico a hoje).* 
4. **Região.** Campo cidade/UF na inscrição + filtro por região + confirmação leve. *Verificar: mismatch não trava; só informa.*
5. **Roteamento seguro do INSCREVER.** Front manda `circuitoId` escolhido; `athlete-action` **revalida** (existe + aberto + janela + vaga) antes de gravar. *Verificar: tentar inscrever num circuito fechado/inexistente → recusado no servidor.*
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
