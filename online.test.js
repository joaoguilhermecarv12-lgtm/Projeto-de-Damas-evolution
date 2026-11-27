// Testa a camada online do script.js com um Supabase simulado (RPC, canais Presence/Broadcast e tabelas em memória).
// NÃO fala com o Supabase real: isso só se valida no projeto de verdade (ver README).
const vm=require('vm'),fs=require('fs');
const mkEl=()=>{const e={style:{},dataset:{},children:[],_cl:new Set(),hidden:false,disabled:false,_t:"",_h:"",
 classList:{add:c=>e._cl.add(c),remove:c=>e._cl.delete(c),toggle:(c,f)=>f?e._cl.add(c):e._cl.delete(c),contains:c=>e._cl.has(c)},
 appendChild(c){e.children.push(c)},addEventListener(){},querySelectorAll:()=>[],closest:()=>null,animate:()=>({finished:Promise.resolve()}),
 getBoundingClientRect(){const i=+e.dataset.i;return{left:(i%8)*50,top:(i>>3)*50,width:50,height:50}}};
 Object.defineProperty(e,'textContent',{get:()=>e._t,set:v=>{e._t=v;e.children.length=0}});Object.defineProperty(e,'innerHTML',{get:()=>e._h,set:v=>{e._h=v;e.children.length=0}});
 Object.defineProperty(e,'firstChild',{get:()=>e.children[0]||null});return e};
const els={},$e=s=>els[s]||(els[s]=mkEl());
const calls=[],rpcRes={},tables={},chans=[],ME={id:"a",username:"eu",elo:1000,wins:0,losses:0};
const sb={rpc:(n,a)=>{calls.push([n,a]);const r=rpcRes[n];return Promise.resolve(typeof r==="function"?r(a):(r||{data:null,error:null}))},
 channel(name){const ch={name,handlers:[],sent:[],state:{},on(t,f,cb){ch.handlers.push([t,f,cb]);return ch},subscribe(cb){ch.sub=cb;return ch},track(x){ch.tracked=x},send(m){ch.sent.push(m);return Promise.resolve()},presenceState:()=>ch.state};chans.push(ch);return ch},
 removeChannel(ch){ch.removed=true},
 from(t){const q={};["select","or","order","limit","gt"].forEach(k=>q[k]=()=>q);q.eq=(k,v)=>{q._f=[k,v];return q};q.single=()=>{const rows=tables[t]||[];return Promise.resolve({data:(q._f?rows.find(x=>x[q._f[0]]===q._f[1]):rows[0])||null,error:null})};q.then=r=>r({data:tables[t]||[],error:null});return q}};
const Net={init(){},ready:()=>true,user:()=>({id:ME.id,email:"a@b.c"}),profile:()=>ME,client:()=>sb,onChange(){},tr:e=>"ERR:"+(e&&e.message),signIn:async()=>({ok:true}),signOut:async()=>{}};
const ctx={Net,document:{querySelector:$e,querySelectorAll:()=>[],createElement:mkEl,addEventListener(){},hidden:false,body:{dataset:{}}},localStorage:{getItem:()=>null,setItem(){}},
 setInterval:()=>1,clearInterval(){},setTimeout,performance:{now:()=>0},AudioContext:function(){throw 1},Date,console,Math,JSON,Object,Array,Set,Number,String,Promise,Infinity};
