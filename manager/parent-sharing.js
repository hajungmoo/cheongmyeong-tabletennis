import {shareablePlayers,projectPlayer} from './parent-projection.js?v=1.0.0';
import {createAccessKey,validKey,sealReport,lookupId,toBase64} from '../parents/report-crypto.js?v=1.0.0';

export function initParentSharing({auth,fs,sourceRef,doc,getDocFromServer,runTransaction,serverTimestamp,decodePayload}){
  const accessRef=doc(fs,'managerPro','parentPortal'),reportRef=doc(fs,'settings','parentPortal');
  const $=id=>document.getElementById(id),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let state=null,source=null,published=null,readyLinks=new Set(),busy=false,publishing=null,timer=null,lastFocus=null,privateVerified=false;
  const accessData=snap=>snap.exists()?snap.data():{version:1,enabled:true,generation:'',accounts:{}};
  const message=(text,error=false)=>{$('cmParentStatus').textContent=text;$('cmParentStatus').classList.toggle('error',error);};
  const signedIn=()=>!!auth.currentUser;
  const failure=error=>error?.code==='permission-denied'?'조회 연결 권한을 확인할 수 없습니다. 코치 계정으로 다시 로그인해 주세요.':error?.message==='PRIVATE_BOUNDARY'?'자녀 전용 링크를 안전하게 보관할 수 없어 연결을 중단했습니다. 조회 권한 설정을 확인해야 합니다.':error?.message==='REPORT_TOO_LARGE'?'공유할 경기 기록이 너무 많아 반영하지 못했습니다. 기존 경기 기록은 그대로 보관되어 있습니다.':'학부모 화면 반영에 실패했습니다. 인터넷 연결을 확인하고 ‘다시 반영’을 눌러 주세요.';
  const linkFor=secret=>{const url=new URL('../parents/',location.href);url.hash='key='+secret;return url.href;};
  document.body.insertAdjacentHTML('beforeend',`<dialog id="cmParentDialog" class="cmParentDialog" aria-labelledby="cmParentTitle"><div class="cmParentHead"><h2 id="cmParentTitle">학부모 조회 연결</h2><button type="button" data-parent-action="close">닫기</button></div><p>선수별 전용 링크를 학부모님께 전달하세요.<br>자녀 이름을 검색하면 저장된 경기 결과가 표시됩니다.</p><div class="cmParentTools"><button id="cmParentRetry" type="button" data-parent-action="retry">다시 반영</button><button id="cmParentPause" type="button" data-parent-action="pause">전체 조회 중지</button><a class="cmParentLink" href="../parents/" target="_blank" rel="noopener noreferrer">학부모 화면</a></div><div id="cmParentStatus" class="cmParentStatus" role="status" aria-live="polite"></div><div id="cmParentPlayers"></div><div id="cmParentManual" class="cmParentManual" hidden><label for="cmParentCopyText">복사해서 학부모님께 전달할 링크</label><textarea id="cmParentCopyText" readonly></textarea></div><p class="cmParentNote">일반 경기·리그전·확인된 대회 결과가 연결됩니다. 경기 메모와 선수 관리 정보는 공유되지 않습니다. 링크를 받은 분은 해당 자녀의 경기만 조회할 수 있습니다.</p></dialog>`);
  const button=document.createElement('button');button.type='button';button.className='cmParentButton';button.textContent='학부모 연결';button.dataset.parentAction='open';
  (document.querySelector('.topTools')||document.body).append(button);
  async function verifyPrivateBoundary(){
    if(privateVerified)return;
    const response=await fetch('https://firestore.googleapis.com/v1/projects/cheongmyeong-tabletennis/databases/(default)/documents/managerPro/parentPortal?mask.fieldPaths=version',{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(response.status!==403)throw new Error('PRIVATE_BOUNDARY');privateVerified=true;
  }
  async function loadState(){
    if(!signedIn())throw new Error('LOGIN_REQUIRED');
    await verifyPrivateBoundary();
    const uid=auth.currentUser.uid;
    const [accessSnap,sourceSnap,publicSnap]=await Promise.all([getDocFromServer(accessRef),getDocFromServer(sourceRef),getDocFromServer(reportRef)]);
    if(!signedIn()||auth.currentUser.uid!==uid)throw new Error('LOGIN_REQUIRED');
    if(!sourceSnap.exists())throw new Error('SOURCE_MISSING');
    const raw=sourceSnap.data(),decoded=await decodePayload(raw.encoding,raw.payload);
    if(!signedIn()||auth.currentUser.uid!==uid)throw new Error('LOGIN_REQUIRED');
    source=decoded;state=accessData(accessSnap);published=publicSnap.exists()?publicSnap.data():null;
    readyLinks=new Set();
    if(state.enabled!==false&&published?.accessGeneration===state.generation){
      for(const p of shareablePlayers(source)){const account=state.accounts?.[p.id];if(account?.enabled&&validKey(account.secret)){const lookup=await lookupId(account.secret,p.name);if(published.entries?.[lookup])readyLinks.add(p.id);}}
    }
  }
  function render(){
    $('cmParentPause').disabled=busy||!state?.generation;
    $('cmParentPause').textContent=state?.enabled===false?'전체 조회 재개':'전체 조회 중지';$('cmParentRetry').disabled=busy||!signedIn();
    const players=source?shareablePlayers(source):[];
    $('cmParentPlayers').innerHTML=players.map(p=>{
      const account=state?.accounts?.[p.id],enabled=!!account?.enabled,ready=readyLinks.has(p.id)&&state?.enabled!==false;
      const badge=!enabled?'연결 전':state?.enabled===false?'전체 조회 중지됨':ready?'조회 가능':'반영 대기';
      return `<div class="cmParentRow"><div><strong>${esc(p.name)}</strong><small>${esc(p.grade||'학년 미입력')}</small><small class="cmParentBadge">${badge}</small></div><div class="cmParentActions">${enabled?`<button class="primary" data-parent-action="copy" data-player-id="${esc(p.id)}" ${!ready||busy?'disabled':''}>링크 복사</button><button data-parent-action="rotate" data-player-id="${esc(p.id)}" ${busy?'disabled':''}>재발급</button><button data-parent-action="disable" data-player-id="${esc(p.id)}" ${busy?'disabled':''}>연결 중지</button>`:`<button class="primary" data-parent-action="enable" data-player-id="${esc(p.id)}" ${busy?'disabled':''}>연결하기</button>`}</div></div>`;
    }).join('')||'<div class="cmParentEmpty">'+(!signedIn()?'경기 프로그램에 로그인한 뒤 연결할 수 있습니다.':source?'현재 소속 선수로 등록된 아이가 없습니다.':'저장된 선수 명단을 불러오고 있습니다.')+'</div>';
  }
  async function publishOnce(){
    if(!signedIn())return;
    await verifyPrivateBoundary();
    const [accessSnap,sourceSnap,publicSnap]=await Promise.all([getDocFromServer(accessRef),getDocFromServer(sourceRef),getDocFromServer(reportRef)]);
    if(!accessSnap.exists()||!sourceSnap.exists())return;
    const access=accessSnap.data(),raw=sourceSnap.data(),revision=Number(raw.revision||0),before=publicSnap.exists()?publicSnap.data():null;
    const fingerprint=toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw.encoding+'|'+raw.payload))));
    if(before?.sourceFingerprint===fingerprint&&before.accessGeneration===access.generation)return;
    const db=await decodePayload(raw.encoding,raw.payload),entries={};
    if(access.enabled!==false){
      for(const p of shareablePlayers(db)){
        const account=access.accounts?.[p.id];if(!account?.enabled||!validKey(account.secret))continue;
        const report=projectPlayer(db,p.id,revision);if(!report)continue;
        const sealed=await sealReport(report,account.secret);entries[sealed.lookup]=sealed.envelope;
      }
    }
    if(new TextEncoder().encode(JSON.stringify(entries)).length>850000)throw new Error('REPORT_TOO_LARGE');
    if(!signedIn())return;
    await runTransaction(fs,async tx=>{
      const currentAccess=await tx.get(accessRef),currentSource=await tx.get(sourceRef),currentReport=await tx.get(reportRef);
      if(!currentAccess.exists()||!currentSource.exists()||currentAccess.data().generation!==access.generation||Number(currentSource.data().revision||0)!==revision||currentSource.data().payload!==raw.payload||currentSource.data().encoding!==raw.encoding)throw new Error('SOURCE_CHANGED');
      const live=currentReport.exists()?currentReport.data():null;
      if(live?.sourceFingerprint===fingerprint&&live.accessGeneration===access.generation)return;
      tx.set(reportRef,{version:1,sourceRevision:revision,sourceFingerprint:fingerprint,accessGeneration:access.generation,updatedAt:serverTimestamp(),entries});
    });
  }
  function publish(){
    // Queue each requested synchronization; a save arriving as another completes is retained.
    const task=(publishing||Promise.resolve()).catch(()=>{}).then(async()=>{
      for(let attempt=0;attempt<4&&signedIn();attempt++){
        try{await publishOnce();return;}catch(error){if(error.message==='SOURCE_CHANGED'&&attempt<3)continue;throw error;}
      }
    });
    publishing=task;
    const finished=()=>{if(publishing===task)publishing=null;};
    task.then(finished,finished);return task;
  }
  function schedule(){
    clearTimeout(timer);if(!signedIn())return;
    timer=setTimeout(()=>publish().then(async()=>{button.textContent='학부모 연결';if($('cmParentDialog').open&&!busy){await loadState();render();}}).catch(error=>{message(failure(error),true);button.textContent='학부모 연결 · 반영 필요';}),700);
  }
  async function updateAccess(action,pid){
    if(!signedIn())return;
    busy=true;render();$('cmParentManual').hidden=true;message('조회 연결을 반영하고 있습니다.');
    try{
      await loadState();
      if(pid&&!shareablePlayers(source).some(p=>p.id===pid))throw new Error('PLAYER_MISSING');
      const enabled=state.enabled===false;
      await runTransaction(fs,async tx=>{
        const snap=await tx.get(accessRef),current=accessData(snap),accounts={...(current.accounts||{})};
        if(action==='pause'){current.enabled=enabled;}
        else if(action==='disable'){if(accounts[pid])accounts[pid]={...accounts[pid],enabled:false};}
        else{const existing=accounts[pid];accounts[pid]={enabled:true,secret:action==='rotate'||!validKey(existing?.secret)?createAccessKey():existing.secret};}
        tx.set(accessRef,{...current,version:1,enabled:current.enabled!==false,accounts,generation:createAccessKey(),updatedAt:serverTimestamp()});
      });
      await publish();await loadState();button.textContent='학부모 연결';message('학부모 화면에 반영했습니다. 조회 가능한 선수의 링크를 복사해 전달하세요.');
    }catch(error){readyLinks=new Set();message(failure(error),true);button.textContent='학부모 연결 · 반영 필요';}
    finally{busy=false;render();}
  }
  async function open(){
    lastFocus=document.activeElement;$('cmParentDialog').showModal();$('cmParentManual').hidden=true;
    if(!signedIn()){state=null;source=null;render();message('경기 프로그램에 로그인한 뒤 학부모 연결을 열어 주세요.');return;}
    busy=true;render();message('클라우드에 저장된 선수 명단을 확인하고 있습니다.');
    try{await loadState();await publish();await loadState();message(state.generation?'이후 경기 결과를 저장하면 학부모 화면에도 자동으로 반영됩니다.':'연결할 선수의 ‘연결하기’를 눌러 전용 조회 링크를 만드세요.');}
    catch(error){message(failure(error),true);}finally{busy=false;render();}
  }
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-parent-action]');if(!target)return;
    const action=target.dataset.parentAction,pid=target.dataset.playerId;
    if(action==='open'){open();return;}
    if(action==='close'){$('cmParentDialog').close();return;}
    if(!signedIn()||busy)return;
    if(action==='copy'){
      const account=state?.accounts?.[pid];if(!account?.enabled||!readyLinks.has(pid))return;
      const link=linkFor(account.secret);
      navigator.clipboard?.writeText(link).then(()=>message('전용 조회 링크를 복사했습니다. 해당 선수 학부모님께 전달해 주세요.')).catch(()=>showManual(link));
      if(!navigator.clipboard)showManual(link);return;
    }
    if(action==='rotate'&&!confirm('새 조회 링크를 발급하면 이전 링크로는 더 이상 새 기록을 볼 수 없습니다. 재발급할까요?'))return;
    if(action==='retry'){open();return;}
    if(['enable','disable','rotate','pause'].includes(action))updateAccess(action,pid);
  });
  function showManual(link){$('cmParentManual').hidden=false;$('cmParentCopyText').value=link;$('cmParentCopyText').focus();$('cmParentCopyText').select();message('아래 링크를 복사해서 전달해 주세요.');}
  $('cmParentDialog').addEventListener('close',()=>{$('cmParentCopyText').value='';$('cmParentManual').hidden=true;lastFocus?.focus?.();});
  for(const event of ['cm-cloud-saved','cm-cloud-data'])window.addEventListener(event,schedule);
  window.addEventListener('cm-cloud-auth',()=>{
    if(!signedIn()){clearTimeout(timer);state=null;source=null;published=null;readyLinks.clear();privateVerified=false;$('cmParentCopyText').value='';$('cmParentDialog').close();render();return;}schedule();
  });
  if(signedIn())schedule();
}
