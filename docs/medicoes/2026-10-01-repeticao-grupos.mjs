// ═══════════════════════════════════════════════════════════════════════════════
// MEDIÇÃO: com que frequência um confronto se repete no modo GRUPOS, e quanto.
//
// Por que este arquivo existe no REPOSITÓRIO, e não num rascunho:
//
// O comentário do motor afirmava "93/1500 (6,2%)" para o cenário do favorito, e o
// Supervisor de Regulamento mostrou que NENHUM arquivo de prova contém esse número —
// a única execução preservada diz 83/1500 (5,5%), e ela TERMINA EM ERRO DE MEMÓRIA,
// ou seja foi truncada. O total de "6.700 temporadas" também não reconstituía: os
// papéis somavam 7.700 numa contagem e 4.700 noutra.
//
// Isso é o defeito nº 1 do projeto — "não cite de memória, rode e leia" — acontecendo
// dentro de um número que foi para o motor, para a tela do atleta e para o documento
// de governança. Três lugares citando um número que ninguém conseguia reproduzir.
//
// Então: a medição virou arquivo versionado, com SEMENTE FIXA. Rodar de novo dá o
// MESMO resultado, e qualquer pessoa pode conferir o número que o comentário cita.
// A saída fica ao lado, em `2026-10-01-repeticao-grupos.txt`.
//
// ⚠️ RODE UMA CÉLULA POR PROCESSO. Isto não é preferência, é necessidade:
//
//   node docs/medicoes/2026-10-01-repeticao-grupos.mjs 8 grupos justo 3000
//
// Sem argumentos ele roda a primeira célula. O motivo de não rodar tudo de uma vez:
// o `carregarFuncao` cria um MÓDULO NOVO por temporada (escreve um arquivo temporário
// e o importa), e o Node guarda todo módulo importado para sempre — 5.600 temporadas
// são 5.600 cópias do motor na memória. A execução anterior estourou mesmo com 4 GB, e
// foi assim que o arquivo de prova antigo saiu TRUNCADO, terminando em
// `FATAL ERROR: heap out of memory` no meio da lista.
//
// E NÃO, não dá para cachear o módulo: o `admin-action` tem estado no nível do módulo
// (`_bhId` e `_sistemaCache`), e reusá-lo faria um cenário ler o SISTEMA de outro. É
// exatamente o erro que custou um teste inteiro em 29/09 — a seção de W.O. "dos dois
// sistemas" rodou o Sistema A duas vezes porque o cenário do B apontava para o BH. O
// módulo por chamada é o que garante o isolamento; a memória é o preço dele.
// ═══════════════════════════════════════════════════════════════════════════════
import { montarMotor, comoAdmin, circuito, atleta, BH } from "../../testes/ferramentas.mjs";

