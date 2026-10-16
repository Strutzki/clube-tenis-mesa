import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PIN = Deno.env.get("ADMIN_PIN")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// --- Multi-circuito (Fase 4A) --------------------------------------------
// circuito_id do circuito de producao (BH). Memoizado por instancia.
// Enquanto o app nao envia payload.circuitoId, tudo resolve para BH -> comportamento identico.
let _bhId: string | null = null;
async function bhId(): Promise<string> {
  if (_bhId) return _bhId;
  const { data, error } = await supabase.from("circuitos").select("id").eq("slug", "bh").single();
  if (error) throw error;
  _bhId = data!.id as string;
  return _bhId;
}

// Resolve o sistema do circuito ('A'/'B') SEM consultar coluna inexistente: o BH le a
// config de `configuracao` (que NAO tem `sistema`), entao resolvemos por codigo. Memoizado.
// Fail-safe: qualquer duvida -> 'A' (comportamento do BH). `sistema`/`pareamento` so em `circuitos`.
const _sistemaCache = new Map<string, string>();
async function getSistema(circuitoId: string): Promise<string> {
  const bh = await bhId();
  if (circuitoId === bh) return "A";
  if (_sistemaCache.has(circuitoId)) return _sistemaCache.get(circuitoId)!;
  const { data, error } = await supabase.from("circuitos").select("sistema").eq("id", circuitoId).single();
  if (error) throw error; // fail-closed: NUNCA assumir 'A' num circuito nao-BH por falha transitoria (evitaria gravar rating no B)
  const s = (data?.sistema === "B") ? "B" : "A";
  _sistemaCache.set(circuitoId, s);
  return s;
}

// --- Dual-write (Fase 4B) -------------------------------------------------
// O servidor continua gravando o estado sazonal em `atletas` (o BH depende disso)
// e a config em `configuracao`. Em PARALELO, espelha em `circuito_atletas`/`circuitos`.
// O espelho e' BEST-EFFORT: se falhar, apenas loga -> nunca quebra a operacao do BH.
const SEASONAL_COLS = new Set([
  "status","motivo_reprovacao","pendente_circuito","ultima_recusa_circuito_em","chave",
  "saldo_temp","vitorias","derrotas","vitorias_total","derrotas_total","wo_culposos_temporada",
  "aceite_regulamento","data_aceite_regulamento","versao_regulamento",
  "pagamento_confirmado","pagamento_proxima_confirmado","desconto_pct","isento",
  "quer_renovar","renovacao_em","historico","posicao_historico",
]);
function seasonalOnly(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k in obj) if (SEASONAL_COLS.has(k)) out[k] = obj[k];
  return out;
}
// Espelha campos sazonais de um atleta na sua participacao no circuito (upsert por (circuito_id, atleta_id)).
// `ehEspelho`: esta gravacao e o ESPELHO de outra que ja aconteceu, ou e a UNICA?
// No BH, `atletas` e a fonte e isto aqui e copia -- se a copia falhar, engolir o
// erro e o certo: a operacao do BH nao pode quebrar por causa do espelho.
// Em circuito NAO-BH nao ha fonte do outro lado: `status`, `pendente_circuito`,
// `chave` e afins sao colunas SAZONAIS, entao o bloco de identidade sai vazio e
// ISTO E A UNICA ESCRITA. Engolir o erro ali fazia a acao responder `sucesso: true`
// com NADA gravado -- e a tela se autocorrigia no `loadFromSupabase()` seguinte,
// mostrando o atleta como antes. O admin via "sucesso" e o oposto do que pediu.
// E CLASSE, NAO CASO: ARQUIVAR, DESARQUIVAR, INCLUIR_NO_CIRCUITO, RECUSAR_CIRCUITO
// e DEFINIR_DESCONTO_ATLETA passam todas por aqui.
// (ROADMAP 0.6.18, achado pelo Guardiao de Confiabilidade em 27/09/2026 e
// consertado em 29/09 -- antes de existir o 2o circuito, que e quando isto
// deixaria de ser inalcancavel.)
async function mirrorSazonal(circuitoId: string, atletaId: string, campos: Record<string, unknown>, extra: Record<string, unknown> = {}, ehEspelho = true) {
  try {
    const dados = seasonalOnly(campos);
    if (Object.keys(dados).length === 0 && Object.keys(extra).length === 0) return;
    const { error } = await supabase.from("circuito_atletas")
      .upsert({ circuito_id: circuitoId, atleta_id: atletaId, ...dados, ...extra }, { onConflict: "circuito_id,atleta_id" });
    if (error) throw error;
  } catch (e) {
    if (!ehEspelho) throw e; // unica escrita: o erro TEM de subir, senao mente "sucesso"
    console.warn("dual-write circuito_atletas falhou (BH segue via atletas):", (e as any)?.message);
  }
}
// Versões de regulamento que JÁ NÃO prometem o desconto de 80% para quem entra
// na 2ª etapa. É uma lista de PERMISSÃO, não de proibição, e a diferença é o
// ponto inteiro: o destravamento do BH é um carimbo digitado à mão, e um typo
// ("V03-13", "v03-13 ", versão nula) tem de FECHAR o portão, não abrir. A 1ª
// versão desta guarda perguntava "esta versão promete desconto?" e deixava
// passar tudo que não estivesse na lista — inclusive a v03-11 e a v03-4, que
// são versões reais antigas do BH e também prometiam 80%. Achado por três
// guardiões em 13/09/2026, cada um por um caminho.
// Espelha VERSOES_COM_DESCONTO_ETAPA no App.jsx: o que está aqui é o complemento
// do que está lá, e a bateria checa que as duas não divergem.
const VERSOES_SEM_DESCONTO_ETAPA = new Set(["v03-13", "vA-nc-01", "vB-01"]);

// A que CIRCUITO cada versão pertence. É outra pergunta que a lista acima: ela
// responde "esta versão promete desconto?", esta responde "esta versão é daqui?".
// Carimbar `vA-nc-01` no BH passaria na primeira e estragaria a segunda — o
// Cap. 10, o Torneio Presencial, é do BH e some da tela nas outras versões.
// Fail-closed: versão fora da família do circuito é recusada pelo carimbo.
const VERSOES_DO_BH = new Set(["v03-12", "v03-13"]);
const VERSOES_DE_RATING_NOVO = new Set(["vA-nc-01"]);
const VERSOES_DO_SISTEMA_B = new Set(["vB-01"]);

// Espelha config no circuito (mesmos nomes de coluna que `configuracao`).
async function mirrorConfig(circuitoId: string, campos: Record<string, unknown>) {
  try {
    if (!campos || Object.keys(campos).length === 0) return;
    const { error } = await supabase.from("circuitos").update(campos).eq("id", circuitoId);
    if (error) throw error;
  } catch (e) {
    console.warn("dual-write circuitos falhou (BH segue via configuracao):", (e as any)?.message);
  }
}

// Escreve um update de atleta roteando por circuito (blindagem cross-tenant):
// - BH: grava tudo em `atletas` (fonte que o app le) + espelha o sazonal em circuito_atletas (como hoje).
// - nao-BH: IDENTIDADE (rating/nome/etc.) -> atletas (compartilhada, Modelo B); SAZONAL -> so circuito_atletas.
async function writeAtleta(circuitoId: string, atletaId: string, campos: Record<string, unknown>) {
  const bh = await bhId();
  if (circuitoId === bh) {
    const { error } = await supabase.from("atletas").update(campos).eq("id", atletaId);
    if (error) throw error;
    await mirrorSazonal(circuitoId, atletaId, campos);
    return;
  }
  const identidade: Record<string, unknown> = {};
  for (const k in campos) if (!SEASONAL_COLS.has(k)) identidade[k] = campos[k];
  // Guard motor B (defesa em profundidade): circuito Sistema B NUNCA escreve identidade de
  // rating na tabela global `atletas` — nem que um bug futuro tente. NAO afeta o BH ('A').
  if ((await getSistema(circuitoId)) === "B") {
    // ⚠️ `rating_inicial` FALTAVA NESTA LISTA ate 29/09/2026, e ele e escrito pela
    // porta de entrada: o `INSCRICAO_VALIDAR` grava `rating_inicial: rating` ao
    // aprovar uma inscricao. Resultado: aprovar alguem no circuito de PONTOS
    // reescrevia o `rating_inicial` global daquela pessoa -- o numero com que ela
    // entrou no circuito de RATING, que e a base da linha do tempo dela no BH --
    // com o que o cliente mandasse, ou com `undefined`, porque no Sistema B nem
    // existe campo de rating na tela para digitar.
    //
    // Eu quase "consertei" isto nos dois `case`, criando a terceira copia da mesma
    // regra. A guarda e UMA e mora aqui: os `case` nao precisam saber do sistema.
    delete identidade.rating; delete identidade.rating_inicial;
    delete identidade.rating_pico; delete identidade.rating_historico;
  }
  const escreveuIdentidade = Object.keys(identidade).length > 0;
  if (escreveuIdentidade) {
    const { error } = await supabase.from("atletas").update(identidade).eq("id", atletaId);
    if (error) throw error;
  }
  // Se NADA foi para `atletas`, o upsert abaixo e a UNICA escrita da acao inteira --
  // entao ele nao pode ser best-effort. Ver o comentario do `mirrorSazonal`.
  await mirrorSazonal(circuitoId, atletaId, campos, {}, escreveuIdentidade);
}

// --- Leitura por circuito (Fase 4B passo 3) ------------------------------
// REGRA DE CAUTELA: para o BH, tudo roda EXATAMENTE como antes (le atletas/configuracao).
// Para outros circuitos, le circuito_atletas/circuitos. Assim o caminho do BH nao muda.

// Config do circuito: BH -> configuracao(id=1); demais -> circuitos(id).
async function getCfg(circuitoId: string, cols: string): Promise<any> {
  const bh = await bhId();
  if (circuitoId === bh) {
    const { data, error } = await supabase.from("configuracao").select(cols).eq("id", 1).single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from("circuitos").select(cols).eq("id", circuitoId).single();
  if (error) throw error;
  return data;
}
// Grava config: BH -> configuracao(id=1) + espelho circuitos; demais -> so circuitos.
// (Protege configuracao(id=1)/BH de escritas de outros circuitos.)
async function setCfg(circuitoId: string, campos: Record<string, unknown>) {
  const bh = await bhId();
  if (circuitoId === bh) {
    const { error } = await supabase.from("configuracao").update(campos).eq("id", 1);
    if (error) throw error;
    await mirrorConfig(circuitoId, campos);
  } else {
    const { error } = await supabase.from("circuitos").update(campos).eq("id", circuitoId);
    if (error) throw error;
  }
}
// Monta um objeto no formato de linha `atletas` a partir de circuito_atletas + atletas aninhado.
function mergeAtletaCircuito(ca: any): any {
  const a = ca.atletas || {};
  return {
    ...a,
    id: a.id,
    status: ca.status, motivo_reprovacao: ca.motivo_reprovacao,
    pendente_circuito: ca.pendente_circuito, ultima_recusa_circuito_em: ca.ultima_recusa_circuito_em,
    chave: ca.chave, saldo_temp: ca.saldo_temp, vitorias: ca.vitorias, derrotas: ca.derrotas,
    vitorias_total: ca.vitorias_total, derrotas_total: ca.derrotas_total,
    wo_culposos_temporada: ca.wo_culposos_temporada,
    pagamento_confirmado: ca.pagamento_confirmado, pagamento_proxima_confirmado: ca.pagamento_proxima_confirmado,
    desconto_pct: ca.desconto_pct, isento: ca.isento,
    quer_renovar: ca.quer_renovar, renovacao_em: ca.renovacao_em,
    historico: ca.historico, posicao_historico: ca.posicao_historico,
    // `inscrito_em` entrou em 30/09/2026 e e SAZONAL: e a data em que a pessoa entrou
    // NESTE circuito. Sem ele o bye nao tinha como separar "folgou nesta rodada" de
    // "entrou depois que a rodada foi escalada" -- e este tradutor o descartava, que
    // e a terceira vez nesta onda que um adaptador perde um campo que a consulta ja
    // trazia (os outros dois foram `wo_culposos_temporada` e `exclusao_solicitada_em`).
    inscrito_em: ca.inscrito_em,
  };
}
// Atletas ATIVOS e no circuito (pendente_circuito=false), no formato de `atletas`.
async function getAtivosNoCircuito(circuitoId: string, exigePagamento: boolean): Promise<any[]> {
  const bh = await bhId();
  if (circuitoId === bh) {
    let q = supabase.from("atletas").select("*").eq("status", "ativo").eq("pendente_circuito", false);
    if (exigePagamento) q = q.eq("pagamento_confirmado", true);
    const { data, error } = await q;
    if (error) throw error;
    return await semIntrusosDeOutroCircuito(bh, data || []);
  }
  let q = supabase.from("circuito_atletas").select("*, atletas!inner(*)").eq("circuito_id", circuitoId).eq("status", "ativo").eq("pendente_circuito", false);
  if (exigePagamento) q = q.eq("pagamento_confirmado", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(mergeAtletaCircuito);
}
// Tira do resultado do BH quem e membro de OUTRO circuito e nao e membro do BH.
//
// ⚠️ Por que isto existe, e por que nao bastava marcar o atleta novo como
// "pendente_circuito" (29/09/2026): o roster do BH e derivado da tabela GLOBAL
// `atletas`, que nao tem coluna de circuito. Todo atleta globalmente "ativo" cai
// num dos dois baldes do BH -- roster (`pendente_circuito=false`) ou FILA DE
// ESPERA (`pendente_circuito=true`) -- e o `promoverBacklog` esvazia a fila para
// dentro do roster no `INICIAR_ETAPA`. Nao existe terceiro estado. Ou seja: o
// remedio "poe na fila" apenas adiava a invasao por uma acao.
//
// A regra e a que o Guardiao de Seguranca propos, e ela recusa ZERO operacao
// legitima hoje (conferido em producao: 15 atletas, 15 vinculos, todos do BH):
//   · tem vinculo com o BH            -> e do BH, entra;
//   · nao tem vinculo com circuito nenhum -> roster legado puro, entra;
//   · so tem vinculo com outro circuito  -> NAO e do BH, fica de fora.
// Um atleta que jogue nos dois tem vinculo com os dois, e continua entrando.
async function semIntrusosDeOutroCircuito(bh: string, linhas: any[]): Promise<any[]> {
  if (!linhas.length) return linhas;
  const ids = linhas.map((a: any) => a.id).filter(Boolean);
  const { data: vinculos, error } = await supabase
    .from("circuito_atletas").select("atleta_id,circuito_id").in("atleta_id", ids);
  if (error) throw error;
  const temBh = new Set<string>();
  const temOutro = new Set<string>();
  (vinculos ?? []).forEach((v: any) => {
    if (v.circuito_id === bh) temBh.add(v.atleta_id); else temOutro.add(v.atleta_id);
  });
  return linhas.filter((a: any) => temBh.has(a.id) || !temOutro.has(a.id));
}

// Atletas por ids, no formato de `atletas` (para o motor de rating).
async function getAtletasPorIds(circuitoId: string, ids: string[]): Promise<any[]> {
  const bh = await bhId();
  if (circuitoId === bh) {
    const { data, error } = await supabase.from("atletas").select("*").in("id", ids);
    if (error) throw error;
    return data || [];
  }
  const { data, error } = await supabase.from("circuito_atletas").select("*, atletas!inner(*)").eq("circuito_id", circuitoId).in("atleta_id", ids);
  if (error) throw error;
  return (data || []).map(mergeAtletaCircuito);
}
// Conta atletas ativos no circuito (pendente_circuito=false).
async function countAtivosNoCircuito(circuitoId: string): Promise<number> {
  const bh = await bhId();
  if (circuitoId === bh) {
    // Conta a lista JA FILTRADA, e nao um `count` cru: senao o teto do BH passaria
    // a incluir atleta de outro circuito que o roster nao mostra.
    const { data } = await supabase.from("atletas").select("id").eq("status", "ativo").eq("pendente_circuito", false);
    return (await semIntrusosDeOutroCircuito(bh, data || [])).length;
  }
  const { count } = await supabase.from("circuito_atletas").select("*", { count: "exact", head: true }).eq("circuito_id", circuitoId).eq("status", "ativo").eq("pendente_circuito", false);
  return count || 0;
}

// Promove a IDENTIDADE global do atleta para "ativo". So para cima: nunca rebaixa.
//
// ⚠️ Sem isto, atleta que nasce num circuito NAO-BH nao consegue entrar no app
// NUNCA (achado de 29/09/2026, provado rodando o motor). O caminho era:
//   · `INSCREVER` cria a linha em `atletas` com status "pendente";
//   · o organizador aprova -> `INSCRICAO_VALIDAR` chama `writeAtleta`, e `status`
//     esta em SEASONAL_COLS, entao num circuito nao-BH ele vai SO para
//     `circuito_atletas`. O `atletas.status` fica "pendente" para sempre;
//   · e o `login-atleta` recusa com `cadastro_inativo` (403) em SESSAO, PARTICIPAR
//     e LOGIN_ORGANIZADOR olhando justamente o `atletas.status`.
//     ⚠️ Esta linha dizia "LOGIN, SESSAO e PARTICIPAR" e estava ERRADA: o `LOGIN` e
//     o `DEFINIR_PIN` NAO conferem status (`login-atleta` :191 e :222). Na pratica
//     o pendente cria o PIN e so depois a TELA o barra (`App.jsx`). Corrigido em
//     29/09/2026 pelo guardiao do Atleta -- comentario errado e pior que comentario
//     nenhum, porque alguem le para decidir.
// No BH nao aparecia porque la o `writeAtleta` grava nos dois lugares.
//
// Os dois status querem dizer coisas diferentes, e e por isso que a correcao e
// esta e nao "tirar status de SEASONAL_COLS":
//   · `atletas.status`         = a PESSOA existe na plataforma e pode entrar;
//   · `circuito_atletas.status` = ela e membro DAQUELE circuito, nesta temporada.
// Por isso a promocao e so para cima: reprovar alguem num circuito nao pode
// trancar a porta dos outros circuitos dele.
async function promoverIdentidadeGlobal(atletaId: string) {
  const { data: atual } = await supabase.from("atletas")
    .select("status,exclusao_solicitada_em,telefone").eq("id", atletaId).maybeSingle();
  if (!atual || atual.status !== "pendente") return; // ja ativo, arquivado ou reprovado: nao mexe

  // ⚠️ AS DUAS PORTAS DA LGPD. Elas ja guardavam o `DESARQUIVAR_ATLETA` desde
  // 27/09/2026, e a promocao nova abriu uma TERCEIRA porta para o mesmo lugar --
  // regressao introduzida por mim em 29/09 e medida pelo Guardiao de Seguranca:
  // atleta com pedido de exclusao em aberto, aprovado numa inscricao de rotina,
  // tinha a identidade global reativada. Na arvore anterior isso nao acontecia,
  // porque num circuito nao-BH o `INSCRICAO_VALIDAR` nao encostava em
  // `atletas.status`.
  // Ficam AQUI, e nao no `case`, porque a promocao tem mais de um chamador: regra
  // duplicada e a origem de metade dos defeitos desta auditoria.
  if (atual.exclusao_solicitada_em) return;
  if (String(atual.telefone || "").startsWith("removido:")) return;

  // `pendente_circuito: true` NAO e detalhe -- e o que impede o atleta do circuito
  // novo de cair no ROSTER DO BH. O roster legado e
  // `atletas where status='ativo' and pendente_circuito=false`, e a coluna tem
  // DEFAULT false no banco, e o INSCREVER nao a manda. Sem esta linha, aprovar
  // alguem no circuito de pontos o punha para jogar no BH: o Guardiao Juridico
  // provou rodando o INICIAR_ETAPA do BH, que respondeu com os intrusos pareados
  // contra atletas do BH. E o `CLAUDE.md` ja nomeava essa armadilha; eu a reabri
  // por outra porta.
  // O `login-atleta` so olha `status` (nunca `pendente_circuito`), entao o atleta
  // continua entrando no app -- que era o ponto da promocao.
  const { error } = await supabase.from("atletas")
    .update({ status: "ativo", pendente_circuito: true })
    .eq("id", atletaId).eq("status", "pendente");
  if (error) throw error;
}

const ALLOWED_ORIGINS = [
  "https://clubedotenisdemesabh.com.br",
  "https://www.clubedotenisdemesabh.com.br",
  "https://clube-tenis-mesa.vercel.app",
  // Desenvolvimento: o app rodando na maquina do Juliano (`npm run dev`).
  // Sem isto, o preflight responde com a origem de producao e o navegador corta
  // a chamada ANTES de sair da tela — nao da para entrar no app local, nem como
  // admin nem como atleta, e so as telas publicas carregam.
  // Nao afrouxa autenticacao: CORS so vale para navegador, e PIN/token continuam
  // exigidos aqui dentro. Quem chama por fora do navegador (curl) nunca passou
  // por CORS de todo jeito.
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const JANELA_MINUTOS = 15;
const MAX_TENTATIVAS = 5;

const CBTM_FAVORITO = [
  { max: 24, v: 10, p: -8 }, { max: 49, v: 9, p: -7 }, { max: 99, v: 8, p: -6 },
  { max: 149, v: 7, p: -5 }, { max: 199, v: 6, p: -4 }, { max: 299, v: 5, p: -3 },
  { max: 399, v: 4, p: -2 }, { max: 499, v: 3, p: -1 }, { max: 749, v: 2, p: 0 },
  { max: Infinity, v: 1, p: 0 },
];
const CBTM_AZARAO = [
  { max: 24, v: 11, p: -9 }, { max: 49, v: 12, p: -10 }, { max: 99, v: 14, p: -11 },
  { max: 149, v: 16, p: -12 }, { max: 199, v: 18, p: -14 }, { max: 299, v: 20, p: -16 },
  { max: 399, v: 23, p: -18 }, { max: 499, v: 26, p: -20 }, { max: Infinity, v: 30, p: -22 },
];
function calcRatingCBTM(ratingVencedor: number, ratingPerdedor: number, peso = 1) {
  const diff = Math.abs(ratingVencedor - ratingPerdedor);
  const azaraoVenceu = ratingVencedor < ratingPerdedor;
  const tabela = azaraoVenceu ? CBTM_AZARAO : CBTM_FAVORITO;
  const faixa = tabela.find(f => diff <= f.max)!;
  return { vencedor: faixa.v * peso, perdedor: faixa.p * peso };
}
function calcElo(ra: number, rb: number, result: 0 | 1, peso = 1) {
  if (result === 1) {
    const d = calcRatingCBTM(ra, rb, peso);
    return ra + d.vencedor;
  } else {
    const d = calcRatingCBTM(rb, ra, peso);
    return ra + d.perdedor;
  }
}

// ── TRAVA DE TENTATIVAS DE PIN — POR ORIGEM E POR PORTA, E FAIL-CLOSED ──────────
// Reescrita em 01/10/2026. A versao anterior contava `tentativa_em + sucesso` e mais
// nada, e a tabela nao guardava nem quem tentou nem em que porta. Tres defeitos:
//
//  1. TRANCAVA TODO MUNDO. Sem saber a origem, 5 erros de QUALQUER pessoa trancavam
//     a entrada de TODOS por 15 minutos -- inclusive o super-admin no proprio painel.
//     Nao precisava de ataque: bastava alguem achar o endereco e errar cinco vezes.
//  2. ABRIA QUANDO QUEBRAVA. O erro da contagem era descartado (`const { count }`),
//     entao banco fora do ar ou rede lenta devolvia `count` vazio, `(count ?? 0)`
//     virava zero, `0 >= 5` dava falso, e a trava LIBERAVA. Freio que abre ao
//     quebrar nao e freio. Agora recusa -- se nao da para conferir, nao passa.
//  3. SEIS PORTAS, UM CADERNO. As seis Edge Functions que pedem PIN usavam a MESMA
//     contagem, entao um erro em qualquer uma trancava as outras cinco -- inclusive
//     a `anonimizar-atleta`, que cumpre direito de exclusao de dados com PRAZO
//     LEGAL. Filtrar por `porta` da a cada uma a sua propria conta.
//
// `origem` nunca e NULL (vira 'desconhecida') para a contagem comparar sempre com
// `=` e nunca precisar de `IS NULL`. As linhas antigas tem NULL nas duas colunas,
// logo nao casam com nenhuma contagem nova -- os 18 erros historicos nao contam
// contra ninguem, o que e o comportamento certo.
//
// ⚠️ As SEIS funcoes tem esta mesma forma porque nao existe pasta compartilhada
// entre Edge Functions neste projeto. A bateria tem varredura que exige as seis
// iguais -- consertar uma e esquecer cinco e exatamente como este defeito viveu.
function ipDaChamada(req: Request): string {
  // Mesmo idioma que o `login-atleta` e o `athlete-action` ja usam.
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "desconhecida";
}
const PORTA = "admin-action";
const FALHA_CONFERIR = { ok: false, motivo: "Não foi possível conferir o acesso agora. Tente de novo em instantes." };
const BLOQUEADO = { ok: false, motivo: `Muitas tentativas incorretas desta origem. Aguarde ${JANELA_MINUTOS} minutos.` };

async function pinValido(pin: string, origem: string): Promise<{ ok: boolean; motivo?: string }> {
  const desde = new Date(Date.now() - JANELA_MINUTOS * 60_000).toISOString();
  const { count, error: errConta } = await supabase
    .from("tentativas_login_admin")
    .select("*", { count: "exact", head: true })
    .gte("tentativa_em", desde)
    .eq("sucesso", false)
    .eq("porta", PORTA)
    .eq("origem", origem);
  // FAIL-CLOSED: nao conseguir conferir e motivo para RECUSAR, nunca para liberar.
  if (errConta) return FALHA_CONFERIR;
  if ((count ?? 0) >= MAX_TENTATIVAS) return BLOQUEADO;
  const ok = pin === ADMIN_PIN;
  await supabase.from("tentativas_login_admin").insert({ sucesso: ok, porta: PORTA, origem });
  if (!ok) return { ok: false, motivo: "PIN inválido." };
  return { ok: true };
}

// ── Autorização por ORGANIZADOR (Papéis Fatia 2). O PIN global (super-admin) é INALTERADO. ──
// Organizador = atleta (telefone+PIN) vinculado a um circuito em `circuito_organizadores`.
// PIN via PBKDF2 (mesma cripto do login-atleta), com a trava de tentativas do atleta.
function _b64(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)); }
function _fromB64(s: string): Uint8Array { return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); }
async function _deriveBits(pin: string, salt: Uint8Array, iter: number): Promise<Uint8Array> {
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, km, 256);
  return new Uint8Array(bits);
}
async function _verifyPin(pin: string, stored: string): Promise<boolean> {
  try {
    const [alg, iterStr, saltB64, hashB64] = stored.split("$");
    if (alg !== "pbkdf2") return false;
    const hash = await _deriveBits(pin, _fromB64(saltB64), parseInt(iterStr));
    const esperado = _b64(hash);
    if (esperado.length !== hashB64.length) return false;
    let diff = 0; for (let i = 0; i < esperado.length; i++) diff |= esperado.charCodeAt(i) ^ hashB64.charCodeAt(i);
    return diff === 0;
  } catch { return false; }
}
async function autenticarOrganizador(telefone: string, pin: string): Promise<{ atletaId?: string; bloqueado?: boolean }> {
  const alvo = String(telefone || "").replace(/\D/g, "");
  if (alvo.length < 10 || !pin) return {};
  const { data } = await supabase.from("atletas").select("id,telefone,pin_hash,pin_tentativas,pin_bloqueado_ate,status");
  const a = (data ?? []).find((x: any) => String(x.telefone || "").replace(/\D/g, "") === alvo);
  if (!a || !a.pin_hash || a.status !== "ativo") return {};
  if (a.pin_bloqueado_ate && new Date(a.pin_bloqueado_ate) > new Date()) return { bloqueado: true };
  const ok = await _verifyPin(String(pin), a.pin_hash);
  if (!ok) {
    const tent = (a.pin_tentativas || 0) + 1;
    const upd = tent >= 5 ? { pin_tentativas: 0, pin_bloqueado_ate: new Date(Date.now() + 15 * 60000).toISOString() } : { pin_tentativas: tent };
    await supabase.from("atletas").update(upd).eq("id", a.id);
    return {};
  }
  await supabase.from("atletas").update({ pin_tentativas: 0, pin_bloqueado_ate: null }).eq("id", a.id);
  return { atletaId: a.id };
}
async function ehOrganizadorDe(atletaId: string, circuitoId: string): Promise<boolean> {
  const { data } = await supabase.from("circuito_organizadores").select("atleta_id").eq("atleta_id", atletaId).eq("circuito_id", circuitoId).maybeSingle();
  return !!data;
}
// ALLOWLIST das ações do organizador (default-deny: o que não está aqui é só super-admin,
// ex.: CRIAR_CIRCUITO, NOVA_TEMPORADA, SALVAR_ADMIN_BIO_CRED, EDITAR_ATLETA).
const ACOES_ORG = new Set([
  "INICIAR_ETAPA","AVANCAR_RODADA","PROCESSAR_RODADA",
  "VALIDATE_RESULT","ADMIN_IMPUTAR_RESULTADO","DESFAZER_VALIDACAO","MARCAR_RESULTADO_COMUNICADO",
  "APLICAR_WO","RESPONDER_WO","MARCAR_WO_NOTIFICADO","LER_JUSTIFICATIVA_WO",
  "INSCRICAO_VALIDAR","INCLUIR_NO_CIRCUITO","RECUSAR_CIRCUITO","ARQUIVAR_ATLETA","DESARQUIVAR_ATLETA","DEFINIR_DESCONTO_ATLETA",
  "DEFINIR_INSCRICOES_ABERTAS","DEFINIR_PUBLICO","DEFINIR_AUTO_VALIDAR","DEFINIR_CONFIG_CIRCUITO",
  // Financeiro (config + pagamentos): decisão do Juliano = "depende do financeiro por circuito".
  // Ficam aqui por ora; a Fatia do 'financeiro por circuito' vai torná-los CONDICIONAIS ao flag
  // `org_ve_financeiro` do circuito (padrão desligado). TODO: gate condicional.
  "DEFINIR_FINANCEIRO",
  "REGISTRAR_PAGAMENTO","ESTORNAR_PAGAMENTO","EDITAR_PAGAMENTO","LISTAR_PAGAMENTOS","LISTAR_MENSAGENS","REGISTRAR_MENSAGEM_ENVIADA",
  // 0.6.2 — sem isto a tela de inscricoes/mensagens do organizador fica em "carregando..."
  // para sempre e o botao de WhatsApp nasce morto. A acao agora e escopada por circuito.
  "LISTAR_TELEFONES",
]);
// Revisão de acesso do organizador (07/09/2026, validado item a item com o Juliano):
// TIRADOS do organizador (só super-admin): EXCLUIR_ATLETA, ABRIR_PROXIMA_TEMPORADA, CANCELAR_PROXIMA.
// DEFINIR_RODADAS saiu da lista (rodadas são fixas em 6; a ação já recusa de qualquer forma).
// AÇÕES FINANCEIRAS: ficam na allowlist, mas só valem pro organizador se o super-admin ligou
// `org_ve_financeiro` no circuito dele (padrão OFF). Gate condicional no enforcement abaixo.
const FINANCEIRO_ACOES = new Set([
  "DEFINIR_FINANCEIRO","REGISTRAR_PAGAMENTO","ESTORNAR_PAGAMENTO","EDITAR_PAGAMENTO","LISTAR_PAGAMENTOS",
]);
// ESCOPO POR RECURSO: ações que recebem um matchId/atletaId precisam confirmar que o
// recurso pertence ao circuito do organizador (senão ele tocaria outro circuito/BH).
const ORG_MATCH_FIELD: Record<string, string> = {
  VALIDATE_RESULT: "matchId", ADMIN_IMPUTAR_RESULTADO: "matchId", DESFAZER_VALIDACAO: "matchId",
  MARCAR_RESULTADO_COMUNICADO: "matchId", APLICAR_WO: "matchId", RESPONDER_WO: "matchId",
};
const ORG_MATCH_OPCIONAL = new Set(["RESPONDER_WO"]); // matchId só quando aprovado
const ORG_MEMBRO_FIELD: Record<string, string> = {
  INSCRICAO_VALIDAR: "id", INCLUIR_NO_CIRCUITO: "id", RECUSAR_CIRCUITO: "id", ARQUIVAR_ATLETA: "id", DESARQUIVAR_ATLETA: "id",
  EXCLUIR_ATLETA: "id", DEFINIR_DESCONTO_ATLETA: "atletaId", REGISTRAR_PAGAMENTO: "atletaId",
};
// PARTICIPANTE DA PARTIDA — campos do payload que tem de ser um dos DOIS atletas
// daquela partida. Existe desde 30/09/2026.
//
// O buraco que isto fecha foi achado por tres guardioes/supervisores por caminhos
// independentes, e a prova estava VERMELHA desde a 1a rodada sem ninguem ler:
// o `APLICAR_WO` conferia em QUE PARTIDA o organizador agia (ORG_MATCH_FIELD,
// logo abaixo) e nunca conferia QUEM ele apontou como faltoso ou beneficiario.
//
// Medido no motor, com `sucesso: true` nos quatro cenarios:
//  · faltoso que nao jogou aquela partida -> os DOIS jogadores de verdade ficam
//    com zero, o beneficiario leva a vitoria, e o -15 do Cap. 07 desaparece:
//    5 pontos distribuidos onde o vB-01 previa 3. PONTO CRIADO.
//  · o terceiro leva `wo_culposos_temporada = 1`, que e o contador da SUSPENSAO
//    (Cap. 07, dois injustificados) e o 2o desempate (Cap. 09). Suspensao
//    plantavel em qualquer atleta.
//  · faltoso que e membro so de OUTRO circuito -> `recontarWoCulposos` ->
//    `writeAtleta` -> `mirrorSazonal` faz upsert com onConflict e FABRICA a
//    linha dele em `circuito_atletas` do circuito do atacante. Escrita cruzada
//    entre circuitos, que e a Regra Inviolavel no 3.
//
// Isto nao era alcancavel pela tela (o `RegistrarWoInline` so oferece `m.p1Id` e
// `m.p2Id`), entao nao houve dano em producao -- era guarda de servidor faltando.
// A guarda irma, para `matchId`, ja existia 30 linhas abaixo com o raciocinio
// inteiro escrito; ninguem a estendeu ao par faltoso/beneficiario. E a quarta vez
// que "conserto de instrumento e conserto de UM caminho" morde este arquivo, e e
// por isso que isto entra como TABELA e nao como `if` dentro do `case`: a proxima
// acao que receber um id de atleta junto com um `matchId` ja nasce coberta.
const ORG_PARTICIPANTE_FIELDS: Record<string, string[]> = {
  APLICAR_WO: ["faltosoId", "beneficiarioId"],
};

