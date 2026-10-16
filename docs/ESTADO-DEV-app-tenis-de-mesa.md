# Estado do desenvolvimento — App do Clube do Tênis de Mesa (multi-circuito)

**Atualizado: 05/set/2026** (conteúdo), com correções pontuais do Curador em 19/09/2026, **29/09/2026 (tarde)**, uma passagem do **Supervisor de Curadoria em 29/09/2026 (noite), commit `60ccc86`**, e **correções do Curador em 12/10/2026 (árvore `0cdb524`)** — veja as marcas de data abaixo; o resto do documento **não** foi revisado nessas datas e continua com o retrato de 05/set.

> ⚠️ **12/10/2026 — o que mudou e você precisa saber antes de ler o resto:** as
> versões no ar estavam **cinco deploys atrasadas** (a onda de 03/10 subiu e não
> chegou a documento nenhum); o BH roda **v03-13**, não v03-12; o **`vB-01` está
> congelado** (3 aceites reais); existe um **2º circuito com atletas reais**
> (`bh2`, 1ª etapa 01/11/2026); e há **um defeito ativo em produção** no calendário
> (ROADMAP 1.3). A bateria está em **1930 asserções / 18 seções**, não 1357 / 13. Documento de estado escrito pela sessão de desenvolvimento (pasta do código). **Fonte de verdade continua sendo o app em produção + Supabase**, não este doc. Substitui, em atualidade, o `RETOMADA-app-clube-tenis-mesa.md` de julho (que está superado).

## Regra vigente
- Regulamento **A (rating/CBTM): v03-13** no BH — 1ª rodada até dia **15**, 2ª rodada
  até dia **27**. ⛔ **CORRIGIDO EM 12/10/2026.** Esta linha dizia **v03-12** e que a
  v03-13 *"só passa a valer no BH quando carimbada na próxima virada"*. **O carimbo
  aconteceu:** conferido no banco, `circuitos.bh.regulamento_versao = v03-13`, com
  **4 aceites** em `circuito_atletas` (e o histórico `v03-3` ×8, `v03-12` ×1,
  `v03-11` ×1, `v03-5` ×1). ⇒ a **v03-13 está congelada** pela regra 7.
  *(E note: o BH **encerrou** — ver o topo do `CLAUDE.md`.)*
- Regulamento **B (pontos fixos): vB-01** — **desde 29/09/2026 ele tem documento
  canônico próprio**, `docs/REGULAMENTO_vB-01.md`, **gerado** do texto que o app exibe
  por `scripts/gerar-regulamento.mjs` (não edite à mão; a bateria recusa divergência).
  ⛔ **E DESDE 12/10/2026 ELE ESTÁ CONGELADO: o `vB-01` tem 3 ACEITES REAIS** (os
  atletas do `bh2`), conferidos no banco. A regra 7 passou a morder: correção de
  conteúdo vai em **`vB-02`**, com aviso prévio e re-aceite. ⚠️ **A armadilha é o
  gerador:** como o `.md` é gerado **da tela**, "só melhorar o texto da tela" e
  regenerar **muda retroativamente o que 3 recibos provam**. Ver ROADMAP **1.2**.
  Até essa data o texto que o atleta aceita morava só dentro do `App.jsx`.
  **Zero aceites gravados** no banco até hoje — é o regulamento do 2º circuito, que
  ainda não existe. O `vA-nc-01` (rating, circuitos novos) **continua sem `.md`
  próprio** — ver ROADMAP 0.10.3.
- BH em produção **nunca é prejudicado**; toda mudança é comparada byte-a-byte antes de subir.

