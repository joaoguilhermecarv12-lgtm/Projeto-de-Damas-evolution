"use strict";
/* ===== REGRAS (damas brasileiras) ===== */
// 1 = branca, 2 = dama branca, -1 = preta, -2 = dama preta. Brancas sobem (linha diminui).
const DIRS=[[-1,-1],[-1,1],[1,-1],[1,1]],inb=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
function newBoard(){const b=Array(64).fill(0);for(let r=0;r<8;r++)for(let c=0;c<8;c++)if((r+c)%2){if(r<3)b[r*8+c]=-1;if(r>4)b[r*8+c]=1}return b}
function captures(b,r0,c0,side){ // todas as sequências de captura (peça capturada só sai no fim; sem saltar 2x a mesma)
 const king=Math.abs(b[r0*8+c0])==2,bb=b.slice(),res=[];bb[r0*8+c0]=0;
 (function rec(r,c,caps,path){let found=false;
  for(const[dr,dc]of DIRS){let y=r+dr,x=c+dc;
   if(king)while(inb(y,x)&&!bb[y*8+x]){y+=dr;x+=dc}
   if(!inb(y,x))continue;const i=y*8+x;if(bb[i]*side>=0||caps.includes(i))continue;
   let ly=y+dr,lx=x+dc;
   while(inb(ly,lx)&&!bb[ly*8+lx]){found=true;rec(ly,lx,[...caps,i],[...path,ly*8+lx]);if(!king)break;ly+=dr;lx+=dc}}
  if(!found&&caps.length)res.push({from:r0*8+c0,path,caps})})(r0,c0,[],[]);
 return res}
function legal(b,side){let cp=[],mv=[];
 for(let i=0;i<64;i++){if(b[i]*side<=0)continue;const r=i>>3,c=i&7;cp.push(...captures(b,r,c,side))}
 if(cp.length){const m=Math.max(...cp.map(x=>x.caps.length));return cp.filter(x=>x.caps.length==m)} // lei da maioria
 for(let i=0;i<64;i++){if(b[i]*side<=0)continue;const r=i>>3,c=i&7,king=Math.abs(b[i])==2;
  for(const[dr,dc]of DIRS){if(!king&&dr!=-side)continue;let y=r+dr,x=c+dc;
   while(inb(y,x)&&!b[y*8+x]){mv.push({from:i,path:[y*8+x],caps:[]});if(!king)break;y+=dr;x+=dc}}}
 return mv}
function apply(b,m){const nb=b.slice();let p=nb[m.from];nb[m.from]=0;m.caps.forEach(i=>nb[i]=0);
 const to=m.path[m.path.length-1],row=to>>3;if(Math.abs(p)==1&&(p>0?row==0:row==7))p*=2;nb[to]=p;return nb}
const end=m=>m.path[m.path.length-1];
/* ===== IA ===== */
function evalB(b){let s=0;for(let i=0;i<64;i++){const p=b[i];if(!p)continue;const r=i>>3,c=i&7,a=Math.abs(p);
 let v=a==2?320:100;if(a==1)v+=(p>0?7-r:r)*5;if(c>1&&c<6&&r>1&&r<6)v+=4;if(a==1&&(p>0?r==7:r==0))v+=6;if(c==0||c==7)v+=2;s+=p>0?v:-v}return s}
let DL=0;function nm(b,side,d,a,be){if(DL&&performance.now()>DL)throw 0;const ms=legal(b,side);if(!ms.length)return-9000-d;if(!d)return evalB(b)*side;
 ms.sort((x,y)=>y.caps.length-x.caps.length);
 for(const m of ms){const s=-nm(apply(b,m),-side,d-1,-be,-a);if(s>a)a=s;if(a>=be)break}return a}
function bestMove(b,side,depth,noise){const ms=legal(b,side);let best=null,bs=-1e9;
 for(const m of ms){const s=-nm(apply(b,m),-side,depth-1,-1e9,noise?1e9:-bs)+Math.random()*noise;if(s>bs){bs=s;best=m}}return best}
