import { resolveSettings, CONTENT_DEFAULTS, escapeHTML as esc, safeURL } from './site-content.js?v=2.1.2';

const field = (key,label,type='text',hint='') => ({key,label,type,hint});
const groups = [
  {id:'main',title:'첫 화면',fields:[field('mainTitle','메인 제목','textarea'),field('mainSubtitle','메인 설명','textarea'),field('teamName','팀 이름'),field('englishName','영문 이름'),field('heroEyebrow','제목 위 작은 문구'),field('heroImage','로고 이미지 주소','image','기존 로고: team-logo.png'),field('heroAlt','로고 설명'),field('primaryLabel','체험 신청 버튼 문구'),field('secondaryLabel','훈련 일정 버튼 문구')]},
  {id:'copy',title:'영역별 문구',fields:[
    ...[['team','선수단'],['overview','요약 소식'],['activity','활동'],['schedule','일정'],['records','대회 기록'],['notices','공지'],['faq','자주 묻는 질문'],['trial','체험 신청']].flatMap(([k,t])=>[field(k+'Title',t+' 제목'),field(k+'Description',t+' 설명','textarea')]),field('trialIntro','체험 안내','textarea'),field('mapTitle','찾아오시는 길 제목')]},
  {id:'effects',title:'문구 · 효과',fields:[field('marqueeText','중간에 흐르는 문구','text','짧은 문구를 · 로 구분해서 입력하세요.'),field('showMarquee','흐르는 문구 표시','boolean'),field('showEffects','은은한 빛 · 마우스 효과','boolean')]},
  {id:'activities',title:'팀 이야기',fields:[],array:'activities'},
  {id:'faqs',title:'자주 묻는 질문',fields:[],array:'faqs'},
  {id:'coach',title:'코치 · 후원',fields:[field('coachTitle','지도 방향 제목'),field('coachDescription','지도 방향 설명','textarea'),field('coachName','지도자 이름'),field('coachRole','지도자 소개'),field('messageTitle','코치 인사말 제목'),field('messageBody','코치 인사말','textarea'),field('sponsorName','후원 이름'),field('sponsorDescription','후원 소개','textarea'),field('sponsorImage','후원 로고 주소','image','기존 로고: dreamers-logo.png')],array:'values'},
  {id:'contact',title:'연락처 · 위치',fields:[field('contactAddress','주소'),field('contactPhone','문의 전화번호','tel'),field('contactNote','방문 안내','textarea'),field('mapQuery','지도에서 찾을 장소','text','정확한 장소명 또는 주소를 입력하세요.'),field('mapUrl','네이버 지도 링크','url')]},
  {id:'visibility',title:'공개 영역',fields:[...Object.keys(CONTENT_DEFAULTS).filter(k=>k.startsWith('show')&&!['showMarquee','showEffects'].includes(k)).map(key=>field(key,({showTeam:'선수단',showOverview:'요약 소식',showActivities:'팀 이야기',showSchedules:'훈련 일정',showRecords:'대회 기록',showNotices:'공지사항',showCoach:'코치 · 후원',showMessage:'코치 인사말',showFaq:'자주 묻는 질문',showTrial:'체험 신청',showMap:'찾아오시는 길',showMusic:'팀 노래'})[key],'boolean'))]},
  {id:'popup',title:'팝업 공지',fields:[field('popupEnabled','팝업 사용','boolean'),field('popupTitle','팝업 제목'),field('popupContent','팝업 내용','textarea')]}
];
const legacy = new Set(['mainTitle','mainSubtitle','popupEnabled','popupTitle','popupContent']);
const arrayFields = {
  activities:[field('title','활동 제목'),field('tag','분류'),field('date','날짜'),field('body','내용','textarea'),field('image','이미지 주소 · 선택','image','선수의 얼굴이 드러나지 않는 이미지를 사용하세요.'),field('url','관련 링크 · 선택','url'),field('visible','홈페이지에 표시','boolean')],
  faqs:[field('question','질문'),field('answer','답변','textarea'),field('visible','홈페이지에 표시','boolean')],
  values:[field('title','지도 키워드'),field('body','설명','textarea'),field('visible','홈페이지에 표시','boolean')]
};
const arrayNames = {activities:'활동',faqs:'질문',values:'지도 키워드'};
const pathFor = key => legacy.has(key)?key:'siteContent.'+key;
const get = (obj,path) => path.split('.').reduce((o,k)=>o?.[k],obj);
const set = (obj,path,value) => {const keys=path.split('.');let o=obj;for(const k of keys.slice(0,-1))o=o[k]??=( {} );o[keys.at(-1)]=value;};
const equal = (a,b) => JSON.stringify(a)===JSON.stringify(b);
function normalized(raw){const out=resolveSettings(raw);for(const key of Object.keys(arrayFields))out.siteContent[key]=out.siteContent[key].map((x,i)=>({...x,id:x.id||'legacy-'+key+'-'+i}));return out;}
function inputHTML(f,value,attributes,id) {
  const attr=`id="${id}" ${attributes}`,type=f.type;
  const input=type==='textarea'?`<textarea ${attr} rows="${f.key==='messageBody'?8:3}" maxlength="12000">${esc(value)}</textarea>`:
    type==='boolean'?`<select ${attr}><option value="true" ${value===false?'':'selected'}>표시함</option><option value="false" ${value===false?'selected':''}>표시 안 함</option></select>`:
    `<input ${attr} type="${['url','image'].includes(type)?'text':type}" value="${esc(value)}" maxlength="${['url','image'].includes(type)?1500:500}" ${['url','image'].includes(type)?'placeholder="https://… 또는 기존 이미지 파일명"':''}>`;
  return `<div class="editorField"><label for="${id}">${esc(f.label)}</label>${input}${f.hint?`<p class="fieldHint">${esc(f.hint)}</p>`:''}</div>`;
}

