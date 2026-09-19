import { photoUploadError } from './photo-upload.js?v=3.2.0';
import { resolveSettings, CONTENT_DEFAULTS, escapeHTML as esc, safeURL } from './site-content.js?v=3.3.0';
import { sameSettingsValue as equal } from './settings-compare.js?v=3.1.2';

const field = (key,label,type='text',hint='') => ({key,label,type,hint});
const groups = [
  {id:'main',title:'첫 화면',fields:[field('mainTitle','메인 제목','textarea'),field('mainSubtitle','메인 설명','textarea'),field('teamName','팀 이름'),field('englishName','영문 이름'),field('heroEyebrow','제목 위 작은 문구'),field('heroImage','로고 이미지 주소','image','기존 로고: team-logo.png'),field('heroAlt','로고 설명'),field('primaryLabel','체험 신청 버튼 문구'),field('secondaryLabel','훈련 일정 버튼 문구')]},
  {id:'copy',title:'영역별 문구',fields:[
    ...[['team','선수단'],['overview','요약 소식'],['activity','활동'],['schedule','일정'],['records','대회 기록'],['notices','공지'],['faq','자주 묻는 질문'],['trial','체험 신청']].flatMap(([k,t])=>[field(k+'Title',t+' 제목','textarea'),field(k+'Description',t+' 설명','textarea')]),field('trialIntro','체험 안내','textarea'),field('mapTitle','찾아오시는 길 제목')]},
  {id:'effects',title:'문구 · 효과',fields:[field('marqueeText','중간에 흐르는 문구','text','짧은 문구를 · 로 구분해서 입력하세요.'),field('showMarquee','흐르는 문구 표시','boolean'),field('showEffects','은은한 빛 · 마우스 효과','boolean')]},
  {id:'activities',title:'팀 이야기',fields:[],array:'activities'},
  {id:'faqs',title:'자주 묻는 질문',fields:[],array:'faqs'},
  {id:'coach',title:'코치 · 후원',fields:[field('coachImage','코치 사진','image','사진을 바꾸면 코치 메시지 영역과 큰 화면에 함께 반영됩니다.'),field('coachTitle','지도 방향 제목'),field('coachDescription','지도 방향 설명','textarea'),field('coachName','지도자 이름'),field('coachRole','지도자 소개'),field('messageTitle','코치 인사말 제목'),field('messageBody','코치 인사말','textarea'),field('sponsorName','후원 이름'),field('sponsorDescription','후원 소개','textarea'),field('sponsorImage','후원 로고 주소','image','기존 로고: dreamers-logo.png')],array:'values'},
  {id:'contact',title:'연락처 · 위치',fields:[field('contactAddress','주소'),field('contactPhone','문의 전화번호','tel'),field('contactNote','방문 안내','textarea'),field('mapQuery','지도에서 찾을 장소','text','정확한 장소명 또는 주소를 입력하세요.'),field('mapUrl','네이버 지도 링크','url')]},
  {id:'visibility',title:'공개 영역',fields:[...Object.keys(CONTENT_DEFAULTS).filter(k=>k.startsWith('show')&&!['showMarquee','showEffects'].includes(k)).map(key=>field(key,({showTeam:'선수단',showOverview:'요약 소식',showActivities:'팀 이야기',showSchedules:'훈련 일정',showRecords:'대회 기록',showNotices:'공지사항',showCoach:'코치 · 후원',showMessage:'코치 인사말',showFaq:'자주 묻는 질문',showTrial:'체험 신청',showMap:'찾아오시는 길',showMusic:'팀 노래'})[key],'boolean'))]},
  {id:'popup',title:'팝업 공지',fields:[field('popupEnabled','팝업 사용','boolean'),field('popupImage','팝업 사진','image','사진이 없으면 기존처럼 글만 표시됩니다.'),field('popupTitle','팝업 제목'),field('popupContent','팝업 내용','textarea'),field('popupButtonLabel','바로가기 버튼 문구','text','선택 사항 · 예: 체험 신청 바로가기'),field('popupButtonUrl','바로가기 링크','url','선택 사항 · 예: #trial 또는 https://…')]}
];
const legacy = new Set(['mainTitle','mainSubtitle','popupEnabled','popupImage','popupTitle','popupContent','popupButtonLabel','popupButtonUrl']);
const arrayFields = {
  activities:[field('title','활동 제목'),field('tag','분류'),field('date','날짜'),field('body','내용','textarea'),field('image','대표 사진 · 선택','image','기존 이미지 주소도 사용할 수 있습니다. 선수의 얼굴이 드러나지 않는 사진을 사용하세요.'),field('photos','사진첩 · 최대 10장','photos','추가 사진 주소를 한 줄에 하나씩 입력하거나 아래에서 사진 파일을 선택하세요.'),field('url','관련 링크 · 선택','url'),field('visible','홈페이지에 표시','boolean')],
  faqs:[field('question','질문'),field('answer','답변','textarea'),field('visible','홈페이지에 표시','boolean')],
  values:[field('title','지도 키워드'),field('body','설명','textarea'),field('visible','홈페이지에 표시','boolean')]
};
const arrayNames = {activities:'활동',faqs:'질문',values:'지도 키워드'};
const pathFor = key => legacy.has(key)?key:'siteContent.'+key;
const get = (obj,path) => path.split('.').reduce((o,k)=>o?.[k],obj);
const set = (obj,path,value) => {const keys=path.split('.');let o=obj;for(const k of keys.slice(0,-1))o=o[k]??=( {} );o[keys.at(-1)]=value;};
function normalized(raw){
  const out=resolveSettings(raw);
  for(const [key,fields]of Object.entries(arrayFields))out.siteContent[key]=out.siteContent[key].map((x,i)=>{
    const item={...x,id:x.id||'legacy-'+key+'-'+i};
    for(const f of fields)item[f.key]=f.type==='photos'?(Array.isArray(x[f.key])?x[f.key]:[]):f.type==='boolean'?x[f.key]!==false:x[f.key]??'';
    return item;
  });
  return out;
}
function inputHTML(f,value,attributes,id) {
  const attr=`id="${id}" ${attributes}`,type=f.type,activityPhoto=f.key==='image'||f.key==='photos'||f.key==='coachImage'||f.key==='popupImage';
  const input=type==='photos'?`<textarea ${attr} rows="3" maxlength="20000" placeholder="추가 사진 주소를 한 줄에 하나씩 입력">${esc(Array.isArray(value)?value.join('\n'):value)}</textarea>`:type==='textarea'?`<textarea ${attr} rows="${f.key==='messageBody'?8:3}" maxlength="12000">${esc(value)}</textarea>`:
    type==='boolean'?`<select ${attr}><option value="true" ${value===false?'':'selected'}>표시함</option><option value="false" ${value===false?'selected':''}>표시 안 함</option></select>`:
    `<input ${attr} type="${['url','image'].includes(type)?'text':type}" value="${esc(value)}" maxlength="${['url','image'].includes(type)?1500:500}" ${['url','image'].includes(type)?'placeholder="https://… 또는 기존 이미지 파일명"':''}>`;
  if(activityPhoto){
    const buttonText=type==='photos'?'사진 여러 장 추가':f.key==='coachImage'?'코치 사진 선택':f.key==='popupImage'?'팝업 사진 선택':'대표 사진 선택';
    return `<div class="editorField activityPhotoField"><div class="photoFieldTitle">${esc(f.label)}</div><div class="photoUploadField"><button class="photoUploadButton" type="button" data-open-photo="${id}_upload">${buttonText}</button><input id="${id}_upload" type="file" hidden aria-label="${buttonText} 파일" accept="image/jpeg,image/png,image/webp" ${type==='photos'?'multiple':''} data-photo-target="${id}" data-photo-many="${type==='photos'}"><span class="photoUploadStatus" role="status">버튼을 눌러 휴대폰 또는 컴퓨터의 사진을 선택하세요.</span><div class="photoEditorPreview" data-photo-preview="${id}"></div><p class="photoUploadNote">① 사진 선택 → ② 업로드 완료 확인 → ③ 상단 ‘홈페이지에 저장’<br>JPG·PNG·WebP / 장당 15MB 이하 / 대표 사진 포함 최대 10장<br>공개 가능한 사진만 선택하세요.</p><details class="photoUrlDetails"><summary>사진 주소 직접 입력 · 선택 사항</summary><label for="${id}">${type==='photos'?'추가 사진 주소 · 한 줄에 하나씩':'대표 사진 주소'}</label>${input}${f.hint?`<p class="fieldHint">${esc(f.hint)}</p>`:''}</details></div></div>`;
  }
  return `<div class="editorField"><label for="${id}">${esc(f.label)}</label>${input}${f.hint?`<p class="fieldHint">${esc(f.hint)}</p>`:''}</div>`;
}

