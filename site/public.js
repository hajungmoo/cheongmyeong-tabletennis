import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js';
import { getFirestore, collection, getDocs, addDoc, doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
import { resolveSettings, escapeHTML as esc, safeURL, scheduleDate, scheduleState, sortedItems, isPinned } from './site-content.js?v=2.0.0';

const app = initializeApp({apiKey:'AIzaSyCbZ9CUf_hJRAKs2T7MYK7Z4YBNjn7p9pI',authDomain:'cheongmyeong-tabletennis.firebaseapp.com',projectId:'cheongmyeong-tabletennis',storageBucket:'cheongmyeong-tabletennis.firebasestorage.app',messagingSenderId:'712801821489',appId:'1:712801821489:web:501d20626d8cd12dc98610'});
const db = getFirestore(app), $ = id => document.getElementById(id);
const preview = new URLSearchParams(location.search).get('preview') === '1' && window.parent !== window;
let settings = resolveSettings(), rawSettings = {}, previewDraft = null, failed = [], scheduleFilter = 'all', noticeLimit = 6, recordLimit = 6, submitting = false;
const state = {players:[],notices:[],schedules:[],records:[]};
const paragraphs = value => esc(value).replace(/\n/g,'<br>');
const maskName = value => { const s=String(value||'').trim(); return !s?'청명 선수':s.includes('○')?s:s.length<3?s[0]+'○':s[0]+'○'+s.at(-1); };
const visible = item => item.hidden !== true && item.hidden !== 'true' && item.visible !== false;
function text(id, value) { const el=$(id); if(el) el.textContent=value??''; }
function image(id, url, alt) { const el=$(id); if(!el)return; el.src=safeURL(url,'team-logo.png'); el.alt=alt||''; }
function renderCoachMessage(element, value) {
  const copy=String(value??'').trim();
  const lines=copy.split(/\n+/).map(line=>line.trim()).filter(Boolean);
  let paragraphs=lines;
  if(lines.length===1){
    const sentences=copy.split(/(?<=[.!?。])\s+(?=\S)/u);
    paragraphs=[];
    for(let i=0;i<sentences.length;i+=2)paragraphs.push(sentences.slice(i,i+2).join(' '));
  }
  element.replaceChildren(...paragraphs.map(copy=>{
    const paragraph=document.createElement('p');paragraph.textContent=copy;return paragraph;
  }));
}
function applySettings(raw) {
  settings=resolveSettings(raw); const c=settings.siteContent;
  document.querySelectorAll('[data-content]').forEach(el=>{if(el.dataset.content==='messageBody')renderCoachMessage(el,c.messageBody);else el.textContent=c[el.dataset.content]??'';});
  text('mainTitle',settings.mainTitle); text('mainSubtitle',settings.mainSubtitle);
  image('heroImage',c.heroImage,c.heroAlt); image('navLogo',c.heroImage,c.teamName+' 로고'); image('sponsorImage',c.sponsorImage,c.sponsorName);
  text('primaryLabel',c.primaryLabel); text('secondaryLabel',c.secondaryLabel);
  const sections={team:'showTeam',overview:'showOverview',activity:'showActivities',schedule:'showSchedules',records:'showRecords',notice:'showNotices',coach:'showCoach',message:'showMessage',faq:'showFaq',trial:'showTrial',map:'showMap'};
  Object.entries(sections).forEach(([id,key])=>{$(id).hidden=c[key]===false;});
  document.querySelectorAll('a[href^="#"]').forEach(a=>{const id=a.getAttribute('href').slice(1); if(sections[id])a.hidden=$(id).hidden;});
  $('musicBtn').hidden=c.showMusic===false;
  const phone=String(c.contactPhone||'').replace(/[^\d+]/g,'');
  document.querySelectorAll('[data-phone]').forEach(el=>{el.href='tel:'+phone;el.hidden=!phone;});
  $('naverMap').href=safeURL(c.mapUrl,'https://map.naver.com/');
  const mapURL='https://maps.google.com/maps?q='+encodeURIComponent(c.mapQuery||c.contactAddress)+'&t=&z=15&ie=UTF8&iwloc=&output=embed';
  if($('mapFrame').getAttribute('src')!==mapURL)$('mapFrame').src=mapURL;
  $('coachValues').innerHTML=c.values.filter(visible).map((v,i)=>`<div class="value"><span>${String(i+1).padStart(2,'0')}</span><h3>${esc(v.title)}</h3><p>${esc(v.body)}</p></div>`).join('');
  $('activityList').innerHTML=c.activities.filter(visible).map((a,i)=>{
    const img=safeURL(a.image),url=safeURL(a.url);
    return `<article class="story">${img?`<img class="storyImage" src="${esc(img)}" alt="${esc(a.title)}" loading="lazy">`:''}<div class="storyBody"><div class="storyMeta"><span>${esc(a.tag||'청명 소식')}</span><time>${esc(a.date)}</time></div><h3>${esc(a.title)}</h3><p>${paragraphs(a.body)}</p>${url?`<a class="textLink" href="${esc(url)}" target="_blank" rel="noopener noreferrer">활동 자세히 보기 <span aria-hidden="true">↗</span></a>`:''}<span class="storyNumber" aria-hidden="true">${String(i+1).padStart(2,'0')}</span></div></article>`;
  }).join('')||'<p class="empty">새로운 활동 소식을 준비하고 있습니다.</p>';
  $('faqList').innerHTML=c.faqs.filter(visible).map((f,i)=>`<details class="faqItem"><summary><span class="questionNo">${String(i+1).padStart(2,'0')}</span><span>${esc(f.question)}</span><span class="faqPlus" aria-hidden="true">+</span></summary><div class="faqAnswer">${paragraphs(f.answer)}</div></details>`).join('')||'<p class="empty">궁금한 점은 전화로 문의해주세요.</p>';
  if(settings.popupEnabled && settings.popupTitle && settings.popupContent){
    text('popupTitle',settings.popupTitle);text('popupContent',settings.popupContent);
    if(!$('popupDialog').open)$('popupDialog').showModal();
  }else if($('popupDialog').open)$('popupDialog').close();
}
function renderPlayers() {
  const players=sortedItems(state.players).filter(visible);
  text('heroPlayerCount',players.length); text('teamCount',players.length+'명의 선수');
  $('playerList').innerHTML=players.map((p,i)=>`<article class="player"><div class="playerMeta"><span>PLAYER ${String(i+1).padStart(2,'0')}</span><span>${esc(p.grade)}</span></div><h3>${esc(maskName(p.name))}<span class="playerMark" aria-hidden="true">CM</span></h3><p>${esc(p.style||'청명초 선수')}</p>${p.award?`<div class="playerAward">${paragraphs(p.award)}</div>`:''}</article>`).join('')||'<p class="empty">선수단 소개를 준비하고 있습니다.</p>';
}
function renderSchedules() {
  const items=sortedItems(state.schedules).filter(visible);
  const dated=items.filter(s=>['upcoming','ongoing'].includes(scheduleState(s))).sort((a,b)=>scheduleDate(a).localeCompare(scheduleDate(b)));
  const next=dated[0]||items.find(s=>scheduleState(s)==='other');
  if(next){
    text('nextLabel',scheduleState(next)==='other'?'훈련 일정':'다가오는 일정');text('nextScheduleTitle',next.title);text('nextScheduleDate',`${next.day||scheduleDate(next)}${next.time?' · '+next.time:''}`);
    text('nextSchedulePlace',next.place||next.memo||'');
  }else{ text('nextLabel','다음 일정');text('nextScheduleTitle','새 일정을 준비하고 있습니다.');text('nextScheduleDate','등록된 일정은 아래에서 확인하세요.');text('nextSchedulePlace',''); }
  const q=$('scheduleSearch').value.trim().toLowerCase();
  const filtered=items.filter(s=>(scheduleFilter==='all'||(scheduleFilter==='upcoming'?['upcoming','ongoing'].includes(scheduleState(s)):scheduleState(s)===scheduleFilter))&&(!q||[s.title,s.day,s.memo,s.place].join(' ').toLowerCase().includes(q)));
  text('scheduleResults',`${filtered.length}개 일정`);
  $('scheduleList').innerHTML=filtered.map(s=>{
    const status=scheduleState(s),label={past:'지난 일정',upcoming:'예정',ongoing:'진행 중',other:'정기 · 기타'}[status];
    return `<article class="scheduleRow"><div class="scheduleDay"><span class="stateTag ${status}">${label}</span><time>${esc(s.day||scheduleDate(s)||'일정')}</time></div><div><h3>${esc(s.title)}</h3><p>${paragraphs(s.place||s.memo||'')}</p></div><div class="scheduleTime">${esc(s.time||'시간 추후 안내')}</div></article>`;
  }).join('')||'<p class="empty">조건에 맞는 일정이 없습니다.</p>';
}
function renderNotices() {
  const items=sortedItems(state.notices).filter(visible).sort((a,b)=>Number(isPinned(b))-Number(isPinned(a)));
  text('heroNoticeCount',items.length);
  const latest=items[0];
  text('noticeFeatureDate',latest?.date||'');text('noticeFeatureTitle',latest?.title||'새로운 소식을 준비하고 있습니다.');text('noticeFeatureText',latest?.content||'공지사항이 등록되면 이곳에서 확인할 수 있습니다.');
  const q=$('noticeSearch').value.trim().toLowerCase(), filtered=items.filter(n=>!q||[n.title,n.content].join(' ').toLowerCase().includes(q));
  $('noticeList').innerHTML=filtered.slice(0,noticeLimit).map(n=>`<details class="noticeItem"><summary><div><span class="noticeDate">${esc(n.date||'청명 소식')}${isPinned(n)?'<b class="pin">중요</b>':''}</span><h3>${esc(n.title)}</h3></div><span class="faqPlus" aria-hidden="true">+</span></summary><div class="noticeBody">${paragraphs(n.content)}</div></details>`).join('')||'<p class="empty">해당 공지사항이 없습니다.</p>';
  $('moreNotices').hidden=filtered.length<=noticeLimit;
}
function renderRecords() {
  const items=sortedItems(state.records).filter(visible);text('heroRecordCount',items.length);
  $('recordList').innerHTML=items.slice(0,recordLimit).map(r=>`<article class="record"><span class="recordDate">${esc(r.year||r.date||'대회 기록')}</span><div class="recordResult">${paragraphs(r.result)}</div><h3>${esc(r.title||r.event||'대회')}</h3><p>${paragraphs(r.memo||r.detail||'')}</p></article>`).join('')||'<p class="empty">새로운 도전의 기록을 준비하고 있습니다.</p>';
  $('moreRecords').hidden=items.length<=recordLimit;
}
async function load() {
  failed=[];$('loadState').hidden=true;
  await Promise.all(['settings','players','notices','schedules','records'].map(async name=>{
    try{
      if(name==='settings'){const snap=await getDoc(doc(db,'settings','homepage'));rawSettings=snap.exists()?snap.data():{};}
      else{const snap=await getDocs(collection(db,name));state[name]=snap.docs.map(d=>({...d.data(),id:d.id}));}
    }catch(error){console.error('홈페이지 로딩',name,error);failed.push(name);}
  }));
  applySettings(previewDraft?{...rawSettings,...previewDraft,siteContent:{...rawSettings.siteContent,...previewDraft.siteContent}}:rawSettings);
  renderPlayers();renderSchedules();renderRecords();renderNotices();
  if(failed.length){$('loadState').hidden=false;text('loadStateText','일부 소식을 불러오지 못했습니다. 잠시 후 다시 확인해주세요.');}
  if(preview)window.parent.postMessage({type:'cm-home-preview-ready'},location.origin);
}
$('trialForm').addEventListener('submit',async event=>{
  event.preventDefault();if(submitting)return;
  if(preview){text('trialStatus','미리보기에서는 체험 신청이 접수되지 않습니다.');return;}
  const name=$('trialName').value.trim(),grade=$('trialGrade').value.trim(),phone=$('trialPhone').value.trim(),memo=$('trialMemo').value.trim();
  if(!name||!grade||!phone){text('trialStatus','학생 이름, 학년, 보호자 연락처를 입력해주세요.');return;}
  if(!/^[0-9+()\-\s]{8,24}$/.test(phone)){text('trialStatus','연락 가능한 전화번호를 확인해주세요.');$('trialPhone').focus();return;}
  submitting=true;$('trialSubmit').disabled=true;text('trialStatus','신청을 접수하고 있습니다.');
  try{await addDoc(collection(db,'trials'),{name,grade,phone,memo,createdAt:new Date().toISOString()});$('trialForm').reset();text('trialStatus','체험 신청이 완료되었습니다. 확인 후 연락드리겠습니다.');}
  catch(error){console.error(error);text('trialStatus','신청을 접수하지 못했습니다. 입력 내용은 유지됩니다. 다시 시도하거나 전화로 문의해주세요.');}
  finally{submitting=false;$('trialSubmit').disabled=false;}
});
$('menuToggle').addEventListener('click',()=>{const open=$('siteNavLinks').classList.toggle('open');$('menuToggle').setAttribute('aria-expanded',String(open));});
document.querySelectorAll('.navlinks a').forEach(a=>a.addEventListener('click',()=>{$('siteNavLinks').classList.remove('open');$('menuToggle').setAttribute('aria-expanded','false');}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('siteNavLinks').classList.remove('open');$('menuToggle').setAttribute('aria-expanded','false');}});
document.querySelectorAll('[data-schedule-filter]').forEach(b=>b.addEventListener('click',()=>{scheduleFilter=b.dataset.scheduleFilter;document.querySelectorAll('[data-schedule-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderSchedules();}));
$('scheduleSearch').addEventListener('input',renderSchedules);$('noticeSearch').addEventListener('input',()=>{noticeLimit=6;renderNotices();});
$('moreNotices').addEventListener('click',()=>{noticeLimit+=6;renderNotices();});$('moreRecords').addEventListener('click',()=>{recordLimit+=6;renderRecords();});
$('retryLoad').addEventListener('click',load);$('closePopup').addEventListener('click',()=>$('popupDialog').close());
$('musicBtn').addEventListener('click',async()=>{const bgm=$('bgm');try{if(bgm.paused){await bgm.play();text('musicBtn','노래 일시정지');$('musicBtn').setAttribute('aria-pressed','true');}else{bgm.pause();text('musicBtn','팀 노래 듣기');$('musicBtn').setAttribute('aria-pressed','false');}}catch{ text('musicStatus','음악을 재생하지 못했습니다. 잠시 후 다시 눌러주세요.'); }});
if(preview){
  $('previewBadge').hidden=false;
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='cm-home-preview-v2')return;
    previewDraft=event.data.settings||{};applySettings({...rawSettings,...previewDraft,siteContent:{...rawSettings.siteContent,...previewDraft.siteContent}});
  });
}
applySettings({});
load();
