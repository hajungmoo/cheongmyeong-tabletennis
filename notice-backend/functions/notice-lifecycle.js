import {fail,validId,canRead} from './domain.js';

// A content-free marker prevents a delayed save retry from recreating a deleted notice.
export async function readNoticeForSave(tx,db,id){
 const [notice,deleted]=await Promise.all([tx.get(db.doc('notices/'+id)),tx.get(db.doc('deletedNoticeIds/'+id))]);
 fail(deleted.exists||notice.data()?.state==='deleting','삭제된 공지는 다시 저장할 수 없습니다.',409);
 return notice;
}

export async function deleteNoticeData(db,id,now=Date.now){
 fail(!validId(id),'공지를 찾지 못했습니다.');
 const noticeRef=db.doc('notices/'+id),jobRef=db.doc('outbox/'+id);
 const imageIds=await db.runTransaction(async tx=>{
  const [notice,job]=await Promise.all([tx.get(noticeRef),tx.get(jobRef)]);
  // Dispatch leases outlive the function's 120-second timeout. Do not delete
  // underneath an active sender, including one running the previous revision.
  fail(job.exists&&job.data().leaseUntil>now(),'알림을 전송 중입니다. 잠시 후 다시 삭제해주세요.',409);
  const ids=notice.exists&&Array.isArray(notice.data().imageIds)?notice.data().imageIds:[];
  tx.set(db.doc('deletedNoticeIds/'+id),{deletedAt:now()});
  if(notice.exists)tx.update(noticeRef,{state:'deleting',updatedAt:now()});
  tx.delete(jobRef);
  return ids;
 });
 // Include any old image versions left by an interrupted edit. Cleanup is
 // retryable and is split into bounded writes, rather than one 500-write batch.
 const images=await db.collection('images').where('noticeId','==',id).get();
 const refs=new Map(images.docs.map(d=>[d.id,d.ref]));
 for(const imageId of imageIds)refs.set(imageId,db.doc('images/'+imageId));
 const allRefs=[...refs.values()];
 for(let start=0;start<allRefs.length;start+=400){
  const batch=db.batch();allRefs.slice(start,start+400).forEach(ref=>batch.delete(ref));await batch.commit();
 }
 await Promise.all(['receipts','deliveries'].map(name=>db.recursiveDelete(noticeRef.collection(name))));
 // Keep the parent visible to the coach for a retry if any cleanup step fails.
 await noticeRef.delete();
 return {ok:true};
}

export async function acknowledgeNotice(db,id,memberId,now=Date.now){
 fail(!validId(id),'공지를 찾지 못했습니다.',404);
 const noticeRef=db.doc('notices/'+id),receiptRef=noticeRef.collection('receipts').doc(memberId);
 await db.runTransaction(async tx=>{
  const [notice,receipt]=await Promise.all([tx.get(noticeRef),tx.get(receiptRef)]);
  // Reading the parent in this transaction prevents an acknowledgement from
  // recreating an orphan receipt while the notice is being deleted.
  fail(!notice.exists||!canRead(notice.data(),memberId),'공지를 찾지 못했습니다.',404);
  if(!receipt.exists)tx.create(receiptRef,{at:now()});
 });
 return {ok:true};
}
