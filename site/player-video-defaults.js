const DEFAULT_PLAYER_VIDEOS = new Map([
  ['팡제이', 'https://youtu.be/XSyUaZZaf0M?si=HbbcI3EJI756bMwH'],
  ['강다윤', 'https://youtu.be/tHPJvHtN_IY?si=qGFBDxBSMjFY39Dv'],
  ['이효은', 'https://youtu.be/kfEYUrnKvTE?si=p9kwfdewJ-zM4bK1'],
  ['이수빈', 'https://youtu.be/OOIUD2jcwWY?si=50RYD_E2LoQceVmF'],
  ['서예은', 'https://youtu.be/SBRBB6K2-i4?si=Y0w_ZQi9Q8g85zgV'],
  ['양하은', 'https://youtu.be/4-wfLlBEzCc?si=HEvqbvi3lMb4Cdjz'],
  ['임수아', 'https://youtu.be/GfANhZnBqPI?si=RaNG8zRvlkAZRVdy'],
]);
const VIDEO_PENDING_PLAYERS = new Set(['천윤슬']);

const maskPlayerName = value => {
  const name = String(value || '').trim();
  if (!name) return '청명 선수';
  if (name.includes('○')) return name;
  return name.length < 3 ? name[0] + '○' : name[0] + '○' + name.at(-1);
};

function youtubeVideoId(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';
    if (['youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com'].includes(host)) {
      if (url.searchParams.get('v')) return url.searchParams.get('v') || '';
      const parts = url.pathname.split('/').filter(Boolean);
      if (['shorts','embed','live'].includes(parts[0])) return parts[1] || '';
    }
  } catch {}
  return '';
}

function injectStyles() {
  if (document.getElementById('playerVideoDefaultsStyles')) return;
  const style = document.createElement('style');
  style.id = 'playerVideoDefaultsStyles';
  style.textContent = `
    .championship .playerTrainingVideoBtn{width:100%;margin-top:10px;padding:8px 10px;border:1px solid #d8ad5c78;border-radius:7px;background:linear-gradient(135deg,#c998351f,#0b1c2c);color:#f2ce87;font:800 10px/1.35 Arial,"Malgun Gothic",sans-serif;letter-spacing:.02em;cursor:pointer;position:relative;z-index:4}
    .championship .playerTrainingVideoBtn span{display:inline-block;margin-right:5px;color:#fff1c6}
    .championship .playerVideoPending{width:100%;margin-top:10px;padding:8px 10px;border:1px solid #71829642;border-radius:7px;background:#ffffff05;color:#91a2b6;font:750 10px/1.35 Arial,"Malgun Gothic",sans-serif;text-align:center;position:relative;z-index:3}
    .playerVideoDialog{width:min(720px,calc(100vw - 32px));max-width:720px;padding:0;border:1px solid #d1aa627a;border-radius:16px;background:#06111d;color:#f7f0e1;box-shadow:0 30px 90px #000d;overflow:hidden}
    .playerVideoDialog::backdrop{background:#000b;backdrop-filter:blur(5px)}
    .playerVideoDialogHead{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px;border-bottom:1px solid #c9a25a38;background:linear-gradient(135deg,#0c2034,#07111d)}
    .playerVideoDialogHead>div{min-width:0}.playerVideoDialogKicker{display:block;color:#d8b66f;font-size:9px;font-weight:850;letter-spacing:.16em;margin-bottom:3px}.playerVideoDialogTitle{margin:0;color:#fff;font-size:18px;line-height:1.35;letter-spacing:-.03em}
    .playerVideoClose{flex:0 0 36px;width:36px;height:36px;border-radius:50%;border:1px solid #d0ae6a55;background:#ffffff08;color:#fff;font-size:24px;line-height:1;cursor:pointer}
    .playerVideoFrame{position:relative;width:100%;aspect-ratio:16/9;background:#000}.playerVideoFrame iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#000}
    .playerVideoNote{margin:0;padding:11px 16px 14px;color:#93a7bc;font-size:10px;line-height:1.6;text-align:center}
    @media(max-width:700px){.championship .playerTrainingVideoBtn,.championship .playerVideoPending{margin-top:7px;padding:7px 5px;font-size:8px;border-radius:5px}.championship .playerTrainingVideoBtn span{margin-right:3px}.playerVideoDialog{width:calc(100vw - 24px);border-radius:12px}.playerVideoDialogHead{padding:13px 14px}.playerVideoDialogTitle{font-size:16px}.playerVideoNote{font-size:9px;padding:9px 12px 12px}}
  `;
  document.head.append(style);
}