/* ===== ARMAZENAMENTO ===== */
const DEF={w:0,l:0,d:0,xp:0,t:"verde",sw:"marfim",sb:"grafite",kc:"coroa",fx:true,an:(typeof matchMedia=="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches)?"desligada":"completa",m:"escuro",nick:"",av:"♟",rating:1000,best:1000,games:0,streak:0,maxS:0,rh:[1000],hist:[],tro:{},hi:0};let S;
try{S={...DEF,...JSON.parse(localStorage.getItem("damasEvo"))}}catch(e){S={...DEF}}
// sanitiza dados lidos do armazenamento (podem ter sido editados)
if(!/^[\p{L}\p{N}_-]{3,16}$/u.test(S.nick))S.nick="";if(!["♟","♛","🦊","🐺","🦉","🐯","🚀","🌿"].includes(S.av))S.av="♟";
if(!Array.isArray(S.hist))S.hist=[];if(!Array.isArray(S.rh)||!S.rh.length)S.rh=[S.rating|0||1000];if(!S.tro||typeof S.tro!="object")S.tro={};
const save=()=>{try{localStorage.setItem("damasEvo",JSON.stringify(S))}catch(e){}};
/* ===== SOM ===== */
let ac;function beep(f,d=.08,t="sine"){try{ac=ac||new AudioContext();const o=ac.createOscillator(),g=ac.createGain();o.type=t;o.frequency.value=f;g.gain.value=.08;
 g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+d);o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+d)}catch(e){}}
const snd={mv:()=>beep(440),cap:()=>{beep(220,.12,"square");setTimeout(()=>beep(330,.1,"square"),90)},win:()=>[523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,.2),i*140)),bad:()=>beep(120,.15,"sawtooth")};
/* ===== PARTIDA ===== */
// Camadas: regras/IA (acima) · estado da partida (G) · interface. G.hist guarda snapshots lógicos completos
// (tabuleiro com cor/tipo, vez, último lance, contador de empate, relógios) usados por voltar jogada e revisão.
// Um futuro modo online reaproveitaria legal/apply/snapshots, trocando apenas a origem dos lances.
const $=s=>document.querySelector(s);let G=null,tick=null,GID=0,CELLS=[];
const NAMES={1:"Brancas",[-1]:"Pretas"},OPP={1:800,2:1200,3:1600,4:1900}; // forças nominais, não calibradas
const DIFF={1:["Fácil","Ideal para iniciantes · jogadas aleatórias"],2:["Média","Desafios estratégicos · busca de 3 lances"],3:["Difícil","Estratégia avançada · Minimax de 6 lances"],4:["Especialista","Busca aprofundada, até 1,5 s por jogada"]};
const SKW={marfim:["#fff","#d2d2d2"],dourado:["#f6df8a","#c39a1f"],gelo:["#eaf7ff","#86b3d6"]},SKB={grafite:["#666","#262626"],carmim:["#d0564f","#6d1f1b"],esmeralda:["#45a077","#164a35"]};
const skinFor=p=>{const t=p>0?SKW:SKB;return t[p>0?S.sw:S.sb]||Object.values(t)[0]}; // ponto único: "ocultar skins do adversário" (online) entraria aqui
const esc=t=>String(t).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cyc=(a,v)=>a[(a.indexOf(v)+1)%a.length],fmt=s=>{s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};
const lvl=()=>Math.floor(S.xp/100)+1;
function show(id){document.querySelectorAll(".scr").forEach(e=>e.classList.toggle("on",e.id==id))}
function modal(h){$("#mb").innerHTML=h;$("#modal").classList.add("on")}const closeM=()=>$("#modal").classList.remove("on");
function stopClock(){clearInterval(tick);tick=null}
function buildBoard(){const bd=$("#board");bd.innerHTML="";CELLS=[];for(let i=0;i<64;i++){const d=document.createElement("div");d.dataset.i=i;bd.appendChild(d);CELLS.push(d)}}
function start(mode,diff,ranked,time){stopClock();closeM();
 G={id:++GID,mode,diff:+diff||0,ranked:!!ranked,timed:time>0,b:newBoard(),side:1,hist:[],last:[],sel:null,hint:[],over:false,pause:false,busy:false,noCap:0,rev:null,newTo:-1,anim:false,moves:[],t:{1:time,[-1]:time},cfg:[mode,diff,ranked,time]};
 show("game");$("#nw").textContent=mode=="ai"?S.av+" "+S.nick:"Brancas";$("#nb").textContent=mode=="ai"?"IA "+DIFF[G.diff][0]:"Pretas";
 $("#tw").style.visibility=$("#tb").style.visibility=G.timed?"visible":"hidden";
 $("#undo").hidden=!(mode=="friend"||(mode=="ai"&&!ranked));$("#hint").hidden=G.ranked;$("#rev").hidden=$("#pause").hidden=false;
 buildBoard();render();ui();showT();if(G.timed)startClock()}
