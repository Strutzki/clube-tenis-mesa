# CHANGELOG — Clube do Tênis de Mesa

Histórico do que foi a produção. Mantido pelo agente `curador-projeto`. Mais recente no topo.
Formato: **data — o quê** (versão do edge/regulamento, notas).

---

### 2026-09-29 (2ª subida) — NO AR: o torneio deixa de vazar para circuito que não tem

**NO AR desde 29/09/2026** (de acordo do Juliano: *"podemos seguir então"*).
**App-only:** push `fa8c6e6..a6d95f1`, bundle `index-uKwFVULg.js`, site HTTP 200.
**Nenhuma Edge Function mudou** — `git diff` de `supabase/functions/` entre o commit
do deploy anterior e este: **vazio**. `admin-action` segue v63, `athlete-action` v22,
`login-atleta` v11, `comprovante-url` v3.

**Dados antes e depois, idênticos** nas nove tabelas e nas três impressões digitais
(`f76240cc…`, `43abc1de…`, `d33245dd…`).

**Smoke, feito no pacote publicado e não no local:** baixei o bundle do ar e conferi
que as quatro coisas que o BH precisa estão nele — *"Zona de classificação"*, a
legenda do `C`, o desempate novo do Sistema B, e o capítulo do bye. É o jeito de
provar que o corte do BH não regrediu sem depender de o admin abrir a tela.

**O que este pacote leva:**
- o **torneio** deixa de vazar para circuito que não tem, nas três superfícies —
  ranking, cabeçalho do atleta e a **convocação**, que é mensagem enviada;
- a **versão aceita é por circuito**, e agora com portão nos três elos;
- o **corte do ranking do BH** ganhou trava: a "melhoria de resiliência" mais natural
  do mundo o apagava em silêncio, e a bateria ficava verde;
- a **linha "sou eu"** do ranking deixou de ser a menos legível da tela;
- o **rodapé** voltou, com o critério de desempate no lugar da legenda do torneio;
- e **dois textos meus que afirmavam o que não era** foram corrigidos: o rótulo que
  creditava proteção ao cartão compartilhado (que nunca teve o defeito) e o aviso que
  negava o certificado do Top 3 num circuito cujo regulamento o promete.

**Bateria: 956 asserções, 0 falhas.** 12 mutações nesta rodada, 12 vermelhas.

---

### 2026-09-29 — NO AR: o regulamento desvinculado, o bye com rotação, e o 80% fora do que o atleta lê

**NO AR desde 29/09/2026** (de acordo do Juliano: *"publica e vamos em frente"*).
`admin-action` **v62 → v63**, e o front por push `cd5249a..decd649`, bundle
`index-D3bMzH9x.js`, site HTTP 200. **Ordem: motor primeiro**, pela regra de bolso
que nasceu ontem — *o servidor passou a DEVOLVER mais, então o motor vai primeiro*.
`motor:conferir` com **0 divergências** e `verify_jwt` intacto nas nove funções.
`athlete-action` v22, `login-atleta` v11 e `comprovante-url` v3 **não** foram tocados
(o `git diff` de `supabase/functions/` tinha um arquivo só).

**Dados antes e depois, idênticos:** atletas 15, circuitos 1, circuito_atletas 15,
`atleta_documento` 0, partidas 34, chaves 1, pagamentos 12, W.O. 5, sessões 10,
mensagens 288. E **três** impressões digitais inalteradas — competição
`f76240cc…`, rating `43abc1de…` e, nova nesta subida, a **configuração dos
circuitos** `d33245dd…` (slug, versão do regulamento, teto e percentual), que é
exatamente o que esta fatia mexeu no código e não podia mexer no dado.
Roster do BH intacto: **12 no circuito, 2 no backlog, 1 suspenso**.

**Smoke:** site 200; `login-atleta` responde; `admin-action` v63 exige PIN.
O caminho de escrita não foi exercitado ao vivo de propósito — criar circuito é
gravação, e o nome/slug ainda dependem da decisão do Juliano.

**O que este pacote leva, em uma linha cada:**
- o regulamento **só fala do circuito em que o atleta está entrando** — saiu a caixa
  de transição e o Cap. 2 deixou de impor a categoria do BH a circuito novo;
- o **80%** não aparece mais em nada que o atleta leia (falta só o carimbo da v03-13);
- o **bye** ganhou rotação no Sistema A e capítulo no texto;
- o **mínimo de 8** e a **janela de entrada do Cap. 11** passaram a ter portão no
  servidor, não só na tela;
- o admin passou a **ver** o regulamento do circuito, e é avisado na criação;
- e o **teto voltou a ser regra da plataforma**, 20 para todos.

---

### 2026-09-29 — O caminho do 2º circuito: o admin passa a ver o regulamento (0.10.7) — e o teto volta a ser regra da plataforma

**A SUBIR — ainda não publicado.** `admin-action` **v62 → v63** e front por
`git push`. Decisão do Juliano: *"comece pelo 2º circuito"*.

⚠️ **METADE DESTA FATIA FOI DESFEITA ANTES DE SUBIR, e o motivo é bom o bastante
para abrir a entrada.** O 0.10.9 (teto editável por circuito) foi escrito, revisado
pelas 8 duplas e **removido** — porque eu perguntei ao Juliano se a decisão dele de
**10/09/2026** (*o teto é regra da plataforma, 20 para todos*) ficava revogada pelo
código, que tinha ido para o outro lado em duas ondas, e **ela fica de pé**.

Ou seja: eu tinha lido a divergência entre código e decisão como **defeito do
código**, e alinhei o lado errado — em 27/09 mudei o *regulamento* para *"até 20,
definido pelo organizador"*, e em 28/09 criei o campo na tela. O conserto certo era o
inverso. Agora o motor **crava 20**, nenhuma tela pergunta, e os três textos do
regulamento voltaram a dizer "20".

**E isso desfez um desvio da regra 7 que eu não tinha registrado.** A linha do teto é
**conteúdo compartilhado do Sistema A**, então ela renderiza para o **v03-12** — a
versão do BH, que **tem aceite gravado**. A troca de 27/09 alterou o texto que aquele
recibo aponta, sem re-aceite, que é exatamente o que a regra 7 proíbe. Restaurar a
frase original **devolve o texto ao que era quando os aceites foram colhidos**.

**Ordem: motor primeiro, app depois — e a ordem aqui é de QUALIDADE, não de risco.**
Verifiquei em vez de afirmar: o `git diff` de `supabase/functions/` tem **uma única
mudança**, a lista do `select` do `CRIAR_CIRCUITO` (6 linhas, 5 delas comentário).
`DEFINIR_CONFIG_CIRCUITO` **já aceitava** `maxAtletas` na v62 que está no ar — então
o campo novo do teto funciona **mesmo sem subir o motor**.
As duas ordens são seguras: com o motor velho, o app novo lê
`criado.regulamento_versao` como `undefined` e a linha simplesmente **não aparece**
(há guarda); com o app velho, o motor novo devolve dois campos a mais que ninguém lê.
Motor primeiro só garante que o admin nunca veja a tela nova sem o dado.

**O contexto.** Decisão do Juliano em 27/09 (item 0.6.22): o 2º circuito será de
**pontos** e será um **circuito novo** — não é o BH mudando de sistema. O
`CRIAR_CIRCUITO` já criava circuito de pontos desde a Fatia A1. O que faltava era o
admin conseguir **operá-lo depois**, e eram dois buracos do gatilho "antes de abrir
o 2º circuito".

**1. *(DESFEITO — ver acima.)* A tela afirmava que o teto era fixo em 20 — e não era (0.10.9).** O motor
sempre aceitou `maxAtletas` no `DEFINIR_CONFIG_CIRCUITO`; a tela não oferecia o
campo, e ainda dizia *"O teto é fixo em 20 atletas por circuito"*, frase que deixou
de ser verdade quando a criação passou a perguntar (8 a 20). Quem criasse um
circuito com o teto errado **não tinha como corrigir pela tela**.
Agora o card de configuração tem o campo, e **a tela bloqueia fora da faixa** em vez
de deixar o motor aparar em silêncio — aparar sem dizer faria o admin digitar 50,
ver "salvo" e ficar com 20 sem saber.
E a tela diz o que acontece de verdade ao **baixar** o teto. Conferi **executando o
motor**: o teto é lido só na **entrada**, então baixá-lo **não remove ninguém** — só
fecha a porta até alguém sair. Com o circuito mais cheio que o teto novo, a tela
avisa isso em vez de bloquear: fechar a entrada com o circuito cheio é decisão
legítima.

**2. O admin era cego para o regulamento do próprio circuito (0.10.7).** Eram três
coisas — *não é avisado, não vê, não muda* — e **duas** foram fechadas. O formulário
de criação passou a dizer, **antes** de criar, qual versão o circuito vai usar, que
é o texto que **todo atleta daquele circuito vai aceitar**, e a diferença que só
aparece no documento: **circuito de rating novo nasce sem o Torneio Presencial de
Encerramento**, porque aquele capítulo é do BH. E o card de configuração mostra a
versão em vigor.
**A terceira ponta — "não muda" — NÃO foi feita, e é deliberado.** Trocar a versão
de um regulamento já aceito muda retroativamente o que o recibo do atleta prova: é o
que a **regra 7** proíbe. A tela **explica isso ao admin** em vez de oferecer o
botão, e há asserção provando que o `DEFINIR_CONFIG_CIRCUITO` não toca o campo.

**3. E o instrumento estava mentindo de novo — achado por mutação.** O banco falso
projetava colunas só no caminho do `select`; no retorno de `insert(...).select(...)`
ele devolvia a **linha inteira**, qualquer que fosse a lista pedida. Consequência
medida: tirar `regulamento_versao` do select do `CRIAR_CIRCUITO` deixava a bateria
**verde**, porque a asserção do recibo não tinha como enxergar a diferença. É a
**mesma família** do furo do `select("*")` em `LISTAR_TELEFONES`, que ficava verde
devolvendo `pin_hash` de todo mundo — e aquele conserto, de 27/09, só cobriu metade
do caminho. Corrigido, **e desta vez o instrumento ganhou portão contra si mesmo**:
4 asserções que provam que a escrita com `select` recorta colunas, porque a lição de
ontem foi que *todo portão novo precisa ser testado contra si mesmo*.

**4. O que as 8 duplas acharam (revisão concluída na madrugada de 29/09).**
Oito GO, sete com condições. **Um bug de dados de verdade e cinco frases minhas que
afirmavam a mais.**

**(a) O campo do teto não ressincronizava, e o Salvar gravava por cima.** Três
duplas pegaram. `tetoEdit` nascia de `useState(state.maxAtletas)` e **não** tinha o
`useEffect` que o campo do nome tem quatro linhas acima — cujo comentário descreve o
defeito palavra por palavra. E o `AdminDashboard` é o **único** painel sem
`key={circuitoSelId}`, então não remonta na troca de circuito. Caminho real: abrir o
BH (teto 20) → trocar para o circuito novo (teto 12) → o campo **exibe 20**, já
errado → salvar só o nome → **o teto do circuito novo pula para 20, em silêncio.**
Corrigido, e com asserção **genérica**: todo campo do painel inicializado a partir do
estado tem de ressincronizar — pega o próximo que nascer torto, não só este.

**(b) Eu pus uma frase falsa na tela do BH.** O card dizia *"É o texto que os atletas
**aceitaram** ao se inscrever"*, e no BH **14 dos 15** aceitaram v03-3, v03-5, v03-8
ou v03-11. Pior: o app **já tem** a função que calcula isso (`atletasSemAceite`,
criada em 19/09 justamente para o painel não poder dizer "todos aceitaram" com gente
em versão antiga) — e eu reintroduzi o mesmo defeito com outra redação. Agora a
frase descreve o mecanismo no presente (*"aceitam"*, verdadeiro em qualquer circuito)
**e conta**: *"14 de 15 atletas ainda não aceitaram esta versão"*. O card deixou de
tranquilizar falsamente e virou o **gatilho do 0.10.11**.

**(c) A terceira ponta do 0.10.7 já estava feita, e eu não conferi.** Eu registrei
que "não dei ao admin o poder de trocar o regulamento, de propósito". O caminho
**existe** desde 27/09: `DEFINIR_REGULAMENTO_VERSAO`, só super-admin, com
confirmação pelo nome do circuito, no card **📋 Regulamento deste circuito** — que
fica **logo acima** do meu. A minha frase *"não se troca aqui"* ficava a poucos
pixels de um card cuja função inteira é trocar. Agora ela **aponta para ele**; e para
o **organizador**, para quem aquele card não aparece, ela diz que quem troca é o dono
da plataforma.

**(d) "Invalidaria os aceites" erra o mecanismo, e errar para mais é pior.** O aceite
**não** fica inválido: ele passa a **apontar para um texto que ninguém leu**. E isso
é pior que invalidar, porque recibo inválido se anuncia e esse continua com cara de
estar em ordem. Corrigido na tela e no comentário.

**(e) "A diferença que importa" elegia uma de três — e deixava de fora a do
dinheiro.** Entre o `v03-12` do BH e o `vA-nc-01` mudam **três** coisas: o torneio (e
o certificado do Top 3), o **desconto de 80% para quem entra na 2ª etapa**, e as
rodadas fixas. Para um admin que está definindo preço, a do desconto é
discutivelmente a mais importante — e era a que faltava.

