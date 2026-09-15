// Uses the existing Firebase app/auth; never changes bucket rules or database records.
// Only a signed-in administrator's explicit file selection starts an upload.
export function photoUploadError(error) {
  const code=error?.code||'';
  if(code==='storage/unauthorized'||code==='storage/unauthenticated')return '사진 저장 권한을 확인할 수 없습니다. 관리자 로그인과 Firebase Storage 권한을 확인해주세요. 기존 내용은 변경되지 않았습니다.';
  if(code==='storage/bucket-not-found'||code==='storage/project-not-found')return '현재 프로젝트에 사진 저장소가 준비되지 않았습니다. Firebase Storage 설정이 필요합니다. 기존 이미지 주소 입력은 계속 사용할 수 있습니다.';
  if(code==='storage/quota-exceeded')return '사진 저장소의 사용 한도를 초과했습니다. 저장소 상태를 확인해주세요.';
  if(code==='storage/retry-limit-exceeded')return '사진 업로드 연결이 지연됩니다. 인터넷 연결과 사진 저장소 설정을 확인해주세요.';
  return error?.message||'사진을 올리지 못했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 시도해주세요.';
}

export async function preparePhoto(file) {
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('JPG, PNG, WebP 사진을 선택해주세요. HEIC 사진은 JPG로 변환 후 올려주세요.');
  if(file.size>15*1024*1024)throw new Error('사진 한 장은 15MB 이하로 선택해주세요.');
  const url=URL.createObjectURL(file), image=new Image();
  try{
    image.src=url;await image.decode();
    if(!image.naturalWidth||!image.naturalHeight)throw new Error('읽을 수 없는 사진입니다. 다른 사진을 선택해주세요.');
    const scale=Math.min(1,1800/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    // Re-encoding strips EXIF/GPS metadata before the photo becomes public.
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.84));
    if(!blob)throw new Error('사진을 변환하지 못했습니다. 다른 사진을 선택해주세요.');
    return blob;
  }finally{URL.revokeObjectURL(url);}
}

export function createPhotoUploader(app,auth) {
  let apiPromise;
  return async function uploadPhoto(file,onProgress=()=>{}) {
    if(!auth.currentUser)throw new Error('관리자 로그인 후 사진을 올릴 수 있습니다.');
    const blob=await preparePhoto(file);
    apiPromise??=import('https://www.gstatic.com/firebasejs/12.13.0/firebase-storage.js');
    const api=await apiPromise,storage=api.getStorage(app);
    api.setMaxUploadRetryTime(storage,20000);api.setMaxOperationRetryTime(storage,15000);
    if(!auth.currentUser)throw new Error('로그인이 만료되었습니다. 다시 로그인해주세요.');
    const path='homepage/activities/'+crypto.randomUUID()+'.jpg';
    const task=api.uploadBytesResumable(api.ref(storage,path),blob,{contentType:'image/jpeg',cacheControl:'public,max-age=31536000,immutable'});
    await new Promise((resolve,reject)=>task.on('state_changed',snap=>onProgress(Math.round(snap.bytesTransferred/snap.totalBytes*100)),reject,resolve));
    return api.getDownloadURL(task.snapshot.ref);
  };
}