## Arquitetura (Modelo B — multi-circuito)
- Identidade + **rating global**: tabela `atletas`. Sazonal **por circuito**: `circuito_atletas`. Config: `circuitos` (o BH usa `configuracao`).
- Supabase: projeto `clube-tenis-mesa`, id `eultwfzzlgcmcikobmmy`, schema `public`.
- Front: `src/App.jsx` (SPA único, ~9 mil linhas). Deploy: `atualizar.sh` → Vercel.
- Backend (Edge Functions) no ar — **RECONFERIDO AO VIVO EM 12/10/2026** (`npm run motor:listar`, projeto `eultwfzzlgcmcikobmmy`): `admin-action` **v65**, `athlete-action` **v23**, `login-atleta` **v11**, `comprovante-url` **v3**, `circuito-dados` **v5**, `despachos-do-dia` v6, `anonimizar-atleta` **v3**, `resetar-pin-atleta` v2, `backup-clube-tenis-mesa` **v7**. *(Histórico da correção: em 19/09 o Curador achou esta linha seis deploys atrasada; em 27/09 ela estava dois atrás; em 29/09, três; **em 12/10, cinco funções estavam atrasadas de uma vez**, porque a publicação de 03/10 não chegou a documento nenhum além da mensagem de commit. O número apodrece — rode `npm run motor:listar` em vez de citar daqui.)*
  ⚠️ **O fonte continua À FRENTE do ar, e em 12/10/2026 são DOIS pontos distintos:**
  (1) **`admin-action`** — o conserto de `meses_temporada` (`9da18e4`, 03/10) **nunca
  foi publicado**, e isso é um **defeito ativo**: a tela que escolhe os meses está no
  ar e o motor v65 **ignora o campo**, respondendo sucesso. Quem investigar bug de
  calendário está olhando a **v65**, não o arquivo. Ver `CLAUDE.md` (Armadilhas) e
  ROADMAP **1.3**; (2) os **6 arquivos modificados** da onda da inscrição (preço por
  circuito + versão do consentimento), pendentes de subir — ver o **rascunho** no
  `docs/CHANGELOG.md`.
  Também no projeto, de OUTROS produtos: `torneios-api` v8 e `backup-clube-beach-tennis` v2 — nunca publicar nem apagar daqui. **Novo em 29/09/2026:** apareceu uma função **`arte` v1** no mesmo projeto, criada às 11h52 (BRT), **sem pasta correspondente neste repositório e sem registro em documento nenhum** — o Curador a sinaliza sem tocar nela; presumivelmente de outro produto. Confirmar dono antes de qualquer `--prune`.
  ⚠️ **`circuito-dados` e `despachos-do-dia` continuam com `entrypoint_path` apontando para uma pasta de rascunho do projeto de TORNEIOS** (reconferido ao vivo em 29/09/2026 — achado aberto desde 19/09): sem rollback confiável para essas duas.
  ⚠️ **Esta linha envelhece a cada deploy.** Não confie nela para investigar bug de motor: rode `npm run motor:listar`. A fonte de verdade das versões é `docs/curadoria-indice-app-tenis-de-mesa.md` (seção "Backend"), e o que está pendente de subir está em `docs/CHANGELOG.md`.

## O que JÁ está no ar (desde julho até 05/set)
- Fundação multi-circuito (Modelo B) + roteamento por circuito.
- Criar circuito + formulário "Novo circuito" + seletor de circuito no admin.
- **Motor do Sistema B** (pontos V=2/D=1, pareamento sorteio/grupos + bye rotativo, W.O. automatizado) — validado em 400 temporadas simuladas. ⚠️ **Correção de 29/09/2026 (tarde):** essa simulação de 05/set era um harness, não a bateria. A bateria só passou a **rodar o pareamento do Sistema B** em 29/09/2026 (`testes/segundo-circuito.mjs`), e foi ela que mediu o que a simulação não tinha reportado: com **exatamente 8 atletas no modo sorteio** o motor **repetia um confronto em 13 de cada 120 temporadas** — e 8 é o **mínimo** de atletas, ou seja, a configuração mais provável do 2º circuito.
  ✅ **RESOLVIDO na mesma noite (29/09/2026), por decisão do Juliano** — *"não pode ter repetição de atleta"*. Entrou o **rodízio pelo método do círculo** (`escalaCirculo`), que monta a temporada inteira de uma vez: **8/sorteio foi de 13/120 para 0/120**. ⛔ **No fonte, não no ar.** Duas ressalvas que não se pode perder: (1) o **modo grupos** fica de propósito no pareamento dinâmico, então **nele a garantia é estatística, não estrutural** — medido com o método certo (vencedor sorteado e rodadas processadas), **198 em 2000 temporadas, 9,9%**, com 8 atletas e elenco completo; (2) o número anterior de 0/120 no grupos **estava medido com o método errado** — o harness fazia o atleta 1 vencer sempre e nunca processava a rodada, então a tabela de pontos não divergia e o modo grupos, que pareia **por posição na tabela**, nunca era exercitado. Essa é a REGRA NOVA de 29/09 em `GOVERNANCA_AGENTES.md`: *medição de regra que depende de estado acumulado só vale se o estado acumular.* Não leia "validado em 400 temporadas" como "pareia sem repetir" — e não leia "0 em 120" sem perguntar o que se moveu durante a medição.
