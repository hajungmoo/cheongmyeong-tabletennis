import {$,esc,isDemo,fmt,toast,api,icon,mountIcons,categoryLabels,demoNotices} from './shared.js';
import {notificationView} from './push-ui.js';
mountIcons();
let token='',member=null,notices=[],filter='all',publicKey='',registration=null,installPrompt=null,ready=false;
let connecting=false,pushBusy=false,pushChecking=false,pushConnected=false,pushError='';
try{token=localStorage.getItem('cm-notices-member')||'';}catch{}
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const ios=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const codeFromLink=new URLSearchParams(location.hash.slice(1)).get('invite');
if(codeFromLink){$('inviteCode').value=codeFromLink;history.replaceState(null,'',location.pathname+location.search);}
if('serviceWorker' in navigator&&!isDemo)navigator.serviceWorker.register('./sw.js',{scope:'./'}).then(reg=>registration=reg).catch(()=>{});
async function workerReady(){if(registration?.active)return registration;let timer;try{return await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('앱 설치를 마친 뒤 새로 열어주세요.')),15000);})]);}finally{clearTimeout(timer);}}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('nativeInstall').hidden=false;});
window.addEventListener('appinstalled',()=>{$('nativeInstall').hidden=true;updatePushPanel();toast('홈 화면에 청명 알림장을 설치했어요.');});
const openInstall=()=>{$('notificationDialog').close();if(!$('installDialog').open)$('installDialog').showModal();};
$('bottomInstall').addEventListener('click',openInstall);$('notificationInstall').addEventListener('click',openInstall);
function selectPhone(phone){
 document.querySelectorAll('[data-phone]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.phone===phone)));
 $('androidNotificationGuide').hidden=phone!=='android';$('iosNotificationGuide').hidden=phone!=='ios';
}
function openNotifications(){
 updatePushPanel();selectPhone(ios()?'ios':'android');
 const blocked='Notification' in window&&Notification.permission==='denied';
 $('androidBlockedHelp').open=blocked;$('iosBlockedHelp').open=blocked;
 if(!$('notificationDialog').open)$('notificationDialog').showModal();
}
for(const id of ['openNotifications','bottomNotifications','pushGuide'])$(id).addEventListener('click',openNotifications);
document.querySelectorAll('[data-phone]').forEach(button=>button.addEventListener('click',()=>selectPhone(button.dataset.phone)));
$('nativeInstall').addEventListener('click',async()=>{if(!installPrompt)return;await installPrompt.prompt();installPrompt=null;$('nativeInstall').hidden=true;});
document.querySelectorAll('.closeDialog').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();}));
function connection(message,state='waiting'){$('connectionText').textContent=message;$('connectionPanel').dataset.state=state;$('connectionPanel').hidden=false;}
function showMember(){
 $('joinPanel').hidden=true;$('memberArea').hidden=false;$('leaveDevice').hidden=isDemo;
 $('greeting').textContent=(member?.name||'청명 선수')+' 선수, 오늘도 함께 성장해요.';
 updatePushPanel();
}
function currentPushView(){
 if(isDemo)return notificationView({ready:true,member:true});
 return notificationView({ios:ios(),standalone:standalone(),supported:'Notification' in window&&'PushManager' in window&&'serviceWorker' in navigator,permission:'Notification' in window?Notification.permission:'default',ready,connecting,member:!!member,connected:pushConnected,busy:pushBusy,checking:pushChecking,error:pushError});
}
function updatePushPanel(){
 const view=currentPushView();
 $('pushPanel').dataset.state=view.key;$('pushState').textContent=view.label;
 $('pushTitle').textContent=view.title;$('pushDescription').textContent=view.description;
 $('pushActionLabel').textContent=view.button;$('enablePush').disabled=view.disabled;
 $('pushHint').textContent=view.key==='on'?'이 휴대폰에 알림 연결 완료':'처음 한 번만 설정하면 돼요';
 $('pushError').textContent=pushError;$('pushError').hidden=!pushError;
 $('bottomNotifications').dataset.state=view.key;$('openNotifications').dataset.state=view.key;
 $('dialogPushState').textContent=view.label;
 $('dialogPushDescription').textContent=isDemo?'미리보기예요. 실제 앱에서 알림을 허용해주세요.':view.description;
 $('dialogEnablePush').textContent=view.action==='guide'?(view.key==='install'?'홈 화면에 추가하는 방법':'안내 확인했어요'):view.button;
 $('dialogEnablePush').disabled=view.disabled;
}
function renderFeed(){
 const unread=notices.filter(n=>!n.confirmed).length;
 $('noticeCount').textContent=notices.length;$('unreadCount').textContent=unread;
 const items=notices.filter(n=>filter==='all'||(filter==='unread'?!n.confirmed:n.category===filter));
 $('noticeFeed').innerHTML=items.map(n=>`<article class="noticeCard ${n.confirmed?'':'unread'}"><div class="photoWrap" ${n.imageIds.length?'':'hidden'}><img class="noticePhoto" data-notice-image="${esc(n.id)}" alt="${esc(n.title)} 첨부 사진" loading="lazy">${isDemo?'<span class="exampleTag">단체복 예시 이미지</span>':''}</div><div class="noticeCardBody"><div class="cardMeta"><span class="category ${esc(n.category)}">${categoryLabels[n.category]||'공지'}</span>${n.confirmed?'':'<span class="newDot" aria-label="새 공지"></span>'}<time>${esc(fmt(n.publishedAt))}</time></div><h3>${esc(n.title)}</h3><p class="clamp">${esc(n.body)}</p><div class="cardActions"><button class="textButton" data-open="${esc(n.id)}">자세히 보기 →</button><button class="ackButton ${n.confirmed?'done':''}" data-ack="${esc(n.id)}" ${n.confirmed?'disabled':''}>${icon('check')}${n.confirmed?'확인했어요':'확인했어요 누르기'}</button></div></div></article>`).join('')||'<div class="empty"><strong>지금은 확인할 공지가 없어요</strong><p>새 공지가 올라오면 이곳에 표시돼요.</p></div>';
 $('noticeFeed').querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openNotice(b.dataset.open)));
 $('noticeFeed').querySelectorAll('[data-ack]').forEach(b=>b.addEventListener('click',()=>acknowledge(b.dataset.ack,b)));
 $('noticeFeed').querySelectorAll('[data-notice-image]').forEach(img=>loadPhoto(img,notices.find(n=>n.id===img.dataset.noticeImage),0));
 if('setAppBadge' in navigator&&!isDemo){const p=unread?navigator.setAppBadge(unread):navigator.clearAppBadge();p?.catch(()=>{});}
}
async function loadPhoto(img,notice,index){
 try{if(isDemo){img.src='./uniform-example.svg';return;}const data=await api('image',{noticeId:notice.id,imageId:notice.imageIds[index]},token);img.src=data.image;}
 catch{img.replaceWith(Object.assign(document.createElement('p'),{className:'photoError',textContent:'사진을 불러오지 못했어요. 새로고침해주세요.'}));}
}
async function openNotice(id){
 const n=notices.find(n=>n.id===id);if(!n)return;
 $('noticeDetail').innerHTML=`<div class="cardMeta"><span class="category ${esc(n.category)}">${categoryLabels[n.category]||'공지'}</span><time>${esc(fmt(n.publishedAt))}</time></div><h2>${esc(n.title)}</h2><p class="detailBody">${esc(n.body)}</p><div class="detailPhotos">${n.imageIds.map((_,i)=>`<img data-detail-image="${i}" alt="첨부 사진 ${i+1}">`).join('')}</div><button class="ackButton ${n.confirmed?'done':''}" id="detailAck" ${n.confirmed?'disabled':''}>${icon('check')}${n.confirmed?'확인했어요':'내용을 확인했어요'}</button>`;
 $('detailAck').addEventListener('click',()=>acknowledge(id,$('detailAck')));
 $('noticeDetail').querySelectorAll('[data-detail-image]').forEach(img=>loadPhoto(img,n,Number(img.dataset.detailImage)));
 $('noticeDialog').showModal();
}
async function acknowledge(id,button){
 button.disabled=true;
 try{if(!isDemo)await api('ack',{noticeId:id},token);const notice=notices.find(n=>n.id===id);if(notice)notice.confirmed=true;renderFeed();button.innerHTML=icon('check')+'확인했어요';button.classList.add('done');toast(isDemo?'확인 표시 미리보기예요. 코치님에게 전송되지 않아요.':'코치님에게 확인 표시를 보냈어요.');}
 catch(error){button.disabled=false;toast(error.message,true);}
}
async function refresh(){
 if(!member)return;
 $('refreshFeed').disabled=true;
 try{if(!isDemo){const data=await api('feed',{},token);notices=data.notices;}renderFeed();}
 catch(error){toast(error.message,true);if(error.status===401){try{localStorage.removeItem('cm-notices-member');}catch{}token='';member=null;$('joinPanel').hidden=false;$('memberArea').hidden=true;$('leaveDevice').hidden=true;connection('연결이 만료되었어요. 코치님에게 새 초대코드를 받아주세요.');pushConnected=false;updatePushPanel();}}
 finally{$('refreshFeed').disabled=false;}
}
async function connect(){
 if(connecting)return;connecting=true;pushError='';updatePushPanel();
 $('retryConnection').hidden=true;$('previewLink').hidden=true;
 if(isDemo){connecting=false;ready=true;$('demoBanner').hidden=false;document.querySelectorAll('a[href="./"]').forEach(a=>a.href='./?demo=1');member={name:'청명'};notices=structuredClone(demoNotices);$('connectionPanel').hidden=true;showMember();renderFeed();return;}
 try{const status=await api('status');ready=status.ready;publicKey=status.publicKey;
  if(!ready)throw new Error('알림 서버 연결을 준비하고 있어요. 준비되면 초대코드로 시작할 수 있어요.');
  $('joinButton').disabled=false;connection('청명 알림장이 준비되었어요.','ready');
  if(token){try{const result=await api('me',{},token);member=result.member;showMember();await refresh();$('connectionPanel').hidden=true;}catch(error){if(error.status===401){token='';member=null;pushConnected=false;$('joinPanel').hidden=false;$('memberArea').hidden=true;$('leaveDevice').hidden=true;try{localStorage.removeItem('cm-notices-member');}catch{}connection('새 초대코드로 다시 연결해주세요.');}else throw error;}}
  const selected=new URLSearchParams(location.search).get('notice');if(selected&&notices.some(n=>n.id===selected))openNotice(selected);
  if(member&&'Notification' in window&&Notification.permission==='granted')await syncExistingSubscription();
 }catch(error){ready=false;connection(error.message);$('retryConnection').hidden=false;$('previewLink').hidden=false;}
 finally{connecting=false;updatePushPanel();}
}
$('retryConnection').addEventListener('click',connect);
$('joinForm').addEventListener('submit',async event=>{event.preventDefault();if(!ready)return;const button=$('joinButton');button.disabled=true;try{const result=await api('join',{code:$('inviteCode').value.trim(),deviceLabel:ios()?'아이폰 / 아이패드':'휴대폰'});token=result.token;member=result.member;try{localStorage.setItem('cm-notices-member',token);}catch{}$('inviteCode').value='';$('connectionPanel').hidden=true;showMember();await refresh();await syncExistingSubscription();$('pushPanel').scrollIntoView({behavior:'smooth',block:'start'});toast('연결됐어요! 이제 큰 알림 켜기 버튼을 눌러주세요.');}catch(error){toast(error.message,true);}finally{button.disabled=false;}});
function decodeKey(s){const raw=atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'='));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
async function saveSubscription(subscription){
 await api('subscribe',{subscription:subscription.toJSON()},token);
 pushConnected=true;pushError='';updatePushPanel();
}
async function syncExistingSubscription(){
 if(isDemo||!member||pushBusy||pushChecking)return;
 if(!('Notification' in window)||Notification.permission!=='granted'||!('PushManager' in window)||!('serviceWorker' in navigator)){pushConnected=false;updatePushPanel();return;}
 pushChecking=true;updatePushPanel();
 try{const reg=await workerReady(),sub=await reg.pushManager.getSubscription();pushConnected=false;if(sub)await saveSubscription(sub);}
 catch{pushConnected=false;pushError='알림 연결을 확인하지 못했어요. 아래 버튼으로 다시 연결해주세요.';}
 finally{pushChecking=false;updatePushPanel();}
}
async function enableNotifications(){
 if(pushBusy)return;
 if(isDemo){openNotifications();return;}
 const view=currentPushView();
 if(view.action==='guide'){openNotifications();return;}
 if(view.action==='reconnect'){await connect();return;}
 if(view.action==='join'){$('joinPanel').scrollIntoView({behavior:'smooth',block:'start'});$('inviteCode').focus({preventScroll:true});return;}
 if(view.action!=='enable')return;
 try{
  // Keep the permission request directly inside the user's tap for iPhone support.
  const permissionPromise=Notification.permission==='granted'?Promise.resolve('granted'):Notification.requestPermission();
  pushBusy=true;pushError='';updatePushPanel();
  if(await permissionPromise!=='granted')throw new Error('알림을 허용하면 새 공지를 받을 수 있어요. 설정 방법을 확인해주세요.');
  const reg=await workerReady();const sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(publicKey)});
  await saveSubscription(sub);toast('알림 켜기 완료! 이제 코치님의 공지를 받아요.');
 }catch(error){pushConnected=false;pushError=error.message;toast(error.message,true);}
 finally{pushBusy=false;updatePushPanel();}
}
$('enablePush').addEventListener('click',enableNotifications);
$('dialogEnablePush').addEventListener('click',()=>{
 const view=currentPushView();
 $('notificationDialog').close();
 if(view.key==='install'){openInstall();return;}
 if(view.action==='guide'){$('pushPanel').scrollIntoView({behavior:'smooth',block:'start'});return;}
 if(isDemo){toast('실제 앱에서는 이 버튼을 누른 뒤 알림을 허용하면 돼요.');return;}
 enableNotifications();
});
function chooseFilter(value){filter=value;document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===value);b.setAttribute('aria-pressed',String(b.dataset.filter===value));});renderFeed();}
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>chooseFilter(b.dataset.filter)));
$('showUnread').addEventListener('click',()=>{if(!member){toast('초대코드로 먼저 연결해주세요.');return;}chooseFilter('unread');$('noticeFeed').scrollIntoView({behavior:'smooth',block:'start'});});
$('refreshFeed').addEventListener('click',refresh);
$('leaveDevice').addEventListener('click',async()=>{if(!confirm('이 휴대폰의 알림장 연결을 해제할까요? 다시 연결하려면 초대코드가 필요합니다.'))return;try{await api('leave',{},token);const reg=registration||await navigator.serviceWorker.getRegistration();await (await reg?.pushManager.getSubscription())?.unsubscribe();try{localStorage.removeItem('cm-notices-member');}catch{}location.reload();}catch(error){toast(error.message,true);}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){updatePushPanel();if(member&&!isDemo){refresh();syncExistingSubscription();}}});
window.addEventListener('online',()=>{if(!ready)connect();else if(member){refresh();syncExistingSubscription();}});
connect();
