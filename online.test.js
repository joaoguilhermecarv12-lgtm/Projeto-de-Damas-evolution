// Testa a camada online do script.js com um Supabase simulado (RPC, canais Presence/Broadcast e tabelas em memória).
// NÃO fala com o Supabase real: isso só se valida no projeto de verdade (ver README).
const vm=require('vm'),fs=require('fs');
const mkEl=()=>{const e={style:{},dataset:{},children:[],_cl:new Set(),hidden:false,disabled:false,_t:"",_h:"",
 classList:{add:c=>e._cl.add(c),remove:c=>e._cl.delete(c),toggle:(c,f)=>f?e._cl.add(c):e._cl.delete(c),contains:c=>e._cl.has(c)},
 appendChild(c){e.children.push(c)},addEventListener(){},querySelectorAll:()=>[],closest:()=>null,animate:()=>({finished:Promise.resolve()}),
 getBoundingClientRect(){const i=+e.dataset.i;return{left:(i%8)*50,top:(i>>3)*50,width:50,height:50}}};
 Object.defineProperty(e,'textContent',{get:()=>e._t,set:v=>{e._t=v;e._h='';e.children.length=0}});Object.defineProperty(e,'innerHTML',{get:()=>e._h,set:v=>{e._h=v;e.children.length=0}});
 Object.defineProperty(e,'firstChild',{get:()=>e.children[0]||null});return e};
const tags=[],authCalls=[];let cd=0,loggedIn=true,authImpl=async()=>({ok:true});
const els={},$e=s=>els[s]||(els[s]=mkEl());
const calls=[],rpcRes={},tables={},chans=[],ME={id:"a",username:"eu",elo:1000,wins:0,losses:0};
const sb={rpc:(n,a)=>{calls.push([n,a]);const r=rpcRes[n];return Promise.resolve(typeof r==="function"?r(a):(r||{data:null,error:null}))},
 channel(name){const ch={name,handlers:[],sent:[],state:{},on(t,f,cb){ch.handlers.push([t,f,cb]);return ch},subscribe(cb){ch.sub=cb;return ch},track(x){ch.tracked=x},send(m){ch.sent.push(m);return Promise.resolve()},presenceState:()=>ch.state};chans.push(ch);return ch},
 removeChannel(ch){ch.removed=true},
 from(t){const q={};["select","or","order","limit","gt"].forEach(k=>q[k]=()=>q);q.eq=(k,v)=>{q._f=[k,v];return q};q.single=()=>{const rows=tables[t]||[];return Promise.resolve({data:(q._f?rows.find(x=>x[q._f[0]]===q._f[1]):rows[0])||null,error:null})};q.then=r=>r({data:tables[t]||[],error:null});return q}};
const Net={init(){},ready:()=>true,user:()=>loggedIn?{id:ME.id,email:"a@b.c"}:null,profile:()=>loggedIn?ME:null,client:()=>sb,onChange(){},tr:e=>"ERR:"+(e&&e.message),cooldown:()=>cd,
 signIn:a=>{authCalls.push(["signIn",a]);return authImpl()},signUp:a=>{authCalls.push(["signUp",a]);return authImpl()},signOut:async()=>{}};
const ctx={Net,document:{querySelector:$e,querySelectorAll:()=>[],createElement:tg=>{tags.push(tg);const e=mkEl();e.tagName=tg;return e},createTextNode:s=>({nodeType:3,textContent:String(s)}),addEventListener(){},hidden:false,body:{dataset:{}}},localStorage:{getItem:()=>null,setItem(){}},
 setInterval:()=>1,clearInterval(){},setTimeout,performance:{now:()=>0},AudioContext:function(){throw 1},Date,console,Math,JSON,Object,Array,Set,Number,String,Promise,Infinity};
