const VER='ikhtabirni-v5', CORE=VER+'-core', CDN=VER+'-cdn', FONT=VER+'-font';
const PRECACHE=['./','./index.html','./manifest.webmanifest','./css/style.css','./js/app.js','./js/db.js','./js/importer.js','./js/teacher.js','./js/student.js','./js/constants.js'];
self.addEventListener('install',(e)=>{e.waitUntil(caches.open(CORE).then((c)=>c.addAll(PRECACHE)).then(()=>caches.open(CORE).then((c)=>c.add('./assets/logo.png').catch(()=>{}))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',(e)=>{e.waitUntil(caches.keys().then((ks)=>Promise.all(ks.filter((k)=>![CORE,CDN,FONT].includes(k)).map((k)=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',(e)=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
  if(u.hostname==='cdn.jsdelivr.net'){e.respondWith(cf(r,CDN));return;}
  if(u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com'){e.respondWith(cf(r,FONT));return;}
  if(r.mode==='navigate'){e.respondWith(fetch(r).then((x)=>{const c=x.clone();caches.open(CORE).then((cc)=>cc.put(r,c));return x;}).catch(()=>caches.match(r).then((h)=>h||caches.match('./index.html'))));return;}
  e.respondWith(swr(r,CORE));});
async function cf(r,n){const h=await caches.match(r);const net=fetch(r).then((x)=>{if(x&&x.ok){const c=x.clone();caches.open(n).then((cc)=>cc.put(r,c));}return x;}).catch(()=>h);return h||net;}
async function swr(r,n){const cache=await caches.open(n);const h=await cache.match(r);const net=fetch(r).then((x)=>{if(x&&x.ok)cache.put(r,x.clone());return x;}).catch(()=>h);return h||net;}
