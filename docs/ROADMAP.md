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

- **0.1 — A bateria existe, mas só cobre o motor.** Desde 07/09/2026 há 82
  asserções (`npm run teste`) rodando o `admin-action` de verdade, ligadas ao
  `atualizar.sh`. Falta cobrir: o front `src/App.jsx`, o `athlete-action`, o
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
