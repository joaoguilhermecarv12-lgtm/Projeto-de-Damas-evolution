// Confere que todo $("#id") do script existe no index.html e que não há links quebrados.
const fs=require('fs'),d=__dirname+'/../';const html=fs.readFileSync(d+'index.html','utf8'),js=fs.readFileSync(d+'script.js','utf8');
const ids=new Set([...html.matchAll(/id="([\w-]+)"/g)].map(m=>m[1]));[...js.matchAll(/id=\\?"([\w-]+)\\?"/g)].forEach(m=>ids.add(m[1]));
const miss=[...new Set([...js.matchAll(/\$\("#([\w-]+)"\)/g)].map(m=>m[1]))].filter(i=>!ids.has(i));
const gos=[...html.matchAll(/data-go="(\w+)"/g)].map(m=>m[1]).concat([...js.matchAll(/data-go="(\w+|\$\{[^}]+\})"/g)].map(m=>m[1]));
const bad=[];if(miss.length)bad.push('ids ausentes: '+miss);if(!/href="style.css"/.test(html)||!/src="script.js"/.test(html))bad.push('links css/js');
if(/localStorage\.(getItem|setItem)/.test(js.replace(/try\{[^}]*\}/g,'')))bad.push('localStorage fora de try');
console.log('ESTÁTICO:',bad.length?'FALHOU '+bad.join('; '):'ok');process.exitCode=bad.length?1:0;
