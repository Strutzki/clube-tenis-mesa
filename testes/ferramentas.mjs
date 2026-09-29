// Ferramentas da bateria: as asserções e o cenário de partida.
// Sem biblioteca de fora — a bateria roda com `node`, e só.

import { criarBancoFalso } from "./banco-falso.mjs";
import { carregarFuncao, PIN_DE_TESTE } from "./carrega-motor.mjs";

export const BH = "272dd67c-ea33-41a3-8fb9-1fd909d7f3fa";
export const PIN = PIN_DE_TESTE;

let passou = 0;
let falhou = 0;
const falhas = [];

export function ok(condicao, oQueDeveriaSer) {
  if (condicao) { passou++; return true; }
  falhou++; falhas.push(oQueDeveriaSer);
  console.log(`  ✗ ${oQueDeveriaSer}`);
  return false;
}

export function igual(obtido, esperado, oQueDeveriaSer) {
  const iguais = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (iguais) { passou++; return true; }
  falhou++;
  const descricao = `${oQueDeveriaSer} — esperava ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`;
  falhas.push(descricao);
  console.log(`  ✗ ${descricao}`);
  return false;
}

export function secao(titulo) {
  console.log(`\n${titulo}`);
}

export function placar(nomeDaBateria) {
  console.log(`\n${nomeDaBateria}: ${passou} asserções OK, ${falhou} falharam`);
  if (falhou > 0) {
    console.log("\nFalhas:");
    falhas.forEach((f) => console.log(`  - ${f}`));
  }
  return falhou === 0 ? 0 : 1;
}

export function totais() { return { passou, falhou }; }

// ---------------------------------------------------------------------------
// Cenário: um banco de partida com o mínimo para o motor funcionar.
// Os valores seguem os defaults reais das tabelas (ver README).
// ---------------------------------------------------------------------------

// Os DEFAULT de coluna que o banco de verdade aplica sozinho. Só entram aqui os
// que o motor realmente depende — datas de now() e ids gerados.
const agora = () => new Date().toISOString();
const novoId = () => crypto.randomUUID();
export const PADROES_DO_BANCO = {
  tentativas_login_admin: { tentativa_em: agora },
  tentativas_busca_telefone: { tentativa_em: agora },
  tentativas_busca_cpf: { tentativa_em: agora },
  // ⚠️ `rejeitado`/`validado`/`calculado` têm DEFAULT false no Postgres, e o banco
  // falso não modelava isso (achado do guardião do Admin, 29/09/2026). Como o
  // INICIAR_ETAPA e o AVANCAR_RODADA inserem partida SEM esses campos, todo
  // cenário que gerasse partidas pelo motor e depois chamasse PROCESSAR_RODADA
  // recebia `{processadas: 0}` — e passava VERDE sem processar nada, porque as
  // consultas filtram por `.eq("rejeitado", false)`. É a família "passa pelo
  // motivo errado": o instrumento discordando do banco de verdade.
  partidas: { criado_em: agora, rejeitado: () => false, validado: () => false, calculado: () => false },
  partidas_historico: { arquivada_em: agora },
  mensagens_enviadas: { enviado_em: agora },
  pagamentos: { criado_em: agora },
  solicitacoes_wo: { criado_em: agora },
  atletas: { id: novoId, inscrito_em: agora, atualizado_em: agora },
  circuitos: { id: novoId, criado_em: agora, atualizado_em: agora },
  circuito_atletas: { id: novoId, inscrito_em: agora },
  atleta_sessao: { id: novoId, criado_em: agora },
  circuito_organizadores: { criado_em: agora },
};

// Colunas NOT NULL das tabelas que o motor grava, copiadas do esquema de
// PRODUCAO (`information_schema.columns`, conferido em 29/09/2026). Serve para o
// banco falso recusar `null` como o Postgres recusa.
//
// ⚠️ Esta lista nasceu de um NO-GO: a `anonimizar-atleta` gravava
// `justificativa: null` e a bateria ficava verde, com uma assercao afirmando o
// valor proibido. Ver o comentario longo em `banco-falso.mjs`.
// AO ACRESCENTAR COLUNA AQUI, confira no banco de verdade -- lista inventada e
// pior que lista vazia, porque recusa gravacao legitima.
export const COLUNAS_NAO_NULAS = {
  solicitacoes_wo: ["justificativa"],
  atletas: ["telefone"],
};

