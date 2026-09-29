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
    // ⚠️ `.is(coluna, null)` NUNCA CASAVA (achado em 29/09/2026, ao escrever o
    // teste do `SOLICITAR_EXCLUSAO`). `b` já vem como o `null` de verdade, não a
    // string "null", então a condição `b === "null"` era sempre falsa e o filtro
    // caía no ramo booleano, comparando o campo com `false`.
    // Efeito: qualquer `.is(x, null)` e qualquer `.not(x, "is", null)` devolviam a
    // resposta errada. É a mesma família do NOT NULL: o instrumento discordando do
    // banco em silêncio.
    // O `undefined` conta como nulo de propósito — no Postgres, coluna sem valor
    // É nula, e nos fixtures da bateria ela simplesmente não existe no objeto.
    case "is":
      if (valor === null || valor === undefined || b === "null") {
        return campo === null || campo === undefined;
      }
      return campo === (b === "true");
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
  // `.not(coluna, operador, valor)` — a negacao do PostgREST.
  // ⚠️ NAO EXISTIA ate 29/09/2026, e a ausencia dele foi a PROVA de que o
  // `CANCELAR_EXCLUSAO` nao era executado por teste nenhum: o Guardiao de
  // Seguranca tentou ataca-lo e recebeu `.not is not a function` com a bateria
  // 1320/0 verde. Uma acao nova de LGPD, numa onda sobre LGPD, sem um unico teste
  // que a rodasse. Ele tambem e usado em dois pontos do `despachos-do-dia`, que
  // pela mesma razao eram inalcancaveis pelo instrumento.
  not(coluna, operador, valor) {
    this.filtros.push((l) => !comparar(l[coluna], operador, valor));
    return this;
  }
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
  // PROJECAO de colunas. O PostgREST devolve SO o que o select pede; sem isto o
  // banco falso devolvia a linha inteira e uma coisa grave passava batido: trocar
  // `select("id, telefone")` por `select("*")` em LISTAR_TELEFONES deixava a
  // bateria VERDE, mesmo passando a devolver `pin_hash` de todos os atletas do
  // circuito. Apontado pelo Guardiao Juridico em 27/09/2026.
  // Colunas embutidas (`atletas!inner(*)`) sao resolvidas antes, em aplicarJuncao,
  // e o apelido delas e preservado aqui.
  projetar(linhas) {
    const pedido = String(this.colunas || "*");
    const topo = [];
    let nivel = 0, atual = "";
    for (const ch of pedido) {
      if (ch === "(") { nivel++; atual += ch; continue; }
      if (ch === ")") { nivel--; atual += ch; continue; }
      if (ch === "," && nivel === 0) { topo.push(atual); atual = ""; continue; }
      atual += ch;
    }
    if (atual.trim()) topo.push(atual);
    const nomes = topo.map((t) => t.trim()).filter(Boolean);

    // ⚠️ DOIS FUROS NO MESMO LUGAR, achados pelo Guardião de Seguranca em
    // 29/09/2026 — e sao a QUARTA ocorrencia da mesma familia (27/09 no select,
    // 28/09 na escrita, 28/09 na guarda irma, agora no EMBED).
    //
    // (1) `if (nomes.some(n => n === "*")) return linhas` desligava a projecao
    //     INTEIRA quando havia um `*` no topo. E o `circuito-dados` pede
    //     `select("*, atletas!inner(<colunas>)")` -- ou seja, o `*` do topo
    //     apagava tambem a restricao das colunas do atleta.
    // (2) mesmo projetando, guardava so a CHAVE do embed (`manter.add(emb[1])`)
    //     e nunca projetava as colunas DE DENTRO dele.
    //
    // Consequencia medida: ele sabotou o porteiro para devolver `telefone` e
    // `pin_hash` de todos os atletas e a bateria ficou VERDE. Ou seja, TODA
    // assercao da forma "esta acao devolve so X" que passe por um JOIN estava
    // improvada -- inclusive as que protegem `desconto_pct`, `isento` e o
    // `pin_hash`, que sao a Regra 2 do projeto.
    //
    // O PostgREST projeta o recurso embutido de forma independente do topo:
    // `*` no topo devolve todas as colunas DA TABELA, e o embed continua
    // limitado ao que foi pedido dentro dos parenteses. E o que se imita aqui.
    const embeds = new Map(); // chave do embed -> Set de colunas, ou null p/ "*"
    let topoTudo = false;
    const manter = new Set();
    for (const n of nomes) {
      const emb = n.match(/^([A-Za-z0-9_]+)(?:![a-z]+)?\s*\(([\s\S]*)\)$/);
      if (emb) {
        const chave = emb[1];
        const dentro = emb[2].split(",").map((x) => x.trim()).filter(Boolean);
        embeds.set(chave, dentro.includes("*") ? null : new Set(dentro));
        manter.add(chave);
      } else if (n === "*") {
        topoTudo = true;
      } else {
        manter.add(n);
      }
    }
    // Sem nada pedido e sem embed: contrato antigo, devolve tudo.
    if (topoTudo && embeds.size === 0) return linhas;

    const projetarEmbed = (valor, colunas) => {
      if (colunas === null || valor == null) return valor;
      const um = (o) => {
        if (o == null || typeof o !== "object") return o;
        const fora = {};
        for (const k of Object.keys(o)) if (colunas.has(k)) fora[k] = o[k];
        return fora;
      };
      return Array.isArray(valor) ? valor.map(um) : um(valor);
    };

    return linhas.map((l) => {
      const fora = {};
      for (const k of Object.keys(l)) {
        if (embeds.has(k)) { fora[k] = projetarEmbed(l[k], embeds.get(k)); continue; }
        if (topoTudo || manter.has(k)) fora[k] = l[k];
      }
      return fora;
    });
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

    // ⚠️ NOT NULL — ESTA LACUNA JA CUSTOU UM NO-GO, em 29/09/2026.
    //
    // O comentario antigo daqui dizia "sem poder simular isso" e parava nisso. O
    // Guardiao de Confiabilidade mostrou o preco: a `anonimizar-atleta` gravava
    // `justificativa: null` numa coluna que a producao tem como NOT NULL. A
    // bateria ficava 1320/0 VERDE, e havia ate uma assercao AFIRMANDO o valor
    // proibido -- executando a funcao de verdade e certificando um estado que o
    // banco nao pode guardar. Em producao a funcao quebraria DEPOIS de ja ter
    // apagado as fotos, o CPF e as sessoes, respondendo "nada foi alterado", e a
    // repeticao falharia sempre no mesmo ponto: o titular perderia o CPF e nao
    // receberia a exclusao. 5 dos 15 atletas cairiam nisso.
    //
    // Agora o banco falso recusa `null` em coluna declarada NOT NULL, como o
    // Postgres. A lista esta em `COLUNAS_NOT_NULL` (ferramentas.mjs) e cobre as
    // colunas que o motor grava -- nao o esquema inteiro. QUAIS CAMINHOS FICARAM
    // DE FORA, de propriedade: chave repetida (UNIQUE), tipo errado, CHECK e
    // chave estrangeira continuam sem modelo. Enumerado aqui de proposito, pela
    // regra de 28/09 -- conserto de instrumento e conserto de UM caminho, e
    // declarar a classe resolvida e como esta lacuna nasceu.
    //
    // `banco.recusar(...)` continua existindo para o resto: ele injeta a recusa
    // que o codigo TEM de tratar, e foi o que faltou quando o servidor respondia
    // "sucesso" com a gravacao falhando (incidente das mensagens, 08/09/2026).
    if (this.operacao === "insert" || this.operacao === "update" || this.operacao === "upsert") {
      const obrigatorias = this.banco.naoNulas[this.tabela];
      if (obrigatorias) {
        for (const linha of (Array.isArray(this.dados) ? this.dados : [this.dados])) {
          for (const col of obrigatorias) {
            if (linha && Object.prototype.hasOwnProperty.call(linha, col) && linha[col] === null) {
              return {
                data: null,
                error: {
                  message: `null value in column "${col}" of relation "${this.tabela}" violates not-null constraint`,
                  code: "23502",
                },
              };
            }
          }
        }
      }
    }
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
      achadas = this.projetar(achadas);
      return { data: this.somenteContagem ? null : clonar(achadas), error: null, count: contagem };
    }

    // ⚠️ `insert/update/delete/upsert` + `.select(...)` TAMBEM projetam colunas.
    // Faltava aqui (28/09/2026): a projecao estava so no caminho do `select`, e o
    // retorno de escrita devolvia a linha inteira, qualquer que fosse a lista
    // pedida. Consequencia medida por mutacao: trocar
    // `.select("id, slug, nome_circuito, sistema, pareamento, regulamento_versao, max_atletas")`
    // por uma lista SEM a versao deixava a bateria VERDE -- a assercao que conferia
    // o recibo devolvido pelo CRIAR_CIRCUITO nao tinha como enxergar a diferenca.
    // E a familia do defeito e conhecida: e o mesmo furo do `select("*")` em
    // LISTAR_TELEFONES, que ficou verde devolvendo `pin_hash`. Um banco falso que
    // devolve mais do que o real e mais generoso que producao, e generosidade em
    // instrumento de medicao se chama falso verde.
    if (this.operacao === "insert") {
      const novas = clonar(this.dados).map((l) => this.comPadroes(l));
      linhas.push(...novas);
      return { data: this.devolverLinhas ? this.projetar(clonar(novas)) : null, error: null, count: null };
    }

    if (this.operacao === "update") {
      const alvo = this.filtrar(linhas);
      for (const linha of alvo) Object.assign(linha, clonar(this.dados));
      return { data: this.devolverLinhas ? this.projetar(clonar(alvo)) : null, error: null, count: null };
    }

    if (this.operacao === "delete") {
      const alvo = this.filtrar(linhas);
      const sobrando = linhas.filter((l) => !alvo.includes(l));
      this.banco.tabelas[this.tabela] = sobrando;
      return { data: this.devolverLinhas ? this.projetar(clonar(alvo)) : null, error: null, count: null };
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

export function criarBancoFalso(tabelasIniciais = {}, funcoes = {}, relacoes = {}, padroes = {}, arquivosIniciais = {}, colunasNaoNulas = {}) {
  const banco = {
    relacoes,               // { "circuito_atletas.atletas": { coluna, chave } } — o padrao ja cobre o caso comum
    padroes,                // { tabela: { coluna: () => valor } } — o DEFAULT de coluna do Postgres
    recusas: [],            // gravacoes que o banco vai recusar de proposito (ver `recusar`)
    naoNulas: colunasNaoNulas, // { tabela: [colunas NOT NULL] } — o Postgres recusa null nelas
    tabelas: clonar(tabelasIniciais),
    registro: [],           // toda operação feita, para os testes conferirem o que foi tocado
    funcoesChamadas: [],
    assinaturas: [],         // links assinados que a funcao pediu ao storage
    // ARQUIVOS do storage de mentira: { bucket: [nome, ...] }. Existe desde
    // 29/09/2026, quando o Guardiao Juridico mostrou que a exclusao de dados
    // NAO apagava a foto do atleta -- e o bucket dela e PUBLICO, entao a URL
    // continuava servindo o rosto para sempre. Sem guardar arquivo, o teste nao
    // tinha como provar que a foto some.
    arquivos: clonar(arquivosIniciais),
    remocoes: [],            // { bucket, caminhos } — o que a funcao mandou apagar
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
    // STORAGE de mentira. Existe para a bateria poder carregar funcoes que
    // assinam arquivo de bucket privado (comprovante-url). Nao guarda arquivo
    // nenhum: registra o que foi pedido e devolve uma URL de mentira, para o
    // teste poder afirmar QUAL caminho foi assinado — e, principalmente, que a
    // assinatura so acontece depois da autorizacao passar.
    storage: {
      from(bucket) {
        return {
          async createSignedUrl(caminho, segundos) {
            banco.assinaturas.push({ bucket, caminho, segundos });
            return { data: { signedUrl: `https://falso/${bucket}/${caminho}?exp=${segundos}` }, error: null };
          },
          // `list` e `remove` existem desde 29/09/2026 para a exclusao de dados
          // poder ser PROVADA: a foto do atleta vive num bucket publico, e ate
          // entao a funcao anulava a URL no banco e deixava o ARQUIVO servindo.
          // O `prefixo` imita o `search` do Supabase, que e o que a funcao usa.
          async list(_pasta, opcoes) {
            const recusa = banco.recusas.find((r) => r.tabela === bucket && r.operacao === "list");
            if (recusa) return { data: null, error: recusa.erro };
            const todos = banco.arquivos[bucket] || [];
            const busca = opcoes?.search;
            const achados = busca ? todos.filter((n) => n.startsWith(busca)) : todos;
            return { data: achados.map((name) => ({ name })), error: null };
          },
          async remove(caminhos) {
            const recusa = banco.recusas.find((r) => r.tabela === bucket && r.operacao === "remove");
            if (recusa) return { data: null, error: recusa.erro };
            banco.remocoes.push({ bucket, caminhos: clonar(caminhos) });
            const antes = banco.arquivos[bucket] || [];
            banco.arquivos[bucket] = antes.filter((n) => !caminhos.includes(n));
            return { data: caminhos.map((name) => ({ name })), error: null };
          },
        };
      },
    },
  };

  // Atalhos para os testes lerem o resultado sem repetir código.
  // Faz o banco recusar uma operacao, como o Postgres faria.
  //   banco.recusar("mensagens_enviadas", "insert", { message: "null value in column texto", code: "23502" })
  banco.recusar = (tabela, operacao, erro, vezes) => {
    banco.recusas.push({ tabela, operacao, erro, vezes });
  };

  banco.arquivosDe = (bucket) => clonar(banco.arquivos[bucket] || []);
  banco.linhas = (tabela) => clonar(banco.tabelas[tabela] || []);
  banco.acha = (tabela, teste) => (banco.tabelas[tabela] || []).map(clonar).find(teste);
  banco.impressao = () => JSON.stringify(banco.tabelas);

  return banco;
}