- ⚠️ **Muito mais que quatro defeitos — e "nada subiu" FICOU FALSO EM 03/10/2026, quando subiu tudo** (7 passos, ver `docs/CHANGELOG.md`, entrada de 03/10 escrita retroativamente em 12/10). A bateria, que esta linha diz ter ido "de 1149 para 1357", está hoje em **1930**. *(Corrigido pelo Supervisor de Curadoria em 29/09/2026, noite — esta linha dizia "quatro"; e pelo Curador em 12/10/2026, quanto ao "nada subiu" e à contagem.)* A auditoria multi-circuito achou quatro; as **quatro rodadas de guardiões** que vieram depois, na mesma noite, acharam **dois NO-GO** (o Cap. 03 prometendo o que o modo grupos não cumpre; a exclusão de dados **quebrando em produção por NOT NULL depois de já ter apagado o CPF, as fotos e as sessões**) e uma **condição bloqueante** (dado de saúde de 5 pessoas reais legível pelo visitante anônimo, por dois caminhos). A bateria foi de **1149 para 1357** asserções. Ver `docs/CHANGELOG.md` (entradas de 29/09 tarde **e noite**), `docs/GOVERNANCA_AGENTES.md` e ROADMAP 0.10.32–0.10.35.
  ⛔ **A lista de "o que JÁ está no ar" acima descreve o multi-circuito COM todos esses defeitos dentro** — e agora são **cinco** peças pendentes de subir, nesta ordem confirmada por dois guardiões: **1º `circuito-dados` · 2º `anonimizar-atleta` · 3º `admin-action` · 4º `athlete-action` · 5º APP**, com os passos 4 e 5 seguidos, sem intervalo.
- Inscrição por circuito (o atleta escolhe o circuito aberto).
- **CPF como identidade nacional** — blindado (só hash), consentimento LGPD específico.
- **Participar** — atleta existente entra num 2º circuito sem duplicar identidade/rating.
- **Papéis** — organizador de circuito (login próprio, escopo travado no circuito dele).
- **Circuito privado + hub do atleta** — visibilidade controlada + troca entre circuitos.
- **Gerir circuito** — encerrar/reativar/excluir; alternar público/privado.
- **Virada de temporada para qualquer circuito** (escopada por circuito; BH intocado) — provada ao vivo.
- "Continuar conectado" do atleta (token de sessão, sem guardar PIN).

## Governança
- **8 duplas de agentes** (guardião + supervisor): Segurança, Atleta, Admin, Marca, Regulamento/Motor, Jurídico/LGPD, Confiabilidade/Deploy, Curador. Detalhe em `GOVERNANCA_AGENTES.md`.

## ⚠️ Divergência a confirmar com o Juliano (não resolver sozinho)
O índice de curadoria (`docs/curadoria-indice-app-tenis-de-mesa.md`) diz "**não anunciar o Sistema B nem a plataforma como prontos**" — *referência corrigida em 19/09/2026: este texto citava um `INDICE.md` que foi **removido** em 06/09/2026.* Na prática, o motor B e boa parte do multi-circuito **já estão no ar** — mas **nenhum 2º circuito real rodou ainda** (o piloto é o próximo passo). Ou seja: pronto tecnicamente, ainda não validado em campo. **O Juliano decide o que pode ser comunicado como pronto.**

## Próximos passos (roadmap)
1. **Piloto real** — abrir um 2º circuito de verdade e rodar uma temporada curta.
2. **Inscrição por região + vagas**.
3. **Despachos do Dia** — tela única de ações do dia por papel (ver `PLANO_DESPACHOS.md`).
4. Decisão de arquitetura: **rating nacional × rating por circuito**.

## Pendências anotadas
- Jurídico: confirmar nome legal do controlador + canal de direitos; política de privacidade formal; backfill de CPF dos atuais.
- ⚠️ **Acrescentado em 29/09/2026 (noite):** fechar a leitura pública do dado de saúde (`partidas.motivo_rejeicao` e `solicitacoes_wo`) — pede **migração**, e é a armadilha que já derrubou o app; **sanear as 5 linhas de produção** que já carregam o texto; **apagar as 10 fotos órfãs** do bucket público (pede chave de serviço, autorizado por ele); o freio de tentativas de PIN **sem escopo por IP**; o `APLICAR_WO` que **não valida** se o faltoso é da partida; e o organizador **não-super** no BH, que levaria 403. Detalhe em `docs/ROADMAP.md`, "Decisões ainda em aberto".
- Técnico: dropar/restringir o RPC global `arquivar_partidas_temporada` (virou código morto).
- Limpeza: backups datados de `App.jsx` no repositório do código.