function confrontosDaTemporada(partidas: any[]): Set<string> {
  const set = new Set<string>();
  partidas.forEach((m) => {
    if (m.atleta1_id && m.atleta2_id) {
      const [a, b] = [m.atleta1_id, m.atleta2_id].sort();
      set.add(`${a}|${b}`);
    }
  });
  return set;
}

function jaSeEnfrentaram(idA: string, idB: string, historico: Set<string>): boolean {
  const [a, b] = [idA, idB].sort();
  return historico.has(`${a}|${b}`);
}

function confrontoDiretoDB(aId: string, bId: string, partidas: any[]): number {
  let av = 0, bv = 0;
  for (const m of partidas) {
    if (m.rejeitado || !m.validado) continue;
    if (m.placar1 == null || m.placar2 == null) continue;
    if (!((m.atleta1_id === aId && m.atleta2_id === bId) || (m.atleta1_id === bId && m.atleta2_id === aId))) continue;
    const venc = m.placar1 > m.placar2 ? m.atleta1_id : m.atleta2_id;
    if (venc === aId) av++; else if (venc === bId) bv++;
  }
  return av - bv;
}

function cmpRankingDB(partidas: any[]) {
  return (a: any, b: any) => {
    if ((b.saldo_temp || 0) !== (a.saldo_temp || 0)) return (b.saldo_temp || 0) - (a.saldo_temp || 0);
    if ((b.vitorias || 0) !== (a.vitorias || 0)) return (b.vitorias || 0) - (a.vitorias || 0);
    const h2h = confrontoDiretoDB(a.id, b.id, partidas);
    if (h2h !== 0) return -h2h;
    return (b.rating || 0) - (a.rating || 0);
  };
}

// Comparador de ranking do Sistema B (pontos fixos). saldo_temp = pontos acumulados (V=2/D=1).
// Desempate: pontos -> MENOS W.O. injustificados -> confronto direto -> % aproveitamento -> saldo de sets -> id (estavel).
// (Definido aqui; so e' CHAMADO no ramo `sistema === 'B'` — inerte pro BH ate a Fatia 2.)
function aproveitamentoB(a: any): number {
  const n = (a.vitorias || 0) + (a.derrotas || 0);
  return n > 0 ? (a.vitorias || 0) / n : 0;
}
function saldoSetsB(id: string, partidas: any[]): number {
  let s = 0;
  for (const m of partidas) {
    if (m.rejeitado || !m.validado) continue;
    if (m.placar1 == null || m.placar2 == null) continue;
    if (m.atleta1_id === id) s += (m.placar1 - m.placar2);
    else if (m.atleta2_id === id) s += (m.placar2 - m.placar1);
  }
  return s;
}
function cmpRankingB(partidas: any[]) {
  return (a: any, b: any) => {
    if ((b.saldo_temp || 0) !== (a.saldo_temp || 0)) return (b.saldo_temp || 0) - (a.saldo_temp || 0);
    if ((a.wo_culposos_temporada || 0) !== (b.wo_culposos_temporada || 0)) return (a.wo_culposos_temporada || 0) - (b.wo_culposos_temporada || 0);
    const h2h = confrontoDiretoDB(a.id, b.id, partidas);
    if (h2h !== 0) return -h2h;
    const apA = aproveitamentoB(a), apB = aproveitamentoB(b);
    if (apB !== apA) return apB - apA;
    const ssA = saldoSetsB(a.id, partidas), ssB = saldoSetsB(b.id, partidas);
    if (ssB !== ssA) return ssB - ssA;
    return String(a.id).localeCompare(String(b.id));
  };
}

function parearRodada(athletes: any[], historico: Set<string>, jaTeveBye: Set<string> = new Set()): { pares: { p1: string; p2: string }[]; bye: string | null } {
  const sorted = [...athletes].sort((a, b) => (b.rating || 250) - (a.rating || 250));

  let byeId: string | null = null;
  let jogadores = sorted;
  if (sorted.length % 2 !== 0) {
    // BYE COM ROTACAO -- decisao do Juliano, 29/09/2026: "continua com o de menor
    // rating, mas nao pode repetir a mesma pessoa no bye, entao sempre pela ordem do
    // menor rating sem repetir".
    //
    // Ate aqui era so `sorted[sorted.length - 1]`: o de menor rating, TODA rodada
    // impar, sem rotacao nenhuma. Com 13 atletas isso significava o mesmo atleta --
    // normalmente o iniciante -- de fora de metade dos jogos, indefinidamente. O
    // Sistema B ja tinha rotacao desde a Fatia 4; o A nao.
    //
    // A regra: entre quem AINDA NAO teve bye nesta temporada, folga o de menor
    // rating. Quando todos ja tiveram, o ciclo recomeca (a lista de candidatos volta
    // a ser todo mundo) -- senao, num circuito impar, a partir de certo ponto nao
    // haveria quem escolher e o pareamento travaria.
    const candidatos = sorted.filter(a => !jaTeveBye.has(a.id));
    const escolhido = candidatos.length > 0
      ? candidatos[candidatos.length - 1]   // o de MENOR rating entre os que faltam
      : sorted[sorted.length - 1];          // ciclo completo: recomeca pelo menor
    byeId = escolhido.id;
    jogadores = sorted.filter(a => a.id !== byeId);
  }

  const n = jogadores.length;
  const PENAL_REPETICAO = 1e7;

  function custo(i: number, j: number) {
    const repetido = jaSeEnfrentaram(jogadores[i].id, jogadores[j].id, historico) ? PENAL_REPETICAO : 0;
    return repetido + Math.abs((jogadores[i].rating || 250) - (jogadores[j].rating || 250));
  }

  const usados = new Array(n).fill(false);
  let melhorPares: { p1: string; p2: string }[] | null = null;
  let melhorCusto = Infinity;

  function resolver(pares: { p1: string; p2: string }[], custoAcc: number) {
    if (custoAcc >= melhorCusto) return;
    const i = usados.findIndex((u) => !u);
    if (i === -1) { melhorCusto = custoAcc; melhorPares = pares; return; }
    usados[i] = true;
    const candidatos: { j: number; c: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (j === i || usados[j]) continue;
      candidatos.push({ j, c: custo(i, j) });
    }
    candidatos.sort((a, b) => a.c - b.c);
    for (const { j, c } of candidatos) {
      usados[j] = true;
      resolver([...pares, { p1: jogadores[i].id, p2: jogadores[j].id }], custoAcc + c);
      usados[j] = false;
    }
    usados[i] = false;
  }
  resolver([], 0);

  return { pares: melhorPares || [], bye: byeId };
}

function gerarPareamentoPorRating(athletes: any[], matchesTemporada: any[] = []) {
  const historico = confrontosDaTemporada(matchesTemporada);
  // Quem ja teve bye nesta temporada, derivado do mesmo jeito que o Sistema B faz:
  // por rodada, ativo que nao aparece em nenhuma partida ficou de fora. E "melhor
  // esforco" de proposito -- nao ha coluna de bye no banco, e inventar uma exigiria
  // migracao. Um atleta que entrou no meio da temporada aparece como "ja teve bye"
  // nas rodadas anteriores a entrada dele, o que o poe no FIM da fila de candidatos.
  // Isso erra para o lado certo: quem entrou tarde e' o ultimo a folgar.
  const jaTeveBye = byesDaTemporada(athletes, matchesTemporada);

  const r1 = parearRodada(athletes, historico, jaTeveBye);

  const historico2 = new Set(historico);
  r1.pares.forEach((par) => {
    const [a, b] = [par.p1, par.p2].sort();
    historico2.add(`${a}|${b}`);
  });
  // A 2a rodada do par mensal ja conta o bye da 1a -- senao as duas rodadas do mesmo
  // mes cairiam na mesma pessoa, que e' justamente o que a rotacao veio impedir.
  const jaTeveBye2 = new Set(jaTeveBye);
  if (r1.bye) jaTeveBye2.add(r1.bye);
  const r2 = parearRodada(athletes, historico2, jaTeveBye2);

  return { rodada1: r1.pares, bye1: r1.bye, rodada2: r2.pares, bye2: r2.bye };
}

// UMA conta de "quem ja teve bye", usada pelos DOIS sistemas. Ela existia so dentro
// do `gerarPareamentoB`; ao dar rotacao ao Sistema A em 29/09/2026 ela viraria a
// segunda copia da mesma regra -- o defeito que a `janelaRenovacao` custou um dia
// para desfazer. Nasce compartilhada.
function byesDaTemporada(athletes: any[], matchesTemporada: any[]): Set<string> {
  const jaTeveBye = new Set<string>();
  const rounds = [...new Set((matchesTemporada || []).map((m: any) => m.rodada))];
  const idsAtivos = athletes.map(a => a.id);
  for (const r of rounds) {
    const naRodada = new Set<string>();
    (matchesTemporada || []).filter((m: any) => m.rodada === r).forEach((m: any) => { naRodada.add(m.atleta1_id); naRodada.add(m.atleta2_id); });
    for (const id of idsAtivos) if (!naRodada.has(id)) jaTeveBye.add(id);
  }
  return jaTeveBye;
}

