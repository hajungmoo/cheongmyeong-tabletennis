// Public, result-only data. Compression limits transfer size; it is not access control.
const encoder=new TextEncoder(),decoder=new TextDecoder();
export const normalizeName=value=>String(value??'').normalize('NFC').replace(/\s+/g,'').toLocaleLowerCase('ko-KR');
function base64(bytes){let text='';for(let i=0;i<bytes.length;i+=0x8000)text+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(text);}
export async function sourceFingerprint(encoding,payload){
  const digest=await crypto.subtle.digest('SHA-256',encoder.encode(encoding+'|'+payload));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function packReports(reports){
  const text=JSON.stringify({version:2,reports}),bytes=encoder.encode(text);
  if(bytes.length>8000000)throw new Error('REPORT_TOO_LARGE');
  if(typeof CompressionStream!=='function')return {encoding:'json',payload:text};
  const packed=await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  return {encoding:'gzip-base64',payload:base64(new Uint8Array(packed))};
}
export async function unpackReports(data){
  if(data?.version!==2||typeof data.payload!=='string'||data.payload.length>1000000)throw new Error('INVALID_REPORT');
  let text=data.payload;
  if(data.encoding==='gzip-base64'){
    if(typeof DecompressionStream!=='function')throw new Error('BROWSER_UPDATE');
    const bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0));
    const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),parts=[];let size=0;
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8000000){await reader.cancel();throw new Error('INVALID_REPORT');}parts.push(value);}
    const result=new Uint8Array(size);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}text=decoder.decode(result);
  }else if(data.encoding!=='json')throw new Error('INVALID_REPORT');
  const parsed=JSON.parse(text);
  if(parsed?.version!==2||!Array.isArray(parsed.reports)||!parsed.reports.every(r=>r?.version===1&&typeof r.player?.id==='string'&&typeof r.player?.name==='string'&&Array.isArray(r.matches)))throw new Error('INVALID_REPORT');
  return parsed.reports;
}
