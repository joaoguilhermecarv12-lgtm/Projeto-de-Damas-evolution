const fs=require('fs');eval(fs.readFileSync(__dirname+'/../script.js','utf8').split('/* ===== ARMAZENAMENTO')[0]+`;globalThis.E={newBoard,legal,apply,captures,bestMove,evalB,end};`);
const {newBoard,legal,apply,bestMove,end}=E;let ok=0,bad=0;const T=(n,c)=>{c?ok++:(bad++,console.log('FALHOU:',n))};
const mk=a=>{const b=Array(64).fill(0);for(const[r,c,v]of a)b[r*8+c]=v;return b};
let b=newBoard();T('7 jogadas iniciais brancas',legal(b,1).length==7);T('12 peças cada',b.filter(x=>x>0).length==12&&b.filter(x=>x<0).length==12);
T('casas escuras apenas',b.every((v,i)=>!v||((i>>3)+(i&7))%2==1));
// captura obrigatória: branca em (5,2), preta em (4,3), (3,4) vazio; outra branca pode mover
b=mk([[5,2,1],[4,3,-1],[7,0,1],[0,1,-1]]);let m=legal(b,1);T('captura obrigatória',m.every(x=>x.caps.length));
// homem captura para trás
b=mk([[3,4,1],[4,3,-1],[0,1,-1]]);T('homem captura para trás',legal(b,1).some(x=>x.caps[0]==4*8+3&&end(x)==5*8+2));
// lei da maioria: sequência de 2 vs captura simples
b=mk([[7,0,1],[6,1,-1],[4,3,-1],[3,4,-1],[5,2,1],[0,7,-1]]);// peça (5,2) pode capturar (4,3)->(3,4)? ocupado. testar outro
b=mk([[6,1,1],[5,2,-1],[3,4,-1],[1,6,-1],[7,4,1],[6,5,-1],[0,1,-1]]);m=legal(b,1);T('maioria: só sequência máxima',new Set(m.map(x=>x.caps.length)).size==1&&m[0].caps.length==3);
// múltiplas
T('captura múltipla remove 3',m[0].caps.length==3&&apply(b,m[0]).filter(x=>x<0).length==b.filter(x=>x<0).length-3);
// dama voadora: captura à distância e pousa em qualquer casa livre após
b=mk([[7,0,2],[4,3,-1],[0,7,-1]]);m=legal(b,1);T('dama voadora captura longe',m.length==3&&m.every(x=>x.caps[0]==4*8+3)&&[...m.map(x=>end(x))].sort().join()==[3*8+4,2*8+5,1*8+6].sort().join());
// peça não pula a mesma duas vezes / capturado bloqueia
// promoção branca e preta
b=mk([[1,2,1],[7,6,-1]]);let n=apply(b,legal(b,1).find(x=>end(x)==1));T("promoção branca",n[1]==2);
b=mk([[6,1,-1],[0,7,1]]);n=apply(b,legal(b,-1).find(x=>end(x)==7*8+0));T('promoção preta',n[56]==-2);
// homem que passa pela última linha capturando e segue como homem não promove
b=mk([[2,3,1],[1,2,-1],[1,4,-1],[3,6,-1],[3,2,-1]]);m=legal(b,1);T('passar pela última linha e continuar não promove',m.every(x=>x.path.length>1?apply(b,x)[end(x)]!=2||(end(x)>>3)==0:true));
// dama move
b=mk([[4,3,2],[0,7,-1]]);T('dama move à distância',legal(b,1).length>10);
// vitória sem jogadas
b=mk([[0,1,1]]);T('lado sem peças não tem lances',legal(b,-1).length==0);
// simulação de partidas completas: IA(3) x IA(2) ; confere legalidade, nenhum erro, termina
function game(dw,db){let b=newBoard(),side=1,n=0,noCap=0;while(n<400){const ms=legal(b,side);if(!ms.length)return -side;
 const mv=bestMove(b,side,side==1?dw:db,side==1?0:10);if(!ms.some(x=>x.from==mv.from&&end(x)==end(mv)&&x.caps.length==mv.caps.length)){T('jogada ilegal da IA',false);return 9}
 const bc=b.filter(x=>x).length;b=apply(b,mv);T('contagem de peças',b.filter(x=>x).length==bc-mv.caps.length);
 noCap=(mv.caps.length||Math.abs(b[end(mv)])==1)?0:noCap+1;if(noCap>=40)return 0;side=-side;n++}return 0}
const t0=Date.now();const r=[game(4,2),game(2,4),game(4,4)];console.log('resultados das 3 partidas IA x IA:',r,(Date.now()-t0)+'ms');
// IA mais forte vence mais fraca
T('IA profunda não perde p/ IA rasa nas duas cores',!(r[0]==-1)&&!(r[1]==1));
// imutabilidade/undo lógico
b=newBoard();const snap=b.slice();const mv=legal(b,1)[0];apply(b,mv);T('apply não muta o estado',b.every((v,i)=>v===snap[i]));
// Elo
const el=(R,Ro,w,K)=>Math.round(K*(w-1/(1+10**((Ro-R)/400))));
T('Elo: vencer mais forte rende mais',el(1000,1600,1,40)>el(1000,800,1,40));T('Elo: perder p/ mais fraco custa mais',el(1000,800,0,40)<el(1000,1600,0,40));T('Elo: empate x mais forte positivo',el(1000,1600,.5,40)>0);T('Elo soma zero p/ mesmo K',el(1200,1200,1,20)==10);
console.log(`REGRAS/IA/ELO: ok=${ok} falhas=${bad}`);process.exitCode=bad?1:0;
