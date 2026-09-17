# Roadmap — a fonte de verdade sobre o que fazer a seguir

Estado: **07/09/2026**. Este arquivo manda. Se outro documento discordar dele,
este está certo — ou este precisa ser corrigido. Consulte antes de propor
qualquer coisa, inclusive a seção **Fora do escopo** no fim, que registra o que
já foi decidido *não* fazer, e por quê.

Os planos das fases já concluídas estão em `historico/`, com o motivo de terem
saído de cena. Eles continuam valendo como registro de *por que* cada decisão
foi tomada.

## Onde estamos

O multi-circuito **está funcional de ponta a ponta no código** — criar circuito,
inscrever, parear, processar rodada, virar temporada, organizador com login
próprio, atleta em mais de um circuito. Mas **nenhum segundo circuito real
rodou ainda**: existe 1 circuito no banco (o BH), com 15 atletas.

Pronto tecnicamente, não validado em campo. Essa distinção importa em tudo que
for comunicado como pronto.

---

## Onda 0 — Dívidas que ninguém escolheu contrair

Não estavam em plano nenhum; apareceram ao mapear o banco e o repositório em
07/09/2026. Nenhuma é urgente hoje; todas cobram juros.

- **0.1 — A bateria cobre o motor e começou a cobrir o front.** São **154
  asserções** (`npm run teste`), ligadas ao `atualizar.sh`. O `src/App.jsx` saiu
  do zero: `pacote.mjs` (11) e `erros-na-tela.mjs` (12) leem o fonte e travam
  decisões. Falta cobrir: o resto do front, o `athlete-action`, o
  `login-atleta`, o pareamento (`INICIAR_ETAPA`/`AVANCAR_RODADA`), os desempates
  do ranking e o financeiro. O carregador já serve para todas — faltam as
  asserções. Ver `testes/README.md`.
- **0.2 — O Instagram não tem dono.** `instagram_config` guarda credenciais da
  Meta, `instagram_publicacoes` tem 42 publicações registradas, e nada disso
  aparece em plano, roadmap ou changelog. O token da Meta **expira a cada ~60
  dias** e nada avisa quando. Decidir: documentar e manter, ou desligar.
- **0.3 — Tabelas de tentativa só crescem.** `tentativas_login_admin` passou de
  mil linhas; `tentativas_busca_telefone` e `tentativas_busca_cpf` também não
  têm limpeza. Falta uma rotina que apague registro velho.
- **0.4 — `partidas_historico` sem chave primária.** Nada impede a mesma partida
  ser arquivada duas vezes numa virada de temporada repetida.
- **0.5 — Os mandatos dos agentes estão em dois lugares.** `.claude/agents/` (o
  que o Claude lê) e `docs/agente-*.md` (cópia). Vão divergir. Decidir quem é a
  cópia oficial e deixar só um.
- **0.6 — RPC `arquivar_partidas_temporada` virou código morto** depois que a
  virada passou a usar a versão escopada por circuito. Restringir ou remover.

## Onda 0.5 — O que os guardiões abriram em 07-08/09/2026

Tudo isto saiu de revisões supervisionadas destes dois dias, não de suposição.
Cada item diz o que é, por que importa e quando morde.

- **0.5.1 — As decisões de permissão do organizador não estão no ar.** ⬅️ *a mais séria*
  Em 07/09 o Juliano decidiu, item a item, tirar do organizador: `EXCLUIR_ATLETA`,
  `ABRIR_PROXIMA_TEMPORADA`, `CANCELAR_PROXIMA` e `DEFINIR_RODADAS`; e criar o
  portão `org_ve_financeiro` (padrão desligado) para as ações de dinheiro. Isso
  está no repositório e **não foi publicado** — a produção ainda concede tudo
  aquilo. Hoje é inofensivo: **zero organizadores cadastrados**. Vira falha de
  autorização no minuto em que existir o primeiro. **Publicar antes de nomear
  qualquer organizador.** Achado do Supervisor de Segurança.

- **0.5.2 — A conferência de senha devolve telefones.** O login do admin confere
  a senha chamando `LISTAR_ORGANIZADORES`, que devolve `nome` e `telefone` dos
  organizadores. Hoje volta vazio (zero organizadores). Criar uma ação
  `VERIFICAR_PIN` que só responde sim ou não. Cuidado de ordem: a função tem de
  subir **antes** do app que a chama.

- **0.5.3 — Teto de 200 mensagens.** `LISTAR_MENSAGENS` lê no máximo 200 linhas;
  só agosto gravou 165. Quando o teto estourar, mensagem antiga sai da janela e
  **volta a aparecer como pendente** — o sintoma de 08/09, por outra causa.
  Subir o limite ou escopar a leitura por mês.

- **0.5.4 — O token do atleta sobrevive ao logout.** `clearAtletaCred()` e
  `revogarSessaoAtleta()` existem em `src/App.jsx` e **nunca são chamadas**: ao
  sair, o token continua no aparelho e válido no servidor por 90 dias.

- **0.5.5 — Qualquer pessoa na internet pode trancar o painel.** O freio do PIN
  de admin conta falhas **globalmente**: 5 tentativas erradas de qualquer origem
  bloqueiam o painel por 15 minutos, inclusive para o Juliano. Avaliar contagem
  por origem. Aconteceu de verdade em 08/09.

- **0.5.6 — Falta `Vary: Origin`** nas respostas das Edge Functions. Sem ele, um
  cache intermediário pode servir a uma origem a resposta dada a outra. Risco
  baixo hoje (sem CDN na frente), uma linha para resolver.

- **0.5.7 — Decidir o destino do `localhost` na lista de origens.** Ou tentar o
  proxy do Vite (que exigiria tirar a URL fixa do `src/App.jsx:104`) e remover as
  linhas, ou registrar que ficam e por quê. Condição levantada e não cumprida.

- **0.5.8 — A bateria não testa o arquivo que vai ao ar.** `carregarFuncao` lê
  sempre `supabase/functions/<nome>/index.ts`. Enquanto o repositório estiver à
  frente da produção, o deploy é montado à mão e testá-lo exige trocar arquivos
  de lugar. Fazer `carregarFuncao` aceitar um caminho.

- **0.5.9 — Reconciliar a fila ao voltar do WhatsApp.** O `keepalive` faz o
  pedido chegar, mas não garante que a resposta seja processada — no iPhone a
  aba pode ser descartada. A prova real seria recarregar `mensagens_enviadas` do
  servidor quando a página volta a ficar visível. A verdade passaria a vir do
  banco, não da promessa.

## Onda 0.6 — Antes de nomear o primeiro organizador ⛔

O Juliano pretende nomear o primeiro organizador **em dias** (08/09/2026). A
rodada completa dos 6 guardiões, nesse mesmo dia, deu **NO-GO** para isso — não
para o código, que já foi ao ar na v58, mas para o ato de nomear. A lista abaixo
é o que falta, em ordem de quem trava o quê.

**Nada aqui é urgente enquanto o número de organizadores for zero.** Vira falha
real no minuto em que deixar de ser.

### Trava o organizador de trabalhar

- **0.6.1 — ✅ RESOLVIDO em 08/09/2026.** O app não mostrava os erros do
  servidor. `dispatchAndSync` grava a
  mensagem de erro sem ligar o estado que a barra de aviso lê, e o `dispatch`
  otimista já mudou a tela antes. Efeito: o organizador clica em excluir um
  atleta, o atleta some da lista, o servidor recusa com 403 e **nada aparece**.
  Ele acredita que excluiu. É uma linha de conserto, e enquanto ela não existir
  toda a proteção da v58 é invisível para quem esbarra nela. *(Experiência do Admin)*
- **0.6.2 — A tela de inscrições nunca carrega.** O organizador não pode ler
  telefones, então todo telefone fica em "carregando…" para sempre, sem
  mensagem, e o botão de WhatsApp fica morto. Cuidado ao corrigir:
  `LISTAR_TELEFONES` hoje devolve o telefone de **todos** os atletas da
  plataforma, sem filtro de circuito — precisa de uma versão escopada primeiro.
