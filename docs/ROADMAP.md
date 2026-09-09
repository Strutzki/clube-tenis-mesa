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
- Nome e domínio neutros: o app hoje é "Clube do Tênis de Mesa **BH**", e a
  plataforma é nacional.

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
| `REGULAMENTO_*` | as regras da competição (A v03-12, B vB-01) |
| `TERMOS_ORGANIZADOR.md`, `POLITICA_PRIVACIDADE.md` | minutas, **sem revisão jurídica** |
| `ESPEC_CPF_SEGURANCA.md`, `SEGURANCA_RPC_AUDIT.md` | como o CPF é blindado |
| `historico/` | planos concluídos, guardados pelo porquê |
