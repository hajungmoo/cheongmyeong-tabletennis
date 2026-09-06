from pathlib import Path
import re

INDEX = Path('manager/index.html')
JS = Path('manager/manager-v4.js')

text = INDEX.read_text(encoding='utf-8')
pattern = re.compile(r"async function pull\(\{force=false\}=\{\}\)\{.*?\}\nasync function login", re.S)
replacement = r'''async function pull({force=false}={}){
 if(!auth.currentUser)return;
 try{
  status('☁ CLOUD · 불러오는 중','saving');
  const s=await getDoc(ref);
  if(!s.exists()){
   status('☁ CLOUD · 원본 없음','offline');
   msg('클라우드 원본이 없습니다. 안전을 위해 이 기기의 로컬 데이터를 자동 업로드하지 않았습니다.');
   return
  }
  const d=s.data(),remoteRev=Number(d.revision||0),localRev=Number(localStorage.getItem('cm_manager_cloud_local_revision')||0);
  lastRemoteRev=remoteRev;
  const remoteDb=await decodePayload(d.encoding,d.payload);
  if(localRev>remoteRev){
   try{
    const local=window.db||window.__cmDb;
    if(local)localStorage.setItem('cm_manager_local_safety_backup',JSON.stringify({savedAt:new Date().toISOString(),revision:localRev,data:local}))
   }catch(_){ }
  }
  isApplyingRemote=true;
  window.dispatchEvent(new CustomEvent('cm-cloud-data',{detail:{db:remoteDb,revision:remoteRev}}));
  setTimeout(()=>isApplyingRemote=false,0);
  status(`☁ CLOUD · ${(remoteDb.matches||[]).length}경기 동기화`,'online');
  updatePanel()
 }catch(e){console.error(e);status('☁ CLOUD · 연결 오류','offline');msg('클라우드 불러오기 실패: '+(e.code||e.message))}
}
async function login'''
new_text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f'pull patch failed: {count}')
INDEX.write_text(new_text, encoding='utf-8')

j = JS.read_text(encoding='utf-8')
marker = '/* CM SAFE SYNC 1.0 */'
if marker not in j:
    j += r'''

/* CM SAFE SYNC 1.0 */
(function(root){
 'use strict';
 const REV='cm_manager_cloud_local_revision';
 const mutators=['saveScore','undoLastMatch','deleteMatch','delMatch','saveMatchEdit','newLeague','updateLeagueMeta','updateLeagueFormat','pro3ChooseLeagueFormat','addLeagueSlot','removeLeagueSlot','removeSlotAt','setLeaguePlayer','generateLeague','setLeagueResult','toggleLeagueForfeit','cloneLeague','deleteLeague','registerManualPlayer','savePlayerEdit','importRankingExcel','saveCompetitionPaste','saveCompetitionEdit','deleteCompetition','importBackup','restoreBackup','restoreData','resetData','wipeData'];
 const authed=()=>Boolean(root.CMCloud?.user);
 let timer=0;
 function ensureUi(){
  if(!document.getElementById('cmSafeSyncStyle')){
   const s=document.createElement('style');s.id='cmSafeSyncStyle';s.textContent='.cmSafeSyncChip{display:inline-flex;align-items:center;gap:7px;padding:8px 10px;border:1px solid #3c424a;border-radius:999px;background:#101419;color:#a9b0b8;font-size:9px;font-weight:900;letter-spacing:.08em;white-space:nowrap}.cmSafeSyncChip i{width:7px;height:7px;border-radius:50%;background:#d19a4d}.cmSafeSyncChip.online{border-color:#405847;color:#c7dccb;background:#101713}.cmSafeSyncChip.online i{background:#67c785}.cmSafeSyncChip.offline{border-color:#5b4634;color:#e1bd93;background:#18130f}.cmSafeSyncNotice{position:fixed;right:18px;bottom:18px;z-index:9999;max-width:390px;padding:13px 15px;border:1px solid #655036;border-radius:12px;background:#17130f;color:#ead7bd;box-shadow:0 18px 50px rgba(0,0,0,.35);font-size:11px;line-height:1.55}.cmSafeSyncNotice b{display:block;color:#fff4df;margin-bottom:3px}';document.head.appendChild(s)
  }
  if(!document.getElementById('cmSafeSyncChip')){const c=document.createElement('div');c.id='cmSafeSyncChip';c.className='cmSafeSyncChip offline';c.innerHTML='<i></i><span>READ ONLY · LOGIN</span>';const t=document.querySelector('.topTools');if(t)t.insertBefore(c,t.firstChild)}
 }
 function ui(){ensureUi();const c=document.getElementById('cmSafeSyncChip');if(!c)return;c.className='cmSafeSyncChip '+(authed()?'online':'offline');c.querySelector('span').textContent=authed()?'CLOUD AUTO SAVE':'READ ONLY · LOGIN'}
 function blocked(){ensureUi();ui();document.getElementById('cloudOverlay')?.classList.add('show');const m=document.getElementById('cloudMsg');if(m)m.textContent='안전 모드: 로그인하지 않은 상태에서는 경기·리그·선수·대회 데이터를 수정하거나 삭제할 수 없습니다.';let n=document.getElementById('cmSafeSyncNotice');if(!n){n=document.createElement('div');n.id='cmSafeSyncNotice';n.className='cmSafeSyncNotice';document.body.appendChild(n)}n.innerHTML='<b>클라우드 안전 모드</b>로그인 후 입력하면 Firebase에 자동 저장되고 다른 컴퓨터와 휴대폰에도 같은 데이터가 반영됩니다.';clearTimeout(timer);timer=setTimeout(()=>n?.remove(),5000)}
 function guard(name){const fn=root[name];if(typeof fn!=='function'||fn.__cmSafeGuard)return;function g(...args){if(!authed()){blocked();return false}return fn.apply(this,args)}g.__cmSafeGuard=true;root[name]=g}
 function guards(){mutators.forEach(guard);const fn=root.save;if(typeof fn==='function'&&!fn.__cmSafeGuard){function gs(...args){if(!authed()){blocked();setTimeout(()=>location.reload(),0);return false}return fn.apply(this,args)}gs.__cmSafeGuard=true;root.save=gs}}
 function cloud(){const c=root.CMCloud;if(!c||c.__cmSafeWrapped)return;const login=c.login;c.login=async function(...args){try{const local=root.__cmDb;if(local)localStorage.setItem('cm_manager_prelogin_safety_backup',JSON.stringify({savedAt:new Date().toISOString(),data:local}))}catch(_){}localStorage.setItem(REV,'0');return login.apply(this,args)};c.__cmSafeWrapped=true}
 document.addEventListener('click',e=>{if(authed())return;const x=e.target.closest('[data-ops-action="undo"]');if(!x)return;e.preventDefault();e.stopImmediatePropagation();blocked()},true);
 document.addEventListener('change',e=>{if(authed())return;const x=e.target.closest('[data-ops-score]');if(!x)return;e.preventDefault();e.stopImmediatePropagation();blocked();if(typeof root.renderSchedule==='function')root.renderSchedule()},true);
 root.CMSafeSync={canWrite:authed,blocked};guards();cloud();ui();root.addEventListener('cm-cloud-ready',()=>{cloud();guards();ui()});root.addEventListener('cm-cloud-auth',()=>{guards();ui()});root.addEventListener('cm-cloud-data',ui)
})(typeof window==='undefined'?globalThis:window);
'''
    JS.write_text(j, encoding='utf-8')
print('safe sync patch applied')