- **0.6.3 — Arquivar é porta de mão única.** Ele arquiva um atleta e não
  consegue desarquivar: o botão "Reativar" chama `EDITAR_ATLETA`, que ele não
  tem. Falta uma ação `DESARQUIVAR_ATLETA`.
- **0.6.4 — Ele decide W.O. sem ver a prova.** Abrir o comprovante do W.O.
  justificado exige o PIN do super-admin.
- **0.6.5 — A janela de pré-inscrição.** Perder `ABRIR_PROXIMA_TEMPORADA` não
  tira dele a virada de temporada (essa nunca foi dele) — tira a capacidade de
  **vender a temporada seguinte enquanto joga a atual**, 3 vezes por ano, com
  prazo colado (a renovação prioritária fecha 7 dias antes do início). Enquanto
  a janela estiver fechada, **o card "Quero renovar" não existe no app do
  atleta**. Pior: se a temporada virar sem essa janela ter sido aberta, todos os
  atletas viram como **não-pagos**. Desenho proposto: devolver a ação com filtro
  **por campo** — calendário livre, valores e chave PIX só com o portão ligado.

### Trava o atleta

- **0.6.6 — Com a cobrança ligada, o atleta pago fica fora do pareamento.** Só o
  super-admin confirma pagamento quando o portão está fechado, e o pareamento é
  fotografado no início da rodada: quem não estava confirmado naquele instante
  **perde a rodada inteira**. E os textos apontam para o lado errado — o card do
  atleta manda "combinar com o admin" e o botão do organizador diz "registre o
  pagamento antes de incluir", que é justamente o que ele não pode. *(Atleta)*

### Trava juridicamente

- **0.6.7 — Não há base formal para um terceiro tratar esses dados.**
  `TERMOS_ORGANIZADOR.md` é minuta declarada, com prazos em branco, **sem
  revisão de advogado**; `NOMEAR_ORGANIZADOR` grava três campos e **nenhum
  aceite** (o atleta tem aceite versionado com data — o organizador não tem
  nada); e o acervo dá **três respostas diferentes** sobre quem é o controlador.
  Isso precisa de advogado, não de código. *(Jurídico)*

### Fresta no portão do dinheiro

- **0.6.8 — Duas ações escapam do portão.** `DEFINIR_CONFIG_CIRCUITO` permite
  reescrever a **chave PIX** — o destino do dinheiro do atleta — e
  `DEFINIR_DESCONTO_ATLETA` grava `desconto_pct` e `isento`. As duas passam com
  o financeiro bloqueado. Hoje a tela não oferece o campo do PIX, mas o portão é
  o servidor, não a tela. *(Segurança)*

### Pequenos, e baratos

- **0.6.9 —** `veFinanceiro` é uma foto do login guardada na sessão: ligar o
  portão não tem efeito até o organizador sair e entrar de novo.
- **0.6.10 —** A aba de pagamentos some sem explicação. O texto que explica
  existe só na tela do super-admin. Para um cliente pagante, aba ausente sem
  aviso lê como defeito.
- **0.6.11 —** `LIBERAR_NAO_RENOVANTES` é despachado pelo app e **não existe no
  servidor** — cai em "Ação desconhecida". Pré-existente.
- **0.6.12 —** Ovo e galinha: `NOMEAR_ORGANIZADOR` exige um atleta ativo, e
  circuito novo nasce vazio. A ordem obrigatória (abrir inscrições → o futuro
  organizador se inscreve → aprovar → nomear) não está escrita em lugar nenhum.
- **0.6.13 —** `LER_COBRANCA_PLATAFORMA` não recusa o BH, ao contrário da
  irmã. Inofensivo (só super-admin), mas incoerente.
- **0.6.14 —** `CobrancaPlataformaCard` desempacota a resposta duas vezes, então
  a tela mostrará campos vazios mesmo com configuração salva.

## Onda 0.7 — O que a revisão da 0.6.1 desenterrou (08/09/2026)

Nada disto foi criado pela 0.6.1. Apareceu porque seis duplas de guardiões foram
olhar o fluxo de erro de ponta a ponta, e **está tudo em produção hoje**. A
0.6.1 subiu sem esperar por estes itens — decisão do Juliano em 08/09, caminho
"subir o conserto e separar o resto": segurá-la não consertava nenhum deles.

### Autenticação — o mais sério

- **0.7.1 — O `athlete-action` não autentica ninguém.** Não há token de sessão
  nem PIN: o `athleteId` vem do corpo da requisição, e a chave que o app manda
  está no pacote que todo visitante baixa. Vale para **todas** as ações do
  atleta — `ENVIAR_PLACAR`, `SOLICITAR_WO`, `RENOVAR`, `ATUALIZAR_PERFIL` —, não
  só a exclusão. Onde dói mais: qualquer pessoa pode marcar **qualquer** atleta
  como tendo pedido exclusão de dados, e o admin não tem como distinguir pedido
  legítimo de forjado antes de executar uma anonimização **irreversível**.
  Vetores: assédio (marcar um rival) e indução do controlador ao erro.
  A peça já existe — o `login-atleta` emite token de sessão e o `circuito-dados`
  já sabe consumi-lo (`body.sessionToken`); o `athlete-action` é que não exige.
  *(Guardião Jurídico, confirmado pelo supervisor.)*

### Exclusão de dados (LGPD)

- **0.7.2 — A anonimização não toca `atleta_documento`.** Sobrevivem à exclusão:
  `cpf_hash`, `data_nascimento`, `responsavel_nome`, `responsavel_cpf_hash` e
  `cpf_consent_ip` — inclusive dado de **menor** e de **terceiro** (o responsável,
  que não é quem pediu). A `POLITICA_PRIVACIDADE.md` §7 prometia que o hash de
  CPF era purgado; **o texto foi corrigido em 08/09** para descrever o que o
  sistema faz. Falta decidir o código.
  **Decisão pendente do Juliano** (o jurídico separou o que é e o que não é opção):
  - *Não é opção* — `responsavel_nome`, `responsavel_cpf_hash`, `data_nascimento`
    e `cpf_consent_ip` devem ser apagados em qualquer cenário.
  - *É opção* — o `cpf_hash`: apagar (libera recadastro e derruba a dedup
    nacional), reter por prazo declarado (ex.: 2 anos, alinhado ao consentimento),
    ou reter enquanto a plataforma existir (o mais frágil frente ao art. 6º, III).
- **0.7.3 — Segundo pedido de exclusão reinicia o prazo legal.**
  `athlete-action` grava `exclusao_solicitada_em` incondicionalmente, então um
  clique novo apaga a data do primeiro e empurra o vencimento do art. 18 §3º
  para frente. Correção: só gravar se estiver nulo.
- **0.7.4 — Sucesso silencioso com zero linhas.** O update tem
  `.neq("status","arquivado")` e ninguém confere quantas linhas mudaram: pode
  responder `sucesso: true` sem ter gravado nada. Mesma família do defeito que a
  0.6.1 consertou, um degrau abaixo.
- **0.7.5 — O porteiro não devolve `exclusao_solicitada_em`.** Em circuito
  privado não-BH, `circuito-dados` e `porteiroRankingToCa` não carregam o campo,
  então o recibo do pedido não tem de onde vir. Contornado no front pela 0.6.1
  (um sinalizador que só liga com confirmação do servidor); a correção de raiz é
  o porteiro passar a devolver o campo.

  > **Verificado e DESCARTADO em 08/09:** a suspeita de que o botão "Finalizar
  > exclusão" nunca funcionara (o `verify_jwt` da `anonimizar-atleta` está ligado
  > e o app manda chave publicável, não JWT). Teste sem escrita — POST com corpo
  > vazio — devolveu **HTTP 400 "pin e id são obrigatórios"**: o portão deixa
  > passar e a função roda. Os zero POSTs em 24h eram ausência de pedidos, não
  > recusa. Fica o registro para não se reinvestigar isso.

### Mensagem de erro na tela — as quatro portas

A 0.6.1 fechou a porta nova. Três continuam abertas, e a correção certa das
quatro é **um saneador compartilhado**, não quatro remendos.

