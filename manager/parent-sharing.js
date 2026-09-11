import {shareablePlayers,projectPlayer} from './parent-projection.js?v=1.1.0';
import {packReports,sourceFingerprint} from '../parents/report-data.js?v=2.0.0';

// Public result copies are independent of the authenticated manager source.
// The v2 destination is separate so an older open manager tab cannot overwrite it.
export function initParentSharing({auth,fs,sourceRef,doc,getDocFromServer,runTransaction,serverTimestamp,decodePayload}){
  const accessRef=doc(fs,'managerPro','parentPortal'),reportRef=doc(fs,'settings','parentLive');
  const $=id=>document.getElementById(id),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let state=null,source=null,published=null,busy=false,publishing=null,timer=null,lastFocus=null,settingsHash='';
  const signedIn=()=>!!auth.currentUser;
  const settingsOf=raw=>({
    enabled:typeof raw?.live?.enabled==='boolean'?raw.live.enabled:raw?.enabled!==false,
    hiddenPlayerIds:[...new Set(Array.isArray(raw?.live?.hiddenPlayerIds)?raw.live.hiddenPlayerIds.filter(id=>typeof id==='string'):Object.entries(raw?.accounts||{}).filter(([,value])=>value?.enabled===false).map(([id])=>id))].sort(),
    generation:String(raw?.live?.generation||raw?.generation||'public-live-v2-default')
  });
  const readSettings=snap=>settingsOf(snap.exists()?snap.data():{});
  const hashSettings=settings=>sourceFingerprint('public-live-settings-v2',JSON.stringify(settings));
  const message=(text,error=false)=>{$('cmParentStatus').textContent=text;$('cmParentStatus').classList.toggle('error',error);};
  const failure=error=>error?.code==='permission-denied'?'학부모 화면 반영 권한을 확인할 수 없습니다. 코치 계정으로 다시 로그인해 주세요.':error?.message==='REPORT_TOO_LARGE'?'공유할 경기 기록이 너무 많아 반영하지 못했습니다. 기존 경기 기록은 그대로 보관되어 있습니다.':'학부모 화면 반영에 실패했습니다. 인터넷 연결을 확인하고 ‘다시 반영’을 눌러 주세요.';
  const commonUrl=new URL('../parents/',location.href).href;
  document.body.insertAdjacentHTML('beforeend',`<dialog id="cmParentDialog" class="cmParentDialog" aria-labelledby="cmParentTitle"><div class="cmParentHead"><h2 id="cmParentTitle">학부모 실시간 조회</h2><button type="button" data-parent-action="close">닫기</button></div><p>학부모님께 공통 주소 하나만 전달하세요.<br>이름을 검색하면 저장한 경기 결과가 실시간으로 표시됩니다.</p><div class="cmParentTools"><button type="button" data-parent-action="copy">공통 주소 복사</button><button id="cmParentRetry" type="button" data-parent-action="retry">다시 반영</button><button id="cmParentPause" type="button" data-parent-action="pause">전체 조회 중지</button><a class="cmParentLink" href="../parents/" target="_blank" rel="noopener noreferrer">학부모 화면</a></div><div id="cmParentStatus" class="cmParentStatus" role="status" aria-live="polite"></div><div id="cmParentPlayers"></div><div id="cmParentManual" class="cmParentManual" hidden><label for="cmParentCopyText">학부모님께 전달할 공통 주소</label><textarea id="cmParentCopyText" readonly></textarea></div><p class="cmParentNote">현재 소속 선수의 일반 경기·리그전·확인된 대회 결과가 자동으로 연결됩니다. 이 주소에서는 공개된 선수의 경기 결과를 이름으로 검색할 수 있습니다. 경기 메모와 선수 관리 정보는 공유되지 않습니다.</p></dialog>`);
  const button=document.createElement('button');button.type='button';button.className='cmParentButton';button.textContent='학부모 조회';button.dataset.parentAction='open';
  (document.querySelector('.topTools')||document.body).append(button);
  async function loadState(){
    if(!signedIn())throw new Error('LOGIN_REQUIRED');
    const uid=auth.currentUser.uid;
    const [accessSnap,sourceSnap,publicSnap]=await Promise.all([getDocFromServer(accessRef),getDocFromServer(sourceRef),getDocFromServer(reportRef)]);
    if(!signedIn()||auth.currentUser.uid!==uid)throw new Error('LOGIN_REQUIRED');
    if(!sourceSnap.exists())throw new Error('SOURCE_MISSING');
    const raw=sourceSnap.data(),decoded=await decodePayload(raw.encoding,raw.payload),settings=readSettings(accessSnap),hash=await hashSettings(settings);
    if(!signedIn()||auth.currentUser.uid!==uid)throw new Error('LOGIN_REQUIRED');
    source=decoded;state=settings;settingsHash=hash;published=publicSnap.exists()?publicSnap.data():null;
  }
  function render(){
    $('cmParentPause').disabled=busy||!state||!signedIn();
    $('cmParentPause').textContent=state?.enabled===false?'전체 조회 재개':'전체 조회 중지';
    $('cmParentPause').dataset.parentAction=state?.enabled===false?'resume':'pause';
    $('cmParentRetry').disabled=busy||!signedIn();
    const players=source?shareablePlayers(source):[],ready=published?.version===2&&published.settingsFingerprint===settingsHash;
    $('cmParentPlayers').innerHTML=players.map(p=>{
      const hidden=state?.hiddenPlayerIds.includes(p.id),badge=hidden?'비공개':state?.enabled===false?'전체 조회 중지됨':ready?'공개 중':'반영 대기';
      return `<div class="cmParentRow"><div><strong>${esc(p.name)}</strong><small>${esc(p.grade||'학년 미입력')}</small><small class="cmParentBadge">${badge}</small></div><div class="cmParentActions"><button class="${hidden?'primary':''}" data-parent-action="${hidden?'show':'hide'}" data-player-id="${esc(p.id)}" ${busy?'disabled':''}>${hidden?'공개하기':'비공개로 전환'}</button></div></div>`;
    }).join('')||'<div class="cmParentEmpty">'+(!signedIn()?'경기 프로그램에 로그인하면 저장된 경기 결과가 자동으로 연결됩니다.':source?'현재 소속 선수로 등록된 아이가 없습니다.':'저장된 선수 명단을 불러오고 있습니다.')+'</div>';
  }
  async function publishOnce(){
    if(!signedIn())return;
    const [accessSnap,sourceSnap,publicSnap]=await Promise.all([getDocFromServer(accessRef),getDocFromServer(sourceRef),getDocFromServer(reportRef)]);
    if(!sourceSnap.exists())return;
    const settings=readSettings(accessSnap),raw=sourceSnap.data(),revision=Number(raw.revision||0),before=publicSnap.exists()?publicSnap.data():null;
    const [fingerprint,policyHash]=await Promise.all([sourceFingerprint(raw.encoding,raw.payload),hashSettings(settings)]);
    if(before?.version===2&&before.projectionVersion===2&&before.sourceFingerprint===fingerprint&&before.settingsFingerprint===policyHash)return;
    const db=await decodePayload(raw.encoding,raw.payload),reports=[];
    if(settings.enabled){
      const hidden=new Set(settings.hiddenPlayerIds);
      for(const p of shareablePlayers(db)){
        if(hidden.has(p.id))continue;
        const report=projectPlayer(db,p.id,revision);if(!report)continue;
        report.player.id=p.id;reports.push(report);
      }
    }
    const packed=await packReports(reports);
    if(new TextEncoder().encode(JSON.stringify(packed)).length>850000)throw new Error('REPORT_TOO_LARGE');
    if(!signedIn())return;
    await runTransaction(fs,async tx=>{
      const currentAccess=await tx.get(accessRef),currentSource=await tx.get(sourceRef),currentReport=await tx.get(reportRef);
      if(!currentSource.exists()||JSON.stringify(readSettings(currentAccess))!==JSON.stringify(settings)||Number(currentSource.data().revision||0)!==revision||currentSource.data().payload!==raw.payload||currentSource.data().encoding!==raw.encoding)throw new Error('SOURCE_CHANGED');
      const live=currentReport.exists()?currentReport.data():null;
      if(live?.version===2&&live.projectionVersion===2&&live.sourceFingerprint===fingerprint&&live.settingsFingerprint===policyHash)return;
      tx.set(reportRef,{version:2,projectionVersion:2,enabled:settings.enabled,sourceRevision:revision,sourceFingerprint:fingerprint,settingsFingerprint:policyHash,updatedAt:serverTimestamp(),...packed});
    });
  }
  function publish(){
    const task=(publishing||Promise.resolve()).catch(()=>{}).then(async()=>{
      for(let attempt=0;attempt<4&&signedIn();attempt++){
        try{await publishOnce();return;}catch(error){if(error.message==='SOURCE_CHANGED'&&attempt<3)continue;throw error;}
      }
    });
    publishing=task;const finished=()=>{if(publishing===task)publishing=null;};task.then(finished,finished);return task;
  }
  function schedule(){
    clearTimeout(timer);if(!signedIn())return;
    timer=setTimeout(()=>publish().then(async()=>{button.textContent='학부모 조회';if($('cmParentDialog').open&&!busy){await loadState();render();}}).catch(error=>{message(failure(error),true);button.textContent='학부모 조회 · 반영 필요';}),400);
  }
  async function updateSettings(action,pid){
    if(!signedIn())return;
    busy=true;render();$('cmParentManual').hidden=true;message('공개 설정을 반영하고 있습니다.');
    try{
      await loadState();if(pid&&!shareablePlayers(source).some(p=>p.id===pid))throw new Error('PLAYER_MISSING');
      await runTransaction(fs,async tx=>{
        const snap=await tx.get(accessRef),raw=snap.exists()?snap.data():{},current=readSettings(snap),hidden=new Set(current.hiddenPlayerIds);
        if(action==='pause')current.enabled=false;if(action==='resume')current.enabled=true;
        if(action==='hide')hidden.add(pid);if(action==='show')hidden.delete(pid);
        tx.set(accessRef,{...raw,live:{version:2,enabled:current.enabled,hiddenPlayerIds:[...hidden].sort(),generation:crypto.randomUUID()},updatedAt:serverTimestamp()});
      });
      await publish();await loadState();button.textContent='학부모 조회';message('공개 설정을 반영했습니다. 이후 경기 결과도 자동으로 반영됩니다.');
    }catch(error){message(failure(error),true);button.textContent='학부모 조회 · 반영 필요';}
    finally{busy=false;render();}
  }
  async function open(){
    lastFocus=document.activeElement;if(!$('cmParentDialog').open)$('cmParentDialog').showModal();$('cmParentManual').hidden=true;
    if(!signedIn()){state=null;source=null;render();message('경기 프로그램에 로그인하면 저장된 경기 결과가 자동으로 연결됩니다.');return;}
    busy=true;render();message('저장된 경기 결과를 학부모 화면에 반영하고 있습니다.');
    try{await publish();await loadState();button.textContent='학부모 조회';message(state.enabled?'실시간 조회가 연결되었습니다. 공통 주소를 학부모님께 전달하세요.':'전체 조회가 중지되어 있습니다. 조회 재개 후 사용할 수 있습니다.');}
    catch(error){message(failure(error),true);}finally{busy=false;render();}
  }
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-parent-action]');if(!target)return;
    const action=target.dataset.parentAction,pid=target.dataset.playerId;
    if(action==='open'){if(!busy)open();return;}
    if(action==='close'){$('cmParentDialog').close();return;}
    if(action==='copy'){
      if(navigator.clipboard?.writeText)navigator.clipboard.writeText(commonUrl).then(()=>message('공통 주소를 복사했습니다. 학부모님께 이 주소만 전달하세요.')).catch(()=>showManual());
      else showManual();return;
    }
    if(!signedIn()||busy)return;
    if(action==='retry'){open();return;}
    if(['show','hide','pause','resume'].includes(action))updateSettings(action,pid);
  });
  function showManual(){$('cmParentManual').hidden=false;$('cmParentCopyText').value=commonUrl;$('cmParentCopyText').focus();$('cmParentCopyText').select();message('아래 주소를 복사해서 전달해 주세요.');}
  $('cmParentDialog').addEventListener('close',()=>{$('cmParentCopyText').value='';$('cmParentManual').hidden=true;lastFocus?.focus?.();});
  for(const event of ['cm-cloud-saved','cm-cloud-data'])window.addEventListener(event,schedule);
  window.addEventListener('online',schedule);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  window.addEventListener('cm-cloud-auth',()=>{
    if(!signedIn()){clearTimeout(timer);state=null;source=null;published=null;settingsHash='';$('cmParentCopyText').value='';$('cmParentDialog').close();render();return;}schedule();
  });
  if(signedIn())schedule();
}
