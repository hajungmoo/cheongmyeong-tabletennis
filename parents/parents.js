import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js';
import {getFirestore,doc,onSnapshot} from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js';
import {accessKeyFrom,lookupId,openReport} from './report-crypto.js?v=1.0.0';

const app=initializeApp({apiKey:'AIzaSyCbZ9CUf_hJRAKs2T7MYK7Z4YBNjn7p9pI',authDomain:'cheongmyeong-tabletennis.firebaseapp.com',projectId:'cheongmyeong-tabletennis',appId:'1:712801821489:web:501d20626d8cd12dc98610'});
const ref=doc(getFirestore(app),'settings','parentPortal'),$=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sourceNames={match:'일반 경기',league:'리그전',competition:'대회 기록'};
let key=accessKeyFrom(location.href),active=null,unsubscribe=null,report=null,limit=30,generation=0,delivery=0,loadTimer=null;
$('accessField').hidden=!!key;
if(key)$('lookupHint').textContent='자녀 이름을 입력하면 저장된 경기 결과를 확인할 수 있습니다.';
function status(message,error=false){$('lookupStatus').textContent=message;$('lookupStatus').classList.toggle('error',error);}
function clearReport(){report=null;$('report').hidden=true;$('welcome').hidden=false;$('matchList').replaceChildren();}
function stop(){generation++;delivery++;clearTimeout(loadTimer);unsubscribe?.();unsubscribe=null;}
function empty(message){clearReport();status(message,true);}
function formatUpdated(value){const date=value?.toDate?.();return date&&!Number.isNaN(date.getTime())?'최근 반영 '+new Intl.DateTimeFormat('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'}).format(date):'저장된 최신 기록';}
async function startLookup({focus=false}={}){
  stop();if(!active)return;
  const current=generation,selection={...active};status('저장된 경기 기록을 불러오고 있습니다.');$('lookupButton').disabled=true;
  loadTimer=setTimeout(()=>{if(current===generation){status('연결이 지연되고 있습니다. 인터넷 연결을 확인하고 다시 조회해 주세요.',true);$('lookupButton').disabled=false;}},20000);
  try{
    const lookup=await lookupId(selection.key,selection.name);if(current!==generation)return;
    unsubscribe=onSnapshot(ref,{includeMetadataChanges:true},snapshot=>{
      const item=++delivery;
      (async()=>{
        if(current!==generation)return;
        if(snapshot.metadata?.fromCache){status('인터넷에 연결해 최신 기록을 확인하고 있습니다.');return;}
        clearTimeout(loadTimer);
        const data=snapshot.exists()?snapshot.data():null,envelope=data?.entries?.[lookup];
        if(!envelope){empty('이름과 조회 링크를 확인해 주세요. 연결이 중지되었다면 코치님께 새 링크를 받아 주세요.');$('lookupButton').disabled=false;return;}
        const opened=await openReport(envelope,selection.key,selection.name);
        if(current!==generation||item!==delivery)return;
        report=opened;$('athleteName').textContent=opened.player.name;$('athleteMeta').textContent=[opened.player.school,opened.player.grade].filter(Boolean).join(' · ');
        $('updatedAt').textContent=formatUpdated(data.updatedAt);$('report').hidden=false;$('welcome').hidden=true;
        if(focus)$('sourceFilter').value=opened.matches.find(m=>m.source==='match')?'match':opened.matches.find(m=>m.source==='league')?'league':'competition';
        status('새로 저장된 결과가 있으면 자동으로 반영됩니다.');$('lookupButton').disabled=false;renderMatches();
        if(focus){$('athleteName').focus({preventScroll:true});focus=false;}
      })().catch(error=>{if(current!==generation||item!==delivery)return;empty(error.message?.includes('최신 크롬')?error.message:'이름과 조회 링크가 맞는지 확인해 주세요.');$('lookupButton').disabled=false;});
    },()=>{if(current!==generation)return;empty('기록을 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 조회해 주세요.');$('lookupButton').disabled=false;});
  }catch{if(current===generation){empty('조회 링크를 확인하고 다시 시도해 주세요.');$('lookupButton').disabled=false;}}
}
function renderMatches(){
  if(!report)return;
  const source=$('sourceFilter').value,from=$('dateFrom').value,to=$('dateTo').value,result=$('resultFilter').value;
  if(from&&to&&from>to){$('filterStatus').textContent='종료일은 시작일 이후로 선택해 주세요.';return;}$('filterStatus').textContent='';
  const rows=report.matches.filter(m=>(source==='all'||m.source===source)&&(!from||(m.dateEnd||m.date)>=from)&&(!to||m.date<=to)&&(result==='all'||m.result===result));
  const wins=rows.filter(m=>m.result==='win').length,losses=rows.filter(m=>m.result==='loss').length;
  $('totalMatches').textContent=rows.length;$('totalWins').textContent=wins;$('totalLosses').textContent=losses;$('winRate').textContent=wins+losses?Math.round(wins/(wins+losses)*1000)/10+'%':'—';
  $('matchMetrics').hidden=source==='all';
  $('recordCount').textContent=rows.length+(source==='all'?'개 기록':'경기');
  $('recordNote').textContent=source==='all'?'같은 경기가 일반 경기와 리그전에 각각 저장된 경우 함께 표시됩니다. 승패 합계는 경기 구분을 선택하면 볼 수 있습니다.':'점수는 우리 아이 기준 세트 점수입니다.'+(rows.some(m=>!['win','loss'].includes(m.result))?' 무승부·승패 미확정 기록은 승률에서 제외됩니다.':'');
  $('matchList').innerHTML=rows.slice(0,limit).map(m=>{
    const label=({win:'승리',loss:'패배',draw:'무승부',unscored:'승패 미확정'})[m.result]||'승패 미확정';
    const score=Number.isFinite(m.a)&&Number.isFinite(m.b)?esc(m.a)+' : '+esc(m.b):'—';
    const ourNames=[report.player.name,...(m.partner||[])].map(esc).join(' · '),other=(m.opponents||[]).map(esc).join(' · ');
    const dateText=(m.dateLabel?m.dateLabel+' ':'')+(m.date||'날짜 미입력')+(m.dateEnd&&m.dateEnd!==m.date?' ~ '+m.dateEnd:'');
    return `<article class="matchCard"><div class="matchMeta"><time>${esc(dateText)}</time><span class="sourceBadge">${esc(sourceNames[m.source]||'경기')}</span><span class="matchTitle">${esc(m.title)}</span></div><div class="matchContent"><div class="side"><strong>${ourNames}</strong><small>${esc([m.format,m.round].filter(Boolean).join(' · '))}</small></div><div class="score"><strong>${score}</strong><span class="resultBadge ${m.result==='loss'?'loss':m.result==='win'?'':'neutral'}">${label}</span></div><div class="side opponent"><strong>${other}</strong><small>${(m.opponentSchools||[]).map(esc).join(' · ')}</small></div></div>${m.forfeit?'<div class="matchFoot">기권이 반영된 경기입니다.</div>':''}</article>`;
  }).join('')||'<div class="empty">'+(report.matches.length?'선택한 조건에 맞는 경기 기록이 없습니다.':'아직 저장된 경기 결과가 없습니다.')+'</div>';
  $('moreMatches').hidden=rows.length<=limit;
  $('moreMatches').textContent='경기 더 보기 ('+Math.max(0,rows.length-limit)+'경기)';
}
$('lookupForm').addEventListener('submit',event=>{event.preventDefault();const name=$('playerName').value.trim(),entered=key||accessKeyFrom($('accessKey').value);if(!name)return status('자녀 이름을 입력해 주세요.',true);if(!entered)return status('코치님께 받은 자녀 전용 조회 링크를 입력해 주세요.',true);active={name,key:entered};limit=30;clearReport();startLookup({focus:true});});
$('recordFilters').addEventListener('submit',event=>event.preventDefault());
$('recordFilters').addEventListener('change',()=>{limit=30;renderMatches();});
$('resetFilters').addEventListener('click',()=>{$('resultFilter').value='all';$('dateFrom').value='';$('dateTo').value='';limit=30;renderMatches();});
$('moreMatches').addEventListener('click',()=>{limit+=30;renderMatches();});
$('refreshReport').addEventListener('click',()=>startLookup());
window.addEventListener('hashchange',()=>{stop();active=null;key=accessKeyFrom(location.href);$('accessField').hidden=!!key;$('lookupButton').disabled=false;clearReport();status('자녀 이름을 입력해 주세요.');});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();$('lookupButton').disabled=false;clearReport();}else if(active)startLookup();});
window.addEventListener('pagehide',()=>{stop();clearReport();});
window.addEventListener('pageshow',event=>{if(event.persisted&&active)startLookup();});
window.addEventListener('online',()=>{if(active)startLookup();});