- **0.7.6 — `DbBar` mostra o corpo inteiro do PostgREST, com `details` e `hint`,
  para todo mundo — inclusive o visitante.** É estruturalmente a pior das quatro
  (`details` é justamente o campo que carrega o valor que violou a regra) e já
  está no ar. **Fazer primeiro.**
- **0.7.7 — Login do atleta** (`setErr(e.message)`) e **troca de foto**
  (`Erro: ${errMsg}`, ecoando o corpo do Storage) mostram texto cru ao atleta.
- **0.7.8 — `erroCod` estável no `athlete-action`.** Hoje o app casa mensagens
  por texto (lista branca em `MSGS_ATLETA`). Funciona e está travado por
  asserção, mas o certo é o motor devolver um código estável ao lado da frase.
  Quando entrar, a asserção de paridade é aposentada.
- **0.7.9 — `resetar-pin-atleta` sem catch-all:** o `throw` vira 500 do Deno sem
  cabeçalho CORS, o navegador corta e o erro chega sem status nem corpo.
- **0.7.10 — Dívidas das asserções novas:** escopar a asserção de escopo ao corpo
  do `syncToSupabase` (hoje varre o `App.jsx` inteiro, então uma chamada nova a
  uma função já existente passa verde).

### Tela

- **0.7.11 — `NovaTemporadaPanel` não filtra por `modoOrg`.** O painel de virada
  de temporada aparece para o organizador, que sempre levará 403 (o motor é
  fail-closed, `NOVA_TEMPORADA` não está em `ACOES_ORG`). Não é falha de
  segurança; é botão que nunca funciona, com um aviso de "não pode ser desfeita"
  para uma ação que não é dele. Desde a 0.6.1 ele ao menos **vê** o 403.
- **0.7.12 — O padrão otimista é sistêmico.** Todo o admin muda a tela antes de o
  servidor confirmar (`NOVA_TEMPORADA`, `AVANCAR_RODADA`, `PROCESSAR_RODADA`,
  `APLICAR_WO`, `ARQUIVAR_ATLETA`). A 0.6.1 fez a reversão acontecer e ficar
  visível; o padrão em si continua.
- **0.7.13 — Dívida de marca:** `#c25a45` é uma 5ª cor, fora da paleta de 4 do
  manual, usada ~37 vezes. Ou o manual ganha seção de "cor semântica de sistema",
  ou o app migra. Decisão do Juliano, via curador.

## Onda 0.8 — O que a correção de nomes desenterrou (10/09/2026)

O Juliano reportou que a tela de inscrição oferecia "Clube do Tênis de Mesa BH"
em vez do circuito. A causa era o nome gravado, não o código — mas a revisão
achou que o mesmo circuito tinha **cinco nomes diferentes** pelo app, e destravou
uma pilha de coisas cravadas em texto que deviam vir do dado.

Decisões dele, para o registro: **o app é "Clube do Tênis de Mesa"**, sem "BH";
**o circuito é "Circuito BH"**, sem número (o número é da temporada, e cravá-lo
faria o nome envelhecer sozinho na virada).

### Precisam de decisão dele

- **0.8.1 — ✅ RESOLVIDO em 10/09/2026.** Havia dois pares de índice+log do
  curador (`claude/` e `docs/`), divergidos: o de `claude/` congelado desde 05/09,
  o de `docs/` escrito até 07/09. Decisão do Juliano: **`docs/` é o registro
  único**. A pasta `claude/` foi removida (histórico no git), a entrada de 08/09
  que só existia lá foi trazida, e o mandato do curador passou a apontar para o
  lugar certo — senão ele voltaria a escrever numa pasta que não existe.
- **0.8.2 — ✅ RESOLVIDO em 10/09/2026.** O nome da marca aparecia com "de Mesa"
  em terracota itálico na tela de entrada — tratamento que o manual reserva ao
  slogan, e que ficava duas linhas acima do slogan de verdade, os dois brigando
  pelo mesmo destaque. O nome ficou inteiro em off-white. *(Designer)*

### Texto cravado que devia vir do dado

- **0.8.3 — "masculino adulto (18+)" está cravado em três lugares**, incluindo o
  regulamento que o atleta assina (Cap. 02 e Cap. 11) e o mini-resumo do passo 3.
  É fato do BH, não regra da plataforma, e `circuitos` não tem coluna de
  categoria — então é trabalho de banco, não de texto. Três `// TODO` deixados no
  código em 10/09 para não repetir o esquecimento que causou esta onda.
- **0.8.4 — "Temporada 1" cravada** no mini-resumo do passo 3 e no Cap. 02 do
  regulamento. Envelhece sozinha na virada.
- **0.8.5 — ✅ RESOLVIDO em 10/09/2026** (era: `RegulamentoView` não ramifica por
  `regulamento_versao`). A coluna
  existe e está preenchida (`v03-12` no BH), mas o componente escolhe o texto só
  por sistema (A/B). Consequência: um 2º circuito de rating herdaria o
  regulamento do BH, **com o capítulo do torneio presencial**, que não é dele —
  o correto seria `vA-nc-01`. **Bloqueia vender um 2º circuito Sistema A.**
  *(Curador)*
- **0.8.6 — Fallback cravado no `SeletorCircuito`:** `"Circuito BH"` em texto,
  usado quando o circuito atual não é encontrado. Inofensivo hoje (é o valor
  real), fica velho se o BH for renomeado de novo. *(Confiabilidade)*

### Instagram — tem dono agora, e tem data

Complementa a Onda 0.2, que dizia "o Instagram não tem dono". Verificado em
10/09: **está vivo e publicando** (53 peças, a última no próprio dia 10/09).

- **0.8.7 — O token vence em 29/10/2026** e nada avisa quando se aproxima. Se
  vencer sem troca, as publicações param em silêncio.
- **0.8.8 — A anotação em `instagram_config` está desatualizada e engana.** Diz,
  desde 30/08: "Acesso do app revogado pela conta; aguardando novo token. Religar
  ativo=true depois de gravar o token novo e testar." Mas `ativo` já está ligado
  e as publicações saem normalmente. A rotação terminou e o bilhete ficou.
- Verificado e **descartado**: as 53 publicações não citam "Temporada BH" nem
  "BH" — o rename do circuito não desencosta nada do Instagram.

### Campo em edição × recarga

- **0.8.9 — Campo do admin perde o que está sendo digitado se outro admin salvar.**
  O `nomeEdit` ganhou resync em 10/09 (era ele que desfazia o rename sozinho), e
  isso troca um defeito por um risco menor: com dois admins logados — possível
  desde a v58 — o texto não salvo de um é descartado quando o outro grava.
  `nomeNova` em `AbrirProximaPanel` não tem resync nenhum, e é o defeito antigo.
  Só vira uso real quando houver organizador. *(Confiabilidade)*

## Onda 0.9 — Dívidas do contador de mensagens (10/09/2026)

Saíram do conserto do contador (ver `CHANGELOG.md`, 10/09). Nenhuma bloqueia nada
hoje; todas são do mesmo padrão — **estado carregado sob demanda sendo lido por
quem não checa se já chegou**.

- **0.9.1 — A corrida do `msgsCircRef`.** `msgsCircRef.current = CIRCUITO_ATIVO`
  lê a variável global no momento em que a RESPOSTA chega, não no início da
  chamada. Se o super-admin trocar de circuito com um `LISTAR_MENSAGENS` em voo,
  a resposta tardia é carimbada para o circuito errado. Pré-existente, só
  super-admin multi-circuito, autocorrige na busca seguinte. Correção: capturar
  `const circAlvo = CIRCUITO_ATIVO` antes do `await` e só aplicar se ainda bater —
  o mesmo espírito do `loadGenRef` que o arquivo já usa noutro fluxo.
  *(Confiabilidade)*
- **0.9.2 — Card em "···" a sessão inteira.** Quem entra por biometria e nunca
  visita Inscrições, Mensagens ou W.O. fica sem o número no painel até a primeira
  ação. É o preço de não abrir modal de PIN numa leitura de fundo, e é o lado
  certo do erro — mas um "toque para carregar" no card resolveria.
  *(Confiabilidade)*
