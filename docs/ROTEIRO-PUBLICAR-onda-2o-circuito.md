# Publicar a onda do 2º circuito — 7 passos

> **Estado em 03/10/2026:** 18 seções, 1791 asserções, 0 falhas, árvore limpa em `7f43ddc`.
> 37 commits locais sem publicar (todos da mesma onda, de 27/09 em diante).
> Produção: 15 atletas · 15 vínculos · 34 partidas · 12 pagamentos · 1 circuito · 0 linhas
> com texto de saúde.

**Por que sete, e por que nesta ordem.** Duas funções passaram a **devolver mais**, então
vão primeiro — o app depende disso. Uma passou a **exigir mais**, então o app vai antes
dela. E a migração tira um acesso que o app **no ar hoje** ainda usa, então ela é a última
de todas. Trocar a ordem derruba o app para todo mundo.

## 0 — antes de começar

```
npm run teste && npm run build
```
Tem de voltar `1791 asserções`, `0 falharam`, e `✓ built in`.
**Se falhar, não comece.** Nada aqui é urgente o bastante para publicar com a bateria vermelha.

## 1 a 4 — o motor, uma função por vez

```
npm run motor:publicar circuito-dados        && npm run motor:conferir
npm run motor:publicar anonimizar-atleta     && npm run motor:conferir
npm run motor:publicar admin-action          && npm run motor:conferir
npm run motor:publicar athlete-action        && npm run motor:conferir
```

Cada um tem de terminar em **`0 divergencias`**. Divergência significa que o `verify_jwt`
ficou diferente do config — e isso **para o app inteiro para todo mundo**. PARE e chame.

## ⚠️ 4 e 5 seguidos, sem intervalo

Entre os dois existe uma janela em que o motor **exige** algo que o app ainda não manda.

## 5 — o app

```
git push origin main
```
Sobe pela Vercel ~1 minuto depois. São 1021 linhas no `App.jsx`.

**Conferência pela tela:** entre como admin → Pendências → abra uma solicitação de W.O.
O texto da justificativa tem de aparecer **depois** de um instante escrito
*"Carregando a justificativa…"*. Se aparecer na hora, o app no ar ainda é o antigo —
espere e recarregue. **Não passe para o 7 sem ver o "Carregando".**

## 6 — a sexta função

```
npm run motor:publicar backup-clube-tenis-mesa && npm run motor:conferir
```
Passa a copiar o modelo multi-circuito inteiro, a NÃO copiar dado de saúde, e a apagar
backup com mais de 6 meses (a retenção aprovada em 29/09).

## 7 — a migração (SQL Editor do Supabase)

Arquivo: `docs/migracoes/2026-10-01-fechar-acesso-dado-saude.sql`

```sql
revoke select (justificativa)   on solicitacoes_wo from anon, authenticated;
revoke select (comprovante_url) on solicitacoes_wo from anon, authenticated;
```
Conferência: os quatro `has_column_privilege` têm de dar `false · false · true · true`,
e a leitura que o app faz tem de devolver as 5 linhas (as duas consultas estão no arquivo).

**Desfazer, se precisar:** os dois `grant` equivalentes. Reversível na hora.

## Reversão

| Passo | Como voltar |
|---|---|
| 1–4 e 6 | Os fontes **do ar** estão em `docs/backups/motor-no-ar-2026-09-29/` — as cinco funções, versão no nome. **`git checkout` NÃO serve** para elas: o repositório tem a versão nova, não a do ar. |
| 5 (app) | Promover o deploy anterior na Vercel. |
| 7 | Os dois `grant`. |

## O que esta publicação NÃO resolve — e não bloqueia

Registrado, com data, para a próxima onda:

- a frase **"cifrada"** no consentimento do CPF (é resumo irreversível). Corrigir exige
  versão nova do regulamento e as 15 pessoas aceitarem de novo — regra 7;
- a palavra **"sempre"** no Cap. 03 sem portão com poder: ou ganha mecanismo, ou o texto
  enfraquece. O limite é MEDIDO (6.100 temporadas, `docs/medicoes/2026-10-01-*`), não
  provado por mecanismo;
- a promessa de retenção de **2 anos** sem nenhuma execução;
- `#7d9188` com contraste 4,41 (mínimo AA é 4,5) em ~200 lugares — anterior a esta onda;
- **15 dos 16 mandatos** em `.claude/agents/` dizem "quatro Edge Functions" quando são seis;
- um erro de lint pré-existente: `useMemo` dentro de condição (`App.jsx`, hook condicional);
- as **10 fotos órfãs** do balde — precisa da chave de serviço, não dá para conferir do
  terminal do agente.

---

**Depois do passo 7, a onda está no ar.** O próximo movimento é criar o segundo circuito e
usar: é o único jeito de descobrir o que a auditoria não viu.
