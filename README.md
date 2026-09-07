# Clube do Tênis de Mesa — plataforma de circuitos

App de circuito de tênis de mesa: os atletas jogam ao longo do mês, mandam o
placar pelo celular, e o app calcula rating, ranking e a rodada seguinte. Está
no ar em **clubedotenisdemesabh.com.br**, com o circuito de Belo Horizonte.

Este arquivo é o **mapa do que existe**. Como mexer sem quebrar está no
`CLAUDE.md`; o que fazer a seguir está em `docs/`.

## Como rodar e como publicar

```bash
npm install          # só na primeira vez
npm run dev          # abre o app na sua máquina, em localhost
npm run teste        # a bateria: 82 asserções sobre o motor de verdade
npm run build        # verifica se o app compila
npm run lint         # confere o estilo do código
```

Publicar tem **duas metades independentes**:

```bash
./atualizar.sh                            # o app: build + confirmação + push -> Vercel
npm run motor:listar                      # que versão de cada função está no ar
npm run motor:publicar -- admin-action    # o motor: uma função por vez
```

O `atualizar.sh` não publica se a bateria falhar nem se o app não compilar, e
lista o que vai subir esperando você digitar `S`.

## As três camadas

**1. O app (`src/App.jsx`)** — arquivo único, ~9.700 linhas, React sobre Vite.
Não há divisão em módulos e não há roteador: as telas são estados dentro do
mesmo componente. `index.html` faz um desvio antes do app carregar — quem entra
pelo endereço `.vercel.app` é mandado para o domínio oficial, porque o sufixo
público quebra a sincronização de biometria no Android.

**2. O motor (`supabase/functions/`)** — 9 Edge Functions em Deno/TypeScript.
**Toda regra de competição decide aqui**, no servidor. O app só mostra o
resultado. É o que impede um atleta de mexer no próprio rating pelo navegador.

**3. O banco (Supabase, projeto `eultwfzzlgcmcikobmmy`)** — Postgres com RLS
ligado em todas as tabelas. **Atenção: o app de torneios (`torneios-api`) mora
no mesmo projeto.** São dois produtos dividindo um banco.

> **Termo:** *RLS* (segurança em nível de linha) é a trava do Postgres que decide
> quem enxerga cada linha. Ligada em tudo aqui; o motor passa por cima dela
> usando a chave de serviço, que só existe no servidor.

## As Edge Functions

| Função | No ar | O que faz |
|---|---|---|
| `admin-action` | v54 | **O motor.** 44 ações do organizador — ver tabela abaixo. |
| `athlete-action` | v17 | O que o atleta faz: `ENVIAR_PLACAR`, `INSCREVER`, `RENOVAR`, `ATUALIZAR_PERFIL`, `SOLICITAR_WO`, `CANCELAR_WO`, `SALVAR_BIO_CRED`, `SOLICITAR_EXCLUSAO`. |
| `login-atleta` | v6 | Entrada e sessão: `LOGIN`, `LOGIN_ORGANIZADOR`, `DEFINIR_PIN`, `SESSAO`, `LOGOUT_SESSAO`, `PARTICIPAR` (entrar num 2º circuito), `PRECO`. |
| `circuito-dados` | v2 | Porteiro de leitura de um circuito. Aberto serve a qualquer um; privado exige provar vínculo (PIN ou token). Devolve só colunas de exibição. |
| `despachos-do-dia` | v4 | Tela única de "o que fazer hoje" por papel. |
| `comprovante-url` | v1 | Link temporário para o comprovante de pagamento. |
| `anonimizar-atleta` | v1 | Direito de exclusão (LGPD). |
| `resetar-pin-atleta` | v1 | Reset do PIN do atleta. |
| `backup-clube-tenis-mesa` | v5 | Backup dos dados. |

**Confira sempre com `npm run motor:listar`** — a coluna "no ar" acima é de
07/09/2026, e o código no repositório pode estar à frente do que está rodando.

### As ações do `admin-action`

Todas chegam num `switch (acao)` e são escopadas por `circuito_id`.