**(f) Os três tons do card estavam todos abaixo do mínimo de legibilidade, e na
ordem errada.** 3,00 / 3,06 / 3,96:1 contra os 4,5:1 que a norma pede — e o texto
"está tudo normal" era o **mais** legível, os dois de alerta os **menos**. Esta lição
já estava escrita neste mesmo arquivo, sobre esta mesma cor. A cor semântica foi para
a **borda** (piso 3:1) e o texto ficou legível. E o motivo do botão desabilitado
saiu de ~78px de distância para logo abaixo dele.

**(g) O aviso do teto disparava em `<`, mas a fila congela em `<=`.** Com 8 atletas
dentro e o admin digitando **8** — a forma mais natural de dizer "não quero crescer
mais" — nenhum aviso aparecia e a fila do backlog parava. Provado rodando o motor.
Corrigido, e o aviso passou a nomear quem de fato é afetado: os do backlog.

**(h) E uma lacuna do conserto de ontem.** O `athlete-action` ganhou portão contra a
reescrita `!== null &&`; a **guarda irmã** no `login-atleta` não — e a mesma
regressão voltava verde. Terceira vez na série que um conserto cai de um lado só, e
virou regra no `GOVERNANCA_AGENTES.md`.

**5. E a asserção do teto passou a proteger o lado certo — depois de passar VERDE
pelo motivo errado.** Ao inverter a regra, mutei o texto de rating de volta para a
redação de 27/09 e **a bateria ficou verde**. A asserção negativa proibia *"até 20,
definido pelo organizador"* — que é a redação do texto de **pontos**. O texto de
**rating** diz *"até 20 **atletas por temporada**, definido pelo organizador"*, com
quatro palavras no meio, então a regex nunca casava com o que ela existia para
proibir. E a positiva casava uma frase que os **dois** textos contêm, ficando verde
com um deles sabotado. As duas passaram a ser ancoradas na **frase inteira do seu
próprio texto**. É a quarta vez nesta sessão que uma asserção minha passa pelo motivo
errado, e a segunda por regex escrita a partir do texto vizinho.

**6. E uma pergunta do Juliano abriu o maior buraco do dia.** Ele perguntou se *"o
mínimo de 8 está garantido nos dois modelos de circuito"*. Fui medir, e a resposta
era **não** — não no sentido que importa. O motor **cumpria**; o que não existia era
**portão**. A única asserção sobre o mínimo 8 era `/no mínimo 8 atletas/` — uma regex
no **texto** do regulamento, que prova que o app **promete**, não que ele **cumpre**.
Trocar `ativos.length < 8` por `< 2` ou `< 4` deixava a bateria **verde**. É a
armadilha que o `CLAUDE.md` descreve com todas as letras, guardando uma promessa que
está nos **dois** regulamentos.
Fechado com **19 asserções que rodam o motor** em circuito A e em circuito B: com 7
ativos a etapa é recusada e **nada** é escrito (nem chave, nem partida); com 8 — a
fronteira exata — ela começa. Mais a asserção de que a guarda fica **antes** de o
motor perguntar qual é o sistema, que é o que a torna transversal; e a que impede
`AVANCAR_RODADA` de ganhar a mesma guarda, porque os dois regulamentos prometem que
a temporada **continua** se o número cair no meio dela. **6 mutações, 6 vermelhas.**

**Bateria: 776 → 855 asserções, 0 falhas, saída 0.** **40 mutações no total** (14 da
fatia, 12 das condições, 8 da inversão do teto, 6 do mínimo de 8), **40 vermelhas** —
e **sete** delas só ficaram vermelhas **depois** de o instrumento ou a asserção serem
consertados. Esse número é a medida honesta do dia: a bateria não estava protegendo
sete regras que ela parecia proteger.

---

### 2026-09-27 — Ciência do regulamento ao entrar num 2º circuito (0.6.21)

**NO AR desde 27/09/2026, 22:4x (de acordo do Juliano: "Publique os dois")**:
front no bundle `index-xuSt1ncM.js` (push `52bd47b..940adf0`), depois
`login-atleta` **v9 → v10**.
**A ordem recomendada foi cumprida: APP PRIMEIRO**, com a confirmação de que a
Vercel já estava servindo o bundle novo antes de o motor subir. `motor:conferir`:
9 funções, 0 divergências, `login-atleta` no ar com `verify_jwt: false` — que é o
valor certo; `true` ali pararia o login de todo mundo.

**Conferido ao vivo depois:** a função responde (`Ação desconhecida` para ação
inexistente; `cadastro_nao_encontrado` no `PARTICIPAR` com telefone que não existe
— ou seja, a autenticação vem antes de tudo, como projetado). Dados antes e depois
**idênticos**: atletas 15, circuitos 1, circuito_atletas 15, partidas 34,
solicitacoes_wo 5, pagamentos 12, `atleta_documento` 0. Roster do BH 12 ativos +
2 backlog + 1 suspenso. Hashes `a4027146…` e `7346db66…` inalterados. E o número
que mais importava nesta subida: **`atleta_sessao` continua em 10** — ninguém foi
deslogado.

**⚠️ A ORDEM INVERTE EM RELAÇÃO À ONDA ANTERIOR: APP PRIMEIRO, motor depois.** Não é
esquecimento — a regra nunca foi "motor primeiro". A regra, formulada pelo Guardião
de Confiabilidade e agora escrita no `CLAUDE.md`, é: **sobe primeiro o lado que
tolera a versão antiga do outro.** Aqui o motor novo **recusa** o que o app velho
manda (sem aceite declarado → 400, e o bundle velho nem tem tradução para esse erro:
cairia em "Não foi possível concluir"). Já o app novo é **compatível para frente**:
conferido no fonte que está no ar, o v9 lê só os campos que conhece e **ignora**
`aceiteRegulamento` e `versaoRegulamento`, gravando o mesmo que hoje. Logo a janela
"app novo + motor velho" é melhor que o estado atual, e a inversa quebra o botão.

**E a melhor jogada é não ter janela nenhuma:** publicar as duas metades **antes** de
criar o 2º circuito. Com 1 circuito no banco, as duas portas do "Participar" estão
mortas (a de dentro não renderiza com lista vazia; a de fora exige a página pública
de um circuito não-BH, que não existe), então nenhum atleta pode estar no fluxo em
nenhuma das ordens. Nenhuma migração, nenhuma coluna nova.

**Backup obrigatório antes de publicar, e não existia:** o `login-atleta` **v9** —
a função do login de **todos** os atletas — não tinha cópia em pasta nenhuma. Salvo
em `docs/backups/motor-no-ar-2026-09-27/ar-login-atleta-v9.ts`, com o método de
verificação e o limite dele escritos no LEIA-ME.

**O que muda, e por que agora.** O Juliano achou isto testando a inscrição, ao
perguntar *"como vou saber se é o regulamento correto?"*. O fluxo "Participar de
outro circuito" tinha três telas — identificação, CPF, pronto — e **nenhuma
mencionava regulamento**, enquanto o servidor gravava `aceite_regulamento: true`
com a versão do circuito. Recibo de consentimento apontando para um texto que o
atleta nunca abriu; e o re-aceite não pegava, porque a versão gravada já era a
correta.

Ficou urgente com a decisão dele de criar o **2º circuito por pontos**: quem vem
do BH (rating) entraria "aceitando" um regulamento com pontuação, pareamento e
encerramento diferentes.

- **Tela:** o fluxo mostra o regulamento do circuito **alvo**, com o sistema dele
  ("este circuito é por pontos — vitória vale 2, derrota 1, sem rating"), e o
  botão só destrava com o aceite marcado. Sem versão carimbada no circuito, a tela
  nem oferece confirmar — fail-closed nas duas pontas.
- **Servidor:** o atleta passa a **declarar** qual versão está aceitando, e o
  servidor compara com a do circuito. Divergência (tela velha aberta, carimbo
  trocado no meio do caminho) é recusada em vez de virar consentimento de um texto
  que não é o vigente. É o molde do `ACEITAR_REGULAMENTO`.
  **Precisão que dois guardiões cobraram, e é regra 6 do `CLAUDE.md`:** não escreva
  "o servidor exige o aceite". O app manda o campo e o botão trava até a caixa ser
  marcada — a caixa é trava **de front**, e nenhum servidor prova que um humano leu.
  O que o servidor exige **de fato**, e está testado em runtime, é: *não grava
  consentimento sem versão declarada, e recusa se a versão declarada não for a
  vigente.* O que a mudança conserta é a plataforma ter deixado de **registrar
  recibo sem tela por trás**.
- **De carona, uma brecha que ninguém tinha visto:** o responsável legal de menor
  de 18 era exigido **só pela tela**. O servidor aceitava um menor sem responsável
  se o pedido viesse sem os campos. Agora o servidor exige nome e CPF do
  responsável, e recusa antes de gravar qualquer dado pessoal.

**Bateria: 583 → 672 asserções, 0 falhas.** A seção nova imprime **89**, das quais
**~45 rodam o `login-atleta` de verdade** — é a **primeira vez** que essa função é
executada pela bateria, que passou de três para **quatro** Edge Functions — e o resto
são checagens de fonte na tela. **12 testes de mutação, 12 vermelhos.**

**O que a revisão dos 8 guardiões desenterrou, e que mudou esta fatia depois do
primeiro commit** — vale listar, porque três coisas passavam **verdes**:

1. **A guarda do menor era fail-OPEN, e era o próprio defeito que ela vinha
   consertar.** Ela toda vivia dentro de `if (nasc)`: bastava **omitir** a data de
   nascimento para nenhuma checagem acontecer, e o menor entrava com
   `data_nascimento: null`. Provado rodando pelo Guardião Jurídico. E quem se
   beneficia de omitir a idade é o **próprio menor**, que tem o PIN na mão — não é
   invasor atacando terceiro, é o titular contornando a proteção que existe para ele.
   Agora a data é obrigatória, e idade que não dá para calcular é **recusa**.
2. **O 2º caminho do fluxo não recebia o circuito — e é o caminho principal.** O
   atleta digita o telefone na página de inscrição, o app detecta o cadastro e
   oferece "você já é do Clube, participe reusando seu cadastro". Essa invocação não
   passava `circ` nem `sistema`: o cartão nascia bloqueado dizendo "fale com o
   organizador", com o botão morto — e se só o bloqueio fosse consertado, o sistema
   cairia no padrão "A" e mostraria o regulamento de **rating** num circuito de
   **pontos**, que é exatamente o defeito da fatia. Pego pelo Designer Visual e pelo
   Guardião de Confiabilidade, independentemente. **A bateria não via**: as checagens
   de fonte recortam o corpo da função, e o defeito estava no ponto de chamada.
3. **A fronteira dos 18 anos não estava protegida.** Os cenários eram 15 e 36 anos;
   trocar `idade < 18` por `idade < 17` deixava a bateria verde, e o jovem de **17** é
   o caso real mais provável. Agora há cenário de véspera e de dia seguinte.
4. **A guarda do BH passava pelo motivo errado.** A única linha entre este fluxo e o
   circuito de produção é `if (circ.slug === "bh")`. Sabotá-la ficava **verde**, porque
   o cenário do BH não espelhava a produção e a chamada morria em
   `inscricoes_fechadas`. Agora o cenário tem `inscricoes_abertas: true` e
   `regulamento_versao`, e o teste confere o código de erro, não só o status.
5. **Quem já tinha documento nunca tinha a idade conferida** — o bloco do menor vivia
   dentro do `if (!doc)`. Agora a idade é lida do arquivo.

**Mais o que a revisão mandou dizer ao atleta e ao admin, e que não estava dito:**
o rating dele **não muda** no circuito de pontos (o regulamento `vB-01` diz quatro
vezes que "não há rating", e as quatro falam do circuito novo — nenhuma dizia que o
dele continua correndo lá); a tela do atleta deixou de imprimir "RATING" em circuito
de pontos, no perfil e no ranking; o aviso de **fase** entrou no fluxo, porque
"o admin vai te incluir em breve" pode significar **meses** na reta final da
temporada; a caixa de **jogos presenciais** foi copiada do fluxo irmão (quem usa este
fluxo é justamente quem tem mais chance de estar em outra cidade, e era o único que
não era avisado); uma falha de rede deixou de ser renderizada como culpa do
organizador; e a tela de criação de circuito, que dizia "pronto para inscrições",
passou a dizer que ele **nasce com as inscrições fechadas** — o que o Juliano
descobriria por ausência, não por erro.

**Duas lições sobre a própria bateria, e a diferença entre elas importa:** (a) uma
checagem de fonte olhava uma janela **fixa** de 9.000 caracteres e a condição estava
a 9.524 — ficou **vermelha**, falhou para o lado seguro; (b) pior: janela ancorada na
função é fiel ao **corpo** e **cega para quem invoca**. Padrão novo, registrado no
`CLAUDE.md`: quando uma prop é o que faz a tela funcionar, conte os pontos de chamada
e exija a prop em **todos**.

**Decisão registrada junto (ROADMAP 0.6.22):** o 2º circuito será **novo** e de
pontos, não o BH mudando de sistema. O sistema do BH está **cravado no motor**
(`getSistema` devolve "A" sem ler a coluna) e não existe ação para trocá-lo —
mexer na coluna na mão faria a tela mostrar pontos enquanto o motor calcula
rating.

---

### 2026-09-28 — A porta da frente protege o menor, e a janela de renovação para de mentir

**NO AR desde 28/09/2026** (de acordo do Juliano: *"pode"*). Front: push
`f1650d0..d4901d1`, bundle `index-ChzCGRGK.js`, site HTTP 200. Motor:
`athlete-action` **v21 → v22** e `login-atleta` **v10 → v11**, nesta ordem, cada um
seguido de `npm run motor:conferir` com **0 divergências** e `verify_jwt` intacto nas
nove funções. `admin-action` v62 e `comprovante-url` v3 **não** foram tocados.

