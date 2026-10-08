// Public introduction cards use homepage settings, not the competition roster.
export const YOUTH_DEFAULTS = Array.from({length: 4}, (_, index) => ({
  id: `youth-ready-${index + 1}`,
  name: '준비중',
  age: '준비중',
  intro: '유소년 선수준비중',
  image: `site/assets/youth/player-${index + 1}.webp`,
  visible: true,
}));

export const STAFF_DEFAULTS = [
  {
    id: 'coach-lee-yuna', name: '이유나', role: '코치',
    career: '음성용천초 트레이너\n군산대야초 코치',
    image: 'site/assets/staff/lee-yuna.jpg', visible: true,
  },
  {
    id: 'trainer-cho-hyeonseo', name: '조현서', role: '트레이너',
    career: '천안성환초\n수원곡선중\n광영고 졸업\n챔피언탁구아카데미 유소년반 코치',
    image: 'site/assets/staff/cho-hyeonseo.jpg', visible: true,
  },
];

export function youthDisplayName(value) {
  const name = String(value ?? '').trim();
  if (!name || name === '준비중' || name === '준비 중') return '준비중';
  if (name.includes('○')) return name;
  return name.length < 3 ? name[0] + '○' : name[0] + '○' + name.at(-1);
}

export const isYouthIllustration = value =>
  /^site\/assets\/youth\/player-[1-4]\.webp$/.test(String(value || ''));

// Keep the head coach introduction and full coach message together above the assistant staff.
function promoteHeadCoachSections() {
  const coach = document.getElementById('coach');
  const message = document.getElementById('message');
  const staff = document.getElementById('staff');
  if (!coach || !staff || coach.parentNode !== staff.parentNode) return;

  const parent = staff.parentNode;
  parent.insertBefore(coach, staff);
  if (message && message.parentNode === parent) parent.insertBefore(message, staff);

  coach.classList.add('headCoachFeature');
  if (message) message.classList.add('headCoachLetter');

  const kicker = coach.querySelector('.sectionKicker');
  if (kicker) kicker.textContent = 'HEAD COACH · COACH MESSAGE';

  // The staff section follows the head coach directly, so an upward link is no longer needed.
  staff.querySelector('.textLink')?.remove();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', promoteHeadCoachSections, {once:true});
} else {
  promoteHeadCoachSections();
}
