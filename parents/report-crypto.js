// Only a child's high-entropy access link can open that child's result copy.
// Access keys are stored in the authenticated manager area, never in public reports.
const encoder=new TextEncoder(),decoder=new TextDecoder();
export const normalizeName=value=>String(value??'').normalize('NFC').replace(/\s+/g,'').toLocaleLowerCase('ko-KR');
export function toBase64(bytes){let text='';for(let i=0;i<bytes.length;i+=0x8000)text+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(text).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export function fromBase64(text){if(typeof text!=='string'||!/^[A-Za-z0-9_-]+$/.test(text))throw new Error('잘못된 조회코드입니다.');const raw=atob(text.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
export const validKey=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value)&&fromBase64(value).length===32;
export function createAccessKey(){return toBase64(crypto.getRandomValues(new Uint8Array(32)));}
export function accessKeyFrom(value){
  const text=String(value??'').trim();if(validKey(text))return text;
  try{const url=new URL(text,location.origin);const key=new URLSearchParams(url.hash.slice(1)).get('key');return validKey(key)?key:'';}catch{return '';}
}
async function keysFor(secret,name){
  if(!validKey(secret)||!normalizeName(name))throw new Error('이름과 조회 링크를 확인해 주세요.');
  const material=await crypto.subtle.importKey('raw',fromBase64(secret),'HKDF',false,['deriveKey','deriveBits']);
  const params={name:'HKDF',hash:'SHA-256',salt:encoder.encode('cm-parent-v1|'+normalizeName(name))};
  const key=await crypto.subtle.deriveKey({...params,info:encoder.encode('report-encryption')},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const bits=await crypto.subtle.deriveBits({...params,info:encoder.encode('report-lookup')},material,256);
  return {key,lookup:toBase64(new Uint8Array(bits))};
}
export async function lookupId(secret,name){return (await keysFor(secret,name)).lookup;}
export async function sealReport(report,secret){
  const {key,lookup}=await keysFor(secret,report.player.name);
  let bytes=encoder.encode(JSON.stringify(report)),encoding='json';
  if(typeof CompressionStream==='function'){
    bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());encoding='gzip';
  }
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const aad=encoder.encode('cm-parent-v1|'+lookup+'|'+encoding);
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,bytes);
  return {lookup,envelope:{v:1,encoding,iv:toBase64(iv),data:toBase64(new Uint8Array(encrypted))}};
}
export async function openReport(envelope,secret,name){
  if(envelope?.v!==1||!['json','gzip'].includes(envelope.encoding)||typeof envelope.data!=='string'||envelope.data.length>2000000)throw new Error('조회 자료를 확인할 수 없습니다.');
  const {key,lookup}=await keysFor(secret,name),iv=fromBase64(envelope.iv);
  if(iv.length!==12)throw new Error('조회 자료를 확인할 수 없습니다.');
  const aad=encoder.encode('cm-parent-v1|'+lookup+'|'+envelope.encoding);
  let bytes=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad},key,fromBase64(envelope.data)));
  if(envelope.encoding==='gzip'){
    if(typeof DecompressionStream!=='function')throw new Error('최신 크롬 또는 사파리에서 조회 링크를 열어 주세요.');
    const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),parts=[];let size=0;
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8000000){await reader.cancel();throw new Error('조회 자료가 너무 큽니다.');}parts.push(value);}
    bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  }
  const result=JSON.parse(decoder.decode(bytes));
  if(result?.version!==1||normalizeName(result.player?.name)!==normalizeName(name)||!Array.isArray(result.matches))throw new Error('이름과 조회 링크를 확인해 주세요.');
  return result;
}