function startClock(){let l=Date.now();const id=G.id;tick=setInterval(()=>{const n=Date.now(),dt=(n-l)/1000;l=n;if(!G||G.id!=id||G.over||G.pause)return;
 G.t[G.side]=Math.max(0,G.t[G.side]-dt);showT();if(G.t[G.side]<=0)finish(-G.side,"Tempo esgotado")},200)} // só atualiza texto: nunca reconstrói o tabuleiro
function showT(){if(G.timed){$("#tw").textContent=fmt(G.t[1]);$("#tb").textContent=fmt(G.t[-1])}}
function view(){const n=G.rev;return n==null||n>=G.hist.length?{b:G.b,last:G.last}:{b:G.hist[n].b,last:G.hist[n].last}}
function render(){if(G.anim)return;const{b,last}=view(),R=G.rev!=null,ms=!R&&!G.over?legal(G.b,G.side):[],sel=R?null:G.sel;
 for(let i=0;i<64;i++){const r=i>>3,c=i&7,p=b[i],d=CELLS[i];let cl="c"+((r+c)%2?" d":"");
  if(last.includes(i))cl+=" last";if(i==sel)cl+=" sel";if(!R&&G.hint.includes(i))cl+=" hint";if(sel!=null&&ms.some(m=>m.from==sel&&end(m)==i))cl+=" mv";
  const nw=!R&&S.fx&&G.newTo==i;const key=cl+"|"+p+S.sw+S.sb+S.kc+(nw?"n":"");
  if(d._k===key)continue;d._k=key;d.className=cl;d.textContent="";  // só recria a casa que realmente mudou
  if(p){const e=document.createElement("div"),sk=skinFor(p);e.className="p"+(Math.abs(p)==2?" k":"")+(nw?" new":"");
   e.style.background=`radial-gradient(circle at 35% 30%,${sk[0]},${sk[1]})`;
   if(Math.abs(p)==2){const k=document.createElement("span");k.className="cr";k.style.color=p>0?"#7a5c00":"#f6d86b";k.textContent=(S.kc=="estrela"?"★":"♛")+"\uFE0E";e.appendChild(k)}d.appendChild(e)}}}
function ui(){const R=G.rev!=null,ms=legal(G.b,G.side);$("#pw").classList.toggle("act",G.side==1&&!G.over);$("#pb").classList.toggle("act",G.side==-1&&!G.over);
 $("#rvbar").hidden=!R;if(R)$("#rl").textContent=`Posição ${Math.min(G.rev,G.hist.length)}/${G.hist.length}`;$("#rx").textContent=G.mode=="review"?"Voltar":"Sair da revisão";
 $("#rev").disabled=!G.hist.length||G.anim;$("#undo").disabled=!G.hist.length||G.over||G.busy||G.anim;
 if(R)$("#st").textContent=G.mode=="review"?"Revisão da partida · lance "+Math.min(G.rev,G.hist.length)+"/"+G.hist.length:"Revisando — a partida real não foi alterada";else if(!G.over)$("#st").textContent=(G.mode=="ai"?(G.side==1?"Sua vez":"IA pensando…"):"Vez das "+NAMES[G.side])+(ms.length&&ms[0].caps.length&&!G.busy?" · captura obrigatória":"")}
