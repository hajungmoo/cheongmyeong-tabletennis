// Shared homepage/admin holiday entries. Existing saved edits take precedence.
export const TEAM_HOLIDAYS = [{
  sourceKey: '2026-chuseok-break',
  day: '2026.09.23 ~ 09.27 · 5일',
  startDate: '2026-09-23',
  endDate: '2026-09-27',
  title: '추석 휴가',
  time: '',
  memo: '가족과 함께 풍성하고 행복한 한가위 보내세요! 푹 쉬고 건강한 모습으로 다시 만나요. 🌕',
  isHoliday: true,
  order: 923
}];

export function matchesHoliday(item, holiday) {
  return item.sourceKey === holiday.sourceKey ||
    (item.title === holiday.title && item.startDate === holiday.startDate && item.endDate === holiday.endDate);
}

export function withTeamHolidays(items) {
  const saved = items.map(item => {
    const holiday = TEAM_HOLIDAYS.find(entry => matchesHoliday(item, entry));
    return holiday ? {...holiday, ...item} : item;
  });
  return [...saved, ...TEAM_HOLIDAYS.filter(holiday => !items.some(item => matchesHoliday(item, holiday)))];
}
