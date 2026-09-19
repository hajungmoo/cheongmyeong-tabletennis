import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerPhotoDraft } from '../site/player-photo-state.js';
import { playerImageFor } from '../site/player-portraits.js';

const photoA='https://example.com/player-a.jpg', photoB='https://example.com/player-b.jpg';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};

test('uploaded photo stays a draft until the player is saved; cancel restores the saved photo',async()=>{
  const upload=deferred();let progress;
  const draft=createPlayerPhotoDraft({isSignedIn:()=>true,uploadPhoto:(_file,onProgress)=>{progress=onProgress;return upload.promise;}});
  draft.load(photoA);
  const selected=draft.select({name:'new.jpg'});
  assert.throws(()=>draft.assertReady(),/기다려/);
  progress(45);assert.equal(draft.snapshot().progress,45);
  upload.resolve(photoB);await selected;
  assert.equal(draft.snapshot().url,photoB);
  assert.equal(draft.snapshot().initialUrl,photoA);
  assert.equal(draft.snapshot().dirty,true);
  draft.cancel();assert.equal(draft.snapshot().url,photoA);
});

test('a late upload cannot overwrite another player or a signed-out form',async()=>{
  const upload=deferred();let progress;
  const draft=createPlayerPhotoDraft({isSignedIn:()=>true,uploadPhoto:(_file,onProgress)=>{progress=onProgress;return upload.promise;}});
  draft.load(photoA);
  const selected=draft.select({name:'old-player.jpg'});
  draft.load(photoB);
  progress(99);upload.resolve('https://example.com/late.jpg');await selected;
  assert.equal(draft.snapshot().url,photoB);
  assert.equal(draft.snapshot().progress,0);
  assert.equal(draft.snapshot().dirty,false);
});

test('failed uploads retain the previous photo and block misleading saves until retry or cancel',async()=>{
  const draft=createPlayerPhotoDraft({isSignedIn:()=>true,uploadPhoto:async()=>{throw new Error('storage unavailable');}});
  draft.load(photoA);await draft.select({name:'bad.jpg'});
  assert.equal(draft.snapshot().url,photoA);
  assert.equal(draft.snapshot().uploading,false);
  assert.equal(draft.snapshot().file,null);
  assert.throws(()=>draft.assertReady(),/업로드에 실패/);
  draft.cancel();assert.doesNotThrow(()=>draft.assertReady());
});

test('save failures can be retried without reuploading; successful save establishes the new baseline',async()=>{
  const draft=createPlayerPhotoDraft({isSignedIn:()=>true,uploadPhoto:async()=>photoB});
  draft.load(photoA);await draft.select({name:'new.jpg'});
  draft.setSaving(true);draft.remove();draft.cancel();
  assert.equal(draft.snapshot().url,photoB);
  draft.setSaving(false);
  assert.equal(draft.snapshot().dirty,true);
  assert.doesNotThrow(()=>draft.assertReady());
  draft.markSaved();assert.equal(draft.snapshot().dirty,false);
});

test('signed-out users and duplicate selections do not start extra uploads',async()=>{
  const upload=deferred();let calls=0,signedIn=false;
  const draft=createPlayerPhotoDraft({isSignedIn:()=>signedIn,uploadPhoto:()=>{calls++;return upload.promise;}});
  await draft.select({name:'a.jpg'});assert.equal(calls,0);
  signedIn=true;draft.cancel();
  const first=draft.select({name:'a.jpg'});
  await draft.select({name:'b.jpg'});assert.equal(calls,1);
  upload.resolve(photoA);await first;
});

test('removing a custom photo restores the existing illustration without modifying player data',()=>{
  const player={name:'강다윤',photoUrl:photoA,award:'기존 성적',grade:'6학년'};
  const original=structuredClone(player);
  assert.equal(playerImageFor(player).src,photoA);
  assert.equal(playerImageFor({...player,photoUrl:''}).src,'site/assets/players/player-01.webp');
  assert.equal(playerImageFor({...player,photoUrl:'javascript:alert(1)'}).custom,false);
  assert.deepEqual(player,original);
  assert.equal(playerImageFor({name:'새선수',photoUrl:photoB}).src,photoB);
  assert.equal(playerImageFor({name:'새선수'}).src,'');
});

test('an invalid upload result is not saved as a photo URL',async()=>{
  const draft=createPlayerPhotoDraft({isSignedIn:()=>true,uploadPhoto:async()=>'javascript:alert(1)'});
  draft.load(photoA);await draft.select({name:'bad.jpg'});
  assert.equal(draft.snapshot().url,photoA);
  assert.throws(()=>draft.assertReady());
});
