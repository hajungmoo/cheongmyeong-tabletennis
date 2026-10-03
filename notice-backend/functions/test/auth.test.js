import test from 'node:test';
import assert from 'node:assert/strict';
import {noticeHttpHandler,ignoreRetiredNotice} from '../retirement.js';
test('Every former API operation is closed without inspecting credentials or data',()=>{
  for(const method of ['GET','POST','DELETE'])for(const action of ['status','join','bootstrap','dashboard','save','cancel','delete','receipts','invite','revoke','adminImage','me','feed','image','ack','subscribe','leave']){
    const req=new Proxy({method,body:{action}},{get(){throw new Error('Retired API must not inspect user data');}});
    const output={headers:{}};
    const res={set(k,v){output.headers[k]=v;return this;},status(v){output.status=v;return this;},json(v){output.body=v;return this;}};
    noticeHttpHandler(req,res);
    assert.equal(output.status,410);
    assert.equal(output.body.ready,false);
    assert.equal(output.body.retired,true);
    assert.equal(output.body.capabilities.deleteNotice,false);
    assert.equal(output.headers['Cache-Control'],'no-store');
  }
});
test('Scheduled and queued notices perform no work',()=>{
  const event=new Proxy({},{get(){throw new Error('Retired trigger must not inspect an event');}});
  assert.equal(ignoreRetiredNotice(event),undefined);
});
