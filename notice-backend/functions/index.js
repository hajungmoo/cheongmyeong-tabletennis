import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {onRequest} from 'firebase-functions/v2/https';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {defineString} from 'firebase-functions/params';
import webpush from 'web-push';
import {AppError,fail,hash,secret,validId,validCode,validateNotice,validateSubscription,canRead,publicNotice,retryDelay,deliveryOutcome,shouldClaim} from './domain.js';
initializeApp();
// Deliberately separate from the existing website/manager database and rules.
const db=getFirestore('cm-notices');
const ADMIN_UID=defineString('NOTICES_ADMIN_UID',{default:'RwknxZw7wRgtG8Ca5WJu6yXlHNE3'});
const APP_ORIGIN='https://cheongmyeong-tabletennis.vercel.app';
const runtimeRef=db.doc('config/runtime');
const now=()=>Date.now();
const opts={region:'asia-northeast3',memory:'256MiB',maxInstances:2,timeoutSeconds:120};

async function adminAuth(req){const header=req.get('Authorization')||'';fail(!header.startsWith('Bearer '),'관리자 로그인이 필요합니다.',401);let decoded;try{decoded=await getAuth().verifyIdToken(header.slice(7),true);}catch{throw new AppError(401,'로그인이 만료되었습니다. 다시 로그인해주세요.');}fail(decoded.uid!==ADMIN_UID.value(),'공지 관리 권한이 없습니다.',403);return decoded.uid;}
async function memberAuth(req){const token=req.get('X-Member-Token')||'';fail(!/^[A-Za-z0-9_-]{32}$/.test(token),'초대코드로 연결해주세요.',401);const sessionRef=db.doc('sessions/'+hash(token)),session=await sessionRef.get();fail(!session.exists||session.data().expiresAt<now(),'기기 연결이 만료되었습니다. 새 초대코드로 연결해주세요.',401);const member=await db.doc('members/'+session.data().memberId).get();fail(!member.exists||!member.data().active,'기기 연결이 해제되었습니다.',401);return {id:member.id,...member.data(),sessionId:session.id};}
async function rateLimit(req){const key=hash((req.ip||'unknown')+':'+Math.floor(now()/60000));const ref=db.doc('limits/'+key);await db.runTransaction(async tx=>{const snap=await tx.get(ref),count=snap.exists?snap.data().count:0;fail(count>=12,'입력 시도가 많습니다. 1분 뒤 다시 시도해주세요.',429);tx.set(ref,{count:count+1,expiresAt:now()+3600000});});}
async function bootstrap(){return db.runTransaction(async tx=>{const snap=await tx.get(runtimeRef);if(snap.exists)return {ready:true};const keys=webpush.generateVAPIDKeys();tx.create(runtimeRef,{...keys,createdAt:now(),version:1});return {ready:true};});}
async function requireNotice(id,member){fail(!validId(id),'공지를 찾지 못했습니다.',404);const ref=db.doc('notices/'+id),snap=await ref.get();fail(!snap.exists||!canRead(snap.data(),member.id),'공지를 찾지 못했습니다.',404);return {ref,...snap.data()};}
async function handle(req){
 const input=req.body||{},action=input.action;
 if(action==='status'){const config=await runtimeRef.get();return {ready:config.exists,publicKey:config.exists?config.data().publicKey:'',version:'1.0.0'};}
 if(action==='join'){
  await rateLimit(req);fail(!validCode(input.code),'초대코드를 다시 확인해주세요.');
  const ref=db.doc('invites/'+hash(input.code)),token=secret(),sessionRef=db.doc('sessions/'+hash(token));
  return db.runTransaction(async tx=>{const invite=await tx.get(ref);fail(!invite.exists,'초대코드를 다시 확인해주세요.');const data=invite.data();fail(data.expiresAt<now()||data.uses>=3,'초대코드가 만료되었습니다. 코치님에게 새 코드를 받아주세요.');const memberRef=db.doc('members/'+data.memberId),member=await tx.get(memberRef);fail(!member.exists||!member.data().active,'사용할 수 없는 초대코드입니다.');
   tx.create(sessionRef,{memberId:member.id,createdAt:now(),expiresAt:now()+180*86400000,deviceLabel:String(input.deviceLabel||'휴대폰').slice(0,30)});tx.update(ref,{uses:data.uses+1});tx.update(memberRef,{connected:true,lastConnectedAt:now()});return {token,member:{id:member.id,name:member.data().name}};});
 }
 const adminActions=new Set(['bootstrap','dashboard','invite','save','cancel','delete','receipts','revoke','adminImage']);
 if(adminActions.has(action)){
  await adminAuth(req);
  if(action==='bootstrap')return bootstrap();
  if(action==='adminImage'){fail(!validId(input.noticeId)||!validId(input.imageId),'사진을 찾지 못했습니다.',404);const n=await db.doc('notices/'+input.noticeId).get();fail(!n.exists||!n.data().imageIds.includes(input.imageId),'사진을 찾지 못했습니다.',404);const image=await db.doc('images/'+input.imageId).get();fail(!image.exists,'사진을 찾지 못했습니다.',404);return {image:image.data().data};}
  if(action==='dashboard'){
   const [members,notices,subs]=await Promise.all([db.collection('members').get(),db.collection('notices').orderBy('createdAt','desc').limit(100).get(),db.collection('subscriptions').get()]);
   return {members:members.docs.map(d=>({id:d.id,name:d.data().name,active:d.data().active,connected:!!d.data().connected,pushDevices:subs.docs.filter(s=>s.data().memberId===d.id).length})),notices:notices.docs.map(d=>({id:d.id,...d.data()})),pushCount:subs.size};
  }
  if(action==='invite'){
   const name=String(input.name||'').trim();fail(!name||name.length>20,'선수 이름을 입력해주세요.');const existing=await db.collection('members').where('name','==',name).limit(1).get();
   const memberRef=existing.empty?db.collection('members').doc():existing.docs[0].ref;
   if(existing.empty){const members=await db.collection('members').count().get();fail(members.data().count>=50,'최대 50명까지 초대할 수 있습니다.');}
   const code=secret(),batch=db.batch();batch.set(memberRef,{name,active:true,...(existing.empty?{createdAt:now(),connected:false}:{})},{merge:true});batch.create(db.doc('invites/'+hash(code)),{memberId:memberRef.id,uses:0,createdAt:now(),expiresAt:now()+7*86400000});await batch.commit();return {code,member:{id:memberRef.id,name},expiresAt:now()+7*86400000};
  }
  if(action==='save'){
   const id=input.id;fail(!validId(id),'공지 번호를 확인해주세요.');const data=validateNotice(input);
   if(data.audience!=='all'){const members=await db.getAll(...data.audience.map(id=>db.doc('members/'+id)));fail(members.some(m=>!m.exists||!m.data().active),'받을 선수를 다시 확인해주세요.');}
   const noticeRef=db.doc('notices/'+id),jobRef=db.doc('outbox/'+id);const imageIds=data.images.map(()=>db.collection('images').doc().id);const operation=String(input.operationId||'');fail(!validId(operation),'저장 요청을 확인해주세요.');
   const saved=await db.runTransaction(async tx=>{const prior=await tx.get(noticeRef);if(prior.exists&&prior.data().operationId===operation)return {duplicate:true,oldImages:[]};fail(prior.exists&&prior.data().state!=='scheduled','이미 발행되거나 취소된 공지는 수정할 수 없습니다.',409);
    const version=(prior.exists?prior.data().version:0)+1,{images,...notice}=data;tx.set(noticeRef,{...notice,imageIds,state:'scheduled',createdAt:prior.exists?prior.data().createdAt:now(),updatedAt:now(),version,operationId:operation,delivery:{state:'waiting',sent:0,failed:0}});tx.set(jobRef,{noticeId:id,version,dueAt:data.dueAt,leaseUntil:0,attempt:0});
    images.forEach((image,i)=>tx.create(db.doc('images/'+imageIds[i]),{noticeId:id,data:image,createdAt:now()}));return {duplicate:false,oldImages:prior.exists?prior.data().imageIds||[]:[]};});
   if(saved.oldImages.length){const batch=db.batch();saved.oldImages.forEach(id=>batch.delete(db.doc('images/'+id)));await batch.commit();}
   // An authenticated database trigger starts immediate delivery; the scheduler recovers missed/retry jobs.
   const final=await noticeRef.get();return {id,state:final.data().state,delivery:final.data().delivery,duplicate:saved.duplicate};
  }
  if(action==='cancel'){
   fail(!validId(input.id),'공지를 찾지 못했습니다.');await db.runTransaction(async tx=>{const ref=db.doc('notices/'+input.id),n=await tx.get(ref);fail(!n.exists||n.data().state!=='scheduled','이미 발행되어 예약을 취소할 수 없습니다.',409);tx.update(ref,{state:'cancelled',updatedAt:now()});tx.delete(db.doc('outbox/'+input.id));});return {ok:true};
  }
  if(action==='delete'){
   fail(!validId(input.id),'공지를 찾지 못했습니다.');const noticeRef=db.doc('notices/'+input.id),notice=await noticeRef.get();fail(!notice.exists,'공지를 찾지 못했습니다.',404);
   const [receipts,deliveries]=await Promise.all([noticeRef.collection('receipts').get(),noticeRef.collection('deliveries').get()]);const imageIds=Array.isArray(notice.data().imageIds)?notice.data().imageIds:[];
   const batch=db.batch();batch.delete(db.doc('outbox/'+input.id));receipts.docs.forEach(d=>batch.delete(d.ref));deliveries.docs.forEach(d=>batch.delete(d.ref));imageIds.forEach(id=>batch.delete(db.doc('images/'+id)));batch.delete(noticeRef);await batch.commit();return {ok:true};
  }
  if(action==='receipts'){
   fail(!validId(input.id),'공지를 찾지 못했습니다.');const [n,members,receipts]=await Promise.all([db.doc('notices/'+input.id).get(),db.collection('members').get(),db.collection('notices').doc(input.id).collection('receipts').get()]);fail(!n.exists,'공지를 찾지 못했습니다.',404);const seen=new Map(receipts.docs.map(r=>[r.id,r.data().at]));return {members:members.docs.filter(m=>m.data().active&&(n.data().audience==='all'||n.data().audience.includes(m.id))).map(m=>({id:m.id,name:m.data().name,confirmedAt:seen.get(m.id)||null})),delivery:n.data().delivery};
  }
  if(action==='revoke'){
   fail(!validId(input.id),'선수를 찾지 못했습니다.');const [sessions,subs,invites]=await Promise.all(['sessions','subscriptions','invites'].map(name=>db.collection(name).where('memberId','==',input.id).get()));const batch=db.batch();batch.update(db.doc('members/'+input.id),{active:false,connected:false});for(const snap of [sessions,subs,invites])snap.docs.forEach(d=>batch.delete(d.ref));await batch.commit();return {ok:true};
  }
 }
 const member=await memberAuth(req);
 if(action==='me')return {member:{id:member.id,name:member.name}};
 if(action==='feed'){
  const records=await db.collection('notices').orderBy('publishedAt','desc').limit(100).get();const readable=records.docs.filter(d=>canRead(d.data(),member.id));
  const receipts=readable.length?await db.getAll(...readable.map(d=>d.ref.collection('receipts').doc(member.id))):[];
  return {notices:readable.map((d,i)=>publicNotice(d.id,d.data(),receipts[i].exists))};
 }
 if(action==='image'){const notice=await requireNotice(input.noticeId,member);fail(!validId(input.imageId)||!notice.imageIds.includes(input.imageId),'사진을 찾지 못했습니다.',404);const image=await db.doc('images/'+input.imageId).get();fail(!image.exists,'사진을 찾지 못했습니다.',404);return {image:image.data().data};}
 if(action==='ack'){const n=await requireNotice(input.noticeId,member),ref=n.ref.collection('receipts').doc(member.id);await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)tx.create(ref,{at:now()});});return {ok:true};}
 if(action==='subscribe'){
  const subscription=validateSubscription(input.subscription),id=hash(subscription.endpoint);const existing=await db.collection('subscriptions').where('sessionId','==',member.sessionId).get();const batch=db.batch();existing.docs.filter(d=>d.id!==id).forEach(d=>batch.delete(d.ref));batch.set(db.doc('subscriptions/'+id),{memberId:member.id,sessionId:member.sessionId,subscription,updatedAt:now()});await batch.commit();return {ok:true};
 }
 if(action==='leave'){const subs=await db.collection('subscriptions').where('sessionId','==',member.sessionId).get();const batch=db.batch();subs.docs.forEach(d=>batch.delete(d.ref));batch.delete(db.doc('sessions/'+member.sessionId));await batch.commit();return {ok:true};}
 throw new AppError(400,'지원하지 않는 요청입니다.');
}
export async function noticeHttpHandler(req,res){
 res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');
 if(req.method!=='POST'){res.status(405).json({error:'POST 요청을 사용해주세요.'});return;}
 if(!req.is('application/json')){res.status(415).json({error:'JSON 요청을 사용해주세요.'});return;}
 if((req.rawBody?.length||0)>2*1024*1024){res.status(413).json({error:'사진 용량을 줄여주세요.'});return;}
 try{res.json(await handle(req));}catch(error){const status=error instanceof AppError?error.status:503;if(status===503)console.error('Notice request failed',{code:error.code||'server-error',action:String(req.body?.action||'').slice(0,30)});res.status(status).json({error:error instanceof AppError?error.message:'알림 서버 연결을 준비하고 있습니다. 잠시 후 다시 확인해주세요.'});}
}
export const cmTeamNotices=onRequest({...opts,cors:[APP_ORIGIN],invoker:'public',concurrency:20},noticeHttpHandler);

