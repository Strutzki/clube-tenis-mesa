import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ── O QUE O BACKUP COPIA, E O QUE NAO COPIA DE PROPOSITO ──────────────────────
//
// Reescrito em 01/10/2026. A lista anterior era `["atletas", "chaves", "partidas",
// "configuracao", "mensagens_enviadas"]` -- escrita antes do Modelo B, e nunca
// atualizada. Resultado: O MODELO MULTI-CIRCUITO INTEIRO ESTAVA FORA DO BACKUP.
// Medido em producao antes de mexer: 15 vinculos em `circuito_atletas` (o estado
// sazonal de TODO atleta: pontos, vitorias, W.O., pagamento, aceite), 12
// `pagamentos` (dinheiro), 1 `circuitos` (a configuracao do circuito), 5
// `solicitacoes_wo`. Nada disso tinha copia.
//
// `partidas_historico` esta vazia hoje, e e a mais importante das novas: e para la
// que a VIRADA DE TEMPORADA arquiva as partidas, e a virada NAO SE DESFAZ. Uma
// temporada inteira perdida sem backup e perda definitiva.
//
// Cada entrada pode nomear COLUNAS. Nomear nao e detalhe: `select *` num backup
// copia dado sensivel para um balde, e backup restaurado RESSUSCITA o que foi
// apagado. Por isso duas regras:
//   · `solicitacoes_wo` entra SEM `justificativa` e SEM `comprovante_url` -- sao
//     dado de saude (art. 5o, II). O registro de competicao e preservado; o motivo
//     medico nao vai para o balde.
//   · as tabelas da lista NAO_COPIADAS ficam de fora inteiras (ver abaixo).
const TABLES: ReadonlyArray<{ nome: string; colunas: string }> = [
  // Identidade e competicao
  { nome: "atletas", colunas: "*" },
  { nome: "chaves", colunas: "*" },
  { nome: "partidas", colunas: "*" },
  { nome: "partidas_historico", colunas: "*" },   // a virada NAO se desfaz
  { nome: "configuracao", colunas: "*" },
  { nome: "mensagens_enviadas", colunas: "*" },
  // Modelo B — faltavam TODAS
  { nome: "circuitos", colunas: "*" },
  { nome: "circuito_atletas", colunas: "*" },
  { nome: "circuito_organizadores", colunas: "*" },
  // Dinheiro
  { nome: "pagamentos", colunas: "*" },
  { nome: "circuito_cobranca", colunas: "*" },
  { nome: "cobrancas", colunas: "*" },
  // W.O. — SEM as duas colunas de dado de saude
  { nome: "solicitacoes_wo", colunas: "id,match_id,atleta_id,atleta_nome,adversario_id,adversario_nome,round,status,criado_em,respondido_em,motivo_recusa,notificado_solicitante,notificado_adversario,circuito_id" },
];

// NAO COPIADAS, e cada uma tem motivo escrito. Esta lista existe para ninguem
// "completar" o backup sem pensar -- acrescentar qualquer uma destas e decisao, nao
// manutencao.
//
//  · `arquivo_wo_justificativas` e `atleta_documento` -- dado de saude e hash de CPF.
//    Backup restaurado RESSUSCITA dado apagado: copiar isto para o balde desfaria
//    uma exclusao de LGPD no dia da restauracao. Quem precisa do original tem a
//    tabela, que e privada (RLS ligada, nenhuma policy).
//  · `atleta_sessao` -- sessoes vivas. Restaurar sessao velha e reabrir acesso que
//    foi encerrado. Perder sessoes custa um login; restaurar custa seguranca.
//  · `tentativas_login_admin`, `tentativas_busca_cpf`, `tentativas_busca_telefone` --
//    registro de tentativas, que so serve para a janela de 15 minutos. Restaurar
//    tentativas antigas poderia TRANCAR o painel logo apos uma restauracao.
//  · `instagram_artes`, `instagram_artes_chunk`, `instagram_config`,
//    `instagram_publicacoes` -- conteudo gerado, reconstituivel, e o `_chunk` e
//    pesado. Fica fora por tamanho, nao por sigilo; se um dia importar, entra.
const NAO_COPIADAS = [
  "arquivo_wo_justificativas", "atleta_documento", "atleta_sessao",
  "tentativas_login_admin", "tentativas_busca_cpf", "tentativas_busca_telefone",
  "instagram_artes", "instagram_artes_chunk", "instagram_config", "instagram_publicacoes",
] as const;
const PROJETO = "eultwfzzlgcmcikobmmy (clube-tenis-mesa)";
const BUCKET = "backups";
const TZ = "America/Sao_Paulo";
const NAME_RE = /^backup_(\d{4}-\d{2}-\d{2})_clube_tenis_mesa\.json$/;

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

function localDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

async function sha256hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const ab = await new Response(cs.readable).arrayBuffer();
  return new Uint8Array(ab);
}

