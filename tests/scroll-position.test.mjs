import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {showPopupAtTop} from '../site/popup-view.js';

const startScript=fs.readFileSync(new URL('../site/home-scroll.js',import.meta.url),'utf8');
const emit=(target,type,properties={})=>target.dispatchEvent(Object.assign(new Event(type),properties));

function pageHarness(hash='#staff') {
  const frames=[],window=new EventTarget(),document=new EventTarget();
  const location={pathname:'/',search:'?source=notice',hash};
  const state={retained:'history state'};
  const history={state,scrollRestoration:'auto',replaceState(next,_title,url){
    assert.equal(next,state);
    const parsed=new URL(url,'https://example.com');
    Object.assign(location,{pathname:parsed.pathname,search:parsed.search,hash:parsed.hash});
  }};
  Object.assign(window,{
    scrollX:0,scrollY:800,
    scrollTo({left,top}){this.scrollX=left;this.scrollY=top;},
    requestAnimationFrame(callback){frames.push(callback);},
  });
  vm.runInNewContext(startScript,{window,document,location,history});
  const flush=()=>{while(frames.length)frames.shift()();};
  return {window,document,location,history,flush};
}

test('homepage entry starts above the fold, including saved section URLs and delayed restoration',()=>{
  const p=pageHarness();
  assert.equal(p.history.scrollRestoration,'manual');
  assert.equal(p.location.hash,'');
  assert.equal(p.location.search,'?source=notice');
  assert.equal(p.window.scrollY,0);
  emit(p.document,'DOMContentLoaded');
  emit(p.window,'pageshow',{persisted:false});
  p.window.scrollY=1200;
  p.flush();
  assert.equal(p.window.scrollY,0);
  p.window.scrollY=900;
  emit(p.document,'cm-home-ready');
  assert.equal(p.window.scrollY,0);
});

test('slow resources never pull a visitor back up after touch, mouse, wheel or keyboard input',()=>{
  for(const interaction of ['touchstart','pointerdown','wheel','keydown']){
    const p=pageHarness('');
    emit(p.document,'DOMContentLoaded');
    emit(p.window,interaction);
    p.window.scrollY=600;
    emit(p.window,'load');
    emit(p.window,'pageshow',{persisted:false});
    emit(p.document,'cm-home-ready');
    p.flush();
    assert.equal(p.window.scrollY,600,interaction);
  }
});

test('returning from another page through the back-forward cache restarts at the top',()=>{
  const p=pageHarness('');
  emit(p.window,'touchstart');
  p.location.hash='#notice';
  p.window.scrollY=1600;
  emit(p.window,'pagehide',{persisted:true});
  emit(p.window,'pageshow',{persisted:true});
  p.flush();
  assert.equal(p.window.scrollY,0);
  assert.equal(p.location.hash,'');
  emit(p.window,'touchstart');
  p.window.scrollY=400;
  emit(p.window,'load');
  p.flush();
  assert.equal(p.window.scrollY,400);
});

test('section links still navigate normally once the homepage is open',()=>{
  const p=pageHarness('');
  p.location.hash='#trial';
  emit(p.window,'hashchange');
  p.window.scrollY=2400;
  emit(p.document,'cm-home-ready');
  emit(p.window,'load');
  p.flush();
  assert.equal(p.location.hash,'#trial');
  assert.equal(p.window.scrollY,2400);
});

function popupHarness(){
  const frames=[],image=new EventTarget(),dialog=new EventTarget();
  const view={scrollX:0,scrollY:320,scrollTo({left,top}){this.scrollX=left;this.scrollY=top;},requestAnimationFrame(callback){frames.push(callback);}};
  const focusCalls=[];
  const control={focus(options){focusCalls.push(options);}};
  Object.assign(dialog,{
    open:false,scrollTop:700,ownerDocument:{defaultView:view},opens:0,
    querySelector(selector){return selector==='[autofocus]'?control:image;},
    showModal(){this.open=true;this.opens++;this.scrollTop=900;view.scrollY=2600;},
    scrollTo({top}){this.scrollTop=top;},
    close(){this.open=false;emit(this,'close');},
  });
  return {dialog,image,view,focusCalls,flush(){while(frames.length)frames.shift()();}};
}

test('opening a long notice shows its image at the top without moving the page behind it',()=>{
  const p=popupHarness();
  showPopupAtTop(p.dialog);
  assert.equal(p.dialog.scrollTop,0);
  assert.equal(p.view.scrollY,320);
  assert.deepEqual(p.focusCalls,[{preventScroll:true}]);
  p.dialog.scrollTop=350;
  p.flush();
  assert.equal(p.dialog.scrollTop,0);
});

test('a late poster image keeps the opening position, but never interrupts manual reading',()=>{
  const p=popupHarness();
  showPopupAtTop(p.dialog);
  p.flush();
  p.dialog.scrollTop=400;
  emit(p.image,'load');
  assert.equal(p.dialog.scrollTop,0);
  p.dialog.close();
  showPopupAtTop(p.dialog);
  emit(p.dialog,'touchstart');
  p.dialog.scrollTop=480;
  emit(p.image,'load');
  p.flush();
  assert.equal(p.dialog.scrollTop,480);
});

test('settings refresh does not reopen or reposition an already open notice',()=>{
  const p=popupHarness();
  showPopupAtTop(p.dialog);
  p.flush();
  emit(p.dialog,'wheel');
  p.dialog.scrollTop=500;
  showPopupAtTop(p.dialog);
  assert.equal(p.dialog.opens,1);
  assert.equal(p.dialog.scrollTop,500);
});

test('closing a notice cancels pending scroll corrections and reopening starts at its image',()=>{
  const p=popupHarness();
  showPopupAtTop(p.dialog);
  p.dialog.close();
  p.dialog.scrollTop=500;
  emit(p.image,'load');
  p.flush();
  assert.equal(p.dialog.scrollTop,500);
  showPopupAtTop(p.dialog);
  p.flush();
  assert.equal(p.dialog.scrollTop,0);
});
