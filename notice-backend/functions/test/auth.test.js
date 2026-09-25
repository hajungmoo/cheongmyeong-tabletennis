import test from 'node:test';
import assert from 'node:assert/strict';
import {noticeHttpHandler} from '../index.js';
async function request(action,headers={}){
 const req={method:'POST',body:{action},rawBody:Buffer.from('{}'),is:type=>type==='application/json',get:name=>headers[name]};
 const out={status:200,body:null};const res={set(){return this;},status(status){out.status=status;return this;},json(body){out.body=body;return this;}};
 await noticeHttpHandler(req,res);return out;
}
test('관리자 토큰 없이 공지 저장·삭제·예약 취소·사진 조회·초대를 할 수 없다',async()=>{
 for(const action of ['bootstrap','dashboard','save','cancel','delete','receipts','invite','revoke','adminImage']){const result=await request(action);assert.equal(result.status,401,action);assert.match(result.body.error,/로그인/);}
});
test('연결되지 않은 기기는 공지·사진·확인·구독 기능에 접근할 수 없다',async()=>{
 for(const action of ['me','feed','image','ack','subscribe','leave']){const result=await request(action);assert.equal(result.status,401,action);assert.match(result.body.error,/초대코드/);}
});