// Quem ENTRA no ranking de uma temporada. UMA conta, usada pelos TRES lugares que
// faziam a mesma pergunta com respostas diferentes -- pelo mesmo motivo de
// `byesDaTemporada` logo acima.
//
// ⚠️ A regra e `calculado`, NAO `validado`. Ate 29/09/2026 os dois ramos da virada
// (`NOVA_TEMPORADA`, BH e nao-BH) filtravam por `validado && !rejeitado`, enquanto
// a TELA filtra por `calculado && !rejeitado` (`App.jsx`, `estaNoRanking`). Eram
// duas respostas diferentes para a mesma pergunta, e elas discordam exatamente nos
// W.O.: o `PROCESSAR_RODADA` trata W.O. num ramo separado e marca `calculado: true`
// sem nunca marcar `validado` -- porque ninguem enviou placar. E o W.O. PONTUA
// (Sistema B: +2 para o presente, +1/0 para o ausente) e MEXE NO RATING (Sistema A:
// -15 para o culposo).
//
// Consequencia medida: um atleta cuja temporada foi decidida em W.O. aparecia no
// ranking a temporada toda na tela e, na virada, nao recebia linha nenhuma de
// historico -- e todos abaixo dele SUBIAM uma posicao no registro permanente. A
// virada nao se desfaz: era historico falso, calado, para sempre.
//
// O `PROCESSAR_RODADA` ainda soma a isto dois casos que so ele conhece (o W.O. do
// Sistema B antes de ser calculado, e o bye da rodada corrente) -- por isso ele
// ADICIONA ao conjunto em vez de reimplementa-lo.
function idsNoRankingFinal(partidas: any[]): Set<string> {
  const ids = new Set<string>();
  (partidas ?? []).forEach((m: any) => {
    if (!m.calculado || m.rejeitado) return;
    if (m.atleta1_id) ids.add(m.atleta1_id);
    if (m.atleta2_id) ids.add(m.atleta2_id);
  });
  return ids;
}

// Reconta os W.O. injustificados de um atleta A PARTIR DAS PARTIDAS, e grava.
//
// Ate 29/09/2026 este numero era ACUMULADO: cada `APLICAR_WO` culposo somava +1 e
// nada nunca subtraia. Tres defeitos saiam dai, e os tres batem no Cap. 07, que
// SUSPENDE o atleta no 2o W.O. injustificado:
//   · aplicar o W.O. duas vezes na mesma partida (dois cliques, chamada repetida,
//     o admin corrigindo o faltoso) somava duas vezes -- suspensao com um W.O. so;
//   · aprovar a justificativa depois (`RESPONDER_WO`) NAO devolvia o ponto: o
//     atleta ficava suspenso por uma falta que o proprio organizador perdoou;
//   · trocar o tipo de culposo para justificado tinha o mesmo efeito.
//
// Derivar em vez de acumular e a mesma escolha de `byesDaTemporada` e
// `idsNoRankingFinal`: a partida e o fato, o contador e so uma leitura dele. E
// idempotente por construcao -- rodar duas vezes da o mesmo numero.
//
// A regra, valida nos DOIS sistemas: conta partida nao rejeitada em que o atleta e
// o faltoso e o tipo e `culposo` ou `a_favor`. `justificado` nunca conta. No
// Sistema A o `a_favor` grava `wo_faltoso_id: null`, entao ele simplesmente nao
// aparece -- mesmo resultado que a conta antiga dava la, de proposito.
async function recontarWoCulposos(circuitoId: string, atletaId: string) {
  const { data: doAtleta, error } = await supabase
    .from("partidas").select("wo_tipo,rejeitado")
    .eq("circuito_id", circuitoId).eq("wo_faltoso_id", atletaId);
  if (error) throw error;
  const n = (doAtleta ?? []).filter((m: any) =>
    !m.rejeitado && (m.wo_tipo === "culposo" || m.wo_tipo === "a_favor")).length;
  await writeAtleta(circuitoId, atletaId, { wo_culposos_temporada: n });
  return n;
}

// ── Pareamento do Sistema B (sem rating) ──────────────────────────────────────
function embaralhar<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// Pareia uma rodada no Sistema B. `pareamento`: 'sorteio' (ordem aleatoria) ou 'grupos'
// (ordena pela tabela de pontos e pareia posicoes proximas). Custo = penalidade de repeticao
// (+ distancia de posicao no modo grupos). Bye com rotacao: prefere quem ainda nao teve bye.
function parearRodadaB(athletes: any[], historico: Set<string>, pareamento: string, jaTeveBye: Set<string>): { pares: { p1: string; p2: string }[]; bye: string | null } {
  const ordenados = (pareamento === "grupos")
    ? [...athletes].sort((a, b) => (b.saldo_temp || 0) - (a.saldo_temp || 0))
    : embaralhar(athletes);

  let byeId: string | null = null;
  let jogadores = ordenados;
  if (ordenados.length % 2 !== 0) {
    const candidatos = ordenados.filter(a => !jaTeveBye.has(a.id));
    const escolhido = candidatos.length > 0
      ? (pareamento === "grupos" ? candidatos[candidatos.length - 1] : candidatos[0])
      : ordenados[ordenados.length - 1];
    byeId = escolhido.id;
    jogadores = ordenados.filter(a => a.id !== byeId);
  }

  const n = jogadores.length;
  const PENAL_REPETICAO = 1e7;
  function custo(i: number, j: number) {
    const rep = jaSeEnfrentaram(jogadores[i].id, jogadores[j].id, historico) ? PENAL_REPETICAO : 0;
    const dist = (pareamento === "grupos") ? Math.abs(i - j) : 0;
    return rep + dist;
  }

  const usados = new Array(n).fill(false);
  let melhorPares: { p1: string; p2: string }[] | null = null;
  let melhorCusto = Infinity;
  function resolver(pares: { p1: string; p2: string }[], custoAcc: number) {
    if (custoAcc >= melhorCusto) return;
    const i = usados.findIndex((u) => !u);
    if (i === -1) { melhorCusto = custoAcc; melhorPares = pares; return; }
    usados[i] = true;
    const candidatos: { j: number; c: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (j === i || usados[j]) continue;
      candidatos.push({ j, c: custo(i, j) });
    }
    candidatos.sort((a, b) => a.c - b.c);
    for (const { j, c } of candidatos) {
      usados[j] = true;
      resolver([...pares, { p1: jogadores[i].id, p2: jogadores[j].id }], custoAcc + c);
      usados[j] = false;
    }
    usados[i] = false;
  }
  resolver([], 0);

  return { pares: melhorPares || [], bye: byeId };
}
// Gera o par mensal (2 rodadas) no Sistema B, com rotacao de bye entre as duas.
// ── Escala de rodizio (metodo do circulo) ────────────────────────────────────
//
// DECISAO DO JULIANO, 29/09/2026: "Nao pode ter repeticao de atleta." Ele escolheu
// isto depois de eu medir que o pareamento antigo repetia um confronto em ~13 de
// cada 120 temporadas com 8 atletas -- que e o MINIMO permitido, ou seja, a
// configuracao mais provavel de um circuito novo.
//
// POR QUE O MOTOR ANTIGO NAO CONSEGUIA. Ele resolve o otimo DE CADA RODADA
// (`parearRodadaB`, branch and bound com penalidade de 1e7 para repeticao) e nunca
// olha as rodadas seguintes. Com 8 atletas cada um tem 7 adversarios possiveis e a
// temporada usa 6: sobra uma folga so. Uma escolha boa na rodada 3 fecha a saida da
// rodada 6, e ai NAO EXISTE emparelhamento sem repeticao -- o motor nao "erra", ele
// nao tem alternativa. Retentar nao resolve: se existisse solucao sem repeticao
// para a rodada corrente, o branch and bound ja a acharia (custo zero).
//
// A SOLUCAO. O metodo do circulo monta a temporada INTEIRA de uma vez: fixa um
// atleta e gira os demais; para n atletas ele gera n-1 rodadas sem nenhuma
// repeticao (e o rodizio de sempre, o mesmo de tabela de campeonato). Com 8 atletas
// sao 7 rodadas possiveis e a temporada usa 6. Medido: 0 repeticoes em 8, 9, 10, 12
// e 20 atletas, e o bye tambem rotaciona sozinho (o "fantasma" gira com o resto).
//
// A ORDEM e sorteada UMA VEZ POR TEMPORADA e precisa ser ESTAVEL entre chamadas --
// o `INICIAR_ETAPA` gera as rodadas 1 e 2, e cada `AVANCAR_RODADA` gera mais duas;
// se a ordem mudasse entre elas, o rodizio se perderia e a repeticao voltaria.
// Por isso ela e derivada de um hash de (id do atleta + rotulo da temporada): fica
// igual em toda chamada da mesma temporada, muda sozinha na virada, e nao precisa
// de coluna nova no banco. O regulamento promete "sorteados" e e isso que acontece
// -- o sorteio so e feito no comeco da temporada em vez de a cada rodada.
function hashEstavel(txt: string): number {
  let h = 2166136261;
  for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function ordemDaTemporada(athletes: any[], semente: string): any[] {
  return [...athletes].sort((a, b) => {
    const ha = hashEstavel(String(a.id) + "|" + semente);
    const hb = hashEstavel(String(b.id) + "|" + semente);
    return ha === hb ? String(a.id).localeCompare(String(b.id)) : ha - hb;
  });
}
// Pares da rodada `rodada` (1-based) pelo metodo do circulo. Devolve tambem quem
// folga, que sai de graca: com numero impar entra um "fantasma", e quem cai contra
// ele e o bye da rodada.
function escalaCirculo(ordenados: any[], rodada: number): { pares: { p1: string; p2: string }[]; bye: string | null } {
  const n = ordenados.length;
  if (n < 2) return { pares: [], bye: n === 1 ? ordenados[0].id : null };
  const par: (any | null)[] = n % 2 === 0 ? [...ordenados] : [...ordenados, null];
  const m = par.length;
  const fixo = par[0];
  const gira = par.slice(1);
  const r = (((rodada - 1) % (m - 1)) + (m - 1)) % (m - 1);
  const col = [fixo, ...gira.slice(r), ...gira.slice(0, r)];
  const pares: { p1: string; p2: string }[] = [];
  let bye: string | null = null;
  for (let i = 0; i < m / 2; i++) {
    const a = col[i], b = col[m - 1 - i];
    if (a && b) pares.push({ p1: a.id, p2: b.id });
    else if (a) bye = a.id;
    else if (b) bye = b.id;
  }
  return { pares, bye };
}

// Semente do sorteio da temporada. Tem de ser a MESMA em toda chamada da mesma
// temporada (o INICIAR gera 1-2 e cada AVANCAR gera mais duas) e MUDAR na virada.
// `circuito + temporada/ano` cumpre as duas coisas sem coluna nova.
async function sementeDaTemporada(circuitoId: string): Promise<string> {
  const cfg = await getCfg(circuitoId, "temporada_numero,temporada_ano");
  return `${circuitoId}|${cfg?.temporada_numero ?? 1}/${cfg?.temporada_ano ?? 0}`;
}

function gerarPareamentoB(
  athletes: any[], matchesTemporada: any[], pareamento: string,
  rodadaBase = 0, semente = "",
) {
  const historico = confrontosDaTemporada(matchesTemporada);
  const jaTeveBye = byesDaTemporada(athletes, matchesTemporada); // conta compartilhada com o Sistema A

  // ── Caminho do RODIZIO (modo "sorteio") ───────────────────────────────────
  // Vale so para o "sorteio". O modo "grupos" e dinamico por definicao -- ele
  // pareia por proximidade na tabela de pontos, que muda a cada rodada --, e a
  // medicao mostrou 0 repeticoes em 120 temporadas nele, entao nao ha o que
  // consertar la.
  //
  // A rede de seguranca: se a escala do circulo produzir um confronto que JA
  // aconteceu -- o que so ocorre quando o grupo mudou no meio da temporada, porque
  // o rodizio e calculado sobre quem esta ativo AGORA --, cai no pareamento antigo,
  // que minimiza repeticao.
  //
  // ⚠️ ESTE COMENTARIO DIZIA "assim o resultado nunca e pior que o de antes" e isso
  // NAO TINHA SIDO MEDIDO -- o Guardiao de Regulamento cobrou, com razao, e ainda
  // sabotou a rede sem a bateria acusar. Medido depois (40 temporadas por caso):
  //     12 atletas, 4 saem na virada do 1o par:  COM a rede 0 repeticoes
  //                                              SEM a rede 3, em TODAS as 40
  //     10 atletas (2 ou 4 saem), 9 (2 saem), 8 (1 sai): identico com e sem
  // Ou seja: ela faz diferenca, e so em elenco que encolhe MUITO depois de ja ter
  // gasto rodadas. E o cenario que o guardiao procurou e nao achou -- e ele
  // reproduziu depois, achando mais tres casos (12->9, 14->9, alem do 12->8).
  // ⚠️ E ela REDUZ SEM ZERAR quando a queda e muito grande: em 12->7 ele mediu
  // 7/40 temporadas ainda com um confronto repetido. Dizer "ela faz diferenca" e
  // verdade; deixar implicito "ela salva sempre" nao e -- e o Cap. 03 ja cobre
  // esse caso, porque la a repeticao so existe quando o elenco muda.
  // Tem asserção ("A rede de seguranca do rodizio faz diferenca"), e a mutacao
  // acusa.
  //
  // ── A TAXA DE REPETICAO DO MODO GRUPOS, medida ────────────────────────────
  // Ela NAO esta no regulamento de proposito (decisao do Guardiao de Regulamento
  // em 29/09/2026, depois de objecao do Juridico), e mora aqui pelo motivo que ele
  // deu: a taxa e propriedade dos RESULTADOS da temporada, nao do motor --
  //     8 atletas, elenco estavel, vencedor sorteado 50/50 .... 276/3000 (9,2%)
  //     8 atletas, elenco estavel, favorito vencendo mais ..... 76/1500 (5,1%)
  //
  // ⚠️ ESTES DOIS NUMEROS FORAM CORRIGIDOS EM 01/10/2026, e a correcao importa mais
  // que os numeros. O comentario dizia "93/1500 (6,2%)" para o segundo cenario, e o
  // Supervisor de Regulamento mostrou que NENHUM arquivo de prova continha esse valor:
  // a unica execucao preservada dizia 83/1500 (5,5%), e ela TERMINAVA EM ERRO DE
  // MEMORIA -- truncada no meio da lista. O total alegado de "6.700 temporadas" tambem
  // nao reconstituia (os papeis somavam 7.700 numa contagem e 4.700 noutra).
  //
  // Ou seja: o defeito no 1 deste projeto -- "nao cite de memoria, rode e leia" --
  // dentro de um numero que foi para o motor, para a tela e para o documento de
  // governanca. Tres lugares citando um valor que ninguem conseguia reproduzir.
  //
  // A medicao agora e ARQUIVO VERSIONADO, com SEMENTE FIXA:
  //     docs/medicoes/2026-10-01-repeticao-grupos.mjs   (como medir)
  //     docs/medicoes/2026-10-01-repeticao-grupos.txt   (a saida, completa)
  // Rodar de novo com os mesmos argumentos da o MESMO resultado. Conferir e rodar.
  // Mesmo codigo, taxas diferentes. E o numero TAXA A MELHORIA: fica falso no dia
  // em que o pareamento do grupos melhorar, e pela regra 7 isso custaria versao
  // nova do regulamento + re-aceite de todo mundo. Texto com aceite tem de ser
  // escrito de modo que melhorar o produto nunca crie obrigacao de re-aceite.
  //
  // O que FOI para o regulamento e o TETO: em 6.100 temporadas com elenco estavel
  // (seis celulas, 8/9/10/12 atletas, nos dois cenarios de resultado e nos dois modos
  // de pareamento), a distribuicao so tem 0 e 1 -- nunca dois reencontros, e ninguem
  // enfrentou o mesmo adversario mais de duas vezes.
  //
  // ⚠️ E "LIMITE MEDIDO", NAO "INVARIANTE". A palavra estava errada e o Supervisor de
  // Regulamento tinha razao: invariante e o que se prova por mecanismo, e nao existe no
  // registro nenhum argumento de por que o guloso NAO PODE produzir dois reencontros --
  // so a observacao de que nao produziu. Chamar medicao de invariante e o erro de
  // categoria que este projeto cobra dos outros.
  //
  // E a consequencia e concreta: o texto do regulamento diz "SEMPRE de um unico
  // confronto", que e absoluto e cai no primeiro contraexemplo -- custando versao nova
  // + re-aceite de todo mundo, exatamente o custo que tirar a taxa evitava. Ou o
  // "sempre" ganha mecanismo e portao com poder, ou ele tem de cair. Registrado como
  // pendencia; nao se conserta com numero, e sim com argumento ou com texto mais fraco.
  //
  // ⚠️ METODO, sem o qual o numero apodrece: medicao de pareamento do modo grupos
  // SO VALE com vencedor sorteado e `PROCESSAR_RODADA` rodando entre os pares
  // mensais. Sem isso `saldo_temp` empata todo mundo, a tabela nao se move, e o
  // modo grupos -- que pareia POR POSICAO NA TABELA -- nunca e exercitado. Foi
  // assim que os primeiros "0 em 120" nasceram errados, na minha medicao E na do
  // guardiao.
  if (pareamento !== "grupos") {
    const ordenados = ordemDaTemporada(athletes, semente);
    const e1 = escalaCirculo(ordenados, rodadaBase + 1);
    const e2 = escalaCirculo(ordenados, rodadaBase + 2);
    const repetido = (pares: { p1: string; p2: string }[], hist: Set<string>) =>
      pares.some((par) => jaSeEnfrentaram(par.p1, par.p2, hist));
    const hist2 = new Set(historico);
    e1.pares.forEach((par) => { const [a, b] = [par.p1, par.p2].sort(); hist2.add(`${a}|${b}`); });
    if (!repetido(e1.pares, historico) && !repetido(e2.pares, hist2)) {
      return { rodada1: e1.pares, bye1: e1.bye, rodada2: e2.pares, bye2: e2.bye };
    }
  }

  const r1 = parearRodadaB(athletes, historico, pareamento, jaTeveBye);
  const historico2 = new Set(historico);
  r1.pares.forEach((par) => { const [a, b] = [par.p1, par.p2].sort(); historico2.add(`${a}|${b}`); });
  const jaTeveBye2 = new Set(jaTeveBye);
  if (r1.bye) jaTeveBye2.add(r1.bye);
  const r2 = parearRodadaB(athletes, historico2, pareamento, jaTeveBye2);
  return { rodada1: r1.pares, bye1: r1.bye, rodada2: r2.pares, bye2: r2.bye };
}

function calcularPrazos(mesRef?: Date) {
  let ref: Date;
  if (mesRef) {
    ref = mesRef;
  } else {
    const hoje = new Date();
    ref = (hoje.getDate() > 27) ? new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1) : hoje;
  }
  const prazoA = new Date(ref.getFullYear(), ref.getMonth(), 15);
  const prazoB = new Date(ref.getFullYear(), ref.getMonth(), 27);
  return { prazoA: prazoA.toISOString().split("T")[0], prazoB: prazoB.toISOString().split("T")[0] };
}

// Promove o backlog respeitando o TETO (max_atletas). Entra por ordem de chegada
// (inscrito_em) só até preencher as vagas; o excedente segue na fila. Quando o
// financeiro está ligado, só promove quem já teve o pagamento confirmado — assim
// vaga contada = vaga de quem vai jogar. Retorna quantos entraram.
// A ENTRADA FECHA NO ULTIMO TERCO DA TEMPORADA (Cap. 11) -- e ate 29/09/2026 esta
// regra vivia SO NA TELA (`_entradaPermitida` no `App.jsx`). O motor nao a conhecia,
// entao a promocao automatica da fila entrava em QUALQUER rodada, inclusive nas duas
// ultimas, contrariando o texto que o atleta aceitou: "Nao ha entrada nas duas
// ultimas rodadas da temporada. Quem for aprovado nesse periodo estreia na temporada
// seguinte, e ai desde a primeira rodada."
//
// Pedido do Juliano em 29/09/2026, ao enunciar a regra de entrada: "permitir a
// entrada de novos desde que cumpra TODAS AS DEMAIS REGRAS DE ENTRADA". Esta era a
// que faltava do lado do servidor.
//
// A conta e a MESMA da tela, de proposito -- com 6 rodadas, o ultimo terco comeca na
// rodada 5, entao as rodadas 5 e 6 nao recebem entrada. Fora da fase de etapa
// (inscricoes, pre-abertura) a entrada e sempre permitida.
async function entradaPermitida(circuitoId: string): Promise<boolean> {
  const cfg = await getCfg(circuitoId, "fase,rodadas_por_temporada");
  if (cfg?.fase !== "etapa") return true;
  const maxRodadas = Number(cfg?.rodadas_por_temporada) || 6;
  const inicioUltimoTerco = maxRodadas - Math.ceil(maxRodadas / 3) + 1;
  const { data: partidas } = await supabase.from("partidas").select("rodada").eq("circuito_id", circuitoId);
  const maxRodada = (partidas ?? []).reduce((m: number, p: any) => Math.max(m, Number(p.rodada) || 0), 0);
  return (maxRodada + 1) < inicioUltimoTerco;
}

