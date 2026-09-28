import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// login-atleta — login do ATLETA por telefone + PIN (zero-custo, sem OTP).
//  - acao "LOGIN": telefone (+ pin). Retorna primeiroAcesso, precisaPin,
//    ok+atleta, ou erro. Trava por tentativas (anti-força-bruta).
//  - acao "DEFINIR_PIN": telefone + pin, cria o PIN só se ainda não existir
//    (confiança no 1º acesso). Se já existe, manda pedir reset ao admin.
// O PIN é guardado com hash PBKDF2 + sal. Nunca em texto puro, nunca exposto.
// ============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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

const MAX_TENTATIVAS_PIN = 5;
const BLOQUEIO_MINUTOS = 15;
const ITERACOES = 100000;

// Colunas devolvidas ao app no sucesso — NUNCA inclui pin_hash.
const COLS = "id,nome,telefone,apelido,federado,rating,rating_inicial,saldo_temp,status,chave,vitorias,derrotas,vitorias_total,derrotas_total,inscrito_em,pendente_circuito,ultima_recusa_circuito_em,foto_url,estilo_jogo,historico,rating_pico,rating_historico,posicao_historico,wo_culposos_temporada,exclusao_solicitada_em";

function normTel(t: unknown): string {
  return String(t ?? "").replace(/\D/g, "");
}

function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}
function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function deriveBits(pin: string, salt: Uint8Array, iter: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, keyMaterial, 256,
  );
  return new Uint8Array(bits);
}

async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveBits(pin, salt, ITERACOES);
  return `pbkdf2$${ITERACOES}$${b64(salt)}$${b64(hash)}`;
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
  try {
    const [alg, iterStr, saltB64, hashB64] = stored.split("$");
    if (alg !== "pbkdf2") return false;
    const hash = await deriveBits(pin, fromB64(saltB64), parseInt(iterStr));
    const esperado = b64(hash);
    // comparação de tempo constante simples
    if (esperado.length !== hashB64.length) return false;
    let diff = 0;
    for (let i = 0; i < esperado.length; i++) diff |= esperado.charCodeAt(i) ^ hashB64.charCodeAt(i);
    return diff === 0;
  } catch { return false; }
}

