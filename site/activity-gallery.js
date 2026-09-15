import { escapeHTML as esc, safeURL } from './site-content.js?v=3.1.0';

// Backwards-compatible: existing image URLs remain the cover; photos is optional.
export function activityPhotos(activity = {}) {
  const more = Array.isArray(activity.photos) ? activity.photos : [];
  return [...new Set([activity.image, ...more].map(value => safeURL(typeof value === 'string' ? value : value?.url)).filter(Boolean))].slice(0, 10);
}

export function activityCards(items) {
  return items.map((a, index) => {
    const photos=activityPhotos(a), title=esc(a.title||'청명 소식');
    const visual=photos.length
      ? `<img class="storyImage" src="${esc(photos[0])}" alt="${title} 대표 사진" loading="lazy"><span class="storyPhotoCount">사진 ${photos.length}장 ↗</span>`
      : '<span class="storyPlaceholder"><b>CM</b><span>활동 사진 준비 중</span></span>';
    return `<article class="story"><button class="storyImageButton" type="button" data-activity="${index}" aria-label="${title} 자세히 보기">${visual}</button><div class="storyBody"><div class="storyMeta"><span>${esc(a.tag||'TEAM JOURNAL')}</span><time>${esc(a.date||'')}</time></div><h3><button class="storyTitleButton" type="button" data-activity="${index}">${title}</button></h3><p>${esc(a.body||'')}</p><button class="storyOpen" type="button" data-activity="${index}">${photos.length?'사진첩 보기':'소식 자세히 보기'} →</button></div></article>`;
  }).join('') || '<p class="empty">새로운 활동 소식을 준비하고 있습니다.</p>';
}

export function initActivityGallery() {
  const $=id=>document.getElementById(id), list=$('activityList'), dialog=$('activityDialog');
  let activities=[], photos=[], current=0, lastTrigger=null;
  function showPhoto(index) {
    if(!photos.length)return;
    current=(index+photos.length)%photos.length;
    $('galleryImage').src=photos[current];
    $('galleryImage').alt=$('activityDialogTitle').textContent+' · 사진 '+(current+1);
    $('galleryCounter').textContent=(current+1)+' / '+photos.length;
    $('galleryPrev').hidden=$('galleryNext').hidden=photos.length<2;
    $('galleryStage').querySelector('.galleryImageError')?.remove();
    $('galleryImage').hidden=false;
    [...$('galleryThumbs').children].forEach((button,i)=>button.setAttribute('aria-current',String(i===current)));
  }
  function open(index,trigger) {
    const a=activities[index]; if(!a)return;
    photos=activityPhotos(a);lastTrigger=trigger;
    $('activityDialogTitle').textContent=a.title||'청명 소식';
    $('activityDialogMeta').textContent=[a.tag,a.date].filter(Boolean).join(' · ');
    $('activityDialogBody').textContent=a.body||'';
    const url=safeURL(a.url), link=$('activityDialogLink');link.hidden=!url;if(url)link.href=url;else link.removeAttribute('href');
    $('galleryStage').hidden=photos.length===0;
    $('galleryThumbs').hidden=photos.length<2;
    $('galleryThumbs').innerHTML=photos.map((url,i)=>`<button type="button" data-photo="${i}" aria-label="사진 ${i+1} 보기" aria-current="false"><img src="${esc(url)}" alt="" loading="lazy"></button>`).join('');
    if(photos.length)showPhoto(0);
    if(!dialog.open)dialog.showModal();
    dialog.scrollTop=0;
  }
  list.addEventListener('click',event=>{const b=event.target.closest('[data-activity]');if(b)open(Number(b.dataset.activity),b);});
  list.addEventListener('error',event=>{
    const img=event.target;if(!img.matches?.('.storyImage'))return;
    const parent=img.parentElement;img.remove();
    parent.querySelector('.storyPhotoCount')?.remove();
    parent.insertAdjacentHTML('afterbegin','<span class="storyPlaceholder"><b>CM</b><span>사진을 불러오지 못했어요</span></span>');
  },true);
  $('closeActivity').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>lastTrigger?.isConnected&&lastTrigger.focus());
  dialog.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();showPhoto(current-1);}if(event.key==='ArrowRight'){event.preventDefault();showPhoto(current+1);}});
  $('galleryPrev').addEventListener('click',()=>showPhoto(current-1));
  $('galleryNext').addEventListener('click',()=>showPhoto(current+1));
  $('galleryThumbs').addEventListener('click',event=>{const b=event.target.closest('[data-photo]');if(b)showPhoto(Number(b.dataset.photo));});
  $('galleryImage').addEventListener('error',()=>{
    $('galleryImage').hidden=true;
    if(!$('galleryStage').querySelector('.galleryImageError'))$('galleryStage').insertAdjacentHTML('afterbegin','<p class="galleryImageError" role="status">사진을 불러오지 못했습니다. 다음 사진을 보거나 잠시 후 다시 열어주세요.</p>');
  });
  return { render(items){activities=items;list.innerHTML=activityCards(items);} };
}

