// Bateria da função de BACKUP — a primeira que ela tem.
//
// Por que isto existe: a `backup-clube-tenis-mesa` entrou nesta onda sem ninguém
// notar (eu tratei a onda como cinco funções durante um dia inteiro), ela APAGA
// ARQUIVOS, e não tinha nenhum teste. Achado dos Supervisores de Confiabilidade e
// Jurídico. É a única coisa entre um engano e a perda definitiva de dado — e a
// ÚNICA função do projeto que, errando, destrói o que deveria proteger.
//
// Não dava para testar antes: o dublê de storage não sabia `upload` nem `download`.
// Aprendeu em 01/10/2026, junto com estes testes.
import { ok, igual, secao, placar } from "./ferramentas.mjs";
import { carregarFuncao } from "./carrega-motor.mjs";
import { criarBancoFalso } from "./banco-falso.mjs";

const HOJE = new Date();
const diaLocal = (d) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
}).format(d);
const nomeDe = (d) => `backup_${diaLocal(d)}_clube_tenis_mesa.json`;
const diasAtras = (n) => { const d = new Date(HOJE); d.setDate(d.getDate() - n); return d; };
const mesesAtras = (n) => { const d = new Date(HOJE); d.setMonth(d.getMonth() - n); return d; };

async function montar({ arquivos = [], tabelas = {} } = {}) {
  const banco = criarBancoFalso({
    atletas: [{ id: "a1", nome: "Ana" }],
    chaves: [], partidas: [], configuracao: [{ id: 1 }], mensagens_enviadas: [],
    circuitos: [{ id: "c1", slug: "bh" }],
    circuito_atletas: [{ id: "ca1", circuito_id: "c1", atleta_id: "a1", saldo_temp: 4 }],
    circuito_organizadores: [], pagamentos: [{ id: "p1", atleta_id: "a1" }],
    circuito_cobranca: [], cobrancas: [], partidas_historico: [],
    solicitacoes_wo: [{ id: "w1", atleta_id: "a1", atleta_nome: "Ana", round: 1, status: "aprovado",
                        justificativa: "SEGREDO MEDICO", comprovante_url: "atestado.pdf", circuito_id: "c1" }],
    ...tabelas,
  }, {}, {}, {}, { backups: [...arquivos] });
  const { handler } = await carregarFuncao("backup-clube-tenis-mesa", banco);
  const chamar = async (query = "") => {
    const r = await handler(new Request(`http://teste/${query}`, { method: "POST" }));
    return { status: r.status, corpo: await r.json().catch(() => ({})) };
  };
  return { banco, chamar };
}

secao("Backup — o que ele copia");
{
  const { banco, chamar } = await montar();
  const r = await chamar();
  ok(r.corpo?.ok === true, `o backup roda (erro: ${JSON.stringify(r.corpo?.error)})`);
  igual(banco.arquivos.backups.length, 1, "e grava UM arquivo no balde");
  igual(banco.arquivos.backups[0], nomeDe(HOJE), "com o nome do dia de hoje");

  const conteudo = JSON.parse(new TextDecoder().decode(banco.conteudos[`backups/${nomeDe(HOJE)}`]));

  // O MODELO MULTI-CIRCUITO — faltava INTEIRO até 01/10/2026.
  for (const t of ["circuitos", "circuito_atletas", "pagamentos", "partidas_historico"]) {
    ok(Array.isArray(conteudo[t]),
      `o arquivo tem a tabela \`${t}\` — o Modelo B inteiro estava fora do backup`);
  }
  igual(conteudo.circuito_atletas?.length, 1,
    "e `circuito_atletas` traz as LINHAS, não só a contagem — era o estado sazonal de todo atleta");
  igual(conteudo.circuito_atletas?.[0]?.saldo_temp, 4, "com os pontos da temporada dentro");
  igual(conteudo.pagamentos?.length, 1, "e os pagamentos (dinheiro) estão lá");

  // A regressão que mais importa: ler e não gravar.
  const lidas = Object.keys(conteudo.contagem_linhas || {});
  const gravadas = lidas.filter((t) => Array.isArray(conteudo[t]));
  igual(gravadas.length, lidas.length,
    "TODA tabela contada no relatório também está GRAVADA no arquivo — a lista que lê e a que grava são a mesma");
}

