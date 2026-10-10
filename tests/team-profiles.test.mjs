import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSettings} from '../site/site-content.js';
import {youthDisplayName, HEAD_COACH_MAIN_PORTRAIT, HEAD_COACH_CARD_PORTRAIT} from '../site/team-profiles.js';
import {assertSettingsUnchanged} from '../site/settings-compare.js';

test('existing homepage settings gain four editable youth placeholders without a roster change', () => {
  const original={siteContent:{coachImage:'custom-coach.jpg',activities:[]},mainTitle:'기존 제목'};
  const resolved=resolveSettings(original);
  assert.equal(resolved.mainTitle,'기존 제목');
  assert.equal(resolved.siteContent.coachImage,'custom-coach.jpg');
  assert.equal(resolved.siteContent.coachRole,'메인코치');
  assert.equal(resolved.siteContent.youthPlayers.length,4);
  assert.equal(new Set(resolved.siteContent.youthPlayers.map(p=>p.id)).size,4);
  assert.equal(new Set(resolved.siteContent.youthPlayers.map(p=>p.image)).size,4);
  assert.deepEqual(resolved.siteContent.staffMembers.map(p=>[p.name,p.role]),[['이유나','코치'],['조현서','트레이너']]);
  assert.deepEqual(original,{siteContent:{coachImage:'custom-coach.jpg',activities:[]},mainTitle:'기존 제목'});
});

test('saved edits, order, visibility and complete deletion survive reload without reseeding', () => {
  const draft=resolveSettings({});
  draft.siteContent.youthPlayers[0]={...draft.siteContent.youthPlayers[0],name:'김해빈',age:'6세',image:'uploaded.jpg',visible:false};
  draft.siteContent.youthPlayers.reverse();
  draft.siteContent.staffMembers=[];
  const reload=resolveSettings(draft);
  assert.deepEqual(reload.siteContent.youthPlayers,draft.siteContent.youthPlayers);
  assert.deepEqual(reload.siteContent.staffMembers,[]);
  assert.deepEqual(resolveSettings({siteContent:{youthPlayers:[]}}).siteContent.youthPlayers,[]);
  draft.siteContent.youthPlayers[0].name='changed';
  assert.equal(resolveSettings({}).siteContent.youthPlayers[0].name,'준비중');
});

test('public youth names mask actual children while keeping the preparation label readable', () => {
  for(const name of ['준비중','준비 중','',' '])assert.equal(youthDisplayName(name),'준비중');
  assert.equal(youthDisplayName('김해빈'),'김○빈');
  assert.equal(youthDisplayName('김○빈'),'김○빈');
});

test('new staff introductions preserve saved photos, careers, order and intentional edits', () => {
  const original={siteContent:{staffMembers:[
    {id:'trainer-cho-hyeonseo',name:'조현서',image:'saved-trainer.jpg',career:'기존 경력',visible:false,intro:''},
    {id:'coach-lee-yuna',name:'이유나',image:'saved-coach.jpg',tenure:'수정된 재직 기간'},
    {id:'another-coach',name:'새 지도진',image:'another.jpg'},
  ]}};
  const before=structuredClone(original);
  const members=resolveSettings(original).siteContent.staffMembers;
  assert.deepEqual(members.map(p=>p.image),['saved-trainer.jpg','saved-coach.jpg','another.jpg']);
  assert.equal(members[0].career,'기존 경력');
  assert.equal(members[0].visible,false);
  assert.equal(members[0].intro,'');
  assert.equal(members[1].tenure,'수정된 재직 기간');
  assert.ok(members[1].intro.length>0);
  assert.equal(members[2].intro,undefined);
  assert.deepEqual(original,before);
  assert.deepEqual(resolveSettings({siteContent:{staffMembers:members}}).siteContent.staffMembers,members);
});

test('head-coach introduction and staff card keep independent photos across reloads', () => {
  const previous='https://firebasestorage.googleapis.com/v0/b/cheongmyeong-tabletennis.firebasestorage.app/o/homepage%2Factivities%2F3cd86594-8d9a-4fb8-87e7-571f4f9cba58.jpg?alt=media';
  const defaults=resolveSettings().siteContent;
  assert.equal(defaults.coachImage,HEAD_COACH_MAIN_PORTRAIT);
  assert.equal(defaults.coachCardImage,HEAD_COACH_CARD_PORTRAIT);
  assert.notEqual(defaults.coachImage,defaults.coachCardImage);
  const original={siteContent:{coachImage:previous}};
  const restored=resolveSettings(original);
  assert.equal(restored.siteContent.coachImage,previous);
  assert.equal(restored.siteContent.coachCardImage,HEAD_COACH_CARD_PORTRAIT);
  assert.deepEqual(original,{siteContent:{coachImage:previous}});
  for(const cardImage of ['new-card-upload.jpg','']){
    restored.siteContent.coachCardImage=cardImage;
    const reloaded=resolveSettings(restored);
    assert.equal(reloaded.siteContent.coachImage,previous);
    assert.equal(reloaded.siteContent.coachCardImage,cardImage);
  }
  restored.siteContent.coachImage='new-main-upload.jpg';
  assert.equal(resolveSettings(restored).siteContent.coachImage,'new-main-upload.jpg');
  assert.equal(resolveSettings(restored).siteContent.coachCardImage,'');
});

test('a stale youth draft cannot overwrite another admin, while unrelated settings remain saveable', () => {
  const old={siteContent:{youthPlayers:[{id:'a',name:'준비중'}]}};
  const current={siteContent:{youthPlayers:[{id:'a',name:'김해빈'}],contactPhone:'updated'}};
  assert.throws(()=>assertSettingsUnchanged(current,old,['siteContent.youthPlayers']),{code:'cm/conflict'});
  assert.doesNotThrow(()=>assertSettingsUnchanged(current,old,['siteContent.staffMembers']));
});