export function jerseyMarkup(index) {
  const id='kit'+index, number=String(index+1).padStart(2,'0');
  return `<svg class="jersey" viewBox="0 0 150 132" aria-hidden="true"><defs><linearGradient id="${id}" x2="1" y2="1"><stop stop-color="#344763"/><stop offset=".27" stop-color="#101c31"/><stop offset=".6" stop-color="#182940"/><stop offset="1" stop-color="#060d16"/></linearGradient><linearGradient id="${id}gold" x2="0" y2="1"><stop stop-color="#fff1c4"/><stop offset=".5" stop-color="#dfb365"/><stop offset="1" stop-color="#96611f"/></linearGradient></defs><path d="M48 16 60 11 Q75 20 90 11 L102 16 133 39 120 66 104 57 105 122 Q75 128 45 122 L46 57 30 66 17 39Z" fill="url(#${id})" stroke="#7890aa" stroke-width="1"/><path d="M60 11Q75 36 90 11M48 17 43 58M102 17 108 58" fill="none" stroke="#a9b6c7" stroke-width="1.5"/><path d="M19 42 32 63M131 42 118 63M47 120Q75 125 103 120" fill="none" stroke="#b5c4d488" stroke-width="1"/><path d="M51 30 49 113M98 30 101 114M54 37 56 112M94 37 92 114" fill="none" stroke="#778ba317"/><text x="75" y="49" text-anchor="middle" fill="#ccd3dd" font-family="Arial,sans-serif" font-weight="700" font-size="7" letter-spacing=".4">CHEONGMYEONG</text><text x="75" y="94" text-anchor="middle" fill="url(#${id}gold)" font-family="Arial,sans-serif" font-stretch="condensed" font-weight="900" font-size="46">${number}</text><text x="75" y="111" text-anchor="middle" fill="#7688a0" font-family="Arial,sans-serif" font-size="5" letter-spacing="2">TABLE TENNIS</text></svg>`;
}

export function recordMedal(result) {
  const text=String(result||'');
  return /준우승|2위|은메달/.test(text)?'silver':/3위|동메달/.test(text)?'bronze':'gold';
}
export const trophyMarkup='<svg class="recordIcon" viewBox="0 0 80 80" aria-hidden="true"><path d="M25 8H55V29Q55 43 43 48V59H54V67H26V59H37V48Q25 43 25 29Z" fill="currentColor"/><path d="M25 14H14V22Q14 36 30 38M55 14H66V22Q66 36 50 38" fill="none" stroke="currentColor" stroke-width="4"/><path d="M30 12V29Q30 37 36 40" fill="none" stroke="#fff9dd" stroke-width="2" opacity=".65"/><path d="M22 27Q6 49 22 62M58 27Q74 49 58 62M18 35 10 31M16 43 7 39M17 50 8 49M20 56 12 59M62 35 70 31M64 43 73 39M63 50 72 49M60 56 68 59" fill="none" stroke="currentColor" stroke-width="2" opacity=".7"/><path d="M22 70H58" stroke="currentColor" stroke-width="3"/></svg>';