- **Competição:** `INICIAR_ETAPA`, `AVANCAR_RODADA`, `PROCESSAR_RODADA`,
  `NOVA_TEMPORADA`, `ABRIR_PROXIMA_TEMPORADA`, `CANCELAR_PROXIMA`,
  `VALIDATE_RESULT`, `ADMIN_IMPUTAR_RESULTADO`, `DESFAZER_VALIDACAO`
- **W.O.:** `APLICAR_WO`, `RESPONDER_WO`, `MARCAR_WO_NOTIFICADO`
- **Atletas:** `INSCRICAO_VALIDAR`, `EDITAR_ATLETA`, `ARQUIVAR_ATLETA`,
  `EXCLUIR_ATLETA`, `INCLUIR_NO_CIRCUITO`
- **Circuito:** `CRIAR_CIRCUITO`, `RECUSAR_CIRCUITO`, `ENCERRAR_CIRCUITO`,
  `REATIVAR_CIRCUITO`, `EXCLUIR_CIRCUITO`, `DEFINIR_CONFIG_CIRCUITO`,
  `DEFINIR_PUBLICO`, `DEFINIR_INSCRICOES_ABERTAS`, `DEFINIR_AUTO_VALIDAR`
  (`DEFINIR_RODADAS` ainda existe, mas hoje só devolve erro: as rodadas estão
  fixas em 6 por temporada, Cap. 13 do regulamento)
- **Dinheiro:** `DEFINIR_FINANCEIRO`, `REGISTRAR_PAGAMENTO`, `EDITAR_PAGAMENTO`,
  `ESTORNAR_PAGAMENTO`, `LISTAR_PAGAMENTOS`, `DEFINIR_DESCONTO_ATLETA`,
  `DEFINIR_COBRANCA_PLATAFORMA`, `LER_COBRANCA_PLATAFORMA`,
  `DEFINIR_ORG_VE_FINANCEIRO`
- **Papéis e comunicação:** `NOMEAR_ORGANIZADOR`, `REMOVER_ORGANIZADOR`,
  `LISTAR_ORGANIZADORES`, `LISTAR_TELEFONES`, `LISTAR_MENSAGENS`,
  `REGISTRAR_MENSAGEM_ENVIADA`, `MARCAR_RESULTADO_COMUNICADO`,
  `SALVAR_ADMIN_BIO_CRED`

## O banco

**A ideia central:** a **identidade e o rating** do atleta são globais; o que é
**da temporada** é por circuito.

| Tabela | Guarda |
|---|---|
| `atletas` | A pessoa: nome, telefone (chave única), PIN, rating, foto, histórico. **Global**, compartilhada entre circuitos. |
| `circuitos` | Um circuito: slug, cidade, sistema (A ou B), fase, temporada, valores, se é público, se as inscrições estão abertas. |
| `circuito_atletas` | A participação de um atleta num circuito nesta temporada: status, chave, vitórias, saldo, pagamento, aceite do regulamento. |
| `configuracao` | A config **do BH**, do tempo em que só existia um circuito. Linha única (`id=1`). É a origem de quase todo `if (circuitoId === bh)` no motor. |
| `partidas` | Os jogos: placar de cada lado, quem enviou, validação, prazo, W.O., e o rating no momento (`diferenca_rating_momento`, `favorito_id`) para o cálculo ser auditável depois. |
| `partidas_historico` | Jogos arquivados na virada de temporada. **Não tem chave primária.** |
| `chaves` | Os grupos/chaves e a rodada atual. |
| `solicitacoes_wo` | Pedidos de W.O. com justificativa e comprovante. |
| `pagamentos` | Pagamentos recebidos pelo organizador (Pix, comprovante). |
| `cobrancas` | Cobrança automática pela plataforma via **Asaas** (`asaas_id`, `split_json`). Estrutura pronta, ainda sem uso. |
| `circuito_cobranca` | Quanto a plataforma cobra de cada circuito. **Tabela privada**: nasceu de um incidente, ver `CLAUDE.md`. |
| `circuito_organizadores` | Quem organiza qual circuito. |
| `atleta_documento` | **CPF, blindado.** Guarda `cpf_hash` e `cpf_cifrado` — nunca o número em claro. Também data de nascimento e responsável, para menores. |
| `atleta_sessao` | "Continuar conectado": guarda o hash do token, nunca o PIN. |
| `mensagens_enviadas` | Registro do que já foi mandado para cada atleta (evita mandar duas vezes). |
| `tentativas_login_admin`, `tentativas_busca_telefone`, `tentativas_busca_cpf` | Freio contra tentativa e erro. **Só crescem** — nada as limpa hoje. |
| `instagram_config`, `instagram_artes`, `instagram_publicacoes` | Publicação automática no Instagram pela API da Meta. **Não aparece em nenhum documento do projeto** — ver "Pontas soltas". |

