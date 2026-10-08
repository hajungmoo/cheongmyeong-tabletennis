import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSettings} from '../site/site-content.js';
import {youthDisplayName} from '../site/team-profiles.js';
import {assertSettingsUnchanged} from '../site/settings-compare.js';

test('existing homepage settings gain four editable youth placeholders without a roster change', () => {
  const original={siteContent:{coachImage:'custom-coach.jpg',activities:[]},mainTitle:'기존 제목'};
  const resolved=resolveSettings(original);
  assert.equal(resolved.mainTitle,'기존 제목');
  assert.equal(resolved.siteContent.coachImage,'custom-coach.jpg');
  assert.equal(resolved.siteContent.coachRole,'청명초 메인코치');
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

test('a stale youth draft cannot overwrite another admin, while unrelated settings remain saveable', () => {
  const old={siteContent:{youthPlayers:[{id:'a',name:'준비중'}]}};
  const current={siteContent:{youthPlayers:[{id:'a',name:'김해빈'}],contactPhone:'updated'}};
  assert.throws(()=>assertSettingsUnchanged(current,old,['siteContent.youthPlayers']),{code:'cm/conflict'});
  assert.doesNotThrow(()=>assertSettingsUnchanged(current,old,['siteContent.staffMembers']));
});