**Dados antes e depois, idênticos:** atletas 15, circuitos 1, circuito_atletas 15,
`atleta_documento` **0**, partidas 34, pagamentos 12, solicitações de W.O. 5,
`atleta_sessao` 10, mensagens 288. Hashes `b79ece7e…` (competição) e `43abc1de…`
(rating) **inalterados**.

**Teste de fumaça ao vivo, pelos caminhos de RECUSA** — escolhidos porque o Guardião
de Segurança já tinha provado que a guarda roda **antes** de qualquer escrita, então
eles não sujam produção. As três responderam com a frase exata:
- sem data → *"Informe a data de nascimento para concluir a inscrição."*
- ano 1850 → *"Confira a data de nascimento: o ano informado não parece válido."*
- menor sem responsável → *"Para menor de 18 anos, a lei exige o consentimento de um
  responsável legal. Volte ao passo 1 e preencha o nome e o CPF do responsável."*

E a prova de que não sujaram: depois das três chamadas, `atletas` 15,
`atleta_documento` 0 e **`tentativas_busca_cpf` nos últimos 15 minutos: 0** — nem a
linha de tentativa por IP foi criada. `login-atleta` v11 responde normalmente.

**Uma lição de medição, e é a segunda vez que ela me pega.** O meu script de
verificação do site lia o `index.html` de `clubedotenisdemesabh.com.br` **sem seguir
redirecionamento** — e esse domínio responde **308** para o `www`. Resultado: vinte
tentativas lendo string vazia e reportando "ainda o antigo", enquanto o pacote novo
**já estava no ar**. O sintoma é idêntico ao de uma subida anterior, que também ficou
registrada como "não subiu" por este mesmo motivo. **`curl -L` sempre**, e o
verificador tem de falhar ruidosamente quando não consegue ler nome de pacote nenhum,
em vez de chamar isso de "antigo".

*(entrada original, de quando a fatia ainda não tinha subido:)* `athlete-action`
**v21 → v22**, `login-atleta` **v10 → v11** e front por `git push`. Decisão do Juliano: *"arrumar esses dois
pontos"*. Revisão das **8 duplas** sobre o commit `9c7fbf6`: 8 GO, 7 com condições —
todas aplicadas antes desta linha ser escrita.

**Ordem: APP PRIMEIRO, motor depois** — e a razão exata importa, porque eu a tinha
escrito **mais grave do que ela é**. Eu havia registrado que "o motor novo recusa o
que o app velho manda, então a inscrição quebraria". O Guardião de Confiabilidade foi
ao bundle publicado e mediu: o formulário **já exige** data de nascimento e, para
menor, nome e CPF do responsável (`f1650d0`, a linha do `faltando`) — e esta fatia
**não tocou** nenhuma dessas linhas. Então a ordem invertida **não fecharia a porta**;
o que se perderia é a **qualidade da mensagem** (o bundle velho não tem as frases
novas na lista branca e mostraria o genérico "Não foi possível concluir").
Continua sendo **app primeiro** — e o caso real que justifica é este: o campo de data
não tem `min`/`max`, então dá para digitar 1850, a tela aceita e o motor novo recusa.
É aí, e só aí, que o usuário encontra a guarda nova — e é por isso que ele precisa do
app que sabe traduzir a recusa.

**1. O `INSCREVER` não tinha guarda de menor de idade nenhuma.** É a **porta da
frente** — por onde entra todo atleta novo, e o único caminho para o BH. A única
linha era `if (p.responsavelCpf)`, que validava o dígito **se** o campo viesse; a
trava era só a tela. Achado por dois guardiões, que o classificaram **acima** do que
eles mesmos tinham vindo cobrar, pela comparação que dói: o `PARTICIPAR` — a porta de
serviço — tinha acabado de ganhar a guarda, e a porta da frente ficou mais frouxa.
Agora exige, no servidor: data de nascimento (fail-closed), data absurda recusada, e
nome **e** CPF do responsável para menor de 18. **21 asserções**, incluindo a
fronteira (véspera e dia seguinte dos 18) e a prova de que a recusa **não grava
nada**. **6 mutações, 6 vermelhas.**

**2. A janela de renovação estava invertida — e a causa eram três contas separadas.**
O Cap. 13 diz que a prioridade vai de `início−7` **até** o início, e que as vagas
abrem **depois**. O app tratava `início−7` como o **fim**, no card do admin, na
mensagem de renovação e no lembrete — três contas independentes, e eram três
justamente porque nada as obrigava a concordar. O atleta recebia **zero** dos 7 dias,
e o lembrete "dos últimos 3 dias" disparava **antes de a janela abrir**.
Virou **uma** função, `janelaRenovacao()`, com a constante num lugar só.

**Um tipo de teste que o projeto não tinha.** `src/App.jsx` não é executado por teste
nenhum — mas `janelaRenovacao` é **pura**, só depende de `Date`. Então a bateria
**extrai a função do fonte e a executa** com datas reais. Não é regex: são datas
entrando e saindo. Conta de data só se protege assim, e era exatamente onde o erro
morava. **29 asserções, 8 mutações, 8 vermelhas.**

**E o meu aferidor de mutação estava errado, o que é a lição desta rodada.** Ele só
chamava de "vermelho" quando havia falha **e** saída diferente de zero. Duas
sabotagens **quebravam o arquivo de teste** antes de imprimir qualquer falha — e ele
as classificava como **verdes**. Ou seja: eu estava medindo a proteção com um
instrumento que dava falso conforto justamente no caso pior. Corrigido nos dois
lados: o aferidor passou a tratar saída ≠ 0 como vermelho, e a asserção da data
inválida passou a capturar a exceção, para a sabotagem virar **falha limpa** em vez
de queda.

**3. O que as 8 duplas acharam, e que só existe porque elas foram chamadas.**

**(a) A meia-correção — cinco duplas na mesma linha.** Eu consertei a conta e deixei a
prosa em volta dela apontando para o modelo velho. O card do admin dizia
*"Prazo de renovação prioritária: **{data}** (7 dias antes do início)"* — só que
`{data}` tinha acabado de virar o **próprio início**, então o parêntese passou a
descrever a data **antiga**, e o card ensinava uma temporada começando 7 dias depois
do que o card do atleta dizia logo abaixo. E havia um segundo defeito que eu **não**
tinha visto: a frase conhecia **dois** estados e a função entrega **três**, então tudo
que não estivesse encerrado virava *"Janela aberta."* — inclusive as semanas **antes**
de ela abrir, que é o estado mais longo e mais comum. O erro trocou de sinal em vez de
sumir. Agora o card mostra o **intervalo** (`abre` a `fecha`), o que torna "os 7 dias
antes do início" verdadeiro por construção, e ramifica nos três estados.

**(b) Comentário não é portão.** O motor tinha seis linhas proibindo, em letras
garrafais, a "limpeza" `idadeInsc !== null && idadeInsc < 18` — porque `null < 18` é
`true` em JavaScript e o `!== null` transformaria idade desconhecida em liberação
silenciosa. O Guardião de Segurança aplicou **exatamente** a reescrita proibida e a
**bateria ficou verde**: com a primeira camada de pé, aquela linha nunca recebe nulo,
então nenhuma asserção de comportamento distingue as duas formas. Conserto: a regra
passou a dizer o que quer dizer (`idadeInsc === null || idadeInsc < 18`), sem depender
de coerção — mais a asserção de fonte que impede a volta.

**(c) A ressalva que morreu no mesmo commit que a matou.** O `login-atleta` tinha um
`idadeArquivo !== null` fail-open, com um comentário que terminava assim: *"quando o
`INSCREVER` exigir a data, esta ressalva morre"*. O `INSCREVER` passou a exigir a data
**neste commit** — e o texto ficou. Pior: era um `!== null` fail-open, a construção que
o comentário irmão proíbe do outro lado. Jurídico e Segurança pegaram os dois. Fechado:
idade desconhecida agora recusa, e a recusa **nomeia o remédio** (a tela não tem campo
para corrigir a data, então um 409 seco deixaria o atleta preso).
A asserção que **carimbava** a ressalva ficou vermelha sozinha — e o comentário dela,
escrito ontem, já mandava o que fazer: *"não 'conserte' — apague, e troque pela
recusa"*. Foi o que se fez.

**(d) A vaga não é garantida por sinalizar.** O Cap. 13 diz que *"a vaga só é garantida
com o pagamento da temporada confirmado pelo administrador"* — e as duas mensagens de
WhatsApp diziam *"Garanta sua vaga: toque em Quero renovar"* e *"Pra garantir, é
rapidinho"*, contradizendo o regulamento, o card do atleta e uma à outra. Corrigido nas
duas.

**(e) Uma data que apodrecia a leste de Greenwich.** `fechaISO` saía de
`inicio.toISOString()`, e `inicio` é meia-noite **local** — em `Asia/Tokyo` um início
em 01/11 virava `"2026-10-31"`. As fronteiras da janela estavam certas em qualquer
fuso; só a data que o atleta **lê** saía um dia antes. O campo saiu; as mensagens usam
o texto já formatado no fuso local. Hoje não mordia (admin no Brasil), mas a
plataforma é vendida para organizadores em qualquer lugar.

**(f) E o meu erro de sempre, pego pela minha própria mutação.** A asserção que
protegia o ramo "prazo encerrado" do card casava com a frase **do regulamento**, três
mil linhas acima — ficava verde com o card sabotado. Ancorada no ramo, ficou vermelha.
É a quarta vez nesta sessão que uma asserção minha passa **pelo motivo errado**.

**Números finais: 776 asserções, 0 falhas, saída 0. 15 mutações, 15 vermelhas** — todas
medidas com o aferidor corrigido.

**Bateria: 707 → 776 asserções, 0 falhas.**

---

### 2026-09-27 — O regulamento deixa de prometer o que o motor não faz (0.6.23)

**NO AR desde 27/09/2026 (de acordo do Juliano: "sobe")**: bundle
`index-CBpXC3qt.js`, push `a47f0f6..7217331`. **Nenhuma Edge Function mudou** —
conferido antes (`git diff` de `supabase/functions/` vazio) e depois
(`admin-action` v62, `athlete-action` v21, `comprovante-url` v3, `login-atleta`
v10, todas iguais). Site HTTP 200 com o bundle novo.
**Dados antes e depois idênticos:** atletas 15, circuitos 1, circuito_atletas 15,
partidas 34, pagamentos 12, solicitacoes_wo 5, `atleta_sessao` 10. Hashes
`a4027146…` e `7346db66…` inalterados. E **os 15 aceites continuam nas versões em
que estavam** — 11 em v03-3, 1 em v03-12, 1 em v03-11, 1 em v03-5, 1 em v03-8 —,
que é a prova de que nada foi reescrito por baixo de ninguém. Decisão do Juliano: *"já está definido que são 3 meses por temporada
e dois jogos por mês, ajustar tudo o que fala diferente"*, *"mandar para casos
omissos"*, *"ajustar o regulamento"*.

**⚠️ O RECIBO DESTA CORREÇÃO, e ele precisa estar aqui porque o tempo o destrói.**
A prova de que o `vB-01` pôde ser corrigido **no lugar** — sem versão nova e sem
re-aceite — é que não havia texto assinado. Isso é verificável **hoje** e
inverificável **para sempre depois**: no minuto em que existir o primeiro aceite,
ninguém reconstrói que em 27/09/2026 não existia nenhum. Então fica registrado o
que foi rodado e o que voltou:

    select coalesce(versao_regulamento,'(nula)'), count(*) from circuito_atletas group by 1;
    -- v03-3: 11 · v03-12: 1 · v03-11: 1 · v03-5: 1 · v03-8: 1 · vB-01: ZERO
    select count(*) from circuitos where sistema = 'B';          -- ZERO
    select id, slug, max_atletas from circuitos where ativo;      -- 1 linha: bh, max_atletas = 20

Apontado pelo Guardião Jurídico, e é a peça desta rodada que não dá para produzir
depois.

**O que foi corrigido no `vB-01`** (regulamento de pontos) — **três** promessas
falsas e **três** silêncios:
1. *"o número de etapas é configurável por circuito"* → **3 meses, 2 jogos por mês,
   6 rodadas em 3 etapas, fixo.** O motor tem `const rodadas = 6` e a ação de
   alterar recusa.
2. *"6º critério: sorteio registrado pelo admin"* → **decisão do administrador,
   registrada (Cap. 13)**, com o Cap. 13 explicando o empate absoluto e prometendo
   o critério **informado aos envolvidos**. Não existe sorteio no motor: ele ordena
   de forma estável só para a lista não ficar indefinida, e o texto novo descreve
   isso **pelo efeito**, sem elevá-lo a critério desportivo.
3. *"teto de 20 atletas"* → **até 20, definido pelo organizador**. `max_atletas` é
   configurável entre 8 e 20 (o motor faz `Math.min(20, Math.max(8, …))` na criação
   **e** na edição): 20 é o máximo da plataforma, não o teto de cada circuito. Um
   circuito de 12 vagas teria um regulamento prometendo 20.
   **E havia uma asserção defendendo o número errado**, cujo comentário dizia "não
   é mais configurável" — eu havia importado para o TETO o argumento das RODADAS.
   É o mesmo padrão do `"ativo_backlog"`: asserção que carimba o defeito.

**Os três silêncios, agora escritos no Cap. 10:** o teto com fila de espera e o
aviso de que *aprovação não é o mesmo que vaga garantida*; *não há entrada nas duas
últimas rodadas*, com estreia na temporada seguinte desde a primeira; e *mínimo de
8 atletas* para começar.