function ensureVideoDialog() {
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
    const triggerId = dialog.dataset.triggerId || '';
    if (triggerId) document.getElementById(triggerId)?.focus({preventScroll:true});
    dialog.dataset.triggerId = '';
  });
  return dialog;
}

function openTrainingVideo(playerName, source, trigger) {
  const id = youtubeVideoId(source);
  if (!id) return;
  const dialog = ensureVideoDialog();
  const frame = dialog.querySelector('#playerVideoFrame');
  const title = dialog.querySelector('#playerVideoDialogTitle');
  if (title) title.textContent = `${maskPlayerName(playerName)} · 훈련영상`;
  if (frame) frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&playsinline=1&rel=0`;
  if (trigger) {
    if (!trigger.id) trigger.id = `playerVideoDefault_${Math.random().toString(36).slice(2,9)}`;
    dialog.dataset.triggerId = trigger.id;
  }
  if (!dialog.open) dialog.showModal();
}

async function loadPlayerVideoRecords() {
  const records = new Map([...DEFAULT_PLAYER_VIDEOS].map(([name,video]) => [maskPlayerName(name), {name,video}]));
  const pending = new Set([...VIDEO_PENDING_PLAYERS].map(maskPlayerName));
  try {
    const [{getApps}, {getFirestore,collection,getDocs}] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js'),
    ]);
    const app = getApps()[0];
    if (!app) return {records,pending};
    const snapshot = await getDocs(collection(getFirestore(app),'players'));
    snapshot.docs.forEach(docSnap => {
      const player = docSnap.data();
      const masked = maskPlayerName(player.name);
      if (player.hidden === true || player.hidden === 'true') {
        records.delete(masked);
        pending.delete(masked);
        return;
      }
      const saved = String(player.video || player.videoUrl || player.youtube || '').trim();
      if (saved && youtubeVideoId(saved)) {
        records.set(masked,{name:player.name,video:saved});
        pending.delete(masked);
      }
    });
  } catch (error) {
    console.warn('선수 기본 훈련영상 정보를 불러오지 못했습니다.',error);
  }
  return {records,pending};
}

async function installDefaultPlayerVideos() {
  const playerList = document.getElementById('playerList');
  if (!playerList || document.getElementById('players_name')) return;
  injectStyles();
  const {records,pending} = await loadPlayerVideoRecords();

  const decorate = () => {
    playerList.querySelectorAll('.playerInteractive').forEach(card => {
      const masked = card.querySelector('h3')?.textContent?.trim() || '';
      const existingButton = card.querySelector('.playerTrainingVideoBtn');
      const existingPending = card.querySelector('.playerVideoPending');
      const record = records.get(masked);

      if (record) {
        existingPending?.remove();
        if (existingButton) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'playerTrainingVideoBtn';
        button.innerHTML = '<span aria-hidden="true">▶</span> 훈련영상 보기';
        button.setAttribute('aria-label',`${masked} 선수 훈련영상 보기`);
        button.addEventListener('click',event => {
          event.stopPropagation();
          openTrainingVideo(record.name,record.video,button);
        });
        button.addEventListener('keydown',event => event.stopPropagation());
        card.append(button);
        return;
      }

      if (pending.has(masked) && !existingButton && !existingPending) {
        const status = document.createElement('div');
        status.className = 'playerVideoPending';
        status.textContent = '영상 준비중';
        status.setAttribute('aria-label',`${masked} 선수 훈련영상 준비중`);
        card.append(status);
      }
    });
  };

  decorate();
  new MutationObserver(decorate).observe(playerList,{childList:true,subtree:true});
}

if (typeof document !== 'undefined') {
  const start = () => installDefaultPlayerVideos();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
}
