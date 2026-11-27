// Auditoria estática: ids, colisões de id, XSS por interpolação, scripts e segredos.
const fs=require('fs'),d=__dirname+'/../';const html=fs.readFileSync(d+'index.html','utf8'),js=fs.readFileSync(d+'script.js','utf8'),net=fs.readFileSync(d+'supabase.js','utf8');
const bad=[];
const stat=[...html.matchAll(/\bid="([\w-]+)"/g)].map(m=>m[1]);
const dup=stat.filter((x,i)=>stat.indexOf(x)!=i);if(dup.length)bad.push('ids duplicados no HTML: '+[...new Set(dup)]);
const dyn=new Set([...js.matchAll(/\bid=\\?"([\w-]+)\\?"/g)].map(m=>m[1]));[...js.matchAll(/\bid:"([\w-]+)"/g)].forEach(m=>dyn.add(m[1]));
const clash=[...dyn].filter(x=>stat.includes(x));if(clash.length)bad.push('id criado no JS colide com id estático (causa do bug do cadastro): '+clash);
const all=new Set([...stat,...dyn]);
const used=[...new Set([...js.matchAll(/\$\("#([\w-]+)"\)/g)].map(m=>m[1]))];const miss=used.filter(i=>!all.has(i));if(miss.length)bad.push('ids usados sem elemento: '+miss);
for(const f of['login-email','login-password','login-submit','signup-email','signup-username','signup-password','signup-hp','signup-submit'])if(!stat.includes(f))bad.push('falta id '+f);
if(/getElementById/.test(js))bad.push('uso de getElementById (padrão do projeto é $())');
for(const m of js.matchAll(/`(?:[^`\\]|\\.)*`/g)){if(/\$\{[^}]*(username|\.email|opp\.|\.elo|\.wins|\.losses)[^}]*\}/.test(m[0])&&/(innerHTML\s*=|\bmodal\()\s*$/.test(js.slice(Math.max(0,m.index-30),m.index)))bad.push('dado da rede em innerHTML/modal(): '+m[0].slice(0,50))}
if(!/href="style.css"/.test(html)||!/src="script.js"/.test(html))bad.push('links css/js');
const o=[html.indexOf('supabase-js@2'),html.indexOf('src="supabase.js"'),html.indexOf('src="script.js"')];if(!(o[0]>0&&o[0]<o[1]&&o[1]<o[2]))bad.push('ordem dos scripts');
if(/sb_secret_[\w-]{10,}|eyJ[\w-]{20,}/.test(net+js))bad.push('chave secreta no código');
if(/localStorage\.(getItem|setItem)/.test(js.replace(/try\{[^}]*\}/g,'')))bad.push('localStorage fora de try');
if(!/class="hp"[^>]*tabindex="-1"/.test(html))bad.push('honeypot ausente');
console.log('ESTÁTICO:',bad.length?'FALHOU\n - '+bad.join('\n - '):'ok ('+stat.length+' ids estáticos, '+used.length+' seletores auditados)');process.exitCode=bad.length?1:0;