export function initSiteEditor({read,write,isSignedIn,notify}) {
  const $=id=>document.getElementById(id),root=$('siteEditor');
  let raw={},baseline=normalized(),loaded=false,saving=false,active='main',previewTimer;
  const status=message=>{$('editorStatus').textContent=message;};
  function changedPaths(draft=readDraft()) {
    const paths=groups.flatMap(g=>[...g.fields.map(f=>pathFor(f.key)),...(g.array?['siteContent.'+g.array]:[])]);
    return [...new Set(paths)].filter(p=>!equal(get(draft,p),get(baseline,p)));
  }
  function updateStatus() {
    const n=changedPaths().length;
    status(loaded?(n?`${n}개 항목 수정됨 · 아직 홈페이지에 반영되지 않았습니다.`:'저장된 내용과 같습니다.'):'설정을 불러오고 있습니다.');
    $('saveSiteContent').disabled=!loaded||saving||!n;
    $('previewHome').disabled=!loaded;
    $('editorRefresh').disabled=saving;
    root.querySelectorAll('[data-editor-tab]').forEach(b=>{const g=groups.find(x=>x.id===b.dataset.editorTab);const dirty=changedPaths().some(p=>g.fields.some(f=>pathFor(f.key)===p)||p==='siteContent.'+g.array);b.classList.toggle('dirty',dirty);});
    clearTimeout(previewTimer);previewTimer=setTimeout(sendPreview,180);
  }
  function renderArray(key,items) {
    $('editorArray_'+key).innerHTML=items.map((item,i)=>`<article class="repeatItem" data-repeat-key="${key}" data-repeat-id="${esc(item.id)}"><div class="repeatHead"><h4>${arrayNames[key]} ${i+1}</h4><div class="repeatActions"><button type="button" data-move="-1" aria-label="${arrayNames[key]} ${i+1} 위로" ${i===0?'disabled':''}>↑</button><button type="button" data-move="1" aria-label="${arrayNames[key]} ${i+1} 아래로" ${i===items.length-1?'disabled':''}>↓</button><button type="button" class="dangerText" data-remove>삭제</button></div></div><div class="editorFields">${arrayFields[key].map((f,j)=>inputHTML(f,item[f.key]??(f.type==='boolean'?true:''),`data-repeat-field="${f.key}"`,'repeat_'+key+'_'+i+'_'+j)).join('')}</div></article>`).join('')||`<p class="editorEmpty">등록된 ${arrayNames[key]}이 없습니다. 아래 버튼으로 추가하세요.</p>`;
  }
  function render() {
    root.inert=!loaded||saving;
    root.innerHTML=`<div class="editorTabs" role="group" aria-label="홈페이지 편집 영역">${groups.map(g=>`<button type="button" data-editor-tab="${g.id}" aria-pressed="${g.id===active}">${g.title}</button>`).join('')}</div><div class="editorPanels">${groups.map(g=>`<div class="editorPanel" id="editorPanel_${g.id}" ${g.id===active?'':'hidden'}><div class="editorPanelHead"><h3>${g.title}</h3><span>수정한 항목을 한 번에 저장할 수 있습니다.</span></div><div class="editorFields">${g.fields.map(f=>inputHTML(f,get(baseline,pathFor(f.key)),`data-site-path="${pathFor(f.key)}"`,'site_'+f.key)).join('')}</div>${g.array?`<h3 class="repeatTitle">${arrayNames[g.array]} 목록</h3><div id="editorArray_${g.array}"></div><button type="button" class="btn btnDark" data-add="${g.array}">${arrayNames[g.array]} 추가</button>`:''}</div>`).join('')}</div>`;
    for(const g of groups.filter(g=>g.array))renderArray(g.array,baseline.siteContent[g.array]);
    updateStatus();
  }
  function readArray(key) {
    return [...root.querySelectorAll(`[data-repeat-key="${key}"]`)].map(el=>{
      const id=el.dataset.repeatId,item={...(baseline.siteContent[key].find(x=>x.id===id)||{}),id};
      el.querySelectorAll('[data-repeat-field]').forEach(input=>{const key=input.dataset.repeatField;item[key]=key==='visible'?input.value==='true':input.value;});return item;
    });
  }
  function readDraft() {
    const draft=structuredClone(baseline);
    root.querySelectorAll('[data-site-path]').forEach(input=>{const path=input.dataset.sitePath,boolean=path==='popupEnabled'||path.startsWith('siteContent.show');set(draft,path,boolean?input.value==='true':input.value);});
    for(const g of groups.filter(g=>g.array))if($('editorArray_'+g.array))draft.siteContent[g.array]=readArray(g.array);
    return draft;
  }
  function validate(draft) {
    if(!draft.mainTitle.trim())throw new Error('첫 화면의 메인 제목을 입력해주세요.');
    if(draft.popupEnabled&&(!draft.popupTitle.trim()||!draft.popupContent.trim()))throw new Error('팝업 제목과 내용을 입력해주세요.');
    for(const g of groups){
      for(const f of g.fields.filter(f=>['url','image'].includes(f.type))){const v=get(draft,pathFor(f.key));if(v&&!safeURL(v))throw new Error(f.label+'에 올바른 주소를 입력해주세요.');}
      if(g.array)for(const item of draft.siteContent[g.array]){
        const title=item.title??item.question;if(!title?.trim())throw new Error(arrayNames[g.array]+'의 제목 또는 질문을 입력해주세요.');
        for(const k of ['url','image'])if(item[k]&&!safeURL(item[k]))throw new Error(arrayNames[g.array]+'의 이미지 또는 링크 주소를 확인해주세요.');
      }
    }
  }
  async function load(force=false) {
    if(saving)return;
    if(loaded&&changedPaths().length){if(!force)return;if(!confirm('저장하지 않은 수정 내용을 버리고 다시 불러올까요?'))return;}
    loaded=false;root.inert=true;updateStatus();
    try{raw=await read();baseline=normalized(raw);
      for(const key of Object.keys(arrayFields))baseline.siteContent[key]=baseline.siteContent[key].map((x,i)=>({...x,id:x.id||'legacy-'+key+'-'+i}));
      loaded=true;render();
    }catch(error){status('설정을 불러오지 못했습니다. 새로 불러오기를 눌러주세요.');$('saveSiteContent').disabled=true;$('previewHome').disabled=true;console.error(error);}
  }
  async function save() {
    if(!loaded||saving||!isSignedIn())return;
    const draft=readDraft(),paths=changedPaths(draft);if(!paths.length)return;
    try{validate(draft);}catch(error){status(error.message);return;}
    saving=true;root.inert=true;$('saveSiteContent').disabled=true;$('editorRefresh').disabled=true;status('홈페이지에 저장하고 있습니다.');
    try{
      const patch=Object.fromEntries(paths.map(p=>[p,get(draft,p)]));
      raw=await write(patch,raw);baseline=normalized(raw);loaded=true;render();notify('홈페이지에 반영했습니다.');status('저장 완료 · 홈페이지에 반영했습니다.');sendPreview();
    }catch(error){console.error(error);status(error.code==='cm/conflict'?'다른 화면에서 같은 항목을 수정했습니다. 입력 내용은 유지됩니다. 수정 내용을 복사한 뒤 새로 불러와 다시 저장해주세요.':'저장하지 못했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 시도해주세요.');}
    finally{saving=false;root.inert=false;$('saveSiteContent').disabled=!loaded||!changedPaths().length;$('editorRefresh').disabled=false;}
  }
  function sendPreview(){if($('homePreview').open&&$('homePreviewFrame').contentWindow)$('homePreviewFrame').contentWindow.postMessage({type:'cm-home-preview-v2',settings:readDraft()},location.origin);}
  root.addEventListener('input',updateStatus);root.addEventListener('change',updateStatus);
  root.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b||saving)return;
    if(b.dataset.editorTab){active=b.dataset.editorTab;root.querySelectorAll('[data-editor-tab]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));root.querySelectorAll('.editorPanel').forEach(x=>x.hidden=x.id!=='editorPanel_'+active);}
    if(b.dataset.add){const key=b.dataset.add,items=readArray(key);items.push({id:crypto.randomUUID(),visible:true});renderArray(key,items);updateStatus();$('editorArray_'+key).lastElementChild.querySelector('input')?.focus();}
    const row=b.closest('[data-repeat-key]');if(!row)return;
    const key=row.dataset.repeatKey,items=readArray(key),index=items.findIndex(x=>x.id===row.dataset.repeatId);
    if(b.hasAttribute('data-remove')){if(!confirm('이 '+arrayNames[key]+'을 목록에서 삭제할까요? 저장하기 전까지 홈페이지는 그대로 유지됩니다.'))return;items.splice(index,1);renderArray(key,items);updateStatus();}
    if(b.hasAttribute('data-move')){const to=index+Number(b.dataset.move);if(to>=0&&to<items.length){[items[index],items[to]]=[items[to],items[index]];renderArray(key,items);updateStatus();}}
  });
  $('saveSiteContent').addEventListener('click',save);$('editorRefresh').addEventListener('click',()=>load(true));
  $('previewHome').addEventListener('click',()=>{if(!loaded)return;const frame=$('homePreviewFrame');if(!frame.getAttribute('src'))frame.src='index.html?preview=1';$('homePreview').showModal();sendPreview();});
  $('closeHomePreview').addEventListener('click',()=>$('homePreview').close());
  document.querySelectorAll('[data-preview-width]').forEach(b=>b.addEventListener('click',()=>{$('homePreviewFrame').style.maxWidth=b.dataset.previewWidth;document.querySelectorAll('[data-preview-width]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}));
  window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===$('homePreviewFrame').contentWindow&&event.data?.type==='cm-home-preview-ready')sendPreview();});
  window.addEventListener('beforeunload',event=>{if(loaded&&changedPaths().length){event.preventDefault();event.returnValue='';}});
  render();
  return {load,save,hasUnsaved:()=>loaded&&changedPaths().length>0,reset:()=>{raw={};baseline=normalized();loaded=false;render();if($('homePreview').open)$('homePreview').close();$('homePreviewFrame').removeAttribute('src');}};
}

export function initAdminNavigation() {
  const sections=[...document.querySelectorAll('main.wrap > section')],links=[...document.querySelectorAll('.nav a[href^="#"]')];
  function navigate(){const id=location.hash.slice(1)||'dashboard',target=sections.some(s=>s.id===id)?id:'dashboard';sections.forEach(s=>s.hidden=s.id!==target);links.forEach(a=>{const active=a.getAttribute('href')==='#'+target;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});const title=document.querySelector('#'+target+' h2, #'+target+' h1');document.getElementById('currentPanelName').textContent=target==='dashboard'?'오늘의 청명':title?.textContent.trim()||'관리자';window.scrollTo(0,0);}
  window.addEventListener('hashchange',navigate);navigate();
}