$("#board").addEventListener("click",e=>{const el=e.target.closest("[data-i]");if(el)click(+el.dataset.i)});
function bad(i,msg){snd.bad();const el=CELLS[i];el.classList.add("bad");$("#st").textContent=msg;setTimeout(()=>el.classList.remove("bad"),400)}
function click(i){if(!G||G.over||G.pause||G.busy||G.anim||G.rev!=null||(G.mode=="ai"&&G.side!=1))return;const ms=legal(G.b,G.side);G.hint=[];
 const m=G.sel!=null&&ms.find(x=>x.from==G.sel&&end(x)==i);if(m)return play(m);
 if(G.b[i]*G.side>0){if(ms.some(x=>x.from==i)){G.sel=i;render()}else bad(i,ms[0]&&ms[0].caps.length?"Captura obrigatória com outra peça!":"Esta peça não pode mover")}
 else if(G.sel!=null)bad(i,"Movimento inválido")}
/* Animação: só REPRODUZ um lance já validado e aplicado ao estado lógico (G.b). Nunca decide regras. */
function animateMove(m,done){let fired=false;const fin=()=>{if(!fired){fired=true;done()}};
 const el=S.an=="desligada"||!CELLS[0]||!CELLS[0].getBoundingClientRect?null:CELLS[m.from].firstChild;if(!el||!el.animate)return fin();
 const full=S.an=="completa",R=i=>CELLS[i].getBoundingClientRect(),o=R(m.from),pts=[m.from,...m.path],legs=[],A=[];let T=0;
 for(let k=1;k<pts.length;k++){const d=full?170+45*Math.min(4,Math.abs((pts[k]>>3)-(pts[k-1]>>3))):110;legs.push(d);T+=d}
 const kf=[{transform:"translate(0px,0px) scale(1)",offset:0,easing:"ease-in-out"}];let acc=0;
 for(let k=1;k<pts.length;k++){const a=R(pts[k-1]),b=R(pts[k]);
  if(full)kf.push({transform:`translate(${(a.left+b.left)/2-o.left}px,${(a.top+b.top)/2-o.top}px) scale(1.14)`,offset:(acc+legs[k-1]/2)/T,easing:"ease-in-out"});
  acc+=legs[k-1];kf.push({transform:`translate(${b.left-o.left}px,${b.top-o.top}px) scale(1)`,offset:acc/T,easing:"ease-in-out"})}
 el.style.zIndex=5;el.style.willChange="transform";A.push(el.animate(kf,{duration:T,fill:"forwards"}));
 let t=0;m.caps.forEach((ci,k)=>{const c=CELLS[ci].firstChild;if(c&&c.animate)A.push(c.animate(full?[{transform:"scale(1)",opacity:1},{transform:"scale(1.15)",opacity:.9,boxShadow:"0 0 0 6px #ffffff55",offset:.25},{transform:"scale(.55)",opacity:0}]:[{opacity:1},{opacity:0}],{duration:full?260:100,delay:t+legs[k]*.5,fill:"both"}));t+=legs[k]});
 Promise.all(A.map(x=>x.finished)).then(fin,fin);setTimeout(fin,T+500)}
function play(m){if(G.rev!=null){G.rev=null;render()} // se estava revisando, volta à posição real antes de animar
 const pb=G.b,to=end(m),id=G.id;G.hist.push({b:pb,side:G.side,last:G.last,noCap:G.noCap,t:{...G.t}});G.moves.push({from:m.from,path:m.path,caps:m.caps});
 G.noCap=(m.caps.length||Math.abs(pb[m.from])==1)?0:G.noCap+1;G.b=apply(pb,m);const prom=Math.abs(pb[m.from])==1&&Math.abs(G.b[to])==2;
 G.last=[m.from,to];G.sel=null;G.hint=[];m.caps.length?snd.cap():snd.mv();G.side=-G.side;G.anim=true;ui();
 animateMove(m,()=>{if(!G||G.id!=id||!G.anim)return;G.anim=false;G.newTo=(prom||S.an=="desligada")&&S.fx?to:-1;render();ui();
  if(!legal(G.b,G.side).length)return finish(-G.side,"Sem jogadas disponíveis");
  if(G.noCap>=40)return finish(0,"20 lances só com damas, sem captura");
  if(G.mode=="ai"&&G.side==-1&&!G.over){G.busy=true;ui();setTimeout(()=>aiMove(id),350)}})}
