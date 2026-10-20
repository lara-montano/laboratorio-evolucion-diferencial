const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const root=__dirname;
const read=name=>fs.readFileSync(path.join(root,'src',name),'utf8');
const html=read('page.html').replace('/*__STYLES__*/',()=>read('style.css')).replace('/*__DATA__*/',()=>read('solar-data.json')).replace('/*__ENGINE__*/',()=>read('engine.js')).replace('/*__APP__*/',()=>read('app.js'));
if(/\/\*__(STYLES|DATA|ENGINE|APP)__\*\//.test(html))throw Error('Marcador sin resolver');
const scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
if(scripts.length!==3)throw Error('Número inesperado de scripts');
scripts.forEach((s,i)=>s[1].includes('application/json')?JSON.parse(s[2]):new vm.Script(s[2],{filename:'script-'+i}));
if(/<script[^>]+src=|<link[^>]+rel=["']stylesheet|@import\s|fetch\(/i.test(html))throw Error('Dependencia externa inesperada');
fs.mkdirSync(path.join(root,'dist'),{recursive:true});
for(const destination of [path.join(root,'dist','index.html'),path.join(root,'laboratorio_evolucion_diferencial.html')]){fs.writeFileSync(destination+'.tmp',html);fs.renameSync(destination+'.tmp',destination);}
console.log('HTML autónomo v2 validado:',Buffer.byteLength(html),'bytes');
