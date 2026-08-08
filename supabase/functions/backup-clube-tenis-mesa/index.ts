import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const TABLES = ["atletas", "chaves", "partidas", "configuracao", "mensagens_enviadas"] as const;
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
    let removidos: string[] = [];
    if (futuros.length > 0) {
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove(futuros);
      if (rmErr) throw new Error("remove: " + rmErr.message);
      removidos = futuros;
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
        const { data, error, count } = await supabase.from(t).select("*", { count: "exact" }).range(0, 999999);
        if (error) throw new Error(`select ${t}: ${error.message}`);
        const rows = data ?? [];
        if (count !== null && count !== rows.length) {
          return json({ ok: false, error: `Contagem divergente em ${t}: count=${count}, linhas=${rows.length}. Backup abortado.` }, 500);
        }
        contagem_linhas[t] = rows.length;
        dump[t] = rows;
      }
      const backup = {
        backup_gerado_em: now.toISOString(),
        data_referencia: dateStr,
        projeto_supabase: PROJETO,
        contagem_linhas,
        atletas: dump.atletas,
        chaves: dump.chaves,
        partidas: dump.partidas,
        configuracao: dump.configuracao,
        mensagens_enviadas: dump.mensagens_enviadas,
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