function chooseAI(){const d=G.diff,b=G.b,ms=legal(b,-1);if(ms.length==1)return ms[0];
 if(d==1)return ms[Math.random()*ms.length|0];if(d==2)return bestMove(b,-1,3,15);if(d==3)return bestMove(b,-1,6,0);
 let best=ms[0];DL=performance.now()+1500;try{for(let k=2;k<=14;k++)best=bestMove(b,-1,k,0)}catch(e){}DL=0;return best}
function aiMove(id){if(!G||G.id!=id||G.over)return;if(G.pause){G.busy=false;return}const m=chooseAI();G.busy=false;play(m)}
function undo(){if(!G||G.busy||G.anim||G.over||G.ranked||!G.hist.length)return;let h=G.hist.pop();if(G.mode=="ai"&&h.side!=1&&G.hist.length)h=G.hist.pop();
 Object.assign(G,{b:h.b,side:h.side,last:h.last,noCap:h.noCap,t:{...h.t},sel:null,hint:[],rev:null,newTo:-1});G.moves.length=G.hist.length;render();ui();showT()} // relógios voltam ao valor do snapshot
/* ===== RATING (Elo), LIGAS, TROFÉUS ===== */
const LG=[[0,"Bronze","🥉"],[1000,"Prata","🥈"],[1200,"Ouro","🥇"],[1400,"Platina","💠"],[1600,"Diamante","💎"],[1800,"Mestre","👑"],[2000,"Grão-Mestre","🏆"]];
const lg=(r=S.rating)=>{let k=0;LG.forEach((x,i)=>{if(r>=x[0])k=i});return k};
const TRO=[["w1","Primeira vitória",s=>s.w>=1],["w10","10 vitórias",s=>s.w>=10],["w50","50 vitórias",s=>s.w>=50],["w100","100 vitórias",s=>s.w>=100],["s5","5 vitórias seguidas",s=>s.maxS>=5],["s10","10 vitórias seguidas",s=>s.maxS>=10],["ouro","Chegar ao Ouro",s=>lg(s.best)>=2],["dia","Chegar ao Diamante",s=>lg(s.best)>=4],["mes","Alcançar Mestre",s=>lg(s.best)>=5],["hi","Vencer rival de rating superior",s=>s.hi>0]];
function record(w){G.nt=[];const ai=G.mode=="ai",Ro=OPP[G.diff];let dl=0;
 if(ai){if(w==1){S.streak++;S.maxS=Math.max(S.maxS,S.streak);if(G.ranked&&Ro>S.rating)S.hi++}else if(w==-1)S.streak=0;
  if(G.ranked){const E=1/(1+Math.pow(10,(Ro-S.rating)/400)),K=S.games<10?40:S.rating<1800?20:10;
   dl=Math.round(K*((w==1?1:w==-1?0:.5)-E));S.rating=Math.max(100,S.rating+dl);S.games++;S.best=Math.max(S.best,S.rating);S.rh=[...S.rh,S.rating].slice(-30)}}
 S.hist=[{t:Date.now(),o:ai?"IA "+DIFF[G.diff][0]:"Amigo",r:ai?(w==1?"V":w==-1?"D":"E"):(w?NAMES[w]:"E"),dl:G.ranked?dl:null,rk:G.ranked,mv:G.moves.map(m=>[m.from,m.path,m.caps])},...S.hist].slice(0,30);
 TRO.forEach(([id,n,f])=>{if(!S.tro[id]&&f(S)){S.tro[id]=1;G.nt.push(n)}});return G.ranked?dl:null}
function finish(w,why){if(G.over)return;G.over=true;stopClock();let t,x=0;
 if(G.mode=="ai"){if(w==1){t="Vitória!";x=[0,20,40,80,100][G.diff];S.w++}else if(w==-1){t="Derrota";x=5;S.l++}else{t="Empate";x=10;S.d++}}
 else{t=w?NAMES[w]+" venceram!":"Empate";x=15;w?S.w++:S.d++}
 const lv0=lvl();S.xp+=x;const rd=record(w);save();w?snd.win():snd.bad();ui();
 modal(`<h2>${t}</h2><p>${why}</p><p>+${x} XP${lvl()>lv0?" · nível "+lvl()+"!":""}</p>${rd!==null?`<p>Rating ${rd>=0?"+":""}${rd} → ${S.rating}</p>`:""}${G.nt.length?"<p>🏆 "+G.nt.join(", ")+"</p>":""}<button class="btn pri" id="again">Jogar novamente</button><button class="btn" id="rvw">Revisar partida</button><button class="btn" id="home">Menu principal</button>`);
 $("#again").onclick=()=>start(...G.cfg);$("#rvw").onclick=()=>{closeM();if(G.hist.length){G.rev=G.hist.length-1;render();ui()}};$("#home").onclick=toMenu}
