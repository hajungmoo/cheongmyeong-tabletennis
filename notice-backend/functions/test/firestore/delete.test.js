import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {Firestore} from '@google-cloud/firestore';
import {deleteNoticeData,readNoticeForSave,acknowledgeNotice} from '../../notice-lifecycle.js';

// These tests must never connect to the production project, even by accident.
assert.match(process.env.FIRESTORE_EMULATOR_HOST||'',/^(127\.0\.0\.1|localhost):\d+$/,'로컬 Firestore 에뮬레이터가 필요합니다.');
const db=new Firestore({projectId:'demo-cm-notices',databaseId:'cm-notices'});
after(()=>db.terminate());
const at=Date.now(),clock=()=>at;
const memberId='test-member-01';
async function seed(id,state='scheduled',leaseUntil=0){
 const batch=db.batch();
 batch.set(db.doc('notices/'+id),{title:'삭제 검증용',body:'실제 선수가 없는 에뮬레이터 테스트',audience:[memberId],imageIds:[id+'-image'],state,version:1,createdAt:at});
 batch.set(db.doc('images/'+id+'-image'),{noticeId:id,data:'test-photo'});
 batch.set(db.doc('images/'+id+'-old-image'),{noticeId:id,data:'old-photo'});
 batch.set(db.doc('outbox/'+id),{version:1,dueAt:at+60000,leaseUntil});
 batch.set(db.doc('notices/'+id+'/receipts/'+memberId),{at});
 batch.set(db.doc('notices/'+id+'/deliveries/test-device-01'),{status:'sent',at});
 await batch.commit();
}
async function assertRemoved(id){
 for(const path of ['notices/'+id,'outbox/'+id,'images/'+id+'-image','images/'+id+'-old-image'])assert.equal((await db.doc(path).get()).exists,false,path);
 for(const name of ['receipts','deliveries'])assert.equal((await db.collection('notices/'+id+'/'+name).get()).size,0,name);
 const marker=await db.doc('deletedNoticeIds/'+id).get();
 assert.deepEqual(marker.data(),{deletedAt:at});
}

test('예약·발행·취소 공지는 사진·확인·전달 기록·예약과 함께 삭제하고 다른 데이터는 보존한다',async()=>{
 await seed('unrelated-notice');
 await db.doc('members/'+memberId).set({name:'에뮬레이터 선수',active:true});
 for(const state of ['scheduled','published','cancelled']){
  const id='delete-'+state;await seed(id,state);assert.deepEqual(await deleteNoticeData(db,id,clock),{ok:true});await assertRemoved(id);
 }
 assert.equal((await db.doc('notices/unrelated-notice').get()).exists,true);
 assert.equal((await db.doc('images/unrelated-notice-image').get()).exists,true);
 assert.equal((await db.doc('members/'+memberId).get()).data().active,true);
});

test('발송 중에는 삭제를 보류하고 발송 잠금이 만료된 뒤 안전하게 삭제한다',async()=>{
 const id='delete-sending';await seed(id,'published',at+180000);
 await assert.rejects(deleteNoticeData(db,id,clock),error=>error.status===409);
 assert.equal((await db.doc('outbox/'+id).get()).exists,true);
 assert.equal((await db.doc('notices/'+id).get()).data().state,'published');
 assert.equal((await db.doc('deletedNoticeIds/'+id).get()).exists,false);
 await db.doc('outbox/'+id).update({leaseUntil:at-1});
 await deleteNoticeData(db,id,clock);await assertRemoved(id);
});

test('삭제를 반복하거나 늦게 도착한 저장·확인 요청을 받아도 공지와 기록이 되살아나지 않는다',async()=>{
 const id='delete-retry';await seed(id,'published');await deleteNoticeData(db,id,clock);await deleteNoticeData(db,id,clock);
 await assert.rejects(db.runTransaction(async tx=>{await readNoticeForSave(tx,db,id);tx.set(db.doc('notices/'+id),{state:'scheduled'});}),error=>error.status===409);
 await assert.rejects(acknowledgeNotice(db,id,memberId,clock),error=>error.status===404);
 await assertRemoved(id);
});

test('삭제 도중 정리가 실패해도 공지는 숨겨지고 재시도로 남은 기록을 정리한다',async()=>{
 const id='delete-interrupted';await seed(id,'published');
 const flaky=Object.create(db);flaky.recursiveDelete=async()=>{throw new Error('simulated cleanup failure');};
 await assert.rejects(deleteNoticeData(flaky,id,clock),/simulated cleanup failure/);
 assert.equal((await db.doc('notices/'+id).get()).data().state,'deleting');
 assert.equal((await db.doc('outbox/'+id).get()).exists,false);
 await assert.rejects(acknowledgeNotice(db,id,memberId,clock),error=>error.status===404);
 await deleteNoticeData(db,id,clock);await assertRemoved(id);
});

test('500개가 넘는 전달 기록도 일괄 쓰기 한도에 걸리지 않고 모두 정리한다',async()=>{
 const id='delete-large';await seed(id,'published');
 for(let start=0;start<600;start+=300){const batch=db.batch();for(let i=start;i<start+300;i++)batch.set(db.doc('notices/'+id+'/deliveries/device-'+i),{status:'sent',at});await batch.commit();}
 await deleteNoticeData(db,id,clock);await assertRemoved(id);
});

test('선수 확인과 삭제가 동시에 실행돼도 고아 확인 기록이 남지 않는다',async()=>{
 const id='delete-concurrent';await seed(id,'published');
 await db.doc('notices/'+id).update({audience:'all'});
 const results=await Promise.allSettled([acknowledgeNotice(db,id,'test-member-02',clock),deleteNoticeData(db,id,clock)]);
 assert.equal(results[1].status,'fulfilled');
 if(results[0].status==='rejected')assert.equal(results[0].reason.status,404);
 await assertRemoved(id);
});
