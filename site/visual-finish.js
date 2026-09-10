// Presentation only: no records, storage, or network requests.
export function initVisualFinish() {
  const root=document.documentElement, band=document.getElementById('teamMarquee');
  const track=document.getElementById('marqueeTrack'), toggle=document.getElementById('marqueeToggle');
  const light=document.getElementById('pointerLight');
  if(!band||!track||!toggle||!light)return {apply(){}};
  const media=query=>window.matchMedia?.(query)||{matches:false,addEventListener(){}};
  const reduced=media('(prefers-reduced-motion: reduce)'),fine=media('(hover: hover) and (pointer: fine)');
  const requestFrame=callback=>window.requestAnimationFrame?.(callback)??null;
  const cancelFrame=id=>{if(id!==null)window.cancelAnimationFrame?.(id);};
  let settings={},marqueeText=null,paused=false,bandVisible=true,frame=null,measureFrame=null;
  let destination=null,position=null,activeCard=null,pointTarget=null;
  const cardSelector='.player,.story,.record,.nextCard,.noticeFeature,.sponsor,.trialForm';
  function pointerEnabled(){return settings.showEffects!==false&&fine.matches&&!reduced.matches&&!document.hidden;}
  function removeCard(){
    if(activeCard){activeCard.classList.remove('pointer-lit');activeCard.style.removeProperty('--light-x');activeCard.style.removeProperty('--light-y');activeCard=null;}
  }
  function clearPointer(){
    cancelFrame(frame);frame=null;destination=null;position=null;pointTarget=null;
    light.classList.remove('is-visible','is-interactive');removeCard();
  }
  function syncMotion(){
    const staticMode=reduced.matches;
    root.classList.toggle('gold-finish',settings.showEffects!==false);
    root.classList.toggle('finish-reduced',staticMode);
    const stop=paused||staticMode||document.hidden||!bandVisible||band.hidden;
    band.classList.toggle('marquee-paused',stop);
    toggle.hidden=staticMode||band.hidden;
    toggle.setAttribute('aria-pressed',String(paused));
    toggle.setAttribute('aria-label',paused?'흐르는 문구 재생':'흐르는 문구 일시정지');
    toggle.title=paused?'흐르는 문구 재생':'흐르는 문구 일시정지';
    toggle.textContent=paused?'▶':'Ⅱ';
    if(!pointerEnabled())clearPointer();
  }
  function measure(){
    measureFrame=null;
    const width=track.firstElementChild?.getBoundingClientRect?.().width||0;
    if(width)track.style.setProperty('--marquee-duration',Math.max(28,width/38).toFixed(1)+'s');
  }
  function scheduleMeasure(){if(measureFrame===null)measureFrame=requestFrame(measure);}
  function draw(){
    frame=null;if(!destination||!pointerEnabled()){clearPointer();return;}
    if(!position)position={...destination};
    position.x+=(destination.x-position.x)*.23;position.y+=(destination.y-position.y)*.23;
    light.style.transform=`translate3d(${position.x}px,${position.y}px,0)`;
    light.classList.add('is-visible');
    light.classList.toggle('is-interactive',!!pointTarget?.closest?.('a,button,summary'));
    const card=pointTarget?.closest?.(cardSelector)||null;
    if(card!==activeCard){removeCard();activeCard=card;activeCard?.classList.add('pointer-lit');}
    if(activeCard){const rect=activeCard.getBoundingClientRect();activeCard.style.setProperty('--light-x',(destination.x-rect.left)+'px');activeCard.style.setProperty('--light-y',(destination.y-rect.top)+'px');}
    if(Math.abs(destination.x-position.x)+Math.abs(destination.y-position.y)>.2)frame=requestFrame(draw);
  }
  function pointerMove(event){
    if(event.pointerType==='touch'||!pointerEnabled())return;
    destination={x:event.clientX,y:event.clientY};pointTarget=event.target;
    if(frame===null)frame=requestFrame(draw);
  }
  document.addEventListener('pointermove',pointerMove,{passive:true});
  document.addEventListener('pointerleave',clearPointer);
  document.addEventListener('scroll',clearPointer,{passive:true});
  document.addEventListener('keydown',event=>{if(event.key==='Tab')clearPointer();});
  window.addEventListener('blur',clearPointer);
  window.addEventListener('resize',()=>{clearPointer();scheduleMeasure();},{passive:true});
  document.addEventListener('visibilitychange',syncMotion);
  for(const query of [reduced,fine]){
    if(query.addEventListener)query.addEventListener('change',syncMotion);
    else query.addListener?.(syncMotion);
  }
  toggle.addEventListener('click',()=>{paused=!paused;syncMotion();});
  if(typeof window.IntersectionObserver==='function'){
    const headingObserver=new window.IntersectionObserver(entries=>{
      for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('gold-revealed');headingObserver.unobserve(entry.target);}
    },{threshold:.15});
    document.querySelectorAll('.sectionHead h2,.coachSection h2,.message h2,.trialIntro h2,.location h2').forEach(el=>{el.classList.add('gold-heading');headingObserver.observe(el);});
    const bandObserver=new window.IntersectionObserver(entries=>{bandVisible=entries[0]?.isIntersecting??true;syncMotion();});
    bandObserver.observe(band);
  }
  if(typeof window.ResizeObserver==='function')new window.ResizeObserver(scheduleMeasure).observe(track);
  document.fonts?.ready?.then(scheduleMeasure).catch(()=>{});
  window.addEventListener('pageshow',syncMotion);
  return {
    apply(content){
      settings=content;
      const copy=String(content.marqueeText??'').replace(/\s+/g,' ').trim();
      band.hidden=content.showMarquee===false||!copy;
      if(copy!==marqueeText){
        marqueeText=copy;document.getElementById('marqueeAccessible').textContent=copy;
        const makeGroup=()=>{const group=document.createElement('div');group.className='marqueeGroup';
          for(let i=0;i<2;i++){const words=document.createElement('span');words.className='marqueeWords';words.textContent=copy;group.append(words);}
          return group;
        };
        track.replaceChildren(makeGroup(),makeGroup());scheduleMeasure();
      }
      syncMotion();
    }
  };
}
