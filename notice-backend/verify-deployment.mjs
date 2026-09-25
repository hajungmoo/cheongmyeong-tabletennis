import {readFileSync} from 'node:fs';
import {BACKEND_VERSION} from './functions/release.js';
const response=JSON.parse(readFileSync(0,'utf8'));
if(typeof response.ready!=='boolean'||response.version!==BACKEND_VERSION||response.capabilities?.deleteNotice!==true){
 throw new Error('공지 삭제 기능의 서버 배포가 확인되지 않았습니다. 배포 로그를 확인해주세요.');
}
console.log(`서버 ${BACKEND_VERSION} 확인 · 공지 삭제 기능 배포 완료`);
console.log(response.ready?'기존 관리자 설정·알림 연결 유지':'관리자 첫 로그인이 필요합니다.');
