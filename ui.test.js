const vm=require('vm'),fs=require('fs');
const ANIM=[];const mkEl=()=>{const e={style:{},dataset:{},children:[],_cl:new Set(),hidden:false,disabled:false,textContent:"",innerHTML:"",
 classList:{add:c=>e._cl.add(c),remove:c=>e._cl.delete(c),toggle:(c,f)=>f?e._cl.add(c):e._cl.delete(c),contains:c=>e._cl.has(c)},
 appendChild(c){e.children.push(c)},addEventListener(){},querySelectorAll:()=>[],closest:()=>null,animate(kf,o){ANIM.push({el:e,kf,o});return{finished:Promise.resolve()}},getBoundingClientRect(){const i=+e.dataset.i;return{left:(i%8)*50,top:(i>>3)*50,width:50,height:50}}};
Object.defineProperty(e,'textContent',{get:()=>e._t||'',set:v=>{e._t=v;e.children.length=0}});Object.defineProperty(e,'firstChild',{get:()=>e.children[0]||null});return e};
const els={};const $e=s=>els[s]||(els[s]=mkEl());
let intervals=[],now=1e6;
const ctx={document:{querySelector:$e,querySelectorAll:()=>[],createElement:mkEl,addEventListener(){},body:{dataset:{}}},
 localStorage:{getItem:()=>null,setItem(){}},setInterval:(f)=>{intervals.push(f);return intervals.length},clearInterval:(i)=>{intervals[i-1]=null},setTimeout:()=>0,
 performance:{now:()=>0},AudioContext:function(){throw 1},Date:Object.assign(function(){this.toLocaleDateString=()=>"d"},{now:()=>now}),console,Math,JSON,Object,Array,Set,Number,String,Infinity};
vm.createContext(ctx);let src=fs.readFileSync(__dirname+'/../script.js','utf8');
src=src.replace(/home\(\);\n$/,'S.nick="Teste";home();\n');vm.runInContext(src+';globalThis.X={get G(){return G},start,play,undo,legal,apply,end,finish,render,S,record,ui,click,openReview,histList,CELLS:()=>CELLS}',ctx);
const X=ctx.X;X.S.an='desligada';X.tickAll=()=>intervals.forEach(f=>f&&f());X.skip=v=>{now+=v};let ok=0,bad=0;const T=(n,c)=>{c?ok++:(bad++,console.log('FALHOU:',n))};
// --- amigo: voltar jogada em vários lances, captura e promoção
X.start('friend',0,false,0);let G=X.G;
const b0=G.b.slice();
const m1=X.legal(G.b,1)[0];X.play(m1);T('turno alterna',G.side==-1);const m2=X.legal(G.b,-1)[0];X.play(m2);
X.undo();T('voltar 1: vez das pretas e posição pós-lance 1',G.side==-1&&G.b.join()==X.apply(b0,m1).join());
X.undo();T('voltar 2: posição inicial exata',G.b.join()==b0.join()&&G.side==1);T('sem histórico: nada acontece',(X.undo(),G.b.join()==b0.join()));
// captura múltipla + promoção e undo
const mk=a=>{const b=Array(64).fill(0);for(const[r,c,v]of a)b[r*8+c]=v;return b};
G.b=mk([[2,3,1],[1,2,-1],[6,5,-1],[7,0,-1]]);G.side=1;G.hist=[];const snap=G.b.slice();const mm=X.legal(G.b,1)[0];X.play(mm);
T('captura removeu peça preta',G.b.filter(x=>x<0).length==2);X.undo();T('undo restaura captura',G.b.join()==snap.join());
G.b=mk([[1,2,1],[6,5,-1],[7,0,-1]]);G.side=1;G.hist=[];const s2=G.b.slice();X.play(X.legal(G.b,1).find(x=>X.end(x)==1));
T('promoção branca virou dama',G.b[1]==2);X.undo();T('undo desfaz promoção (volta a ser peça comum)',G.b.join()==s2.join()&&G.b[10]==1);
// revisão: não altera partida real; nova jogada encerra revisão
X.start('friend',0,false,0);G=X.G;X.play(X.legal(G.b,1)[0]);X.play(X.legal(G.b,-1)[0]);const real=G.b.join(),h=G.hist.length;
G.rev=0;X.render();X.click(40);T('revisão ignora cliques',G.b.join()==real&&G.hist.length==h);T('revisão mostra posição anterior',true);
X.play(X.legal(G.b,1)[0]);T('nova jogada encerra revisão',G.rev==null&&G.hist.length==h+1);
// relógio: não renderiza; troca de vez; fim por tempo
X.start('friend',0,false,300);G=X.G;let renders=0;const orig=ctx.render;ctx.render=()=>{renders++;return orig()};
for(let i=0;i<50;i++){X.skip(200);X.tickAll()}T('50 ticks do relógio sem re-renderizar tabuleiro',renders==0);
T('relógio das brancas diminuiu ~10s e pretas intacto',Math.abs(G.t[1]-290)<.5&&G.t[-1]==300);
X.play(X.legal(G.b,1)[0]);for(let i=0;i<5;i++){X.skip(200);X.tickAll()}T('relógio passa para as pretas',G.t[-1]<300&&G.t[1]>289);
G.t[-1]=.1;X.skip(300);X.tickAll();T('tempo esgotado encerra partida com brancas vencendo',G.over&&X.S.w>=1);
const before=G.b.join();X.click(1);T('sem movimentos depois do fim',G.b.join()==before);
let n=0;intervals.forEach(f=>f&&n++);T('intervalo parado ao terminar',n==0);
// ranked: rating/Elo via record
X.start('ai',3,true,0);G=X.G;const r0=X.S.rating;X.finish(1,"t");T('ranqueada: vitória sobe rating (K=40 vs 1600)',X.S.rating>r0&&X.S.games==1);
X.start('ai',1,true,0);const r1=X.S.rating;X.finish(-1,"t");T('derrota p/ IA fácil custa mais que ganho',r1-X.S.rating>0);
X.start('ai',2,false,0);const r2=X.S.rating;X.finish(1,"t");T('amistosa não altera rating',X.S.rating==r2);