**O BH: a correção entra na v03-13, e a v03-12 NÃO foi reescrita.** Lá existem 15
aceites (1 em v03-12 e **14 em versões ainda mais antigas**, que carregam a mesma
frase). Implementado como `VERSOES_COM_RODADAS_FIXAS = new Set(["v03-13","vA-nc-01"])`,
com asserção **exigindo** que a v03-12 fique fora. O fechamento cobre todos de uma
vez, porque o gatilho do re-aceite é **divergência** de versão, não uma versão
específica: no dia do carimbo, os 15 recebem o card.
**Condição de ordem:** não carimbar a v03-13 sem o re-aceite de pé — é ele que
fecha o transitório.

**Sobre "não muda direito nenhum", com a linha que sustenta** (regra 6): o único
escritor de `rodadas_por_temporada` é o `NOVA_TEMPORADA`, gravando o `const
rodadas = 6`; o `DEFINIR_RODADAS` recusa; e o `DEFINIR_CONFIG_CIRCUITO` **não
alcança a coluna** (é allowlist de quatro campos — conferido de propósito, porque é
a ação que já foi pega reescrevendo a chave PIX). Todo atleta que jogou, jogou 6
rodadas.

**E o preço de ter corrigido: a promessa de fixidez precisou de asserção.** Antes o
texto era frouxo e o motor firme; agora o texto **promete** ao atleta que o número
é fixo, e a única coisa que sustentava isso era um `return`. A asserção que existia
guardava o **eixo errado** — conferia que o *organizador* leva 403, ou seja **quem**,
não **se**. O Guardião Jurídico provou: reabrindo a ação para o super-admin, a
bateria inteira ficava **verde**. Agora há asserção de que **nem o super-admin**
muda, que a recusa diz a mesma frase do regulamento, e que **nada é gravado**.

**Bateria: 684 → 699 asserções, 0 falhas.** Mutações: 8, todas vermelhas — inclusive
reabrir o `DEFINIR_RODADAS` (4 vermelhas) e pôr a v03-12 no conjunto (4 vermelhas).

**A bateria pegou algo que eu não sabia que existia:** as asserções que comparam os
documentos da v03-12 e da v03-13 e exigem que **toda linha nova seja declarada** —
o propósito delas é *"nenhuma regra nova foi colada em silêncio"*. Quebrei as duas,
corretamente, e declarei as duas linhas. Também movi a minha nota explicativa para
o bloco *"O que muda"*: o corpo do documento afirma reproduzir fielmente o que o app
mostra, e uma nota de autor ali quebraria essa afirmação. E o bloco deixou de dizer
*"uma única cláusula"* e *"o resto é idêntico"*, que ficariam falsos — são as duas
frases que o atleta usa para decidir se vale reler, e um "o resto é idêntico" falso
transforma a tela de re-aceite em carimbo.

---

### 2026-09-27 — Onda 0.6, fatia "o organizador consegue trabalhar" (5 itens)

**NO AR desde 27/09/2026, 20:17–20:46 (de acordo do Juliano: "pode")**:
`admin-action` **v61 → v62**, `comprovante-url` **v2 → v3**, front no bundle
`index-Dw7EeH6N.js` (push `4adc017..3d41405`).
Ordem cumprida: motor primeiro, app depois. `motor:conferir` rodado **depois de
cada função**: 9 funções, 0 divergências nas duas vezes. Site conferido ao vivo:
HTTP 200 e o bundle novo sendo servido.

**Dados antes e depois, conferidos:** atletas 15, circuitos 1, circuito_atletas 15,
circuito_organizadores 0, partidas 34, solicitacoes_wo 5, pagamentos 12. Roster do
BH: 12 ativos no circuito + 2 no backlog + 1 suspenso. Hashes de competição
(`a4027146…`) e de rating (`7346db66…`) **inalterados**.
Única diferença: `mensagens_enviadas` 274 → 288. **Rastreado**: 14 mensagens da
categoria `regulamento`, todas gravadas em 5 segundos às 20:45 local — o Juliano
disparando o aviso prévio do carimbo do regulamento (Onda 0.10.15) **durante** a
publicação. Nada a ver com esta fatia, e as 14 foram registradas com sucesso,
nenhuma ficou pendente.
**Ordem obrigatória: as duas funções primeiro, o app depois.** O app novo tem o
botão "↩️ Reativar" chamando `DESARQUIVAR_ATLETA` e manda telefone+PIN do
organizador para o `comprovante-url`; se ele subir antes do motor, o organizador
clica em botões que o servidor ainda não sabe atender. **Nenhuma migração,
nenhuma coluna nova.**

**⚠️ Publicar o `comprovante-url` leva uma carona.** A v2 no ar é de 08/08/2026 e
ficou **de fora de propósito** da liberação de CORS do `localhost` de 07/09
(registrado neste arquivo naquela data). O fonte do repositório tem as origens
`http://localhost:5173` e `http://127.0.0.1:5173` desde então e nunca foram
publicadas nesta função. A v3 sobe as duas coisas: o caminho do organizador **e**
o CORS de desenvolvimento. É aditivo e só afeta navegador, mas está sendo dito
aqui porque foi uma decisão de não subir, sendo desfeita de carona.
O fonte da v2 no ar foi baixado da API e salvo em
`docs/backups/motor-no-ar-2026-09-27/ar-comprovante-url-v2.ts`. **Correção de uma
afirmação errada minha:** eu disse que não existia backup dessa função em lugar
nenhum. Existia — `BACKUPS/motor-no-ar-2026-09-07/ar-comprovante-url.ts` (a pasta
de backups fora do repositório, a da convenção do `CLAUDE.md`), e conferi: é
**byte-idêntico** ao que está no ar. Eu tinha procurado só dentro do repositório.
A cópia de 27/09 fica de qualquer forma, datada do deploy, como manda a
convenção — e porque não há rollback de Edge Function.

**O que muda:**

- **0.6.2** — `LISTAR_TELEFONES` entrou na allowlist do organizador, **escopada
  por circuito**. Antes devolvia o telefone de *todos* os atletas da plataforma,
  sem filtro, e por isso estava fora da allowlist — com ela fora, a tela de
  inscrições do organizador ficava em "carregando…" para sempre e o botão de
  WhatsApp nascia morto. O ramo do BH ficou byte-idêntico ao anterior. E o erro
  deixou de morrer no console: usa a barra de aviso, com texto próprio.
- **0.6.3** — ação `DESARQUIVAR_ATLETA`: arquivar deixou de ser porta de mão
  única (o botão "Reativar" chamava `EDITAR_ATLETA`, que o organizador não tem).
  Devolve ao backlog, e recusa quem pediu exclusão de dados ou já foi anonimizado.
- **0.6.4** — `comprovante-url` aceita telefone+PIN de organizador, com escopo por
  circuito: ele deixou de decidir W.O. sem poder ver a prova.
- **0.6.13** — `LER_COBRANCA_PLATAFORMA` recusa o BH, como a irmã que escreve.
- **0.6.14** — o card da cobrança da plataforma mostrava tudo em branco mesmo com
  configuração salva (desempacotava a resposta duas vezes). Consertar isso acendeu
  três defeitos que ficavam escondidos atrás dos campos vazios, corrigidos junto:
  o card guardava a configuração do circuito anterior ao trocar de circuito (e
  "Salvar" gravaria no novo), os valores reabriam com ponto decimal num campo de
  real, e o negativo saía "R$ -50,00".

**Ficou de fora, deliberadamente:** **0.6.11** (`LIBERAR_NAO_RENOVANTES`). Foi
implementado e **retirado antes de subir**, porque a revisão desenterrou que a
regra do prazo dos 7 dias está invertida em relação ao Cap. 13 (novo item 0.6.15)
e que a tela e o motor não concordam. O botão continua caindo em "Ação
desconhecida", como antes — nenhuma regressão, nenhum conserto.

**Bateria: 535 → 583 asserções, 0 falhas.** A contabilidade não é óbvia:
`testes/onda-06.mjs` traz **36** novas; `testes/permissoes.mjs` foi de 25 para
**35** (perdeu **1** — a que exigia o organizador BARRADO em `LISTAR_TELEFONES`,
conquista registrada em 07/09, que passou a descrever o comportamento **antigo** —
e ganhou **9** do contrato novo do telefone, mais **2** que protegem
`NOMEAR_ORGANIZADOR` e `REMOVER_ORGANIZADOR`, que não tinham asserção nenhuma);
`testes/contador-mensagens.mjs` foi de 22 para **24**.
535 − 1 + 9 + 2 + 36 + 2 = 583. **16 testes de mutação, 16 vermelhos.**

As duas asserções dos papéis são o item mais barato e mais valioso da onda, e a
mutação mostrou por quê: conceder as duas ações ao organizador fazia
`REMOVER_ORGANIZADOR` responder **200** — um organizador removeria outro. Todo o
parecer do Guardião Jurídico se apoiava em "existe uma única porta para criar
organizador, e ela é do super-admin"; era exatamente a regra que a bateria não
protegia.

**🔴 E o achado que vale mais que esta fatia: o portão do `atualizar.sh` estava
cego para 68% da bateria.** `placar()` **devolve** 0 ou 1 e não sai do processo, e
quatro arquivos o chamavam sem `process.exit(...)` —
`nomes-que-nao-existem.mjs`, `erros-na-tela.mjs`, `contador-mensagens.mjs` e
`regulamento-por-circuito.mjs`. Eles saíam com código **0 mesmo com falha**, o
`&&` do `npm run teste` seguia adiante, e o `atualizar.sh`, que lê o código de
saída, **publicaria**. Eram **395 das 581** asserções de então, incluindo os
**351** do regulamento — os que foram escritos justamente depois do episódio das
regex de 19/09. Corrigido nos quatro, e provado: com uma asserção do regulamento
sabotada, `npm run teste` agora sai com **1**; antes saía 0. Achado do Guardião de
Confiabilidade. Nenhum dos quatro estava vermelho em silêncio — conferido antes de
corrigir, para o conserto não acender nada escondido.

**Uma condição de nomeação que esta fatia abriu, registrada como item 0.6.17:** o
"escopo por recurso" do comprovante é **derrotável**. Ele confere que o caminho
pedido consta de um W.O. do circuito do organizador — mas `comprovante_url` é
gravável por quem chama, e `SOLICITAR_WO` não exige token de sessão. Então o
organizador planta um W.O. no circuito dele apontando para o caminho de outro
circuito, e a conferência casa com a linha que ele mesmo plantou. **Inalcançável
hoje** (zero organizadores, zero comprovantes no banco) e só passa a existir com
um ato deliberado do super-admin: nomear o primeiro organizador. Não bloqueia esta
subida; **bloqueia nomear**.

**Duas coisas na infraestrutura de teste, e a segunda é grave:**
1. A bateria passou a executar **três** Edge Functions (era duas):
   `montarMotor({ funcao: "comprovante-url" })`, com um `storage` de mentira que
   registra o que foi assinado — e asserções de que **nada** é assinado quando a
   autorização recusa.
2. O banco em memória **não projetava colunas**. Por isso, trocar
   `select("id, telefone")` por `select("*")` em `LISTAR_TELEFONES` deixava a
   bateria **verde**, mesmo passando a devolver o `pin_hash` de todos os atletas
   do circuito. Agora projeta, e há asserção conferindo as chaves devolvidas.
   **O alcance disso é maior que o item 0.6.2:** enquanto o banco em memória não
   projetava, **toda** asserção da forma "esta ação devolve só X" estava improvada.
   A mutação também trouxe de volta `isento` — coluna da blindagem, que é regra
   inviolável. É aprendizado de bateria, não de fatia.

**A lição desta rodada, para ficar registrada:** a primeira versão desta fatia
gravava `status: "ativo_backlog"` — que é **rótulo do `<select>` da tela**, não
valor de banco. Nenhuma lista do admin casava, o `promoverBacklog` nunca promovia
o atleta e, no BH (onde a escrita vai para a tabela global `atletas`), ele
**perdia o login**. As 37 asserções estavam verdes porque exigiam justamente a
string errada: elas carimbavam o defeito em vez de proteger a regra. Seis dos
oito guardiões deram NO-GO pela mesma raiz. O conserto veio com uma asserção de
ponta a ponta — desarquivar, virar a etapa, e exigir que o atleta receba chave e
seja pareado —, que é o tipo de asserção que faltava.

**Erro de método meu, também registrado:** editei o motor enquanto três guardiões
revisavam o diff daquele motor, e eles auditaram uma versão que deixou de existir
no meio do parecer. A próxima revisão vai com o SHA de um commit, não com um diff
de árvore viva.

---

### 2026-09-27 — Onda 0.10.15: o carimbo do regulamento, o re-aceite do atleta e o aviso prévio

**No ar:** `admin-action` **v60 → v61**, `athlete-action` **v20 → v21**,
`login-atleta` **v8 → v9**, front por `git push`.
**Ordem obrigatória: as três funções primeiro, o app depois.** O app novo mostra
o card de re-aceite e a tela do carimbo; se ele subir antes do motor, o atleta vê
um botão que o servidor ainda não sabe atender. Nenhuma migração, nenhuma coluna
nova (o registro da data do carimbo ficou **de fora** de propósito — é decisão de
schema, ver 0.10.15 J5).

**O `login-atleta` volta para dentro do pacote.** Na onda de 16/09 ele ficou de
fora porque carregava uma mudança de outro assunto (o `veFinanceiro` do
organizador). Essa mudança foi **revertida do repositório**, e no lugar dela ele
passou a levar a guarda fail-closed do `PARTICIPAR` — que é assunto desta onda.
O financeiro do organizador **continua** sem subir, amarrado ao 1º circuito
vendido. Ver ROADMAP 0.10.19 (superado) e 0.10.6.

