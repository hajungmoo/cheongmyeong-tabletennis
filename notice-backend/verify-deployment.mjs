import fs from 'node:fs';
const response=JSON.parse(fs.readFileSync(0,'utf8'));
if(response.retired!==true||response.ready!==false||response.version!=='2.0.0-retired'){
  console.error('서버 종료가 확인되지 않았습니다. 운영 중인 서버가 남아 있을 수 있습니다.');
  process.exit(1);
}
console.log('알림장 API 종료 확인');