- **0.9.3 — Chamada dupla de `LISTAR_MENSAGENS`** quando o admin clica em "Msgs"
  logo após entrar: o guard do ref só é setado no sucesso. Leitura idempotente,
  desperdício de uma chamada. *(Admin)*
- **0.9.4 — Rótulo do botão de disparo fora do padrão local.** "carregando o
  histórico…" não tem emoji nem maiúscula, ao contrário dos outros botões da
  tela. Estética. *(Admin)*
- **0.9.5 — `resultado_comunicado` é por JOGO, mas são DUAS mensagens.** Gatilho:
  quando alguém reclamar que um dos dois atletas não recebeu o resultado.
  Cada jogo validado gera uma mensagem por atleta, e o filtro que esconde o que
  já foi enviado é `m.validated && !m.resultadoComunicado` — um campo só, do jogo
  inteiro. Enviar a do **primeiro** atleta marca o jogo, e a do segundo some da
  lista de pendentes.

  **Por que não morde hoje:** a fila é congelada no clique (`setFilaCongelada`),
  então dentro de um disparo normal as duas mensagens já estão na fila e são
  percorridas. Conferido no banco em 14/09/2026: todos os jogos com mensagem de
  resultado têm exatamente **duas**, nunca uma. Morde se o disparo for
  interrompido entre os dois atletas (fechar a aba, perder conexão, sair do
  WhatsApp e não voltar) — aí o segundo atleta nunca mais aparece como pendente.

  **Correção:** o "já enviei" do resultado tem de ser por atleta, não por jogo —
  o log em `mensagens_enviadas` já grava `atleta_id` + `match_id`, que é
  exatamente o par necessário. O campo `resultado_comunicado` continuaria útil
  como marca persistente do jogo (é o que impede o resultado antigo de voltar a
  pendente a cada par mensal de rodadas), mas o filtro da lista deveria consultar
  o log por atleta.

  **Contexto:** achado em 14/09/2026 ao consertar o defeito irmão — o
  `if (atual.matchId)` que deixava um **lembrete** marcar o resultado como
  comunicado (reportado pelo Juliano: Fabio x Juliano, rodada 5, mensagem de
  resultado nunca apareceu). Aquele foi corrigido e travado com asserção; este
  é o resíduo do mesmo mecanismo, e ficou registrado em vez de corrigido junto
  para não misturar dois defeitos num conserto só.

## Onda 0.10 — Antes de abrir o 2º circuito ⛔ (10/09/2026)

Saiu da revisão da 0.8.5 pelas 8 duplas. **Nada aqui morde hoje** — existe um
circuito, o BH, e ele está provado intocado. Tudo aqui tem **gatilho**, não data:
o dia em que nascer o segundo circuito, ou em que for nomeado o primeiro
organizador. Registrado com gatilho a pedido do Guardião Jurídico: *"se virar
backlog sem gatilho, o defeito volta a ser descoberto no pior momento — com
atleta inscrito."*

### Gatilho: antes de criar o 1º circuito Sistema A que não seja o BH

- **0.10.1 — ✅ FEITO (13/09/2026). O fallback da versão do regulamento não é fail-closed.** Se a
  leitura de `circuitos.regulamento_versao` falhar, o app cai em `v03-12` — e
  mostraria ao atleta de um circuito novo o regulamento do BH, **com torneio e
  com a taxa**, enquanto o servidor carimba `vA-nc-01`. O recibo ficaria
  provadamente falso. Consentimento é a última coisa que pode ser fail-open.
  *Achado independentemente pelo Guardião Jurídico E pelo de Segurança — os dois
  chegaram nele por caminhos diferentes, o que é sinal de que é real.*
- **0.10.2 — ✅ FEITO (13/09/2026), por outro caminho. O "80%" está cravado em três textos que o atleta aceita**
  (`src/App.jsx` ~2200 no portão do aceite, ~2675, ~2697), e
  `percentual_entrada_meio` é configurável por circuito. Organizador que puser
  50% terá atletas com aceite prometendo 80%. **Mesma classe do teto** — e o
  Jurídico recomendou o mesmo remédio que funcionou lá: em vez de o texto seguir
  a configuração, **a configuração passar a caber dentro do que o atleta
  aceitou**.

  **Como foi resolvido:** não fazendo a configuração caber no texto, e sim
  **abolindo a regra**. Decisão do Juliano, 12/09/2026: o atleta paga o mesmo
  valor entrando em qualquer etapa; desconto vira ato do organizador, por atleta.
  Circuito novo nasce com `percentual_entrada_meio: 100`, a virada o devolve a
  100, e o valor-padrão do motor deixou de ser 80. Para o **BH**, que tinha o 80%
  prometido no v03-12 já aceito, criou-se a **v03-13** e uma **trava**: a virada
  do BH é recusada (409) enquanto ele declarar uma versão que promete o desconto.
  Ver 0.10.15 para o que falta (carimbo + aviso).
- **0.10.3 — O regulamento `vA-nc-01` não tem texto canônico.** Ele existe como
  prosa no `REGULAMENTOS_NOVOS_CIRCUITOS.md` e como ramificação no `App.jsx`.
  Não há `docs/REGULAMENTO_vA-nc-01.md`. Um documento que o atleta aceita
  juridicamente mora só dentro de um JSX de 9.700 linhas. *(Jurídico)*
- **0.10.4 — Duas referências a capítulo nas telas do admin ficam off-by-one**
  num circuito sem torneio: `App.jsx:7672` ("Cap. 13", vira 12) e `:8031`
  ("Cap. 11", vira 10). As de "(Cap. 03)" e "(Cap. 07)" **não** quebram — são
  anteriores ao capítulo removido. Conserto: nomear o capítulo, como foi feito
  dentro do regulamento. Não tocado porque alteraria a tela do BH.
- **0.10.5 — O corte dos 8 no ranking vira promessa vazia.** `RankingView`
  desenha "Zona de classificação" e "C = classificado para o torneio final"
  incondicionalmente. Num circuito sem torneio, é rótulo sem referente. Saída sem
  tocar o BH: prop opcional com default que preserva o comportamento atual.

### Gatilho: antes de nomear o 1º organizador

- **0.10.6 — `login-atleta` precisa subir como v9.** O que está no ar (v8)
  difere do repositório em **uma coisa**: o `LOGIN_ORGANIZADOR` não devolve
  `org_ve_financeiro`. Consequência: a aba Financeiro **nunca apareceria** para o
  organizador. Dormente hoje (0 organizadores, e o BH é excluído desse fluxo por
  `slug !== "bh"`), e o portão real do servidor está no ar desde a v58.
  *Nota de método, do Guardião de Segurança:* `supabase functions download`
  devolve o código **transpilado** — para comparar fonte com o que está no ar,
  só pela MCP.
- **0.10.7 — O admin é cego para o regulamento do próprio circuito.** Não é
  avisado na criação de que um circuito de rating novo nasce **sem torneio**; não
  vê `regulamento_versao` em tela nenhuma do painel; e não tem como mudá-la.
  Some as três: *não é avisado, não vê, não muda.* O `CRIAR_CIRCUITO` nem
  devolve o campo no `select`. *(Admin)*
- **0.10.8 — O torneio virou decisão de ninguém.** O
  `REGULAMENTOS_NOVOS_CIRCUITOS.md` promete que ele é "a critério do admin do
  circuito"; o código entrega "sempre não", travado na criação. Um organizador
  que queira fazer torneio não tem caminho. *(Admin)*
- **0.10.9 — Não há campo para editar o teto de um circuito existente.** O motor
  aceita (`DEFINIR_CONFIG_CIRCUITO`), a tela não oferece. *(Admin)*

### Gatilho: antes do 1º circuito de terceiro (e pede advogado)

