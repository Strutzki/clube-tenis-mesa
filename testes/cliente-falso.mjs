// Fica no lugar do `@supabase/supabase-js` quando o motor roda nos testes.
// O banco de mentira é posto em `globalThis.__bancoFalsoDoTeste` pelo
// carrega-motor.mjs antes do arquivo do motor ser importado.
export function createClient() {
  const banco = globalThis.__bancoFalsoDoTeste;
  if (!banco) throw new Error("cliente-falso: nenhum banco de mentira foi preparado pelo teste");
  return banco.cliente;
}