vm.createContext(ctx);let src=fs.readFileSync(__dirname+'/../script.js','utf8').replace(/home\(\);\n$/,'S.nick="Teste";S.an="desligada";home();\n');
vm.runInContext(src+';globalThis.X={get G(){return G},get OL(){return OL},legal,end,click,startOnline,remoteMove,onlineFinish,showResult,resync,onlineMenu,queue,ranking,oppWatch,checkResume,S,start,submitAuth,sendReaction,remoteReaction,conta,hideAuth}',ctx);
const X=ctx.X;let ok=0,bad=0;const T=(n,c)=>{c?ok++:(bad++,console.log('FALHOU:',n))};const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const txt=n=>n.nodeType==3?n.textContent:(n._t||'')+(n._h||'')+n.children.map(txt).join(''),hasCls=(n,c)=>n.nodeType!==3&&(n.className===c||n.children.some(x=>hasCls(x,c)));
const row=(o={})=>({id:"M1",white_player:"a",black_player:"b",status:"active",board_state:{moves:[]},turn:"white",last_move_at:new Date().toISOString(),created_at:new Date().toISOString(),...o});
const last=n=>calls.filter(c=>c[0]==n).pop(),reset=()=>{calls.length=0;chans.length=0;for(const k in rpcRes)delete rpcRes[k]};
['#signup-email','#signup-username','#signup-password','#signup-hp','#login-email','#login-password','#login-error','#signup-error','#login-submit','#signup-submit','#login-form','#signup-form','#auth','#auth-close','#react-bar'].forEach($e);
(async()=>{
// --- ranking: ordenado, destaca o jogador, escapa HTML
tables.profiles=[{id:"x",username:"<img src=x onerror=alert(1)>",elo:1500,wins:9,losses:1},{id:"a",username:"eu",elo:1000,wins:0,losses:0}];tags.length=0;await X.ranking();
const rk=txt(els['#mb']);T('ranking: username vira texto literal e nenhum <img> é criado (XSS)',rk.includes('<img src=x onerror=alert(1)>')&&!tags.includes('img')&&!els['#mb']._h.includes('<img'));
T('ranking: ordenado por Elo e destaca o próprio jogador',rk.indexOf('img')<rk.indexOf('eu')&&hasCls(els['#mb'],'me'));
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
rpcRes.finish_match={data:null,error:{message:'opponent_active'}};X.OL.seen=Date.now()-70000;els['#claim'].onclick&&await els['#claim'].onclick();
T('abandono: servidor recusa se adversário ativo, mensagem clara',els['#st'].textContent.includes('ainda está conectado')&&last('finish_match')[1].p_reason=='abandon');
// --- fim de partida: claims
for(const[w,claim]of[[1,'white'],[-1,'black'],[0,'draw']]){reset();tables.matches=[row()];await X.startOnline("M1");const wins0=X.S.w;rpcRes.finish_match={data:{status:'finished'},error:null};await X.onlineFinish(w,'t');
 T(`fim: resultado ${w} → claim ${claim}, sem alterar estatísticas locais`,last('finish_match')[1].p_claim==claim&&X.S.w==wins0)}
// --- desistir
reset();tables.matches=[row()];await X.startOnline("M1");rpcRes.finish_match={data:{status:'finished'},error:null};X.onlineMenu();await els['#oab'].onclick();
T('desistir: finish_match resign dando vitória ao adversário',last('finish_match')[1].p_reason=='resign'&&last('finish_match')[1].p_claim=='black');
// --- tela de resultado
reset();tables.matches=[row()];await X.startOnline("M1");X.showResult(row({status:'finished',winner:'a',white_delta:14,black_delta:-14,ended_reason:'normal'}));
T('resultado: vitória com +14 de Elo',txt(els['#mb']).includes('Vitória')&&txt(els['#mb']).includes('+14')&&X.G.final);
const before=txt(els['#mb']);X.showResult(row({status:'disputed',ended_reason:'disputed'}));T('resultado: só mostra uma vez',txt(els['#mb'])===before);
reset();tables.matches=[row()];await X.startOnline("M1");X.showResult(row({status:'disputed',ended_reason:'disputed'}));T('resultado contestado: sem Elo',txt(els['#mb']).includes('contestado')&&!txt(els['#mb']).includes('Elo online'));
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
ME.id="a";ME.elo=1000;loggedIn=true;
// --- XSS no nome do adversário e no próprio perfil: sempre textContent
reset();tables.matches=[row()];tables.profiles=[{id:"b",username:"<img src=x onerror=alert(1)>",elo:1010}];tags.length=0;await X.startOnline("M1");G=X.G;
T('XSS: nome do adversário no painel é texto (nenhum <img> criado)',els['#nb'].textContent.includes('<img src=x')&&!tags.includes('img'));
ME.username="<script>x</script>";tags.length=0;X.conta();T('XSS: tela de conta mostra o próprio nome como texto',txt(els['#mb']).includes('<script>x</script>')&&!tags.includes('script')&&!tags.includes('img'));ME.username="eu";
// --- pacotes adulterados / fora de turno (anti-cheat)
const ml=X.legal(G.b,1)[0];X.click(ml.from);X.click(X.end(ml));await sleep(5);tables.matches=[row({board_state:{moves:[[ml.from,ml.path,ml.caps]]},turn:'black'})];// o banco simulado passa a refletir o lance gravado
const L=G.moves.length,okmv=(()=>{const b=X.legal(G.b,-1)[0];return[b.from,b.path,b.caps]})();
for(const[n,mv]of[["1",okmv],[1.5,okmv],[-1,okmv],[1,null],[1,{}],[1,"abc"],[1,[okmv[0],okmv[1]]],[1,[1.5,[2],[]]],[1,[okmv[0],[99],[]]],[1,[okmv[0],Array(40).fill(1),[]]],[1,[okmv[0],okmv[1],okmv[2],7]],[1,[okmv[0],okmv[1],Array(40).fill(1)]],[1,[okmv[0],[okmv[1][0]+16],[]]]])X.remoteMove(n,mv);
T('pacotes adulterados/inválidos são todos descartados',G.moves.length==L);
X.remoteMove(1,okmv);T('lance legal válido ainda é aceito depois',G.moves.length==L+1);
const wm=X.legal(G.b,1)[0];X.remoteMove(L+1,[wm.from,wm.path,wm.caps]);T('lance da minha cor enviado como se fosse do adversário (vez minha) é descartado',G.moves.length==L+1);
// --- reações
T('reação: barra visível na partida online',els['#react-bar'].hidden===false);
els['#pw'].children.length=0;els['#pb'].children.length=0;const chR=chans.filter(c=>c.name=='match:M1').pop();chR.sent.length=0;
T('reação: emoji fora da lista, tipo errado ou HTML é recusado',!X.sendReaction("💩")&&!X.sendReaction("<b>")&&!X.sendReaction(1)&&!X.sendReaction("🔥🔥")&&chR.sent.length==0);
T('reação: emoji permitido é enviado (evento react) e mostra balão no meu painel',X.sendReaction("🔥")&&chR.sent[0].event=='react'&&chR.sent[0].payload.e=='🔥'&&els['#pw'].children.some(c=>c.className=='bubble'&&c._t=='🔥'));
T('reação: anti-flood (2ª em menos de 3 s é bloqueada)',!X.sendReaction("👏")&&chR.sent.length==1);
T('reação recebida: payload adulterado ignorado',!X.remoteReaction({e:"💩"})&&!X.remoteReaction({e:"🔥<script>"})&&!X.remoteReaction(null)&&!X.remoteReaction("🔥")&&!X.remoteReaction({e:["🔥"]})&&!X.remoteReaction({e:"🔥",x:1}.e));
T('reação recebida: válida mostra balão no painel do adversário',X.remoteReaction({e:"😮"})&&els['#pb'].children.some(c=>c._t=='😮'));
T('reação recebida: flood do adversário ignorado (3 s)',!X.remoteReaction({e:"👏"}));
X.start('friend',0,false,0);T('reação: indisponível fora do online (barra escondida, envio recusado)',els['#react-bar'].hidden===true&&!X.sendReaction("🔥"));
// --- cadastro/login: o formulário lê os campos certos (regressão do bug "Informe e-mail e senha.")
let resolveAuth;authImpl=()=>new Promise(r=>{resolveAuth=r});authCalls.length=0;
els['#signup-email'].value="  nova@ex.com ";els['#signup-username'].value=" nova_user ";els['#signup-password'].value="segredo123";els['#signup-hp'].value="";
const bt=els['#signup-submit'],p1=X.submitAuth("up");T('cadastro: botão desabilita e mostra "Aguarde..."',bt.disabled===true&&bt.textContent=="Aguarde...");
X.submitAuth("up");T('cadastro: clique repetido durante o envio é ignorado',authCalls.length==1);
const a0=authCalls[0][1];T('cadastro: envia e-mail/usuário aparados, senha intacta e honeypot vazio',a0.email=="nova@ex.com"&&a0.username=="nova_user"&&a0.password=="segredo123"&&a0.hp==="");
resolveAuth({ok:false,error:"Nome de usuário já em uso."});await p1;T('cadastro com erro: mostra a mensagem e reabilita o botão',els['#signup-error'].textContent=="Nome de usuário já em uso."&&bt.disabled===false&&bt.textContent=="Cadastrar");
cd=7000;authImpl=async()=>({ok:false,error:"E-mail ou senha incorretos."});els['#login-email'].value="a@b.co";els['#login-password'].value="x";await X.submitAuth("in");
T('login: após falhas o botão fica travado com contagem (cooldown)',els['#login-submit'].disabled===true&&els['#login-submit'].textContent=="Aguarde 7s"&&els['#login-error'].textContent.includes("incorretos"));cd=0;
authImpl=async()=>({ok:true,needsConfirm:true});els['#signup-submit'].disabled=false;await X.submitAuth("up");T('cadastro com confirmação de e-mail: volta ao login com aviso',els['#login-form'].hidden===false&&els['#login-error'].textContent.includes("Confirme"));
els['#signup-hp'].value="robo";authCalls.length=0;authImpl=async()=>({ok:true,needsConfirm:true});await X.submitAuth("up");T('honeypot preenchido é repassado ao módulo (que descarta em silêncio)',authCalls[0][1].hp==="robo");els['#signup-hp'].value="";
// --- modo offline livre: login só abre sob demanda e Fechar libera
loggedIn=false;reset();els['#auth']._cl.delete('on');await X.queue();T('Jogar online sem conta abre o login (e não entra na fila)',els['#auth']._cl.has('on')&&!chans.some(c=>c.name=='mm:damas'));
els['#auth-close'].onclick();T('Fechar o login libera o jogo offline',!els['#auth']._cl.has('on'));
X.start('ai',1,false,0);T('jogar contra a IA sem conta funciona',X.G.mode=='ai'&&!els['#auth']._cl.has('on'));
X.start('friend',0,false,0);T('jogar com amigo sem conta funciona',X.G.mode=='friend'&&!els['#auth']._cl.has('on'));loggedIn=true;
console.log(`ONLINE (Supabase simulado): ok=${ok} falhas=${bad}`);process.exitCode=bad?1:0;process.exit()})();
