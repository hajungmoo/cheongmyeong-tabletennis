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

const hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';
const maskPlayerName = value => {
  const name = String(value || '').trim();
  if (!name) return '청명 선수';
  if (name.includes('○')) return name;
  return name.length < 3 ? name[0] + '○' : name[0] + '○' + name.at(-1);
};

// Keep the head coach introduction and full coach message together above the assistant staff.
function promoteHeadCoachSections() {
  if (!hasDOM) return;
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

function youtubeVideoId(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
      if (url.searchParams.get('v')) return url.searchParams.get('v') || '';
      const parts = url.pathname.split('/').filter(Boolean);
      if (['shorts', 'embed', 'live'].includes(parts[0])) return parts[1] || '';
    }
  } catch {}
  return '';
}

function injectPlayerVideoStyles() {
  if (!hasDOM || document.getElementById('playerVideoStyles')) return;
  const style = document.createElement('style');
  style.id = 'playerVideoStyles';
  style.textContent = `
    .championship .playerTrainingVideoBtn{width:100%;margin-top:10px;padding:8px 10px;border:1px solid #d8ad5c78;border-radius:7px;background:linear-gradient(135deg,#c998351f,#0b1c2c);color:#f2ce87;font:800 10px/1.35 Arial,"Malgun Gothic",sans-serif;letter-spacing:.02em;cursor:pointer;transition:transform .2s,border-color .2s,background .2s;position:relative;z-index:4}
    .championship .playerTrainingVideoBtn:hover{transform:translateY(-2px);border-color:#efc979;background:linear-gradient(135deg,#d7a64933,#102941)}
    .championship .playerTrainingVideoBtn span{display:inline-block;margin-right:5px;color:#fff1c6}
    .playerVideoDialog{width:min(720px,calc(100vw - 32px));max-width:720px;padding:0;border:1px solid #d1aa627a;border-radius:16px;background:#06111d;color:#f7f0e1;box-shadow:0 30px 90px #000d;overflow:hidden}
    .playerVideoDialog::backdrop{background:#000b;backdrop-filter:blur(5px)}
    .playerVideoDialogHead{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px;border-bottom:1px solid #c9a25a38;background:linear-gradient(135deg,#0c2034,#07111d)}
    .playerVideoDialogHead>div{min-width:0}.playerVideoDialogKicker{display:block;color:#d8b66f;font-size:9px;font-weight:850;letter-spacing:.16em;margin-bottom:3px}.playerVideoDialogTitle{margin:0;color:#fff;font-size:18px;line-height:1.35;letter-spacing:-.03em}
    .playerVideoClose{flex:0 0 36px;width:36px;height:36px;border-radius:50%;border:1px solid #d0ae6a55;background:#ffffff08;color:#fff;font-size:24px;line-height:1;cursor:pointer}
    .playerVideoFrame{position:relative;width:100%;aspect-ratio:16/9;background:#000}.playerVideoFrame iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#000}
    .playerVideoNote{margin:0;padding:11px 16px 14px;color:#93a7bc;font-size:10px;line-height:1.6;text-align:center}
    .playerVideoAdminField{margin:18px 0}.playerVideoAdminField .fieldHint{margin-top:7px}
    @media(max-width:700px){.championship .playerTrainingVideoBtn{margin-top:7px;padding:7px 5px;font-size:8px;border-radius:5px}.championship .playerTrainingVideoBtn span{margin-right:3px}.playerVideoDialog{width:calc(100vw - 24px);border-radius:12px}.playerVideoDialogHead{padding:13px 14px}.playerVideoDialogTitle{font-size:16px}.playerVideoNote{font-size:9px;padding:9px 12px 12px}}
  `;
  document.head.append(style);
}

function ensureVideoDialog() {
  if (!hasDOM) return null;
  let dialog = document.getElementById('playerVideoDialog');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'playerVideoDialog';
  dialog.className = 'playerVideoDialog';
  dialog.innerHTML = `
    <div class="playerVideoDialogHead">
      <div><span class="playerVideoDialogKicker">TRAINING VIDEO</span><h2 id="playerVideoDialogTitle" class="playerVideoDialogTitle">훈련영상</h2></div>
      <button id="playerVideoClose" class="playerVideoClose" type="button" aria-label="훈련영상 닫기">×</button>
    </div>
    <div class="playerVideoFrame"><iframe id="playerVideoFrame" title="선수 훈련영상" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>
    <p class="playerVideoNote">유튜브에 등록된 선수 훈련영상입니다.</p>`;
  document.body.append(dialog);
  const frame = dialog.querySelector('#playerVideoFrame');
  const close = () => dialog.close();
  dialog.querySelector('#playerVideoClose')?.addEventListener('click', close);
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  dialog.addEventListener('close', () => {
    if (frame) frame.src = 'about:blank';
    const triggerId = dialog.dataset.triggerId;
    if (triggerId) document.getElementById(triggerId)?.focus({preventScroll:true});
    dialog.dataset.triggerId = '';
  });
  return dialog;
}