// ── "Continuar conectado": token de sessão do atleta (guardamos só o hash) ──
const SESSAO_DIAS = 90;
function novoToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function emitirSessao(atletaId: string): Promise<string> {
  const token = novoToken();
  const hash = await sha256hex(token);
  const expira = new Date(Date.now() + SESSAO_DIAS * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("atleta_sessao").insert({ atleta_id: atletaId, token_hash: hash, expira_em: expira });
  return token;
}
async function atletaPorToken(token: unknown): Promise<string | null> {
  if (!token || typeof token !== "string") return null;
  const hash = await sha256hex(token);
  const { data } = await supabase.from("atleta_sessao").select("id,atleta_id,expira_em").eq("token_hash", hash).maybeSingle();
  if (!data) return null;
  if (new Date(data.expira_em) < new Date()) { await supabase.from("atleta_sessao").delete().eq("id", data.id); return null; }
  await supabase.from("atleta_sessao").update({ ultimo_uso_em: new Date().toISOString() }).eq("id", data.id);
  return data.atleta_id;
}

// Idade a partir de "AAAA-MM-DD". Devolve null quando NAO DA PARA SABER — e quem
// chama tem de tratar null como desconhecido, nunca como maior de idade.
function idadeDeISO(iso: string | null | undefined): number | null {
  const t = String(iso ?? "").trim();
  if (!t) return null;
  const d = new Date(t + "T00:00:00Z");
  if (isNaN(d.getTime())) return null;
  const h = new Date();
  let anos = h.getUTCFullYear() - d.getUTCFullYear();
  const dm = h.getUTCMonth() - d.getUTCMonth();
  if (dm < 0 || (dm === 0 && h.getUTCDate() < d.getUTCDate())) anos--;
  return anos;
}
async function acharAtleta(tel: string): Promise<any | null> {
  const alvo = normTel(tel);
  if (alvo.length < 10) return null;
  const { data } = await supabase
    .from("atletas")
    .select("id,telefone,pin_hash,pin_tentativas,pin_bloqueado_ate,status");
  return (data ?? []).find((a: any) => normTel(a.telefone) === alvo) ?? null;
}

// Hub multi-circuito: circuitos ATIVOS onde o atleta é membro (inclui BH via espelho).
// Service role, então enxerga circuitos privados também. Só campos públicos de identidade.
async function circuitosDoAtleta(atletaId: string): Promise<any[]> {
  const { data } = await supabase.from("circuito_atletas")
    .select("status, circuitos!inner(id,slug,nome_circuito,sistema,publico,ativo)")
    .eq("atleta_id", atletaId).eq("status", "ativo");
  return (data ?? [])
    .map((v: any) => v.circuitos)
    .filter((c: any) => c && c.ativo)
    .map((c: any) => ({ id: c.id, slug: c.slug, nome: c.nome_circuito, sistema: c.sistema, publico: c.publico }));
}

// ── CPF backfill (reusa a fundação da spec de CPF; hash no edge, pepper no Vault) ──
function cpfNormaliza(s: unknown): string | null {
  const d = String(s ?? "").replace(/\D/g, "");
  return d.length === 11 ? d : null;
}
function cpfDVValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (base: string, ini: number) => { let s = 0; for (let i = 0; i < base.length; i++) s += parseInt(base[i], 10) * (ini - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  if (dv(cpf.slice(0, 9), 10) !== parseInt(cpf[9], 10)) return false;
  return dv(cpf.slice(0, 10), 11) === parseInt(cpf[10], 10);
}
let _cpfPepper: string | null = null;
async function getCpfPepper(): Promise<string> {
  if (_cpfPepper) return _cpfPepper;
  const { data, error } = await supabase.rpc("get_cpf_pepper");
  if (error) throw error;
  const pep = (typeof data === "string" ? data : (data as any)) as string;
  if (!pep) throw new Error("pepper_indisponivel");
  _cpfPepper = pep;
  return pep;
}
async function cpfHmacHex(cpf: string, pepper: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(cpf));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
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
      status, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ sucesso: false, erro: "Método não permitido" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return jsonResponse({ sucesso: false, erro: "JSON inválido" }, 400); }

  const { acao, telefone, pin } = body || {};

  try {
    if (acao === "LOGIN") {
      const a = await acharAtleta(telefone);
      if (!a) return jsonResponse({ sucesso: true, dados: { encontrado: false } });

      if (a.pin_bloqueado_ate && new Date(a.pin_bloqueado_ate) > new Date()) {
        return jsonResponse({ sucesso: false, erro: "Muitas tentativas. Aguarde alguns minutos e tente de novo." }, 429);
      }
      if (!a.pin_hash) {
        return jsonResponse({ sucesso: true, dados: { encontrado: true, primeiroAcesso: true } });
      }
      if (!pin) {
        return jsonResponse({ sucesso: true, dados: { encontrado: true, precisaPin: true } });
      }

      const ok = await verifyPin(String(pin), a.pin_hash);
      if (!ok) {
        const tent = (a.pin_tentativas || 0) + 1;
        const upd = tent >= MAX_TENTATIVAS_PIN
          ? { pin_tentativas: 0, pin_bloqueado_ate: new Date(Date.now() + BLOQUEIO_MINUTOS * 60000).toISOString() }
          : { pin_tentativas: tent };
        await supabase.from("atletas").update(upd).eq("id", a.id);
        return jsonResponse({ sucesso: false, erro: "PIN incorreto." }, 401);
      }

      await supabase.from("atletas").update({ pin_tentativas: 0, pin_bloqueado_ate: null }).eq("id", a.id);
      const { data: full } = await supabase.from("atletas").select(COLS).eq("id", a.id).single();
      const circuitosLogin = await circuitosDoAtleta(a.id);
      const tokenLogin = await emitirSessao(a.id);
      return jsonResponse({ sucesso: true, dados: { encontrado: true, ok: true, atleta: full, circuitos: circuitosLogin, token: tokenLogin } });
    }

    if (acao === "DEFINIR_PIN") {
      const pinStr = String(pin ?? "");
      if (!/^\d{4,6}$/.test(pinStr)) {
        return jsonResponse({ sucesso: false, erro: "O PIN deve ter de 4 a 6 dígitos." }, 400);
      }
      const a = await acharAtleta(telefone);
      if (!a) return jsonResponse({ sucesso: false, erro: "Cadastro não encontrado." }, 404);
      if (a.pin_hash) {
        return jsonResponse({ sucesso: false, erro: "Você já tem um PIN. Se esqueceu, peça um reset ao administrador." }, 409);
      }
      const h = await hashPin(pinStr);
      await supabase.from("atletas").update({
        pin_hash: h, pin_definido_em: new Date().toISOString(), pin_tentativas: 0, pin_bloqueado_ate: null,
      }).eq("id", a.id);
      const { data: full } = await supabase.from("atletas").select(COLS).eq("id", a.id).single();
      const circuitosNovo = await circuitosDoAtleta(a.id);
      const tokenNovo = await emitirSessao(a.id);
      return jsonResponse({ sucesso: true, dados: { ok: true, atleta: full, circuitos: circuitosNovo, token: tokenNovo } });
    }

    // PARTICIPAR — atleta EXISTENTE entra num 2º circuito (Bloqueador estrutural 1).
    // Autenticado por PIN; reusa o cadastro nacional (NÃO cria atleta/rating novo).
    // Backfill de CPF aqui, se o atleta ainda não tiver. Spec: PLANO_PARTICIPAR.md.
    if (acao === "PARTICIPAR") {
      const p = body || {};
      const ipReq = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;

      // 1) Autentica: telefone + PIN (mesma trava de tentativas do LOGIN).
      const a = await acharAtleta(telefone);
      if (!a) return jsonResponse({ sucesso: false, erro: "cadastro_nao_encontrado" }, 404);
      if (a.pin_bloqueado_ate && new Date(a.pin_bloqueado_ate) > new Date()) {
        return jsonResponse({ sucesso: false, erro: "muitas_tentativas" }, 429);
      }
      if (!a.pin_hash) return jsonResponse({ sucesso: false, erro: "primeiro_acesso" }, 409);
      if (!pin) return jsonResponse({ sucesso: false, erro: "precisa_pin" }, 401);
      const okPin = await verifyPin(String(pin), a.pin_hash);
      if (!okPin) {
        const tent = (a.pin_tentativas || 0) + 1;
        const upd = tent >= MAX_TENTATIVAS_PIN
          ? { pin_tentativas: 0, pin_bloqueado_ate: new Date(Date.now() + BLOQUEIO_MINUTOS * 60000).toISOString() }
          : { pin_tentativas: tent };
        await supabase.from("atletas").update(upd).eq("id", a.id);
        return jsonResponse({ sucesso: false, erro: "pin_incorreto" }, 401);
      }
      await supabase.from("atletas").update({ pin_tentativas: 0, pin_bloqueado_ate: null }).eq("id", a.id);
      if (a.status !== "ativo") return jsonResponse({ sucesso: false, erro: "cadastro_inativo" }, 403);

      // 2) Valida o circuito alvo (existe, ativo, inscrições abertas, não é o BH).
      const circuitoId = p.circuitoId ? String(p.circuitoId) : "";
      if (!circuitoId) return jsonResponse({ sucesso: false, erro: "circuitoId é obrigatório" }, 400);
      const { data: circ } = await supabase.from("circuitos")
        .select("slug,ativo,inscricoes_abertas,regulamento_versao").eq("id", circuitoId).maybeSingle();
      if (!circ) return jsonResponse({ sucesso: false, erro: "circuito_nao_encontrado" }, 404);
      if (circ.slug === "bh") return jsonResponse({ sucesso: false, erro: "bh_cadastro_direto" }, 400);
      if (!circ.ativo) return jsonResponse({ sucesso: false, erro: "circuito_inativo" }, 400);
      if (!circ.inscricoes_abertas) return jsonResponse({ sucesso: false, erro: "inscricoes_fechadas" }, 400);
      // Fail-closed: sem saber a versão do regulamento, não se colhe aceite.
      // Até 17/09/2026 esta função gravava `aceite_regulamento: true` com
      // `versao_regulamento: null` — um recibo de consentimento que não aponta
      // para texto nenhum. Gravar nulo NÃO é recusar, e a bateria chegou a
      // afirmar que isto era fail-closed (era falso nas duas metades; o
      // guardião de Segurança pegou).
      //
      // Fica AQUI, junto das outras guardas do circuito, antes de qualquer
      // escrita — inclusive antes do backfill de CPF, para uma tentativa
      // recusada não chegar a registrar dado pessoal.
      const versaoDoCircuito = String(circ.regulamento_versao ?? "").trim();
      if (!versaoDoCircuito) {
        return jsonResponse({ sucesso: false, erro: "versao_regulamento_indisponivel" }, 409);
      }

      // ACEITE DE VERDADE (27/09/2026). Até aqui esta função gravava
      // `aceite_regulamento: true` sem que o atleta tivesse visto regulamento
      // nenhum: o fluxo "Participar de outro circuito" tinha três telas
      // (identificação, CPF, pronto) e NENHUMA mencionava regulamento. O recibo
      // apontava para a versão certa e para um texto que o atleta nunca abriu.
      // Isso importa mais agora que existe circuito de PONTOS: quem vem do BH
      // (rating) entraria "aceitando" um regulamento com pontuação, pareamento e
      // encerramento diferentes.
      //
      // O molde é o do ACEITAR_REGULAMENTO: o atleta DECLARA qual versão está
      // aceitando, e o servidor compara com a do circuito. Se divergir — tela
      // velha aberta, ou carimbo trocado no meio do caminho — recusa, em vez de
      // registrar consentimento de um texto que não é o que está valendo.
      if (p.aceiteRegulamento !== true) {
        return jsonResponse({ sucesso: false, erro: "aceite_regulamento_obrigatorio" }, 400);
      }
      const versaoDeclarada = String(p.versaoRegulamento ?? "").trim();
      if (!versaoDeclarada) {
        return jsonResponse({ sucesso: false, erro: "versao_regulamento_obrigatoria" }, 400);
      }
      if (versaoDeclarada !== versaoDoCircuito) {
        return jsonResponse({ sucesso: false, erro: "versao_regulamento_divergente" }, 409);
      }

      // 3) Já é membro deste circuito?
      const { data: mem } = await supabase.from("circuito_atletas")
        .select("atleta_id").eq("circuito_id", circuitoId).eq("atleta_id", a.id).maybeSingle();
      if (mem) return jsonResponse({ sucesso: false, erro: "ja_participa" }, 409);

      const now = new Date().toISOString();

      // 4) Backfill de CPF: só se o atleta ainda NÃO tem documento.
      const { data: doc } = await supabase.from("atleta_documento")
        .select("atleta_id,data_nascimento,responsavel_nome,responsavel_cpf_hash")
        .eq("atleta_id", a.id).maybeSingle();
      if (!doc) {
        const temCpf = String(p.cpf ?? "").replace(/\D/g, "").length > 0;
        if (!temCpf) return jsonResponse({ sucesso: false, erro: "cpf_obrigatorio" }, 400);
        if (!p.cpfConsent) return jsonResponse({ sucesso: false, erro: "cpf_consentimento_obrigatorio" }, 400);
        const cpf = cpfNormaliza(p.cpf);
        if (!cpf || !cpfDVValido(cpf)) return jsonResponse({ sucesso: false, erro: "cpf_invalido" }, 400);
        const pepper = await getCpfPepper();
        const cpfHash = await cpfHmacHex(cpf, pepper);
        const { data: dd } = await supabase.rpc("dedup_por_cpf_hash", { p_hash: cpfHash });
        const ex = Array.isArray(dd) ? dd[0] : dd;
        if (ex?.existe && ex?.atleta_id && ex.atleta_id !== a.id) {
          return jsonResponse({ sucesso: false, erro: "cpf_conflito" }, 409); // CPF é de outro cadastro
        }
        // MENOR DE IDADE (27/09/2026). O campo do responsável era opcional aqui:
        // a única trava era a tela, que desabilita o botão sem nome e CPF válido
        // do responsável. Trava de um lado só contraria a regra da casa — o
        // portão é o servidor.
        //
        // ⚠️ A PRIMEIRA VERSÃO DESTA GUARDA ERA FAIL-OPEN, e o Guardião Jurídico
        // provou rodando: ela toda vivia dentro de `if (nasc)`, então bastava
        // OMITIR `dataNascimento` para nenhuma checagem acontecer — o documento
        // era gravado com `data_nascimento: null` e o menor entrava. E quem se
        // beneficia de omitir a idade é o próprio menor, que tem o PIN na mão:
        // não é invasor atacando terceiro, é o titular contornando a proteção que
        // existe para ele (art. 14 da LGPD). Agora a data é OBRIGATÓRIA aqui, e
        // idade que não dá para calcular é recusa, não liberação.
        const idade = idadeDeISO(p.dataNascimento);
        if (idade === null) {
          return jsonResponse({ sucesso: false, erro: "data_nascimento_obrigatoria" }, 400);
        }
        // Data absurda tambem e recusa. Nao e preciosismo: com a data obrigatoria, o
        // proximo movimento de quem quer entrar sem responsavel e MENTIR. Mentir com
        // data plausivel (1990) e indetectavel em qualquer fluxo autodeclarado e nao
        // tem conserto. Mentir com data absurda TEM: sem esta linha, "1850" da idade
        // ~176, que nao e `< 18`, e o menor passaria como adulto.
        if (idade < 0 || idade > 120) {
          return jsonResponse({ sucesso: false, erro: "data_nascimento_invalida" }, 400);
        }
        // ⚠️ NAO reescreva a linha abaixo como `idade !== null && idade < 18`.
        // Parece limpeza e e o oposto: hoje `null < 18` e `true` em JavaScript (null
        // vira 0), entao mesmo se a guarda de cima cair o caso nulo continua caindo
        // aqui e cobrando responsavel. Ou seja, o fail-closed tem DUAS camadas, e a
        // segunda e por coercao de tipo, nao por desenho. Acrescentar o `!== null`
        // transformaria idade desconhecida em liberacao silenciosa.
        // (Observacao do Guardiao Juridico, 27/09/2026.)
        // ⚠️ E seja preciso sobre o que a bateria protege AQUI: ela protege a PRIMEIRA
        // camada (a guarda do null acima, cuja mutacao fica vermelha). A segunda — a
        // coercao — e rede de seguranca SEM assercao propria: acrescentar `!== null`
        // sozinho deixa a bateria VERDE, porque hoje e inocuo. O que fica vermelho, em
        // 5 assercoes, e a COMBINACAO: tirar a guarda do null E acrescentar o `!== null`.
        // Nao leia "duas camadas" como "duas camadas testadas".
        if (idade < 18) {
          if (!String(p.responsavelNome ?? "").trim() || !String(p.responsavelCpf ?? "").trim()) {
            return jsonResponse({ sucesso: false, erro: "responsavel_obrigatorio" }, 400);
          }
        }
        let respCpfHash: string | null = null;
        if (p.responsavelCpf) {
          const rc = cpfNormaliza(p.responsavelCpf);
          if (!rc || !cpfDVValido(rc)) return jsonResponse({ sucesso: false, erro: "cpf_responsavel_invalido" }, 400);
          respCpfHash = await cpfHmacHex(rc, pepper);
        }
        const { error: eDoc } = await supabase.from("atleta_documento").insert({
          atleta_id: a.id, cpf_hash: cpfHash,
          cpf_consent_em: now, cpf_consent_versao: p.cpfConsentVersao ? String(p.cpfConsentVersao) : null, cpf_consent_ip: ipReq,
          data_nascimento: p.dataNascimento || null,
          responsavel_nome: p.responsavelNome ? String(p.responsavelNome) : null, responsavel_cpf_hash: respCpfHash,
        });
        if (eDoc) {
          const md = String(eDoc.message || "");
          if (md.includes("duplicate") || md.includes("unique") || md.includes("cpf_hash")) {
            return jsonResponse({ sucesso: false, erro: "cpf_conflito" }, 409);
          }
          return jsonResponse({ sucesso: false, erro: "falha_documento" }, 500);
        }
        await supabase.from("atletas").update({ cpf_verificado: true }).eq("id", a.id);
      } else {
        // Atleta que JÁ tem documento não passa pelo backfill — e por isso a idade
        // dele nunca era conferida aqui (2º buraco provado pelo Guardião Jurídico).
        // Lê do arquivo: se for menor, o responsável tem de JÁ estar registrado.
        const idadeArquivo = idadeDeISO(doc.data_nascimento);
        if (idadeArquivo !== null && idadeArquivo < 18) {
          if (!String(doc.responsavel_nome ?? "").trim() || !String(doc.responsavel_cpf_hash ?? "").trim()) {
            return jsonResponse({ sucesso: false, erro: "responsavel_obrigatorio" }, 400);
          }
        }
        // `data_nascimento` nula no arquivo = idade DESCONHECIDA, e aqui isto passa.
        // É deliberado e está registrado no ROADMAP: a única origem de documento sem
        // data é o `INSCREVER`, que não tem guarda de menor nenhuma (item próprio).
        // Recusar aqui trancaria adulto de cadastro antigo por um defeito de outra
        // porta. Quando o `INSCREVER` exigir a data, esta ressalva morre.
      }

      // 5) Cria o vínculo no circuito (pendente de inclusão pelo admin). NUNCA toca no rating nacional.
      const { error: eMem } = await supabase.from("circuito_atletas").insert({
        circuito_id: circuitoId, atleta_id: a.id,
        status: "ativo", pendente_circuito: true, saldo_temp: 0, vitorias: 0, derrotas: 0,
        aceite_regulamento: true, data_aceite_regulamento: now, versao_regulamento: versaoDoCircuito,
        inscrito_em: now,
      });
      if (eMem) {
        const mm = String(eMem.message || "");
        if (mm.includes("duplicate") || mm.includes("unique")) return jsonResponse({ sucesso: false, erro: "ja_participa" }, 409);
        throw eMem;
      }
      return jsonResponse({ sucesso: true });
    }

    // LOGIN_ORGANIZADOR — Papéis Fatia 3. Autentica telefone+PIN (mesma trava do LOGIN)
    // e devolve SÓ os circuitos que a pessoa organiza (join circuito_organizadores→circuitos).
    // Não devolve o atleta, nem PIN, nem nada sensível. Front usa pra travar o painel no circuito.
    if (acao === "LOGIN_ORGANIZADOR") {
      const a = await acharAtleta(telefone);
      if (!a) return jsonResponse({ sucesso: false, erro: "cadastro_nao_encontrado" }, 404);
      if (a.pin_bloqueado_ate && new Date(a.pin_bloqueado_ate) > new Date()) {
        return jsonResponse({ sucesso: false, erro: "muitas_tentativas" }, 429);
      }
      if (!a.pin_hash) return jsonResponse({ sucesso: false, erro: "primeiro_acesso" }, 409);
      if (!pin) return jsonResponse({ sucesso: false, erro: "precisa_pin" }, 401);
      const okPin = await verifyPin(String(pin), a.pin_hash);
      if (!okPin) {
        const tent = (a.pin_tentativas || 0) + 1;
        const upd = tent >= MAX_TENTATIVAS_PIN
          ? { pin_tentativas: 0, pin_bloqueado_ate: new Date(Date.now() + BLOQUEIO_MINUTOS * 60000).toISOString() }
          : { pin_tentativas: tent };
        await supabase.from("atletas").update(upd).eq("id", a.id);
        return jsonResponse({ sucesso: false, erro: "pin_incorreto" }, 401);
      }
      await supabase.from("atletas").update({ pin_tentativas: 0, pin_bloqueado_ate: null }).eq("id", a.id);
      if (a.status !== "ativo") return jsonResponse({ sucesso: false, erro: "cadastro_inativo" }, 403);

      const { data: vinc } = await supabase.from("circuito_organizadores")
        // `org_ve_financeiro` REMOVIDO daqui de propósito, 19/09/2026. Ele
        // estava no repositório e não no ar, e o CHANGELOG registra que essa
        // metade do financeiro do organizador "deploya com o 1º circuito
        // vendido" — decisão do Juliano, condição que ainda não ocorreu.
        // Publicar o login-atleta por causa do fail-closed do PARTICIPAR não
        // pode antecipar uma liberação que ele amarrou a outro gatilho.
        // (Retificação do guardião de Segurança, que antes recomendara subir
        // junto e reviu ao ler o CHANGELOG.)
        .select("circuito_id, circuitos!inner(id,slug,nome_circuito,sistema,pareamento,ativo)")
        .eq("atleta_id", a.id);
      const circuitos = (vinc ?? [])
        .map((v: any) => v.circuitos)
        .filter((c: any) => c && c.ativo && c.slug !== "bh")
        .map((c: any) => ({ id: c.id, slug: c.slug, nome: c.nome_circuito, sistema: c.sistema, pareamento: c.pareamento }));
      return jsonResponse({ sucesso: true, dados: { ok: true, circuitos } });
    }

    // SESSAO — reidrata o atleta a partir do token salvo (reabrir o app, sem PIN).
    // Devolve o atleta + circuitos (inclui privados, pois o token prova a identidade).
    if (acao === "SESSAO") {
      const atletaId = await atletaPorToken(body?.token);
      if (!atletaId) return jsonResponse({ sucesso: false, erro: "sessao_invalida" }, 401);
      const { data: full } = await supabase.from("atletas").select(COLS).eq("id", atletaId).single();
      if (!full || full.status !== "ativo") return jsonResponse({ sucesso: false, erro: "cadastro_inativo" }, 403);
      const circs = await circuitosDoAtleta(atletaId);
      return jsonResponse({ sucesso: true, dados: { ok: true, atleta: full, circuitos: circs } });
    }

    // LOGOUT_SESSAO — revoga o token (logout de verdade). Best-effort.
    if (acao === "LOGOUT_SESSAO") {
      const t = body?.token;
      if (t && typeof t === "string") {
        const hash = await sha256hex(t);
        await supabase.from("atleta_sessao").delete().eq("token_hash", hash);
      }
      return jsonResponse({ sucesso: true });
    }

    // PRECO — preço/isenção da temporada do PRÓPRIO atleta, autenticado pelo token de
    // sessão. Fecha o vazamento: a função de preço não responde mais a qualquer anônimo
    // que saiba um id (os ids são públicos no ranking); só o dono da sessão vê o seu preço.
    if (acao === "PRECO") {
      const atletaId = await atletaPorToken(body?.token);
      if (!atletaId) return jsonResponse({ sucesso: false, erro: "sessao_invalida" }, 401);
      const { data: preco, error: ePreco } = await supabase.rpc("preco_temporada_atleta", { p_id: atletaId });
      if (ePreco) return jsonResponse({ sucesso: false, erro: "erro_preco" }, 500);
      return jsonResponse({ sucesso: true, dados: preco });
    }

    return jsonResponse({ sucesso: false, erro: `Ação desconhecida: ${acao}` }, 400);
  } catch (e) {
    console.error(e);
    return jsonResponse({ sucesso: false, erro: (e as any).message || "Erro interno" }, 500);
  }
});
