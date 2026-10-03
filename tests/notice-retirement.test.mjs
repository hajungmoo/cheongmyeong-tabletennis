import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const origin='https://cheongmyeong-tabletennis.vercel.app';
const scope=origin+'/team-notices/';
const files=new URL('../team-notices/',import.meta.url);

test('Retirement preserves homepage/manager storage, caches, and workers',async()=>{
  const calls=[];
  const reg=path=>({scope:origin+path,async update(){calls.push('update:'+path);},pushManager:{async getSubscription(){return {async unsubscribe(){calls.push('unsubscribe:'+path);}};}},async getNotifications(){return [{close(){calls.push('close:'+path);}}];},async unregister(){calls.push('unregister:'+path);}});
  const code=fs.readFileSync(new URL('retired.js',files),'utf8');
  await vm.runInNewContext(code,{URL,location:{origin},localStorage:{removeItem(key){calls.push('storage:'+key);}},navigator:{serviceWorker:{async getRegistrations(){return [reg('/'),reg('/manager/'),reg('/team-notices/'),reg('/team-notices-other/')];}}},caches:{async keys(){return ['homepage-v1','manager-v4','cm-notices-shell-v1','cm-notices-shell-v3'];},async delete(key){calls.push('cache:'+key);}}});
  assert.deepEqual(calls.filter(s=>s.startsWith('storage:')),['storage:cm-notices-member']);
  assert.deepEqual(calls.filter(s=>s.startsWith('cache:')),['cache:cm-notices-shell-v1','cache:cm-notices-shell-v3']);
  assert.deepEqual(calls.filter(s=>s.startsWith('unregister:')),['unregister:/team-notices/']);
  assert.deepEqual(calls.filter(s=>s.startsWith('unsubscribe:')),['unsubscribe:/team-notices/']);
  assert.equal(calls.some(s=>s.includes('/manager/')),false);
});

test('An old installed notice worker retires only notice windows and subscriptions',async()=>{
  const events={},calls=[];
  const client=url=>({url,async navigate(to){calls.push(['navigate',url,to]);}});
  vm.runInNewContext(fs.readFileSync(new URL('sw.js',files),'utf8'),{
    URL,self:{location:{origin},addEventListener(name,handler){events[name]=handler;},async skipWaiting(){calls.push(['skip']);},registration:{pushManager:{async getSubscription(){return {async unsubscribe(){calls.push(['unsubscribe']);}};}},async getNotifications(){return [];},async unregister(){calls.push(['unregister']);}},clients:{async matchAll(){return [client(scope+'?notice=old'),client(origin+'/manager/'),client(origin+'/'),client(origin+'/team-notices-other/')];}}},
    caches:{async keys(){return ['homepage-v1','cm-notices-shell-v3'];},async delete(key){calls.push(['cache',key]);}}
  });
  let pending;events.install({waitUntil(p){pending=p;}});await pending;
  events.activate({waitUntil(p){pending=p;}});await pending;
  assert.deepEqual(calls.filter(c=>c[0]==='cache'),[['cache','cm-notices-shell-v3']]);
  assert.deepEqual(calls.filter(c=>c[0]==='navigate'),[['navigate',scope+'?notice=old',scope]]);
  assert.equal(calls.filter(c=>c[0]==='unregister').length,1);
  assert.equal(events.fetch,undefined);
  assert.doesNotThrow(()=>events.push({}));
});
