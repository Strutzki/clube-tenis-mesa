# Roteiro de teste — Circuito Sistema B

> **Regra de ouro:** use atletas **totalmente novos** (nomes/telefones que não existem no BH). Identidade e rating são globais — nunca reaproveite os 15 atletas do BH.
> Você **não precisa tocar no BH** em nenhum passo. Faça tudo com seu PIN de admin.

---

## 1. Criar o circuito B de teste
- [ ] Painel do admin → **Novo circuito**
- [ ] Sistema: **B** · Pareamento: **sorteio** (testar "grupos" depois) · slug: `teste-b` · mín. 10 atletas · 6 rodadas
- [ ] Confirmar que criou com **"sistema B · sorteio"**

## 2. Selecionar o circuito e conferir isolamento
- [ ] No seletor, trocar para `teste-b`
- [ ] Abas (atletas, partidas, mensagens, financeiro) aparecem **vazias** — nada do BH vaza
- [ ] **Recarregar a página** → continua no `teste-b` (não volta pro BH)

## 3. Inscrever atletas novos
- [ ] Inscrever **5 a 8 atletas novos** (deixar nº **ímpar**, ex.: 5, pra testar o bye)
- [ ] Aprovar as inscrições
- [ ] Confirmar que entram com **0 pontos** e sem rating relevante

## 4. Iniciar etapa e conferir o pareamento
- [ ] Iniciar a etapa
- [ ] R1 e R2 geradas; **ninguém repete adversário**
- [ ] Com nº ímpar, **um atleta fica de fora** (bye) — e o bye da R1 é **diferente** do da R2

## 5. Lançar placares e processar
- [ ] Lançar placares fictícios e processar a rodada
- [ ] Vencedor **+2**, perdedor **+1** (nunca mexe em rating)
- [ ] Atleta do **bye ganha +1**
- [ ] Ranking ordena **por pontos**; num empate, conferir o desempate:
      **menos W.O. → confronto direto → % de aproveitamento → saldo de sets**

## 6. Avançar rodada
- [ ] Gerar o próximo par (Avançar Rodada)
- [ ] O **bye rotaciona** (não cai sempre no mesmo)
- [ ] Segue **sem repetir** confrontos

## 7. Excluir atleta (escopo)
- [ ] Excluir um atleta **sem partidas** no circuito B
- [ ] A mensagem deve indicar escopo **"circuito"** (a identidade global fica intacta)

---

## O que NÃO testar agora
- **W.O. no Sistema B.** Se tentar aplicar um W.O., aparece *"W.O. no Sistema B ainda não habilitado (em breve)"*.
  Isso é **esperado** (é a Fatia 5, ainda pendente) — **não é bug**.

## Regressão do BH (rápido)
- [ ] Voltar o seletor pro **BH**
- [ ] Conferir no olho que **ranking e ratings** estão como sempre (não precisa processar nada real no BH)

## Limpeza
- [ ] No fim, **excluir o circuito de teste** pra não deixar resíduo (opcional)

---
*Motor B no ar: Fatias 1–4 (servidor, admin-action v44) + Fatia 6 (ranking do front). Pendente: Fatia 5 (W.O. no B) e polimento cosmético de rating.*