async function promoverBacklog(circuitoId: string): Promise<number> {
  if (!(await entradaPermitida(circuitoId))) return 0; // Cap. 11: nada entra no ultimo terco
  const cfg = await getCfg(circuitoId, "max_atletas,financeiro_ativo");
  const max = cfg?.max_atletas || 20;
  const nCirc = await countAtivosNoCircuito(circuitoId);
  const vagas = Math.max(0, max - nCirc);
  if (vagas <= 0) return 0;
  const bh = await bhId();
  let ids: string[] = [];
  if (circuitoId === bh) {
    let q = supabase.from("atletas").select("id").eq("status", "ativo").eq("pendente_circuito", true);
    if (cfg?.financeiro_ativo) q = q.eq("pagamento_confirmado", true);
    const { data: fila } = await q.order("inscrito_em", { ascending: true });
    // Filtra ANTES de aplicar o teto de vagas: senao um intruso ocuparia vaga da
    // fila do BH e empurraria um atleta legitimo para tras.
    ids = (await semIntrusosDeOutroCircuito(bh, fila || [])).slice(0, vagas).map((a: any) => a.id);
    if (!ids.length) return 0;
    const { error } = await supabase.from("atletas").update({ pendente_circuito: false }).in("id", ids);
    if (error) throw error;
    // dual-write (corrige lacuna do passo 2): espelha em circuito_atletas. Best-effort.
    try {
      await supabase.from("circuito_atletas").update({ pendente_circuito: false }).eq("circuito_id", circuitoId).in("atleta_id", ids);
    } catch (e) {
      console.warn("dual-write promoverBacklog falhou (BH segue via atletas):", (e as any)?.message);
    }
  } else {
    let q = supabase.from("circuito_atletas").select("atleta_id").eq("circuito_id", circuitoId).eq("status", "ativo").eq("pendente_circuito", true);
    if (cfg?.financeiro_ativo) q = q.eq("pagamento_confirmado", true);
    const { data: fila } = await q.order("inscrito_em", { ascending: true }).limit(vagas);
    ids = (fila || []).map((a: any) => a.atleta_id);
    if (!ids.length) return 0;
    const { error } = await supabase.from("circuito_atletas").update({ pendente_circuito: false }).eq("circuito_id", circuitoId).in("atleta_id", ids);
    if (error) throw error;
  }
  return ids.length;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") || "";
  const CORS_HEADERS = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return jsonResponse({ sucesso: false, erro: "Método não permitido" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return jsonResponse({ sucesso: false, erro: "JSON inválido" }, 400); }

  const { pin, acao, payload, orgTelefone, orgPin } = body || {};
  if (!acao) return jsonResponse({ sucesso: false, erro: "acao é obrigatória" }, 400);

  // Circuito alvo: o que o app enviar, ou BH por padrao (transicao single-tenant).
  const circuitoId = (payload && payload.circuitoId) ? String(payload.circuitoId) : await bhId();

  // AUTH (Papéis Fatia 2): super-admin (PIN global — INALTERADO) OU organizador (telefone+PIN).
  let ehSuper = false;
  let orgAtletaId: string | null = null;
  if (orgTelefone && orgPin) {
    const r = await autenticarOrganizador(String(orgTelefone), String(orgPin));
    if (r.bloqueado) return jsonResponse({ sucesso: false, erro: "Muitas tentativas. Aguarde alguns minutos." }, 429);
    if (!r.atletaId) return jsonResponse({ sucesso: false, erro: "Telefone ou PIN incorretos." }, 401);
    orgAtletaId = r.atletaId;
  } else {
    if (!pin) return jsonResponse({ sucesso: false, erro: "pin e acao são obrigatórios" }, 400);
    const check = await pinValido(String(pin), ipDaChamada(req));
    if (!check.ok) return jsonResponse({ sucesso: false, erro: check.motivo }, 401);
    ehSuper = true;
  }

  // Organizador: allowlist + escopo por circuito + escopo por RECURSO (partida/atleta do circuito dele).
  if (!ehSuper) {
    if (!ACOES_ORG.has(acao)) return jsonResponse({ sucesso: false, erro: "Ação disponível apenas para o super-admin." }, 403);
    if (!(await ehOrganizadorDe(orgAtletaId!, circuitoId))) return jsonResponse({ sucesso: false, erro: "Você não organiza este circuito." }, 403);
    // Financeiro por circuito: ações financeiras só passam se o super-admin ligou o flag.
    if (FINANCEIRO_ACOES.has(acao)) {
      const { data: cfFin } = await supabase.from("circuitos").select("org_ve_financeiro").eq("id", circuitoId).maybeSingle();
      if (!cfFin?.org_ve_financeiro) return jsonResponse({ sucesso: false, erro: "O financeiro deste circuito é gerido pela plataforma." }, 403);
    }
  }

  // ESCOPO POR RECURSO — VALE PARA TODO MUNDO, inclusive o super-admin.
  //
  // Ate 29/09/2026 este bloco estava DENTRO do `if (!ehSuper)`. Fazia sentido
  // quando a pergunta era "permissao": o super-admin pode tudo, entao nao ha o que
  // negar a ele. So que aqui a pergunta nao e permissao, e COERENCIA: a acao diz em
  // que circuito esta agindo (`circuitoId`) e diz em que partida (`matchId`). Se os
  // dois discordam, isso nunca e uma intencao -- e um bug de quem chamou, e a
  // resposta certa e recusar, nao obedecer.
  //
  // O risco nao e teorico neste app: o painel do admin e POR CIRCUITO e ja teve
  // estado sobrevivendo a troca de circuito (o carry-over que a auditoria de
  // 29/09/2026 consertou remontando o painel inteiro). Com a tela apontando para o
  // circuito B e um `matchId` do circuito A sobrando na memoria, o motor validava,
  // imputava resultado ou aplicava W.O. NO OUTRO CIRCUITO, em silencio, e o
  // organizador de la nao tinha como saber de onde veio.
  //
  // Conferido no banco antes de apertar: 0 atletas sem vinculo e 0 partidas sem
  // circuito -- entao nenhuma operacao legitima de hoje passa a ser recusada.
  {
    const pl = payload || {};
    const mf = ORG_MATCH_FIELD[acao];
    if (mf) {
      const mid = pl[mf];
      if (mid) {
        const { data: pm } = await supabase.from("partidas").select("circuito_id,atleta1_id,atleta2_id").eq("id", mid).maybeSingle();
        if (!pm || pm.circuito_id !== circuitoId) {
          return jsonResponse({ sucesso: false, erro: ehSuper
            ? "Esta partida é de outro circuito. Troque de circuito antes de agir sobre ela."
            : "Partida não é do seu circuito." }, 403);
        }
        // Mesma pergunta da guarda acima, aplicada a QUEM em vez de a ONDE: se a
        // acao nomeia um atleta que nao e um dos dois daquela partida, isso nunca
        // e intencao -- e bug de quem chamou, e a resposta certa e recusar. Ver o
        // bloco do `ORG_PARTICIPANTE_FIELDS` la em cima para o que estava aberto.
        // So confere o campo que VEIO: no Sistema B o `faltosoId` e opcional no
        // `a_favor` (o motor o deriva da propria partida), e derivar da partida ja
        // e seguro por construcao.
        for (const campo of ORG_PARTICIPANTE_FIELDS[acao] || []) {
          const quem = pl[campo];
          if (quem && quem !== pm.atleta1_id && quem !== pm.atleta2_id) {
            return jsonResponse({ sucesso: false, erro:
              "Este atleta não é um dos dois jogadores desta partida. Confira antes de aplicar o W.O." }, 403);
          }
        }
      } else if (!ORG_MATCH_OPCIONAL.has(acao)) {
        return jsonResponse({ sucesso: false, erro: "matchId é obrigatório" }, 400);
      }
    }
    const bf = ORG_MEMBRO_FIELD[acao];
    // ⚠️ A checagem de MEMBRO nao pode valer para o super-admin NO BH, e isso nao e
    // uma concessao: no BH a participacao E a linha de `atletas` (o roster legado),
    // e existe atleta do BH sem linha em `circuito_atletas`. Exigi-la ali recusaria
    // operacao legitima -- a bateria pegou na hora (o super-admin desarquivando no
    // BH passou a receber 403). Nos circuitos NOVOS, que sao o alvo desta trava,
    // `circuito_atletas` E a unica membership, entao a checagem vale para todos.
    const bhIdEscopo = await bhId();
    if (bf) {
      const aid = pl[bf];
      if (!aid) return jsonResponse({ sucesso: false, erro: "id do atleta é obrigatório" }, 400);
      const { data: mm } = await supabase.from("circuito_atletas").select("atleta_id").eq("circuito_id", circuitoId).eq("atleta_id", aid).maybeSingle();
      let recusar = !mm;
      // ⚠️ NO BH, O PULO ERA CEGO — e o Guardiao de Seguranca mostrou o preco.
      // A excecao existe porque no BH a participacao e a propria linha de
      // `atletas` (roster legado) e ha atleta do BH sem linha em
      // `circuito_atletas`; exigi-la ali recusaria operacao legitima (a bateria
      // pegou na hora quando eu apertei demais em 29/09).
      // Mas eu a escrevi como PULO: super-admin + BH => nao checa nada. Medido por
      // ele em `5bc6703`, com `circuitoId` do BH e `id` de atleta que so participa
      // de OUTRO circuito:
      //   EXCLUIR_ATLETA      -> 200, e o atleta SOME de `atletas`. Com a FK
      //                          `circuito_atletas_atleta_id_fkey` em ON DELETE
      //                          CASCADE, somem os vinculos dele em TODOS os
      //                          circuitos. IRREVERSIVEL.
      //   ARQUIVAR_ATLETA     -> perde o login em todos os circuitos
      //   INSCRICAO_VALIDAR   -> reescreve o rating global
      // O `semIntrusosDeOutroCircuito` fechou o caminho de LEITURA (o pareamento);
      // este e o de ESCRITA, e e o que nao se desfaz.
      //
      // FALLBACK em vez de pulo, que e o que ele propos: no BH, quem tem vinculo
      // com ALGUM circuito e nao tem com o BH NAO e do BH. Quem nao tem vinculo
      // nenhum e roster legado puro e passa.
      // Recusa ZERO operacoes hoje: 15 atletas, 15 vinculos, todos do BH.
      if (!mm && ehSuper && circuitoId === bhIdEscopo) {
        const { data: outros } = await supabase.from("circuito_atletas")
          .select("circuito_id").eq("atleta_id", aid).limit(1);
        recusar = (outros ?? []).length > 0; // tem vinculo com outro circuito => nao e do BH
      }
      if (recusar) {
        return jsonResponse({ sucesso: false, erro: ehSuper
          ? "Este atleta não participa do circuito selecionado. Troque de circuito antes de agir sobre ele."
          : "Atleta não é do seu circuito." }, 403);
      }
    }
  }

  try {
    switch (acao) {
      case "EXCLUIR_ATLETA": {
        const { id } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        // Valida UUID antes de interpolar no filtro `.or(...)` (a `.eq` é parametrizada,
        // mas a string do `.or` não é) — fecha injeção de filtro PostgREST.
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id))) {
          return jsonResponse({ sucesso: false, erro: "id inválido" }, 400);
        }
        const bhExcl = await bhId();
        // BH (legado): o roster É a identidade global -> exclusão global, como sempre.
        if (circuitoId === bhExcl) {
          const { error } = await supabase.from("atletas").delete().eq("id", id);
          if (error) throw error;
          return jsonResponse({ sucesso: true, dados: { escopo: "global" } });
        }
        // Circuito NÃO-BH: apaga SÓ a participação (circuito_atletas). A identidade
        // global (atletas), o rating e a participação em outros circuitos ficam intactos.
        // Guarda: bloqueia se o atleta tiver partidas NESTE circuito (evita partida órfã) —
        // nesse caso o admin deve arquivar, não excluir.
        const { count: nPartidasCirc } = await supabase
          .from("partidas")
          .select("*", { count: "exact", head: true })
          .eq("circuito_id", circuitoId)
          .or(`atleta1_id.eq.${id},atleta2_id.eq.${id}`);
        if ((nPartidasCirc ?? 0) > 0) {
          return jsonResponse({ sucesso: false, erro: "Este atleta tem partidas neste circuito. Arquive em vez de excluir." }, 409);
        }
        const { data: apagadas, error } = await supabase
          .from("circuito_atletas")
          .delete()
          .eq("circuito_id", circuitoId)
          .eq("atleta_id", id)
          .select("atleta_id");
        if (error) throw error;
        if (!apagadas || apagadas.length === 0) {
          return jsonResponse({ sucesso: false, erro: "Atleta não está neste circuito." }, 404);
        }
        return jsonResponse({ sucesso: true, dados: { escopo: "circuito", removidos: apagadas.length } });
      }

      case "INSCRICAO_VALIDAR": {
        const { id, rating, approved, motivo } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        // O rating nao chega em `atletas` num circuito de pontos: quem barra e o
        // `writeAtleta` (guarda unica, "defesa em profundidade"). Nao repetir a
        // regra aqui e deliberado -- ver o comentario la.
        const update = approved
          ? { status: "ativo", rating, rating_inicial: rating, saldo_temp: 0, pendente_circuito: true }
          : { status: "reprovado", motivo_reprovacao: motivo };
        await writeAtleta(circuitoId, id, update);
        // Aprovar num circuito qualquer libera a PORTA DE ENTRADA do app. Reprovar
        // nao a fecha: o atleta pode ser membro de outro circuito. Ver
        // `promoverIdentidadeGlobal`.
        if (approved) await promoverIdentidadeGlobal(String(id));
        return jsonResponse({ sucesso: true });
      }

      case "PROCESSAR_RODADA": {
        const { round } = payload || {};
        if (round === undefined || round === null || typeof round !== "number") {
          return jsonResponse({ sucesso: false, erro: "round é obrigatório" }, 400);
        }

        const sistema = await getSistema(circuitoId); // Fatia 2: ramifica pontuação/ranking do Sistema B

        const { data: partidasRodadaAnterior } = await supabase
          .from("partidas").select("id").eq("circuito_id", circuitoId).eq("rodada", round - 1).eq("validado", true).eq("calculado", false).eq("rejeitado", false);
        const { data: woRodadaAnterior } = await supabase
          .from("partidas").select("id").eq("circuito_id", circuitoId).eq("rodada", round - 1).in("wo_tipo", ["culposo", "a_favor", "justificado"]).eq("calculado", false).eq("rejeitado", false);

        if (round % 2 === 0 && (((partidasRodadaAnterior?.length ?? 0) + (woRodadaAnterior?.length ?? 0)) > 0)) {
          return jsonResponse({ sucesso: false, erro: "A rodada anterior ainda tem resultados sem calcular." }, 409);
        }

        const { data: pendentes, error: errPend } = await supabase
          .from("partidas").select("*").eq("circuito_id", circuitoId).eq("rodada", round).eq("validado", true).eq("calculado", false).eq("rejeitado", false).order("admin_aprovado_em", { ascending: true });
        if (errPend) throw errPend;

        const { data: wosRaw, error: errWo } = await supabase
          .from("partidas").select("*").eq("circuito_id", circuitoId).eq("rodada", round).in("wo_tipo", ["culposo", "a_favor", "justificado"]).eq("calculado", false).eq("rejeitado", false);
        if (errWo) throw errWo;
        const wos = wosRaw || [];
        const listaPend = pendentes || [];
        if (listaPend.length === 0 && wos.length === 0) {
          return jsonResponse({ sucesso: true, dados: { processadas: 0 } });
        }

        const idsAtletas = [...new Set([
          ...listaPend.flatMap((m: any) => [m.atleta1_id, m.atleta2_id]),
          ...wos.flatMap((m: any) => [m.atleta1_id, m.atleta2_id]),
        ])];
        const atletasData = await getAtletasPorIds(circuitoId, idsAtletas);

        const athletesMap: Record<string, any> = {};
        atletasData.forEach(a => { athletesMap[a.id] = { ...a }; });

        const infoPorPartida: Record<string, { favorito_id: string; diferenca_rating_momento: number }> = {};

        for (const match of pendentes) {
          const p1 = athletesMap[match.atleta1_id];
          const p2 = athletesMap[match.atleta2_id];
          if (!p1 || !p2) continue;
          const p1wins = match.placar1 > match.placar2;
          if (sistema === "B") {
            // Sistema B: pontos fixos — vencedor +2, perdedor +1. NAO mexe em rating.
            athletesMap[match.atleta1_id] = {
              ...p1, saldo_temp: (p1.saldo_temp || 0) + (p1wins ? 2 : 1),
              vitorias: (p1.vitorias || 0) + (p1wins ? 1 : 0),
              derrotas: (p1.derrotas || 0) + (p1wins ? 0 : 1),
            };
            athletesMap[match.atleta2_id] = {
              ...p2, saldo_temp: (p2.saldo_temp || 0) + (p1wins ? 1 : 2),
              vitorias: (p2.vitorias || 0) + (p1wins ? 0 : 1),
              derrotas: (p2.derrotas || 0) + (p1wins ? 1 : 0),
            };
            infoPorPartida[match.id] = { favorito_id: null as any, diferenca_rating_momento: null as any };
            continue;
          }
          const favoritoId = p1.rating >= p2.rating ? p1.id : p2.id;
          const diferencaRatingMomento = Math.abs(p1.rating - p2.rating);
          const newR1 = calcElo(p1.rating, p2.rating, p1wins ? 1 : 0);
          const newR2 = calcElo(p2.rating, p1.rating, p1wins ? 0 : 1);
          const delta1 = newR1 - p1.rating, delta2 = newR2 - p2.rating;
          const dataCalculo = match.admin_aprovado_em || new Date().toISOString();

          athletesMap[match.atleta1_id] = {
            ...p1, rating: newR1, saldo_temp: (p1.saldo_temp || 0) + delta1,
            vitorias: (p1.vitorias || 0) + (p1wins ? 1 : 0),
            derrotas: (p1.derrotas || 0) + (p1wins ? 0 : 1),
            rating_pico: Math.max(p1.rating_pico || p1.rating, newR1),
            rating_historico: [...(p1.rating_historico || []), { data: dataCalculo, rating: newR1 }].slice(-30),
          };
          athletesMap[match.atleta2_id] = {
            ...p2, rating: newR2, saldo_temp: (p2.saldo_temp || 0) + delta2,
            vitorias: (p2.vitorias || 0) + (p1wins ? 0 : 1),
            derrotas: (p2.derrotas || 0) + (p1wins ? 1 : 0),
            rating_pico: Math.max(p2.rating_pico || p2.rating, newR2),
            rating_historico: [...(p2.rating_historico || []), { data: dataCalculo, rating: newR2 }].slice(-30),
          };
          infoPorPartida[match.id] = { favorito_id: favoritoId, diferenca_rating_momento: diferencaRatingMomento };
        }

        const idsWoB = new Set<string>();
        for (const w of wos) {
          if (sistema === "B") {
            // Fatia 5 — W.O. no Sistema B: NÃO anula. Adversário +2 (V+1); ausente +1 (justificado)
            // ou +0 (culposo/a_favor), sempre D+1. O wo_culposos já foi contado no APLICAR/RESPONDER.
            const benefB = w.wo_beneficiario_id ? athletesMap[w.wo_beneficiario_id] : null;
            if (benefB) athletesMap[w.wo_beneficiario_id] = { ...benefB, saldo_temp: (benefB.saldo_temp || 0) + 2, vitorias: (benefB.vitorias || 0) + 1 };
            const faltB = w.wo_faltoso_id ? athletesMap[w.wo_faltoso_id] : null;
            if (faltB) {
              const ptsFalt = (w.wo_tipo === "justificado") ? 1 : 0;
              athletesMap[w.wo_faltoso_id] = { ...faltB, saldo_temp: (faltB.saldo_temp || 0) + ptsFalt, derrotas: (faltB.derrotas || 0) + 1 };
            }
            if (w.wo_beneficiario_id) idsWoB.add(w.wo_beneficiario_id);
            if (w.wo_faltoso_id) idsWoB.add(w.wo_faltoso_id);
            continue;
          }
          const dataWo = w.admin_aprovado_em || new Date().toISOString();
          const benef = w.wo_beneficiario_id ? athletesMap[w.wo_beneficiario_id] : null;
          if (benef) {
            const nr = benef.rating + 8;
            athletesMap[w.wo_beneficiario_id] = {
              ...benef, rating: nr, saldo_temp: (benef.saldo_temp || 0) + 8,
              vitorias: (benef.vitorias || 0) + 1,
              rating_pico: Math.max(benef.rating_pico || benef.rating, nr),
              rating_historico: [...(benef.rating_historico || []), { data: dataWo, rating: nr }].slice(-30),
            };
          }
          const falt = (w.wo_tipo === "culposo" && w.wo_faltoso_id) ? athletesMap[w.wo_faltoso_id] : null;
          if (falt) {
            const nr = falt.rating - 15;
            athletesMap[w.wo_faltoso_id] = {
              ...falt, rating: nr, saldo_temp: (falt.saldo_temp || 0) - 15,
              derrotas: (falt.derrotas || 0) + 1,
              rating_historico: [...(falt.rating_historico || []), { data: dataWo, rating: nr }].slice(-30),
            };
          }
        }

        const todosAtivos = await getAtivosNoCircuito(circuitoId, false);
        todosAtivos.forEach(a => { if (!athletesMap[a.id]) athletesMap[a.id] = { ...a }; });

        const { data: partidasTemporada, error: errPartidasTmp } = await supabase.from("partidas").select("atleta1_id,atleta2_id,placar1,placar2,validado,rejeitado,calculado").eq("circuito_id", circuitoId);
        if (errPartidasTmp) throw errPartidasTmp;
        // ⚠️ Aqui a conta compartilhada NAO basta sozinha, e o motivo e de ORDEM: as
        // partidas desta rodada so recebem `calculado: true` no FIM desta mesma acao,
        // depois de o ranking ser montado. Usar so `calculado` deixaria de fora quem
        // esta entrando no ranking AGORA -- justamente o atleta cuja 1a partida e a
        // desta rodada. Por isso o `validado` da rodada corrente entra por cima.
        // (Eu troquei por `idsNoRankingFinal` sozinho em 29/09/2026 e a bateria ficou
        // VERDE com essa regressao: ninguem tinha asserção para a estreia no ranking.
        // Tem agora.)
        const idsComPartida = idsNoRankingFinal(partidasTemporada ?? []);
        (partidasTemporada ?? []).forEach((m: any) => {
          if (!m.validado || m.rejeitado) return;
          if (m.atleta1_id) idsComPartida.add(m.atleta1_id);
          if (m.atleta2_id) idsComPartida.add(m.atleta2_id);
        });
        // Fatia 5: quem pontuou via W.O. no B entra no ranking desta rodada (a partida de W.O. não é "validada").
        if (sistema === "B") idsWoB.forEach(id => idsComPartida.add(id));

        // Fatia 4: bye +1 (ponto de participação) no Sistema B — idempotente por rodada.
        // Idempotência: só na 1ª passada (nenhuma partida da rodada ainda calculada).
        //
        // ⚠️ ESTE COMENTÁRIO DIZIA, ATÉ 30/09/2026: "Trava dupla p/ não premiar
        // entrante tardio: só quando nº de ativos é ímpar E há exatamente 1 fora da
        // rodada". A trava existia; a proteção que ela anunciava, NÃO. Nenhuma das
        // duas condições olha QUANDO a pessoa entrou, então o entrante tardio
        // ganhava o ponto mesmo — e, quando havia um bye de verdade junto com ele,
        // as duas condições REPROVAVAM e ninguém recebia. O Supervisor de
        // Regulamento mediu os dois casos rodando o motor.
        //
        // Comentário que afirma proteção inexistente é pior que comentário nenhum,
        // porque alguém lê para decidir se precisa olhar. Esta onda teve três
        // ocorrências disso, e esta é a terceira. O critério de verdade está escrito
        // dentro do bloco, ao lado da linha que o aplica.
        if (sistema === "B") {
          const { data: partidasDaRodada } = await supabase
            // `criado_em` entrou em 30/09/2026: e o que separa "folgou nesta rodada"
            // de "entrou depois que a rodada foi escalada". Ver o bloco do bye abaixo.
            .from("partidas").select("atleta1_id,atleta2_id,calculado,rejeitado,criado_em")
            .eq("circuito_id", circuitoId).eq("rodada", round);
          const jaProcessadaAntes = (partidasDaRodada ?? []).some((p: any) => p.calculado);
          if (!jaProcessadaAntes) {
            const jogou = new Set<string>();
            (partidasDaRodada ?? []).forEach((p: any) => { if (!p.rejeitado) { jogou.add(p.atleta1_id); jogou.add(p.atleta2_id); } });
            const cfgBye = await getCfg(circuitoId, "financeiro_ativo");
            const ativosBye = await getAtivosNoCircuito(circuitoId, !!cfgBye?.financeiro_ativo);
            // O BYE E DE QUEM ESTAVA NA ESCALA DA RODADA E NAO FOI PAREADO -- nao de
            // "qualquer ativo sem partida". Achado do Supervisor de Regulamento,
            // medido rodando o motor, e ele quebrava a invariante nos DOIS sentidos:
            //
            //  · ENTRANTE TARDIO GANHAVA PONTO. Tres ativos, so a partida A×B existe,
            //    "L" entrou depois e nunca foi escalado -> A=2 B=1 L=1. O Cap. 05 paga
            //    1 ponto de PARTICIPACAO a quem participou da rodada; quem chegou
            //    depois nao participou. Ponto criado do nada.
            //  · E COM BYE DE VERDADE + ENTRANTE TARDIO JUNTOS, `foraDaRodada.length`
            //    virava 2, a guarda recusava, e NINGUEM recebia -- quem realmente
            //    folgou PERDIA o ponto a que tem direito.
            //
            // O criterio: so e candidato ao bye quem ja era membro QUANDO A RODADA FOI
            // ESCALADA. `inscrito_em` do vinculo contra o `criado_em` mais antigo das
            // partidas da rodada. Os dois defeitos caem com o mesmo filtro, porque o
            // entrante tardio deixa de contar dos dois lados.
            //
            // Rodada SEM partida nenhuma nao paga bye: nao ha escala, logo nao ha
            // folga. Fail-closed -- criar ponto e pior que deixar de pagar um, e a
            // situacao nao existe em uso normal.
            const criacoes = (partidasDaRodada ?? []).map((p: any) => p.criado_em).filter(Boolean).sort();
            const escaladaEm = criacoes[0] || null;
            const candidatosBye = (ativosBye || []).filter((a: any) => {
              if (jogou.has(a.id)) return false;
              if (!escaladaEm) return false;
              const entrou = a.inscrito_em || null;
              // Sem `inscrito_em` gravado (linha antiga do BH) o atleta e tratado como
              // membro de sempre: a auditoria conferiu 0 atletas sem vinculo, e recusar
              // aqui tiraria o bye de quem tem direito no circuito que ja roda.
              return !entrou || String(entrou) <= String(escaladaEm);
            });
            // A PARIDADE E DA ESCALA, NAO DO ELENCO. Era `ativosBye.length % 2 === 1`,
            // e isso anularia o conserto acima: com 4 ativos onde 3 foram escalados
            // (2 jogaram, 1 folgou) e 1 entrou depois, o elenco da par, a guarda
            // recusa, e quem folgou perde o ponto -- o mesmo defeito por outra porta.
            // A escala e quem jogou mais quem legitimamente sobrou.
            const escalados = jogou.size + candidatosBye.length;
            if (escalados % 2 === 1 && candidatosBye.length === 1) {
              const byeId = candidatosBye[0].id;
              const b = athletesMap[byeId] || { ...candidatosBye[0] };
              athletesMap[byeId] = { ...b, saldo_temp: (b.saldo_temp || 0) + 1 };
              idsComPartida.add(byeId); // ganhou ponto → entra no ranking desta rodada
            }
          }
        }

        const rankingAtual = Object.values(athletesMap)
          .filter((a: any) => a.status === "ativo" && !a.pendente_circuito && idsComPartida.has(a.id))
          .sort(sistema === "B" ? cmpRankingB(partidasTemporada ?? []) : cmpRankingDB(partidasTemporada ?? []));

        const dataSnapshot = new Date().toISOString();
        rankingAtual.forEach((a: any, i: number) => {
          athletesMap[a.id] = {
            ...athletesMap[a.id],
            posicao_historico: [...(athletesMap[a.id].posicao_historico || []), { data: dataSnapshot, posicao: i + 1 }].slice(-30),
          };
        });

        const idsAlterados = new Set<string>();
        pendentes.forEach(m => { idsAlterados.add(m.atleta1_id); idsAlterados.add(m.atleta2_id); });
        wos.forEach((m: any) => { idsAlterados.add(m.atleta1_id); idsAlterados.add(m.atleta2_id); });
        rankingAtual.forEach((a: any) => idsAlterados.add(a.id));

        for (const id of idsAlterados) {
          const a = athletesMap[id];
          if (sistema === "B") {
            // Sistema B: grava só sazonais de pontos — nunca rating (identidade global).
            await writeAtleta(circuitoId, id, {
              saldo_temp: a.saldo_temp, vitorias: a.vitorias, derrotas: a.derrotas,
              posicao_historico: a.posicao_historico,
            });
          } else {
            await writeAtleta(circuitoId, id, {
              rating: a.rating, saldo_temp: a.saldo_temp, vitorias: a.vitorias, derrotas: a.derrotas,
              rating_pico: a.rating_pico, rating_historico: a.rating_historico,
              posicao_historico: a.posicao_historico,
            });
          }
        }

        for (const m of pendentes) {
          const info = infoPorPartida[m.id];
          const { error } = await supabase.from("partidas").update({
            calculado: true,
            favorito_id: info?.favorito_id ?? null,
            diferenca_rating_momento: info?.diferenca_rating_momento ?? null,
          }).eq("id", m.id);
          if (error) throw error;
        }
        for (const w of wos) {
          const { error } = await supabase.from("partidas").update({ calculado: true }).eq("id", w.id);
          if (error) throw error;
        }

        return jsonResponse({ sucesso: true, dados: { processadas: pendentes.length + wos.length } });
      }

      case "EDITAR_ATLETA": {
        const { id, nome, telefone, apelido, rating, status, pendenteCircuito } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        const upd: Record<string, unknown> = { nome, telefone, apelido: apelido || null, rating, status };
        if (typeof pendenteCircuito === "boolean") upd.pendente_circuito = pendenteCircuito;
        await writeAtleta(circuitoId, id, upd);
        return jsonResponse({ sucesso: true });
      }

      case "INCLUIR_NO_CIRCUITO": {
        const { id } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        if (!(await entradaPermitida(circuitoId))) {
          return jsonResponse({ sucesso: false, erro: "Não há entrada nas duas últimas rodadas da temporada (Cap. 11). Quem for aprovado agora estreia na próxima temporada, desde a primeira rodada." }, 409);
        }
        const cfg = await getCfg(circuitoId, "max_atletas");
        const max = cfg?.max_atletas || 20;
        const nCirc = await countAtivosNoCircuito(circuitoId);
        if (nCirc >= max) {
          return jsonResponse({ sucesso: false, erro: `Circuito cheio (${nCirc}/${max}). Abra uma vaga antes de incluir.` }, 409);
        }
        await writeAtleta(circuitoId, id, { pendente_circuito: false });
        return jsonResponse({ sucesso: true });
      }

      case "RECUSAR_CIRCUITO": {
        const { id } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        const agoraRecusa = new Date().toISOString();
        await writeAtleta(circuitoId, id, { ultima_recusa_circuito_em: agoraRecusa });
        return jsonResponse({ sucesso: true });
      }

      case "ARQUIVAR_ATLETA": {
        const { id } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        await writeAtleta(circuitoId, id, { status: "arquivado", pendente_circuito: false });
        return jsonResponse({ sucesso: true });
      }

      // 0.6.3 — o espelho de ARQUIVAR. Antes disto, arquivar era porta de mao unica:
      // o botao "Reativar" chamava EDITAR_ATLETA, que o organizador nao tem, e ele
      // ficava sem como desfazer.
      // O atleta volta para o BACKLOG: status "ativo" + pendente_circuito true —
      // aprovado, esperando vaga. NAO entra direto no circuito, porque entrar numa
      // rodada ja pareada e decisao de inclusao (INCLUIR_NO_CIRCUITO).
      // CUIDADO: "ativo_backlog" e so rotulo do <select> da tela (src/App.jsx:8633),
      // convertido para este par antes de sair. Gravar a string literal no banco tira
      // o atleta de todas as listas do admin e do promoverBacklog. Pego pelo Guardiao
      // de Seguranca em 27/09/2026, antes de subir.
      case "DESARQUIVAR_ATLETA": {
        const { id } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        const atualDes = await getAtletasPorIds(circuitoId, [String(id)]);
        if (atualDes.length === 0) return jsonResponse({ sucesso: false, erro: "Atleta não encontrado neste circuito." }, 404);
        if (atualDes[0].status !== "arquivado") {
          return jsonResponse({ sucesso: false, erro: "Este atleta não está arquivado." }, 409);
        }
        // LGPD. Duas portas que NAO podem ser reabertas por aqui, apontadas pelo
        // Guardiao de Seguranca em 27/09/2026:
        //  1. quem PEDIU exclusao — ARQUIVAR_ATLETA nao limpa `exclusao_solicitada_em`,
        //     e a fila de pedidos do admin ignora quem esta arquivado (src/App.jsx:9189),
        //     entao o pedido fica invisivel e seria reativado sem ninguem ver.
        //  2. quem JA FOI anonimizado — `anonimizar-atleta` TERMINA a exclusao gravando
        //     status "arquivado" e telefone "removido:<algo>". Reativar traria o registro
        //     morto de volta para a fila de entrada do circuito.
        if (atualDes[0].exclusao_solicitada_em) {
          return jsonResponse({ sucesso: false, erro: "Este atleta pediu a exclusão dos dados. Resolva o pedido antes de reativar." }, 409);
        }
        if (String(atualDes[0].telefone || "").startsWith("removido:")) {
          return jsonResponse({ sucesso: false, erro: "Este cadastro já foi anonimizado e não pode ser reativado." }, 409);
        }
        await writeAtleta(circuitoId, String(id), { status: "ativo", pendente_circuito: true });
        await promoverIdentidadeGlobal(String(id));
        return jsonResponse({ sucesso: true, dados: { status: "ativo", pendenteCircuito: true } });
      }

      case "VALIDATE_RESULT": {
        const { matchId, approved, motivo } = payload || {};
        if (!matchId) return jsonResponse({ sucesso: false, erro: "matchId é obrigatório" }, 400);
        if (typeof approved !== "boolean") return jsonResponse({ sucesso: false, erro: "approved (boolean) é obrigatório" }, 400);

        if (approved) {
          const { data: match, error: errMatch } = await supabase.from("partidas").select("p1_placar1,p1_placar2,p2_placar1,p2_placar2").eq("id", matchId).single();
          if (errMatch) throw errMatch;
          if (!match) return jsonResponse({ sucesso: false, erro: "Partida não encontrada" }, 404);
          const consistente = match.p1_placar1 === match.p2_placar1 && match.p1_placar2 === match.p2_placar2;
          if (!consistente) return jsonResponse({ sucesso: false, erro: "Placares divergentes entre os dois atletas — verifique antes de aprovar." }, 409);
          const now = new Date().toISOString();
          const { error } = await supabase.from("partidas").update({
            placar1: match.p1_placar1, placar2: match.p1_placar2,
            validado: true, validado_por_admin: true, admin_aprovado_em: now, calculado: false,
          }).eq("id", matchId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("partidas").update({ rejeitado: true, motivo_rejeicao: motivo }).eq("id", matchId);
          if (error) throw error;
        }
        return jsonResponse({ sucesso: true });
      }

      case "ADMIN_IMPUTAR_RESULTADO": {
        const { matchId, score1, score2 } = payload || {};
        if (!matchId) return jsonResponse({ sucesso: false, erro: "matchId é obrigatório" }, 400);
        if (typeof score1 !== "number" || typeof score2 !== "number") return jsonResponse({ sucesso: false, erro: "score1 e score2 (números) são obrigatórios" }, 400);
        const now = new Date().toISOString();
        const { error } = await supabase.from("partidas").update({
          placar1: score1, placar2: score2,
          validado: true, validado_por_admin: true, admin_aprovado_em: now, calculado: false, imputado_pelo_admin: true,
        }).eq("id", matchId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "INICIAR_ETAPA": {
        const config = await getCfg(circuitoId, "fase,financeiro_ativo");
        if (config?.fase === "etapa") {
          return jsonResponse({ sucesso: false, erro: "A etapa já está em andamento. Use AVANCAR_RODADA para o próximo par mensal." }, 409);
        }
        await promoverBacklog(circuitoId);

        const ativos = await getAtivosNoCircuito(circuitoId, !!config?.financeiro_ativo);
        if (!ativos || ativos.length < 8) {
          return jsonResponse({ sucesso: false, erro: `Mínimo de 8 atletas ativos para iniciar a etapa (atual: ${ativos?.length ?? 0}).` }, 400);
        }

        const { prazoA, prazoB } = calcularPrazos();
        const bhKeyIni = await bhId();
        const keyId = (circuitoId === bhKeyIni) ? "key_1" : `key_${circuitoId.slice(0, 8)}`;
        await setCfg(circuitoId, { fase: "etapa" });
        // ⚠️ ERA O UNICO `insert` DESTE ARQUIVO SEM `if (error) throw`. Um insert
        // falho respondia `sucesso: true`, o circuito ficava sem chave, e o proximo
        // "avancar rodada" caia na chave do BH (ver o comentario do AVANCAR_RODADA).
        const { error: eChave } = await supabase.from("chaves").insert({ id: keyId, nome: "Chave Única", rodada_atual: 1, circuito_id: circuitoId });
        if (eChave) throw eChave;
        for (const a of ativos) {
          await writeAtleta(circuitoId, a.id, { chave: keyId });
        }
        const sistemaIni = await getSistema(circuitoId); // Fatia 3: pareamento do Sistema B
        const pareamentoIni = sistemaIni === "B" ? ((await getCfg(circuitoId, "pareamento"))?.pareamento || "sorteio") : null;
        const { rodada1, rodada2 } = sistemaIni === "B"
          ? gerarPareamentoB(ativos, [], pareamentoIni, 0, await sementeDaTemporada(circuitoId))
          : gerarPareamentoPorRating(ativos, []);
        for (const pair of rodada1) {
          const mid = `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const { error } = await supabase.from("partidas").insert({ id: mid, chave_id: keyId, rodada: 1, atleta1_id: pair.p1, atleta2_id: pair.p2, prazo: prazoA, circuito_id: circuitoId });
          if (error) throw error;
        }
        for (const pair of rodada2) {
          const mid = `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const { error } = await supabase.from("partidas").insert({ id: mid, chave_id: keyId, rodada: 2, atleta1_id: pair.p1, atleta2_id: pair.p2, prazo: prazoB, circuito_id: circuitoId });
          if (error) throw error;
        }
        return jsonResponse({ sucesso: true, dados: { atletas: ativos.length, partidas: rodada1.length + rodada2.length } });
      }

      case "AVANCAR_RODADA": {
        const { data: todasPartidas, error: errPartidas } = await supabase.from("partidas").select("atleta1_id,atleta2_id,rodada,prazo").eq("circuito_id", circuitoId);
        if (errPartidas) throw errPartidas;
        const roundBase = (todasPartidas ?? []).reduce((max: number, m: any) => Math.max(max, m.rodada || 0), 0);
        const cfgRod = await getCfg(circuitoId, "rodadas_por_temporada,financeiro_ativo");
        const maxRodadas = cfgRod?.rodadas_por_temporada || 6;
        if (roundBase >= maxRodadas) {
          return jsonResponse({ sucesso: false, erro: `A temporada já tem as ${maxRodadas} rodadas configuradas. Inicie uma nova temporada.` }, 409);
        }
        const rA = roundBase + 1, rB = roundBase + 2;
        // A conta do ultimo terco ficava AQUI, em linha, e a mesma conta nasceu de
        // novo no `entradaPermitida()` em 29/09/2026 -- duas contas independentes da
        // mesma regra, que e exatamente o defeito que a `janelaRenovacao` custou um
        // dia para desfazer no outro lado do app (tres contas da janela de renovacao,
        // uma delas invertida, e nada as obrigava a concordar).
        // Agora e UMA: o portao vive dentro do `promoverBacklog`, que e por onde a
        // fila entra, e esta chamada passou a ser incondicional.
        await promoverBacklog(circuitoId);
        const ativos = await getAtivosNoCircuito(circuitoId, !!cfgRod?.financeiro_ativo);
        if (!ativos || ativos.length < 2) {
          return jsonResponse({ sucesso: false, erro: `São necessários ao menos 2 atletas ativos para gerar uma rodada (atual: ${ativos?.length ?? 0}).` }, 400);
        }
        // ⚠️ O `|| "key_1"` QUE ESTAVA AQUI ERA A CHAVE DO BH, e ele reescrevia o BH.
        // Se o circuito nao tivesse linha em `chaves`, tudo o que vem depois --
        // inclusive `chaves.update(...).eq("id", keyId)`, SEM `circuito_id` -- caia no
        // BH. O Guardiao de Seguranca provou rodando o motor: avancar rodada num
        // circuito novo VOLTOU O BH DA RODADA 6 PARA A 2 e carimbou as partidas do
        // circuito novo com a chave do BH.
        // E havia dois caminhos reais para chegar la: (1) clicar "avancar rodada"
        // antes de "iniciar etapa" -- esta acao nao checava a fase; (2) o insert da
        // chave no INICIAR_ETAPA nao checava erro (era o unico insert do arquivo sem
        // `if (error) throw`), entao um insert falho respondia sucesso e deixava o
        // circuito sem chave. (Auditoria de isolamento, 29/09/2026.)
        // Agora: sem chave, RECUSA. Nao ha valor padrao que possa pertencer a outro
        // circuito.
        const { data: chaveAtual } = await supabase.from("chaves").select("id").eq("circuito_id", circuitoId).maybeSingle();
        if (!chaveAtual?.id) {
          return jsonResponse({ sucesso: false, erro: "Este circuito ainda não tem chave — inicie a etapa antes de avançar a rodada." }, 409);
        }
        const keyId = chaveAtual.id;
        const parIndex = Math.floor(rB / 2) - 1;
        const prazoR1Existente = (todasPartidas ?? []).filter((m: any) => m.rodada === 1 && m.prazo).map((m: any) => m.prazo).sort()[0];
        let mesRef: Date | undefined;
        if (prazoR1Existente) {
          const d1 = new Date(prazoR1Existente + "T12:00:00");
          mesRef = new Date(d1.getFullYear(), d1.getMonth() + parIndex, 1);
        }
        const { prazoA, prazoB } = calcularPrazos(mesRef);
        const sistemaAv = await getSistema(circuitoId); // Fatia 3: pareamento do Sistema B
        const pareamentoAv = sistemaAv === "B" ? ((await getCfg(circuitoId, "pareamento"))?.pareamento || "sorteio") : null;
        const { rodada1, rodada2 } = sistemaAv === "B"
          ? gerarPareamentoB(ativos, todasPartidas ?? [], pareamentoAv, roundBase, await sementeDaTemporada(circuitoId))
          : gerarPareamentoPorRating(ativos, todasPartidas ?? []);
        await supabase.from("chaves").update({ rodada_atual: rB }).eq("id", keyId);
        for (const pair of rodada1) {
          const mid = `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const { error } = await supabase.from("partidas").insert({ id: mid, chave_id: keyId, rodada: rA, atleta1_id: pair.p1, atleta2_id: pair.p2, prazo: prazoA, circuito_id: circuitoId });
          if (error) throw error;
        }
        for (const pair of rodada2) {
          const mid = `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const { error } = await supabase.from("partidas").insert({ id: mid, chave_id: keyId, rodada: rB, atleta1_id: pair.p1, atleta2_id: pair.p2, prazo: prazoB, circuito_id: circuitoId });
          if (error) throw error;
        }
        return jsonResponse({ sucesso: true, dados: { rodadas: [rA, rB], partidas: rodada1.length + rodada2.length } });
      }

      case "DESFAZER_VALIDACAO": {
        const { matchId } = payload || {};
        if (!matchId) return jsonResponse({ sucesso: false, erro: "matchId é obrigatório" }, 400);
        const { data: match, error: errMatch } = await supabase.from("partidas").select("calculado").eq("id", matchId).single();
        if (errMatch) throw errMatch;
        if (match?.calculado) return jsonResponse({ sucesso: false, erro: "Não é possível desfazer: o resultado já foi calculado no rating." }, 409);
        const { error } = await supabase.from("partidas").update({
          validado: false, validado_por_admin: false, admin_aprovado_em: null,
          placar1: null, placar2: null, imputado_pelo_admin: false, validado_automatico: false,
        }).eq("id", matchId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "MARCAR_RESULTADO_COMUNICADO": {
        const { matchId, comunicado } = payload || {};
        if (!matchId) return jsonResponse({ sucesso: false, erro: "matchId é obrigatório" }, 400);
        const { error } = await supabase.from("partidas").update({ resultado_comunicado: comunicado }).eq("id", matchId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "REGISTRAR_MENSAGEM_ENVIADA": {
        // Este registro NAO e um log acessorio: e ele que tira a mensagem da
        // fila de pendentes do admin. Ate 08/09/2026 o insert era envolvido num
        // try/catch mudo e a resposta era SEMPRE `sucesso: true` — quando a
        // gravacao falhava, o app achava que tinha registrado e a mensagem
        // reaparecia como pendente sem ninguem entender por que.
        // Regra 6 do CLAUDE.md: nao dizer que fez o que nao fez.
        const { id, athleteId, athleteName, categoria, categoriaLabel, texto, enviadoEm, matchId } = payload || {};
        if (!id || !categoria || !texto) {
          return jsonResponse({ sucesso: false, erro: "id, categoria e texto são obrigatórios para registrar a mensagem." }, 400);
        }
        const { error } = await supabase.from("mensagens_enviadas").insert({
          id, atleta_id: athleteId || null, atleta_nome: athleteName || null,
          categoria, categoria_label: categoriaLabel, texto, enviado_em: enviadoEm, match_id: matchId || null,
          circuito_id: circuitoId,
        });
        if (error) {
          // Id repetido = a mesma mensagem registrada duas vezes (clique duplo,
          // ou a chamada que sobreviveu a saida da pagina chegando junto com a
          // repetida). O efeito desejado ja aconteceu: e sucesso, nao erro.
          if (error.code === "23505") return jsonResponse({ sucesso: true, dados: { jaRegistrada: true } });
          console.error("REGISTRAR_MENSAGEM_ENVIADA falhou:", error.message);
          return jsonResponse({ sucesso: false, erro: "Não deu para registrar a mensagem: " + error.message }, 500);
        }
        return jsonResponse({ sucesso: true });
      }

      case "RESPONDER_WO": {
        const { id, matchId, aprovado, motivoRecusa, justificativa } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        if (typeof aprovado !== "boolean") return jsonResponse({ sucesso: false, erro: "aprovado (boolean) é obrigatório" }, 400);
        const sistemaRw = await getSistema(circuitoId); // Fatia 5: no B, aprovado pontua (não anula)
        const now = new Date().toISOString();
        const { error: errSol } = await supabase.from("solicitacoes_wo").update({
          status: aprovado ? "aprovado" : "recusado", respondido_em: now, motivo_recusa: motivoRecusa || null,
        }).eq("id", id).eq("circuito_id", circuitoId);
        if (errSol) throw errSol;
        if (aprovado) {
          if (!matchId) return jsonResponse({ sucesso: false, erro: "matchId é obrigatório quando aprovado" }, 400);
          if (sistemaRw === "B") {
            // Sistema B: W.O. justificado NÃO anula — pontua ausente 1 / adversário 2. Quem é quem vem da solicitação.
            const { data: sol } = await supabase.from("solicitacoes_wo").select("atleta_id,adversario_id").eq("id", id).single();
            const faltR = sol?.atleta_id || null;
            let benefR = sol?.adversario_id || null;
            if (!benefR && faltR) {
              const { data: mt } = await supabase.from("partidas").select("atleta1_id,atleta2_id").eq("id", matchId).single();
              if (mt) benefR = (mt.atleta1_id === faltR) ? mt.atleta2_id : mt.atleta1_id;
            }
            const { error: eMb } = await supabase.from("partidas").update({
              wo_tipo: "justificado", wo_faltoso_id: faltR, wo_beneficiario_id: benefR, admin_aprovado_em: now, calculado: false,
            }).eq("id", matchId);
            if (eMb) throw eMb;
          } else {
            const { error: errMatch } = await supabase.from("partidas").update({
              // ⚠️ A JUSTIFICATIVA NAO E COPIADA PARA CA. Achado do Guardiao Juridico
              // em 29/09/2026, e e o achado mais grave da rodada: esta linha gravava o
              // TEXTO INTEIRO da justificativa em `partidas.motivo_rejeicao` -- uma
              // coluna que a anonimizacao NUNCA TOCA, numa tabela que sobrevive por
              // projeto, e que entra no `select *` do visitante.
              //
              // A justificativa e texto livre onde o atleta explica por que faltou:
              // dado de saude (art. 5o, II). Eu passei esta onda apagando o atestado do
              // bucket e zerando a `justificativa` em `solicitacoes_wo` -- e havia uma
              // COPIA LITERAL do mesmo texto a uma tabela de distancia.
              //
              // Conferido por mim no banco, os tres fatos juntos:
              //   · `partidas.motivo_rejeicao` tem SELECT para `anon`
              //   · a politica `leitura_publica_partidas` libera qualquer partida de
              //     circuito publico, e o BH e publico
              //   · 5 das 34 partidas JA carregam `W.O. Justificado — <texto>`
              // Ou seja: nao era hipotese. O texto de cinco pessoas reais estava
              // legivel por qualquer visitante do site.
              //
              // O motivo nao precisa do texto: a justificativa vive em
              // `solicitacoes_wo`, que e o lugar dela, e o organizador tem o pedido a
              // mao. Aqui basta o rotulo.
              rejeitado: true, motivo_rejeicao: "W.O. Justificado",
            }).eq("id", matchId);
            if (errMatch) throw errMatch;
          }
          // O Cap. 07 suspende no 2o W.O. INJUSTIFICADO. Se o organizador ja tinha
          // aplicado a falta como culposa e so depois aprovou a justificativa, o
          // atleta ficava suspenso por uma falta que o proprio organizador
          // perdoou: nada devolvia o ponto. A recontagem resolve os dois sistemas
          // de uma vez -- no B a partida vira `justificado`, no A vira `rejeitado`,
          // e nenhum dos dois conta.
          const { data: mWo } = await supabase.from("partidas").select("wo_faltoso_id").eq("id", matchId).maybeSingle();
          const faltouId = mWo?.wo_faltoso_id || null;
          if (faltouId) await recontarWoCulposos(circuitoId, faltouId);
        }
        return jsonResponse({ sucesso: true });
      }

      case "ABRIR_PROXIMA_TEMPORADA": {
        const p = payload || {};
        const cfg = await getCfg(circuitoId, "temporada_numero,temporada_ano");
        const num = cfg?.temporada_numero || 1;
        const ano = cfg?.temporada_ano || new Date().getFullYear();
        const proxNum = num >= 3 ? 1 : num + 1;
        const proxAno = num >= 3 ? ano + 1 : ano;
        const upd: Record<string, unknown> = {
          proxima_aberta: true,
          proxima_nome: (typeof p.nome === "string" && p.nome.trim()) ? p.nome.trim() : null,
          proxima_data_inicio: p.dataInicio || null,
          proxima_rotulo: `${proxNum}/${proxAno}`,
          proxima_valor_cheio: p.valorCheio != null ? Math.max(0, Math.round(Number(p.valorCheio))) : null,
          proxima_valor_desconto: p.valorDesconto != null ? Math.max(0, Math.round(Number(p.valorDesconto))) : null,
        };
        if (p.pixChave !== undefined) upd.pix_chave = (typeof p.pixChave === "string" && p.pixChave.trim()) ? p.pixChave.trim() : null;
        await setCfg(circuitoId, upd);
        return jsonResponse({ sucesso: true, dados: { rotulo: upd.proxima_rotulo } });
      }

      case "CANCELAR_PROXIMA": {
        // ⚠️ ISTO LIMPAVA A CONFIGURACAO E DEIXAVA O FLAG DOS ATLETAS PRESO.
        //
        // `pagamento_proxima_confirmado` ficava `true` para uma temporada que deixou de
        // existir. Na pre-abertura SEGUINTE, esses atletas apareciam como JA PAGOS sem
        // ter pago nada dela -- e o organizador nao tinha como saber, porque o flag nao
        // diz de que temporada ele e. Achado do Supervisor do Admin, junto com o
        // estorno (os dois defeitos sao a mesma raiz: o flag nao sabe a que temporada
        // pertence, e so o `temporada_rotulo` do PAGAMENTO sabe).
        //
        // Zerar o flag NAO apaga o pagamento: as linhas de `pagamentos` ficam, porque a
        // pessoa pagou de verdade. O que se desfaz e a afirmacao "esta em dia com a
        // proxima", que deixou de ter objeto. A resposta diz QUANTOS flags cairam, para
        // o organizador saber quantas devolucoes ou transferencias ele tem para resolver
        // -- isso e dinheiro, e silencio aqui vira prejuizo de alguem.
        const { data: comFlag } = await supabase.from("circuito_atletas")
          .select("atleta_id").eq("circuito_id", circuitoId).eq("pagamento_proxima_confirmado", true);
        const alvos = (comFlag || []).map((r: any) => r.atleta_id).filter(Boolean);
        for (const aId of alvos) {
          await writeAtleta(circuitoId, aId, { pagamento_proxima_confirmado: false });
        }
        const updCancel = {
          proxima_aberta: false, proxima_nome: null, proxima_data_inicio: null, proxima_rotulo: null,
          proxima_valor_cheio: null, proxima_valor_desconto: null,
        };
        await setCfg(circuitoId, updCancel);
        return jsonResponse({ sucesso: true, dados: { pagamentosProximaLimpos: alvos.length } });
      }

      case "NOVA_TEMPORADA": {
        if (circuitoId !== await bhId()) {
          // ── Ramo NÃO-BH: virada de temporada ESCOPADA por circuito_id ──
          // (o ramo do BH abaixo fica INTOCADO — decisão do Juliano). Tudo aqui
          // opera só sobre circuito_atletas/partidas/chaves DESTE circuito.
          const sistemaNova = await getSistema(circuitoId);
          // ⚠️ O `.eq("status", "ativo")` SAIU DAQUI EM 01/10/2026, e a mudança separa
          // DUAS perguntas que eram uma só:
          //   · QUEM RECEBE POSIÇÃO FINAL na temporada que está sendo encerrada?
          //     Só quem está ativo e jogou — isso continua igual, no `rankingNova`.
          //   · DE QUEM OS CONTADORES SAZONAIS ZERAM? TODO MUNDO do circuito.
          //
          // Até aqui a virada varria apenas os ativos, então membro ARQUIVADO ou
          // SUSPENSO atravessava a virada com os pontos, as vitórias e os W.O. da
          // temporada velha intactos. Desarquivado depois, voltava com saldo de uma
          // temporada que já tinha sido encerrada e arquivada — competindo na nova com
          // números da antiga. Achado do Supervisor de Regulamento.
          //
          // Zerar o arquivado é seguro e é o que o Cap. 13 implica: a temporada acabou
          // para o circuito, não para um subconjunto dele. Quem volta, volta do zero,
          // como qualquer outro. O histórico de posições (`historico`) só recebe linha
          // de quem teve posição final, então o arquivado não ganha posição inventada.
          const { data: membrosCa, error: errMembros } = await supabase
            .from("circuito_atletas").select("*, atletas!inner(*)")
            .eq("circuito_id", circuitoId);
          if (errMembros) throw errMembros;
          const membrosNova = (membrosCa || []).map(mergeAtletaCircuito);
          const { data: partidasCirc, error: errPc } = await supabase
            .from("partidas").select("atleta1_id,atleta2_id,placar1,placar2,validado,rejeitado,calculado")
            .eq("circuito_id", circuitoId);
          if (errPc) throw errPc;
          const idsComPartidaN = idsNoRankingFinal(partidasCirc ?? []);
          const cmpNova = sistemaNova === "B" ? cmpRankingB(partidasCirc ?? []) : cmpRankingDB(partidasCirc ?? []);
          // O ranking final segue sendo só de quem estava ATIVO e jogou — o filtro de
          // status mudou de lugar, não desapareceu. Era isto que o `.eq` da consulta
          // garantia junto com o zeramento; agora as duas regras são explícitas e
          // separadas, que é o que permitiu zerar o arquivado sem lhe dar posição.
          const rankingNova = membrosNova.filter((a: any) => a.status === "ativo" && !a.pendente_circuito && idsComPartidaN.has(a.id)).sort(cmpNova);
          const posFinalN: Record<string, number> = {};
          rankingNova.forEach((a: any, i: number) => { posFinalN[a.id] = i + 1; });
          const cfgN = await getCfg(circuitoId, "temporada_numero,temporada_ano,proxima_aberta,proxima_nome,proxima_data_inicio,proxima_rotulo,proxima_valor_cheio,proxima_valor_desconto");
          const numN = cfgN?.temporada_numero || 1;
          const anoN = cfgN?.temporada_ano || new Date().getFullYear();
          const rotuloN = `${numN}/${anoN}`;
          for (const a of membrosNova) {
            const histN = posFinalN[a.id]
              ? [{ temporada: rotuloN, pos: posFinalN[a.id] }, ...(a.historico || [])]
              : (a.historico || []);
            await writeAtleta(circuitoId, a.id, {
              vitorias_total: (a.vitorias_total || 0) + (a.vitorias || 0),
              derrotas_total: (a.derrotas_total || 0) + (a.derrotas || 0),
              saldo_temp: 0, vitorias: 0, derrotas: 0, chave: null,
              wo_culposos_temporada: 0,
              pagamento_confirmado: a.pagamento_proxima_confirmado || false,
              pagamento_proxima_confirmado: false,
              quer_renovar: false, renovacao_em: null,
              historico: histN,
            });
          }
          const { error: errArqN } = await supabase.rpc("arquivar_partidas_temporada_circuito", { p_rotulo: rotuloN, p_circuito: circuitoId });
          if (errArqN) throw errArqN;
          await supabase.from("partidas").delete().eq("circuito_id", circuitoId);
          await supabase.from("chaves").delete().eq("circuito_id", circuitoId);
          const proxNumN = numN >= 3 ? 1 : numN + 1;
          const proxAnoN = numN >= 3 ? anoN + 1 : anoN;
          const updCfgN: Record<string, unknown> = {
            fase: "inscricoes", temporada_numero: proxNumN, temporada_ano: proxAnoN,
            proxima_aberta: false, proxima_nome: null, proxima_data_inicio: null, proxima_rotulo: null,
            proxima_valor_cheio: null, proxima_valor_desconto: null,
            // Temporada nova nasce sem desconto por etapa (12/09/2026). A linha
            // precisa estar AQUI, no ramo não-BH: é onde a regra passa a valer.
            // Sem ela, um circuito cujo admin baixou o percentual carregaria o
            // desconto para a temporada seguinte — a regra se desfazendo sozinha.
            percentual_entrada_meio: 100,
          };
          const pNovaN = payload || {};
          if (cfgN?.proxima_aberta) {
            if (cfgN.proxima_nome) updCfgN.nome_circuito = cfgN.proxima_nome;
            updCfgN.data_inicio_temporada = cfgN.proxima_data_inicio || null;
            if (cfgN.proxima_valor_cheio != null) {
              updCfgN.valor_temporada = cfgN.proxima_valor_cheio;
              updCfgN.desconto_global_pct = (cfgN.proxima_valor_desconto != null && cfgN.proxima_valor_cheio > 0)
                ? Math.max(0, Math.min(100, Math.round((1 - cfgN.proxima_valor_desconto / cfgN.proxima_valor_cheio) * 100)))
                : 0;
            }
          } else {
            if (typeof pNovaN.nome === "string" && pNovaN.nome.trim()) updCfgN.nome_circuito = pNovaN.nome.trim();
            if (pNovaN.dataInicio !== undefined) updCfgN.data_inicio_temporada = pNovaN.dataInicio || null;
          }
          await setCfg(circuitoId, updCfgN);
          return jsonResponse({ sucesso: true, dados: { temporadaNumero: proxNumN, temporadaAno: proxAnoN, arquivadas: rotuloN } });
        }

        // ── Trava: o preço do BH não muda antes do regulamento ──────────────
        // A virada leva `percentual_entrada_meio` a 100 (decisão de 12/09/2026,
        // logo abaixo). Mas a v03-12, que é o que o circuito DECLARA hoje, promete
        // 80% a quem entra na 2ª etapa. Virar sem trocar a versão faria o circuito
        // cobrar um valor que o próprio regulamento dele nega.
        //
        // Precisão que um guardião cobrou e é justa: os atletas do BH não
        // aceitaram a v03-12 — estão registrados em v03-3, v03-5, v03-8 e v03-11.
        // Esta guarda lê o que o CIRCUITO declara, não o que cada titular
        // consentiu. Ela garante a ORDEM (regulamento antes do preço); ela NÃO
        // cria o consentimento. Isso é o 0.10.11, e é outro problema.
        //
        // A versão NÃO pode ser carimbada junto com o resto do update: a tabela
        // antiga `configuracao` (a do BH) não tem a coluna `regulamento_versao` —
        // só `circuitos` tem. Um update com ela lançaria erro, e este trecho roda
        // DEPOIS de arquivar e apagar as partidas: a temporada morreria sem volta.
        //
        // Por isso a guarda é aqui, ANTES de qualquer destruição, e só lê.
        {
          const { data: circBh, error: errVerBh } = await supabase
            .from("circuitos").select("regulamento_versao").eq("id", circuitoId).maybeSingle();
          if (errVerBh) throw errVerBh;
          // `trim` porque o carimbo é digitado à mão e um espaço sobrando não é
          // decisão de ninguém. Maiúscula NÃO é normalizada de propósito: "V03-13"
          // é typo, e typo tem de barrar.
          const versaoBh = String(circBh?.regulamento_versao ?? "").trim();
          if (!VERSOES_SEM_DESCONTO_ETAPA.has(versaoBh)) {
            return jsonResponse({
              sucesso: false,
              erro: "O Circuito BH declara o regulamento " + (versaoBh || "(nenhum)") +
                ", que não está na lista de versões sem desconto por etapa. A virada passaria a " +
                "cobrar 100% de quem o regulamento declarado manda cobrar 80%. " +
                "Avise os atletas e carimbe a v03-13 no circuito antes de virar a temporada.",
            }, 409);
          }
        }
        const { data: ativos, error: errAtivos } = await supabase.from("atletas").select("*").eq("status", "ativo");
        if (errAtivos) throw errAtivos;
        const { data: config, error: errConfigGet } = await supabase.from("configuracao").select("temporada_numero,temporada_ano,proxima_aberta,proxima_nome,proxima_data_inicio,proxima_rotulo,proxima_valor_cheio,proxima_valor_desconto").eq("id", 1).single();
        if (errConfigGet) throw errConfigGet;
        const temporadaNumero = config?.temporada_numero || 1;
        const temporadaAno = config?.temporada_ano || new Date().getFullYear();
        const rotuloTemporada = `${temporadaNumero}/${temporadaAno}`;
        // Escopado por circuito_id: o ranking final do BH usa só as partidas do BH
        // (evita contar um jogo de um atleta do BH em outro circuito).
        const { data: partidasTemporada, error: errPartidasTmp } = await supabase.from("partidas").select("atleta1_id,atleta2_id,placar1,placar2,validado,rejeitado,calculado").eq("circuito_id", circuitoId);
        if (errPartidasTmp) throw errPartidasTmp;
        const idsComPartida = idsNoRankingFinal(partidasTemporada ?? []);
        const rankingFinal = (ativos ?? []).filter((a: any) => !a.pendente_circuito && idsComPartida.has(a.id)).sort(cmpRankingDB(partidasTemporada ?? []));
        const posicaoFinal: Record<string, number> = {};
        rankingFinal.forEach((a: any, i: number) => { posicaoFinal[a.id] = i + 1; });
        for (const a of ativos ?? []) {
          const historicoAtualizado = posicaoFinal[a.id]
            ? [{ temporada: rotuloTemporada, pos: posicaoFinal[a.id] }, ...(a.historico || [])]
            : (a.historico || []);
          const updNova: Record<string, unknown> = {
            vitorias_total: (a.vitorias_total || 0) + (a.vitorias || 0),
            derrotas_total: (a.derrotas_total || 0) + (a.derrotas || 0),
            saldo_temp: 0, vitorias: 0, derrotas: 0, chave: null,
            wo_culposos_temporada: 0,
            pagamento_confirmado: a.pagamento_proxima_confirmado || false,
            pagamento_proxima_confirmado: false,
            quer_renovar: false, renovacao_em: null,
            historico: historicoAtualizado,
          };
          await writeAtleta(circuitoId, a.id, updNova);
        }
        // Escopado por circuito_id (no ramo do BH, circuitoId === bhId). Resultado idêntico
        // pro BH (todas as suas partidas/chaves têm circuito_id=BH), mas nunca toca outro circuito.
        const { error: errArq } = await supabase.rpc("arquivar_partidas_temporada_circuito", { p_rotulo: rotuloTemporada, p_circuito: circuitoId });
        if (errArq) throw errArq;
        await supabase.from("partidas").delete().eq("circuito_id", circuitoId);
        await supabase.from("chaves").delete().eq("circuito_id", circuitoId);
        const proximoNumero = temporadaNumero >= 3 ? 1 : temporadaNumero + 1;
        const proximoAno = temporadaNumero >= 3 ? temporadaAno + 1 : temporadaAno;
        const updConfig: Record<string, unknown> = {
          fase: "inscricoes", temporada_numero: proximoNumero, temporada_ano: proximoAno,
          proxima_aberta: false, proxima_nome: null, proxima_data_inicio: null, proxima_rotulo: null,
          proxima_valor_cheio: null, proxima_valor_desconto: null,
          // Temporada NOVA nasce sem desconto por etapa de entrada (12/09/2026).
          // Sem esta linha a regra se desfaria sozinha na 1ª virada: o circuito
          // nasceria com 100 e voltaria ao 80 herdado da temporada anterior.
          percentual_entrada_meio: 100,
        };
        const pNova = payload || {};
        if (config?.proxima_aberta) {
          if (config.proxima_nome) updConfig.nome_circuito = config.proxima_nome;
          updConfig.data_inicio_temporada = config.proxima_data_inicio || null;
          // Carrega o valor anunciado da próxima como valor oficial da nova temporada:
          // valor cheio -> valor_temporada, e o % de desconto de renovação -> desconto global.
          if (config.proxima_valor_cheio != null) {
            updConfig.valor_temporada = config.proxima_valor_cheio;
            updConfig.desconto_global_pct = (config.proxima_valor_desconto != null && config.proxima_valor_cheio > 0)
              ? Math.max(0, Math.min(100, Math.round((1 - config.proxima_valor_desconto / config.proxima_valor_cheio) * 100)))
              : 0;
          }
        } else {
          if (typeof pNova.nome === "string" && pNova.nome.trim()) updConfig.nome_circuito = pNova.nome.trim();
          if (pNova.dataInicio !== undefined) updConfig.data_inicio_temporada = pNova.dataInicio || null;
        }
        const { error: errConfig } = await supabase.from("configuracao").update(updConfig).eq("id", 1);
        if (errConfig) throw errConfig;
        await mirrorConfig(circuitoId, updConfig);
        return jsonResponse({ sucesso: true, dados: { temporadaNumero: proximoNumero, temporadaAno: proximoAno, arquivadas: rotuloTemporada } });
      }

      case "APLICAR_WO": {
        const { matchId, tipo, faltosoId, beneficiarioId } = payload || {};
        if (!matchId) return jsonResponse({ sucesso: false, erro: "matchId é obrigatório" }, 400);
        if (!["justificado", "culposo", "a_favor"].includes(tipo)) return jsonResponse({ sucesso: false, erro: "tipo deve ser 'justificado', 'culposo' ou 'a_favor'" }, 400);
        // Quem estava marcado como faltoso ANTES desta chamada. Sem isto a
        // recontagem e idempotente POR ATLETA, mas nao POR PARTIDA: o organizador
        // corrigindo quem faltou deixava a falta lancada para os DOIS, e o Cap. 07
        // suspende com duas. Achado do Guardiao de Regulamento em 29/09/2026,
        // medido: F=1 e V=1 depois de um W.O. so.
        const { data: woAntes } = await supabase.from("partidas").select("wo_faltoso_id").eq("id", matchId).maybeSingle();
        const faltosoAnterior = woAntes?.wo_faltoso_id || null;
        const recontarEnvolvidos = async (novoFaltoso: string | null) => {
          const alvos = new Set<string>();
          if (faltosoAnterior) alvos.add(faltosoAnterior);
          if (novoFaltoso) alvos.add(novoFaltoso);
          for (const id of alvos) await recontarWoCulposos(circuitoId, id);
        };
        // Sistema B (Fatia 5): W.O. NÃO anula — vira pontos no processamento (adversário +2; ausente +1 justificado / 0 injustificado).
        if ((await getSistema(circuitoId)) === "B") {
          if (!beneficiarioId) return jsonResponse({ sucesso: false, erro: "beneficiarioId é obrigatório" }, 400);
          let faltIdB = faltosoId || null;
          if ((tipo === "culposo" || tipo === "justificado") && !faltIdB) return jsonResponse({ sucesso: false, erro: "faltosoId é obrigatório" }, 400);
          if (tipo === "a_favor" && !faltIdB) {
            const { data: mt } = await supabase.from("partidas").select("atleta1_id,atleta2_id").eq("id", matchId).single();
            if (mt) faltIdB = (mt.atleta1_id === beneficiarioId) ? mt.atleta2_id : mt.atleta1_id;
          }
          const nowB = new Date().toISOString();
          const { error: eWoB } = await supabase.from("partidas").update({
            wo_tipo: tipo, wo_faltoso_id: faltIdB, wo_beneficiario_id: beneficiarioId,
            admin_aprovado_em: nowB, calculado: false,
          }).eq("id", matchId);
          if (eWoB) throw eWoB;
          // culposo e a_favor contam como W.O. injustificado (suspensão + desempate); justificado não conta.
          await recontarEnvolvidos(faltIdB);
          return jsonResponse({ sucesso: true });
        }
        if (tipo === "justificado") {
          const { error } = await supabase.from("partidas").update({ rejeitado: true, motivo_rejeicao: "W.O. Justificado" }).eq("id", matchId);
          if (error) throw error;
          // ⚠️ ESTE `return` SAIA ANTES DE RECONTAR (ate 29/09/2026). No Sistema A,
          // trocar um W.O. de culposo para justificado NAO devolvia o ponto: o
          // atleta ficava a uma falta da suspensao do Cap. 07 por uma falta que o
          // proprio organizador perdoou. O comentario do `RESPONDER_WO` afirmava
          // "resolve os dois sistemas de uma vez" -- resolvia UM. Conserto de
          // instrumento e conserto de UM caminho (licao de 28/09).
          // A partida agora esta `rejeitado: true`, entao a recontagem a ignora.
          await recontarEnvolvidos(null);
          return jsonResponse({ sucesso: true });
        }
        if (!beneficiarioId) return jsonResponse({ sucesso: false, erro: "beneficiarioId é obrigatório" }, 400);
        if (tipo === "culposo" && !faltosoId) return jsonResponse({ sucesso: false, erro: "faltosoId é obrigatório no culposo" }, 400);
        const now = new Date().toISOString();
        const { error } = await supabase.from("partidas").update({
          wo_tipo: tipo, wo_faltoso_id: tipo === "culposo" ? faltosoId : null, wo_beneficiario_id: beneficiarioId,
          admin_aprovado_em: now, calculado: false,
        }).eq("id", matchId);
        if (error) throw error;
        await recontarEnvolvidos(tipo === "culposo" ? (faltosoId || null) : null);
        return jsonResponse({ sucesso: true });
      }

      case "MARCAR_WO_NOTIFICADO": {
        const { id, quem } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        if (quem !== "solicitante" && quem !== "adversario") return jsonResponse({ sucesso: false, erro: "quem deve ser 'solicitante' ou 'adversario'" }, 400);
        const campo = quem === "solicitante" ? "notificado_solicitante" : "notificado_adversario";
        const { error } = await supabase.from("solicitacoes_wo").update({ [campo]: true }).eq("id", id).eq("circuito_id", circuitoId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      // ── LER_JUSTIFICATIVA_WO — o unico caminho AUTENTICADO para o dado de saude ──
      //
      // Existe desde 01/10/2026, e e a metade do conserto que o app precisava antes
      // de a permissao fechar.
      //
      // O problema: a `justificativa` de um W.O. e texto livre onde o atleta explica
      // por que nao vai jogar -- dado de SAUDE (art. 5o, II da LGPD). A tabela
      // `solicitacoes_wo` tem SELECT para `anon`, e o app lia a tabela SEM nomear
      // coluna nenhuma, entao o PostgREST devolvia tudo. Resultado: o texto de cinco
      // pessoas reais ficou legivel por qualquer visitante do site. O texto ja foi
      // saneado do banco em 30/09; o que falta e fechar a PORTA.
      //
      // Nao da para fechar so a permissao: a leitura do app pede todas as colunas, e
      // tirar o acesso a uma faria a leitura INTEIRA falhar com erro de permissao --
      // a mesma armadilha que derrubou o app em 07/09. E o organizador PRECISA do
      // texto: e com ele que decide aprovar ou recusar o W.O.
      //
      // Entao o caminho e este: o organizador pede o texto por aqui, autenticado e
      // escopado no circuito dele, UMA solicitacao por vez. O `anon` deixa de ter
      // como pedir, porque o app para de pedir no `select` aberto.
      //
      // ⚠️ ORDEM DE SUBIDA: motor PRIMEIRO (passa a oferecer), app DEPOIS (passa a
      // usar e para de pedir pelo caminho aberto), e a MIGRACAO POR ULTIMO -- so
      // quando nada mais depender do acesso aberto. Fechar antes derruba o app.
      case "LER_JUSTIFICATIVA_WO": {
        const { id } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        // O `.eq("circuito_id", circuitoId)` e o escopo: organizador de um circuito
        // nao le a justificativa de outro. Mesmo padrao do RESPONDER_WO.
        const { data: sol, error: eSol } = await supabase.from("solicitacoes_wo")
          .select("id,justificativa,comprovante_url,status")
          .eq("id", id).eq("circuito_id", circuitoId).maybeSingle();
        if (eSol) throw eSol;
        if (!sol) return jsonResponse({ sucesso: false, erro: "Solicitação não é deste circuito." }, 403);
        return jsonResponse({ sucesso: true, dados: {
          justificativa: sol.justificativa ?? "",
          comprovanteUrl: sol.comprovante_url ?? null,
        } });
      }

      case "DEFINIR_RODADAS": {
        // Fixo em 6 rodadas por temporada (Cap. 13). A escolha foi removida do app.
        return jsonResponse({ sucesso: false, erro: "As rodadas são fixas em 6 por temporada." }, 400);
      }

      case "DEFINIR_AUTO_VALIDAR": {
        const { ligado } = payload || {};
        if (typeof ligado !== "boolean") return jsonResponse({ sucesso: false, erro: "ligado (boolean) é obrigatório" }, 400);
        await setCfg(circuitoId, { auto_validar_placar: ligado });
        return jsonResponse({ sucesso: true });
      }

      // Liga/desliga as inscrições do circuito. A coluna `inscricoes_abertas` vive SÓ em
      // `circuitos` (inclusive pro BH), então grava direto lá — nunca via setCfg/configuracao.
      case "DEFINIR_INSCRICOES_ABERTAS": {
        const { abertas } = payload || {};
        if (typeof abertas !== "boolean") return jsonResponse({ sucesso: false, erro: "abertas (boolean) é obrigatório" }, 400);
        const { error } = await supabase.from("circuitos").update({ inscricoes_abertas: abertas }).eq("id", circuitoId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      // Visibilidade pro visitante (público/privado). Só muda a leitura (RLS + porteiro),
      // nunca toca em jogos/rating. O BH é sempre público — não pode virar privado.
      case "DEFINIR_PUBLICO": {
        const { publico } = payload || {};
        if (typeof publico !== "boolean") return jsonResponse({ sucesso: false, erro: "publico (boolean) é obrigatório" }, 400);
        const bhPub = await bhId();
        if (circuitoId === bhPub && publico === false) return jsonResponse({ sucesso: false, erro: "O circuito de BH é sempre público." }, 400);
        const { error } = await supabase.from("circuitos").update({ publico }).eq("id", circuitoId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      // Financeiro por circuito: liga/desliga se o ORGANIZADOR vê e gere o financeiro do
      // circuito dele. Só super-admin (fora da ACOES_ORG). BH não tem organizador terceiro.
      case "DEFINIR_ORG_VE_FINANCEIRO": {
        const bhFin = await bhId();
        if (circuitoId === bhFin) return jsonResponse({ sucesso: false, erro: "O BH não tem organizador terceiro." }, 400);
        const { ver } = payload || {};
        if (typeof ver !== "boolean") return jsonResponse({ sucesso: false, erro: "ver (boolean) é obrigatório" }, 400);
        const { error } = await supabase.from("circuitos").update({ org_ve_financeiro: ver }).eq("id", circuitoId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      // ── Monetização Fatia 3 (só super-admin; fora da ACOES_ORG → organizador barrado) ──
      // Config da COBRANÇA DA PLATAFORMA de um circuito VENDIDO (Caso 2). O BH (Caso 1,
      // circuito próprio) não tem essa cobrança. Só grava config — NÃO cobra nada ainda.
      case "LER_COBRANCA_PLATAFORMA": {
        // 0.6.13 — coerência com DEFINIR_COBRANCA_PLATAFORMA: o BH é circuito próprio
        // (Caso 1) e nao tem cobranca de plataforma. Antes so a irma que escreve recusava.
        const bhLerCob = await bhId();
        if (circuitoId === bhLerCob) return jsonResponse({ sucesso: false, erro: "O BH é circuito próprio — não tem cobrança de plataforma." }, 400);
        // Config de cobrança vive em `circuito_cobranca` (tabela PRIVADA, sem anon) — não
        // em `circuitos` (que o app lê com SELECT * pelo anon). O valor da temporada fica em circuitos.
        const { data: circ, error: eC } = await supabase.from("circuitos").select("id,valor_temporada").eq("id", circuitoId).maybeSingle();
        if (eC) throw eC;
        if (!circ) return jsonResponse({ sucesso: false, erro: "Circuito não encontrado." }, 404);
        const { data: cob } = await supabase.from("circuito_cobranca")
          .select("cobranca_plataforma_ativa,taxa_plataforma_temporada_cent,taxa_plataforma_por_atleta_tipo,taxa_plataforma_por_atleta_valor")
          .eq("circuito_id", circuitoId).maybeSingle();
        return jsonResponse({ sucesso: true, dados: {
          cobranca_plataforma_ativa: cob?.cobranca_plataforma_ativa ?? false,
          taxa_plataforma_temporada_cent: cob?.taxa_plataforma_temporada_cent ?? null,
          taxa_plataforma_por_atleta_tipo: cob?.taxa_plataforma_por_atleta_tipo ?? null,
          taxa_plataforma_por_atleta_valor: cob?.taxa_plataforma_por_atleta_valor ?? null,
          valor_temporada: circ.valor_temporada,
        } });
      }

      case "DEFINIR_COBRANCA_PLATAFORMA": {
        const bhCob = await bhId();
        if (circuitoId === bhCob) return jsonResponse({ sucesso: false, erro: "O BH é circuito próprio — não tem cobrança de plataforma." }, 400);
        const { ativa, fixoTemporadaCent, porAtletaTipo, porAtletaValor } = payload || {};
        if (typeof ativa !== "boolean") return jsonResponse({ sucesso: false, erro: "ativa (boolean) é obrigatório" }, 400);
        const fixo = (fixoTemporadaCent === null || fixoTemporadaCent === undefined || fixoTemporadaCent === "") ? null : Math.floor(Number(fixoTemporadaCent));
        if (fixo !== null && (!Number.isFinite(fixo) || fixo < 0)) return jsonResponse({ sucesso: false, erro: "Taxa fixa inválida." }, 400);
        const tipo = (porAtletaTipo === "fixo" || porAtletaTipo === "pct") ? porAtletaTipo : null;
        const valorRaw = (porAtletaValor === null || porAtletaValor === undefined || porAtletaValor === "") ? null : Math.floor(Number(porAtletaValor));
        if (valorRaw !== null && (!Number.isFinite(valorRaw) || valorRaw < 0)) return jsonResponse({ sucesso: false, erro: "Valor por atleta inválido." }, 400);
        // Coerência: valor por atleta só vale com tipo; sem tipo, zera o valor (e vice-versa).
        const valor = tipo === null ? null : valorRaw;
        const { data: circCob } = await supabase.from("circuitos").select("id").eq("id", circuitoId).maybeSingle();
        if (!circCob) return jsonResponse({ sucesso: false, erro: "Circuito não encontrado." }, 404);
        const updCob = {
          circuito_id: circuitoId,
          cobranca_plataforma_ativa: ativa,
          taxa_plataforma_temporada_cent: fixo,
          taxa_plataforma_por_atleta_tipo: valor === null ? null : tipo,
          taxa_plataforma_por_atleta_valor: valor,
          atualizado_em: new Date().toISOString(),
        };
        const { error } = await supabase.from("circuito_cobranca").upsert(updCob, { onConflict: "circuito_id" });
        if (error) throw error;
        return jsonResponse({ sucesso: true, dados: updCob });
      }

      // Guarda o handle (credId) da biometria do ADMIN (protegido pelo PIN, ja checado
      // no topo do handler). NAO e' segredo. Permite recuperar a biometria do admin
      // depois que o navegador limpa o localStorage. Config global (admin unico).
      case "SALVAR_ADMIN_BIO_CRED": {
        const { credId } = payload || {};
        if (!credId || typeof credId !== "string") return jsonResponse({ sucesso: false, erro: "credId é obrigatório" }, 400);
        const { data: cfg, error: eSel } = await supabase.from("configuracao").select("admin_bio_cred_ids").eq("id", 1).single();
        if (eSel) throw eSel;
        const atual = Array.isArray(cfg?.admin_bio_cred_ids) ? (cfg!.admin_bio_cred_ids as string[]) : [];
        if (!atual.includes(credId)) {
          const novo = [...atual, credId].slice(-5); // no maximo 5 aparelhos
          const { error: eUpd } = await supabase.from("configuracao").update({ admin_bio_cred_ids: novo }).eq("id", 1);
          if (eUpd) throw eUpd;
        }
        return jsonResponse({ sucesso: true });
      }

      // Cria um NOVO circuito (plataforma multi-circuito, Fase A1). Protegido pelo PIN
      // (super-admin). NAO toca no BH nem em nenhum circuito existente: e' um INSERT puro
      // em `circuitos` com defaults saos espelhando o BH. Reversivel por DELETE.
      // O `sistema` (A=rating / B=pontos) TRAVA na criacao e nunca muda (dados incompativeis).
      case "CRIAR_CIRCUITO": {
        const p = payload || {};
        const nome = String(p.nome || "").trim();
        const slug = String(p.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
        const cidade = p.cidade ? String(p.cidade).trim() : null;
        const uf = p.uf ? String(p.uf).trim().toUpperCase().slice(0, 2) : null;
        const sistema = (p.sistema === "A" || p.sistema === "B") ? p.sistema : null;
        const pareamento = (p.pareamento === "sorteio" || p.pareamento === "grupos") ? p.pareamento : null;
        // Teto 20, mínimo 8 (decisão do Juliano, 10/09/2026). O 8 não é arbitrário:
        // é o número abaixo do qual o pareamento passa a REPETIR confrontos dentro da
        // mesma temporada de 6 rodadas — por isso o Cap. 13 exige 8 ativos para abrir.
        // Antes não havia limite SUPERIOR aqui (dava para criar um circuito com 100) e
        // a edição usava outro mínimo (2). Agora os dois pontos usam a mesma regra.
        // TETO FIXO EM 20, decisao do Juliano de 29/09/2026 confirmando a de
        // 10/09: o teto e regra da PLATAFORMA, nao configuracao de circuito. O
        // `p.maxAtletas` e' IGNORADO de proposito -- se um dia alguem montar a
        // chamada com outro valor, o circuito nasce com 20 mesmo assim, e nao com
        // um numero que o regulamento nao promete. O 8 do Cap. 13 continua sendo
        // o MINIMO PARA COMECAR a temporada, que e' outra regra e vive no motor
        // da virada, nao aqui.
        const maxAtletas = 20;
        const rodadas = 6; // Fixo em 6 rodadas por temporada (Cap. 13).

        if (!nome) return jsonResponse({ sucesso: false, erro: "Nome do circuito é obrigatório." }, 400);
        if (slug.length < 2) return jsonResponse({ sucesso: false, erro: "Slug inválido — use ao menos 2 caracteres (letras, números ou hífen)." }, 400);
        if (slug === "bh") return jsonResponse({ sucesso: false, erro: "O slug 'bh' é reservado ao circuito de Belo Horizonte." }, 400);
        if (!sistema) return jsonResponse({ sucesso: false, erro: "Escolha o sistema do circuito (A — rating, ou B — pontos)." }, 400);
        if (sistema === "B" && !pareamento) return jsonResponse({ sucesso: false, erro: "No Sistema B, escolha o método de pareamento (sorteio ou grupos)." }, 400);

        const { data: jaExiste, error: eSel } = await supabase.from("circuitos").select("id").eq("slug", slug).maybeSingle();
        if (eSel) throw eSel;
        if (jaExiste) return jsonResponse({ sucesso: false, erro: `Já existe um circuito com o slug '${slug}'. Escolha outro.` }, 409);

        const novo = {
          slug,
          nome_circuito: nome,
          cidade,
          uf,
          sistema,
          pareamento: sistema === "B" ? pareamento : null,
          fase: "inscricoes",
          temporada_numero: 1,
          temporada_ano: new Date().getFullYear(),
          rodadas_por_temporada: rodadas,
          auto_validar_placar: false,
          financeiro_ativo: false,
          max_atletas: maxAtletas,
          desconto_global_pct: 0,
          percentual_entrada_meio: 100, // mesmo valor em qualquer etapa (12/09/2026); desconto é ato do admin, via DEFINIR_DESCONTO_ATLETA
          ativo: true,
          // Circuito de rating NOVO nasce com `vA-nc-01`, não com o v03-12 do BH.
          // A diferença é o Cap. 10, o Torneio Presencial de Encerramento: ele é
          // do BH, e o app passou a NÃO exibi-lo para outras versões (10/09/2026).
          // Carimbar v03-12 aqui faria o circuito novo herdar, e o atleta aceitar,
          // a regra de um torneio que o circuito dele não tem. O BH não é tocado:
          // esta linha só roda em CRIAR_CIRCUITO, e o BH já existe.
          regulamento_versao: sistema === "A" ? "vA-nc-01" : "vB-01",
          inscricoes_abertas: false,
        };
        // `regulamento_versao` e `max_atletas` entraram no select em 28/09/2026
        // (ROADMAP 0.10.7): o admin criava um circuito e nao ficava sabendo sob qual
        // regulamento ele nasceu. Nao e detalhe -- e o texto que TODO atleta daquele
        // circuito vai aceitar, e um circuito de rating NOVO nasce sem o Torneio de
        // Encerramento, diferenca que so aparece no documento. A tela de confirmacao
        // passa a mostrar o que o SERVIDOR gravou, nao o que ela mandou.
        const { data: ins, error } = await supabase.from("circuitos").insert(novo)
          .select("id, slug, nome_circuito, sistema, pareamento, regulamento_versao, max_atletas").single();
        if (error) {
          const msg = String(error.message || "");
          if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("circuitos_slug_key")) {
            return jsonResponse({ sucesso: false, erro: `Já existe um circuito com o slug '${slug}'. Escolha outro.` }, 409);
          }
          throw error;
        }
        return jsonResponse({ sucesso: true, dados: ins });
      }

      case "DEFINIR_CONFIG_CIRCUITO": {
        const p = payload || {};
        const upd: Record<string, unknown> = {};
        if (typeof p.nome === "string") upd.nome_circuito = p.nome.trim() || "Clube do Tênis de Mesa";
        if (p.dataInicio !== undefined) upd.data_inicio_temporada = p.dataInicio || null;
        // `maxAtletas` NAO e' mais aceito aqui (29/09/2026, decisao do Juliano).
        // O teto e regra da plataforma -- 20 para todos --, entao a configuracao
        // do circuito nao o escreve, nem a de um organizador. O campo estava nesta
        // acao desde antes, e a tela chegou a oferece-lo na fatia 0.10.9, que foi
        // desfeita antes de subir. Se voltar um dia, volta como decisao de
        // plataforma, nao de circuito.
        if (p.pixChave !== undefined) upd.pix_chave = (typeof p.pixChave === "string" && p.pixChave.trim()) ? p.pixChave.trim() : null;
        if (Object.keys(upd).length === 0) return jsonResponse({ sucesso: false, erro: "Nada para atualizar." }, 400);
        await setCfg(circuitoId, upd);
        return jsonResponse({ sucesso: true });
      }

      case "DEFINIR_FINANCEIRO": {
        const p = payload || {};
        const upd: Record<string, unknown> = {};
        if (typeof p.ativo === "boolean") upd.financeiro_ativo = p.ativo;
        if (p.valorTemporada !== undefined) upd.valor_temporada = (p.valorTemporada === null ? null : Math.max(0, Math.round(Number(p.valorTemporada))));
        if (p.descontoGlobalPct !== undefined) upd.desconto_global_pct = Math.min(100, Math.max(0, Math.round(Number(p.descontoGlobalPct) || 0)));
        // Campo vazio NÃO é decisão do admin — então o motor não inventa uma:
        // não escreve a coluna. O `|| 80` original transformava vazio em 80, o que
        // concedia um desconto que ninguém pediu. Trocar por `|| 100` (1ª tentativa
        // deste pacote) não consertou, só mudou a vítima: passou a gravar 100 na
        // temporada em curso do BH, cujo regulamento declarado promete 80% — e
        // engolia também o 0 deliberado (entrada grátis), subindo o preço para 100.
        // Achado por dois guardiões em 13/09/2026. Regra: vazio/inválido não grava;
        // número válido grava o que foi digitado, 0 inclusive.
        if (p.percentualMeio !== undefined) {
          const cru = p.percentualMeio;
          const n = (cru === null || cru === "") ? NaN : Number(cru);
          if (Number.isFinite(n)) upd.percentual_entrada_meio = Math.min(100, Math.max(0, Math.round(n)));
        }
        if (p.proximaValorCheio !== undefined) upd.proxima_valor_cheio = (p.proximaValorCheio === null ? null : Math.max(0, Math.round(Number(p.proximaValorCheio))));
        if (p.proximaValorDesconto !== undefined) upd.proxima_valor_desconto = (p.proximaValorDesconto === null ? null : Math.max(0, Math.round(Number(p.proximaValorDesconto))));
        if (Object.keys(upd).length === 0) return jsonResponse({ sucesso: false, erro: "Nada para atualizar." }, 400);

        // Mesma guarda do par (versão, preço) que o DEFINIR_REGULAMENTO_VERSAO
        // faz — pela outra ponta. Sem ela a incoerência continuaria alcançável, e
        // por um caminho MAIS curto: esta ação está em ACOES_ORG, ou seja, é do
        // organizador, enquanto o carimbo é só do super-admin. Tirar o desconto
        // sem trocar o texto é subir o preço de quem entra no meio da temporada
        // contra o que o regulamento declarado promete.
        //
        // Só barra a direção que prejudica o atleta. Conceder desconto sob um
        // texto que fala em valor integral é decisão comercial do organizador, e
        // quem paga paga a menos — mesmo raciocínio registrado no carimbo.
        if (upd.percentual_entrada_meio !== undefined) {
          const { data: circF, error: errCircF } = await supabase
            .from("circuitos").select("regulamento_versao").eq("id", circuitoId).maybeSingle();
          if (errCircF) throw errCircF;
          const versaoF = String(circF?.regulamento_versao ?? "").trim();
          const novoPct = Number(upd.percentual_entrada_meio);
          // Versão em branco não é julgada aqui: o circuito já está com as
          // inscrições fechadas pelo fail-closed do INSCREVER, e inventar um
          // segundo modo de falha só esconderia o primeiro.
          if (versaoF && !VERSOES_SEM_DESCONTO_ETAPA.has(versaoF) && novoPct >= 100) {
            return jsonResponse({
              sucesso: false,
              erro: `O regulamento declarado deste circuito é o ${versaoF}, que promete entrada ` +
                `reduzida a quem entra no meio da temporada. Cobrar 100% deixaria o app cobrando ` +
                `mais do que o texto promete. Troque a versão do regulamento antes de tirar o desconto.`,
            }, 409);
          }
        }

        await setCfg(circuitoId, upd);
        return jsonResponse({ sucesso: true });
      }

      case "DEFINIR_DESCONTO_ATLETA": {
        const { atletaId, descontoPct, isento } = payload || {};
        if (!atletaId) return jsonResponse({ sucesso: false, erro: "atletaId é obrigatório" }, 400);
        const upd: Record<string, unknown> = {};
        if (descontoPct !== undefined) upd.desconto_pct = (descontoPct === null ? null : Math.min(100, Math.max(0, Math.round(Number(descontoPct) || 0))));
        if (typeof isento === "boolean") upd.isento = isento;
        if (Object.keys(upd).length === 0) return jsonResponse({ sucesso: false, erro: "Nada para atualizar." }, 400);
        await writeAtleta(circuitoId, atletaId, upd);
        return jsonResponse({ sucesso: true });
      }

      case "REGISTRAR_PAGAMENTO": {
        const p = payload || {};
        if (!p.atletaId) return jsonResponse({ sucesso: false, erro: "atletaId é obrigatório" }, 400);
        const alvo = (p.alvo === "proxima") ? "proxima" : "atual";
        const id = p.id || `pag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const now = new Date().toISOString();
        const { error: errIns } = await supabase.from("pagamentos").insert({
          id, atleta_id: p.atletaId, temporada_rotulo: p.temporadaRotulo || null, circuito_id: circuitoId,
          valor: p.valor != null ? Math.max(0, Math.round(Number(p.valor))) : null,
          percentual: p.percentual != null ? Math.round(Number(p.percentual)) : null,
          desconto_pct_aplicado: p.descontoPctAplicado != null ? Math.round(Number(p.descontoPctAplicado)) : null,
          isento: !!p.isento, status: "confirmado", metodo: p.metodo || "pix",
          comprovante_url: p.comprovanteUrl || null, observacao: p.observacao || null,
          confirmado_em: now, criado_em: now,
        });
        if (errIns) throw errIns;
        const flagCol = alvo === "proxima" ? { pagamento_proxima_confirmado: true } : { pagamento_confirmado: true };
        await writeAtleta(circuitoId, p.atletaId, flagCol);
        return jsonResponse({ sucesso: true, dados: { id, alvo } });
      }

      case "ESTORNAR_PAGAMENTO": {
        const { id } = payload || {};
        if (!id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        const { data: pag, error: errGet } = await supabase.from("pagamentos").select("atleta_id,temporada_rotulo").eq("id", id).eq("circuito_id", circuitoId).single();
        if (errGet) throw errGet;
        if (!pag) return jsonResponse({ sucesso: false, erro: "Pagamento não encontrado." }, 404);
        const { error: errUpd } = await supabase.from("pagamentos").update({ status: "estornado" }).eq("id", id).eq("circuito_id", circuitoId);
        if (errUpd) throw errUpd;
        // ⚠️ ESTE BLOCO DERRUBAVA O PAGAMENTO DA TEMPORADA ERRADA. Achado do
        // Supervisor do Admin, e o caminho e curto:
        //
        //   · a decisao era `pag.temporada_rotulo === cfg.proxima_rotulo`, e tudo que
        //     NAO casasse caia no `else`, marcando `pagamento_confirmado: false`;
        //   · o `CANCELAR_PROXIMA` ZERA `proxima_rotulo`. Depois dele, NADA casa.
        //
        // Efeito: o organizador cancela a pre-abertura, estorna um pagamento DA
        // PROXIMA, e o motor derruba o pagamento da temporada EM CURSO. O atleta passa
        // a aparecer como inadimplente numa temporada que ele pagou -- e no circuito
        // com financeiro ligado isso BLOQUEIA a inclusao dele.
        //
        // E havia um terceiro caso que ninguem tinha nomeado: estornar pagamento de uma
        // temporada JA ENCERRADA tambem caia no `else` e derrubava a atual.
        //
        // A correcao: o rotulo do pagamento e a fonte de verdade, e ele e comparado com
        // AS DUAS temporadas que tem flag -- a atual (montada de `temporada_numero/ano`,
        // a mesma conta de tres outros lugares) e a proxima. Nao casando nenhuma, NAO SE
        // TOCA EM FLAG NENHUMA: o estorno fica registrado e nenhuma temporada viva e
        // afetada. Recusar o palpite e melhor que derrubar a conta errada.
        let flagTocada: string | null = null;
        if (pag.atleta_id) {
          const cfg = await getCfg(circuitoId, "proxima_rotulo,temporada_numero,temporada_ano");
          const rotuloAtual = `${cfg?.temporada_numero ?? ""}/${cfg?.temporada_ano ?? ""}`;
          const rot = pag.temporada_rotulo || null;
          if (rot && cfg?.proxima_rotulo && rot === cfg.proxima_rotulo) {
            await writeAtleta(circuitoId, pag.atleta_id, { pagamento_proxima_confirmado: false });
            flagTocada = "proxima";
          } else if (rot && rot === rotuloAtual) {
            await writeAtleta(circuitoId, pag.atleta_id, { pagamento_confirmado: false });
            flagTocada = "atual";
          } else {
            // Temporada encerrada, pre-abertura cancelada, ou pagamento sem rotulo.
            console.warn("estorno sem temporada viva:", { id, rot, rotuloAtual, proxima: cfg?.proxima_rotulo });
          }
        }
        // O organizador precisa saber O QUE o estorno mexeu -- "sucesso" sozinho ja
        // deixou ele achar que tinha mexido na temporada certa.
        return jsonResponse({ sucesso: true, dados: { flagTocada } });
      }

      case "LISTAR_PAGAMENTOS": {
        const { data, error } = await supabase.from("pagamentos").select("*").eq("circuito_id", circuitoId).order("criado_em", { ascending: false }).limit(500);
        if (error) throw error;
        return jsonResponse({ sucesso: true, dados: data });
      }

      case "EDITAR_PAGAMENTO": {
        const p = payload || {};
        if (!p.id) return jsonResponse({ sucesso: false, erro: "id é obrigatório" }, 400);
        const upd: Record<string, unknown> = {};
        if (p.valor !== undefined) upd.valor = p.valor != null ? Math.max(0, Math.round(Number(p.valor))) : null;
        if (p.percentual !== undefined) upd.percentual = p.percentual != null ? Math.round(Number(p.percentual)) : null;
        if (p.descontoPctAplicado !== undefined) upd.desconto_pct_aplicado = p.descontoPctAplicado != null ? Math.round(Number(p.descontoPctAplicado)) : null;
        if (p.metodo !== undefined) upd.metodo = p.metodo || "pix";
        if (p.observacao !== undefined) upd.observacao = p.observacao || null;
        if (Object.keys(upd).length === 0) return jsonResponse({ sucesso: false, erro: "Nada para atualizar." }, 400);
        const { error } = await supabase.from("pagamentos").update(upd).eq("id", p.id).eq("circuito_id", circuitoId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      // Telefones dos botoes de WhatsApp da tela de mensagens. ESCOPO POR CIRCUITO
      // (0.6.2): antes devolvia o telefone de TODOS os atletas da plataforma, sem
      // filtro — com o organizador na allowlist isso vazaria o telefone de atleta de
      // outro circuito. No BH (legado) o roster E a identidade global, entao o caminho
      // do BH fica IDENTICO ao de antes (regra 2: o BH nao e prejudicado).
      case "LISTAR_TELEFONES": {
        const bhTel = await bhId();
        if (circuitoId === bhTel) {
          const { data, error } = await supabase.from("atletas").select("id, telefone");
          if (error) throw error;
          return jsonResponse({ sucesso: true, dados: data });
        }
        const { data: membros, error: errMembros } = await supabase.from("circuito_atletas")
          .select("atleta_id").eq("circuito_id", circuitoId);
        if (errMembros) throw errMembros;
        const idsTel = (membros ?? []).map((m: any) => m.atleta_id);
        if (idsTel.length === 0) return jsonResponse({ sucesso: true, dados: [] });
        const { data, error } = await supabase.from("atletas").select("id, telefone").in("id", idsTel);
        if (error) throw error;
        return jsonResponse({ sucesso: true, dados: data });
      }

      case "LISTAR_MENSAGENS": {
        const { data, error } = await supabase.from("mensagens_enviadas").select("*").eq("circuito_id", circuitoId).order("enviado_em", { ascending: false }).limit(200);
        if (error) throw error;
        return jsonResponse({ sucesso: true, dados: data });
      }

      // Papéis Fatia 3 — só super-admin (não está na ACOES_ORG, então o organizador é barrado).
      // Nomeia/remove/lista organizador de um circuito. Não permite organizador no BH.
      case "NOMEAR_ORGANIZADOR": {
        const p = payload || {};
        let aId: string | null = p.atletaId ? String(p.atletaId) : null;
        let nomeAtleta: string | null = null;
        if (!aId && p.telefone) {
          const tel = String(p.telefone).replace(/\D/g, "");
          const { data } = await supabase.from("atletas").select("id,telefone,status,nome");
          const a = (data ?? []).find((x: any) => String(x.telefone || "").replace(/\D/g, "") === tel);
          if (!a) return jsonResponse({ sucesso: false, erro: "Atleta não encontrado por esse telefone." }, 404);
          if (a.status !== "ativo") return jsonResponse({ sucesso: false, erro: "Atleta não está ativo." }, 400);
          aId = a.id; nomeAtleta = a.nome;
        }
        if (!aId) return jsonResponse({ sucesso: false, erro: "Informe telefone ou atletaId." }, 400);
        const bhN = await bhId();
        if (circuitoId === bhN) return jsonResponse({ sucesso: false, erro: "O BH é administrado pelo super-admin, sem organizador." }, 400);
        const { data: circN } = await supabase.from("circuitos").select("id").eq("id", circuitoId).maybeSingle();
        if (!circN) return jsonResponse({ sucesso: false, erro: "Circuito não encontrado." }, 404);
        const { error } = await supabase.from("circuito_organizadores")
          .upsert({ circuito_id: circuitoId, atleta_id: aId, papel: "organizador" }, { onConflict: "circuito_id,atleta_id" });
        if (error) throw error;
        return jsonResponse({ sucesso: true, dados: { atletaId: aId, nome: nomeAtleta } });
      }

      case "REMOVER_ORGANIZADOR": {
        const { atletaId } = payload || {};
        if (!atletaId) return jsonResponse({ sucesso: false, erro: "atletaId é obrigatório" }, 400);
        const { error } = await supabase.from("circuito_organizadores").delete().eq("circuito_id", circuitoId).eq("atleta_id", atletaId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "LISTAR_ORGANIZADORES": {
        const { data, error } = await supabase.from("circuito_organizadores")
          .select("atleta_id, criado_em, atletas!inner(nome, telefone)").eq("circuito_id", circuitoId);
        if (error) throw error;
        return jsonResponse({ sucesso: true, dados: data });
      }

      // Cancelar circuito (só super-admin, fora da ACOES_ORG). O BH nunca pode ser cancelado.
      case "ENCERRAR_CIRCUITO": {
        const bhE = await bhId();
        if (circuitoId === bhE) return jsonResponse({ sucesso: false, erro: "O circuito de BH não pode ser encerrado." }, 400);
        const { data: circE } = await supabase.from("circuitos").select("id").eq("id", circuitoId).maybeSingle();
        if (!circE) return jsonResponse({ sucesso: false, erro: "Circuito não encontrado." }, 404);
        const { error } = await supabase.from("circuitos").update({ ativo: false, inscricoes_abertas: false }).eq("id", circuitoId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      case "REATIVAR_CIRCUITO": {
        const { data: circR } = await supabase.from("circuitos").select("id").eq("id", circuitoId).maybeSingle();
        if (!circR) return jsonResponse({ sucesso: false, erro: "Circuito não encontrado." }, 404);
        const { error } = await supabase.from("circuitos").update({ ativo: true }).eq("id", circuitoId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      // Excluir de vez — SÓ circuito sem jogos/histórico (evita apagar dados de um circuito que rodou).
      // Troca o regulamento que um circuito EXISTENTE declara. Até 17/09/2026
      // `regulamento_versao` só era escrito no CRIAR_CIRCUITO, e destravar a
      // virada do BH exigiria `UPDATE` manual em produção — o que a regra 1 do
      // projeto proíbe. Esta ação é o caminho legítimo.
      //
      // NÃO está em ACOES_ORG: é só do super-admin, por default-deny. Trocar o
      // regulamento muda o contrato que o atleta aceita; não é operação de
      // organizador.
      case "DEFINIR_REGULAMENTO_VERSAO": {
        const p = payload || {};
        // `trim` porque o valor é digitado à mão, e é o mesmo cuidado que a
        // trava do NOVA_TEMPORADA já tem. Sem ele, "v03-13 " viraria um carimbo
        // que a tela não reconhece — o Cap. 10 sumiria do BH.
        const versao = String(p.versao ?? "").trim();
        const confirmacao = String(p.confirmacaoNome ?? "").trim();

        // Vazio fecha as INSCRIÇÕES do circuito em silêncio: o INSCREVER do
        // athlete-action recusa 409 sem versão desde 14/09. Nunca gravar branco.
        if (!versao) {
          return jsonResponse({ sucesso: false, erro: "A versão do regulamento não pode ficar em branco." }, 400);
        }

        const { data: circR, error: errCircR } = await supabase
          .from("circuitos").select("id,slug,sistema,nome_circuito,regulamento_versao,percentual_entrada_meio").eq("id", circuitoId).maybeSingle();
        if (errCircR) throw errCircR;
        if (!circR) return jsonResponse({ sucesso: false, erro: "Circuito não encontrado." }, 404);

        // Confirmação-com-nome, o padrão do projeto para mudança destrutiva —
        // mas aqui NO MOTOR, não só na tela: o CLAUDE.md diz que o motor é o
        // servidor, e um carimbo errado é irreversível do ponto de vista do
        // atleta (ele aceita o texto que estiver no ar naquele instante).
        const nomeReal = String(circR.nome_circuito ?? "").trim();
        if (confirmacao !== nomeReal) {
          return jsonResponse({
            sucesso: false,
            erro: `Para trocar o regulamento, digite o nome do circuito exatamente como ele está: "${nomeReal}".`,
          }, 409);
        }

        // A versão pertence a ESTE circuito? A lista da trava responde "esta
        // versão promete desconto?", que é outra pergunta. Carimbar `vA-nc-01`
        // no BH liberaria a virada E apagaria o Cap. 10 da tela — o torneio é do
        // BH. Fail-closed: versão fora da família do circuito é recusada.
        const ehBhR = circuitoId === await bhId();
        const familia = ehBhR ? VERSOES_DO_BH : (circR.sistema === "B" ? VERSOES_DO_SISTEMA_B : VERSOES_DE_RATING_NOVO);
        if (!familia.has(versao)) {
          return jsonResponse({
            sucesso: false,
            erro: `A versão "${versao}" não é deste circuito. Aceitas aqui: ${[...familia].join(", ")}.`,
          }, 409);
        }

        // Recarimbar a MESMA versão não muda nada, então não pode ser barrado por
        // nada — inclusive pela guarda do par logo abaixo. Um circuito que já
        // esteja num par incoerente (por dado antigo) não fica refém de um erro
        // que o recarimbo nem criaria; e o admin que clica duas vezes não vê um
        // 409 que não descreve ato nenhum.
        const atual = String(circR.regulamento_versao ?? "").trim();
        if (atual === versao) {
          return jsonResponse({ sucesso: true, dados: { inalterado: true, versao } });
        }

        // O par (versão, preço) tem de fechar — nas DUAS direções.
        //
        // A trava do NOVA_TEMPORADA é um portão de UMA ação; ela não é um
        // invariante sobre o par. Sem esta guarda, o estado que a trava existe
        // para proibir é alcançável pelo outro lado, em três passos legítimos:
        // carimbar v03-13 → virar (o preço vai a 100) → carimbar v03-12 de
        // volta. Resultado: o texto promete 80% na 2ª etapa e o app cobra 100%.
        // Achado do guardião de regulamento em 19/09/2026, simulado contra este
        // motor, não deduzido.
        //
        // Lê `circuitos.percentual_entrada_meio` porque é daí que o app tira o
        // valor que de fato cobra (App.jsx:5026 — a mesma linha que lê
        // `regulamento_versao`, ou seja, a mesma casa). `null` ali significa
        // 100 para o app (`?? 100`), então significa 100 aqui também.
        //
        // "Promete desconto" é o complemento de VERSOES_SEM_DESCONTO_ETAPA — a
        // mesma lista que a trava usa, para as duas não poderem divergir.
        const pctAtualR = Number(circR.percentual_entrada_meio ?? 100);
        const prometeDesconto = !VERSOES_SEM_DESCONTO_ETAPA.has(versao);
        const cobraDesconto = Number.isFinite(pctAtualR) && pctAtualR < 100;
        if (prometeDesconto && !cobraDesconto) {
          return jsonResponse({
            sucesso: false,
            erro: `A versão "${versao}" promete entrada reduzida a quem entra no meio da temporada, ` +
              `mas este circuito está cobrando ${pctAtualR}% — valor integral. Carimbar assim deixaria ` +
              `o app cobrando mais do que o regulamento declarado promete. Ajuste o percentual antes, ` +
              `ou carimbe uma versão sem o desconto por etapa.`,
          }, 409);
        }
        // A direção INVERSA (texto integral + cobrança reduzida) NÃO é barrada, e
        // não é esquecimento: ela é a janela de transição obrigatória. A trava do
        // NOVA_TEMPORADA exige carimbar a v03-13 ANTES de virar, e quem vira é que
        // leva o percentual a 100 — logo existe necessariamente um intervalo com
        // v03-13 carimbada e 80% ainda cobrado. Barrar aqui criaria um impasse:
        // não daria para carimbar (o preço ainda é 80) nem para virar (a versão
        // ainda é v03-12). E o intervalo é inofensivo porque o próprio texto da
        // v03-13 o cobre: "vigora a partir da temporada 2/2026; a temporada
        // 1/2026, em curso, segue integralmente pela v03-12". Quem paga, paga a
        // menos — e o regulamento declarado já diz que é assim.

        const { error: errUpdR } = await supabase.from("circuitos").update({ regulamento_versao: versao }).eq("id", circuitoId);
        if (errUpdR) throw errUpdR;
        return jsonResponse({ sucesso: true, dados: { de: atual || null, para: versao } });
      }

      case "EXCLUIR_CIRCUITO": {
        const bhX = await bhId();
        if (circuitoId === bhX) return jsonResponse({ sucesso: false, erro: "O circuito de BH não pode ser excluído." }, 400);
        const { data: circX } = await supabase.from("circuitos").select("id").eq("id", circuitoId).maybeSingle();
        if (!circX) return jsonResponse({ sucesso: false, erro: "Circuito não encontrado." }, 404);
        const { count: nPart } = await supabase.from("partidas").select("*", { count: "exact", head: true }).eq("circuito_id", circuitoId);
        const { count: nHist } = await supabase.from("partidas_historico").select("*", { count: "exact", head: true }).eq("circuito_id", circuitoId);
        if ((nPart ?? 0) > 0 || (nHist ?? 0) > 0) {
          return jsonResponse({ sucesso: false, erro: "Este circuito tem jogos ou histórico. Encerre em vez de excluir." }, 409);
        }
        // Apaga vínculos residuais (para um circuito sem jogos, quase tudo está vazio) e o circuito.
        await supabase.from("mensagens_enviadas").delete().eq("circuito_id", circuitoId);
        await supabase.from("pagamentos").delete().eq("circuito_id", circuitoId);
        await supabase.from("solicitacoes_wo").delete().eq("circuito_id", circuitoId);
        await supabase.from("chaves").delete().eq("circuito_id", circuitoId);
        await supabase.from("circuito_atletas").delete().eq("circuito_id", circuitoId);
        await supabase.from("circuito_organizadores").delete().eq("circuito_id", circuitoId);
        const { error } = await supabase.from("circuitos").delete().eq("id", circuitoId);
        if (error) throw error;
        return jsonResponse({ sucesso: true });
      }

      default:
        return jsonResponse({ sucesso: false, erro: `Ação desconhecida: ${acao}` }, 400);
    }
  } catch (e) {
    console.error(e);
    return jsonResponse({ sucesso: false, erro: e.message || "Erro interno" }, 500);
  }
});