secao("Backup — o que ele NÃO copia, de propósito");
{
  const { banco, chamar } = await montar();
  await chamar();
  const conteudo = JSON.parse(new TextDecoder().decode(banco.conteudos[`backups/${nomeDe(HOJE)}`]));

  // Dado de saúde não vai para o balde: backup restaurado RESSUSCITA o que foi
  // apagado, e isso desfaria uma exclusão de LGPD no dia da restauração.
  const wo = conteudo.solicitacoes_wo?.[0] || {};
  ok(!("justificativa" in wo),
    "a justificativa (dado de saúde) NÃO vai para o backup — restaurar ressuscitaria dado apagado");
  ok(!("comprovante_url" in wo),
    "nem o caminho do atestado médico");
  igual(wo.status, "aprovado",
    "mas o registro de competição é preservado — status, rodada, quem jogou");
  igual(wo.atleta_nome, "Ana", "inclusive o nome, que é o que torna o registro útil");

  for (const t of ["atleta_documento", "atleta_sessao", "tentativas_login_admin", "arquivo_wo_justificativas"]) {
    ok(!(t in conteudo), `\`${t}\` fica de fora — e o motivo está escrito no código`);
  }
  ok(Array.isArray(conteudo.nao_copiadas) && conteudo.nao_copiadas.length > 0,
    "e o arquivo DIZ o que ficou de fora — sem isso, «não tem» é indistinguível de «perdeu»");
}

secao("Backup — retenção de 6 meses (decisão do Juliano, 29/09)");
{
  const velho = nomeDe(mesesAtras(7));
  const limite = nomeDe(mesesAtras(5));
  const recente = nomeDe(diasAtras(3));
  const estranho = "anotacao-do-juliano.json";
  const { banco, chamar } = await montar({ arquivos: [velho, limite, recente, estranho] });
  const r = await chamar();
  ok(r.corpo?.ok === true, "o backup roda com arquivos antigos no balde");
  const ficaram = banco.arquivos.backups;
  ok(!ficaram.includes(velho), "arquivo de 7 meses é apagado — a política promete 6");
  ok(ficaram.includes(limite), "o de 5 meses FICA — a retenção não pode comer o que ainda vale");
  ok(ficaram.includes(recente), "e o recente fica");
  ok(ficaram.includes(estranho),
    "arquivo com nome FORA do padrão não é tocado — na dúvida, guardar (ele pode não ser nosso)");
}

secao("Backup — as travas que impedem perda");
{
  // Não sobrescreve o arquivo do dia: rodar duas vezes não substitui o primeiro.
  const { banco, chamar } = await montar();
  await chamar();
  const primeiro = banco.conteudos[`backups/${nomeDe(HOJE)}`];
  const r2 = await chamar();
  ok(r2.corpo?.existed === true, "rodar de novo no mesmo dia reconhece que já existe");
  igual(banco.arquivos.backups.length, 1, "e não cria um segundo arquivo");
  ok(banco.conteudos[`backups/${nomeDe(HOJE)}`] === primeiro,
    "e NÃO sobrescreve o conteúdo do primeiro — o backup do dia é imutável");
}
{
  // Se a LEITURA de uma tabela falhar, o backup ABORTA em vez de gravar um arquivo
  // incompleto que pareceria bom.
  const { banco, chamar } = await montar();
  banco.recusar("circuito_atletas", "select", { message: "connection reset", code: "08006" });
  const r = await chamar();
  ok(r.corpo?.ok !== true, "leitura de tabela falhando ABORTA o backup");
  igual(banco.arquivos.backups.length, 0,
    "e NENHUM arquivo é gravado — backup incompleto é pior que backup nenhum, porque parece bom");
}
{
  // Se o UPLOAD falhar, o erro não é engolido.
  const { banco, chamar } = await montar();
  banco.recusar("backups", "upload", { message: "sem espaco", statusCode: "507" });
  const r = await chamar();
  ok(r.corpo?.ok !== true, "falha de gravação no balde é reportada, não engolida");
}

process.exit(placar("Backup"));