function openReview(i){const h=S.hist[i];if(!h||!Array.isArray(h.mv))return;closeM();stopClock();let b=newBoard(),side=1,last=[];const hist=[];
 try{for(const[f,p,c]of h.mv){hist.push({b,side,last,noCap:0,t:{1:0,[-1]:0}});b=apply(b,{from:f,path:p,caps:c});last=[f,p[p.length-1]];side=-side}}catch(e){return modal(`<h2>Partida indisponível</h2><p>Os lances guardados estão inválidos.</p><button class="btn pri" id="ok">Fechar</button>`),$("#ok").onclick=closeM}
 G={id:++GID,mode:"review",over:true,b,side,hist,last,sel:null,hint:[],rev:0,newTo:-1,anim:false,busy:false,pause:false,ranked:false,timed:false,noCap:0,moves:[],t:{1:0,[-1]:0},cfg:null};
 show("game");$("#nw").textContent="Brancas";$("#nb").textContent="Pretas";$("#tw").style.visibility=$("#tb").style.visibility="hidden";
 $("#undo").hidden=$("#hint").hidden=$("#rev").hidden=$("#pause").hidden=true;buildBoard();render();ui()}
function toMenu(){closeM();stopClock();G=null;show("menu");home()}
/* ===== INTERFACE ===== */
let SU={diff:2};
function openSetup(kind){SU={kind,diff:SU.diff||2,time:0};drawSetup();show("setup")}
function drawSetup(){const k=SU.kind,T=[[0,"Sem cronômetro"],[180,"3 min"],[300,"5 min"],[600,"10 min"]];
 $("#setup").innerHTML=`<h2>${k=="ai"?"Jogar contra o computador":k=="rk"?"Ranqueada contra IA":"Jogar com amigo"}</h2>`+(k=="friend"?`<p class="sub">Brancas e pretas no mesmo aparelho.</p>`:`${k=="rk"?`<p class="sub">Seu rating: ${S.rating} · rating nominal da IA entre parênteses nas descrições</p>`:""}<div style="width:100%;display:grid;gap:8px">${Object.entries(DIFF).map(([d,v])=>`<button class="btn opt${SU.diff==d?" sel":""}" data-d="${d}"><b>${v[0]}</b>${k=="rk"?" ("+OPP[d]+")":""}<small>${v[1]}</small></button>`).join("")}</div>`)+`<p class="sub">Tempo por jogador</p><div class="grid">${T.map(t=>`<button class="btn opt${SU.time==t[0]?" sel":""}" data-t="${t[0]}">${t[1]}</button>`).join("")}</div><button class="btn pri" id="go">Iniciar</button><button class="btn" data-go="${k=="rk"?"ranked":"menu"}">Voltar</button>`}
document.addEventListener("click",e=>{const g=e.target.closest("[data-go]");if(!g)return;const t=g.dataset.go;
 t=="vsai"?openSetup("ai"):t=="friend"?openSetup("friend"):t=="rkai"?openSetup("rk"):(show(t),home())});
$("#setup").addEventListener("click",e=>{const o=e.target.closest(".opt"),go=e.target.closest("#go");
 if(o){if(o.dataset.d)SU.diff=+o.dataset.d;else SU.time=+o.dataset.t;drawSetup()}
 else if(go)start(SU.kind=="friend"?"friend":"ai",SU.diff,SU.kind=="rk",SU.time)});