- **0.10.10 — O app registra um aceite que o atleta nunca deu.** Ao entrar num
  **segundo** circuito, `login-atleta:314` grava `aceite_regulamento: true` com
  data e versão — e o `ParticiparFlow`, única tela desse fluxo, **nunca mostra o
  regulamento** nem tem checkbox. Hoje a exposição é **exatamente zero** (o
  fluxo recusa o BH por construção) e passa a ser **100% no dia 1 do circuito 2**.
  Não há zona cinzenta. *(Jurídico — e é ele quem nota que a 0.8.5 transforma
  isso de inofensivo em falso: com versões diferentes por circuito, o registro
  passa a afirmar que o atleta aceitou um documento que só existe lá e que ele
  nunca viu.)*
- **0.10.11 — Os 15 aceites do BH estão desatualizados.** Nenhum atleta tem
  `v03-12` gravado: 12 têm `v03-3`, 1 tem `v03-5`, 1 tem `v03-8`, 1 tem `v03-11`
  — e todos jogam sob o v03-12, que traz cláusulas penais (W.O. culposo −15,
  suspensão, **banimento permanente** por fraude). `RENOVAR` não re-colhe aceite
  nem atualiza a versão. **Recomendação do Jurídico: re-colher na próxima
  renovação** (o ponto de contato já existe; falta ele gravar), e fazer isso
  **depois** de 0.10.12, senão gasta-se o atrito sem comprar a proteção.
- **0.10.12 — Falta a regra "texto mudou → versão nova".** Hoje a string de
  versão não identifica um texto com segurança: este próprio avanço quase
  alterou o v03-12 sem trocar a versão. Proposta do Jurídico: a regra, mais
  `docs/REGULAMENTO_<versao>.md` como texto de registro, mais uma asserção que
  compare o documento com o fonte.
- **0.10.13 — O consentimento de CPF do `ParticiparFlow` é mais fino que o do
  cadastro**, sob o **mesmo** rótulo de versão: uma linha, sem controlador, sem
  retenção, sem direitos. Dois textos materialmente diferentes com uma etiqueta
  só. *(Jurídico)*

### Sem gatilho — higiene

- **0.10.14 — `circuitos` tem RLS `USING (true)` e `pix_chave` legível pelo
  `anon`.** Pré-existente, não desta mudança. *(Segurança)*
