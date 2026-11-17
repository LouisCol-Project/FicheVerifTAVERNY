const CACHE='verif-tav-v42-20261117';
const SHELL=['./index.html','./app.css','./mobile.css','./app.js','./model.js','./backend.js','./assets-index.js','./manifest.json','./icon.svg','./icon-192.png','./icon-512.png','./icon-maskable.png','./assets/logo.png','./assets/centre.webp',...['VSSUAP','FPTGP','CCFM','VSRM','VTU'].map(v=>'./assets/vehicles/'+v+'.webp')];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&(k.startsWith('verif-tav-')||k.startsWith('cis-tav-'))).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==self.location.origin)return;
  const base=new URL('./',self.location.href);
  if(!u.pathname.startsWith(base.pathname))return;
  const path='./'+u.pathname.slice(base.pathname.length);
  if(r.mode==='navigate'&&(path==='./'||path==='./index.html')){
    e.respondWith(fetch(r).catch(()=>caches.match('./index.html')));return;
  }
  if(SHELL.includes(path)||path.startsWith('./assets/reference/')||path.startsWith('./assets/splash/'))e.respondWith(fetch(r).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(path,copy));}return res;}).catch(()=>caches.match(path)));
});