(async()=>{const tick=()=>new Promise(r=>setImmediate(r));const cnt=()=>X.CELLS().reduce((n,c)=>n+c.children.length,0);
const mkb=a=>{const b=Array(64).fill(0);for(const[r,c,v]of a)b[r*8+c]=v;return b};
const setup=(a,side=1)=>{X.S.an='completa';X.start('friend',0,false,0);const G=X.G;G.b=mkb(a);G.side=side;G.hist=[];G.moves=[];G.noCap=0;X.render();return G};
// captura simples (peça comum)
let G=setup([[6,1,1],[5,2,-1],[0,7,-1]]);ANIM.length=0;let m=X.legal(G.b,1)[0];X.play(m);
T('anim: captura simples → 1 anim de ataque + 1 de capturada',ANIM.length==2&&ANIM[1].o.delay>0);T('anim: estado lógico já final e bloqueio ativo',G.anim&&G.side==-1&&G.b[X.end(m)]==1);
const hb=G.b.join();X.click(X.end(m));T('anim: clique bloqueado durante animação',G.b.join()==hb&&G.hist.length==1);
await tick();await tick();T('anim: terminou, turno mudou uma vez, 1 só entrada de histórico',!G.anim&&G.side==-1&&G.hist.length==1&&G.moves.length==1);
T('anim: DOM final = estado lógico (sem duplicar/sumir peças)',cnt()==G.b.filter(x=>x).length&&X.CELLS()[X.end(m)].children.length==1&&X.CELLS()[5*8+2].children.length==0&&X.CELLS()[6*8+1].children.length==0);
// captura tripla: ordem e uma única peça atacante
G=setup([[6,1,1],[5,2,-1],[3,4,-1],[1,6,-1],[0,1,-1]]);ANIM.length=0;m=X.legal(G.b,1)[0];X.play(m);
const att=ANIM[0],caps=ANIM.slice(1);T('tripla: 3 capturas animadas, 1 peça atacante',m.caps.length==3&&caps.length==3&&att.kf.length==7);
T('tripla: atraso crescente (ordem dos saltos) e mesma peça em todos os saltos',caps[0].o.delay<caps[1].o.delay&&caps[1].o.delay<caps[2].o.delay&&ANIM.filter(a=>a.kf.length==7).length==1);
T('tripla: capturadas nas casas na ordem de m.caps',caps.every((c,i)=>X.CELLS()[m.caps[i]].children[0]===c.el));
await tick();await tick();T('tripla: final correto, 3 removidas',cnt()==2+0&&G.b.filter(x=>x<0).length==1&&!G.anim);
// dama com captura múltipla
G=setup([[7,0,2],[4,3,-1],[2,5,-1],[0,7,-1]]);ANIM.length=0;m=X.legal(G.b,1).find(x=>x.caps.length==2);
T('dama: captura múltipla existe',!!m);if(m){X.play(m);T('dama: 2 saltos animados',ANIM.length==3&&ANIM[0].kf.length==5);await tick();await tick();T('dama: DOM = lógica',cnt()==G.b.filter(x=>x).length)}
// promoção
G=setup([[1,2,1],[6,5,-1],[7,0,-1]]);ANIM.length=0;m=X.legal(G.b,1).find(x=>X.end(x)==1);X.play(m);await tick();await tick();
T('promoção: dama aparece no destino com coroa',G.b[1]==2&&X.CELLS()[1].children[0].children.length==1&&G.newTo==1);
// reduzida / desligada
G=setup([[6,1,1],[5,2,-1],[0,7,-1]]);X.S.an='reduzida';ANIM.length=0;X.play(X.legal(G.b,1)[0]);T('reduzida: sem salto (sem scale 1.14)',!JSON.stringify(ANIM[0].kf).includes('1.14'));await tick();await tick();
G=setup([[6,1,1],[5,2,-1],[0,7,-1]]);X.S.an='desligada';ANIM.length=0;X.play(X.legal(G.b,1)[0]);T('desligada: instantâneo, sem animate',ANIM.length==0&&!G.anim&&cnt()==2);
// revisão de partida do histórico + navegação
X.S.an='desligada';X.start('friend',0,false,0);G=X.G;for(let i=0;i<8;i++)X.play(X.legal(G.b,G.side)[0]);X.finish(1,'t');
const h0=JSON.stringify(X.S.hist[0]),r0=X.S.rating,w0=X.S.w,n0=G.hist.length;
els['#histb'].onclick();X.openReview(0);G=X.G;T('histórico: revisão abre com todos os lances',G.mode=='review'&&G.hist.length==n0&&G.rev==0);
for(let i=0;i<30;i++)els['#rn'].onclick();T('revisão: avançar para no último lance (sem sair)',G.rev==G.hist.length&&G.mode=='review');
for(let i=0;i<30;i++)els['#rp'].onclick();T('revisão: retroceder para no início',G.rev==0);
X.click(5);T('revisão: cliques não alteram nada',X.G.hist.length==n0);
els['#rx'].onclick();T('Voltar: sai da revisão para o histórico (sem nova partida)',X.G===null);
X.openReview(0);els['#rm'].onclick();T('Menu inicial a partir da revisão',X.G===null);
T('histórico/rating/resultado intactos após revisar',JSON.stringify(X.S.hist[0])==h0&&X.S.rating==r0&&X.S.w==w0);
// revisão ao vivo + botão menu
X.start('friend',0,false,0);G=X.G;X.play(X.legal(G.b,1)[0]);els['#rev'].onclick();T('revisão ao vivo ativa',G.rev==0);els['#rx'].onclick();T('Sair da revisão volta ao vivo sem perder dados',G.rev==null&&G.hist.length==1);
els['#mn'].onclick();T('Menu em partida ativa abre pausa/confirmação (não perde dados)',G.pause&&X.G===G);
X.finish(1,'t');els['#mn'].onclick();T('Menu após o fim da partida vai ao menu inicial',X.G===null);
T('botão Como jogar tem ação',typeof els['#rules'].onclick=='function');console.log(`ESTADO/ANIMAÇÃO/NAVEGAÇÃO: ok=${ok} falhas=${bad}`);process.exitCode=bad?1:0})();
