// Um Supabase de mentira, que vive na memória.
//
// Por que existe: o motor (admin-action) só fala com o banco por
// `.from("tabela").select().eq(...)`. Se um objeto imitar essa conversa, dá para
// rodar o motor DE VERDADE — o arquivo que está em produção, sem cópia nem
// reescrita — e depois olhar o que ele gravou.
//
// Cobre o que o motor realmente usa: select, insert, update, delete, upsert,
// eq/neq/in/or/gte/lte, order, limit, single, maybeSingle, contagem exata e rpc.
// Se um teste novo precisar de algo que não está aqui, o erro é explícito —
// nunca devolve resultado errado em silêncio.

function clonar(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

// Traduz um pedaço de filtro do PostgREST ("coluna.op.valor") num teste.
function condicaoDeTexto(texto) {
  const [coluna, op, ...resto] = texto.split(".");
  const valor = resto.join(".");
  return (linha) => comparar(linha[coluna], op, valor);
}

function comparar(campo, op, valor) {
  // Tudo que chega de texto é comparado como texto — é o que o PostgREST faz
  // com os filtros da URL.
  const a = campo === null || campo === undefined ? campo : String(campo);
  const b = valor === null || valor === undefined ? valor : String(valor);
  switch (op) {
    case "eq": return a === b;
    case "neq": return a !== b;
    case "gte": return a >= b;
    case "lte": return a <= b;
    case "gt": return a > b;
    case "lt": return a < b;
    case "is": return b === "null" ? (campo === null || campo === undefined) : campo === (b === "true");
    default: throw new Error(`banco-falso: filtro "${op}" ainda nao implementado`);
  }
}

class Consulta {
  constructor(banco, tabela) {
    this.banco = banco;
    this.tabela = tabela;
    this.filtros = [];
    this.operacao = "select";
    this.dados = null;
    this.ordenacao = [];
    this.limite = null;
    this.somenteContagem = false;
    this.contar = false;
    this.devolverLinhas = false;
    this.conflito = null;
    this.colunas = "*";
  }

  // ---- filtros ----
  eq(coluna, valor) { this.filtros.push((l) => comparar(l[coluna], "eq", valor)); return this; }
  neq(coluna, valor) { this.filtros.push((l) => comparar(l[coluna], "neq", valor)); return this; }
  gte(coluna, valor) { this.filtros.push((l) => comparar(l[coluna], "gte", valor)); return this; }
  lte(coluna, valor) { this.filtros.push((l) => comparar(l[coluna], "lte", valor)); return this; }
  gt(coluna, valor) { this.filtros.push((l) => comparar(l[coluna], "gt", valor)); return this; }
  lt(coluna, valor) { this.filtros.push((l) => comparar(l[coluna], "lt", valor)); return this; }
  is(coluna, valor) { this.filtros.push((l) => comparar(l[coluna], "is", valor)); return this; }
  in(coluna, lista) {
    const conjunto = (lista || []).map(String);
    this.filtros.push((l) => conjunto.includes(String(l[coluna])));
    return this;
  }
  or(texto) {
    const partes = String(texto).split(",").map(condicaoDeTexto);
    this.filtros.push((l) => partes.some((teste) => teste(l)));
    return this;
  }

  // ---- forma do resultado ----
  select(colunas, opcoes) {
    this.colunas = colunas || "*";
    if (this.operacao === "select") {
      this.contar = opcoes?.count === "exact";
      this.somenteContagem = opcoes?.head === true;
    } else {
      // insert(...).select() / update(...).select(): devolve as linhas afetadas
      this.devolverLinhas = true;
    }
    return this;
  }
  order(coluna, opcoes) {
    this.ordenacao.push({ coluna, crescente: opcoes?.ascending !== false });
    return this;
  }
  limit(n) { this.limite = n; return this; }

  // ---- escrita ----
  insert(linhas) { this.operacao = "insert"; this.dados = Array.isArray(linhas) ? linhas : [linhas]; return this; }
  update(campos) { this.operacao = "update"; this.dados = campos; return this; }
  delete() { this.operacao = "delete"; return this; }
  upsert(linhas, opcoes) {
    this.operacao = "upsert";
    this.dados = Array.isArray(linhas) ? linhas : [linhas];
    this.conflito = (opcoes?.onConflict || "").split(",").map((c) => c.trim()).filter(Boolean);
    return this;
  }

  // ---- execução ----
  linhasDaTabela() {
    if (!this.banco.tabelas[this.tabela]) this.banco.tabelas[this.tabela] = [];
    return this.banco.tabelas[this.tabela];
  }

  filtrar(linhas) {
    return linhas.filter((l) => this.filtros.every((teste) => teste(l)));
  }

  // No Postgres, colunas como `criado_em timestamptz DEFAULT now()` se preenchem
  // sozinhas quando o insert nao as manda. Sem isto, um filtro por data — como o
  // do freio de tentativas de PIN — nunca acharia nada, e o teste passaria por
  // engano acreditando que o freio funciona.
  comPadroes(linha) {
    const daTabela = this.banco.padroes[this.tabela];
    if (!daTabela) return linha;
    const saida = { ...linha };
    for (const coluna in daTabela) {
      if (saida[coluna] === undefined) saida[coluna] = daTabela[coluna]();
    }
    return saida;
  }

  // O motor pede o join do PostgREST assim: select("*, atletas!inner(*)").
  // Aqui isso vira: para cada linha, achar a linha de `atletas` cujo `id` bate
  // com a coluna `atleta_id` desta tabela, e pendurar no campo `atletas`.
  // `!inner` significa que linha sem par correspondente some do resultado —
  // é assim no Postgres, e o teste tem que sentir isso igual.
  aplicarJuncao(achadas) {
    const pedidos = [...String(this.colunas || "").matchAll(/([a-z_]+)!inner\s*\(/g)].map((m) => m[1]);
    if (pedidos.length === 0) return achadas;
    let saida = achadas;
    for (const alvo of pedidos) {
      const relacao = this.banco.relacoes[`${this.tabela}.${alvo}`] ||
        { coluna: alvo.replace(/s$/, "") + "_id", chave: "id" };
      const doOutroLado = this.banco.tabelas[alvo] || [];
      saida = saida
        .map((linha) => {
          const par = doOutroLado.find((o) => String(o[relacao.chave]) === String(linha[relacao.coluna]));
          return par ? { ...linha, [alvo]: par } : null;
        })
        .filter(Boolean);
    }
    return saida;
  }

  executar() {
    this.banco.registro.push({ tabela: this.tabela, operacao: this.operacao });

    // O Postgres recusa gravacao por NOT NULL, chave repetida, tipo errado.
    // Sem poder simular isso, um teste nunca prova que o codigo TRATA o erro —
    // so que ele funciona quando tudo da certo. `banco.recusar(...)` fecha essa
    // lacuna: foi o que faltou quando o servidor respondia "sucesso" com a
    // gravacao falhando (incidente das mensagens pendentes, 08/09/2026).
    const recusa = this.banco.recusas.find((r) => r.tabela === this.tabela && r.operacao === this.operacao);
    if (recusa) {
      if (recusa.vezes !== undefined) {
        recusa.vezes -= 1;
        if (recusa.vezes <= 0) this.banco.recusas = this.banco.recusas.filter((r) => r !== recusa);
      }
      return { data: null, error: recusa.erro, count: null };
    }

    const linhas = this.linhasDaTabela();

    if (this.operacao === "select") {
      let achadas = this.filtrar(linhas);
      for (const { coluna, crescente } of this.ordenacao) {
        achadas = achadas.slice().sort((a, b) => {
          const x = a[coluna], y = b[coluna];
          if (x === y) return 0;
          const menor = (x === null || x === undefined) ? true : (y === null || y === undefined) ? false : x < y;
          return (menor ? -1 : 1) * (crescente ? 1 : -1);
        });
      }
      if (this.limite !== null) achadas = achadas.slice(0, this.limite);
      const contagem = this.contar ? this.filtrar(linhas).length : null;
      achadas = this.aplicarJuncao(achadas);
      return { data: this.somenteContagem ? null : clonar(achadas), error: null, count: contagem };
    }

    if (this.operacao === "insert") {
      const novas = clonar(this.dados).map((l) => this.comPadroes(l));
      linhas.push(...novas);
      return { data: this.devolverLinhas ? clonar(novas) : null, error: null, count: null };
    }

    if (this.operacao === "update") {
      const alvo = this.filtrar(linhas);
      for (const linha of alvo) Object.assign(linha, clonar(this.dados));
      return { data: this.devolverLinhas ? clonar(alvo) : null, error: null, count: null };
    }

    if (this.operacao === "delete") {
      const alvo = this.filtrar(linhas);
      const sobrando = linhas.filter((l) => !alvo.includes(l));
      this.banco.tabelas[this.tabela] = sobrando;
      return { data: this.devolverLinhas ? clonar(alvo) : null, error: null, count: null };
    }

    if (this.operacao === "upsert") {
      const tocadas = [];
      for (const nova of clonar(this.dados).map((l) => this.comPadroes(l))) {
        const existente = this.conflito.length
          ? linhas.find((l) => this.conflito.every((c) => String(l[c]) === String(nova[c])))
          : null;
        if (existente) { Object.assign(existente, nova); tocadas.push(existente); }
        else { linhas.push(nova); tocadas.push(nova); }
      }
      return { data: this.devolverLinhas ? clonar(tocadas) : null, error: null, count: null };
    }

    throw new Error(`banco-falso: operacao "${this.operacao}" desconhecida`);
  }

  single() {
    const r = this.executar();
    const linhas = r.data || [];
    if (linhas.length !== 1) {
      return { data: null, error: { message: `esperava 1 linha em ${this.tabela}, achou ${linhas.length}`, code: "PGRST116" }, count: null };
    }
    return { data: linhas[0], error: null, count: r.count };
  }

  maybeSingle() {
    const r = this.executar();
    const linhas = r.data || [];
    if (linhas.length > 1) {
      return { data: null, error: { message: `esperava no maximo 1 linha em ${this.tabela}, achou ${linhas.length}` }, count: null };
    }
    return { data: linhas[0] ?? null, error: null, count: r.count };
  }

  // `await consulta` sem .single() cai aqui.
  then(resolve, rejeitar) {
    try { resolve(this.executar()); } catch (e) { (rejeitar || resolve)({ data: null, error: { message: String(e.message || e) } }); }
  }
}

export function criarBancoFalso(tabelasIniciais = {}, funcoes = {}, relacoes = {}, padroes = {}) {
  const banco = {
    relacoes,               // { "circuito_atletas.atletas": { coluna, chave } } — o padrao ja cobre o caso comum
    padroes,                // { tabela: { coluna: () => valor } } — o DEFAULT de coluna do Postgres
    recusas: [],            // gravacoes que o banco vai recusar de proposito (ver `recusar`)
    tabelas: clonar(tabelasIniciais),
    registro: [],           // toda operação feita, para os testes conferirem o que foi tocado
    funcoesChamadas: [],
  };

  banco.cliente = {
    from(tabela) { return new Consulta(banco, tabela); },
    async rpc(nome, argumentos) {
      banco.funcoesChamadas.push({ nome, argumentos: clonar(argumentos) });
      if (!(nome in funcoes)) {
        return { data: null, error: { message: `banco-falso: RPC "${nome}" nao foi definida no teste` } };
      }
      const resultado = await funcoes[nome](banco, argumentos);
      return { data: resultado === undefined ? null : resultado, error: null };
    },
  };

  // Atalhos para os testes lerem o resultado sem repetir código.
  // Faz o banco recusar uma operacao, como o Postgres faria.
  //   banco.recusar("mensagens_enviadas", "insert", { message: "null value in column texto", code: "23502" })
  banco.recusar = (tabela, operacao, erro, vezes) => {
    banco.recusas.push({ tabela, operacao, erro, vezes });
  };

  banco.linhas = (tabela) => clonar(banco.tabelas[tabela] || []);
  banco.acha = (tabela, teste) => (banco.tabelas[tabela] || []).map(clonar).find(teste);
  banco.impressao = () => JSON.stringify(banco.tabelas);

  return banco;
}
