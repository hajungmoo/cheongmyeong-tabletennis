import test from 'node:test';
import assert from 'node:assert/strict';
import { newestFirst, activityKind, scheduleDisplayOrder, mergePublishedRecords } from '../site/homepage-view.js';

test('latest stories and Korean notice dates sort first without changing stored content', () => {
  const items = [
    { id: 'older', date: '2026.08.29~30', order: 1 },
    { id: 'newer', date: '2026. 10.03(토) ~2026.10.05', order: 5 },
    { id: 'korean', date: '2026년8월31일', order: 2 },
    { id: 'month', date: '2026.08', order: 3 },
  ];
  const original = structuredClone(items);
  assert.deepEqual(newestFirst(items).map(item => item.id), ['newer', 'korean', 'older', 'month']);
  assert.deepEqual(items, original);
});

test('undated notices use their stored timestamp rather than an evergreen date label', () => {
  const items = [{ id: 'evergreen', date: '365일 연중무휴' }, { id: 'recent', createdAt: { seconds: 1791158400 } }];
  assert.equal(newestFirst(items)[0].id, 'recent');
});

test('training and competition filters recognize existing titles and tags', () => {
  assert.equal(activityKind({ title: '대회 준비 합동훈련', tag: 'SUMMER TRAINING CAMP' }), 'training');
  assert.equal(activityKind({ title: '2026 제천 유소년 탁구대회 출전' }), 'competition');
  assert.equal(activityKind({ tag: 'ILWOO CUP' }), 'competition');
  assert.equal(activityKind({ title: '새로운 선수 합류' }), 'other');
});

test('schedules prioritize current and upcoming events, with recent past events first', () => {
  const items = [
    { id: 'old', startDate: '2026-03-19' },
    { id: 'weekly', recurring: true, order: 10 },
    { id: 'month', periodStartMonth: '2026-12' },
    { id: 'next', startDate: '2026-10-30' },
    { id: 'now', startDate: '2026-10-09', endDate: '2026-10-10' },
    { id: 'recent', startDate: '2026-10-03' },
  ];
  assert.deepEqual(scheduleDisplayOrder(items, '2026-10-09').map(item => item.id), ['now', 'next', 'month', 'weekly', 'recent', 'old']);
  assert.equal(items[0].id, 'old');
});

const published = [
  { sourceKey: 'u7', title: '2026 제천오픈 학생탁구최강전', result: 'U7 개인단식 우승', medal: 'gold' },
  { sourceKey: 'u8', title: '2026 제천오픈 학생탁구최강전', result: 'U8 개인단식 3위', medal: 'bronze' },
];
test('one saved card covering both placings does not duplicate the U8 result', () => {
  const combined = { id: 'combined', title: '2026 제천오픈 학생탁구최강전', result: 'U7 개인단식 우승\nU8 개인단식 3위', visible: true };
  const extra = { id: 'other', title: '소년체전', result: '단체 2위' };
  const result = mergePublishedRecords([combined, extra], published);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 'combined');
  assert.equal(result[1].id, 'other');
  assert.equal(combined.sourceKey, undefined);
});

test('saved visibility, custom medal and corrections survive record merging', () => {
  const saved = [{ sourceKey: 'u7', result: '관리자 수정', visible: false, medal: 'silver' }];
  const result = mergePublishedRecords(saved, published);
  assert.equal(result[0].visible, false);
  assert.equal(result[0].result, '관리자 수정');
  assert.equal(result[0].medal, 'silver');
  assert.equal(result[1].sourceKey, 'u8');
});