export function atleta(id, campos = {}) {
  return {
    id, nome: id, telefone: "31" + String(id).padStart(9, "0"),
    rating: 500, rating_inicial: 500, rating_pico: 500, rating_historico: [],
    saldo_temp: 0, status: "ativo", pendente_circuito: false,
    vitorias: 0, derrotas: 0, vitorias_total: 0, derrotas_total: 0,
    wo_culposos_temporada: 0, historico: [], posicao_historico: [],
    pagamento_confirmado: true, isento: false,
    ...campos,
  };
}

export function partida(id, campos = {}) {
  return {
    id, circuito_id: BH, chave_id: "chave1", rodada: 1,
    atleta1_id: null, atleta2_id: null, placar1: null, placar2: null,
    validado: false, calculado: false, rejeitado: false,
    validado_por_admin: false, admin_aprovado_em: "2026-01-01T10:00:00Z",
    wo_tipo: null, wo_faltoso_id: null, wo_beneficiario_id: null,
    ...campos,
  };
}

export function circuito(id, campos = {}) {
  return {
    id, slug: id === BH ? "bh" : id, sistema: "A", ativo: true, publico: true,
    fase: "temporada", temporada_numero: 1, temporada_ano: 2026,
    rodadas_por_temporada: 6, max_atletas: 20, auto_validar_placar: false,
    financeiro_ativo: false, nome_circuito: "Circuito " + id,
    ...campos,
  };
}

/**
 * Monta o banco e carrega o motor de verdade.
 * `partidas`/`atletas`/`circuitos` entram como vieram; o resto ganha default.
 */
export async function montarMotor({
  circuitos = [circuito(BH)],
  atletas = [],
  circuito_atletas = [],
  partidas = [],
  chaves = [{ id: "chave1", nome: "Chave A", rodada_atual: 1, circuito_id: BH }],
  solicitacoes_wo = [],
  configuracao = [{ id: 1, fase: "temporada", temporada_numero: 1, temporada_ano: 2026, rodadas_por_temporada: 6 }],
  funcoes = {},
  outras = {},
  // Qual Edge Function carregar. O padrao e o admin-action, que e o motor de
  // quase tudo; `comprovante-url` entrou em 27/09/2026 (item 0.6.4), quando o
  // organizador passou a poder abrir a prova de um W.O. do circuito dele.
  funcao = "admin-action",
  // Arquivos do storage de mentira: { bucket: ["nome.jpg", ...] }. Serve a
  // exclusao de dados, que precisa provar que a FOTO some do bucket publico.
  arquivos = {},
} = {}) {
  const banco = criarBancoFalso({
    circuitos, atletas, circuito_atletas, partidas, chaves, solicitacoes_wo, configuracao,
    tentativas_login_admin: [], circuito_organizadores: [], mensagens_enviadas: [],
    pagamentos: [], partidas_historico: [], atleta_sessao: [], circuito_cobranca: [],
    ...outras,
  }, funcoes, {}, PADROES_DO_BANCO, arquivos, COLUNAS_NAO_NULAS);
  const motor = await carregarFuncao(funcao, banco);
  return { banco, motor };
}

/** Chama o motor como super-admin. */
export function comoAdmin(motor, acao, payload = {}) {
  return motor.chamar({ pin: PIN, acao, payload });
}

/**
 * Gera um PIN guardado no formato que o motor entende (PBKDF2), para os testes
 * poderem entrar como organizador. Mesma cripto do login-atleta: o teste não
 * inventa um atalho, ele produz o hash de verdade.
 */
export async function pinGuardado(pin, iteracoes = 100000) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: sal, iterations: iteracoes, hash: "SHA-256" }, chave, 256);
  const b64 = (bytes) => Buffer.from(bytes).toString("base64");
  return `pbkdf2$${iteracoes}$${b64(sal)}$${b64(new Uint8Array(bits))}`;
}

/** Chama o motor como organizador de circuito (telefone + PIN). */
export function comoOrganizador(motor, telefone, pin, acao, payload = {}) {
  return motor.chamar({ orgTelefone: telefone, orgPin: pin, acao, payload });
}
