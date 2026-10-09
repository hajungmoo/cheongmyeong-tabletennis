import { scheduleDate, scheduleState, validISO } from './site-content.js?v=4.2.0';

// View ordering only; saved order and administrator content remain intact.
export function contentDateKey(item) {
  const value = String(item.date || item.day || item.year || '');
  const match = value.match(/(\d{4})\s*[년.\/-]\s*(\d{1,2})(?:\s*[월.\/-]\s*(\d{1,2}))?/);
  if (match) {
    const iso = `${match[1]}-${match[2].padStart(2, '0')}-${(match[3] || '1').padStart(2, '0')}`;
    if (validISO(iso)) return Date.parse(iso + 'T00:00:00Z');
  }
  for (const timestamp of [item.createdAt, item.updatedAt]) {
    if (typeof timestamp?.seconds === 'number') return timestamp.seconds * 1000;
    if (typeof timestamp === 'string' && Number.isFinite(Date.parse(timestamp))) return Date.parse(timestamp);
  }
  return 0;
}

export function newestFirst(items) {
  return [...items].sort((a, b) => contentDateKey(b) - contentDateKey(a) || Number(a.order ?? 999) - Number(b.order ?? 999));
}

export function activityKind(item) {
  const value = [item.title, item.tag].filter(Boolean).join(' ');
  if (/훈련|training|camp/i.test(value)) return 'training';
  if (/대회|시합|오픈|컵|체전|장관기|일우배|종별|선수권|competition|tournament|cup/i.test(value)) return 'competition';
  return 'other';
}

export function scheduleDisplayOrder(items, today) {
  const rank = { ongoing: 0, upcoming: 1, other: 2, past: 3 };
  return [...items].sort((a, b) => {
    const statusA = scheduleState(a, today), statusB = scheduleState(b, today);
    const group = rank[statusA] - rank[statusB];
    if (group) return group;
    if (statusA === 'other') return Number(a.order ?? 999) - Number(b.order ?? 999);
    const dateA = scheduleDate(a) || `${a.periodStartMonth || ''}-01`;
    const dateB = scheduleDate(b) || `${b.periodStartMonth || ''}-01`;
    return statusA === 'past' ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
  });
}

// An administrator may put both Jecheon placings in one card. Show that card once.
export function mergePublishedRecords(saved, published) {
  const normalize = value => String(value || '').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
  const used = new Set();
  const featured = published.flatMap(official => {
    const division = normalize(official.result).match(/^u\d+/)?.[0];
    const placing = official.result.includes('3위') ? '3위' : '우승';
    const index = saved.findIndex(record => {
      if (record.sourceKey === official.sourceKey) return true;
      const text = normalize([record.title, record.event, record.result, record.memo, record.detail].filter(Boolean).join(' '));
      return division && text.includes('제천') && text.includes(division) && text.includes(placing);
    });
    if (index < 0) return [official];
    if (used.has(index)) return [];
    used.add(index);
    return [{ ...official, ...saved[index], medal: saved[index].medal || official.medal }];
  });
  return [...featured, ...saved.filter((_, index) => !used.has(index))];
}
