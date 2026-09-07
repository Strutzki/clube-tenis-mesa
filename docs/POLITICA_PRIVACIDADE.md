# Política de Privacidade — Clube do Tênis de Mesa (MINUTA)

> ⚠️ **MINUTA — não é aconselhamento jurídico.** Redigida para ser **revisada e finalizada por um advogado**. Campos entre `[colchetes]` dependem de decisão sua. Estado: 06/09/2026. Versão: [privacidade-AAAA-MM-vN].

Esta política explica como tratamos os dados de quem usa o app do Clube do Tênis de Mesa (atletas, visitantes e organizadores), conforme a **LGPD (Lei 13.709/2018)**.

## 1. Quem trata seus dados (controlador)
- **Controlador:** **Juliano Strutzki** (pessoa física). [Incluir forma de contato oficial.]
- **Encarregado / canal de direitos (DPO):** [definir e-mail/canal para pedidos dos titulares].
- Em circuitos **operados por terceiros** (organizadores), o **organizador é o controlador** dos dados dos atletas daquele circuito e a plataforma atua como **operadora** (ver Termos do Organizador). Para o **hash de CPF** (dedup nacional), a plataforma é controladora.

## 2. Dados que coletamos
- **Cadastro:** nome, telefone (WhatsApp), apelido (opcional), foto (opcional), estilo de jogo (opcional).
- **Identificação:** **CPF** — guardado apenas como **hash** (não guardamos o CPF em texto), para evitar cadastro duplicado e integridade do ranking nacional; **data de nascimento**; para menores de 18, **nome e CPF (hash) do responsável**.
- **Dados de competição:** rating/pontos, vitórias/derrotas, histórico de partidas e posições.
- **Pagamento:** status e identificadores de cobrança (**nunca dados de cartão** — esses ficam no gateway).
- **Técnicos:** dados mínimos de sessão/segurança (ver seção 8).

## 3. Para que usamos e com que base legal
| Finalidade | Base legal (LGPD) |
|---|---|
| Operar a inscrição, o ranking e os jogos | Execução de contrato / legítimo interesse |
| Identidade única nacional (hash de CPF, antifraude de rating) | Legítimo interesse + **consentimento específico** (`cpf-2026-08-v1`) |
| Comunicação do circuito (WhatsApp) | Execução de contrato / legítimo interesse |
| Cobrança e pagamento | Execução de contrato; obrigação legal (fiscal) |
| Menores, via responsável | Consentimento do responsável |

O **consentimento do regulamento** e o **consentimento de CPF** são coletados de forma **específica e versionada**, com data (e IP no caso do CPF).

## 4. CPF — tratamento reforçado
O CPF é **dado protegido**. Guardamos **somente o hash** (com segredo/pepper no servidor), nunca em texto, log, URL ou mensagem de erro. O valor real cifrado só existiria numa fase futura, **apenas com base legal fiscal** e sob controle de acesso estrito. Detalhes técnicos em `ESPEC_CPF_SEGURANCA.md`.

## 5. Pagamento
Pagamentos são processados por **gateway** ([Asaas] e/ou outros). **Não armazenamos dados de cartão** — a tokenização é feita pelo gateway. Para cobrança recorrente, usamos preferencialmente **Pix Automático** (autorização única no banco do titular). O gateway é **operador** do tratamento financeiro.

## 6. Com quem compartilhamos
- **Gateway de pagamento** (processar cobrança/split).
- **Organizador do circuito** em que você se inscreve (para gerir sua participação).
- **Autoridades**, quando exigido por lei.
- **Não vendemos** dados pessoais.

## 7. Por quanto tempo guardamos
- Enquanto você participa de um circuito e pelo tempo necessário às finalidades acima.
- Dados fiscais/financeiros: pelo prazo legal (ex.: 5 anos).
- Ao pedir **exclusão**, anonimizamos seu cadastro (nome, telefone, foto) e removemos você do circuito; **partidas e histórico dos adversários são preservados** de forma que não te identifiquem. O hash de CPF é purgado na exclusão.

## 8. Cookies e armazenamento local
Usamos armazenamento local do navegador apenas para **manter você conectado** (token de sessão — **não guardamos seu PIN**) e lembrar preferências. **Não usamos rastreadores de publicidade.**

## 9. Seus direitos (LGPD)
Você pode pedir: confirmação e acesso, correção, anonimização/eliminação, portabilidade, informação sobre compartilhamentos e revogação de consentimento. Canal: [definir]. O acesso ao próprio CPF é **mascarado** (`***.***.***-NN`), com o valor completo apenas sob reautenticação.

## 10. Menores
Menores de 18 anos participam **por meio de um responsável**, que fornece o consentimento e os próprios dados (nome + CPF em hash). Não direcionamos publicidade a menores.

## 11. Segurança
Adotamos medidas técnicas e organizacionais razoáveis (hash de CPF com segredo no servidor, RLS no banco, sessão sem PIN em disco, backups). Nenhum sistema é 100% imune; em caso de incidente relevante, comunicaremos conforme a lei.

## 12. Alterações
Podemos atualizar esta política; a **versão e a data** ficam registradas no topo. Mudanças relevantes serão comunicadas no app.

---

### Pendências para você/advogado fechar
- Contato oficial do controlador + canal de direitos (DPO).
- Confirmar prazos de retenção fiscal e a redação das bases legais.
- Confirmar o gateway (Asaas) e citar o operador correto.
- Revisar os papéis controlador/operador (plataforma × organizador × CPF nacional).
- Publicar a política num link acessível no app (rodapé/onboarding).
