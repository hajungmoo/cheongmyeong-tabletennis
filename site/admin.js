import { initSiteEditor, initAdminNavigation } from './admin-editor.js?v=2.0.0';
import {
  initializeApp
}
from
"https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  runTransaction
}
from
"https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
}
from
"https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
const firebaseConfig={
  apiKey:
  "AIzaSyCbZ9CUf_hJRAKs2T7MYK7Z4YBNjn7p9pI",
  authDomain:
  "cheongmyeong-tabletennis.firebaseapp.com",
  projectId:
  "cheongmyeong-tabletennis",
  storageBucket:
  "cheongmyeong-tabletennis.firebasestorage.app",
  messagingSenderId:
  "712801821489",
  appId:
  "1:712801821489:web:501d20626d8cd12dc98610"
};
const app=
initializeApp(
  firebaseConfig
);
const db=
getFirestore(app);
const auth=
getAuth(app);
const $=
id=>
document.getElementById(id);
/* ================================
기본 선수 명단
================================ */
const officialPlayers=[
   {name:"팡제이", grade:"6학년", style:"청명초 선수", order:1},
  {name:"강다윤", grade:"6학년", style:"청명초 선수", order:2},
  {name:"이수빈", grade:"5학년", style:"청명초 선수", order:3},
  {name:"이효은", grade:"5학년", style:"청명초 선수", order:4},
  {name:"천윤슬", grade:"3학년", style:"청명초 선수", order:5},
  {name:"서예은", grade:"3학년", style:"청명초 선수", order:6},
  {name:"양하은", grade:"2학년", style:"청명초 선수", order:7},
  {name:"임수아", grade:"1학년", style:"청명초 선수", order:8}
];
/* ================================
캐시
================================ */
const cache={
  notices:[],
  schedules:[],
  players:[],
  records:[],
  trials:[],
  dailyStatus:[]
};
const fields={
  notices:[
    "title",
    "date",
    "content",
    "pinned",
    "order"
  ],
  schedules:[
    "day",
    "startDate",
    "endDate",
    "title",
    "time",
    "memo",
    "order"
  ],
  players:[
    "name",
    "grade",
    "style",
    "award",
    "hidden",
    "order"
  ],
  records:[
    "title",
    "year",
    "result",
    "memo",
    "order"
  ]
};
/* ================================
공통 함수
================================ */
function esc(value=""){
  return String(value)
  .replace(
    /[&<>'"]/g,
    m=>({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      "'":"&#39;",
      '"':"&quot;"
    }[m])
  );
}
function maskName(name=""){
  const s=
  String(name).trim();
  if(!s)
  return "청명 선수";
  if(s.includes("○"))
  return s;
  if(s.length===1)
  return s+"○";
  if(s.length===2)
  return s[0]+"○";
  return (
    s[0]
    +
    "○"
    +
    s[s.length-1]
  );
}
function playerKey(name=""){
  const s=
  String(name)
  .replace(/\s/g,"")
  .replace(/○/g,"");
  if(!s)
  return "";
  if(s.length>=3){
    return (
      s[0]
      +
      s[s.length-1]
    );
  }
  return s;
}
function num(value){
  if(
    value===""
    ||
    value===null
    ||
    value===undefined
  ){
    return 999;
  }
  return Number(value);
}
function sortData(arr){
  return [...arr]
  .sort(
    (a,b)=>
    (a.order??999)
    -
    (b.order??999)
    ||
    String(
      b.createdAt
      ??
      b.date
      ??
      ""
    )
    .localeCompare(
      String(
        a.createdAt
        ??
        a.date
        ??
        ""
      )
    )
  );
}
function todayKey(){
  const d=
  new Date();
  return (
    d.getFullYear()
    +
    "-"
    +
    String(
      d.getMonth()+1
    )
    .padStart(
      2,
      "0"
    )
    +
    "-"
    +
    String(
      d.getDate()
    )
    .padStart(
      2,
      "0"
    )
  );
}
function toast(message){
  const t=
  $("toast");
  t.textContent=
  message;
  t.classList.add(
    "show"
  );
  setTimeout(
    ()=>{
      t.classList.remove(
        "show"
      );
    },
    1900
  );
}
async function docsOf(name){
  const snapshot=
  await getDocs(
    collection(
      db,
      name
    )
  );
  return snapshot.docs.map(
    d=>({
      id:d.id,
      ...d.data()
    })
  );
}
/* ================================
로그인
================================ */
window.loginAdmin=async function(){
  const button=$('loginButton');if(button.disabled)return;
  button.disabled=true;button.textContent='로그인 중…';$('loginStatus').textContent='';
  try{await signInWithEmailAndPassword(auth,$('loginEmail').value.trim(),$('loginPw').value);}
  catch(error){console.error(error);$('loginStatus').textContent='로그인하지 못했습니다. 이메일, 비밀번호 또는 연결 상태를 확인해주세요.';}
  finally{button.disabled=false;button.textContent='관리자 로그인';}
};
$('loginForm').addEventListener('submit',event=>{event.preventDefault();window.loginAdmin();});
window.logoutAdmin=
async function(){
  if(siteEditor.hasUnsaved()&&!confirm("저장하지 않은 홈페이지 수정 내용이 있습니다. 로그아웃할까요?"))return;
  await signOut(auth);
};
/* ================================
현재 날짜 / 시간
================================ */
function updateClock(){
  const d=
  new Date();
  $("todayText").textContent=
  new Intl.DateTimeFormat(
    "ko-KR",
    {
      year:"numeric",
      month:"long",
      day:"numeric",
      weekday:"short"
    }
  )
  .format(d);
  $("clockText").textContent=
  d.toLocaleTimeString(
    "ko-KR",
    {
      hour:"2-digit",
      minute:"2-digit"
    }
  );
}
updateClock();
setInterval(
  updateClock,
  1000
);
/* ================================
기본 선수 명단 확인
================================ */
window.syncOfficialPlayers=
async function(){
  if(!auth.currentUser || !confirm('기본 명단의 선수를 확인해 빠진 선수만 추가하고 정렬 순서를 맞출까요? 기존 선수와 기록은 삭제하지 않습니다.'))return;
  try{
    const current=
    await docsOf(
      "players"
    );
    let added=0;
    let updated=0;
    for(
      const base
      of officialPlayers
    ){
      const found=
      current.find(
        p=>
        playerKey(p.name)
        ===
        playerKey(base.name)
      );
      if(found){
        const patch={
          order:
          base.order,
          updatedAt:
          serverTimestamp()
        };
        if(!found.grade){
          patch.grade=
          base.grade;
        }
        if(!found.style){
          patch.style=
          base.style;
        }
        await updateDoc(
          doc(
            db,
            "players",
            found.id
          ),
          patch
        );
        updated++;
      }
      else{
        await addDoc(
          collection(
            db,
            "players"
          ),
          {
            name:
            base.name,
            grade:
            base.grade,
            style:
            base.style,
            award:
            base.award || "",
            order:
            base.order,
            createdAt:
            new Date().toISOString(),
            updatedAt:
            serverTimestamp()
          }
        );
        added++;
      }
    }
    await loadList(
      "players"
    );
    await loadDailyStatus();
    alert(
      "기본 명단 기준으로 정리했습니다.\n\n"
      +
      `기존 선수 확인 : ${updated}명\n`
      +
      `새로 추가 : ${added}명\n\n`
      +
      "기존 수상기록과 선수 정보는 삭제하지 않았습니다."
    );
    toast(
      "기본 선수 명단 확인 완료"
    );
  }
  catch(error){
    console.error(error);
    alert(
      "선수 자동 등록 중 오류가 발생했습니다.\n\n"
      +
      error.message
    );
  }
};
/* ================================
홈페이지 설정
================================ */
const siteEditor=initSiteEditor({
  isSignedIn:()=>!!auth.currentUser,
  notify:toast,
  read:async()=>{const snap=await getDoc(doc(db,'settings','homepage'));return snap.exists()?snap.data():{};},
  write:async(patch,baseline)=>{
    if(!auth.currentUser)throw new Error('로그인이 필요합니다.');
    const ref=doc(db,'settings','homepage');
    return runTransaction(db,async transaction=>{
      const snap=await transaction.get(ref),current=snap.exists()?snap.data():{};
      const value=(o,path)=>path.split('.').reduce((v,k)=>v?.[k],o);
      for(const path of Object.keys(patch))if(JSON.stringify(value(current,path))!==JSON.stringify(value(baseline,path))){const error=new Error('다른 화면에서 같은 항목이 변경되었습니다.');error.code='cm/conflict';throw error;}
      const next={...current,siteContent:{...current.siteContent}},nested={};
      for(const [path,val] of Object.entries(patch)){
        if(path.startsWith('siteContent.')){next.siteContent[path.slice(12)]=val;(nested.siteContent??={})[path.slice(12)]=val;}
        else{next[path]=val;nested[path]=val;}
      }
      if(snap.exists())transaction.update(ref,{...patch,updatedAt:serverTimestamp()});
      else transaction.set(ref,{...nested,updatedAt:serverTimestamp()},{merge:true});
      return next;
    });
  }
});
async function loadSettings(){await siteEditor.load();}
window.saveSettings=()=>siteEditor.save();
initAdminNavigation();

/* ================================
훈련 일정 시간 선택
================================ */
function fillTimeSelect(id,max){
  const element=
  $(id);
  if(!element)
  return;
  let html=
  '<option value="">--</option>';
  for(
    let i=0;
    i<=max;
    i++
  ){
    const value=
    String(i)
    .padStart(
      2,
      "0"
    );
    html+=
    `<option value="${value}">${value}</option>`;
  }
  element.innerHTML=
  html;
}
function initScheduleTimeSelectors(){
  fillTimeSelect(
    "schedules_start_hour",
    23
  );
  fillTimeSelect(
    "schedules_start_minute",
    59
  );
  fillTimeSelect(
    "schedules_end_hour",
    23
  );
  fillTimeSelect(
    "schedules_end_minute",
    59
  );
}
function selectedTime(prefix){
  const hour=
  $(prefix+"_hour")?.value
  ||
  "";
  const minute=
  $(prefix+"_minute")?.value
  ||
  "";
  if(
    hour===""
    ||
    minute===""
  ){
    return "";
  }
  return (
    hour
    +
    ":"
    +
    minute
  );
}
function syncScheduleTime(){
  const start=
  selectedTime(
    "schedules_start"
  );
  const end=
  selectedTime(
    "schedules_end"
  );
  let value="";
  if(
    start
    &&
    end
  ){
    value=
    start
    +
    " ~ "
    +
    end;
  }
  $("schedules_time").value=
  value;
  const preview=
  $("scheduleTimePreview");
  if(preview){
    preview.innerHTML=
    '선택된 시간 · <b>'
    +
    (
      start
      ||
      "--:--"
    )
    +
    " ~ "
    +
    (
      end
      ||
      "--:--"
    )
    +
    "</b>";
  }
}
window.syncScheduleTime=
syncScheduleTime;
function setTimeSelectValue(prefix,timeValue=""){
  const match=
  String(timeValue)
  .trim()
  .match(
    /^(\d{1,2}):(\d{2})$/
  );
  const hourElement=
  $(prefix+"_hour");
  const minuteElement=
  $(prefix+"_minute");
  if(
    !hourElement
    ||
    !minuteElement
  ){
    return;
  }
  if(!match){
    hourElement.value="";
    minuteElement.value="";
    return;
  }
  hourElement.value=
  String(
    Number(match[1])
  )
  .padStart(
    2,
    "0"
  );
  minuteElement.value=
  String(
    Number(match[2])
  )
  .padStart(
    2,
    "0"
  );
}
function loadScheduleTimeControls(savedTime=""){
  const value=
  String(savedTime)
  .trim();
  let start="";
  let end="";
  if(
    value.includes("~")
  ){
    const parts=
    value.split("~");
    start=
    (
      parts[0]
      ||
      ""
    )
    .trim();
    end=
    (
      parts[1]
      ||
      ""
    )
    .trim();
  }
  else if(value){
    start=
    value;
  }
  setTimeSelectValue(
    "schedules_start",
    start
  );
  setTimeSelectValue(
    "schedules_end",
    end
  );
  syncScheduleTime();
}
function clearScheduleTimeControls(){
  [
    "schedules_start_hour",
    "schedules_start_minute",
    "schedules_end_hour",
    "schedules_end_minute"
  ]
  .forEach(
    id=>{
      const element=
      $(id);
      if(element){
        element.value="";
      }
    }
  );
  const hidden=
  $("schedules_time");
  if(hidden){
    hidden.value="";
  }
  syncScheduleTime();
}
initScheduleTimeSelectors();
/* ================================
일반 데이터 저장
================================ */
const pendingItems=new Set();
window.saveItem=
async function(type){
  if(!auth.currentUser || !fields[type] || pendingItems.has(type))return;
  pendingItems.add(type);
  try{
    if(
      type==="schedules"
    ){
      syncScheduleTime();
      if(
        !$("schedules_time").value
      ){
        alert(
          "시작 시간과 종료 시간을 모두 선택해주세요."
        );
        return;
      }
    }
    const id=
    $(type+"_id").value;
    const data={
      updatedAt:
      serverTimestamp()
    };
    fields[type]
    .forEach(
      field=>{
        const element=
        $(
          type
          +
          "_"
          +
          field
        );
        if(field==="pinned" || field==="hidden"){data[field]=element.value==="true";}
        else if(field==="order"){
          data[field]=
          num(
            element.value
          );
        }
        else{
          data[field]=
          element.value.trim();
        }
      }
    );
    if(
      type==="players"
      &&
      !data.name
    ){
      alert(
        "선수 이름을 입력해주세요."
      );
      return;
    }
    if(
      type==="notices"
      &&
      (
        !data.title
        ||
        !data.content
      )
    ){
      alert(
        "공지 제목과 내용을 입력해주세요."
      );
      return;
    }
    if(
      type==="schedules"
      &&
      (
        !data.day
        ||
        !data.title
      )
    ){
      alert(
        "날짜/요일과 일정 제목을 입력해주세요."
      );
      return;
    }
    if(
      type==="records"
      &&
      (
        !data.title
        ||
        !data.result
      )
    ){
      alert(
        "대회명과 결과를 입력해주세요."
      );
      return;
    }
    if(type==='schedules' && data.endDate && (!data.startDate || data.endDate<data.startDate)){
      alert('종료 날짜는 시작 날짜 이후로 입력해주세요.');return;
    }
    if(id){
      await updateDoc(
        doc(
          db,
          type,
          id
        ),
        data
      );
    }
    else{
      data.createdAt=
      new Date().toISOString();
      await addDoc(
        collection(
          db,
          type
        ),
        data
      );
    }
    clearForm(type);
    await loadList(type);
    toast(
      "저장 완료"
    );
  }
  catch(error){
    console.error(error);
    alert(
      "저장 중 오류가 발생했습니다.\n\n"
      +
      error.message
    );
  }
  finally{pendingItems.delete(type);}
};
window.clearForm=
function(type){
  const hidden=
  $(type+"_id");
  if(hidden){
    hidden.value="";
  }
  fields[type]
  .forEach(
    field=>{
      const element=
      $(
        type
        +
        "_"
        +
        field
      );
      if(element){
        element.value=(field==="pinned"||field==="hidden")?"false":"";
      }
    }
  );
  if(
    type==="schedules"
  ){
    clearScheduleTimeControls();
  }
};
window.editItem=
function(type,id){
  const data=
  cache[type]
  .find(
    item=>
    item.id===id
  );
  if(!data)
  return;
  $(type+"_id").value=
  id;
  fields[type]
  .forEach(
    field=>{
      const element=
      $(
        type
        +
        "_"
        +
        field
      );
      if(element){
        element.value=
        data[field]??((field==="pinned"||field==="hidden")?"false":"");
      }
    }
  );
  if(
    type==="schedules"
  ){
    loadScheduleTimeControls(
      data.time
      ||
      ""
    );
  }
  location.hash=
  type;
};
window.deleteItem=
async function(type,id){
  if(
    !confirm(
      "정말 삭제할까요?"
    )
  ){
    return;
  }
  try{
    await deleteDoc(
      doc(
        db,
        type,
        id
      )
    );
    await loadList(type);
    toast(
      "삭제 완료"
    );
  }
  catch(error){
    console.error(error);
    alert(
      "삭제 중 오류가 발생했습니다."
    );
  }
};
function itemHtml(type,data){
  const title=
  data.title
  ||
  data.name
  ||
  data.day
  ||
  "제목 없음";
  const badge=
  data.date
  ||
  data.year
  ||
  data.grade
  ||
  data.day
  ||
  "";
  const sub=
  data.content
  ||
  data.memo
  ||
  data.award
  ||
  data.result
  ||
  data.time
  ||
  "";
  const shownTitle=
  type==="players"
  ?
  maskName(title)
  :
  title;
  return `
  <article class="item">
    <span class="badge">
      ${esc(badge)}
      ${data.pinned===true||data.pinned==="true"?" · 중요 공지":""}
      ${data.hidden===true||data.hidden==="true"?" · 홈페이지 비공개":""}
    </span>
    <h4>
      ${esc(shownTitle)}
    </h4>
    <p>
      ${esc(sub)
      .replace(/\n/g,"<br>")}
    </p>
    <div class="itemActions">
      <button
      class="miniBtn"
      onclick="editItem('${type}','${data.id}')">
        수정
      </button>
      <button
      class="miniBtn red"
      onclick="deleteItem('${type}','${data.id}')">
        삭제
      </button>
    </div>
  </article>
  `;
}
async function loadList(type){
  try{
    cache[type]=
    sortData(
      await docsOf(type)
    );
    const list=
    $(type+"List");
    list.innerHTML=
    cache[type].length
    ?
    cache[type]
    .map(
      data=>
      itemHtml(
        type,
        data
      )
    )
    .join("")
    :
    `
    <article class="item">
      <p>
        등록된 항목이 없습니다.
      </p>
    </article>
    `;
    if(
      type==="players"
    ){
      $("countPlayers").textContent=
      cache.players.length;
      renderDailyPlayers();
    }
    if(
      type==="schedules"
    ){
      $("countSchedules").textContent=
      cache.schedules.length;
    }
  }
  catch(error){
    console.error(type,error);
    throw error;
  }
}
/* ================================
공식 7명 + Firebase 합치기
================================ */
function mergedPlayers(){return sortData(cache.players);}
/* ================================
체험 신청
================================ */
async function loadTrials(){
  try{
    cache.trials=
    await docsOf(
      "trials"
    );
    cache.trials.sort(
      (a,b)=>
      String(
        b.createdAt??""
      )
      .localeCompare(
        String(
          a.createdAt??""
        )
      )
    );
    $("countTrials").textContent=
    cache.trials.length;
    $("trialsList").innerHTML=
    cache.trials.length
    ?
    cache.trials
    .map(
      (data,index)=>`
      <article class="trialItem">
        ${
          index<3
          ?
          '<span class="newBadge">RECENT</span>'
          :
          ''
        }
        <h3>
          ${esc(data.name||"이름 없음")}
          /
          ${esc(data.grade||"")}
        </h3>
        <p>
          📞
          ${esc(data.phone||"")}
        </p>
        ${
          data.memo
          ?
          `<p>💬 ${esc(data.memo)}</p>`
          :
          ""
        }
        <p>
          ${esc(data.createdAt||"")}
        </p>
        <div class="itemActions">
          <button
          class="miniBtn red"
          onclick="deleteTrial('${data.id}')">
            확인 후 삭제
          </button>
        </div>
      </article>
      `
    )
    .join("")
    :
    `
    <article class="trialItem">
      <p>
        체험 신청이 없습니다.
      </p>
    </article>
    `;
  }
  catch(error){
    console.error(error);
    throw error;
  }
}
window.deleteTrial=
async function(id){
  if(
    !confirm(
      "이 체험 신청을 삭제할까요?"
    )
  ){
    return;
  }
  await deleteDoc(
    doc(
      db,
      "trials",
      id
    )
  );
  await loadTrials();
  toast(
    "체험 신청 삭제 완료"
  );
};
/* ================================
오늘 선수 상태
================================ */
async function loadDailyStatus(){
  try{
    cache.dailyStatus=
    await docsOf(
      "dailyStatus"
    );
    renderDailyPlayers();
  }
  catch(error){
    console.error(error);
    throw error;
  }
}
function todayStatusFor(playerId){
  return (
    cache.dailyStatus.find(
      item=>
      item.date===todayKey()
      &&
      item.playerId===playerId
    )
    ||
    {}
  );
}
function safeDocId(value=""){
  return String(value)
  .replace(
    /[^a-zA-Z0-9가-힣_-]/g,
    "_"
  );
}
function dailyDocId(playerId){
  return (
    todayKey()
    +
    "_"
    +
    safeDocId(playerId)
  );
}
function renderDailyPlayers(){
  const players=
  mergedPlayers();
  $("dailyPlayerGrid").innerHTML=
  players.map(
    (player,index)=>{
      const status=
      todayStatusFor(
        player.id
      );
      return `
      <article class="playerStatus">
        <div class="playerTop">
          <span class="playerNo">
            PLAYER
            ${String(index+1).padStart(2,"0")}
          </span>
          <span class="playerIcon">
            🏓
          </span>
        </div>
        <h3>
          ${esc(maskName(player.name))}
        </h3>
        <div class="playerGrade">
          ${esc(player.grade)}
        </div>
        <label class="miniLabel" for="att_${player.id}">
          출석
        </label>
        <select
        id="att_${player.id}"
        class="miniSelect">
          <option
          value=""
          ${!status.attendance ? "selected" : ""}>
            미입력
          </option>
          <option
          value="출석"
          ${status.attendance==="출석" ? "selected" : ""}>
            출석
          </option>
          <option
          value="지각"
          ${status.attendance==="지각" ? "selected" : ""}>
            지각
          </option>
          <option
          value="결석"
          ${status.attendance==="결석" ? "selected" : ""}>
            결석
          </option>
          <option
          value="휴식"
          ${status.attendance==="휴식" ? "selected" : ""}>
            휴식
          </option>
        </select>
        <label class="miniLabel" for="cond_${player.id}">
          컨디션
        </label>
        <select
        id="cond_${player.id}"
        class="miniSelect">
          <option
          value=""
          ${!status.condition ? "selected" : ""}>
            미입력
          </option>
          <option
          value="좋음"
          ${status.condition==="좋음" ? "selected" : ""}>
            좋음
          </option>
          <option
          value="보통"
          ${status.condition==="보통" ? "selected" : ""}>
            보통
          </option>
          <option
          value="피곤"
          ${status.condition==="피곤" ? "selected" : ""}>
            피곤
          </option>
          <option
          value="부상"
          ${status.condition==="부상" ? "selected" : ""}>
            부상
          </option>
        </select>
        <input
        id="memo_${player.id}"
        class="miniInput"
        value="${esc(status.memo||"")}"
        placeholder="오늘 선수 메모" aria-label="${esc(maskName(player.name))} 오늘 메모">
        <button
        class="statusSave"
        onclick="savePlayerStatus('${player.id}')">
          오늘 상태 저장
        </button>
      </article>
      `;
    }
  )
  .join("");
  updateAttendanceCount();
}
window.savePlayerStatus=
async function(playerId){
  const player=
  mergedPlayers()
  .find(
    item=>
    item.id===playerId
  );
  if(!player)
  return;
  try{
    const attendance=
    $("att_"+playerId).value;
    const condition=
    $("cond_"+playerId).value;
    const memo=
    $("memo_"+playerId)
    .value
    .trim();
    await setDoc(
      doc(
        db,
        "dailyStatus",
        dailyDocId(playerId)
      ),
      {
        date:
        todayKey(),
        playerId:
        playerId,
        playerName:
        player.name,
        attendance:
        attendance,
        condition:
        condition,
        memo:
        memo,
        updatedAt:
        serverTimestamp()
      },
      {
        merge:true
      }
    );
    await loadDailyStatus();
    toast(
      maskName(player.name)
      +
      " 상태 저장 완료"
    );
  }
  catch(error){
    console.error(error);
    alert(
      "오늘 선수 상태 저장 중 오류가 발생했습니다.\n\n"
      +
      error.message
    );
  }
};
function updateAttendanceCount(){
  const players=
  mergedPlayers();
  let count=0;
  players.forEach(
    player=>{
      const status=
      todayStatusFor(
        player.id
      );
      if(
        status.attendance==="출석"
        ||
        status.attendance==="지각"
      ){
        count++;
      }
    }
  );
  $("countAttendance").textContent=
  count;
  $("todayAttendance").textContent=
  count
  +
  " / "
  +
  players.length;
}
/* ================================
오늘 팀 기록
================================ */
async function loadTeamLog(){
  try{
    const snapshot=
    await getDoc(
      doc(
        db,
        "teamLogs",
        todayKey()
      )
    );
    if(
      snapshot.exists()
    ){
      const data=
      snapshot.data();
      $("teamTrainingMemo").value=
      data.trainingMemo||"";
      $("teamMemo").value=
      data.teamMemo||"";
    }
    else{
      $("teamTrainingMemo").value="";
      $("teamMemo").value="";
    }
  }
  catch(error){
    console.error(error);
    throw error;
  }
}
window.saveTeamLog=
async function(){
  try{
    await setDoc(
      doc(
        db,
        "teamLogs",
        todayKey()
      ),
      {
        date:
        todayKey(),
        trainingMemo:
        $("teamTrainingMemo")
        .value
        .trim(),
        teamMemo:
        $("teamMemo")
        .value
        .trim(),
        updatedAt:
        serverTimestamp()
      },
      {
        merge:true
      }
    );
    toast(
      "오늘 팀 기록 저장 완료"
    );
  }
  catch(error){
    console.error(error);
    alert(
      "팀 기록 저장 중 오류가 발생했습니다.\n\n"
      +
      error.message
    );
  }
};
/* ================================
전체 로딩
================================ */
window.reloadAll=
async function(){
  try{
    await Promise.all([
      loadSettings(),
      loadList(
        "notices"
      ),
      loadList(
        "schedules"
      ),
      loadList(
        "players"
      ),
      loadList(
        "records"
      ),
      loadTrials(),
      loadDailyStatus(),
      loadTeamLog()
    ]);
    toast(
      "관리자 데이터 로딩 완료"
    );
  }
  catch(error){
    console.error(error);
    alert(
      "일부 데이터를 불러오지 못했습니다."
    );
  }
};
/* ================================
스크롤 진행바
================================ */
window.addEventListener(
  "scroll",
  ()=>{
    const height=
    document.documentElement.scrollHeight
    -
    window.innerHeight;
    const percent=
    height>0
    ?
    window.scrollY
    /
    height
    *
    100
    :
    0;
    $("progress")
    .style
    .width=
    percent
    +
    "%";
  }
);

onAuthStateChanged(
  auth,
  user=>{
    if(user){
      $("loginScreen")
      .classList
      .add(
        "hidden"
      );
      $("adminApp")
      .classList
      .remove(
        "hidden"
      );
      reloadAll();
    }
    else{
      siteEditor.reset();
      $("loginScreen")
      .classList
      .remove(
        "hidden"
      );
      $("adminApp")
      .classList
      .add(
        "hidden"
      );
    }
  }
);
