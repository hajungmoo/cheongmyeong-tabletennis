import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js';
import {getFirestore,doc,onSnapshot} from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js';
import {normalizeName,unpackReports} from './report-data.js?v=2.0.0';

const app=initializeApp({apiKey:'AIzaSyCbZ9CUf_hJRAKs2T7MYK7Z4YBNjn7p9pI',authDomain:'cheongmyeong-tabletennis.firebaseapp.com',projectId:'cheongmyeong-tabletennis',appId:'1:712801821489:web:501d20626d8cd12dc98610'});
const ref=doc(getFirestore(app),'settings','parentLive'),$=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sourceNames={match:'일반 경기','one-set':'한세트게임',league:'리그전',competition:'대회 기록'};
let active=null,unsubscribe=null,report=null,reports=[],limit=30,generation=0,delivery=0,loadTimer=null;
if(location.hash.startsWith('#key='))history.replaceState(null,'',location.pathname+location.search);
function status(message,error=false){$('lookupStatus').textContent=message;$('lookupStatus').classList.toggle('error',error);}
function clearReport(){report=null;$('report').hidden=true;$('welcome').hidden=false;$('matchList').replaceChildren();$('playerChoices').replaceChildren();$('playerChoices').hidden=true;}
function stop(){generation++;delivery++;clearTimeout(loadTimer);unsubscribe?.();unsubscribe=null;}
function empty(message){clearReport();status(message,true);}
function formatUpdated(value){const date=value?.toDate?.();return date&&!Number.isNaN(date.getTime())?'최근 반영 '+new Intl.DateTimeFormat('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'}).format(date):'저장된 최신 기록';}
function displaySelection({focus=false}={}){
  if(!active)return;
  const matches=reports.filter(r=>normalizeName(r.player.name)===normalizeName(active.name));
  $('playerChoices').replaceChildren();$('playerChoices').hidden=true;
  const selected=active.playerId?matches.find(r=>r.player.id===active.playerId):matches.length===1?matches[0]:null;
  if(!selected){
    clearReport();
    if(matches.length>1){
      status('같은 이름의 선수가 있습니다. 학년을 확인하고 선택해 주세요.');$('playerChoices').hidden=false;
      for(const item of matches){const button=document.createElement('button');button.type='button';button.className='button quiet';button.textContent=[item.player.name,item.player.grade,item.player.school].filter(Boolean).join(' · ');button.addEventListener('click',()=>{active.playerId=item.player.id;displaySelection({focus:true});});$('playerChoices').append(button);}
    }else status('조회 가능한 기록을 찾지 못했습니다. 선수 이름을 정확히 입력해 주세요.',true);
    return;
  }
  active.playerId=selected.player.id;report=selected;
  $('athleteName').textContent=selected.player.name;$('athleteMeta').textContent=[selected.player.school,selected.player.grade].filter(Boolean).join(' · ');
  $('report').hidden=false;$('welcome').hidden=true;
  if(focus)$('sourceFilter').value=['match','one-set','league','competition'].find(source=>selected.matches.some(m=>m.source===source))||'match';
  status('실시간 조회 중 · 새 경기 결과가 저장되면 자동으로 바뀝니다.');renderMatches();
  if(focus)$('athleteName').focus({preventScroll:true});
}
async function startLookup({focus=false}={}){
  stop();if(!active)return;
  const current=generation;status('저장된 경기 기록을 불러오고 있습니다.');$('lookupButton').disabled=true;
  loadTimer=setTimeout(()=>{if(current===generation){status('연결이 지연되고 있습니다. 인터넷 연결을 확인하고 다시 조회해 주세요.',true);$('lookupButton').disabled=false;}},20000);
  unsubscribe=onSnapshot(ref,{includeMetadataChanges:true},snapshot=>{
    const item=++delivery;
    (async()=>{
      if(current!==generation)return;
      if(snapshot.metadata?.fromCache){status('인터넷에 연결해 최신 기록을 확인하고 있습니다.');return;}
      clearTimeout(loadTimer);
      const data=snapshot.exists()?snapshot.data():null;
      if(!data||data.version!==2){reports=[];empty('조회 자료를 준비하고 있습니다. 코치님이 경기 프로그램을 열면 저장된 기록이 자동으로 연결됩니다.');$('lookupButton').disabled=false;return;}
      if(data.enabled===false){reports=[];empty('지금은 경기 조회가 잠시 중지되어 있습니다.');$('lookupButton').disabled=false;return;}
      const loaded=await unpackReports(data);if(current!==generation||item!==delivery)return;
      reports=loaded;$('updatedAt').textContent=formatUpdated(data.updatedAt);$('lookupButton').disabled=false;
      displaySelection({focus});focus=false;
    })().catch(error=>{if(current!==generation||item!==delivery)return;reports=[];empty(error.message==='BROWSER_UPDATE'?'최신 크롬 또는 사파리에서 조회 화면을 열어 주세요.':'기록을 불러오지 못했습니다. 잠시 후 다시 조회해 주세요.');$('lookupButton').disabled=false;});
  },()=>{if(current!==generation)return;clearTimeout(loadTimer);reports=[];empty('기록을 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 조회해 주세요.');$('lookupButton').disabled=false;});
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
  $('recordNote').textContent=source==='all'?'한세트게임은 실제 득점, 다른 경기는 세트 점수를 표시합니다. 같은 경기가 일반 경기와 리그전에 각각 저장된 경우 함께 표시됩니다. 승패 합계는 경기 구분을 선택하면 볼 수 있습니다.':(source==='one-set'?'점수는 우리 아이 기준 실제 득점입니다. 승패는 경기당 한 번 반영됩니다.':'점수는 우리 아이 기준 세트 점수입니다.')+(rows.some(m=>!['win','loss'].includes(m.result))?' 무승부·승패 미확정 기록은 승률에서 제외됩니다.':'');
  $('matchList').innerHTML=rows.slice(0,limit).map(m=>{
    const label=({win:'승리',loss:'패배',draw:'무승부',unscored:'승패 미확정'})[m.result]||'승패 미확정';
    const score=Number.isFinite(m.a)&&Number.isFinite(m.b)?esc(m.a)+' : '+esc(m.b):'—';
    const ourNames=[report.player.name,...(m.partner||[])].map(esc).join(' · '),other=(m.opponents||[]).map(esc).join(' · ');
    const dateText=(m.dateLabel?m.dateLabel+' ':'')+(m.date||'날짜 미입력')+(m.dateEnd&&m.dateEnd!==m.date?' ~ '+m.dateEnd:'');
    const movement=m.source==='one-set'&&Number.isInteger(m.tableNumber)&&Number.isInteger(m.nextTable)?`<div class="matchFoot">${esc(m.tableNumber)}탁 경기 <span aria-hidden="true">→</span> 다음 경기 ${esc(m.nextTable)}탁${m.tableNumber===m.nextTable?' · 같은 탁 유지':''}</div>`:'';
    return `<article class="matchCard"><div class="matchMeta"><time>${esc(dateText)}</time><span class="sourceBadge">${esc(sourceNames[m.source]||'경기')}</span><span class="matchTitle">${m.title===sourceNames[m.source]?'':esc(m.title)}</span></div><div class="matchContent"><div class="side"><strong>${ourNames}</strong><small>${esc([m.format,m.round].filter(Boolean).join(' · '))}</small></div><div class="score"><strong>${score}</strong>${m.scoreUnit==='points'?'<small>득점</small>':''}<span class="resultBadge ${m.result==='loss'?'loss':m.result==='win'?'':'neutral'}">${label}</span></div><div class="side opponent"><strong>${other}</strong><small>${(m.opponentSchools||[]).map(esc).join(' · ')}</small></div></div>${movement}${m.forfeit?'<div class="matchFoot">기권이 반영된 경기입니다.</div>':''}</article>`;
  }).join('')||'<div class="empty">'+(report.matches.length?'선택한 조건에 맞는 경기 기록이 없습니다.':'아직 저장된 경기 결과가 없습니다.')+'</div>';
  $('moreMatches').hidden=rows.length<=limit;
  $('moreMatches').textContent='경기 더 보기 ('+Math.max(0,rows.length-limit)+'경기)';
}
$('lookupForm').addEventListener('submit',event=>{event.preventDefault();const name=$('playerName').value.trim();if(!normalizeName(name))return status('자녀 이름을 입력해 주세요.',true);active={name,playerId:null};limit=30;reports=[];$('playerChoices').replaceChildren();$('playerChoices').hidden=true;$('resultFilter').value='all';$('dateFrom').value='';$('dateTo').value='';clearReport();startLookup({focus:true});});
$('recordFilters').addEventListener('submit',event=>event.preventDefault());
$('recordFilters').addEventListener('change',()=>{limit=30;renderMatches();});
$('resetFilters').addEventListener('click',()=>{$('resultFilter').value='all';$('dateFrom').value='';$('dateTo').value='';limit=30;renderMatches();});
$('moreMatches').addEventListener('click',()=>{limit+=30;renderMatches();});
$('refreshReport').addEventListener('click',()=>startLookup());
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();$('lookupButton').disabled=false;clearReport();}else if(active)startLookup();});
window.addEventListener('pagehide',()=>{stop();clearReport();});
window.addEventListener('pageshow',event=>{if(event.persisted&&active)startLookup();});
window.addEventListener('online',()=>{if(active)startLookup();});