vm.createContext(ctx);let src=fs.readFileSync(__dirname+'/../script.js','utf8').replace(/home\(\);\n$/,'S.nick="Teste";S.an="desligada";home();\n');
vm.runInContext(src+';globalThis.X={get G(){return G},get OL(){return OL},legal,end,click,startOnline,remoteMove,onlineFinish,showResult,resync,onlineMenu,queue,ranking,oppWatch,checkResume,S}',ctx);
const X=ctx.X;let ok=0,bad=0;const T=(n,c)=>{c?ok++:(bad++,console.log('FALHOU:',n))};const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const row=(o={})=>({id:"M1",white_player:"a",black_player:"b",status:"active",board_state:{moves:[]},turn:"white",last_move_at:new Date().toISOString(),created_at:new Date().toISOString(),...o});
const last=n=>calls.filter(c=>c[0]==n).pop(),reset=()=>{calls.length=0;chans.length=0;for(const k in rpcRes)delete rpcRes[k]};
(async()=>{
// --- ranking: ordenado, destaca o jogador, escapa HTML
tables.profiles=[{id:"x",username:"<b>top",elo:1500,wins:9,losses:1},{id:"a",username:"eu",elo:1000,wins:0,losses:0}];await X.ranking();
const h=els['#mb'].innerHTML;T('ranking: lista, destaca o próprio e escapa HTML',h.includes('&lt;b&gt;top')&&!h.includes('<b>top')&&h.includes('class="me"')&&h.indexOf('top')<h.indexOf('eu'));
// --- partida como brancas
tables.matches=[row()];tables.profiles=[{id:"b",username:"rival",elo:1010}];reset();await X.startOnline("M1");let G=X.G;
T('online: G online, brancas, tabuleiro normal',G.mode=='online'&&G.me==1&&!G.flip&&els['#board'].children[0].dataset.i=="0");
T('online: join_match chamado e canal match:M1 aberto',!!last('join_match')&&chans.some(c=>c.name=='match:M1'));
const ch=chans.find(c=>c.name=='match:M1');
const m1=X.legal(G.b,1)[0];X.click(m1.from);X.click(X.end(m1));await sleep(5);
T('online: lance local transmitido (broadcast n=0) e registrado (record_move)',ch.sent.length==1&&ch.sent[0].payload.n==0&&JSON.stringify(ch.sent[0].payload.mv)==JSON.stringify([m1.from,m1.path,m1.caps])&&last('record_move')[1].p_n==0&&G.pending==0);
const bm=X.legal(G.b,-1)[0],mv=[bm.from,bm.path,bm.caps];
X.click(bm.from);T('online: clique fora do turno bloqueado',G.sel==null&&G.moves.length==1);
X.remoteMove(5,mv);T('online: lance fora de ordem não é aplicado',G.moves.length==1);
X.remoteMove(1,[0,[1],[]]);T('online: lance inválido do adversário ignorado',G.moves.length==1&&els['#st'].textContent.includes('inválido'));
X.remoteMove(1,mv);T('online: lance remoto válido aplicado, vez volta para mim',G.moves.length==2&&G.side==1);
X.remoteMove(1,mv);T('online: duplicado ignorado (sem duplicar peças)',G.moves.length==2);
// --- resync: servidor mais curto sem lance pendente reconstrói; com pendente não
tables.matches=[row({board_state:{moves:[]}})];G.pending=1;await X.resync();T('resync: não reconstrói com lance em trânsito',X.G===G&&G.moves.length==2);
G.pending=0;await X.resync();T('resync: reconstrói a partir do servidor quando diverge',X.G!==G&&X.G.moves.length==0);
G=X.G;const mm=[m1.from,m1.path,m1.caps];tables.matches=[row({board_state:{moves:[mm]},turn:"black"})];await X.resync();T('resync: aplica lance que faltava (1 à frente)',X.G.moves.length==1||X.G!==G);
// --- reivindicar abandono / presença
G=X.G;X.OL.seen=Date.now()-70000;X.oppWatch();T('desconexão: botão de reivindicar aparece após 65 s',els['#claim'].hidden===false);
X.OL.seen=Date.now();X.oppWatch();T('desconexão: some quando o adversário volta',els['#claim'].hidden===true);
rpcRes.report_result={data:null,error:{message:'opponent_active'}};X.OL.seen=Date.now()-70000;els['#claim'].onclick&&await els['#claim'].onclick();
T('abandono: servidor recusa se adversário ativo, mensagem clara',els['#st'].textContent.includes('ainda está conectado')&&last('report_result')[1].p_reason=='abandon');
// --- fim de partida: claims
for(const[w,claim]of[[1,'white'],[-1,'black'],[0,'draw']]){reset();tables.matches=[row()];await X.startOnline("M1");const wins0=X.S.w;rpcRes.report_result={data:{status:'finished'},error:null};await X.onlineFinish(w,'t');
 T(`fim: resultado ${w} → claim ${claim}, sem alterar estatísticas locais`,last('report_result')[1].p_claim==claim&&X.S.w==wins0)}
// --- desistir
reset();tables.matches=[row()];await X.startOnline("M1");rpcRes.report_result={data:{status:'finished'},error:null};X.onlineMenu();await els['#oab'].onclick();
T('desistir: report_result resign dando vitória ao adversário',last('report_result')[1].p_reason=='resign'&&last('report_result')[1].p_claim=='black');
// --- tela de resultado
reset();tables.matches=[row()];await X.startOnline("M1");X.showResult(row({status:'finished',winner:'a',white_delta:14,black_delta:-14,ended_reason:'normal'}));
T('resultado: vitória com +14 de Elo',els['#mb'].innerHTML.includes('Vitória')&&els['#mb'].innerHTML.includes('+14')&&X.G.final);
const before=els['#mb'].innerHTML;X.showResult(row({status:'disputed',ended_reason:'disputed'}));T('resultado: só mostra uma vez',els['#mb'].innerHTML===before);
reset();tables.matches=[row()];await X.startOnline("M1");X.showResult(row({status:'disputed',ended_reason:'disputed'}));T('resultado contestado: sem Elo',els['#mb'].innerHTML.includes('contestado')&&!els['#mb'].innerHTML.includes('Elo online'));
// --- partida como pretas: tabuleiro invertido e vez do adversário
reset();tables.matches=[row({white_player:"b",black_player:"a"})];await X.startOnline("M1");G=X.G;
T('pretas: tabuleiro invertido',G.me==-1&&G.flip&&els['#board'].children[0].dataset.i=="63");
X.click(17);T('pretas: não joga na vez das brancas',G.sel==null);
// --- matchmaking
reset();tables.matches=[];ME.id="a";ME.elo=1000;await X.queue();const mq=chans.find(c=>c.name=='mm:damas'),pair=mq.handlers[0][2];
mq.state={b:[{elo:1600,t:Date.now()}]};await pair();await sleep(400);T('fila: Elo muito distante não pareia no início',!last('create_match'));
mq.state={b:[{elo:1040,t:Date.now()}]};tables.matches=[row()];tables.profiles=[{id:"b",username:"rival",elo:1040}];rpcRes.create_match={data:"M1",error:null};await pair();await sleep(500);
T('fila: Elo próximo e menor id cria a partida',last('create_match')&&last('create_match')[1].p_opponent=='b'&&mq.sent[0].payload.to=='b'&&mq.sent[0].payload.id=='M1');
T('fila: entra na partida e sai da fila',X.G&&X.G.mode=='online'&&mq.removed===true);
reset();tables.matches=[];ME.id="z";await X.queue();const m2=chans.find(c=>c.name=='mm:damas');m2.state={b:[{elo:1000,t:Date.now()}]};await m2.handlers[0][2]();await sleep(400);
T('fila: id maior não cria (evita partidas duplicadas)',!last('create_match'));
tables.matches=[row({white_player:"b",black_player:"z"})];m2.handlers[1][2]({payload:{to:"z",id:"M1"}});await sleep(50);T('fila: quem recebe o broadcast entra na partida (pretas, tabuleiro invertido)',X.G.mode=='online'&&X.G.me==-1&&X.G.flip&&m2.removed===true);
// --- retomar partida
console.log(`ONLINE (Supabase simulado): ok=${ok} falhas=${bad}`);process.exitCode=bad?1:0;process.exit()})();