- **0.10.15 — A virada do BH para a v03-13: o que falta, em ordem.**
  Gatilho: **antes da próxima virada de temporada do BH**. O motor já recusa a
  virada (409) enquanto `circuitos.regulamento_versao` do BH não estiver numa
  versão sem desconto por etapa — a trava existe para nenhum destes passos ser
  esquecido. **Não é uma lista de desejos: é pré-requisito.**

  **(a) Construir o carimbo.** Hoje `regulamento_versao` é escrito em um lugar
  só, `CRIAR_CIRCUITO`. **Nenhuma ação altera a versão de um circuito existente**,
  então destravar exigiria `UPDATE` manual em produção — o que a regra 1 do
  projeto proíbe. Falta `DEFINIR_REGULAMENTO_VERSAO` (super-admin,
  confirmação-com-nome). *(Guardião de Segurança, 13/09/2026.)*

  Três exigências da ação, que só custam uma linha de especificação agora:
  **recusar valor vazio ou em branco** — hoje o único escritor do campo é o
  `CRIAR_CIRCUITO`, que sempre preenche; a ação nova vira um segundo escritor, e
  um carimbo em branco **fecharia as inscrições do circuito em silêncio** (o
  `INSCREVER` agora recusa 409 sem versão). **Recusar versão que não é daquele
  circuito** — carimbar `vA-nc-01` no BH hoje libera a virada E apaga o Cap. 10
  da tela; a lista do motor responde "esta versão promete desconto?", não "esta
  versão é deste circuito?", e a ação nova é o lugar certo para a segunda
  pergunta. E **`trim` no que for gravado**, porque o valor é digitado à mão.
  *(Jurídico e Regulamento, 14/09/2026.)*

  Junto com (a), três consertos de tela que o Regulamento condicionou ao mesmo
  momento, porque todos viram mentira no dia do carimbo:
  - **`trim` simétrico.** O motor perdoa espaço (`"v03-13 "` passa); a tela não
    normaliza nada. O mesmo carimbo que a bateria assevera que deve passar faz o
    **Cap. 10 sumir da tela do BH** e a cláusula de transição sumir junto —
    enquanto o `athlete-action`, que trima, carimbaria `"v03-13"` no aceite. O
    atleta receberia recibo de um texto que não viu. *(Regulamento C1.)*
  - **Matar o fallback do BH.** `App.jsx:1922` cai em `"v03-12"` quando a leitura
    falha, e `:1926` isenta o BH do aviso de versão desconhecida — com o
    argumento, escrito no próprio comentário, de que "no BH a versão É a do
    fallback". **Verdade hoje, falsa no segundo seguinte ao carimbo.**
    *(Regulamento C2; o guardião do Atleta achou o mesmo.)*
  - **Fechar o `PARTICIPAR`** — é o 0.10.18. *(Regulamento C3, Segurança A1.)*

  **(b) Construir o re-aceite.** O texto anterior deste item dizia que "a
  renovação é o momento natural de re-colher o aceite". **Era falso.**
  `athlete-action` → `RENOVAR` grava só `quer_renovar` e `renovacao_em`: não
  exibe texto, não pede caixa de seleção, não grava `versao_regulamento`. O
  aceite só é colhido no `INSCREVER`. E dos 14 atletas ativos, **nenhum** tem
  v03-12: 11 em v03-3, 1 v03-5, 1 v03-8, 1 v03-11. Sem construir isto, a
  temporada nova roda **com preço diferente** e os atletas entram tendo aceitado
  textos de várias versões atrás, cujo único ato terá sido apertar "quero
  renovar". O re-aceite tem de ser **passo próprio e obrigatório**, anterior ou
  simultâneo à virada. *(Guardião Jurídico, 13/09/2026.)*

  Quatro peças que faltavam na primeira redação deste item, sem as quais ele se
  improvisa na hora *(Jurídico, 14/09/2026)*:
  1. **O que exibe:** o bloco de transição do **Cap. 12**, não o resumo do portão
     de aceite. O resumo já carrega a frase que **tira** o desconto e não carrega
     a que **protege** — no re-aceite o atleta leria só a metade ruim.
  2. **O que grava:** `versao_regulamento`, `data_aceite_regulamento` e IP — os
     mesmos campos que o `INSCREVER` escreve. Re-aceite que não grava a versão
     deixa aberto exatamente o buraco que ele existe para fechar.
  3. **Onde entra na ordem:** **depois** do carimbo (antes, a tela mostraria o
     texto da v03-12 enquanto pede aceite da v03-13) e **antes** de parear ou
     cobrar na temporada nova. A sequência do item (e) não o inclui hoje.
  4. **O que acontece com quem recusa:** recusar **não é abandono** (sem −30 de
     rating, sem bloqueio de temporada — o Cap. 12 pune "abandono sem
     comunicação", e recusar pelo app É comunicação, mas quem recusa não tem de
     deduzir isso) e **não gera cobrança**. As duas garantias ditas no aviso.

  E uma inversão de ênfase que vale corrigir: **o re-aceite é a prova**, não o
  log de envio. `REGISTRAR_MENSAGEM_ENVIADA` prova que o Clube **declarou** ter
  enviado — é registro do próprio clube. O atleta clicando "aceito a v03-13"
  prova ciência melhor que qualquer log. O item (c) é camada de apoio; este é a
  espinha.

  **E um mérito que este item não reivindicava:** hoje o Clube **não consegue
  produzir o texto que nenhum dos 14 aceitou** — `docs/` só tem v03-12 e v03-13;
  v03-3, v03-5, v03-8 e v03-11 não existem como documento em lugar nenhum, só por
  arqueologia no histórico do `App.jsx`. Depois do re-aceite, todos ficam numa
  versão cujo texto existe e está assinado. Isso promove (b) de higiene ao item
  de maior valor de todo o 0.10.15.

  **(b2) Liquidar as pendências da temporada 1/2026 ANTES do carimbo.**
  Decisão do Juliano, 15/09/2026: *"nada muda do circuito atual, todas as
  mudanças se houver vão ser para as próximas etapas"*. Isso não é só política —
  tem consequência mecânica, e ela é a razão de este passo existir.

  A v03-13 promete que quem ingressou na 2ª etapa e ainda não quitou **paga os
  80%**. O app **não consegue cumprir essa promessa depois da virada**, por dois
  motivos somados: `percentual_entrada_meio` é **um número por circuito, não por
  atleta** (vira 100 para todo mundo), e o `NOVA_TEMPORADA` sobrescreve
  `pagamento_confirmado` com `pagamento_proxima_confirmado || false`
  (`admin-action:1236` e `:1337`) — ou seja, **a dívida da temporada que acaba
  deixa de existir no modelo**. Ninguém é cobrado a mais; a conta é que some.

  Havia **3 atletas não pagos** em 15/09/2026. Enquanto a temporada 1/2026 está
  aberta, o percentual do BH é 80 e a tela de registro de pagamento calcula
  certo. Depois do carimbo e da virada, não.

  **CONTEXTO QUE ENCOLHE ESTE ITEM, e que estava faltando aqui:** a temporada
  **1/2026 foi gratuita de propósito — foi a temporada de teste**. Decisão do
  Juliano, dita mais de uma vez. Por isso `desconto_global_pct = 100` e os **12
  pagamentos registrados têm todos `valor = 0`**. Os 3 não pagos (2 ativos,
  1 suspenso) devem **R$ 0**.

  Logo: "liquidar as pendências" aqui são **três marcações de valor zero, não
  três cobranças**, e a cláusula de não-retroatividade não protege ninguém na
  1/2026 — ela vale a partir da 2/2026, que é quando o preço passa a ser
  cobrado de verdade. O passo continua obrigatório mesmo assim, porque a
  marcação precisa existir **antes** do carimbo: depois da virada o flag some.

  **Portanto, na sequência:** conferir as pendências (contagem antes), marcar ou
  baixar cada uma sob a regra da v03-12 — "baixar" == a regra que o Cap. 12 já
  define, o atleta fica **retido até regularizar**, não é sanção nova —, conferir
  de novo (contagem depois), e só então carimbar.

  *(O contexto da temporada de teste faltava aqui, e a falta custou caro: quatro
  agentes debateram 80% contra 100% sobre uma temporada de graça. O guardião de
  Segurança chegou a mencionar o `desconto_global_pct = 100` de passagem, como
  "contexto que ninguém escreveu", e ninguém ligou os pontos. Antes de escrever
  regra sobre valor: ler o valor.)*

  *(Achado pelo supervisor do guardião de Regulamento, que foi conferir o outro
  lado da cláusula que o Jurídico tinha redigido. O `pagamentos` guarda o
  histórico, então o registro contábil sobrevive — o que zera é o "quem deve".)*

  **(c) Dar o aviso prévio — e provar que deu.** Não é cortesia: o portão de
  aceite já promete, no texto que os 14 assinaram, que *"o regulamento pode ser
  atualizado com aviso prévio"*. O ônus de provar que cumpriu é do clube.
  - **Forma:** grupo oficial de WhatsApp **e** aviso dentro do app. Só o grupo é
    frágil — mensagem em grupo se perde e não prova entrega.
  - **Prazo:** antes da abertura das inscrições da temporada nova, com folga para
    o atleta escolher **não** renovar. Sugestão: **15 dias**. Não é prazo legal;
    é o que torna o aviso efetivo (CDC art. 46).
  - **Conteúdo, os três:** o que muda; a partir de qual temporada; e que quem
    ingressou na 2ª etapa da temporada em curso não é cobrado a mais.
  - **Prova:** usar `REGISTRAR_MENSAGEM_ENVIADA` — o registro nasce no banco, com
    data, em vez de num print.

  **(d) Carimbar e virar na MESMA sessão.** O app mostra a versão do circuito ao
  vivo. No instante do carimbo, quem se inscrever no meio da temporada corrente
  já lê o texto novo — enquanto a v03-13 declara que a temporada em curso segue
  pela v03-12. A janela entre carimbar e virar tem de ser de minutos, não de
  dias. *(Guardião de Segurança.)*

  **(e) Ordem em relação à publicação:** o app novo tem de estar **no ar antes**
  do carimbo. O app que está no ar hoje trata "tem torneio" e "tem desconto de
  etapa" como a mesma chave; carimbar v03-13 com ele no ar faria o BH **perder o
  Cap. 10 da tela**. Ordem: publicar → conferir a tela → liquidar as pendências
  (b2) → avisar → carimbar → virar. *(Guardião do Regulamento.)*

  **Dentro do "publicar", a ordem das duas metades é: MOTOR PRIMEIRO, APP
  DEPOIS.** Eu tinha escrito o contrário no resumo, e estava errado — o guardião
  de Confiabilidade tinha dito motor primeiro e eu sobrescrevi. A comparação que
  eu não tinha feito:

  - **Motor primeiro (certo):** a trava já está no ar quando o app antigo, que
    ainda faz dispatch otimista, manda `NOVA_TEMPORADA`. O servidor recusa com
    409 **antes de arquivar ou apagar qualquer coisa**; a tela pisca "virada" por
    segundos e o `loadFromSupabase` desfaz. **Nada é escrito no banco.** Glitch
    visual, autolimitado, confinado à aba do admin.
  - **App primeiro (o que eu tinha dito):** o app novo — já com o modal correto —
    manda a ação para o motor **velho, que não tem trava**. A virada **acontece
    de verdade**: arquiva, apaga partidas e chaves, zera stats e grava
    `percentual_entrada_meio: 100` sem ler o regulamento declarado. **Irreversível.**

  Um glitch de tela que não escreve nada é estritamente menos grave que uma
  virada irreversível com preço incompatível com o regulamento declarado.
  *(Supervisor do guardião de Confiabilidade, 15/09/2026.)*

  **(f) Decisão em aberto, dois guardiões discordam.** O Jurídico quer trocar o
  cabeçalho do `REGULAMENTO_TENIS_DE_MESA_v03-12.md` de "Versão vigente" para
  "Versão histórica — vigorou até a temporada 1/2026" no dia do carimbo, porque
  o rótulo passa a mentir. O Curador diz para **não** mexer: o v03-12 está
  intocado de propósito, é o registro do que os atletas aceitaram, e o padrão do
  projeto é o texto **novo** declarar o que substitui. **Decisão do Juliano.**

- **0.10.16 — Não existe tela para dar desconto a um atleta.** Gatilho: **junto
  com 0.10.15**, e antes de afirmar que a regra nova está em pé.
  `DEFINIR_DESCONTO_ATLETA` está no motor, testada e na allowlist do organizador
  — e **não existe em tela nenhuma**. Enquanto o desconto de 80% era automático
  isso não doía (era o 0.6.8, adiado). Agora dói: depois de 12/09 é o **único**
  mecanismo declarado para conceder desconto ou isenção, e o texto que o atleta
  aceita **promete** que "eventual desconto é decisão exclusiva do organizador".
  Prometemos no contrato uma coisa que o app não consegue fazer. O contorno que
  existe (campo "Desconto individual (%)" ao registrar pagamento manual) grava
  `desconto_pct_aplicado` **naquele pagamento**, não em `atletas.desconto_pct` —
  então o atleta **nunca vê o preço combinado antes de pagar**, e não há isenção
  persistente. *(Guardião de Operações, 13/09/2026.)*

- **0.10.20 — A virada de temporada não pede confirmação-com-nome.** Gatilho:
  **junto com 0.10.15**, que é quando a trava sai da frente.
  O `CLAUDE.md` estabelece o padrão da casa: *"mudança destrutiva pede
  confirmação-com-nome (digitar o nome do circuito)"*, e o `CancelarCircuitoCard`
  já o implementa (`App.jsx:7313-7398`). A `NOVA_TEMPORADA` **não** — é a ação
  mais destrutiva do app (arquiva o ranking, apaga partidas e chaves, zera stats
  de todos os ativos, **não pode ser desfeita**) e hoje está protegida só por dois
  botões num modal. Não bloqueia agora porque a trava do regulamento impede
  qualquer virada do BH; vira a única barreira no dia em que a trava cair.
  *(Guardião de Operações, por iniciativa própria; o supervisor dele condicionou
  o APROVADO a este registro — eu tinha deixado o achado sem levar ao documento.)*

