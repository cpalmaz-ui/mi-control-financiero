const CACHE="mi-control-financiero-publico-v11";
const ASSETS=["./manifest.webmanifest","./icon.svg"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))]));
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET"||new URL(event.request.url).origin!==self.location.origin)return;
  if(event.request.mode==="navigate"||new URL(event.request.url).pathname.endsWith("/index.html")){
    event.respondWith(fetch(new Request(event.request,{cache:"no-store"})).catch(()=>caches.match("./index.html").then(r=>r||Response.error())));
    return;
  }
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});