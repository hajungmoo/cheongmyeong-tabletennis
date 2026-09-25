import test from 'node:test';
import assert from 'node:assert/strict';
import {validateNotice,validateSubscription,canRead,shouldClaim,deliveryOutcome,secret,hash} from '../domain.js';
const now=Date.parse('2026-09-24T10:00:00Z');
const base={title:'내일 단체복',body:'파란 단체복을 챙겨주세요.',category:'uniform',audience:'all',images:[]};
test('예약은 한국시간 20시를 UTC 11시로 전달하고, 조기 발송하지 않는다',()=>{
 const n=validateNotice({...base,sendAt:'2026-09-24T11:00:00.000Z'},now);
 assert.equal(new Date(n.dueAt).toISOString(),'2026-09-24T11:00:00.000Z');
 assert.equal(shouldClaim({dueAt:n.dueAt,leaseUntil:0},now),false);
 assert.equal(shouldClaim({dueAt:n.dueAt,leaseUntil:0},n.dueAt),true);
 assert.equal(shouldClaim({dueAt:n.dueAt,leaseUntil:n.dueAt+5000},n.dueAt),false);
});
test('지난 시간, 빈 내용, 잘못된 수신 대상은 저장 전에 거절한다',()=>{
 for(const patch of [{sendAt:'2026-09-24T09:00:00Z'},{title:''},{body:''},{audience:[]},{audience:['../members']},{images:Array(4).fill('')}])assert.throws(()=>validateNotice({...base,...patch},now));
});
test('예약·취소·삭제 중·다른 선수의 공지는 선수 화면에 노출하지 않는다',()=>{
 for(const state of ['scheduled','cancelled','deleting'])assert.equal(canRead({...base,state},'member-01'),false);
 assert.equal(canRead({...base,state:'published'},'member-01'),true);
 assert.equal(canRead({...base,audience:['member-02'],state:'published'},'member-01'),false);
 assert.equal(canRead({...base,audience:['member-01'],state:'published'},'member-01'),true);
});
const keys={p256dh:Buffer.alloc(65,4).toString('base64url'),auth:Buffer.alloc(16,1).toString('base64url')};
test('Apple·Chrome·Firefox 알림만 허용하고 내부 주소·가짜 도메인을 거절한다',()=>{
 for(const endpoint of ['https://web.push.apple.com/Qabc','https://fcm.googleapis.com/fcm/send/abc','https://updates.push.services.mozilla.com/wpush/v2/abc'])assert.equal(validateSubscription({endpoint,keys}).endpoint,endpoint);
 for(const endpoint of ['http://fcm.googleapis.com/abc','https://127.0.0.1','https://metadata.google.internal/','https://fcm.googleapis.com.evil.example/a','https://user:pass@fcm.googleapis.com/a','https://fcm.googleapis.com:8443/a'])assert.throws(()=>validateSubscription({endpoint,keys}));
 assert.throws(()=>validateSubscription({endpoint:'https://web.push.apple.com/a',keys:{auth:'abc',p256dh:'abc'}}));
});
test('사진은 JPEG 변환 결과만 받고 SVG·과대 용량을 거절한다',()=>{
 const jpeg='data:image/jpeg;base64,'+Buffer.from([0xff,0xd8,1,2,0xff,0xd9]).toString('base64');
 assert.equal(validateNotice({...base,images:[jpeg]},now).images.length,1);
 for(const image of ['data:image/svg+xml;base64,PHN2Zz4=','data:image/jpeg;base64,YWJj',jpeg+'a'.repeat(560000)])assert.throws(()=>validateNotice({...base,images:[image]},now));
});
test('만료된 기기는 재시도하지 않고 일시적 장애만 재시도한다',()=>{
 assert.equal(deliveryOutcome(410),'expired');assert.equal(deliveryOutcome(404),'expired');assert.equal(deliveryOutcome(403),'failed');assert.equal(deliveryOutcome(429),'retry');assert.equal(deliveryOutcome(503),'retry');assert.equal(deliveryOutcome(0),'retry');
});
test('기기 토큰은 무작위로 생성되며 저장 키에 원문을 사용하지 않는다',()=>{const a=secret(),b=secret();assert.equal(a.length,32);assert.notEqual(a,b);assert.equal(hash(a).length,64);assert.notEqual(hash(a),a);});