Deno.serve(async (req: Request) => {
  try {
    const wantContent = new URL(req.url).searchParams.get("content") === "1";
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    const now = new Date();
    const dateStr = localDateStr(now);
    const filename = `backup_${dateStr}_clube_tenis_mesa.json`;

    const { data: existing, error: listErr } = await supabase.storage.from(BUCKET).list("", { limit: 1000 });
    if (listErr) throw new Error("list: " + listErr.message);
    const files = existing ?? [];

    const futuros = files.map((f) => f.name).filter((n) => {
      const m = NAME_RE.exec(n);
      return m ? m[1] > dateStr : false;
    });

    // ── RETENCAO: 6 MESES ─────────────────────────────────────────────────────
    // DECISAO DO JULIANO, 29/09/2026. E ela existe porque a politica de privacidade
    // vai PROMETER esse prazo ao titular, e ate hoje esta funcao NAO TINHA REGRA DE
    // RETENCAO NENHUMA -- o unico apagamento era o de data futura acima, que e
    // protecao contra relogio errado. Medido antes de escrever: 109 arquivos, o mais
    // antigo de 11/07/2026, 80 dias de cobertura e CRESCENDO SEM LIMITE.
    //
    // Sem isto, escrever "6 meses" na politica seria promessa falsa no dia 1 -- e o
    // Guardiao Juridico foi explicito: "escrever um prazo que nao se cumpre e pior
    // que nao ter a frase". O prazo e a unica coisa que liga o texto ao sistema.
    //
    // Por que 6 meses cobre o proposito: o backup existe para restaurar o sistema
    // depois de uma falha, e uma falha que so se descobre 6 meses depois nao se
    // restaura a partir de backup -- se restaura a partir do que o clube tem
    // registrado fora do app.
    //
    // ⚠️ A CONTA E POR DATA NO NOME, nao por `created_at`: o nome e a fonte de
    // verdade deste bucket (o arquivo do dia e sobrescrito, entao o `created_at`
    // pode ser mais novo que o conteudo). Arquivo com nome fora do padrao NAO e
    // apagado -- na duvida, guardar.
    const RETENCAO_MESES = 6;
    const corte = new Date(now);
    corte.setMonth(corte.getMonth() - RETENCAO_MESES);
    const corteStr = localDateStr(corte);
    const vencidos = files.map((f) => f.name).filter((n) => {
      const m = NAME_RE.exec(n);
      return m ? m[1] < corteStr : false; // nome fora do padrao: nao mexe
    });

    const aApagar = [...new Set([...futuros, ...vencidos])];
    let removidos: string[] = [];
    if (aApagar.length > 0) {
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove(aApagar);
      if (rmErr) throw new Error("remove: " + rmErr.message);
      removidos = aApagar;
      console.log(`retencao ${RETENCAO_MESES} meses (corte ${corteStr}): ${vencidos.length} vencido(s), ${futuros.length} com data futura`);
    }

    const jaExiste = files.some((f) => f.name === filename);
    let bytes: Uint8Array;
    let contagem_linhas: Record<string, number> | undefined;

    if (jaExiste) {
      if (!wantContent) {
        return json({ ok: true, existed: true, filename, removidos, message: "Backup de hoje ja existe; nao foi sobrescrito." });
      }
      const { data: dl, error: dlErr } = await supabase.storage.from(BUCKET).download(filename);
      if (dlErr) throw new Error("download: " + dlErr.message);
      bytes = new Uint8Array(await dl.arrayBuffer());
    } else {
      contagem_linhas = {};
      const dump: Record<string, unknown[]> = {};
      for (const t of TABLES) {
        const { data, error, count } = await supabase.from(t.nome).select(t.colunas, { count: "exact" }).range(0, 999999);
        if (error) throw new Error(`select ${t.nome}: ${error.message}`);
        const rows = data ?? [];
        if (count !== null && count !== rows.length) {
          return json({ ok: false, error: `Contagem divergente em ${t.nome}: count=${count}, linhas=${rows.length}. Backup abortado.` }, 500);
        }
        contagem_linhas[t.nome] = rows.length;
        dump[t.nome] = rows;
      }
      const backup = {
        backup_gerado_em: now.toISOString(),
        data_referencia: dateStr,
        projeto_supabase: PROJETO,
        contagem_linhas,
        // ⚠️ ERA UMA LISTA DE CINCO NOMES ESCRITA A MAO AQUI -- `atletas: dump.atletas,
        // chaves: dump.chaves, ...`. Duas listas para a mesma coisa: a que LE (TABLES) e
        // a que GRAVA (esta). Acrescentar uma tabela em TABLES e esquecer aqui faria o
        // backup ler a tabela, contar as linhas no `contagem_linhas`, e NAO GRAVAR OS
        // DADOS -- um backup que parece completo pelo relatorio e nao tem o conteudo.
        // E a terceira vez nesta onda que duas listas para a mesma coisa divergem (as
        // outras: as colunas do atleta, e a lista NOT NULL). Agora e UMA so.
        ...dump,
        // Registro do que ficou de fora, DENTRO do arquivo. Quem abrir o backup daqui a
        // seis meses tem de saber o que nao vai achar la -- sem isso, "nao tem" e
        // indistinguivel de "perdeu".
        nao_copiadas: NAO_COPIADAS,
      };
      bytes = new TextEncoder().encode(JSON.stringify(backup, null, 2));
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(filename, bytes, { contentType: "application/json", upsert: false });
      if (upErr) throw new Error("upload: " + upErr.message);
    }

    const sha256 = await sha256hex(bytes);
    const resp: Record<string, unknown> = { ok: true, existed: jaExiste, filename, size_bytes: bytes.length, sha256, removidos };
    if (contagem_linhas) resp.contagem_linhas = contagem_linhas;
    if (wantContent) {
      const gz = await gzip(bytes);
      resp.content_gzip_base64 = toBase64(gz);
      resp.gzip_size = gz.length;
    }
    return json(resp);
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
