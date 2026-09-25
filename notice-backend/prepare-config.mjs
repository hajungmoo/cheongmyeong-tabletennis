import {readFile,writeFile,appendFile} from 'node:fs/promises';

// This is the existing administrator's public UID, not a credential or API key.
const defaultAdmin='RwknxZw7wRgtG8Ca5WJu6yXlHNE3';
const envFile=new URL('./functions/.env.cheongmyeong-tabletennis',import.meta.url);
let previous='';
let exists=true;
try{previous=await readFile(envFile,'utf8');}
catch(error){if(error.code!=='ENOENT')throw error;exists=false;}

const configured=previous.match(/^[ \t]*(?:export[ \t]+)?NOTICES_ADMIN_UID[ \t]*=([^\r\n]*)/m);
if(configured){
  const value=configured[1].trim().replace(/^(['"])(.*)\1$/,'$2').trim();
  if(!value||value.startsWith('#'))throw new Error('저장된 NOTICES_ADMIN_UID가 비어 있습니다. functions/.env.cheongmyeong-tabletennis의 관리자 UID를 확인해주세요.');
  console.log('저장된 관리자 UID 설정을 유지합니다.');
}else{
  const line=(previous&&!previous.endsWith('\n')?'\n':'')+'NOTICES_ADMIN_UID='+defaultAdmin+'\n';
  if(exists)await appendFile(envFile,line,'utf8');
  else await writeFile(envFile,line,{encoding:'utf8',flag:'wx',mode:0o600});
  console.log('관리자 UID를 프로젝트 설정에 저장했습니다. 배포 도중 다시 입력하지 않아도 됩니다.');
}
