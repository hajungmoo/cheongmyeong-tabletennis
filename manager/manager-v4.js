/* MANAGER PRO 4.0: presentation and guarded league operations.
 * Existing storage keys, Firebase, migrations and ranking rules remain authoritative.
 * Opening, filtering, navigating and copying never save application data.
 */
(function (root) {
  'use strict';
  const hasResults = league => Boolean(league?.games?.some(game => game.result));
  const formatOf = league => league?.matchFormat === '3set' ? '3set' : '5set';
  const validScore = (value, league) => {
    if (value === '' || value === '기권') return true;
    const match = /^(\d)[:-](\d)$/.exec(value);
    if (!match) return false;
    const a = +match[1], b = +match[2], target = formatOf(league) === '3set' ? 2 : 3;
    return Math.max(a, b) === target && Math.min(a, b) < target;
  };
  const filterGames = (games, { query = '', status = 'all', round = '' } = {}, describe = () => '') => {
    const q = query.trim().toLocaleLowerCase();
    return games.filter(game => (!q || describe(game).toLocaleLowerCase().includes(q)) &&
      (status === 'all' || (status === 'pending' ? !game.result : Boolean(game.result))) &&
      (!round || String(game.round || 0) === String(round)));
  };
  const progress = league => {
    const total = league?.games?.length || 0;
    const done = league?.games?.filter(game => game.result).length || 0;
    return { total, done, pending: total - done, percent: total ? Math.round(done / total * 100) : 0 };
  };
  const canUndo = (league, entry) => {
    if (!league || !entry || league.id !== entry.leagueId) return false;
    const game = league.games.find(game => game.gameNo === entry.gameNo && game.p1 === entry.p1 && game.p2 === entry.p2);
    return Boolean(game && JSON.stringify(game) === entry.after);
  };
  const api = { hasResults, formatOf, validScore, filterGames, progress, canUndo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
  root.CMOps = api;

  const $ = id => document.getElementById(id);
  const all = selector => [...document.querySelectorAll(selector)];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const data = () => root.__cmDb;
  const leagueNow = () => typeof currentLeague === 'function' ? currentLeague() : null;
  const name = id => player(id)?.name || '등록 정보 없음';
  const schoolName = id => school(player(id)?.schoolId)?.name || '';
  const describe = game => `${game.gameNo} ${name(game.p1)} ${schoolName(game.p1)} ${name(game.p2)} ${schoolName(game.p2)}`;
  const filters = { query: '', status: 'all', round: '' };
  let filteredLeagueId = null, leagueQuery = '', undo = [], toastTimer, lastFocus = null;
  const original = {};
  const wrap = (key, handler) => {
    if (typeof root[key] !== 'function') return;
    original[key] = root[key];
    root[key] = function (...args) { return handler(original[key], ...args); };
  };
  const toast = message => {
    $('opsToast').textContent = message;
    $('opsToast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('opsToast').hidden = true; }, 5000);
  };
  const button = (label, action, cls = 'ghost') => `<button type="button" class="btn ${cls}" data-ops-action="${action}">${label}</button>`;
  const iconPaths = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    match: '<path d="M12 5v14M5 12h14"/>',
    league: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16M15 4v16"/>',
    analysis: '<path d="M4 4v16h16M8 15v-4M13 15V7M18 15v-6"/>',
    history: '<path d="M8 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7zM8 3v5H4M9 12h6M9 16h6"/>',
    results: '<path d="M8 3h8v6a4 4 0 0 1-8 0zM8 5H4v3a4 4 0 0 0 4 4M16 5h4v3a4 4 0 0 1-4 4M12 13v5M8 21h8M9 18h6"/>',
    players: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v3"/>',
    schools: '<path d="M4 21V7l8-4 8 4v14M2 21h20M9 21v-5h6v5M8 9h1M15 9h1M8 12h1M15 12h1"/>',
    storage: '<path d="M4 4h13l3 3v13H4zM8 4v6h8V4M8 20v-6h8v6"/>'
  };
  const icon = key => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[key] || iconPaths.league}</svg>`;

  function buildShell() {
    document.body.classList.add('cm-pro4');
    document.documentElement.dataset.managerUiVersion = '4.0';
    document.title = '청명초 탁구부 · MANAGER PRO 4.0';
    document.body.insertAdjacentHTML('beforeend', '<div id="opsToast" class="opsToast" role="status" aria-live="polite" hidden></div><dialog id="opsCopyDialog" class="opsDialog" aria-labelledby="opsCopyTitle"><div class="opsDialogHead"><h2 id="opsCopyTitle">리그 결과 요약</h2><button type="button" class="btn ghost" data-ops-action="close-copy" aria-label="닫기">닫기</button></div><p>내용을 확인하고 카카오톡에 붙여넣으세요.</p><textarea id="opsCopyText" readonly aria-label="복사할 리그 결과"></textarea><div class="actions"><button type="button" class="btn" data-ops-action="copy-text">내용 복사</button><span id="opsCopyStatus" role="status"></span></div></dialog>');
    document.querySelector('.topEdition').textContent = 'PRO 4.0';
    document.querySelector('.topKicker').textContent = 'CHEONGMYEONG TABLE TENNIS';
    document.querySelector('.brand small').textContent = 'MANAGER PRO 4.0';
    const labels = { dashboard: '오늘의 기록', match: '경기 입력', league: '리그전', history: '경기 기록', analysis: '선수 분석', results: '대회 성적', players: '선수 · 랭킹', schools: '학교', storage: '데이터 관리' };
    const nav = document.querySelector('.nav');
    ['dashboard', 'match', 'league', 'history', 'analysis', 'results', 'players', 'schools', 'storage'].forEach((key, i) => {
      const b = nav.querySelector(`[data-tab="${key}"]`);
      b.querySelector('.ico').innerHTML = icon(key);
      b.querySelector('span').textContent = labels[key];
      b.title = labels[key]; b.setAttribute('aria-label', labels[key]);
      if (i === 4) b.classList.add('opsNavDivider');
      nav.appendChild(b);
      b.addEventListener('click', () => {
        $('topTitle').textContent = labels[key];
        all('.nav [data-tab]').forEach(item => item.setAttribute('aria-current', item === b ? 'page' : 'false'));
        nav.classList.remove('opsMoreOpen');
        $('opsMoreNav').setAttribute('aria-expanded', 'false');
        if (key === 'league' && leagueNow()?.games?.length && $('lv_slots').classList.contains('active')) setLeagueView('schedule', document.querySelector('[data-lview="schedule"]'));
        refresh();
      });
    });
    nav.insertAdjacentHTML('beforeend', '<button type="button" id="opsMoreNav" data-ops-action="more-nav" aria-expanded="false" aria-label="전체 메뉴"><i class="ico">•••</i><span>더보기</span></button>');
    nav.querySelector('[data-tab="dashboard"]').setAttribute('aria-current', 'page');
    $('topTitle').textContent = labels.dashboard;
    document.querySelector('.topQuickBtn[onclick="exportTodayBackup()"]')?.remove();
    document.querySelector('.commandMain h2').innerHTML = '오늘의 훈련, <span>기록부터.</span>';
    document.querySelector('.commandMain > p').textContent = '경기 결과를 입력하고 선수들의 변화를 확인하세요.';
    document.querySelector('.commandMain > .sectionCode').textContent = '청명초 탁구부';
    all('.commandActions button').forEach(b => {
      const key = b.getAttribute('onclick').match(/goTab\('([^']+)'\)/)?.[1];
      b.querySelector('i').innerHTML = icon(key);
      b.querySelector('b').textContent = labels[key] || b.querySelector('b').textContent;
    });
    document.querySelector('.statusHead span').textContent = '팀 현황';
    document.querySelector('.statusHead b').textContent = '청명초 탁구부';
    document.querySelector('.statusBackup')?.remove();
    document.querySelector('.metricDeck').insertAdjacentHTML('afterend', '<div id="opsResume" class="opsResume" hidden></div>');
    const matchBanner = document.querySelector('#match .pageBanner');
    matchBanner.querySelector('h2').textContent = '경기 입력';
    matchBanner.querySelector('p').textContent = '우리 선수 기준 점수를 선택하세요. 저장 상태는 상단에서 확인할 수 있습니다.';
    matchBanner.querySelector('.bannerBadge')?.remove();
    document.querySelector('#history .pageBanner h2').textContent = '경기 기록';
    document.querySelector('#league .pageBanner p').textContent = '참가자 등록부터 경기 결과와 순위까지 한곳에서 관리합니다.';
    document.querySelector('#league .pageBanner').insertAdjacentHTML('afterend', '<div id="opsLeagueSummary" class="opsLeagueSummary"></div>');
    $('leagueList').insertAdjacentHTML('beforebegin', '<label class="opsSearchLabel" for="opsLeagueSearch">저장 리그 검색</label><input type="search" id="opsLeagueSearch" placeholder="리그 제목 · 날짜" autocomplete="off">');
    $('leagueAuto').textContent = '결과 입력';
    $('leagueFormat').setAttribute('tabindex', '-1');
    const actions = document.querySelector('#league .actions');
    const more = document.createElement('details'); more.className = 'opsMoreActions';
    more.innerHTML = '<summary>리그 관리</summary><div class="actions"></div>';
    ['removeLeagueSlot()', 'cloneLeague()', 'deleteLeague()'].forEach(action => {
      const b = actions.querySelector(`[onclick="${action}"]`);
      if (b) more.querySelector('.actions').appendChild(b);
    });
    actions.appendChild(more);
    actions.insertAdjacentHTML('beforeend', button('결과 요약', 'summary'));
    document.querySelector('#league .pdfNote').textContent = '결과가 있는 리그는 참가자·대진·경기 방식 변경이 잠깁니다. 바꿔서 진행하려면 리그 관리에서 복제하세요.';
    $('lv_schedule').insertAdjacentHTML('beforebegin', '<div id="opsScheduleTools" class="opsScheduleTools" hidden><div class="opsFilterRow"><input type="search" id="opsGameSearch" aria-label="경기 선수 또는 학교 검색" placeholder="선수 · 학교 · 경기번호 검색"><select id="opsGameRound" aria-label="라운드 선택"><option value="">전체 라운드</option></select><div class="opsSegments" role="group" aria-label="경기 진행 상태"><button type="button" data-ops-status="all" aria-pressed="true">전체</button><button type="button" data-ops-status="pending" aria-pressed="false">미입력</button><button type="button" data-ops-status="done" aria-pressed="false">입력 완료</button></div></div><div class="opsScheduleMeta"><span id="opsFilteredCount" role="status"></span><div class="actions">' + button('다음 미입력', 'next') + '<button type="button" class="btn ghost" id="opsUndo" data-ops-action="undo" disabled>입력 되돌리기</button></div></div></div>');
    const scoreHeader = document.querySelector('.scoreHeader');
    scoreHeader.insertAdjacentHTML('afterend', '<div class="opsScoreTools"><div class="opsSegments" role="group" aria-label="일반 경기 세트 수"><button type="button" data-ops-format="5set" aria-pressed="true">5세트 · 3선승</button><button type="button" data-ops-format="3set" aria-pressed="false">3세트 · 2선승</button></div><span>점수는 우리 선수 기준입니다.</span></div>');
    all('.scoreRows .scoreRow').forEach((row, i) => { row.dataset.opsScoreFormat = i === 0 ? '5set' : '3set'; });
    setEntryFormat('5set');
    // Infrequent database maintenance stays available, with the roster first.
    const playersCard = document.querySelector('#players > .card');
    const maintenance = document.createElement('details'); maintenance.className = 'opsMaintenance';
    maintenance.innerHTML = '<summary>선수 등록 · 랭킹 업데이트</summary>';
    ['.manualPlayerRegister', '.importZone'].forEach(selector => {
      const el = playersCard.querySelector(selector); if (el) maintenance.appendChild(el);
    });
    playersCard.querySelector('.filters').before(maintenance);
    const historyHead = document.querySelector('#history .chead');
    historyHead.insertAdjacentHTML('beforeend', button('오늘', 'history-today') + button('필터 초기화', 'history-reset'));
    all('label').forEach(label => {
      const control = label.parentElement?.querySelector('input:not([type="hidden"]),select,textarea');
      if (!label.htmlFor && control?.id && !label.classList.contains('btn')) label.htmlFor = control.id;
    });
    all('input:not([type="hidden"]), select, textarea').forEach(el => {
      if (!el.getAttribute('aria-label') && ![...document.querySelectorAll('label[for]')].some(label => label.htmlFor === el.id)) el.setAttribute('aria-label', el.placeholder || el.options?.[0]?.textContent || '입력');
    });
  }

  function setEntryFormat(format) {
    all('[data-ops-format]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.opsFormat === format)));
    all('[data-ops-score-format]').forEach(row => { row.hidden = row.dataset.opsScoreFormat !== format; });
  }

  function renderList() {
    const leagues = [...(data()?.leagues || [])].sort((a, b) => String(b.date || '').localeCompare(a.date || ''));
    const q = leagueQuery.trim().toLocaleLowerCase();
    $('leagueList').innerHTML = leagues.filter(l => `${l.title} ${l.date}`.toLocaleLowerCase().includes(q)).map(l => {
      const p = progress(l);
      return `<button type="button" class="leagueItem ${l.id === leagueNow()?.id ? 'active' : ''}" data-ops-league="${escape(l.id)}" aria-pressed="${l.id === leagueNow()?.id}"><div class="opsLeagueItemTop"><span>${escape(l.date)}</span><span>${p.total ? p.pending ? '진행 중' : '입력 완료' : '준비'}</span></div><b>${escape(l.title || '리그전')}</b><small>${l.participants.filter(Boolean).length}명 · ${formatOf(l) === '3set' ? '3세트' : '5세트'} · ${p.done}/${p.total}경기</small><progress max="${p.total || 1}" value="${p.done}" aria-label="입력 진행률"></progress></button>`;
    }).join('') || '<div class="empty">해당 리그가 없습니다.</div>';
  }

  function syncTools() {
    const l = leagueNow(), p = progress(l);
    const entry = [...undo].reverse().find(entry => entry.leagueId === l?.id);
    $('opsUndo').disabled = !canUndo(l, entry);
    $('opsScheduleTools').hidden = !$('lv_schedule').classList.contains('active') || !l?.games?.length;
    $('leagueAuto').textContent = p.total ? `${p.done} / ${p.total}경기 입력` : '참가자 등록';
    all('.leagueFormatChoice').forEach(b => {
      const active = l && b.dataset.format === formatOf(l);
      b.classList.toggle('active', Boolean(active)); b.setAttribute('aria-pressed', String(Boolean(active)));
      b.setAttribute('aria-disabled', String(!l || (hasResults(l) && !active)));
    });
    all('.subtabs [data-lview]').forEach(b => b.setAttribute('aria-pressed', String($('lv_' + b.dataset.lview).classList.contains('active'))));
    $('opsLeagueSummary').innerHTML = l ? `<div><span class="opsEyebrow">선택한 리그</span><strong>${escape(l.title || '리그전')}</strong><small>${escape(l.date)} · ${l.participants.filter(Boolean).length}명 · ${formatOf(l) === '3set' ? '3세트 · 2선승' : '5세트 · 3선승'}</small></div><div class="opsProgress"><span><b>${p.done}</b> / ${p.total}경기 입력 <em>${p.percent}%</em></span><progress max="${p.total || 1}" value="${p.done}" aria-label="현재 리그 결과 입력 진행률"></progress><small>${p.pending ? `${p.pending}경기 미입력` : p.total ? '모든 경기 입력 완료' : '참가자를 등록하고 대진을 생성하세요.'}</small></div>` : '<div class="empty">새 리그를 만들어 시작하세요.</div>';
  }

  function renderScheduleV4() {
    const l = leagueNow();
    if (!l) { $('lv_schedule').innerHTML = '<div class="empty">리그를 선택하세요.</div>'; syncTools(); return; }
    if (filteredLeagueId !== l.id) {
      filteredLeagueId = l.id; filters.query = ''; filters.status = 'all'; filters.round = '';
      $('opsGameSearch').value = '';
    }
    const rounds = [...new Set(l.games.map(g => String(g.round || 0)))].sort((a, b) => +a - +b);
    if (filters.round && !rounds.includes(filters.round)) filters.round = '';
    $('opsGameRound').innerHTML = '<option value="">전체 라운드</option>' + rounds.map(r => `<option value="${escape(r)}">${r === '0' ? '기존 경기' : r + '라운드'}</option>`).join('');
    $('opsGameRound').value = filters.round;
    all('[data-ops-status]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.opsStatus === filters.status)));
    const games = filterGames(l.games, filters, describe);
    $('opsFilteredCount').textContent = `${games.length}경기 표시 · 전체 ${l.games.length}경기`;
    if (!l.games.length) $('lv_schedule').innerHTML = '<div class="empty">참가자를 등록한 뒤 경기순서를 생성하세요.</div>';
    else if (!games.length) $('lv_schedule').innerHTML = '<div class="empty">조건에 맞는 경기가 없습니다. 검색 또는 진행 상태를 바꿔보세요.</div>';
    else {
      const grouped = new Map();
      games.forEach(g => { const r = g.round || 0; if (!grouped.has(r)) grouped.set(r, []); grouped.get(r).push(g); });
      $('lv_schedule').innerHTML = [...grouped].map(([r, gs]) => `<div class="round"><div class="roundHead">${r ? escape(r) + '라운드' : '기존 경기'}<span>${gs.filter(g => g.result).length} / ${gs.length} 입력</span></div>${gs.map(g => {
        const a = name(g.p1), b = name(g.p2);
        const score = parseLeagueResult(g.result);
        const selected = g.result === '기권' ? g.forfeitPid === g.p1 ? 'forfeit1' : g.forfeitPid === g.p2 ? 'forfeit2' : '기권' : score ? `${score.a}-${score.b}` : g.result || '';
        const opts = leagueResultOpts(l).filter(o => o !== '기권').map(o => [o, o ? o.replace('-', ' : ') : '결과 선택']);
        opts.push(['forfeit1', `${a} 기권`], ['forfeit2', `${b} 기권`]);
        if (selected && !opts.some(([v]) => v === selected)) opts.push([selected, `${g.result} · 기존 기록`]);
        const rscore = leagueGameScore(g, l);
        return `<div class="matchRow ${g.result ? 'opsComplete' : ''}" data-ops-game="${g.gameNo}"><div class="matchNo">${g.gameNo}</div><div class="matchName ${rscore?.a > rscore?.b ? 'opsWinner' : ''}">${escape(a)}<small>${escape(schoolName(g.p1))}</small></div><div class="opsResultControl"><label class="opsSrOnly" for="opsScore${g.gameNo}">${escape(a)} 대 ${escape(b)} 결과</label><select id="opsScore${g.gameNo}" data-ops-score="${g.gameNo}">${opts.map(([v, label]) => `<option value="${escape(v)}" ${selected === v ? 'selected' : ''}>${escape(label)}</option>`).join('')}</select><span>${g.result ? g.result === '기권' ? escape(g.forfeitPid ? name(g.forfeitPid) + ' 기권' : '기권 선수 미지정') : '입력 완료' : '미입력'}</span></div><div class="matchName ${rscore?.b > rscore?.a ? 'opsWinner' : ''}">${escape(b)}<small>${escape(schoolName(g.p2))}</small></div></div>`;
      }).join('')}</div>`).join('');
    }
    syncTools();
  }

  function renderResume() {
    const league = [...(data()?.leagues || [])].filter(l => l.games?.length && l.games.some(g => !g.result)).sort((a, b) => String(b.date || '').localeCompare(a.date || ''))[0];
    $('opsResume').hidden = !league;
    if (!league) return;
    const p = progress(league);
    $('opsResume').innerHTML = `<div class="opsResumeIcon">${icon('league')}</div><div><span>진행 중인 리그</span><b>${escape(league.title)}</b><small>${escape(league.date)} · ${p.done}/${p.total}경기 입력</small></div><button type="button" class="btn" data-ops-resume="${escape(league.id)}">이어서 입력 <span aria-hidden="true">→</span></button>`;
  }

  function refresh() { renderList(); syncTools(); renderResume(); }
  function guardRebuild(fn, ...args) {
    if (hasResults(leagueNow())) {
      toast('입력된 결과를 보호하고 있습니다. 리그 관리 → 리그 복제로 새 리그를 만들어 변경하세요.');
      const select = $('leagueFormat'); if (select && leagueNow()) select.value = formatOf(leagueNow());
      syncTools(); return;
    }
    if (!leagueNow()) { toast('먼저 새 리그를 만들어주세요.'); return; }
    return fn(...args);
  }
  function rememberChange(l, g, before) {
    if (JSON.stringify(g) === before) return;
    undo.push({ leagueId: l.id, gameNo: g.gameNo, p1: g.p1, p2: g.p2, before, after: JSON.stringify(g) });
    undo = undo.slice(-30);
  }
  function undoScore() {
    const l = leagueNow();
    const index = undo.findLastIndex(entry => entry.leagueId === l?.id);
    const entry = undo[index];
    if (!canUndo(l, entry)) { toast('기록이 이후에 변경되어 되돌릴 수 없습니다. 현재 결과를 확인해주세요.'); syncTools(); return; }
    const game = l.games.find(g => g.gameNo === entry.gameNo && g.p1 === entry.p1 && g.p2 === entry.p2);
    const previous = JSON.parse(entry.before);
    ['result', 'forfeitPid'].forEach(key => { if (Object.hasOwn(previous, key)) game[key] = previous[key]; else delete game[key]; });
    undo.splice(index, 1); l.updatedAt = new Date().toISOString(); save(); renderLeagueViews();
    refresh(); toast(`${entry.gameNo}번 경기 입력을 되돌렸습니다.`);
  }
  function nextGame() {
    const l = leagueNow(); if (!l) return;
    const next = filterGames(l.games, { ...filters, status: 'pending' }, describe)[0];
    if (!next) { toast('현재 검색 조건의 미입력 경기가 없습니다.'); return; }
    filters.status = 'pending'; setLeagueView('schedule', document.querySelector('[data-lview="schedule"]')); renderScheduleV4();
    const target = $('opsScore' + next.gameNo);
    target?.scrollIntoView({ block: 'center', behavior: root.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    target?.focus({ preventScroll: true });
  }
  function summaryText() {
    const l = leagueNow(); if (!l) return '';
    const p = progress(l), standings = leagueStandings(l);
    const lines = [`🏓 ${l.title || '리그전'}`, `${l.date || ''} · ${leagueFormatLabel(l)}`, `${l.participants.filter(Boolean).length}명 · ${p.done}/${p.total}경기 입력`, ''];
    if (!p.done) lines.push('아직 입력된 경기 결과가 없습니다.');
    else {
      lines.push(p.pending ? '현재 순위 (진행 중)' : '최종 순위');
      standings.forEach(x => lines.push(`${x.rank}위 ${name(x.pid)} (${schoolName(x.pid)}) · ${x.w}승 ${x.l}패 · 세트 ${x.sf}:${x.sa}`));
    }
    if (l.games.some(g => g.result === '기권' && !g.forfeitPid)) lines.push('', '※ 기권 선수가 지정되지 않은 경기는 순위 계산에서 제외되어 있습니다.');
    return lines.join('\n');
  }
  function openSummary() {
    if (!leagueNow()) return toast('먼저 리그를 선택해주세요.');
    $('opsCopyText').value = summaryText(); $('opsCopyStatus').textContent = ''; lastFocus = document.activeElement;
    $('opsCopyDialog').showModal();
  }
  async function copySummary() {
    try { await navigator.clipboard.writeText($('opsCopyText').value); $('opsCopyStatus').textContent = '복사했습니다. 카카오톡에 붙여넣으세요.'; }
    catch (_) { $('opsCopyText').focus(); $('opsCopyText').select(); $('opsCopyStatus').textContent = '선택된 내용을 복사해주세요. (Ctrl+C 또는 길게 누르기)'; }
  }

  buildShell();
  ['addLeagueSlot', 'removeLeagueSlot', 'removeSlotAt', 'setLeaguePlayer', 'generateLeague', 'updateLeagueFormat'].forEach(key => wrap(key, guardRebuild));
  root.pro3ChooseLeagueFormat = format => {
    if (!['3set', '5set'].includes(format) || !leagueNow()) return;
    if (format === formatOf(leagueNow())) return;
    $('leagueFormat').value = format; updateLeagueFormat(); syncTools();
  };
  wrap('setLeagueResult', (fn, gameNo, value, forfeitPid) => {
    const l = leagueNow(), g = l?.games.find(g => g.gameNo === gameNo);
    if (!g || !validScore(value, l)) { toast('이 리그의 세트 수에 맞는 점수를 선택해주세요.'); renderScheduleV4(); return; }
    if (value === '기권' && forfeitPid !== undefined && ![g.p1, g.p2].includes(forfeitPid)) return;
    const before = JSON.stringify(g);
    if (g.result === value && (value !== '기권' || forfeitPid === undefined || g.forfeitPid === forfeitPid)) return;
    if (value === '기권' && forfeitPid !== undefined) g.forfeitPid = forfeitPid;
    fn(gameNo, value);
    rememberChange(l, g, before); refresh();
    toast(`${name(g.p1)} · ${name(g.p2)} ${value || '결과 지움'}${value ? ' 입력됨' : ''}`);
    $('opsScore' + gameNo)?.focus({ preventScroll: true });
  });
  // Refresh only after application events; the old 800 ms polling loop is removed.
  root.renderSchedule = renderScheduleV4;
  root.renderLeagueList = renderList;
  ['renderLeague', 'renderLeagueViews', 'renderDashboard', 'setLeagueView'].forEach(key => wrap(key, (fn, ...args) => { const result = fn(...args); refresh(); return result; }));
  wrap('newLeague', fn => {
    leagueQuery = ''; $('opsLeagueSearch').value = '';
    const result = fn();
    setLeagueView('slots', document.querySelector('[data-lview="slots"]'));
    return result;
  });
  root.addEventListener('cm-cloud-data', () => { undo = []; refresh(); });
  $('opsLeagueSearch').addEventListener('input', event => { leagueQuery = event.target.value; renderList(); });
  $('opsGameSearch').addEventListener('input', event => { filters.query = event.target.value; renderScheduleV4(); });
  $('opsGameRound').addEventListener('change', event => { filters.round = event.target.value; renderScheduleV4(); });
  $('opsCopyDialog').addEventListener('close', () => lastFocus?.focus());
  document.addEventListener('change', event => {
    const el = event.target.closest('[data-ops-score]'); if (!el) return;
    const gameNo = Number(el.dataset.opsScore), game = leagueNow()?.games.find(g => g.gameNo === gameNo);
    if (!game) return;
    if (el.value === 'forfeit1' || el.value === 'forfeit2') setLeagueResult(gameNo, '기권', el.value === 'forfeit1' ? game.p1 : game.p2);
    else setLeagueResult(gameNo, el.value);
  });
  document.addEventListener('click', event => {
    const el = event.target.closest('[data-ops-action],[data-ops-status],[data-ops-format],[data-ops-league],[data-ops-resume]');
    if (!el) return;
    if (el.dataset.opsStatus) { filters.status = el.dataset.opsStatus; renderScheduleV4(); return; }
    if (el.dataset.opsFormat) { setEntryFormat(el.dataset.opsFormat); return; }
    if (el.dataset.opsLeague || el.dataset.opsResume) {
      selectLeague(el.dataset.opsLeague || el.dataset.opsResume);
      if (el.dataset.opsResume) goTab('league');
      if (leagueNow()?.games?.length) setLeagueView('schedule', document.querySelector('[data-lview="schedule"]'));
      else setLeagueView('slots', document.querySelector('[data-lview="slots"]'));
      return;
    }
    const action = el.dataset.opsAction;
    if (action === 'summary') openSummary();
    if (action === 'copy-text') copySummary();
    if (action === 'close-copy') $('opsCopyDialog').close();
    if (action === 'undo') undoScore();
    if (action === 'next') nextGame();
    if (action === 'more-nav') { const open = document.querySelector('.nav').classList.toggle('opsMoreOpen'); el.setAttribute('aria-expanded', String(open)); }
    if (action === 'history-reset') { ['hDate', 'hPlayer', 'hSchool', 'hCat', 'hSearch'].forEach(id => { $(id).value = ''; }); renderHistory(); }
    if (action === 'history-today') { $('hDate').value = localToday(); renderHistory(); }
  });
  renderScheduleV4(); refresh();
})(typeof window === 'undefined' ? globalThis : window);