async function dispatchNotice(id,deadline=now()+90000){
 if(now()>deadline-15000)return;
 const jobRef=db.doc('outbox/'+id),noticeRef=db.doc('notices/'+id);
 const claim=await db.runTransaction(async tx=>{const [job,notice]=await Promise.all([tx.get(jobRef),tx.get(noticeRef)]);if(!job.exists||!shouldClaim(job.data(),now()))return null;if(!notice.exists||notice.data().state==='cancelled'||notice.data().version!==job.data().version){tx.delete(jobRef);return null;}const value=notice.data();tx.update(jobRef,{leaseUntil:now()+180000});if(value.state==='scheduled')tx.update(noticeRef,{state:'published',publishedAt:now(),delivery:{state:'sending',sent:0,failed:0}});return {job:job.data(),notice:{...value,state:'published'}};});
 if(!claim)return;
 try{
  const config=await runtimeRef.get();if(!config.exists)throw new Error('Push setup missing');
  const [subs,members,sessions]=await Promise.all([db.collection('subscriptions').get(),db.collection('members').get(),db.collection('sessions').get()]);
  const active=new Set(members.docs.filter(d=>d.data().active).map(d=>d.id));
  const activeSessions=new Set(sessions.docs.filter(d=>d.data().expiresAt>now()).map(d=>d.id));
  const targets=subs.docs.filter(s=>activeSessions.has(s.data().sessionId)&&active.has(s.data().memberId)&&(claim.notice.audience==='all'||claim.notice.audience.includes(s.data().memberId)));
  const results=await noticeRef.collection('deliveries').get();const known=new Map(results.docs.map(d=>[d.id,d.data().status]));let sent=0,failed=0,retry=false;
  const tooLate=now()-claim.notice.dueAt>86400000,startedAt=now();
  for(const sub of targets){
   if(known.get(sub.id)==='sent'){sent++;continue;}if(['expired','failed'].includes(known.get(sub.id))){failed++;continue;}
   if(tooLate){failed++;continue;}
   // Stop within the function deadline. Per-device receipts make the next attempt resume safely.
   if(now()-startedAt>65000||now()>deadline-15000){retry=true;failed++;continue;}
   try{await webpush.sendNotification(sub.data().subscription,JSON.stringify({id}),{TTL:86400,urgency:'high',timeout:12000,topic:hash(id).slice(0,32),vapidDetails:{subject:APP_ORIGIN,publicKey:config.data().publicKey,privateKey:config.data().privateKey}});await noticeRef.collection('deliveries').doc(sub.id).set({status:'sent',at:now()});sent++;}
   catch(error){const outcome=deliveryOutcome(Number(error.statusCode||0));if(outcome==='expired')await sub.ref.delete();if(outcome==='retry')retry=true;else await noticeRef.collection('deliveries').doc(sub.id).set({status:outcome,at:now()});failed++;}
  }
  const attempt=claim.job.attempt+1,wantsRetry=retry&&attempt<8;
  await db.runTransaction(async tx=>{const current=await tx.get(jobRef);if(!current.exists||current.data().version!==claim.job.version)return;tx.update(noticeRef,{delivery:{state:wantsRetry?'retrying':failed?'partial':targets.length?'sent':'no_devices',sent,failed,total:targets.length,updatedAt:now()}});if(wantsRetry)tx.set(jobRef,{...claim.job,attempt,dueAt:now()+retryDelay(attempt),leaseUntil:0});else tx.delete(jobRef);});
 }catch(error){const batch=db.batch();if(claim.job.attempt>=7){batch.delete(jobRef);batch.update(noticeRef,{delivery:{state:'partial',sent:0,failed:0,updatedAt:now()}});}else batch.update(jobRef,{leaseUntil:0,dueAt:now()+retryDelay(claim.job.attempt+1),attempt:claim.job.attempt+1});await batch.commit();throw error;}
}
export const cmTeamNoticeQueued=onDocumentWritten({...opts,database:'cm-notices',document:'outbox/{noticeId}',retry:false},async event=>{
 const after=event.data?.after;if(!after?.exists||!shouldClaim(after.data(),now()))return;
 try{await dispatchNotice(event.params.noticeId);}catch(error){console.error('Immediate delivery scheduled for retry',{code:error.code||'delivery-error'});}
});
export const cmTeamNoticeDispatch=onSchedule({...opts,maxInstances:1,schedule:'every 1 minutes',timeZone:'Asia/Seoul',retryCount:0},async()=>{
 const deadline=now()+90000;
 const due=await db.collection('outbox').where('dueAt','<=',now()).limit(20).get();
 for(const job of due.docs){if(now()>deadline-15000)break;try{await dispatchNotice(job.id,deadline);}catch(error){console.error('Notice delivery retry scheduled',{id:job.id,code:error.code||'delivery-error'});}}
 // Expired invite/rate-limit records are cleaned opportunistically without a second scheduled job.
 if(new Date().getUTCMinutes()===0){for(const name of ['limits','invites','sessions']){const old=await db.collection(name).where('expiresAt','<',now()).limit(200).get();if(!old.empty){const batch=db.batch();old.docs.forEach(d=>batch.delete(d.ref));await batch.commit();}}}
});