**O que mudou, em três frases.** O super-admin ganhou como **carimbar** a versão
do regulamento de um circuito (`DEFINIR_REGULAMENTO_VERSAO`, com
confirmação-com-nome, e recusando versão que não é da família daquele circuito).
O atleta cujo circuito mudou de versão passa a ver um card que o leva ao texto
novo e **colhe o re-aceite autenticado por token de sessão** — não pelo
`athleteId` que o navegador manda, porque recibo de consentimento não pode ser
forjável. E o admin ganhou o **aviso prévio** em dois modos: antes do carimbo,
para todos os ativos; depois, só para quem ainda não re-aceitou.

**O que o atleta e o organizador veem.** Para o BH, enquanto o carimbo **não**
for dado: quase nada — o card de re-aceite só aparece para quem está numa versão
diferente da vigente, e hoje ninguém está sendo re-perguntado. O que muda de
imediato é no painel: aparece a versão do regulamento do circuito (o admin era
cego para ela), e virar a temporada passa a **exigir digitar o nome do circuito**
(0.10.20). No instante em que a v03-13 for carimbada, os **12** atletas do roster
do BH passam a ver o card de re-aceite no primeiro acesso — e mais **2**
pendentes de inclusão, que o painel não conta mas que veem a pergunta no app
(ver a nota das contagens abaixo).

**⚠️ PROCEDIMENTO OBRIGATÓRIO NA VIRADA — não é código, e não pode ser
improvisado no dia.** A trava obriga carimbar a v03-13 **antes** de virar. Nessa
janela o circuito declara uma versão cujo próprio texto diz que ainda não vigora,
e quem se inscrever nela recebe recibo `versao_regulamento = v03-13` para uma
temporada que a v03-13 diz ter corrido pela v03-12. Com as inscrições abertas
(estão), é alcançável. Logo:
**fechar inscrições → carimbar v03-13 → `NOVA_TEMPORADA` → reabrir** — ou
carimbar e virar colados, na mesma sessão. Detalhe em ROADMAP 0.10.15.

**🚩 ANTES DO `git push` — o snapshot dos aceites (J2). Não dá para fazer
depois.** O `ACEITAR_REGULAMENTO` **sobrescreve** `versao_regulamento` sem
guardar o valor anterior, e o card de re-aceite vai ao ar junto com o app: o
**primeiro** atleta que clicar apaga a prova de sob qual texto ele estava.
**Nenhum** dos atletas do BH está em v03-12 hoje (11 em v03-3, 1 v03-5, 1 v03-8,
1 v03-11, mais 1 suspenso em v03-3). Salvar em `docs/backups/` um `SELECT` de
`circuito_atletas` (`atleta_id`, `versao_regulamento`,
`data_aceite_regulamento`, `aceite_regulamento`) **antes** do push — **sem
filtrar por status**: as **15** linhas, não as 12 nem as 14. Quem está pendente
ou suspenso também carrega versão antiga e também pode logar. É leitura, não toca produção, custa um comando — e é a única coisa
desta lista que, se for esquecida, não tem conserto.

**📐 As três contagens do BH — 12, 14 e 15 — e qual usar.** Conferidas no banco
em 19/09/2026 (`select` em `circuito_atletas` do BH; leitura, não toca nada).
Os números divergentes que circulam nos documentos **não se contradizem**: medem
coisas diferentes, e nenhum documento dizia qual.

| Nº | O que é | Onde vale |
|---|---|---|
| **12** | `status='ativo'` **e** `pendente_circuito=false` | é o **roster**: o que o motor pareia (`getAtivosNoCircuito`, `admin-action:177`) e o que o painel conta |
| **14** | `status='ativo'`, incluindo os **2 pendentes de inclusão** (v03-11, v03-8) | quem **vê** a pergunta do re-aceite no app — por isso o painel podia dizer "✓ todos aceitaram" e estar errado (0.10.15, 2ª rodada) |
| **15** | **todas** as linhas do BH, incluindo **1 suspenso** (v03-3) | o **snapshot do J2**: copiar tudo, sem filtro de status |

Ao escrever qualquer número aqui, **diga qual dos três é** — foi a confusão
entre eles que o supervisor do Curador pegou neste rascunho.

**Registro do carimbo (passo (e), Jurídico C3).** Ao carimbar, anotar **aqui**:
qual versão, **em que data** e **por quem**. Enquanto o J5 não existir no banco,
este registro manual é a **única** prova de quando o contrato com os atletas
mudou. Preencher no dia:
`Carimbo: BH v03-12 → v03-13, em __/__/2026, por ____.`

**Bateria: 474 → 535 asserções, 0 falhas.** Build OK. **12 testes de mutação**
nesta rodada. O achado de método que os produziu: as asserções do re-aceite eram
**regex sobre o fonte** e o guardião de Regulamento quebrou a regra de **três**
jeitos com a bateria **verde** nos três. Foram substituídas por **7 cenários
comportamentais** rodando o `athlete-action` de verdade, com sessão de mentira e
cripto de verdade (token gravado como SHA-256, o mesmo formato que a função
produz). Lição registrada em `GOVERNANCA_AGENTES.md`.

**ROLLBACK — leia antes de publicar.** Não há rollback de Edge Function:
"voltar" é republicar o código antigo. E **para o `login-atleta` o git não
serve** — provado por `diff` em 19/09: o HEAD carrega o bloco
`org_ve_financeiro`/`veFinanceiro` e o que está no ar **não** carrega, então um
`git show HEAD:...` devolveria um estado que nunca esteve no ar e liberaria o
financeiro do organizador sem o gatilho. A fonte de rollback das três é a pasta
de backup, **não** o git:
`JULIANO/CLUBE DO TÊNIS DE MESA/BACKUPS/motor-no-ar-2026-09-19/` —
`ar-login-atleta-v8.ts`, `ar-admin-action-v60.ts`, `ar-athlete-action-v20.ts`.
Para o app: `git revert` do commit do push.

**Conferir depois de publicar:** `npm run motor:conferir` (compara o `verify_jwt`
de cada função com o `config.toml`) e `npm run motor:listar`. **Além disso:**
`circuito-dados` e `despachos-do-dia` continuam com `entrypoint_path` apontando
para uma pasta de rascunho do projeto de torneios, sem redeploy desde 08/09/2026,
e **sem cópia salva do que está no ar** — não sobem nesta onda, mas seguem sem
rollback confiável. Registrado no índice de curadoria.

**Revisão:** as **8 duplas completas** (a mudança toca motor e dado pessoal).
Preencher os vereditos no dia.

---

## 2026-09-16 — Onda 0.10: o app para de adivinhar qual regulamento o atleta aceita

**No ar:** `athlete-action` **v19 → v20**, `admin-action` **v59 → v60**, front por
`git push`. Nesta ordem — motor primeiro. `login-atleta` **ficou de fora** de
propósito (ver 0.10.19). Nenhuma migração, nenhuma coluna nova.

**O que mudou, em três frases.** Sem saber a versão do regulamento do circuito, o
app e o servidor **recusam colher o aceite** em vez de carimbar um palpite — antes
o `athlete-action` gravava `v03-12`, a versão do BH, em qualquer circuito cuja
versão não tivesse sido lida, e o recibo ficava provadamente falso. O desconto
automático de 80% para quem entra na 2ª etapa **acabou** nos circuitos novos:
todo mundo paga o mesmo, e desconto virou ato do organizador, por atleta
(decisão do Juliano, 12/09). Para o BH, que promete os 80% no regulamento
vigente, criou-se a **v03-13** e uma **trava**: a virada de temporada é recusada
com 409 enquanto o circuito declarar uma versão que promete o desconto.

**O que o atleta e o organizador veem.** Quase nada: o BH continua em v03-12, com
80%, telas iguais. A mudança visível é que **virar a temporada do BH passa a ser
recusado** até a v03-13 ser carimbada — e hoje não existe botão para carimbar
(0.10.15(a)). É a trava funcionando, não defeito.

**Bateria: 82 → 392 asserções, 0 falhas.** Portão novo: `no-undef` ligada no
`.oxlintrc.json` e `testes/nomes-que-nao-existem.mjs` rodando **primeiro** na
cadeia, cobrindo app, bateria e motor.

**O que quase foi ao ar, e não foi.** Um `ReferenceError` (`sistemaAtivo` em vez
de `SISTEMA_ATIVO`) que deixava **tela branca para todo visitante sem sessão
salva** — atleta novo, logout, sessão expirada. Passou por `npm run build`, pelas
326 asserções da época **e** pelo `npm run lint`. Foi achado pelos guardiões
**Visual e Atleta, abrindo o app e deslogando** — o único portão que funcionou.
É a terceira vez que um erro só-de-execução atravessa build verde neste projeto;
por isso o portão novo.

**O teste ao vivo da trava ficou PENDENTE, e o plano estava errado.** O roteiro
mandava o Juliano apertar "Virar para a próxima temporada" e esperar o 409 com o
modal aberto. Mas o botão **não está alcançável** no estado atual: a virada é um
fluxo de dois passos (`App.jsx:7861-7866`) — com `fase = "etapa"` e
`proxima_aberta = false`, o painel que aparece é o de **abrir a pré-abertura**, e
o de virar só surge depois. E abrir a pré-abertura **não é inócuo**: anuncia a
próxima temporada aos atletas e abre renovação e cobrança.

Ou seja: o plano de smoke pedia um passo com efeito colateral real, e nem o
guardião que o desenhou nem eu conferimos se o botão estava alcançável. A trava
segue provada em bateria contra o motor de verdade — 8 cenários (versão nula,
vazia, `v03-12`, `v03-11`, `v03-4`, `V03-13`, `v03-14`, lixo), todos com 409 **e
partidas intactas** —, mas a confirmação ao vivo só vai acontecer no dia em que
a virada for de fato necessária. Registrado em vez de dado como feito.

**Revisão:** as **8 duplas completas** (motor + dinheiro), guardião e supervisor,
três rodadas em alguns casos. Todos os oito supervisores APROVARAM. Dois deles
erraram e retificaram por escrito. O histórico, com os achados e as reincidências
de processo, está em `GOVERNANCA_AGENTES.md`.

## 2026-09-10 — entrada escrita em atraso (16/09)