### Funções do banco (RPC)

`buscar_atleta_por_telefone`, `circuitos_abertos_vagas`, `dedup_por_cpf_hash`,
`get_cpf_pepper`, `preco_temporada_atleta`,
`arquivar_partidas_temporada_circuito`.

A `preco_temporada_atleta` **não é mais chamada pelo app**: expunha quanto cada
atleta paga para quem soubesse o id. Hoje a consulta passa pela ação `PRECO` do
`login-atleta`, autenticada por sessão.

## Os dois sistemas de competição

O `sistema` trava na criação do circuito e não muda depois.

- **A — rating/CBTM** (o do BH, regulamento **v03-12**). Rating permanente,
  ganho e perda pela tabela da CBTM conforme a diferença entre favorito e
  azarão. W.O. a favor rende **+8** ao beneficiado e o culposo custa **-15** ao
  faltoso — `admin-action/index.ts:805` e `:815`, no rating e no saldo da
  temporada ao mesmo tempo.
- **B — pontos fixos** (regulamento **vB-01**). Vitória vale 2, derrota 1, sem
  rating. Pareamento por sorteio ou por grupos, com bye rotativo.

`getSistema()` decide qual é, e é **fail-closed**: se a consulta falhar, ele
lança erro em vez de chutar "A" — para nunca gravar rating num circuito que não
tem rating.

## Onde está o resto

| Quero saber | Leia |
|---|---|
| Como mexer sem quebrar | `CLAUDE.md` |
| Como a bateria de testes funciona | `testes/README.md` |
| O retrato atual do desenvolvimento | `docs/ESTADO-DEV-app-tenis-de-mesa.md` |
| Quem revisa o quê antes de publicar, e os vereditos passados | `docs/GOVERNANCA_AGENTES.md` |
| O que já foi ao ar, com a versão da função | `docs/CHANGELOG.md` |
| O que falta, e o que foi decidido não fazer | `docs/ROADMAP.md` |
| As regras da competição | `docs/REGULAMENTO_TENIS_DE_MESA_v03-12.md`, `docs/REGULAMENTO_SISTEMA_B.md` |

## Pontas soltas conhecidas

Levantadas ao mapear o banco em 07/09/2026, sem decisão tomada:

- **Instagram sem dono documentado.** Três tabelas (`instagram_config` com
  credenciais da Meta, `instagram_artes`, `instagram_publicacoes` com 42
  publicações registradas) existem e funcionam, mas não são citadas em nenhum
  plano, roadmap ou changelog. O token da Meta expira a cada ~60 dias e nada
  avisa quando isso vai acontecer.
- **Cobrança pela plataforma pela metade.** As tabelas `cobrancas` e
  `circuito_cobranca` e o campo `asaas_wallet_id` já existem; a integração de
  pagamento não. Ver `docs/PLANO_PAGAMENTOS.md`.
- **Tabelas de tentativa só crescem.** `tentativas_login_admin` já passou de mil
  linhas. Nada apaga registro velho.
- **`partidas_historico` sem chave primária** — nada impede a mesma partida
  arquivada duas vezes.
- **A bateria só cobre o motor.** `npm run teste` protege as regras da
  competição no `admin-action` (82 asserções, ver `testes/README.md`). O front,
  o `athlete-action` e o `login-atleta` seguem sem teste.