- **0.10.21 — `DEFINIR_FINANCEIRO` muda o preço da temporada ABERTA sem olhar o
  regulamento.** Gatilho: **antes de nomear o 1º organizador**, ou antes de
  afirmar em qualquer lugar que "o preço só muda com o carimbo".

  A trava da Onda 0.10 protege a **virada** (`NOVA_TEMPORADA` recusa 409 enquanto
  o circuito declarar uma versão que promete desconto). Ela **não protege o
  preço**. O `DEFINIR_FINANCEIRO` escreve `percentual_entrada_meio` direto na
  `configuracao` — a tabela viva da temporada em curso do BH — **sem checar
  `regulamento_versao` em momento nenhum**. É a mesma ação cujo defeito (J1)
  disparou metade desta onda: consertamos "campo vazio não vira número
  inventado", e não tratamos "esta ação muda o preço da temporada aberta a
  qualquer hora, sem carimbo, sem trava, fora da sequência do 0.10.15".

  **O item (d) do 0.10.15 não cobre isto** — ele fecha a janela entre carimbar e
  virar, e este caminho nem passa por ela.

  **Severidade hoje:** baixa, e por configuração, não por código.
  `org_ve_financeiro` do BH está `false`, então só o super-admin alcança a ação
  no BH. Nada no código impede o próprio Juliano de mudar o percentual da
  temporada 1/2026 amanhã, sem querer, sem que apareça em lugar nenhum que isso
  contraria o texto que os atletas aceitaram.

  **Duas saídas, e a escolha é do Juliano:** (a) espelhar a trava — recusar
  baixar o percentual do BH abaixo do que a versão declarada promete, enquanto
  ela estiver em `VERSOES_COM_DESCONTO_ETAPA`; ou (b) aceitar como está, e então
  **isto fica registrado como confiança operacional no super-admin, não garantia
  de código** — e ninguém pode escrever depois "o app garante que o preço só muda
  com o carimbo", porque a linha que sustentaria essa frase não existe
  (`CLAUDE.md`, regra 6).

  *(Levantado pelo guardião de Segurança (M4) e, independentemente, pelo
  supervisor do Jurídico, que o classificou como a resposta que faltava à
  pergunta "existe caminho em que alguém pague diferente do que aceitou?".)*

- **0.10.22 — O atleta logado não tem como reler o regulamento.** Gatilho:
  **antes do aviso prévio do 0.10.15(c)** — é o mesmo momento e o mesmo público.
  Só existem **dois** pontos de entrada da `RegulamentoView` (`App.jsx:1575` e
  `:1670`): o link "Regulamento oficial" da tela de login e o "Ver regulamento"
  do fluxo de inscrição. **Nenhum dos dois é alcançável depois do login.** Quem
  já é do clube precisaria **deslogar** para ler o texto que aceitou.

  Isso é mais grave do que "a cláusula de transição só aparece para quem abre o
  Cap. 12": a cláusula **não tem porta de entrada nenhuma** a partir de onde o
  atleta logado está — e o atleta logado que vai renovar é exatamente o grupo
  que ela protege. Some-se a isso que a `RenovacaoCard` mostra só o preço final
  calculado, sem versão de regulamento e sem aviso de que algo mudou.

  **Conserto:** um caminho para a `RegulamentoView` a partir da área do atleta,
  passando `versao={state.regulamentoVersao}` como o link público já faz.
  Barato, e destrava o 0.10.15(c) — não adianta avisar "mudou o regulamento" se
  a pessoa não consegue abrir o regulamento.

  *(Guardião do Atleta, 15/09/2026, respondendo a uma pergunta do supervisor
  dele. Ele varreu os pontos de entrada em vez de supor.)*

- **0.10.23 — Trocar de circuito e salvar o financeiro na mesma janela grava o
  preço do circuito errado.** Gatilho: **antes de existir o 2º circuito.**
  `trocarCircuito` (`App.jsx:4953-4963`) faz `setCircuitoSelId(circ.id)` **antes**
  do `await loadFromSupabase()`. Como `AdminFinanceiro` tem `key={circuitoSelId}`
  (`:6604`), ele remonta na hora e o `useEffect` de pré-preenchimento (`:6646`)
  enche os campos com o `state` daquele instante — ainda o do circuito
  **anterior** — enquanto o `chamarAdminAction` já aponta para o novo. Salvar
  nessa janela grava o preço do circuito A sobre o B.

  Janela de um round-trip, não de um frame, e **inalcançável hoje**: existe 1
  circuito, e `trocarCircuito` retorna cedo se o id for o ativo. Conserto de uma
  linha: mover o `setCircuitoSelId` para depois do `await`, junto do
  `setCircuitoAtivo` que já é revertido no `ok === false`.

  *(Supervisor do guardião de Segurança, 15/09/2026 — achado ao tentar salvar um
  achado maior que tinha caído na verificação. Ele registrou o próprio erro com a
  mesma precisão: o `grep` dele era sensível a maiúscula, não casou com
  `setDescGlobal`/`setPctMeio`, e ele leu a ausência de resultado como prova de
  ausência de código.)*

- **0.10.24 — O desempate do Sistema B está protegido em 3 dos 5 níveis.**
  Gatilho: **o dia em que o primeiro circuito de pontos abrir temporada** — o
  mesmo do 0.10.18.
  O cenário novo da virada do Sistema B discrimina **pontos → menos W.O. culposo
  → aproveitamento**, cada um com mutação que acende. Faltam dois níveis do
  `cmpRankingB` (`admin-action:392`):
  - **confronto direto** (nível 3): a função `confrontoDiretoDB` **já está
    discriminada** no bloco do Sistema A — lá, remover o nível acende. O que
    falta é provar a presença dela **na cadeia do B**, não a função em si.
  - **saldo de sets** (nível 5): `saldoSetsB` é exclusivo do Sistema B e está
    **de fato descoberto**. Remover o nível hoje deixa a bateria verde.

  Não bloqueia porque o Sistema B **não tem circuito em produção** — o próprio
  comentário do motor o chama de "inerte pro BH até a Fatia 2". Mas é débito
  conhecido, e a regra que a bateria já aplica ao `PARTICIPAR` (0.10.18) vale
  aqui: débito sem registro é débito esquecido.

  **A regra de teste que saiu desta rodada, e que generaliza:** cenário que
  discrimina N níveis roda **N mutações, inclusive a do primeiro** — a intuição
  de que "o nível primário obviamente decide" foi exatamente o que falhou três
  vezes aqui (a ordem de inserção acidental, o confronto direto comendo o
  aproveitamento, e o nível dos pontos do Sistema B). Vale para toda guarda em
  cadeia: permissões, validação de payload, desempates.

  *(Supervisor do guardião de Regulamento, 3ª rodada, condicionando o APROVADO a
  este registro.)*

- **0.10.17 — O banco ainda aplica a regra que o regulamento removeu.**
  Gatilho: **antes do próximo `CRIAR_CIRCUITO`**. `circuitos.percentual_entrada_meio`
  e `configuracao.percentual_entrada_meio` têm `DEFAULT 80` em produção
  (conferido em 13/09/2026). O motor grava 100 explícito, e isso está asseverado
  — mas qualquer linha inserida sem a coluna pega 80 do banco. Migração de uma
  linha: `SET DEFAULT 100` nas duas. *(Guardiões do Regulamento e de Segurança.)*

