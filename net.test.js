// Testa supabase.js (validação, honeypot, cooldown progressivo, mapeamento de erros, perfil) com um cliente simulado.
const vm=require('vm'),fs=require('fs');let ok=0,bad=0;const T=(n,c)=>{c?ok++:(bad++,console.log('FALHOU:',n))};
const code=fs.readFileSync(__dirname+'/../supabase.js','utf8');let now=1e6;const store={};
function load(withSb=true){const calls=[],m={calls,avail:true,signUpRes:{data:{user:{identities:[{}]},session:null},error:null},signInRes:{error:null},profileRow:null,inserted:[]};
 m.auth={onAuthStateChange(cb){m.cb=cb;return{}},signUp:async a=>{calls.push(['signUp',a]);return m.signUpRes},signInWithPassword:async a=>{calls.push(['signIn',a]);return m.signInRes},signOut:async()=>{}};
 m.rpc=async(n,a)=>{calls.push(['rpc',n,a]);return{data:m.avail,error:null}};
 m.from=()=>{const q={};q.select=()=>q;q.eq=()=>q;q.maybeSingle=async()=>({data:m.profileRow,error:null});q.insert=r=>{m.inserted.push(r);q._r=r;return q};q.single=async()=>({data:{...q._r,elo:1000,wins:0,losses:0},error:null});return q};
 const ctx={window:withSb?{supabase:{createClient:()=>m}}:{},localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v}},setTimeout:f=>f(),Date:{now:()=>now},console,Promise,JSON,Math,Object,Array,Set,String,Number};
 vm.createContext(ctx);vm.runInContext(code+';globalThis.Net=Net',ctx);return{Net:ctx.Net,m,calls}}
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
let t=load(false);T('init falha sem a biblioteca (modo offline segue ok)',t.Net.init()===false&&!t.Net.ready());
t=load();T('init ok com a biblioteca',t.Net.init()===true&&t.Net.ready());const{Net,m,calls}=t;
const good={email:"a@b.co",password:"senhaforte1",username:"ok_user-1"};
let r=await Net.signUp({...good,hp:"robo"});T('honeypot: falso sucesso silencioso e NADA enviado',r.ok&&r.needsConfirm&&calls.length==0);
for(const[k,v,msg]of[["email","semarroba","e-mail"],["email","a@b","e-mail"],["email","a b@c.com","e-mail"],["username","ab","usuário"],["username","joão","usuário"],["username","a".repeat(17),"usuário"],["username","a b c","usuário"],["username","<img>","usuário"],["password","1234567","senha"]]){
 r=await Net.signUp({...good,[k]:v});T(`validação: ${k}="${v}" recusado sem rede`,!r.ok&&r.error.toLowerCase().includes(msg)&&calls.length==0)}
T('validação local não conta como falha (sem cooldown)',Net.cooldown()==0);
m.avail=false;r=await Net.signUp(good);T('username já em uso (RPC): recusa e não cadastra',!r.ok&&/já em uso/.test(r.error)&&!calls.some(c=>c[0]=='signUp'));m.avail=true;calls.length=0;
r=await Net.signUp({email:"  a@b.co ",username:" ok_user-1 ",password:"senhaforte1",captchaToken:"tok"});const su=calls.find(c=>c[0]=='signUp')[1];
T('cadastro: aparar e-mail/usuário, metadata e captchaToken repassados',r.ok&&r.needsConfirm&&su.email=="a@b.co"&&su.options.data.username=="ok_user-1"&&su.options.captchaToken=="tok");
m.signUpRes={data:{user:{identities:[{}]},session:{}},error:null};r=await Net.signUp(good);T('cadastro com sessão: sem confirmação de e-mail',r.ok&&!r.needsConfirm);
m.signUpRes={data:{user:{identities:[]},session:null},error:null};r=await Net.signUp(good);T('e-mail já cadastrado (identities vazio) é detectado',!r.ok&&/já está cadastrado/.test(r.error));
// cooldown progressivo (já há 1 falha acima): precisamos de 3 seguidas
m.signInRes={error:{message:"Invalid login credentials"}};
await Net.signIn({email:"a@b.co",password:"x"});T('2 falhas seguidas: ainda sem trava',Net.cooldown()==0);
r=await Net.signIn({email:"a@b.co",password:"x"});T('3 falhas seguidas: trava de 10 s',Net.cooldown()==10000&&/Invalid|incorretos/i.test(r.error));
calls.length=0;r=await Net.signIn({email:"a@b.co",password:"certa"});T('durante a trava: recusa sem chamar o servidor',!r.ok&&/Aguarde/.test(r.error)&&calls.length==0);
r=await Net.signUp(good);T('trava vale também para cadastro',!r.ok&&/Aguarde/.test(r.error)&&calls.length==0);
now+=10001;T('após 10 s a trava termina',Net.cooldown()==0);
await Net.signIn({email:"a@b.co",password:"x"});T('4ª falha: trava dobra (20 s)',Net.cooldown()==20000);
const t2=load();T('trava persiste ao recarregar a página',t2.Net.cooldown()>0);
now+=20001;m.signInRes={error:null};r=await Net.signIn({email:"a@b.co",password:"certa"});T('login ok zera as falhas',r.ok&&Net.cooldown()==0);
m.signInRes={error:{message:"Invalid login credentials"}};await Net.signIn({email:"a@b.co",password:"x"});await Net.signIn({email:"a@b.co",password:"x"});T('após sucesso o contador recomeça do zero',Net.cooldown()==0);
now+=1;m.signInRes={error:null};await Net.signIn({email:"a@b.co",password:"ok"});
for(let i=0;i<20;i++){m.signInRes={error:{message:"x"}};await Net.signIn({email:"a@b.co",password:"x"});now+=Net.cooldown()+1}T('trava nunca passa de 300 s',(await Net.signIn({email:"a@b.co",password:"x"}),Net.cooldown()<=300000));
// mapeamento de erros
for(const[e,s]of[["Invalid login credentials","incorretos"],["User already registered","já está cadastrado"],["Password should be at least 6 characters","Senha"],["email rate limit exceeded","Muitas tentativas"],["captcha verification process failed","anti-robô"],["Failed to fetch","conexão"],["Database error saving new user","já em uso"]])T(`erro traduzido: ${e}`,Net.tr({message:e}).includes(s));
// perfil
const t3=load();t3.Net.init();let fired=0;t3.Net.onChange(()=>fired++);t3.m.profileRow={id:"u1",username:"existente",elo:1100,wins:2,losses:1};
t3.m.cb("SIGNED_IN",{user:{id:"u1",user_metadata:{}}});await tick();await tick();T('login carrega perfil e avisa quem escuta',fired>=1&&t3.Net.profile().username=="existente"&&t3.Net.user().id=="u1");
t3.m.profileRow=null;t3.m.cb("SIGNED_IN",{user:{id:"u2",user_metadata:{username:"novo_user"}}});await tick();await tick();
T('perfil ausente é criado a partir do metadata (sem enviar elo/wins/losses)',t3.m.inserted.length==1&&JSON.stringify(t3.m.inserted[0])==JSON.stringify({id:"u2",username:"novo_user"}));
t3.m.cb("SIGNED_OUT",null);await tick();T('logout limpa usuário e perfil',t3.Net.user()==null&&t3.Net.profile()==null);
console.log(`SUPABASE.JS: ok=${ok} falhas=${bad}`);process.exitCode=bad?1:0})();
