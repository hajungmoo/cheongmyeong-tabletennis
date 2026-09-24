import {$,esc,isDemo,fmt,seoulInput,kstToISO,toast,api,icon,mountIcons,categoryLabels,demoNotices,prepareImage} from './shared.js';
import {FIREBASE_CONFIG,APP_URL} from './config.js';
mountIcons();
let auth=null,authApi=null,ready=false,busy=false,photoBusy=false,editingId='',photos=[],members=[],notices=[],inviteLink='',pendingSave=null;
const demoImages=new Map();
const setClock=()=>$('seoulClock').textContent=fmt(new Date(),{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});setClock();setInterval(setClock,60000);
$('sendAt').min=seoulInput(new Date(Date.now()+60000));$('sendAt').value=seoulInput(new Date(Date.now()+3600000));
const call=async(action,data={})=>{if(!auth?.currentUser)throw new Error('관리자 로그인이 필요합니다.');return api(action,data,await auth.currentUser.getIdToken(),true);};
const mode=()=>document.querySelector('input[name=sendMode]:checked').value;
const deliveryText=n=>({waiting:'발송 대기',sending:'알림 발송 중',retrying:'일부 기기 재시도 중',sent:'알림 서비스에 전달 완료',no_devices:'연결된 알림 기기가 없습니다',partial:'일부 기기에 전달하지 못했습니다'}[n.delivery?.state]||'알림 상태 확인 중');
function lock(value){busy=value;document.querySelectorAll('#composeForm input,#composeForm textarea,#composeForm select,#composeForm button,#outboxList button').forEach(el=>el.disabled=value);$('publishNotice').disabled=value||photoBusy||!ready;}
function updateSummary(){const later=mode()==='later';$('scheduleFields').hidden=!later;$('sendAt').required=later;$('audiencePicker').hidden=$('noticeAudience').value!=='selected';const recipient=$('noticeAudience').value==='all'?'전체 선수':'선택한 선수';$('sendSummary').innerHTML=icon(later?'clock':'bell')+`<span>${esc(recipient)}에게 ${later&&$('sendAt').value?esc(fmt(kstToISO($('sendAt').value)))+'에 ':''}공지와 알림을 보냅니다.</span>`;$('publishNotice').innerHTML=(editingId?'예약 수정하기':later?'예약 등록하기':'공지 올리기')+icon('arrow');}
document.querySelectorAll('[name=sendMode]').forEach(el=>el.addEventListener('change',updateSummary));$('sendAt').addEventListener('change',updateSummary);$('noticeAudience').addEventListener('change',updateSummary);
function renderPhotos(){
 $('photoList').innerHTML=photos.map((src,i)=>`<div class="photoThumb"><img src="${esc(src)}" alt="첨부 사진 ${i+1}"><button type="button" data-remove-photo="${i}" aria-label="사진 ${i+1} 삭제">×</button></div>`).join('');
 $('photoList').querySelectorAll('[data-remove-photo]').forEach(b=>b.addEventListener('click',()=>{if(busy)return;photos.splice(Number(b.dataset.removePhoto),1);pendingSave=null;renderPhotos();}));$('choosePhotos').hidden=photos.length>=3;
}
$('choosePhotos').addEventListener('click',()=>{if(!busy&&!photoBusy)$('photoInput').click();});
$('photoInput').addEventListener('change',async event=>{
 const files=Array.from(event.target.files||[]);event.target.value='';if(!files.length)return;
 if(photos.length+files.length>3){toast('사진은 최대 3장까지 선택해주세요.',true);return;}
 photoBusy=true;$('choosePhotos').disabled=true;$('publishNotice').disabled=true;$('photoStatus').textContent='사진을 준비하고 있습니다…';
 try{const prepared=[];for(const file of files)prepared.push(await prepareImage(file));photos.push(...prepared);pendingSave=null;renderPhotos();$('photoStatus').textContent=photos.length+'장 선택 완료 · 공지를 올릴 때 함께 저장됩니다.';}
 catch(error){$('photoStatus').textContent=error.message;toast(error.message,true);}finally{photoBusy=false;$('choosePhotos').disabled=false;$('publishNotice').disabled=!ready;}
});
function audienceValue(){return $('noticeAudience').value==='all'?'all':Array.from(document.querySelectorAll('#audienceList input:checked')).map(el=>el.value);}
function formData(){const title=$('noticeTitle').value.trim(),body=$('noticeBody').value.trim(),audience=audienceValue();if(!title||!body)throw new Error('공지 제목과 내용을 입력해주세요.');if(Array.isArray(audience)&&!audience.length)throw new Error('공지를 받을 선수를 선택해주세요.');let sendAt=null;if(mode()==='later'){sendAt=kstToISO($('sendAt').value);if(Date.parse(sendAt)<Date.now()+30000)throw new Error('예약은 현재보다 1분 이상 뒤로 설정해주세요.');}return {title,body,category:$('noticeCategory').value,audience,images:[...photos],sendAt};}
function preview(){try{const data=formData();$('previewContent').innerHTML=`<div class="cardMeta"><span class="category ${esc(data.category)}">${categoryLabels[data.category]}</span><time>${data.sendAt?esc(fmt(data.sendAt)):'지금 발행'}</time></div><h2>${esc(data.title)}</h2><p class="detailBody">${esc(data.body)}</p><div class="detailPhotos">${photos.map((src,i)=>`<img src="${esc(src)}" alt="첨부 사진 ${i+1}">`).join('')}</div><p class="hint">${data.audience==='all'?'전체 선수':data.audience.length+'명'}에게 표시되는 공지입니다.</p>`;$('previewDialog').showModal();}catch(error){toast(error.message,true);}}
$('previewNotice').addEventListener('click',preview);document.querySelectorAll('.closeDialog').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();}));
function resetForm(){editingId='';pendingSave=null;photos=[];$('composeForm').reset();$('sendAt').value=seoulInput(new Date(Date.now()+3600000));$('composeHeading').textContent='새 공지 작성';$('cancelEdit').hidden=true;$('photoStatus').textContent='사진은 자동으로 용량을 줄여 저장합니다.';renderPhotos();updateSummary();}
$('cancelEdit').addEventListener('click',()=>{if(!busy&&!photoBusy)resetForm();});
function renderDashboard(){
 $('memberCount').innerHTML=members.filter(m=>m.active).length+'<small>명</small>';$('scheduledCount').innerHTML=notices.filter(n=>n.state==='scheduled').length+'<small>건</small>';$('publishedCount').innerHTML=notices.filter(n=>n.state==='published').length+'<small>건</small>';
 $('audienceList').innerHTML=members.filter(m=>m.active).map(m=>`<label><input type="checkbox" value="${esc(m.id)}">${esc(m.name)}</label>`).join('')||'<p class="hint">선수를 먼저 초대해주세요.</p>';
 $('outboxList').innerHTML=notices.map(n=>`<article class="outboxItem"><span class="badge ${esc(n.state)}">${{scheduled:'예약됨',published:'발행됨',cancelled:'취소됨'}[n.state]||'확인 중'}</span><h3>${esc(n.title)}</h3><p>${icon('clock')} ${esc(fmt(n.dueAt||n.publishedAt))} · ${n.audience==='all'?'전체 선수':n.audience.length+'명'}</p>${n.state==='published'?`<p>${esc(deliveryText(n))}</p>`:''}<div class="itemActions">${n.state==='scheduled'?`<button class="textButton" data-edit="${esc(n.id)}">예약 수정</button><button class="textButton" data-cancel="${esc(n.id)}">예약 취소</button>`:n.state==='published'?`<button class="textButton" data-receipts="${esc(n.id)}">확인 현황 보기 →</button>`:''}</div></article>`).join('')||'<div class="empty"><strong>첫 공지를 준비해보세요</strong><p>예약하거나 발행한 공지가 여기 모입니다.</p></div>';
 $('outboxList').querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>editNotice(b.dataset.edit)));
 $('outboxList').querySelectorAll('[data-cancel]').forEach(b=>b.addEventListener('click',()=>cancelNotice(b.dataset.cancel)));
 $('outboxList').querySelectorAll('[data-receipts]').forEach(b=>b.addEventListener('click',()=>showReceipts(b.dataset.receipts)));
 $('memberList').innerHTML=members.filter(m=>m.active).map((m,i)=>`<div class="memberRow"><div class="memberIdentity"><span class="memberAvatar">${String(i+1).padStart(2,'0')}</span><strong>${esc(m.name)}</strong></div><span>${m.pushDevices?'알림 '+m.pushDevices+'대':m.connected?'기기 연결됨':'초대 대기'}</span><button class="textButton" data-revoke="${esc(m.id)}" aria-label="${esc(m.name)} 연결 해제">해제</button></div>`).join('');
 $('memberList').querySelectorAll('[data-revoke]').forEach(b=>b.addEventListener('click',()=>revokeMember(b.dataset.revoke)));
}
async function refresh(){const selected=audienceValue();try{if(!isDemo){const data=await call('dashboard');members=data.members;notices=data.notices;$('pushCount').innerHTML=data.pushCount+'<small>대</small>';}renderDashboard();if(Array.isArray(selected))document.querySelectorAll('#audienceList input').forEach(el=>el.checked=selected.includes(el.value));}catch(error){toast(error.message,true);}}
$('refreshCoach').addEventListener('click',refresh);
$('composeForm').addEventListener('input',()=>{pendingSave=null;});
$('composeForm').addEventListener('submit',async event=>{
 event.preventDefault();if(busy||photoBusy||!ready)return;let data;try{data=formData();}catch(error){toast(error.message,true);return;}
 const request=pendingSave||{...data,id:editingId||crypto.randomUUID(),operationId:crypto.randomUUID()};pendingSave=request;lock(true);$('saveStatus').textContent=isDemo?'미리보기 공지를 준비하고 있습니다…':'공지와 사진을 저장하고 있습니다…';
 let saved=false;
 try{
  let result;
  if(isDemo){const entry={...data,id:request.id,state:data.sendAt?'scheduled':'published',createdAt:Date.now(),dueAt:data.sendAt?Date.parse(data.sendAt):Date.now(),publishedAt:Date.now(),imageIds:photos.map((_,i)=>'demo-photo-'+i),delivery:{state:'no_devices'}};notices=notices.filter(n=>n.id!==entry.id);notices.unshift(entry);demoImages.set(entry.id,[...photos]);result={state:entry.state};}
  else result=await call('save',request);
  saved=true;const message=isDemo?'미리보기 저장 완료 · 실제 발송은 하지 않았습니다.':data.sendAt?'예약 등록 완료 · '+fmt(data.sendAt)+'부터 발송합니다.':result.state==='published'?'공지를 발행했습니다. 알림 전달 상태는 오른쪽에서 확인해주세요.':'공지 저장 완료 · 알림 발송을 준비하고 있습니다.';
  resetForm();$('saveStatus').textContent=message;toast(message);await refresh();
 }catch(error){$('saveStatus').textContent=saved?'저장은 완료했지만 목록을 새로 불러오지 못했습니다. 새로고침해주세요.':error.message+' 입력 내용은 유지됩니다.';toast($('saveStatus').textContent,true);}finally{lock(false);}
});
async function editNotice(id){if(busy||photoBusy)return;const n=notices.find(n=>n.id===id);if(!n||n.state!=='scheduled')return;lock(true);try{const loaded=isDemo?(demoImages.get(id)||[]):await Promise.all(n.imageIds.map(async imageId=>(await call('adminImage',{noticeId:id,imageId})).image));editingId=id;pendingSave=null;photos=loaded;$('noticeTitle').value=n.title;$('noticeBody').value=n.body;$('noticeCategory').value=n.category;$('noticeAudience').value=n.audience==='all'?'all':'selected';document.querySelectorAll('#audienceList input').forEach(el=>el.checked=Array.isArray(n.audience)&&n.audience.includes(el.value));document.querySelector('[name=sendMode][value=later]').checked=true;$('sendAt').value=seoulInput(new Date(n.dueAt));$('composeHeading').textContent='예약 공지 수정';$('cancelEdit').hidden=false;renderPhotos();updateSummary();$('noticeTitle').focus();}catch(error){toast(error.message,true);}finally{lock(false);}}
async function cancelNotice(id){if(busy||!confirm('이 공지의 예약 발송을 취소할까요?'))return;try{if(isDemo)notices.find(n=>n.id===id).state='cancelled';else await call('cancel',{id});if(editingId===id)resetForm();await refresh();toast(isDemo?'예약 취소 미리보기입니다.':'예약을 취소했습니다.');}catch(error){toast(error.message,true);}}
async function showReceipts(id){try{const list=isDemo?members.filter(m=>m.active).map((m,i)=>({...m,confirmedAt:i<3?Date.now():null})):(await call('receipts',{id})).members;$('receiptContent').innerHTML=`<div class="receiptSummary">${list.filter(m=>m.confirmedAt).length} / ${list.length}명이 ‘확인했어요’를 눌렀습니다.</div>${list.map(m=>`<div class="memberRow"><strong>${esc(m.name)}</strong><span>${m.confirmedAt?'확인 · '+esc(fmt(m.confirmedAt)):'아직 확인하지 않음'}</span></div>`).join('')}<p class="hint">알림 전달 여부와 공지 확인 표시는 다릅니다. 아이가 확인 버튼을 눌러야 표시됩니다.</p>`;$('receiptDialog').showModal();}catch(error){toast(error.message,true);}}
$('inviteForm').addEventListener('submit',async event=>{event.preventDefault();const name=$('memberName').value.trim();if(!name||!ready)return;$('createInvite').disabled=true;try{let result;if(isDemo){result={code:'DEMO-PREVIEW-CODE',member:{name,id:crypto.randomUUID()}};members.push({...result.member,active:true,connected:false,pushDevices:0});}else result=await call('invite',{name});inviteLink=APP_URL+'#invite='+encodeURIComponent(result.code);$('inviteLabel').textContent=name+' 선수 초대코드';$('inviteCodeOutput').textContent=result.code;$('inviteResult').hidden=false;$('memberName').value='';await refresh();toast(isDemo?'초대코드 예시입니다. 실제 연결은 되지 않습니다.':'초대코드를 만들었습니다.');}catch(error){toast(error.message,true);}finally{$('createInvite').disabled=false;}});
$('copyInvite').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(inviteLink);toast(isDemo?'예시 링크를 복사했습니다. 실제 초대코드는 아닙니다.':'초대 링크를 복사했습니다.');}catch{toast('코드를 길게 눌러 복사해주세요.');}});
async function revokeMember(id){const m=members.find(m=>m.id===id);if(!confirm(m.name+' 선수의 모든 기기 연결을 해제할까요?'))return;try{if(isDemo)m.active=false;else await call('revoke',{id});await refresh();toast('연결을 해제했습니다.');}catch(error){toast(error.message,true);}}
async function connectBackend(){
 $('backendStatus').hidden=false;$('backendText').textContent='공지 서버에 연결하고 있습니다.';$('retryBackend').disabled=true;
 try{await call('bootstrap');ready=true;$('backendStatus').hidden=true;$('coachWorkspace').hidden=false;$('loginPanel').hidden=true;await refresh();}
 catch(error){ready=false;$('backendText').textContent=error.message+' 화면 체험은 로그인 화면의 미리보기에서 가능합니다.';$('coachWorkspace').hidden=true;}
 finally{$('retryBackend').disabled=false;}
}
$('retryBackend').addEventListener('click',connectBackend);
$('loginForm').addEventListener('submit',async event=>{event.preventDefault();if(!authApi)return;$('loginButton').disabled=true;$('loginStatus').textContent='로그인 중…';try{await authApi.signInWithEmailAndPassword(auth,$('coachEmail').value.trim(),$('coachPassword').value);$('coachPassword').value='';$('loginStatus').textContent='';}catch{$('loginStatus').textContent='로그인하지 못했습니다. 관리자 이메일과 비밀번호를 확인해주세요.';}finally{$('loginButton').disabled=false;}});
$('logout').addEventListener('click',async()=>{if(busy)return;if(($('noticeTitle').value||$('noticeBody').value||photos.length)&&!confirm('작성 중인 공지를 닫고 로그아웃할까요?'))return;await authApi.signOut(auth);});
window.addEventListener('beforeunload',event=>{if(!isDemo&&($('noticeTitle').value||$('noticeBody').value||photos.length)){event.preventDefault();event.returnValue='';}});
async function start(){
 if(isDemo){$('demoBanner').hidden=false;$('loginPanel').hidden=true;$('coachWorkspace').hidden=false;$('studentPreviewLink').href='./?demo=1';document.querySelector('.brand').href='./?demo=1';ready=true;members=Array.from({length:8},(_,i)=>({id:'demo-member-'+i,name:'선수 '+(i+1),active:true,connected:true,pushDevices:i<6?1:0}));notices=[{id:'demo-scheduled',title:'내일 훈련 준비물 안내',body:'개인 라켓과 물병, 실내 운동화를 챙겨주세요.',category:'training',dueAt:Date.now()+86400000,state:'scheduled',imageIds:[],audience:'all'},...structuredClone(demoNotices).map(n=>({...n,dueAt:Date.parse(n.publishedAt),delivery:{state:'sent'}}))];$('pushCount').innerHTML='6<small>대</small>';renderDashboard();updateSummary();return;}
 try{const [appModule,authModule]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js')]);authApi=authModule;auth=authApi.getAuth(appModule.initializeApp(FIREBASE_CONFIG));authApi.onAuthStateChanged(auth,user=>{$('logout').hidden=!user;if(user)connectBackend();else{ready=false;resetForm();members=[];notices=[];$('coachWorkspace').hidden=true;$('backendStatus').hidden=true;$('loginPanel').hidden=false;}});}catch{$('loginStatus').textContent='로그인 연결을 불러오지 못했습니다. 새로고침해주세요.';}
}
start();