- **`admin-action` v58 → v59 foi ao ar e não tinha sido registrado aqui.**
  Commit `c43f327` ("Cada circuito ve o regulamento dele; teto de atletas passa
  a valer"), 14 linhas no motor. O que subiu: circuito de rating **novo** passa a
  nascer com `regulamento_versao: "vA-nc-01"` em vez de herdar o `v03-12` do BH
  (o Cap. 10, o Torneio Presencial, é do BH e não dos outros); e o **teto de
  atletas** passa a ser travado no motor entre **8 e 20** — 8 porque abaixo disso
  os confrontos se repetem dentro de uma temporada de 6 rodadas.

  **Por que a entrada está atrasada:** o `CLAUDE.md` manda registrar aqui a
  versão da função **depois** de publicar, e isso não foi feito. Resultado: por
  seis dias o CHANGELOG disse "segue v58" enquanto o ar estava em v59 — que é
  exatamente a armadilha que o próprio `CLAUDE.md` descreve em "o fonte pode não
  ser o que está no ar". Achado por dois supervisores, cada um por conta própria
  (Confiabilidade e Segurança), ao conferirem a versão publicada antes de
  aprovar a próxima. Três linhas do documento ainda dizem "v58" no corpo dos
  itens de 08-10/09; ficam como estavam, porque descreviam o estado correto **no
  dia em que foram escritas**.

- **O painel cobrava mensagens que já tinham sido enviadas.** Reportado pelo
  Juliano. Conferidas as **8 categorias** no banco: havia **zero pendências
  reais** — resultados nenhuma; confrontos 12, exatamente os 12 atletas com
  partida; backlog enviado aos 2 em 29/08; ranking 22 da chave `ranking-r4`, que
  é a última rodada processada; lembretes nenhum (o prazo mais próximo é 15/09 e
  eles só disparam a 3 dias); renovação fechada; torneio fora de fase.

  **A causa:** o histórico de envios saiu da carga geral por LGPD e passou a ser
  buscado sob demanda, com PIN, só ao abrir a tela de Mensagens. Mas o contador
  do painel continuou somando contra `state.mensagensEnviadas`. Enquanto o
  histórico não chegava, a lista era `[]`, `mensagemJaEnviada` não achava
  registro nenhum, e **toda** mensagem possível aparecia como pendente. O
  contador não estava lendo mensagens: estava contando na ausência delas. E a
  falha da busca morria num `console.warn` invisível.

  **O conserto, em uma frase: o app parou de afirmar o que não sabe.**
  Estado novo `msgsStatus`; o selo e o card só recebem número quando é "ok", e
  mostram "···" enquanto não sabem; a falha acende aviso na tela.

  **O que a revisão acrescentou, e é mais sério que o defeito relatado:** os
  botões "Iniciar disparo" e "Despachar tudo" não ficavam desabilitados durante
  o carregamento. Um clique ali **congela a fila** (`setFilaCongelada`) calculada
  contra histórico vazio — e leva o admin a **reenviar mensagem no WhatsApp para
  atleta que já recebeu**. Não é tela errada, é ação externa errada. As duas
  portas agora travam, com guarda na função E `disabled` no botão. *(Admin, que
  reclassificou o próprio achado de "cosmético" para bloqueante.)*

  **Dois erros meus que a revisão pegou, ambos afirmados com confiança:**
  1. Diagnostiquei o **teto de 200** mensagens como causa. Não era: o "mês" do
     app são as rodadas 5 e 6, criadas em 26/08, e a janela cobre isso com folga.
     O teto (item 0.5.3) segue dívida real, ainda não mordeu.
  2. Afirmei que **o PIN está em cache na entrada do admin**. Só no login por
     SENHA. No login por **biometria** o app entra sem senha de propósito — e a
     busca que eu pus na entrada abriria um modal de PIN em tela cheia, dizendo
     "primeira ação de escrita", para uma leitura que ninguém pediu. Era a linha
     vermelha que eu mesmo tinha definido. Corrigido com
     `if (getPinCache()) garantirMensagensEnviadas();`. *(Admin)*

  **E um erro numa asserção minha:** a primeira versão não ficava vermelha quando
  a linha protegida era **comentada** — o texto seguia no arquivo e ela dava por
  cumprida. Agora ignora código comentado. Mesmo furo que o Guardião de Segurança
  achou numa asserção minha em 08/09.

  **Outras correções de "o app afirma o que não sabe", todas do mesmo dia:** a
  barra de erro dizia "🚫 Não foi salvo — o servidor recusou" numa **leitura**
  que não salvava nada (agora tem cabeçalho próprio de leitura); o botão dizia
  "carregando" mesmo depois de **falhar**; e os contadores por categoria da tela
  de Mensagens anunciavam "0 de N já enviada(s)" contra histórico vazio.

  `testes/contador-mensagens.mjs` (novo, **18 asserções**), com mutação
  demonstrada em quatro pontos — inclusive uma que conta as ocorrências das duas
  guardas, então remover **uma** já fica vermelho. Bateria: **172 asserções**.
  Só front; motor intocado (`admin-action` v58).

  **Rito, 2 duplas:** Admin — NO-GO (o modal de PIN na biometria) → corrigido →
  GO. Confiabilidade — GO-com-condições (o cabeçalho falso na leitura) →
  cumprida → GO. Os dois reconfirmaram depois de eu ampliar o conserto.

  4 dívidas foram para a **Onda 0.9** do `ROADMAP.md`.

## 2026-09-10
- **O nome do app perdeu o "BH", e o circuito ganhou o nome dele.** Reportado
  pelo Juliano: a tela de inscrição oferecia "Clube do Tênis de Mesa BH" — que é
  o nome do APP — em vez do circuito. Decisões dele: o app é **"Clube do Tênis de
  Mesa"** (nacional, sem "BH") e o circuito é **"Circuito BH"** (sem número: o
  número é da temporada, e cravá-lo faria o nome envelhecer na virada).

  **Banco (já feito, 10/09).** Valores ANTERIORES, para o rollback ficar completo:
  `circuitos.nome_exibicao` = `Clube do Tênis de Mesa BH`;
  `circuitos.nome_circuito` = `Temporada BH 1`;
  `configuracao.nome_circuito` = `Temporada BH 1`. Os três foram para
  `Circuito BH`. **BH byte-idêntico nos dados de competição**, provado
  antes/depois: 14 atletas ativos, 34 partidas, e os três hashes (partidas,
  ratings, circuito_atletas) inalterados — `007953294dfb14c4…`,
  `dc0b716dcfe1eb27…`, `f0bc4b92eb729a06…`.
  Reverter: `update circuitos set nome_exibicao='Clube do Tênis de Mesa BH',
  nome_circuito='Temporada BH 1' where slug='bh';` e
  `update configuracao set nome_circuito='Temporada BH 1';`

  **App.** Título da aba, nome do PWA e ícone do celular (`CTM BH` → **`Clube`** —
  o manual não define sigla, mas usa "Clube" como forma curta; "Clube TM" era
  invenção minha e caiu na revisão). Descrição deixou de amarrar a plataforma a
  uma cidade. E `background_color` do manifest saiu de `#0a1628` — um **azul, cor
  proibida pelo manual** — para o verde-mesa `#1C2B27`; é a tela de abertura do
  app instalado, vista a cada abertura pelo ícone. *(Designer)*

  **Texto que cravava nome parou de cravar:** o aviso do passo 1 e a frase de
  ACEITE do regulamento passaram a usar o nome vindo do dado. A frase de aceite
  passou por três versões até fechar: cravava "Circuito BH" (erraria em outro
  circuito), virou "Sistema A" (preciso, mas jargão que o app nunca explica ao
  atleta) e terminou como "o regulamento de rating do **{nome do circuito}**".

  **Dois defeitos achados pela revisão, não pelo pedido:**
  1. O modal de cálculo de rating dizia `Circuito ${nome}` — com o nome novo
     viraria **"Circuito Circuito BH"**, numa tela que avisa "não pode ser
     desfeita". *(Supervisor de Confiabilidade)*
  2. **O painel ⚙️ Configuração do circuito desfazia o rename sozinho.**
     `nomeEdit` era capturado na montagem e o botão Salvar o regravava por cima,
     nas duas tabelas. Mesma família da Onda 0.6.1: estado local que congela e
     depois sobrescreve a verdade. Corrigido com `useEffect` de ressincronia.

  **Correção ao próprio rito, registrada como lição:** o dado foi trocado ANTES
  do deploy do app, e isso abriu uma janela em que a versão no ar — sem o conserto
  do `nomeEdit` — podia reverter o rename num clique em Salvar. A regra para a
  próxima: quando o conserto existe para impedir reversão silenciosa perto de um
  dado que vai mudar, **o código sobe antes do dado**.

  Bateria: **154 asserções, 0 falhas** (inalterada — é branding, não regra de
  competição). Motor intocado: `admin-action` segue v58, nenhuma Edge Function
  publicada, nenhuma migração.

  **Rito, 4 duplas:** Confiabilidade GO-com-condições (as duas cumpridas: aviso da
  janela e registro do valor anterior, este item); Curador (achou que o
  **v03-12 é o regulamento DO BH**, não do Sistema A — circuito novo usa
  `vA-nc-01`); Designer GO-com-condições (cumprida: "Clube TM" → "Clube");
  Atleta GO-com-condições (cumprida: o aceite deixou de usar jargão).

  ⚠️ **9 achados foram para a Onda 0.8** do `ROADMAP.md`, incluindo dois que
  precisam de decisão do Juliano e um que **bloqueia vender um 2º circuito de
  rating** (o regulamento não ramifica por circuito). E o Instagram, verificado:
  está vivo, publicou em 10/09, e **o token vence em 29/10** sem nada avisar.

## 2026-09-08
- **O app parou de engolir os erros do servidor — Onda 0.6.1.** Só front; o motor
  não muda uma linha (`admin-action` segue v58). O defeito: `dispatchAndSync`
  gravava a mensagem de erro num estado que **nada lia** (`setDbMsg` sem
  `setDbStatus("error")`, e a `DbBar` só renderiza com `"error"`), e o `dispatch`
  otimista já tinha mudado a tela enquanto o `loadFromSupabase()` que a desfaria
  ficava **depois** da chamada — pulado pelo `throw`. O organizador clicava em
  excluir um atleta, o atleta sumia da lista, o servidor recusava com 403 e nada
  aparecia. O `ROADMAP.md` chamava isso de "uma linha de conserto"; não era.

  **O que entrou, item por item:** barra própria para recusa do servidor,
  separada da de conexão (fundo/borda iguais, mas ícone 🚫 vs ⚠️ para não se
  confundirem quando empilham); as duas num wrapper `sticky, zIndex:1200`, acima
  dos modais de conteúdo (1000) e abaixo dos portões de confirmação (1400/1500/
  2000); a terceira linha **condicionada ao retorno real** de `loadFromSupabase()`
  — afirmar "a tela já voltou ao que está no banco" quando a recarga também
  falhou era mentir no pior momento, e o pior momento é a virada de temporada;
  `sent` do `SubmitMatchCard` reseta na recusa (o atleta veria "não foi salvo" e
  "✓ enviado" ao mesmo tempo); `setAcaoErro(null)` nas 4 entradas e no logout;
  contraste 2,7:1 → 9,9:1 e alvo de toque 10,7×14px → 32×32px no ✕; cabeçalho
  distinguindo cancelamento do PIN de recusa do servidor.

  **Exclusão de dados (LGPD):** `exclusaoSolicitada` era `useState` congelado no
  mount e ligado no clique sem olhar a resposta — se o pedido falhava, a tela
  dizia "📩 Pedido de exclusão registrado" **para sempre**. Agora deriva do estado
  vivo, `SOLICITAR_EXCLUSAO` recarrega no sucesso (não recarregava), e o texto
  parou de prometer "remoção dos seus dados" quando o que o sistema faz é
  **anonimizar** — a tela do admin já dizia certo; só a do titular estava errada.
  Na falha, a barra oferece o canal alternativo que o consentimento já promete.

  **Quem vê qual mensagem**, decidido e travado: super-admin vê o texto cru (é
  quem relata o defeito); **organizador vê só a frase 4xx** do motor, nunca o
  texto de máquina do 500 (ele é terceiro, e o banco é compartilhado com o app de
  torneios); atleta e visitante ficam no piso de uma lista branca fail-closed.
  Verificado no esquema de produção: **CPF e telefone não podem ecoar na tela** —
  o Postgres põe o valor violado em `DETAIL`, e nenhuma função devolve
  `details`/`hint`.

  `testes/erros-na-tela.mjs` (novo, **12 asserções**), com teste de mutação
  demonstrado em quatro pontos — tirar o `!modoOrg`, tornar erro sem status
  "autoral", mudar a pontuação de uma mensagem no motor, e um 4xx com template
  literal (este último foi um **furo real na primeira versão da asserção**, achado
  pelo Guardião de Segurança: ela não via a forma idiomática do repositório).
  Bateria: **154 asserções**. O `src/App.jsx` saiu do zero de cobertura.

  **Rito completo, 6 duplas:** Confiabilidade GO; Admin GO; Atleta GO (havia dado
  NO-GO e reverteu com evidência); Visual GO; Jurídico GO-com-condições
  (cumpridas); Segurança GO-com-condições (cumpridas). Em três duplas o
  **supervisor errou e o guardião provou** — box-sizing medido no Chrome, a
  `DbBar` que tem ramo de "carregando", e `NOVA_TEMPORADA` que não é do
  organizador.

  ⚠️ **A revisão desenterrou 13 achados pré-existentes** — falta de autenticação
  no `athlete-action`, dados que sobrevivem à anonimização, três outras telas com
  texto cru. Nenhum foi criado por esta mudança e nenhum a bloqueia. Estão na
  **Onda 0.7** do `ROADMAP.md`, com o veredito de cada guardião.

  **Descartado por teste:** a suspeita de que "Finalizar exclusão" nunca
  funcionara (`verify_jwt` ligado, app manda chave publicável). POST com corpo
  vazio devolveu **400 "pin e id são obrigatórios"** — o portão deixa passar.

  `POLITICA_PRIVACIDADE.md` §7 corrigido: prometia que o hash de CPF era purgado
  na exclusão, e não é. O texto agora descreve o comportamento real e aponta a
  Onda 0.7. A decisão sobre o que reter é do Juliano e está registrada lá.

## 2026-09-08
- **As permissões do organizador chegaram ao ar — `admin-action` v57 → v58** (sha `6e03fbeb131d`). A decisão que o Juliano tomou em 07/09, item a item, estava no repositório e **nunca tinha sido publicada**: a produção ainda concedia ao organizador `EXCLUIR_ATLETA`, `ABRIR_PROXIMA_TEMPORADA`, `CANCELAR_PROXIMA` e `DEFINIR_RODADAS`, e as **cinco ações de dinheiro sem portão nenhum** (`grep -c FINANCEIRO_ACOES` no arquivo que estava no ar: 0). Achado pelo Supervisor de Segurança. Agora vale a lista restrita, mais o portão `org_ve_financeiro` (nasce desligado, só o super-admin liga).

  Vai junto, e é **inerte**: `DEFINIR_ORG_VE_FINANCEIRO` e a configuração de cobrança da plataforma (`LER_`/`DEFINIR_COBRANCA_PLATAFORMA`). Provado por três caminhos independentes — a linha que recusa o BH antes de tocar o banco, o estado do banco (1 circuito, **0 organizadores**, 0 linhas em `circuito_cobranca`, 0 circuitos com o portão ligado) e o front, que não renderiza os cards com o BH selecionado.

  **Este deploy também acaba com a divergência** que atrapalhou o dia inteiro: publicou-se o arquivo do repositório, então a bateria passa a testar exatamente o que está rodando. Os deploys anteriores saíram de cópias montadas à mão, e o `entrypoint_path` das funções no ar apontava para pastas temporárias — foi essa a origem do descompasso.

  `testes/permissoes.mjs` (novo, **25 asserções**) trava a decisão: as 4 ações removidas, as 5 financeiras com o portão fechado, o portão lido do circuito **certo**, o par que faltava (com o portão ligado, passa), o super-admin continuando a poder tudo, e — o que uma mutação do Guardião Jurídico provou faltar — o organizador barrado em `LISTAR_TELEFONES`, `LISTAR_ORGANIZADORES`, `LER`/`DEFINIR_COBRANCA_PLATAFORMA` e `DEFINIR_ORG_VE_FINANCEIRO`. Bateria: **142 asserções**.

  **Rodada completa do rito, 6 guardiões:** Regulamento GO limpo (nenhum `case` de competição muda, provado por diff normalizado); Segurança GO ("para publicar, nenhuma condição"); Jurídico GO (a mudança só *tira* acesso de terceiro a dado pessoal); Atleta GO (nenhum caminho dele passa pelo diff); Confiabilidade GO com a condição de commitar os testes antes — cumprida; **Experiência do Admin NO-GO para NOMEAR organizador**, não para publicar.

  ⚠️ **NÃO NOMEAR NENHUM ORGANIZADOR AINDA.** Ver `docs/ROADMAP.md`, Onda 0.6 — a lista do que falta antes.

