// Harness Guardião: prova que "desfazer processamento" via RECÁLCULO reproduz EXATAMENTE
// o estado anterior. Espelha a lógica do PROCESSAR_RODADA (ramo A rating + ramo B pontos).
// calcElo real é tabela inteira determinística — aqui uso uma tabela determinística equivalente.
const TAB = [{max:20,v:8,p:-8},{max:50,v:6,p:-6},{max:1e9,v:4,p:-4}]; // favorito
const TABAZ= [{max:20,v:10,p:-10},{max:50,v:12,p:-12},{max:1e9,v:15,p:-15}]; // azarão vence
function cbtm(rv,rp){ const diff=Math.abs(rv-rp); const az=rv<rp; const t=az?TABAZ:TAB; const f=t.find(x=>diff<=x.max); return {v:f.v,p:f.p}; }
function calcElo(ra,rb,res){ if(res===1){const d=cbtm(ra,rb);return ra+d.v;} else {const d=cbtm(rb,ra);return ra+d.p;} }

// processa UMA partida no mapa (muta), igual ao edge
function proc(match, map, sistema){
  const p1=map[match.a1], p2=map[match.a2]; if(!p1||!p2) return;
  const p1wins = match.s1>match.s2;
  if(sistema==="B"){
    map[match.a1]={...p1, saldo:(p1.saldo||0)+(p1wins?2:1), vit:(p1.vit||0)+(p1wins?1:0), der:(p1.der||0)+(p1wins?0:1)};
    map[match.a2]={...p2, saldo:(p2.saldo||0)+(p1wins?1:2), vit:(p2.vit||0)+(p1wins?0:1), der:(p2.der||0)+(p1wins?1:0)};
    return;
  }
  const nr1=calcElo(p1.rating,p2.rating,p1wins?1:0), nr2=calcElo(p2.rating,p1.rating,p1wins?0:1);
  const d1=nr1-p1.rating, d2=nr2-p2.rating; const data=match.aprov;
  map[match.a1]={...p1, rating:nr1, saldo:(p1.saldo||0)+d1, vit:(p1.vit||0)+(p1wins?1:0), der:(p1.der||0)+(p1wins?0:1),
    pico:Math.max(p1.pico||p1.rating,nr1), hist:[...(p1.hist||[]),{data,rating:nr1}].slice(-30)};
  map[match.a2]={...p2, rating:nr2, saldo:(p2.saldo||0)+d2, vit:(p2.vit||0)+(p1wins?0:1), der:(p2.der||0)+(p1wins?1:0),
    pico:Math.max(p2.pico||p2.rating,nr2), hist:[...(p2.hist||[]),{data,rating:nr2}].slice(-30)};
}
function clone(m){ return JSON.parse(JSON.stringify(m)); }
function processarRodada(rodada, map, sistema, matches){
  // ordem determinística = por 'aprov' asc (igual ao edge order admin_aprovado_em)
  matches.filter(x=>x.rodada===rodada).sort((a,b)=>a.aprov.localeCompare(b.aprov)).forEach(x=>proc(x,map,sistema));
}
// gera uma temporada pseudo-determinística
function gerarTemporada(seed, sistema){
  let s=seed; const rnd=()=>{ s=(s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  const N=8; const atletas={}; const start={};
  for(let i=0;i<N;i++){ atletas["a"+i]={id:"a"+i, rating:300+Math.floor(rnd()*400), saldo:0,vit:0,der:0,pico:0,hist:[]}; atletas["a"+i].pico=atletas["a"+i].rating; }
  const startSnap=clone(atletas);
  const matches=[]; const R=6;
  for(let r=1;r<=R;r++){ const ids=Object.keys(atletas); for(let k=0;k+1<ids.length;k+=2){ const a1=ids[k],a2=ids[k+1]; matches.push({rodada:r,a1,a2,s1:rnd()<.5?3:1,s2:rnd()<.5?3:1===3?1:2,aprov:`2026-01-${String(r).padStart(2,'0')}T${String(k).padStart(2,'0')}:00:00Z`}); } }
  return {start:startSnap, matches, R, sistema};
}
function deepEq(a,b){ return JSON.stringify(a)===JSON.stringify(b); }

let pass=0, fail=0;
for(const sistema of ["A","B"]){
  for(let seed=1; seed<=20; seed++){
    const {start,matches,R}=gerarTemporada(seed*7, sistema);
    // FORWARD: processa 1..R, salvando o estado ANTES de cada rodada J
    const map=clone(start); const antesDe={};
    for(let J=1;J<=R;J++){ antesDe[J]=clone(map); processarRodada(J,map,sistema,matches); }
    // UNDO(J) = reset ao start + reprocessa 1..J-1; deve bater com antesDe[J]
    for(let J=1;J<=R;J++){
      const rec=clone(start); for(let r=1;r<J;r++) processarRodada(r,rec,sistema,matches);
      if(deepEq(rec, antesDe[J])) pass++; else { fail++; console.log(`✗ sistema ${sistema} seed ${seed} undo(${J}) DIVERGE`); }
    }
  }
}
console.log(`\n${pass} provas OK, ${fail} falharam`);
process.exit(fail?1:0);