function openTrainingVideo(playerName, source, trigger) {
  const id = youtubeVideoId(source);
  if (!id) return;
  const dialog = ensureVideoDialog();
  if (!dialog) return;
  const frame = dialog.querySelector('#playerVideoFrame');
  const title = dialog.querySelector('#playerVideoDialogTitle');
  if (title) title.textContent = `${maskPlayerName(playerName)} · 훈련영상`;
  if (frame) frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&playsinline=1&rel=0`;
  if (trigger) {
    if (!trigger.id) trigger.id = `playerVideoTrigger_${Math.random().toString(36).slice(2,9)}`;
    dialog.dataset.triggerId = trigger.id;
  }
  if (!dialog.open) dialog.showModal();
}

async function firebaseModules() {
  const [appModule, firestoreModule] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js'),
  ]);
  const app = appModule.getApps()[0];
  if (!app) throw new Error('Firebase app is not initialized.');
  return {app, ...firestoreModule};
}

async function installPublicPlayerVideos() {
  const playerList = document.getElementById('playerList');
  if (!playerList || document.getElementById('players_name')) return;
  injectPlayerVideoStyles();
  try {
    const {app, getFirestore, collection, getDocs} = await firebaseModules();
    const db = getFirestore(app);
    const snapshot = await getDocs(collection(db, 'players'));
    const videoByMaskedName = new Map();
    snapshot.docs.forEach(snapshotDoc => {
      const player = snapshotDoc.data();
      const video = String(player.video || player.videoUrl || player.youtube || '').trim();
      if (!video || !youtubeVideoId(video) || player.hidden === true || player.hidden === 'true') return;
      videoByMaskedName.set(maskPlayerName(player.name), {name: player.name, video});
    });

    const decorate = () => {
      playerList.querySelectorAll('.playerInteractive').forEach(card => {
        if (card.querySelector('.playerTrainingVideoBtn')) return;
        const masked = card.querySelector('h3')?.textContent?.trim() || '';
        const record = videoByMaskedName.get(masked);
        if (!record) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'playerTrainingVideoBtn';
        button.innerHTML = '<span aria-hidden="true">▶</span> 훈련영상 보기';
        button.setAttribute('aria-label', `${masked} 선수 훈련영상 보기`);
        button.addEventListener('click', event => {
          event.stopPropagation();
          openTrainingVideo(record.name, record.video, button);
        });
        button.addEventListener('keydown', event => event.stopPropagation());
        card.append(button);
      });
    };

    decorate();
    new MutationObserver(decorate).observe(playerList, {childList:true, subtree:true});
  } catch (error) {
    console.warn('선수 훈련영상 기능을 불러오지 못했습니다.', error);
  }
}

async function installAdminPlayerVideoEditor() {
  const nameInput = document.getElementById('players_name');
  if (!nameInput || document.getElementById('players_video')) return;
  injectPlayerVideoStyles();
  const photoManager = document.querySelector('#players .playerPhotoManager');
  const hiddenField = document.querySelector('#players [for="players_hidden"]')?.closest('div');
  const anchor = photoManager || hiddenField;
  if (!anchor) return;

  const field = document.createElement('div');
  field.className = 'playerVideoAdminField';
  field.innerHTML = `
    <label class="label" for="players_video">유튜브 훈련영상 링크</label>
    <input id="players_video" class="field" type="url" inputmode="url" placeholder="https://youtu.be/... 또는 YouTube 링크">
    <p class="fieldHint">링크를 저장하면 해당 선수카드에 ‘훈련영상 보기’ 버튼이 자동으로 표시됩니다. 일반 영상 · Shorts 링크 모두 가능합니다.</p>`;
  anchor.before(field);

  try {
    const {app, getFirestore, collection, getDocs, doc, getDoc, updateDoc, serverTimestamp} = await firebaseModules();
    const db = getFirestore(app);
    const originalSaveItem = window.saveItem;
    const originalEditItem = window.editItem;
    const originalClearForm = window.clearForm;

    if (typeof originalSaveItem === 'function') {
      window.saveItem = async function(type) {
        if (type !== 'players') return originalSaveItem(type);
        const id = document.getElementById('players_id')?.value || '';
        const name = nameInput.value.trim();
        const video = document.getElementById('players_video')?.value.trim() || '';
        if (video && !youtubeVideoId(video)) {
          alert('유튜브 영상 링크를 확인해주세요. 일반 영상, youtu.be, Shorts 링크를 사용할 수 있습니다.');
          return;
        }
        await originalSaveItem(type);
        // The original form is cleared only after a successful player save.
        if (!name || nameInput.value.trim()) return;
        let targetId = id;
        if (!targetId) {
          const snapshot = await getDocs(collection(db, 'players'));
          const found = snapshot.docs.filter(item => String(item.data().name || '').trim() === name).at(-1);
          targetId = found?.id || '';
        }
        if (targetId) await updateDoc(doc(db, 'players', targetId), {video, updatedAt:serverTimestamp()});
      };
    }

    if (typeof originalEditItem === 'function') {
      window.editItem = function(type, id) {
        originalEditItem(type, id);
        if (type !== 'players') return;
        getDoc(doc(db, 'players', id)).then(snapshot => {
          const input = document.getElementById('players_video');
          if (input) input.value = snapshot.exists() ? String(snapshot.data().video || '') : '';
        }).catch(error => console.warn('선수 영상 링크를 불러오지 못했습니다.', error));
      };
    }

    if (typeof originalClearForm === 'function') {
      window.clearForm = function(type) {
        originalClearForm(type);
        if (type === 'players') {
          const input = document.getElementById('players_video');
          if (input) input.value = '';
        }
      };
    }
  } catch (error) {
    console.warn('선수 영상 관리자 기능을 준비하지 못했습니다.', error);
  }
}

function enhancePlayerVideos() {
  if (!hasDOM) return;
  installPublicPlayerVideos();
  installAdminPlayerVideoEditor();
}

if (hasDOM) {
  const init = () => {
    promoteHeadCoachSections();
    enhancePlayerVideos();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
}