## 2026-09-08
- **Mensagem enviada parava de voltar para "pendente"** — o Juliano mandou 4 mensagens de resultado pelo WhatsApp e as 4 continuaram na fila. Duas causas somadas, e as duas foram corrigidas.
  1. **A chamada morria ao abrir o WhatsApp.** O clique dispara DUAS escritas — `REGISTRAR_MENSAGEM_ENVIADA` (segura a mensagem dentro do mês) e `MARCAR_RESULTADO_COMUNICADO` (é o que segura DEPOIS da virada do mês, `App.jsx:3148`) — e no mesmo gesto abre o WhatsApp, que tira o navegador da frente. No celular a página congela e o `fetch` morre antes de chegar. Agora as duas usam o modo `keepalive`, que sobrevive à saída da página. O botão "✓ Já enviei essa", que **não** sai da página, ficou de fora de propósito: a cota do keepalive é de 64 KB somando todas as chamadas em voo, e gastá-la ali faria faltar para quem precisa.
  2. **O servidor dizia que gravou quando não gravou.** O `case REGISTRAR_MENSAGEM_ENVIADA` embrulhava o insert num try/catch mudo e respondia **sempre** `sucesso: true`. Agora valida `id`/`categoria`/`texto` (400), devolve 500 com a mensagem do banco quando a gravação falha, e trata chave repetida (23505) como sucesso idempotente — que é o caso da chamada keepalive que chega duas vezes. **admin-action v56 → v57**, montado sobre o código que estava no ar (base conferida por sha256 `ab1ab013…`), então as ~163 linhas do financeiro do organizador **continuam sem ir ao ar**.
  3. **O app avisa quando falha**, em vez de engolir com um `console.warn` invisível. Um alerta por sessão de disparo, não um por mensagem — numa fila de 20 com o banco fora, 20 modais seriam pior que o defeito.

  Provado em produção pelo Guardião do Regulamento: as 2 partidas com `resultado_comunicado=false` e zero linha em `mensagens_enviadas` eram exatamente as 4 mensagens do incidente. Ele também pegou que a primeira versão da correção consertava **só metade** — o `MARCAR_RESULTADO_COMUNICADO` tinha ganhado um comentário prometendo o tratamento, sem o tratamento.

  `testes/mensagens.mjs` (novo, 24 asserções) e `banco.recusar(...)` no banco de mentira, que faltava para provar que o código TRATA o erro do banco em vez de só funcionar quando tudo dá certo. Bateria: **117 asserções**, rodada também contra o arquivo híbrido que foi ao ar.

  ⚠️ **Pendência anotada:** `LISTAR_MENSAGENS` tem teto de 200 linhas e agosto sozinho gravou 165. Quando o teto estourar, mensagem antiga sai da janela e **volta a aparecer como pendente** — o mesmo sintoma, por outra causa.

## 2026-09-07
- **Dá para entrar no app rodando na máquina (CORS de desenvolvimento)** — as Edge Functions só aceitavam os domínios de produção, então o app servido por `npm run dev` (localhost:5173) tinha a chamada cortada pelo navegador no preflight: não dava para entrar nem como atleta nem como admin, e só as telas públicas carregavam. Agora `http://localhost:5173` e `http://127.0.0.1:5173` estão na `ALLOWED_ORIGINS`. **No ar:** `despachos-do-dia` v5, `circuito-dados` v3, `athlete-action` v18, `login-atleta` v7, `admin-action` v55. Verificado ao vivo em cada uma: o preflight de localhost devolve a origem local, o do site oficial continua devolvendo o domínio oficial, e `verify_jwt` permaneceu `false` nas cinco. `comprovante-url`, `anonimizar-atleta` e `resetar-pin-atleta` **ficaram de fora de propósito** (portão do Supabase já exige token nelas; liberar CORS não mudaria nada). Login de atleta testado pelo Juliano no app local: entra normal.

  ⚠️ **A `admin-action` v55 NÃO é o financeiro do organizador.** O deploy foi montado a partir do código que estava no ar (v54) **mais as 6 linhas de CORS** — conferido por diff antes de subir: +6, −0. As ~62 linhas do financeiro por circuito e da cobrança da plataforma **continuam sem ir ao ar**, na fonte, esperando o 1º circuito vendido; quando forem, serão a v56. O mesmo vale para `login-atleta` v7, que **não** levou o `veFinanceiro` do `LOGIN_ORGANIZADOR`. Ou seja: o repositório segue à frente do ar nessas duas funções.

- **Achado grave no caminho de publicar o motor — corrigido antes de causar dano** — o `npm run motor:publicar`, criado nesta mesma data, não dizia nada sobre `verify_jwt`, e o padrão do CLI é **ligar** a verificação. As cinco funções que o app chama estão no ar com ela desligada; a primeira execução daquele comando as ligaria, o portão do Supabase passaria a exigir um token que o app não manda, e **login, painel e telas públicas parariam para todo mundo, BH incluído**. Achado pelo Guardião de Confiabilidade (parecer NO-GO). **Corrigido:** criado `supabase/config.toml` declarando o `verify_jwt` de cada função, conferido 9 de 9 contra o que está rodando, e o comportamento confirmado ao vivo nos 5 deploys (portão continuou aberto em todos).

- **Cópia do motor em produção guardada** — não existe rollback de Edge Function (voltar = republicar o código antigo, e o número da versão sempre sobe). O código que estava no ar em 07/09/2026 está em `JULIANO/CLUBE DO TÊNIS DE MESA/BACKUPS/motor-no-ar-2026-09-07/`, uma cópia fiel por função. Sem isso não havia caminho de volta, porque a fonte está à frente do ar.

- **Organizador — Financeiro por circuito (Fatia 2)** — flag `circuitos.org_ve_financeiro` (padrão OFF, **com grant ao anon na mesma migração** — lição do incidente) decide se o organizador vê/gere o financeiro do circuito dele. Ação super-admin `DEFINIR_ORG_VE_FINANCEIRO` + card `FinanceiroOrgCard`; gate no enforcement (config financeira + pagamentos do organizador só passam com o flag ON, senão 403); `LOGIN_ORGANIZADOR` devolve `veFinanceiro`; BottomNav esconde a aba "Pagam." do organizador quando OFF. Migração no ar (verificado: anon `SELECT *` em circuitos OK); edge (admin-action/login-atleta) na fonte, deploya com o 1º circuito vendido; front inerte (sem organizador). Fecha os itens 4 e 6 da revisão de acesso.
- **INCIDENTE resolvido — app fora do ar por `SELECT *` quebrado** — as 4 colunas de cobrança adicionadas em `circuitos` (Fatia 1 de pagamentos) sem grant ao anon quebraram o `getConfig` do app (que faz `SELECT *` implícito em `circuitos`) → "erro de conexão com banco" pra todos. **Fix:** colunas movidas pra tabela privada `circuito_cobranca` (RLS deny) e removidas de `circuitos`; anon voltou a ler (verificado). Dado zero perdido (colunas nulas, ação não deployada). Fonte do admin-action ajustada. Lição registrada na governança: nunca pôr coluna não-anon em tabela lida com `*` (mesmo implícito).
- **Organizador — revisão de acesso validada item a item** — com o Juliano, poder a poder. **Tirados do organizador (só super-admin):** excluir atleta, abrir/cancelar próxima temporada (e `DEFINIR_RODADAS`, que já era bloqueada — rodadas fixas em 6). **Depende do "financeiro por circuito"** (padrão desligado, Fatia própria): config financeira e pagamentos. **Mantidos:** operar rodadas, placar, W.O., inscrições, arquivar, desconto do atleta, público/privado, config geral, mensagens. Aplicado na fonte do `admin-action` (allowlist `ACOES_ORG`); inerte (sem organizador em produção), deploya com o 1º circuito vendido. Regra registrada: taxa da plataforma é **por atleta inscrito**, independe do desconto/isenção (ver PLANO_PAGAMENTOS). Detalhe em `ORGANIZADOR_ACESSO_COMPARATIVO.md`.
- **Organizador — rótulos das abas mais claros (Fatia 1)** — no modo organizador (sub-admin), as abas ganham nomes mais diretos: Etapa→"Rodada", Pend.→"A fazer", Msgs→"Avisos", $→"Pagam."; o super-admin mantém os nomes curtos. Só front. Comparativo e decisões em `ORGANIZADOR_ACESSO_COMPARATIVO.md` (financeiro por circuito e "desfazer sempre" são as próximas fatias).
- **Segurança — vazamento de preço individual fechado** — a função `preco_temporada_atleta` (isento/valor/preço final) era chamável por qualquer anônimo com um id de atleta (ids são públicos no ranking) → dava pra descobrir quem paga quanto/quem é isento. **Corrigido:** a consulta virou autenticada por token de sessão (nova ação `PRECO` no `login-atleta` v6, que deriva o atleta do token) e o EXECUTE da função foi **revogado de anon/authenticated** (só service_role/edge). Front passou a pedir o preço via edge com o token; sem sessão → não mostra. Verificado (anon não executa mais). Destrava um limitador por-usuário no futuro. **Front pendente de `atualizar.sh`** — até publicar, o card de renovação fica sem o preço (degradação suave); publicar logo.
- **Rede de segurança no publicar (`atualizar.sh`)** — o script passou a **testar o build (`npm run build`) ANTES de commitar/enviar**. Se o app tiver erro que quebra o build, nada é publicado e o site atual fica intacto (mensagem clara em pt). Instala dependências na 1ª vez; avisa se faltar Node. Pega a classe de erro de compilação/sintaxe que "publica quebrado pra todos". (Runtime que compila mas quebra na tela ainda passa — próximo nível seria preview + smoke.) Fecha o item "dar rede de segurança ao app de circuito".
- **Pagamentos parados no backlog (aguardando Asaas)** — por decisão do Juliano, a integração real de pagamento (Fatia 5b+) fica no backlog até ele criar a conta Asaas Sandbox + gerar a chave e mandar o jurídico revisar as minutas. Estado e próximos passos registrados em `PLATAFORMA_BACKLOG.md`. A fundação (Fatias 1–4 + 5 design + 5a inerte) segue pronta.
- **Monetização — Fatia 5 (design) + 5a (modelo inerte)** — `PLANO_PAGAMENTOS_FATIA5_INTEGRACAO.md` desenha a integração real com o gateway (Asaas): tabela `cobrancas`, edge `criar-cobranca` + `webhook-asaas` (assinado, idempotente), split, Pix Automático, segurança e teste em sandbox — com os pré-requisitos que bloqueiam o go-live (revisão jurídica + conta Asaas do Juliano). **5a aplicada:** tabela `cobrancas` (ledger ligado ao gateway, RLS deny-all, sem acesso anon, 0 registros) + `circuito_organizadores.asaas_wallet_id`. Inerte e footprint-zero — não cobra nada, nada existente tocado. As fatias 5b+ (chamar o gateway) esperam a conta Asaas.
- **Textos do seletor de sistema (Novo circuito) melhorados** — na criação de circuito, as descrições de A e B foram reescritas: A não cita mais o "BH" e explica que o rating **muda** (o atleta entra com o rating da CBTM e ele sobe/desce conforme os resultados no circuito); B perdeu o "a partida sempre conta" (que dava a entender que nos outros modelos não conta) e agora explica o modelo de pontos (V=2, D=1, todos começam em 0, ranking = soma da temporada). Só texto.
- **Despachos do dia — só ações do dia (edge v3+v4)** — o agregador mostrava itens que não eram ação de hoje. Corrigido em dois pontos: **(1) "processar"** só conta quando a rodada está realmente pronta (mesma regra do botão: rodada ímpar → prazo fechou; par → anterior processada; e todos os jogos da rodada resolvidos) — some o "processar: 5" fantasma do BH (rodadas 5 e 6 têm prazo em 15/09 e 27/09 e jogos por validar). **(2) "backlog"** (atletas aprovados aguardando) só conta quando dá pra incluí-los agora: pré-temporada, ou temporada fora do último terço e com vaga; no último terço (Cap. 11 — sem novas entradas), lotado ou temporada completa, some (esperam a virada). Resultado no BH hoje: **tudo em dia** (validar/processar/W.O./inscrições/divulgar/backlog = 0). Só edge (v4); o código do despachos-do-dia, que não estava versionado, foi salvo no repo.