function prof(){const l=LG[lg()],n=S.w+S.l+S.d,pc=n?Math.round(100*S.w/n):0,mn=Math.min(...S.rh),mx=Math.max(...S.rh,mn+1);
 const pts=S.rh.map((v,i)=>`${i*200/Math.max(1,S.rh.length-1)},${60-(v-mn)*55/(mx-mn)}`).join(" ");
 modal(`<h2>${esc(S.av)} ${esc(S.nick)}</h2><p>${l[2]} ${l[1]} · ${S.games<10?"Classificatória "+S.games+"/10 · ":""}Rating ${S.rating} (melhor ${S.best})</p><p>${S.w} V · ${S.l} D · ${S.d} E · ${pc}% de vitórias · 🏆 ${Object.keys(S.tro).length}/${TRO.length}</p><svg viewBox="-4 -4 208 68" style="width:100%"><polyline points="${pts}" fill="none" stroke="var(--pur)" stroke-width="2"/></svg><p>Dados salvos neste aparelho; não é uma conta online.</p><button class="btn" id="chg">Trocar nickname/avatar</button><button class="btn pri" id="ok">Fechar</button>`);$("#chg").onclick=nick;$("#ok").onclick=closeM}
function nick(){let av=S.av;const AV=["♟","♛","🦊","🐺","🦉","🐯","🚀","🌿"];
 modal(`<h2>Seu perfil</h2><p>Nickname de 3 a 16 caracteres (letras, números, _ ou -). Único apenas neste aparelho; nomes únicos globais exigem servidor.</p><input id="nk" maxlength="16" value="${esc(S.nick)}" placeholder="Nickname" style="padding:12px;border-radius:10px;border:1px solid #4a4843;background:var(--bg);color:var(--txt);font-size:1rem"><div class="grid" style="grid-template-columns:repeat(4,1fr)">${AV.map(a=>`<button class="btn av" data-a="${a}">${a}</button>`).join("")}</div><p id="er" style="color:#e57373"></p><button class="btn pri" id="sv">Salvar</button>${S.nick?'<button class="btn" id="cn">Cancelar</button>':""}`);
 const mark=()=>document.querySelectorAll(".av").forEach(b=>b.style.borderColor=b.dataset.a==av?"var(--pur)":"");mark();
 document.querySelectorAll(".av").forEach(b=>b.onclick=()=>{av=b.dataset.a;mark()});if(S.nick)$("#cn").onclick=closeM;
 $("#sv").onclick=()=>{const v=$("#nk").value.trim();if(!/^[\p{L}\p{N}_-]{3,16}$/u.test(v))return $("#er").textContent="Use 3 a 16 letras, números, _ ou -.";S.nick=v;S.av=av;save();closeM();home()}}
function cfg(){const row=(k,l,v)=>`<button class="btn" data-k="${k}">${l}: <b>${v}</b></button>`;
 modal(`<h2>Configurações</h2><p>Aparência salva neste aparelho; é só visualização e não afeta o adversário.</p>${row("t","Tabuleiro",S.t)}${row("sw","Peças brancas",S.sw)}${row("sb","Peças pretas",S.sb)}${row("kc","Aparência das damas",S.kc)}${row("fx","Efeitos",S.fx?"ligados":"desligados")}${row("an","Animações",S.an)}${row("m","Interface",S.m)}<button class="btn pri" id="ok">Fechar</button>`);
 $("#ok").onclick=closeM;document.querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{const k=b.dataset.k;
  S[k]=k=="t"?cyc(["verde","madeira","cinza"],S.t):k=="sw"?cyc(Object.keys(SKW),S.sw):k=="sb"?cyc(Object.keys(SKB),S.sb):k=="kc"?cyc(["coroa","estrela"],S.kc):k=="fx"?!S.fx:k=="an"?cyc(["completa","reduzida","desligada"],S.an):cyc(["escuro","claro"],S.m);
  save();home();if(G)render();cfg()})}
function home(){const b=document.body.dataset;b.t=S.t;b.m=S.m;const l=lg(),lo=LG[l][0],hi=LG[l+1]?LG[l+1][0]:lo+200;
 $("#who").textContent=`${S.av} ${S.nick||"Jogador"} · ${LG[l][2]} ${LG[l][1]} · ${S.games<10?"classificatória "+S.games+"/10":S.rating}`;
 $("#rk").textContent=`Rating ${S.rating} · ${LG[l][2]} ${LG[l][1]}${LG[l+1]?" → "+LG[l+1][1]+" em "+LG[l+1][0]:""}`;$("#xpb").style.width=Math.min(100,100*(S.rating-lo)/(hi-lo))+"%";
 if(!S.nick&&!$("#modal").classList.contains("on"))nick()}