// ── SORTEIO COM SEMENTE — o que torna a medição reproduzível ──────────────────
// `Math.random()` fazia cada execução dar um número diferente, e foi isso que
// permitiu o comentário citar um valor que nenhum arquivo continha: não havia como
// alguém conferir. Com semente, conferir é rodar.
// mulberry32: pequeno, sem dependência, e suficiente para sortear vencedor.
let _semente = 0;
function semearRng(s) { _semente = s >>> 0; }
function rng() {
  _semente = (_semente + 0x6D2B79F5) >>> 0;
  let t = _semente;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const C = "bbbbbbbb-1111-1111-1111-111111111111";
const ids = (n) => Array.from({length:n},(_,i)=>`atl-${String(i+1).padStart(2,"0")}`);

// modo: "justo" = vencedor sorteado; "forte" = os 1os da lista vencem quase sempre
// (cria tabela MUITO espalhada, que e o que mexe no pareamento por faixa)
async function temporada(q, pareamento, modo) {
  const lista = ids(q);
  const { banco, motor } = await montarMotor({
    circuitos: [circuito(BH), circuito(C, { slug:"pontos", sistema:"B", pareamento,
      regulamento_versao:"vB-01", rodadas_por_temporada:6, fase:"temporada",
      temporada_numero:1, temporada_ano:2026, max_atletas:20 })],
    atletas: lista.map(id => atleta(id, { rating: 500 })),
    circuito_atletas: lista.map(id => ({ circuito_id:C, atleta_id:id, status:"ativo",
      pendente_circuito:false, saldo_temp:0, vitorias:0, derrotas:0 })),
    chaves: [], partidas: [],
  });
  const forca = Object.fromEntries(lista.map((id,i)=>[id, lista.length - i])); // atl-01 o mais forte
  const proc = async (rr) => { for (const r of rr) {
    for (const m of banco.tabelas.partidas.filter(x=>x.circuito_id===C && x.rodada===r)) {
      m.validado = true;
      let a1;
      if (modo === "forte") {
        const p = forca[m.atleta1_id] / (forca[m.atleta1_id] + forca[m.atleta2_id]);
        a1 = rng() < p;
      } else a1 = rng() < 0.5;
      m.placar1 = a1?3:(rng()<0.5?0:1); m.placar2 = a1?(rng()<0.5?0:1):3;
    }
    await comoAdmin(motor, "PROCESSAR_RODADA", { circuitoId: C, round: r });
  }};
  await comoAdmin(motor,"INICIAR_ETAPA",{circuitoId:C}); await proc([1,2]);
  await comoAdmin(motor,"AVANCAR_RODADA",{circuitoId:C}); await proc([3,4]);
  await comoAdmin(motor,"AVANCAR_RODADA",{circuitoId:C}); await proc([5,6]);
  const ps = banco.tabelas.partidas.filter(m=>m.circuito_id===C);
  const conf = ps.map(m=>[m.atleta1_id,m.atleta2_id].sort().join("|"));
  const cont = {}; conf.forEach(c => cont[c] = (cont[c]||0)+1);
  const paresRepetidos = Object.values(cont).filter(v=>v>1).length;   // quantos PARES se repetiram
  const excedente = conf.length - new Set(conf).size;                  // quantos jogos a mais
  const maxVezes = Math.max(...Object.values(cont));                   // o mesmo par quantas vezes
  // roster mudou?
  const cas = banco.tabelas.circuito_atletas.filter(c=>c.circuito_id===C);
  const mudou = cas.length !== q || cas.some(c=>c.status!=="ativo"||c.pendente_circuito);
  return { paresRepetidos, excedente, maxVezes, mudou };
}

async function medir(q, pareamento, modo, N) {
  const dist = {}; let mudouAlguma = 0, maxPares = 0, maxVezesG = 0;
  // Semente derivada da configuração: cada célula é reproduzível por si, e mudar o N
  // de uma não desloca o resultado das outras.
  semearRng(q * 1000003 + modo.length * 7919 + pareamento.length * 104729);
  for (let i=0;i<N;i++) {
    const r = await temporada(q, pareamento, modo);
    dist[r.excedente] = (dist[r.excedente]||0)+1;
    if (r.mudou) mudouAlguma++;
    maxPares = Math.max(maxPares, r.paresRepetidos);
    maxVezesG = Math.max(maxVezesG, r.maxVezes);
  }
  const chaves = Object.keys(dist).map(Number).sort((a,b)=>a-b);
  const txt = chaves.map(k=>`${k}:${dist[k]}`).join("  ");
  const comRep = N - (dist[0]||0);
  console.log(`${q} atletas / ${pareamento} / ${modo.padEnd(6)} N=${N}  ->  ${comRep}/${N} com repetição (${(100*comRep/N).toFixed(1)}%)  | distribuição  ${txt}  | máx pares repetidos: ${maxPares}  | mesmo par no máx ${maxVezesG}x  | roster mudou: ${mudouAlguma}`);
}

// UMA célula por processo — ver o aviso no cabeçalho. A lista completa, para quem
// quiser reproduzir a medição inteira:
//   8  grupos  justo  3000   (o comentário dizia 279/3000 = 9,3%)
//   8  grupos  forte  1500   (o comentário dizia  93/1500 = 6,2%)
//   9  grupos  forte   400
//   10 grupos  forte   400
//   12 grupos  forte   300
//   8  sorteio justo   500
const [aq, apar, amodo, aN] = process.argv.slice(2);
await medir(Number(aq) || 8, apar || "grupos", amodo || "justo", Number(aN) || 3000);
console.log("Semente fixa: rodar de novo com os MESMOS argumentos dá o MESMO resultado.");
