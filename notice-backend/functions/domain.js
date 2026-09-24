import {createHash,randomBytes} from 'node:crypto';
export class AppError extends Error{constructor(status,message){super(message);this.status=status;}}
export const fail=(condition,message,status=400)=>{if(condition)throw new AppError(status,message);};
export const hash=value=>createHash('sha256').update(String(value)).digest('hex');
export const secret=()=>randomBytes(24).toString('base64url');
export const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(id);
export const validCode=code=>typeof code==='string'&&/^[a-zA-Z0-9_-]{16,40}$/.test(code);
export function validateNotice(input,now=Date.now()){
 const title=String(input.title||'').trim(),body=String(input.body||'').trim();
 fail(!title||title.length>80,'제목은 1~80자로 입력해주세요.');fail(!body||body.length>3000,'내용은 1~3,000자로 입력해주세요.');
 const category=['general','uniform','training','competition'].includes(input.category)?input.category:'general';
 const audience=input.audience==='all'?'all':Array.isArray(input.audience)?[...new Set(input.audience)]:[];
 fail(audience!=='all'&&(!audience.length||audience.length>50||audience.some(id=>!validId(id))),'받을 선수를 선택해주세요.');
 const schedule=input.sendAt?Date.parse(input.sendAt):now;
 fail(input.sendAt&&(!/^\d{4}-\d{2}-\d{2}T.*Z$/.test(input.sendAt)||!Number.isFinite(schedule)||schedule<now+30000),'예약은 현재보다 1분 이상 뒤로 설정해주세요.');
 fail(schedule>now+366*86400000,'예약은 1년 이내로 설정해주세요.');
 const images=input.images??[];fail(!Array.isArray(images)||images.length>3,'사진은 최대 3장까지 올릴 수 있습니다.');
 for(const data of images){fail(typeof data!=='string'||data.length>560000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(data),'사진 형식 또는 용량을 확인해주세요.');const bytes=Buffer.from(data.split(',')[1],'base64');fail(bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8||bytes[bytes.length-2]!==0xff||bytes[bytes.length-1]!==0xd9,'올바른 JPG 사진을 선택해주세요.');}
 return {title,body,category,audience,dueAt:schedule,images};
}
export function validateSubscription(value){
 let url;try{url=new URL(value?.endpoint);}catch{throw new AppError(400,'알림 주소를 확인해주세요.');}
 const host=url.hostname.toLowerCase(),allowed=host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host.endsWith('.push.apple.com')||host==='web.push.apple.com';
 fail(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||!allowed||url.href.length>2048,'지원하지 않는 알림 주소입니다.');
 const keys=value.keys||{};for(const [key,size] of [['p256dh',65],['auth',16]]){fail(typeof keys[key]!=='string'||!/^[A-Za-z0-9_-]+={0,2}$/.test(keys[key])||Buffer.from(keys[key],'base64url').length!==size,'알림 인증 정보를 확인해주세요.');}
 return {endpoint:url.href,keys:{p256dh:keys.p256dh,auth:keys.auth}};
}
export const canRead=(notice,memberId)=>notice.state==='published'&&(notice.audience==='all'||notice.audience.includes(memberId));
export function publicNotice(id,n,confirmed=false){return {id,title:n.title,body:n.body,category:n.category,publishedAt:new Date(n.publishedAt).toISOString(),imageIds:n.imageIds||[],confirmed,state:n.state};}
export const retryDelay=attempt=>Math.min(3600000,60000*2**Math.min(attempt,6));
export const deliveryOutcome=status=>[404,410].includes(status)?'expired':status>=400&&status<500&&status!==429?'failed':'retry';
export const shouldClaim=(job,now)=>job&&job.dueAt<=now&&(!job.leaseUntil||job.leaseUntil<=now);