## 2026-09-06
- **Rótulo do sistema: "Rating" / "Pontos" em todo lugar** — "Sistema A/B" (códigos internos) virou "Sistema Rating" (A) e "Sistema Pontos" (B) via helper `rotuloSistema`, no visitante, na escolha de circuito do atleta E nos dois pontos do admin (seletor/lista). Valor interno "A/B" inalterado; só o texto na tela.
- **Monetização — Fatia 4 (jurídico, minutas)** — `TERMOS_ORGANIZADOR.md` (contrato B2B plataforma↔organizador: objeto, planos fixo+por-atleta, split/KYC, papéis LGPD controlador/operador com o recorte do CPF nacional, rescisão/reembolso/portabilidade) + `POLITICA_PRIVACIDADE.md` (dados, finalidades×bases legais, CPF só-hash, pagamento via gateway sem guardar cartão, direitos do titular, menores, retenção, sessão sem PIN). **Minutas — precisam de revisão de advogado**; pendências listadas no fim de cada uma (contato do controlador/DPO, reembolso do fixo, SLA, foro, confirmação dos papéis LGPD). Sem código.
- **Monetização — Fatia 3 (admin define valores + preview)** — card "💳 Cobrança da plataforma" no admin (só super-admin, circuito ≠ BH): liga/desliga + taxa fixa por temporada + por atleta (fixo R$ ou %), com **preview ao vivo** (usa `calcularCobrancaPlataforma`: receita dos atletas → plataforma fixo+variável → organizador bruto/líquido; alerta quando o fixo deixa o organizador no negativo). Backend: ações `LER_COBRANCA_PLATAFORMA` / `DEFINIR_COBRANCA_PLATAFORMA` no admin-action (super-admin, fora da ACOES_ORG → organizador barrado; BH rejeitado; valida entradas). **Só grava config — não cobra nada** (cobrança real = Fatia 5, com gateway). Inerte hoje: não há circuito não-BH, então o card não aparece e o BH não é tocado. **Edge admin-action commitado no fonte, a deployar quando existir o 1º circuito vendido** (padrão do projeto). ⚠️ *Corrigido em 08/09: a v55 acabou sendo outra coisa — a liberação de CORS de 07/09, montada sobre a v54. Quando o financeiro for ao ar, será a v56.*
- **Monetização — Fatia 2 (cálculo)** — função pura `calcularCobrancaPlataforma` (config da cobrança da plataforma + nº de atletas pagos → repartição em centavos: receita dos atletas, fixo, variável por atleta, total da plataforma, bruto e líquido do organizador). Cobrança desligada → plataforma 0, organizador leva tudo (Caso 1/BH). Provada em harness (7 cenários: desligada, só fixo, por atleta fixo/%, combinado, 0 atletas com líquido negativo honesto, arredondamento de %). Inerte — nada a chama ainda; entra na Fatia 3 (preview no admin).
- **Monetização — estratégia fechada + Fatia 1 (fundação inerte)** — documento `PLANO_PAGAMENTOS.md` com o modelo decidido: Caso 1 (circuito próprio) = cobrança única por atleta/temporada; Caso 2 (circuito vendido) = fixo por temporada + variável por atleta via split. Gateway = Asaas (aposta de trabalho); meio = Pix Automático; jurídico em paralelo; **valores parametrizados** (Juliano define depois). Fatia 1 aplicada: colunas de config da cobrança da plataforma em `circuitos` (`cobranca_plataforma_ativa`, `taxa_plataforma_temporada_cent`, `taxa_plataforma_por_atleta_tipo/valor`), todas desligadas por padrão, **sem grant ao anon** (dado financeiro admin-only). Inerte e footprint-zero: BH (Caso 1) intocado; leitura pública intacta.
- **Inscrição avisa em qual temporada vai valer (por fase)** — o formulário/confirmação de inscrição passou a mostrar um aviso honesto conforme a fase do circuito (Cap. 11): pré-temporada → "entra na Temporada X ao aprovar"; temporada em andamento → "fica na fila, admin inclui no próximo par"; último terço (2 últimas rodadas) → "temporada atual fechada; sua inscrição vale para a PRÓXIMA temporada". Sempre lembrando que passa por aprovação do admin. Resolve a confusão do "Temporada 1" fixo (ex.: o BH está na rodada 6/6 → hoje toda inscrição é pra próxima temporada). RPC `circuitos_abertos_vagas()` estendido (aditivo) pra devolver `fase`/`temporada_numero`/`rodadas_por_temporada`/`rodada_atual`; front lê e monta a mensagem. Não trava a inscrição (captura o interesse). Footprint-zero.
- **Documentação consolidada (dedup)** — removidas ~22 duplicatas de `.md` da raiz do repo que já existiam em `docs/` (base canônica sincronizada com o projeto do Claude), sincronizando antes o único que estava mais novo na raiz. Raiz ficou só com `README.md` (do código); `docs/` segue com os 42 canônicos + `docs/backups/`. Fonte única de verdade documental agora é `docs/`. Registrado em `curadoria-log.md`.
- **Roadmap sincronizado + confirmação de que o hardening não é preciso** — verificado que `status` está em `SEASONAL_COLS`, então inscrição/aprovação num circuito não-BH grava `status` só em `circuito_atletas`, nunca na `atletas` global → atleta não-BH normal não vaza pro roster do BH (o `demo-juliano` era semente legada). O follow-up de "endurecer o roster do BH" fica **dispensado**. `ROADMAP_MULTICIRCUITO.md` atualizado: itens 1–4 e 6 marcados FEITOS; o próximo passo é o **Piloto real** (ação do Juliano).
- **Passe de teste "admin não-BH" (prontidão do piloto) + limpeza do circuito demo** — auditoria de escopo do `admin-action`: toda ação que apaga/escreve é filtrada por `circuito_id` (inclusive a virada nos dois ramos) — operar um circuito não-BH não toca o BH. **Achado:** o BH montava o roster pela regra legada `atletas.status='ativo'`, e 2 atletas de teste do circuito `demo-juliano` (Ana/Bruno Demo) vazavam pra dentro do BH (seriam sorteados/virados). **Corrigido** (decisão do Juliano): removido o circuito demo inteiro + os 2 atletas só-demo, preservando a conta do Juliano. Transação FK-segura, backup em `docs/backups/`, BH provado byte-idêntico (hashes de atletas e de competição do BH idênticos antes/depois). Só resta o circuito BH. Follow-up opcional: endurecer a leitura do roster do BH pra não depender de status global.
- **Pendências mais claras — resumo "Precisa de você"** — a tela de Pendências passou a abrir com um painel "🚩 Precisa de você" que lista, em português claro, QUAL é cada pendência (nº + o que é) e O QUE fazer (Validar/Aprovar/Processar/Finalizar/Cobrar), com toque que leva direto até a seção. Cada seção acionável ganhou uma linha de instrução curta. Os dois ajustes (auto-validação, inscrições abertas) saíram do topo — eram confundidos com pendências — e foram pro fim, sob "⚙️ Ajustes do circuito". Só front, sem mudar nenhuma ação existente.
- **Resumo inclui inscrições novas** — o painel "Precisa de você" ganhou a linha "📝 X inscrição(ões) nova(s) → Aprovar", que leva direto pra aba Inscrições (aprovar inscrição é ação do admin, mesmo morando em outra aba). O item do resumo agora aceita ir pra uma aba (setTab) ou rolar até uma âncora.
- **Correção do resumo — só o que é ação AGORA** — o painel "Precisa de você" estava pedindo "processar a rodada" só por existir partida validada, mesmo com a rodada ainda aberta. Corrigido: "Processar rating" só aparece pra rodadas GENUINAMENTE prontas (mesma regra do botão: prazo fechou na rodada ímpar / rodada anterior já processada na par, E todas as partidas resolvidas, E sem trava da anterior). "Resultado incompleto" só entra no resumo quando o prazo do jogo já venceu — dentro do prazo é espera normal pelo atleta, não ação do admin. Lógica verificada por simulação dos casos-chave. Mensagem de "sem pendências" reescrita pra deixar claro que rodadas abaixo podem estar só aguardando o prazo.
- **Experiência do admin — Despachos como tela inicial + contadores nas abas** — (1) o card "📋 Despachos do dia" agora abre e carrega sozinho ao entrar no painel (antes exigia um toque em "Abrir"), então o admin já cai no que precisa de ação, por circuito. (2) A barra de abas do admin ganhou selo com o nº de pendências do circuito selecionado: "Inscr." (inscrições aguardando aprovação), "Pend." (partidas aguardando validação + solicitações de W.O.) e "Msgs" (mensagens de todas as categorias ainda não enviadas no par mensal). "9+" acima de 9. Só-leitura, footprint-zero. (Só front — `atualizar.sh`.)
- **Inscrição — Fatia 6 (janela/vagas)** — a tela de seleção passou a ler os circuitos abertos via RPC seguro `circuitos_abertos_vagas()` (SECURITY DEFINER, só campos públicos + `ativos`, `max_atletas`, `cheio`; BH conta de `atletas`, não-BH de `circuito_atletas`; grant anon/authenticated). Circuito cheio ganha selo "🎟️ Fila de espera — circuito cheio" no card e na confirmação: a inscrição ainda entra (vira fila), porque o teto é aplicado na promoção do backlog, não na inscrição. Footprint-zero: BH não está cheio (14/20), então nada muda no fluxo dele. Com isso a fase "Inscrição por circuito/região" fecha as fatias 1–6.
- **Inscrição — Fatia 4 (Região)** — na confirmação da inscrição, quando há 2+ circuitos abertos, aparece um aviso leve "📍 Jogos presenciais em [cidade/UF]" pedindo que o atleta confirme que joga naquela região (informativo, não bloqueia — o organizador é o gate real). Footprint-zero: com só o BH aberto (1 circuito), o aviso fica dormente e o fluxo é idêntico. Falta a Fatia 6 (janela/vagas).
- **Despachos do Dia — Fatia 3 (lembrete), MVP** — tarefa agendada do Claude ("Despacho do dia", dias de semana 8h) que consulta o banco e envia por notificação o resumo das pendências por circuito (só contagens, sem dado pessoal). Roda com o app do Claude aberto/na próxima abertura — não é servidor 24/7. Push nativo dentro do app fica como evolução futura.
- **Despachos do Dia — Fatia 2 (agir na hora)** — agregador v2 devolve a rodada pronta pra processar por circuito (`processarRodada` + `processarPronta`); card ganhou botão "⚙️ Processar rodada N" com confirmação, escopado no circuito (super-admin foca via trocarCircuito; organizador no dele). Trava de segurança: só aparece se a rodada estiver 100% resolvida (o BH, com rodada incompleta, não mostra botão). Teste ao vivo num circuito B descartável, BH comparado por hash de competição.

## 2026-09-05
- **Despachos do Dia — Fatia 1** — novo edge `despachos-do-dia` (agregador só-leitura; super-admin vê todos os circuitos, organizador só os dele; devolve contagens por circuito, sem dado pessoal) + card "📋 Despachos do dia" no painel admin (mostra por circuito o que precisa de ação e leva à tela certa). Consultas provadas contra o BH (4 a processar, 2 backlog). Verificação ponta-a-ponta ao vivo com o PIN do Juliano.
- **Regulamento v03-12 (Sistema A) publicado como documento** — `docs/REGULAMENTO_TENIS_DE_MESA_v03-12.md`, extraído fielmente do texto do app (com 2ª rodada no **dia 27**). Preenche a lacuna do "regulamento vigente ausente do projeto". Os PDFs antigos (v03-4, v03-11, com dia 25) ficam superados — devem ser removidos/marcados no projeto.
- **Despachos do Dia (proposta)** — mini-spec em `PLANO_DESPACHOS.md` + item no roadmap. Tela única de ações do dia, agregada por papel (super-admin = todos os circuitos; organizador = o dele) + lembrete no celular. Ainda não iniciado.
- **Virada de temporada do BH escopada** — admin-action **v54**. O ramo do BH também passou a arquivar/deletar só por `circuito_id` (resultado idêntico pro BH; nunca toca outro circuito). Resolve a pendência do delete global. Leitura do ranking do BH também escopada.
- **Curador do Projeto** — novo par de agentes (`curador-projeto` + `supervisor-curador`); criados `INDICE_PROJETO.md` e este CHANGELOG.

## 2026-09-04
- **Virada de temporada para circuitos não-BH** — admin-action **v53** + RPC escopado `arquivar_partidas_temporada_circuito`. Provada ao vivo num circuito descartável, BH byte-idêntico.
- **3 guardiões novos** — Regulamento/Motor, Jurídico/LGPD, Confiabilidade/Deploy (+ supervisores). Check geral do projeto com eles (nada crítico; BH intacto).
- **Toggle Público/Privado do circuito** — admin-action **v52** (ação `DEFINIR_PUBLICO`) + card no admin.
- **Cancelar circuito** — admin-action **v51** (ENCERRAR/REATIVAR/EXCLUIR_CIRCUITO) + card no admin; seletor mostra circuitos encerrados.
- **Correções do visitante** — refresh mantém a lista da vitrine e o circuito aberto; vitrine mostra abertos/fechados com cadeado.
- **"Continuar conectado" do atleta** — token de sessão (não guarda PIN); login-atleta **v5**, circuito-dados **v2**.

## Antes de 2026-09-04 (marcos consolidados)
- **Circuito privado + hub do atleta** — coluna `publico`, porteiro `circuito-dados`, RLS de leitura, switcher multi-circuito, login-atleta v4.
- **Papéis (organizador)** — `circuito_organizadores`, enforcement no admin-action (allowlist + escopo por recurso), modo organizador no front.
- **Participar** — atleta existente entra em 2º circuito (login-atleta), com backfill de CPF.
- **CPF como identidade nacional** — `atleta_documento` blindado, HMAC no edge, consentimento `cpf-2026-08-v1`, obrigatório na inscrição.
- **Inscrição por circuito** — gate "Inscreva-se" → circuitos abertos → seleção → formulário do circuito certo.
- **Motor Sistema B** — pontos V=2/D=1, pareamento sorteio/grupos + bye, W.O. automatizado, regulamento vB-01.
- **Plataforma A1/A2** — CRIAR_CIRCUITO + formulário "Novo circuito" + seletor de circuito no admin.
- **Fundação multi-circuito** — Modelo B (`circuitos` + `circuito_atletas`), roteamento por `circuitoId`, dual-write.