$("#perfil").onclick=prof;$("#rules").onclick=()=>{modal(`<h2>Como jogar</h2><ul><li>Toque numa peça e depois numa casa marcada.</li><li>Peças comuns andam 1 casa na diagonal para frente e capturam para frente e para trás.</li><li>A captura é obrigatória e vale a sequência com mais peças (lei da maioria).</li><li>Ao chegar na última linha a peça vira dama ♛, que anda e captura à distância.</li><li>Perde quem ficar sem peças ou sem jogadas. 20 lances só de damas sem captura = empate.</li></ul><button class="btn pri" id="ok">Entendi</button>`);$("#ok").onclick=closeM};$("#cfg").onclick=cfg;
$("#trofeus").onclick=()=>{modal(`<h2>Troféus</h2><ul style="list-style:none;padding:0">${TRO.map(t=>`<li>${S.tro[t[0]]?"✅":"🔒"} ${t[1]}</li>`).join("")}</ul><button class="btn pri" id="ok">Fechar</button>`);$("#ok").onclick=closeM};
function histList(){modal(`<h2>Histórico</h2><div style="display:grid;gap:6px">${S.hist.slice(0,20).map((h,i)=>`<button class="btn opt" ${h.mv?`data-h="${i}"`:"disabled"}>${new Date(h.t).toLocaleDateString("pt-BR")} · ${esc(h.o)} · ${esc(h.r)}${h.rk?" · ranqueada "+(h.dl>=0?"+":"")+h.dl:""}${h.mv?" · revisar":""}</button>`).join("")||"<p>Nenhuma partida ainda.</p>"}</div><button class="btn pri" id="ok">Menu inicial</button>`);
 document.querySelectorAll("[data-h]").forEach(b=>b.onclick=()=>openReview(+b.dataset.h));$("#ok").onclick=closeM}
$("#histb").onclick=histList;
$("#hint").onclick=()=>{if(!G||G.over||G.busy||G.anim||G.pause||G.rev!=null||G.ranked)return;const m=bestMove(G.b,G.side,4,0);G.hint=[m.from,end(m)];G.sel=null;render()};
$("#undo").onclick=undo;
$("#rev").onclick=()=>{if(G&&G.hist.length&&!G.anim&&G.mode!="review"){G.rev=G.hist.length-1;render();ui()}};
$("#rp").onclick=()=>{if(G&&G.rev>0){G.rev--;render();ui()}};
$("#rn").onclick=()=>{if(!G)return;if(G.mode=="review")G.rev=Math.min(G.hist.length,G.rev+1);else{G.rev++;if(G.rev>=G.hist.length)G.rev=null}render();ui()};
$("#rx").onclick=()=>{if(!G)return;if(G.mode=="review"){G=null;show("menu");home();histList()}else{G.rev=null;render();ui()}};$("#rm").onclick=toMenu;
$("#mn").onclick=()=>{if(!G||G.over||G.mode=="review")toMenu();else $("#pause").onclick()};
$("#pause").onclick=()=>{if(!G||G.over)return;G.pause=true;let sure=false;const id=G.id;
 modal(`<h2>Pausa</h2><button class="btn pri" id="cont">Continuar</button>${G.ranked?"":'<button class="btn" id="rest">Reiniciar partida</button>'}<button class="btn" id="quit">Abandonar partida</button>`);
 $("#cont").onclick=()=>{G.pause=false;closeM();if(G.mode=="ai"&&G.side==-1&&!G.busy&&!G.anim&&!G.over){G.busy=true;setTimeout(()=>aiMove(id),300)}};
 if(!G.ranked)$("#rest").onclick=()=>start(...G.cfg);
 $("#quit").onclick=e=>{if(!sure){sure=true;e.target.textContent="Confirmar abandono? Toque de novo"}else{if(G.mode=="ai"){S.l++;if(G.ranked)record(-1);save()}toMenu()}}};
home();