export function initSiteEditor({read,write,isSignedIn,notify,uploadPhoto}) {
  const $=id=>document.getElementById(id),root=$('siteEditor');
  let raw={},baseline=normalized(),loaded=false,saving=false,active='main',previewTimer,uploading=false,uploadFailure='';
  const status=message=>{$('editorStatus').textContent=message;};
  function changedPaths(draft=readDraft()) {
    const paths=groups.flatMap(g=>[...g.fields.map(f=>pathFor(f.key)),...(g.array?['siteContent.'+g.array]:[])]);
    return [...new Set(paths)].filter(p=>!equal(get(draft,p),get(baseline,p)));
  }
  function updateStatus() {
    const n=changedPaths().length;
    status(uploading?'사진을 업로드하고 있습니다. 완료될 때까지 기다려주세요.':uploadFailure|| (loaded?(n?`${n}개 항목 수정됨 · 상단 ‘홈페이지에 저장’을 눌러 반영해주세요.`:'저장된 내용과 같습니다.'):'설정을 불러오고 있습니다.'));
    $('editorStatus').dataset.state=uploadFailure?'error':'';
    $('saveSiteContent').disabled=!loaded||saving||uploading||!n;
    $('previewHome').disabled=!loaded||uploading;
    $('editorRefresh').disabled=saving||uploading;
    root.querySelectorAll('[data-editor-tab]').forEach(b=>{const g=groups.find(x=>x.id===b.dataset.editorTab);const dirty=changedPaths().some(p=>g.fields.some(f=>pathFor(f.key)===p)||p==='siteContent.'+g.array);b.classList.toggle('dirty',dirty);});
    clearTimeout(previewTimer);previewTimer=setTimeout(sendPreview,180);
  }
  function renderArray(key,items) {
    $('editorArray_'+key).innerHTML=items.map((item,i)=>`<article class="repeatItem" data-repeat-key="${key}" data-repeat-id="${esc(item.id)}"><div class="repeatHead"><h4>${arrayNames[key]} ${i+1}</h4><div class="repeatActions"><button type="button" data-move="-1" aria-label="${arrayNames[key]} ${i+1} 위로" ${i===0?'disabled':''}>↑</button><button type="button" data-move="1" aria-label="${arrayNames[key]} ${i+1} 아래로" ${i===items.length-1?'disabled':''}>↓</button><button type="button" class="dangerText" data-remove>삭제</button></div></div><div class="editorFields">${arrayFields[key].map((f,j)=>inputHTML(f,item[f.key]??(f.type==='boolean'?true:''),`data-repeat-field="${f.key}"`,'repeat_'+key+'_'+i+'_'+j)).join('')}</div></article>`).join('')||`<p class="editorEmpty">등록된 ${arrayNames[key]}이 없습니다. 아래 버튼으로 추가하세요.</p>`;
  }
  function render() {
    root.inert=!loaded||saving||uploading;
    root.innerHTML=`<div class="editorTabs" role="group" aria-label="홈페이지 편집 영역">${groups.map(g=>`<button type="button" data-editor-tab="${g.id}" aria-pressed="${g.id===active}">${g.title}</button>`).join('')}</div><div class="editorPanels">${groups.map(g=>`<div class="editorPanel" id="editorPanel_${g.id}" ${g.id===active?'':'hidden'}><div class="editorPanelHead"><h3>${g.title}</h3><span>수정한 항목을 한 번에 저장할 수 있습니다.</span></div><div class="editorFields">${g.fields.map(f=>inputHTML(f,get(baseline,pathFor(f.key)),`data-site-path="${pathFor(f.key)}"`,'site_'+f.key)).join('')}</div>${g.array?`<h3 class="repeatTitle">${arrayNames[g.array]} 목록</h3><div id="editorArray_${g.array}"></div><button type="button" class="btn btnDark" data-add="${g.array}">${arrayNames[g.array]} 추가</button>`:''}</div>`).join('')}</div>`;
    for(const g of groups.filter(g=>g.array))renderArray(g.array,baseline.siteContent[g.array]);
    updateStatus();refreshPhotoPreviews();
  }
  function readArray(key) {
    return [...root.querySelectorAll(`[data-repeat-key="${key}"]`)].map(el=>{
      const id=el.dataset.repeatId,item={...(baseline.siteContent[key].find(x=>x.id===id)||{}),id};
      el.querySelectorAll('[data-repeat-field]').forEach(input=>{const key=input.dataset.repeatField;item[key]=key==='visible'?input.value==='true':key==='photos'?input.value.split(/\n/).map(x=>x.trim()).filter(Boolean):input.value;});return item;
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
    if((draft.popupButtonLabel&&!draft.popupButtonUrl)||(!draft.popupButtonLabel&&draft.popupButtonUrl))throw new Error('팝업 바로가기 버튼은 문구와 링크를 함께 입력해주세요.');
    for(const g of groups){
      for(const f of g.fields.filter(f=>['url','image'].includes(f.type))){const v=get(draft,pathFor(f.key));if(v&&!safeURL(v))throw new Error(f.label+'에 올바른 주소를 입력해주세요.');}
      if(g.array)for(const item of draft.siteContent[g.array]){
        const title=item.title??item.question;if(!title?.trim())throw new Error(arrayNames[g.array]+'의 제목 또는 질문을 입력해주세요.');
        for(const k of ['url','image'])if(item[k]&&!safeURL(item[k]))throw new Error(arrayNames[g.array]+'의 이미지 또는 링크 주소를 확인해주세요.');
        if(item.photos?.some(url=>!safeURL(url)))throw new Error('사진첩에 올바른 사진 주소를 입력해주세요.');
        if(new Set([item.image,...(item.photos||[])].filter(Boolean)).size>10)throw new Error('대표 사진을 포함해 한 활동에 10장까지 등록할 수 있습니다.');
      }
    }
  }
  async function load(force=false) {
    if(saving||uploading)return;
    if(loaded&&changedPaths().length){if(!force)return;if(!confirm('저장하지 않은 수정 내용을 버리고 다시 불러올까요?'))return;}
    loaded=false;uploadFailure='';root.inert=true;updateStatus();
    try{raw=await read();baseline=normalized(raw);
      for(const key of Object.keys(arrayFields))baseline.siteContent[key]=baseline.siteContent[key].map((x,i)=>({...x,id:x.id||'legacy-'+key+'-'+i}));
      loaded=true;render();
    }catch(error){status('설정을 불러오지 못했습니다. 새로 불러오기를 눌러주세요.');$('saveSiteContent').disabled=true;$('previewHome').disabled=true;console.error(error);}
  }
  async function save() {
    if(!loaded||saving||uploading||!isSignedIn())return;
    const draft=readDraft(),paths=changedPaths(draft);if(!paths.length)return;
    try{validate(draft);}catch(error){status(error.message);return;}
    saving=true;root.inert=true;$('saveSiteContent').disabled=true;$('editorRefresh').disabled=true;status('홈페이지에 저장하고 있습니다.');
    try{
      const patch=Object.fromEntries(paths.map(p=>[p,get(draft,p)]));
      raw=await write(patch,raw);baseline=normalized(raw);loaded=true;uploadFailure='';render();notify('홈페이지에 반영했습니다.');status('저장 완료 · 홈페이지에 반영했습니다.');sendPreview();
    }catch(error){console.error(error);$('editorStatus').dataset.state='error';status(error.code==='cm/conflict'?'다른 화면에서 같은 항목을 수정했습니다. 사진과 입력 내용은 유지됩니다. 수정 내용을 복사한 뒤 새로 불러와 다시 저장해주세요.':'홈페이지에 저장하지 못했습니다. 사진과 입력 내용은 유지됩니다. 잠시 후 다시 시도해주세요.'+(error.code?' (오류 코드: '+error.code+')':''));}
    finally{saving=false;root.inert=false;$('saveSiteContent').disabled=!loaded||!changedPaths().length;$('editorRefresh').disabled=false;}
  }
  function sendPreview(){if($('homePreview').open&&$('homePreviewFrame').contentWindow)$('homePreviewFrame').contentWindow.postMessage({type:'cm-home-preview-v2',settings:readDraft()},location.origin);}
  function refreshPhotoPreviews() {
    root.querySelectorAll('[data-photo-preview]').forEach(preview=>{
      const input=$(preview.dataset.photoPreview);if(!input)return;
      const urls=(input.dataset.repeatField==='photos'?input.value.split(/\n/):[input.value]).map(url=>safeURL(url.trim())).filter(Boolean);
      preview.innerHTML=urls.map((url,i)=>`<div class="photoEditorThumb"><img src="${esc(url)}" alt="선택한 사진 ${i+1} 미리보기"><span>${i+1}</span><button type="button" data-remove-photo="${i}" data-photo-input="${input.id}" aria-label="사진 ${i+1} 제외">×</button></div>`).join('');
    });
  }
  root.addEventListener('input',()=>{updateStatus();refreshPhotoPreviews();});
  root.addEventListener('change',async event=>{
    const picker=event.target.closest('[data-photo-target]');
    if(!picker){updateStatus();refreshPhotoPreviews();return;}
    const files=[...picker.files],target=$(picker.dataset.photoTarget),many=picker.dataset.photoMany==='true';
    const message=picker.closest('.photoUploadField').querySelector('.photoUploadStatus');
    picker.value='';if(!files.length||uploading)return;
    if(!isSignedIn()){message.textContent='관리자 로그인 후 이용해주세요.';return;}
    if(typeof uploadPhoto!=='function'){message.textContent='사진 업로드 연결을 확인해주세요.';return;}
    const previous=many?target.value.split(/\n/).map(x=>x.trim()).filter(Boolean):[];
    const cover=picker.closest('[data-repeat-key]')?.querySelector('[data-repeat-field="image"]')?.value;
    if(many&&new Set([...previous,cover].filter(Boolean)).size+files.length>10){message.textContent='대표 사진을 포함해 한 활동에 최대 10장까지 올릴 수 있습니다.';return;}
    uploading=true;uploadFailure='';message.dataset.state='uploading';root.inert=true;updateStatus();
    let completed=0;
    try{
      for(const file of (many?files:files.slice(0,1))){
        message.textContent=`사진 ${completed+1}/${files.length} 준비 중…`;
        const url=await uploadPhoto(file,percent=>{message.textContent=`사진 ${completed+1}/${files.length} 업로드 ${percent}%`;});
        if(!isSignedIn())throw new Error('로그인이 만료되었습니다. 다시 로그인해주세요.');
        completed++;
        if(many){previous.push(url);target.value=previous.join('\n');}else target.value=url;
        refreshPhotoPreviews();
      }
      message.dataset.state='success';message.textContent=`${completed}장 업로드 완료. 상단 ‘홈페이지에 저장’을 눌러 반영해주세요.`;
    }catch(error){message.dataset.state='error';uploadFailure=(completed?`${completed}장은 업로드되었습니다. `:'사진 업로드 실패 · ')+photoUploadError(error)+(error?.code?' (오류 코드: '+error.code+')':'');message.textContent=uploadFailure;}
    finally{uploading=false;root.inert=!loaded;$('editorRefresh').disabled=false;updateStatus();}
  });
  root.addEventListener('click',event=>{
    const pickerButton=event.target.closest('[data-open-photo]');
    if(pickerButton&&!saving&&!uploading){$(pickerButton.dataset.openPhoto)?.click();return;}
    const button=event.target.closest('[data-remove-photo]');if(!button||saving||uploading)return;
    const input=$(button.dataset.photoInput);if(!input)return;
    if(input.dataset.repeatField==='photos'){const urls=input.value.split(/\n/).map(x=>x.trim()).filter(Boolean);urls.splice(Number(button.dataset.removePhoto),1);input.value=urls.join('\n');}
    else input.value='';
    refreshPhotoPreviews();updateStatus();
  });
  root.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b||saving||uploading)return;
    if(b.dataset.editorTab){active=b.dataset.editorTab;root.querySelectorAll('[data-editor-tab]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));root.querySelectorAll('.editorPanel').forEach(x=>x.hidden=x.id!=='editorPanel_'+active);}
    if(b.dataset.add){const key=b.dataset.add,items=readArray(key);items.push({id:crypto.randomUUID(),visible:true});renderArray(key,items);refreshPhotoPreviews();updateStatus();$('editorArray_'+key).lastElementChild.querySelector('input')?.focus();}
    const row=b.closest('[data-repeat-key]');if(!row)return;
    const key=row.dataset.repeatKey,items=readArray(key),index=items.findIndex(x=>x.id===row.dataset.repeatId);
    if(b.hasAttribute('data-remove')){if(!confirm('이 '+arrayNames[key]+'을 목록에서 삭제할까요? 저장하기 전까지 홈페이지는 그대로 유지됩니다.'))return;items.splice(index,1);renderArray(key,items);refreshPhotoPreviews();updateStatus();}
    if(b.hasAttribute('data-move')){const to=index+Number(b.dataset.move);if(to>=0&&to<items.length){[items[index],items[to]]=[items[to],items[index]];renderArray(key,items);refreshPhotoPreviews();updateStatus();}}
  });
  $('saveSiteContent').addEventListener('click',save);$('editorRefresh').addEventListener('click',()=>load(true));
  $('previewHome').addEventListener('click',()=>{if(!loaded)return;const frame=$('homePreviewFrame');if(!frame.getAttribute('src'))frame.src='index.html?preview=1';$('homePreview').showModal();sendPreview();});
  $('closeHomePreview').addEventListener('click',()=>$('homePreview').close());
  document.querySelectorAll('[data-preview-width]').forEach(b=>b.addEventListener('click',()=>{$('homePreviewFrame').style.maxWidth=b.dataset.previewWidth;document.querySelectorAll('[data-preview-width]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}));
  window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===$('homePreviewFrame').contentWindow&&event.data?.type==='cm-home-preview-ready')sendPreview();});
  window.addEventListener('beforeunload',event=>{if(uploading||(loaded&&changedPaths().length)){event.preventDefault();event.returnValue='';}});
  render();
  return {load,save,hasUnsaved:()=>loaded&&changedPaths().length>0,reset:()=>{raw={};baseline=normalized();loaded=false;uploadFailure='';render();if($('homePreview').open)$('homePreview').close();$('homePreviewFrame').removeAttribute('src');}};
}

export function initAdminNavigation() {
  const sections=[...document.querySelectorAll('main.wrap > section')],links=[...document.querySelectorAll('.nav a[href^="#"]')];
  function navigate(){const id=location.hash.slice(1)||'dashboard',target=sections.some(s=>s.id===id)?id:'dashboard';sections.forEach(s=>s.hidden=s.id!==target);links.forEach(a=>{const active=a.getAttribute('href')==='#'+target;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});const title=document.querySelector('#'+target+' h2, #'+target+' h1');document.getElementById('currentPanelName').textContent=target==='dashboard'?'오늘의 청명':title?.textContent.trim()||'관리자';window.scrollTo(0,0);}
  window.addEventListener('hashchange',navigate);navigate();
}
