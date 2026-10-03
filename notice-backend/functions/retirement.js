import {BACKEND_VERSION,CAPABILITIES} from './release.js';
export function noticeHttpHandler(_req,res){
  res.set('Cache-Control','no-store');
  res.set('X-Content-Type-Options','nosniff');
  res.status(410).json({ready:false,retired:true,version:BACKEND_VERSION,capabilities:CAPABILITIES,error:'청명 알림장 서비스가 종료되었습니다.'});
}
export function ignoreRetiredNotice(){ /* Retired: do not read, publish, or send. */ }