- **0.10.18 — O `PARTICIPAR` do `login-atleta` grava aceite sem saber a versão.**
  Gatilho: **antes do primeiro circuito não-BH abrir inscrições.**
  `login-atleta/index.ts:314` grava `aceite_regulamento: true` com
  `versao_regulamento: circ.regulamento_versao || null`. Com a versão ausente,
  nasce um **recibo de consentimento que não aponta para texto nenhum**. É o
  mesmo defeito que a Onda 0.10 fechou no `athlete-action` (que agora recusa
  409), na função irmã — e o `PARTICIPAR` é um fluxo de aceite de verdade: é o
  card "Entre em outro circuito aberto reusando o seu cadastro".

  **Por que não foi corrigido junto:** o `PARTICIPAR` recusa o BH por construção
  (`circ.slug === "bh"` → 400) e não existe 2º circuito, então é inalcançável
  hoje. Corrigi-lo obrigaria a publicar o `login-atleta`, que nesta onda ficou
  **fora do pacote** (ver abaixo) por carregar uma mudança de escopo alheio.

  **Conserto:** a mesma guarda do `INSCREVER` — `String(circ.regulamento_versao
  ?? "").trim()`, recusar 409 se vazio, **antes** do insert em
  `circuito_atletas`, e carimbar a variável. Nasce com asserção e mutação.

  **Registro de honestidade:** a bateria afirmava que esta função "segue
  fail-closed — as duas funções concordam agora". Era falso nas duas metades.
  Achado pelo guardião de Segurança em 14/09/2026; a asserção foi reescrita para
  dizer o que o código faz, e agora exige que este item continue existindo aqui.
  *(Segurança A1; mesmo achado do Regulamento C3.)*

- **0.10.19 — O `login-atleta` está fora do pacote da Onda 0.10, de propósito.**
  Gatilho: **quando alguém for publicar o financeiro do organizador.**
  O arquivo **não foi tocado** nesta onda. O que o faria subir como "v9" é o
  repositório estar à frente do ar desde o pacote anterior — e o que está à
  frente é **funcional e de outro assunto**: o `LOGIN_ORGANIZADOR` passou a ler
  `org_ve_financeiro` e a devolver `veFinanceiro`, que o app usa para mostrar ou
  esconder a aba "Pagam." do organizador.

  Nada na 0.10 depende disso, e o efeito hoje é nulo (`org_ve_financeiro = false`
  no único circuito, e o BH não admite organizador). Entraria de carona numa onda
  sobre regulamento, sem asserção e sem constar do resumo aprovado — se desse
  errado, ninguém procuraria a causa ali. Quando subir, sobe com nome próprio.
  *(Segurança C1; o Juliano foi avisado e não objetou.)*

## Onda 1 — Piloto real ⬅️ **é aqui que estamos**

**Abrir um 2º circuito de verdade** (Sistema B, outra cidade), com atletas
reais, e rodar uma temporada curta. É ação do Juliano — o código e o dado já
estão destravados.

É o teste que nenhum harness substitui: descobre o que quebra na operação, não
no cálculo. Tudo na Onda 2 fica melhor decidido depois dele.

## Onda 2 — Pagamento (o que destrava a venda)

Hoje o financeiro é Pix manual: o atleta paga por fora e o admin confirma na
mão. Enquanto não confirmado, o atleta não é pareado.

- **2.1 — Decidir o modelo.** `PLANO_PAGAMENTOS.md` é o documento de decisão, e
  ainda não foi decidido. Quem paga: o organizador, o atleta, os dois?
- **2.2 — Integração Asaas.** Desenhada em `PLANO_PAGAMENTOS_FATIA5_INTEGRACAO.md`,
  **nada implementado**. As tabelas `cobrancas` e `circuito_cobranca` já existem
  no banco, vazias. Pré-requisitos que bloqueiam o go-live estão listados lá —
  entre eles conta Asaas com KYC concluído e revisão jurídica das minutas.
- É a única frente onde **dinheiro se move**. Guardião de Segurança obrigatório
  em cada passo, e nunca guardar cartão — tokeniza no gateway.

## Onda 3 — Onboarding do organizador

Hoje só o super-admin cria circuito. Para escalar, o organizador precisa criar o
próprio, sozinho, com os limites do plano dele. Inclui cadastro de organizador e
aceite dos termos.

## Onda 4 — Legal e marca

- Revisão jurídica de `TERMOS_ORGANIZADOR.md` e `POLITICA_PRIVACIDADE.md`
  (também bloqueiam a Onda 2).
- Confirmar o nome legal do controlador e o canal de exercício de direitos.
- Registro da marca no INPI — o símbolo gráfico é o ativo protegível; o nome é
  descritivo.
- Domínio neutro: o site segue em `clubedotenisdemesabh.com.br` (com "bh"),
  enquanto a plataforma é nacional. Decisão de negócio, não técnica — troca de
  domínio junto com a Onda 4. *(O nome do app já foi resolvido em 08/09/2026:
  "Clube do Tênis de Mesa", sem "BH" — ver `docs/curadoria-log.md`. Só o
  domínio ficou pendente.)*

## Onda 5 — Operar em escala

Painel de números com cuidado de LGPD, monitoramento e alertas, backups
verificados, plano de incidente, suporte e documentação para organizadores.
Revisar limites (quantos circuitos e atletas aguentam) e um passe de segurança
geral antes de abrir cadastro para terceiros.

---

## Decisões ainda em aberto

- **Rating nacional × rating por circuito.** Hoje o rating é global: o atleta
  leva o dele para qualquer circuito. Faz sentido quando os circuitos jogam
  entre si; é discutível quando são independentes. Não decidido.
- **Aposentar o PIN global do super-admin** (Fatia 4 de `historico/PLANO_PAPEIS.md`).
  A autorização por organizador já funciona ao lado dele. Nunca foi feito, de
  propósito: o Juliano não pode perder acesso durante a transição.
- **O que pode ser anunciado como pronto.** O índice do projeto diz para não
  anunciar o Sistema B nem a plataforma como prontos; na prática estão no ar,
  sem piloto. Só o Juliano decide o que comunicar.

## Fora do escopo — decidido não fazer

Registrado para não voltar à mesa a cada conversa. Cada item tem o porquê.

- **Push nativo no celular** para os despachos do dia. O lembrete diário
  agendado já resolve; push nativo exige app empacotado nas lojas.
- **Escolher o número de rodadas por temporada.** Fixo em 6 (Cap. 13 do
  regulamento). A ação `DEFINIR_RODADAS` continua existindo, mas só devolve
  erro — a escolha foi removida do app de propósito.
- **Região como trava de inscrição.** O aviso de cidade/UF é informativo; quem
  aprova ou recusa é o organizador. Trava automática rejeitaria atleta legítimo
  que joga fora da cidade.
- **Guardar dados de cartão.** Nunca. Tokeniza no gateway, sempre.
- **Reverter uma partida isolada no Sistema A.** Impossível por construção: o
  rating depende da ordem dos jogos. Desfazer é sempre recalcular a temporada do
  zero — ver `PLANO_DESFAZER_PROCESSAMENTO.md`, com a prova de que o recálculo
  reproduz o estado exato (240/240 cenários).
- **Dividir o `App.jsx` em módulos.** Não há build que justifique, e o arquivo
  único é o que o projeto sabe operar.

## O que está ativo em `docs/`

| Documento | É |
|---|---|
| `ROADMAP.md` | este arquivo — o que fazer a seguir |
| `PLANO_PAGAMENTOS.md` | decisão de modelo, **não decidida** |
| `PLANO_PAGAMENTOS_FATIA5_INTEGRACAO.md` | desenho da integração Asaas, **não implementada** |
| `PLANO_DESFAZER_PROCESSAMENTO.md` | design provado (240/240), **não implementado** |
| `GOVERNANCA_AGENTES.md` | quem revisa o quê + histórico de vereditos |
| `CHANGELOG.md` | o que foi ao ar, com a versão de cada função |
| `ESTADO-DEV-app-tenis-de-mesa.md` | retrato do desenvolvimento |
| `REGULAMENTO_*` | as regras da competição — A: v03-12 (BH, vigente) + v03-13 (BH, próxima temporada, ver 0.10.15); `vA-nc-01`/B `vB-01` (circuitos novos) em `REGULAMENTOS_NOVOS_CIRCUITOS.md`, sem `.md` canônico próprio ainda (ver 0.10.3) |
| `TERMOS_ORGANIZADOR.md`, `POLITICA_PRIVACIDADE.md` | minutas, **sem revisão jurídica** |
| `ESPEC_CPF_SEGURANCA.md`, `SEGURANCA_RPC_AUDIT.md` | como o CPF é blindado |
| `historico/` | planos concluídos, guardados pelo porquê |
