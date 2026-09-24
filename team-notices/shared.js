import {API_URL} from './config.js';
export const $=id=>document.getElementById(id);
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const isDemo=new URLSearchParams(location.search).get('demo')==='1';
export const fmt=(value,options={})=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',hour:'numeric',minute:'2-digit',...options}).format(new Date(value));
export function seoulInput(date=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(date).replace(' ','T');}
export function kstToISO(value){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('예약 날짜와 시간을 선택해주세요.');const d=new Date(value+':00+09:00');if(!Number.isFinite(d.getTime()))throw new Error('예약 시간을 확인해주세요.');return d.toISOString();}
export function toast(message,error=false){const el=$('toast');el.textContent=message;el.dataset.error=String(error);el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,6500);}
export async function api(action,data={},token='',admin=false){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  try{const response=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json',...(token?{[admin?'Authorization':'X-Member-Token']:admin?'Bearer '+token:token}:{})},body:JSON.stringify({action,...data}),signal:controller.signal});
    let result;try{result=await response.json();}catch{throw new Error('알림 서버 연결을 준비하고 있습니다. 잠시 후 다시 확인해주세요.');}
    if(!response.ok)throw Object.assign(new Error(result.error||'요청을 완료하지 못했습니다.'),{status:response.status});return result;
  }catch(error){if(error.name==='AbortError')throw new Error('응답이 늦어지고 있습니다. 잠시 후 다시 시도해주세요.');if(error instanceof TypeError)throw new Error('알림 서버와 연결되지 않았습니다. 서버 준비가 끝나면 다시 연결해주세요.');throw error;}finally{clearTimeout(timer);}
}
export const categoryLabels={uniform:'단체복',training:'훈련',competition:'대회',general:'공지'};
export const icons={bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',check:'<path d="m5 12 4 4L19 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',image:'<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m3 16 6-6 8 11m-4-7 3-3 5 5"/><circle cx="16" cy="7" r="1"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m0-16a3 3 0 0 1 0 6m4 10v-3a6 6 0 0 0-2-4"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',logout:'<path d="M9 4H4v16h5m5-13 5 5-5 5m-7-5h12"/>'};
export function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.bell}</svg>`;}
export function mountIcons(){document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
export const demoNotices=[
 {id:'demo-uniform',title:'내일은 파란 단체복을 챙겨주세요',body:'훈련 올 때 파란색 단체복 상·하의와 실내 운동화를 챙겨주세요.\n물병도 잊지 않기! 내일 밝은 모습으로 만나요. 😊',category:'uniform',publishedAt:new Date().toISOString(),imageIds:['demo-uniform'],confirmed:false,state:'published',audience:'all'},
 {id:'demo-training',title:'함께 준비하는 오늘의 훈련',body:'가볍게 몸을 풀고 기본기부터 차근차근 시작해요.\n줄넘기와 개인 라켓을 꼭 챙겨주세요.',category:'training',publishedAt:new Date(Date.now()-86400000).toISOString(),imageIds:[],confirmed:true,state:'published',audience:'all'},
 {id:'demo-holiday',title:'풍성하고 행복한 한가위 보내세요 🌕',body:'가족과 함께 즐거운 연휴 보내세요.\n푹 쉬고 건강한 모습으로 다시 만나요!',category:'general',publishedAt:new Date(Date.now()-172800000).toISOString(),imageIds:[],confirmed:false,state:'published',audience:'all'}
];
export async function prepareImage(file){
 if(!file||file.size>15*1024*1024)throw new Error('사진은 한 장당 15MB 이하로 선택해주세요.');
 const url=URL.createObjectURL(file),img=new Image();
 try{img.src=url;await img.decode();let scale=Math.min(1,1400/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  for(let attempt=0;attempt<5;attempt++){canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',.78);if(data.length<560000)return data;scale*=.75;}
  throw new Error('사진 용량을 줄여 다시 선택해주세요.');
 }catch(error){if(error.message.includes('사진 용량'))throw error;throw new Error('사진을 읽지 못했습니다. JPG·PNG·WebP 사진으로 다시 선택해주세요.');}finally{URL.revokeObjectURL(url);}
}
