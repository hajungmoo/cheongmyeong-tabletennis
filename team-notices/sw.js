const CACHE='cm-notices-shell-v2';
const SHELL=['./','./index.html','./app.css','./student.js','./push-ui.js','./shared.js','./config.js','./icon-192.png','./icon-512.png','./manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('cm-notices-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith('/team-notices/'))return;
 // Only the public app shell is cached. Member data and photos are never cached.
 const path=url.pathname.split('/').pop()||'index.html';if(!['index.html','app.css','student.js','push-ui.js','shared.js','config.js','icon-192.png','icon-512.png','manifest.webmanifest'].includes(path))return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok&&!url.search)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));return response;}).catch(()=>caches.match(url.pathname.endsWith('/')?'./index.html':url.pathname)));});
self.addEventListener('push',event=>{let data={};try{data=event.data?.json()||{};}catch{}
 const id=/^[a-zA-Z0-9_-]{1,80}$/.test(data.id||'')?data.id:'';
 event.waitUntil(self.registration.showNotification('청명초 알림장',{body:'코치님이 새 공지를 올렸어요. 눌러서 확인해주세요.',icon:'./icon-192.png',badge:'./icon-192.png',tag:id?'notice-'+id:'cm-notice',data:{url:self.location.origin+'/team-notices/'+(id?'?notice='+encodeURIComponent(id):'')},renotify:false}));});
self.addEventListener('notificationclick',event=>{event.notification.close();const url=event.notification.data?.url||self.location.origin+'/team-notices/';
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{const client=clients.find(c=>c.url.startsWith(self.location.origin+'/team-notices/'));if(client){await client.navigate(url);return client.focus();}return self.clients.openWindow(url);}));});
