import test from 'node:test';
import assert from 'node:assert/strict';
import { sameSettingsValue, assertSettingsUnchanged } from '../site/settings-compare.js';

const photo = 'https://example.com/first.jpg';
const baseline = {siteContent: {activities: [{id: 'activity-1', title: '훈련', image: photo, photos: [], visible: true}]}};
const fresh = {siteContent: {activities: [{visible: true, photos: [], image: photo, title: '훈련', id: 'activity-1'}]}};

test('same Firestore map values do not conflict when key order changes', () => {
  assert.notEqual(JSON.stringify(baseline.siteContent.activities), JSON.stringify(fresh.siteContent.activities));
  assert.equal(sameSettingsValue(baseline, fresh), true);
  assert.doesNotThrow(() => assertSettingsUnchanged(fresh, baseline, ['siteContent.activities']));
});

test('real edits to a photo still stop a stale draft from overwriting it', () => {
  const changed = structuredClone(fresh);
  changed.siteContent.activities[0].image = 'https://example.com/new.jpg';
  assert.throws(() => assertSettingsUnchanged(changed, baseline, ['siteContent.activities']), {code: 'cm/conflict'});
});

test('array order and added or removed activity fields remain significant', () => {
  assert.equal(sameSettingsValue({photos: ['one.jpg', 'two.jpg']}, {photos: ['two.jpg', 'one.jpg']}), false);
  for (const mutate of [
    item => { item.photos.push('two.jpg'); },
    item => { delete item.visible; },
    item => { item.customField = 'new'; }
  ]) {
    const changed = structuredClone(fresh);
    mutate(changed.siteContent.activities[0]);
    assert.throws(() => assertSettingsUnchanged(changed, baseline, ['siteContent.activities']), {code: 'cm/conflict'});
  }
});

test('unrelated changes do not block saving the edited homepage section', () => {
  const current = structuredClone(fresh);
  current.siteContent.contactPhone = 'changed in another tab';
  assert.doesNotThrow(() => assertSettingsUnchanged(current, baseline, ['siteContent.activities']));
});

test('nested maps ignore key order while missing values and types remain distinct', () => {
  assert.equal(sameSettingsValue({meta: {a: 1, b: {x: 2, y: 3}}}, {meta: {b: {y: 3, x: 2}, a: 1}}), true);
  assert.equal(sameSettingsValue(undefined, undefined), true);
  assert.equal(sameSettingsValue(undefined, null), false);
  assert.equal(sameSettingsValue(false, 'false'), false);
  assert.equal(sameSettingsValue([], {}), false);
  assert.equal(sameSettingsValue(new Date(0), new Date(1)), false);
});
