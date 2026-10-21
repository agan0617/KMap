// 畫面與玩法流程：首頁、找位置／知識找地點／今日挑戰／限時連擊、鄰接旅行、圖鑑、御朱印帳。
// 畫面上的文字一律走 t()（js/i18n.js），地名與知識卡走 R.name()／R.card()（js/regions.js）。
const $ = s => document.querySelector(s);
const ROUND = 10, TIMED_SEC = 60;

let R = null;          // 目前的地區資料
let homeMap = null, playMap = null;
let P = null;          // 目前這一局的狀態
let bgmStyle = 'calm';

// ── 共用小工具 ──
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const lv = n => t('lv')[n];
function mixColor(hex, k) {
  const p = [0xec, 0xe5, 0xd3], c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return '#' + c.map((v, i) => Math.round(p[i] + (v - p[i]) * k).toString(16).padStart(2, '0')).join('');
}
function masteryColor(id) {
  const n = Store.level(R.key, id);
  if (!n) return '';
  return mixColor(R.areas[R.units[id].area].color, [0, 0.32, 0.62, 1][n]);
}
let toastTimer = null;
function toast(html, ms = 1600) {
  const el = $('#toast');
  el.innerHTML = html; el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}
function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
}
function music(style) {
  bgmStyle = style;
  Sound.bgm(R.key, Store.settings().bgm ? style : null);
}
function openModal(html, onClose) {
  $('#modalBody').innerHTML = html;
  $('#modal').hidden = false;
  $('#modal')._onClose = onClose;
}
function closeModal() {
  $('#modal').hidden = true;
  const f = $('#modal')._onClose; $('#modal')._onClose = null;
  f?.();
}
const nameHtml = id => `${esc(R.name(id))}<small>${esc(R.sub(id))}</small>`;

// ── 語言 ──
// index.html 裡的固定文字用 data-t（內文）、data-ta（aria-label）標 key
function applyLang() {
  const L = LANGS.find(x => x.key === lang());
  document.documentElement.lang = L.html;
  document.title = t('appName');
  for (const e of document.querySelectorAll('[data-t]')) e.textContent = t(e.dataset.t);
  for (const e of document.querySelectorAll('[data-ta]')) e.setAttribute('aria-label', t(e.dataset.ta));
  $('#langSwitch').innerHTML = LANGS.map(x => `<button type="button" data-lang="${x.key}" class="${x.key === L.key ? 'on' : ''}">${x.label}</button>`).join('');
}
function setLang(l) {
  Store.setSetting('lang', l);
  applyLang();
  renderTabs();
  if (!$('#home').hidden) renderHome();
  else if (!$('#book').hidden) renderBook();
  else if (P?.mode === 'explore') startExplore();
  else if (P?.mode === 'travel' && !P.done) travelPanel();
  // 答題中途切換：題目是出題當下的語言，從下一題起換新語言
}

// ── 首頁 ──
function renderTabs() {
  $('#regionTabs').innerHTML = REGIONS.map(g =>
    `<button type="button" class="tab ${g.key === R.key ? 'on' : ''} ${g.ready ? '' : 'soon'}" data-r="${g.key}">${esc(t('region.' + g.key))}${g.ready ? '' : `<small>${esc(t('soon'))}</small>`}</button>`).join('');
}
function renderHome() {
  if (!homeMap) {
    homeMap = createMap($('#homeMap'), R);
    homeMap.onTap(id => { Sound.play('tap'); showCard(id); });
  }
  homeMap.paint(masteryColor);
  const c = Store.counts(R.key, R.ids), n = R.ids.length;
  const seg = (k, cls) => c[k] ? `<i class="${cls}" style="flex:${c[k]}"></i>` : '';
  $('#homeProgress').innerHTML = `
    <div class="bar">${seg(3, 'l3')}${seg(2, 'l2')}${seg(1, 'l1')}${seg(0, 'l0')}</div>
    <div class="legend"><span class="l3">${lv(3)} ${c[3]}</span><span class="l2">${lv(2)} ${c[2]}</span><span class="l1">${lv(1)} ${c[1]}</span><span class="l0">${lv(0)} ${c[0]}</span><b>${c[3]} / ${n}</b></div>`;
  const d = Store.daily(R.key), st = Store.streak(R.key);
  $('#dailyInfo').textContent = (d == null ? t('dailyNone') : t('dailyDone', d, ROUND)) + (st ? t('streak', st) : '');
  $('#timedBest').textContent = Store.best(R.key, 'timed') ? t('timedBest', Store.best(R.key, 'timed')) : t('modeDesc.timed');
  $('#bookInfo').textContent = t('bookInfo', c[3], n);
}

// ── 知識卡 ──
function stampHtml(id, date) {
  return `<div class="stamp"><span>${esc(R.stamp(id))}</span>${date ? `<small>${esc(date.slice(5).replace('-', '.'))}</small>` : ''}</div>`;
}
function hintText(h) {
  if (h.k === 'wait') return t('hint.wait', h.n);
  if (h.k === 'need') return t('hint.need', h.modes.map(m => t('mode.' + m)).join(t('hint.sep')));
  if (h.k === 'stamped') return t('hint.stamped', h.date);
  return t('hint.' + h.k);
}
function cardHtml(id) {
  const u = R.units[id], n = Store.level(R.key, id), a = R.areas[u.area], rec = Store.unit(R.key, id), c = R.card(id);
  const chips = arr => arr.map(x => `<span class="chip">${esc(x)}</span>`).join('');
  const dots = [1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('');
  return `
  <div class="card" style="--area:${a.color}">
    <div class="card-head">
      <div><div class="card-area">${esc(R.areaName(u.area))}</div><h2>${esc(R.name(id))}</h2><div class="kana">${esc(R.sub(id))}</div></div>
      ${n === 3 ? stampHtml(id, rec?.stamped) : ''}
    </div>
    <div class="mastery"><span class="dots">${dots}</span><b>${lv(n)}</b><small>${esc(hintText(Store.nextHint(R.key, id)))}</small></div>
    <dl>
      <dt>${esc(c.capLabel)}</dt><dd>${esc(c.cap)}<small>${esc(c.capSub)}</small></dd>
      <dt>${esc(t('old'))}</dt><dd>${c.old.map(o => `${esc(o.n)}<small>${esc(o.sub)}</small>`).join(lang() === 'en' ? ', ' : '、')}</dd>
      <dt>${esc(t('foods'))}</dt><dd>${chips(c.foods)}</dd>
      <dt>${esc(t('sights'))}</dt><dd>${chips(c.sights)}</dd>
      <dt>${esc(t('fact'))}</dt><dd>${esc(c.fact.replace(/○○/g, R.short(id)))}</dd>
      <dt>${esc(t('dia'))}</dt><dd><b class="dia">${esc(c.dia.w)}</b> ${esc(c.dia.m)}</dd>
    </dl>
    <a class="src" href="${esc(c.wiki)}" target="_blank" rel="noopener">${esc(t('source', c.wikiTitle))}</a>
  </div>`;
}
function showCard(id) { openModal(cardHtml(id)); }

// ── 遊玩畫面 ──
function ensurePlayMap() {
  if (!playMap) playMap = createMap($('#playMap'), R);
  playMap.clearMarks('ok', 'ng', 'target', 'visited', 'goal', 'here');
  playMap.clearLabels(); playMap.clearMarkers(); playMap.showLinks(false); playMap.path(null);
  playMap.paint(masteryColor);
  playMap.reset();
}
function setPanel(prompt, feedback = '', actions = '') {
  $('#pPrompt').innerHTML = prompt;
  $('#pFeedback').innerHTML = feedback;
  $('#pActions').innerHTML = actions;
}
function setStat(html) { $('#pStat').innerHTML = html; }

function startMode(mode) {
  show('play');
  ensurePlayMap();
  $('#pTitle').textContent = t('mode.' + mode);
  $('#pTimer').hidden = mode !== 'timed';
  clearInterval(P?.timer);
  P = { mode, i: 0, score: 0, combo: 0, maxCombo: 0, ups: [], stamps: [], answered: false };
  if (mode === 'explore') return startExplore();
  if (mode === 'travel') return startTravel();
  music(mode === 'timed' ? 'fast' : 'calm');
  if (mode === 'daily') P.qs = Quiz.daily(R);
  else if (mode === 'timed') { P.qs = []; P.timer = setInterval(timedTick, 100); P.t0 = Date.now(); }
  else P.qs = Quiz.session(R, mode, ROUND);
  playMap.onTap(answer);
  nextQuestion();
}

// ── 答題流程 ──
function nextQuestion() {
  if (P.mode === 'timed') P.qs[P.i] = Quiz.session(R, 'mix', 1)[0];
  const q = P.qs[P.i];
  if (!q) return finishQuiz();
  P.answered = false;
  playMap.clearMarks('ok', 'ng', 'target'); playMap.clearLabels();
  const big = q.type === 'loc' || q.clue !== 'fact';
  setPanel(`<span class="tag ${q.type}">${esc(q.tag)}</span><div class="q-main ${big ? 'big' : ''}">${esc(q.main)}</div><div class="q-sub">${esc(q.sub)}</div>`);
  updateStat();
}
function updateStat() {
  const combo = P.combo > 1 ? `<span class="combo">${t('combo', P.combo)}</span>` : '';
  if (P.mode === 'timed') setStat(t('score', P.score) + combo);
  else setStat(`${Math.min(P.i + 1, P.qs.length)} / ${P.qs.length}${combo}`);
}
function answer(id) {
  if (P.answered || !P.qs?.[P.i]) return;
  const q = P.qs[P.i], ok = id === q.id;
  P.answered = true;
  const ch = Store.record(R.key, q.id, q.type, ok);
  if (ch.to > ch.from) {
    P.ups.push({ id: q.id, to: ch.to });
    if (ch.to === 3) { P.stamps.push(q.id); toast(`${stampHtml(q.id)}<b>${esc(t('mastered', R.short(q.id)))}</b>`, 1800); Sound.play('stamp'); }
    else setTimeout(() => Sound.play('level'), 250);
  }
  playMap.paint(masteryColor);
  const cardBtn = `<button type="button" class="btn" data-card="${q.id}">${esc(t('card'))}</button>`;
  const nextBtn = `<button type="button" class="btn primary" data-next>${esc(t('next'))}</button>`;
  if (ok) {
    P.combo++; P.maxCombo = Math.max(P.maxCombo, P.combo);
    P.score += P.mode === 'timed' ? 1 + Math.floor(P.combo / 5) : 1;
    Sound.play('ok', P.combo - 1);
    playMap.mark(id, 'ok'); playMap.label(id, R.short(id), 'ok');
    const up = ch.to > ch.from && ch.to < 3 ? `<span class="up">${esc(t('up', lv(ch.to)))}</span>` : '';
    setPanel($('#pPrompt').innerHTML, `<div class="fb ok">${esc(t('ok'))}${q.type === 'know' ? '　' + nameHtml(q.id) : ''}${up}</div>`,
      P.mode === 'timed' ? '' : `${q.type === 'know' ? cardBtn : ''}${nextBtn}`);
    P.auto = setTimeout(advance, P.mode === 'timed' ? 450 : 1300);
  } else {
    P.combo = 0;
    Sound.play('ng');
    playMap.mark(id, 'ng'); playMap.label(id, R.short(id), 'ng');
    playMap.mark(q.id, 'target'); playMap.label(q.id, R.short(q.id), 'target');
    setPanel($('#pPrompt').innerHTML, `<div class="fb ng">${t('wrong', esc(R.name(id)), nameHtml(q.id))}</div>`,
      P.mode === 'timed' ? '' : `${cardBtn}${nextBtn}`);
    if (P.mode === 'timed') P.auto = setTimeout(advance, 1100);
  }
  updateStat();
}
function advance() {
  clearTimeout(P.auto);
  if (!P.answered) return;
  P.i++;
  nextQuestion();
}
function timedTick() {
  const left = TIMED_SEC - (Date.now() - P.t0) / 1000;
  $('#pTimer i').style.width = Math.max(0, left / TIMED_SEC * 100) + '%';
  $('#pTimer').classList.toggle('hurry', left < 10);
  if (left <= 0) { clearInterval(P.timer); clearTimeout(P.auto); finishQuiz(); }
}
function finishQuiz() {
  clearInterval(P.timer);
  const total = P.mode === 'timed' ? null : P.qs.length;
  let head = '';
  if (P.mode === 'timed') {
    const rec = Store.setBest(R.key, 'timed', P.score);
    head = `<div class="big-score">${P.score}<small>${esc(t('pts'))}</small></div>${rec ? `<div class="new-rec">${esc(t('newRec'))}</div>` : `<div class="muted">${esc(t('best', Store.best(R.key, 'timed')))}</div>`}`;
  } else {
    let extra = '';
    if (P.mode === 'daily') { Store.setDaily(R.key, P.score); extra = `<div class="muted">${esc(t('streakDays', Store.streak(R.key)))}</div>`; }
    head = `<div class="big-score">${P.score}<small> / ${total}</small></div>${extra}`;
  }
  const ups = P.ups.filter(x => x.to < 3).map(x => `<span class="chip">${esc(R.short(x.id))} → ${esc(lv(x.to))}</span>`).join('');
  const stamps = P.stamps.map(id => stampHtml(id)).join('');
  Sound.play(P.score >= (total || 10) * 0.8 ? 'goal' : 'level');
  openModal(`
    <div class="result">
      <div class="result-dog">${komugiImg(72)}</div>
      <h2>${esc(t('finished', t('mode.' + P.mode)))}</h2>
      ${head}
      <div class="muted">${esc(t('maxCombo', P.maxCombo))}</div>
      ${stamps ? `<h3>${esc(t('newStamps'))}</h3><div class="stamps">${stamps}</div>` : ''}
      ${ups ? `<h3>${esc(t('ups'))}</h3><div class="chips">${ups}</div>` : ''}
      <div class="actions">
        <button type="button" class="btn" data-home>${esc(t('home'))}</button>
        ${P.mode === 'daily' ? '' : `<button type="button" class="btn primary" data-again="${P.mode}">${esc(t('again'))}</button>`}
      </div>
    </div>`, null);
  P.qs = null;
}

// ── 鄰接旅行 ──
function startTravel() {
  music('calm');
  const trip = Quiz.trip(R);
  Object.assign(P, { from: trip.from, to: trip.to, best: trip.best, cur: trip.from, steps: 0, trail: [trip.from], peek: false, done: false });
  playMap.showLinks(true);
  playMap.mark(trip.from, 'here'); playMap.label(trip.from, R.short(trip.from), 'here');
  P.dog = playMap.marker(KOMUGI_SVG, trip.from);
  // 放大到起點附近（三步內）小縣才點得到；不照終點的方向放大，免得洩題
  const { dist } = Quiz.bfs(R, trip.from);
  playMap.focus(R.ids.filter(id => dist[id] <= 3 && !(R.map.frames || []).some(f => f.id === id)), 1.2);
  playMap.onTap(travelTap);
  travelPanel();
}
function travelPanel(fb = '') {
  setPanel(`<span class="tag travel">${esc(t('mode.travel'))}</span><div class="q-main">${esc(R.name(P.from))} → <b>${esc(R.name(P.to))}</b></div><div class="q-sub">${esc(R.sub(P.to))}・${esc(t('travelSub'))}</div>`,
    fb, P.peek ? '' : `<button type="button" class="btn" data-peek>${esc(t('peek'))}</button>`);
  setStat(esc(t('steps', P.steps)));
}
function travelTap(id) {
  if (P.done || id === P.cur) return;
  if (!R.graph[P.cur].has(id)) {
    Sound.play('ng');
    playMap.flash(id, 'ng', 600);
    travelPanel(`<div class="fb ng">${esc(t('notAdj', R.short(id), R.short(P.cur)))}</div>`);
    return;
  }
  const link = (R.map.links || []).find(l => (l.a === P.cur && l.b === id) || (l.b === P.cur && l.a === id));
  playMap.mark(P.cur, 'here', false); playMap.mark(P.cur, 'visited');
  P.cur = id; P.steps++; P.trail.push(id);
  playMap.mark(id, 'here'); playMap.label(id, R.short(id), 'here');
  P.dog.moveTo(id);
  Sound.play('step');
  if (id === P.to) return travelGoal();
  travelPanel(link ? `<div class="fb">${t('viaLink', esc(t('links')[link.name] || link.name), nameHtml(id))}</div>` : `<div class="fb">${t('arrived', nameHtml(id))}</div>`);
}
function travelGoal() {
  P.done = true;
  let stars = P.steps === P.best ? 3 : P.steps <= P.best + 2 ? 2 : 1;
  if (P.peek) stars = Math.max(1, stars - 1);
  if (!P.peek) {
    const ch = Store.record(R.key, P.to, 'loc', true);
    if (ch.to === 3) Sound.play('stamp'); else if (ch.to > ch.from) Sound.play('level');
  }
  playMap.paint(masteryColor);
  playMap.mark(P.to, 'goal');
  playMap.path(Quiz.route(R, P.from, P.to));
  Sound.play('goal');
  setStat(esc(t('steps', P.steps)));
  setPanel(`<div class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div><div class="q-main">${esc(t('goal', R.name(P.to)))}</div>
    <div class="q-sub">${esc(t('goalSub', P.steps, P.best))}</div>`, '',
    `<button type="button" class="btn" data-card="${P.to}">${esc(t('card'))}</button><button type="button" class="btn primary" data-again="travel">${esc(t('travelAgain'))}</button>`);
}

// ── 圖鑑 ──
function startExplore() {
  music('calm');
  const labels = Store.settings().labels;
  playMap.clearLabels();
  if (labels) for (const id of R.ids) playMap.label(id, R.short(id), 'auto');
  playMap.onTap(id => { Sound.play('tap'); playMap.clearMarks('here'); playMap.mark(id, 'here'); showCard(id); });
  setPanel(`<div class="q-sub">${esc(t('exploreHint'))}</div>`, '',
    `<button type="button" class="btn" data-labels>${esc(t(labels ? 'hideNames' : 'showNames'))}</button>`);
  setStat('');
}

// ── 御朱印帳 ──
function renderBook() {
  const c = Store.counts(R.key, R.ids);
  $('#bStat').textContent = `${c[3]} / ${R.ids.length}`;
  let html = '';
  for (const [ak, a] of Object.entries(R.areas)) {
    const ids = R.ids.filter(id => R.units[id].area === ak);
    if (!ids.length) continue;
    html += `<h3 style="--area:${a.color}">${esc(R.areaName(ak))}</h3><div class="book-grid">`;
    for (const id of ids) {
      const n = Store.level(R.key, id), rec = Store.unit(R.key, id);
      html += `<button type="button" class="slot lv${n}" data-card="${id}">${n === 3 ? stampHtml(id, rec.stamped) : `<span class="slot-name">${esc(R.short(id))}</span><span class="dots">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`}</button>`;
    }
    html += '</div>';
  }
  $('#bookBody').innerHTML = html;
}

// ── 設定 ──
function showSettings() {
  const s = Store.settings();
  const row = (k, name) => `<label class="set"><span>${esc(name)}</span><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}></label>`;
  openModal(`<div class="settings"><h2>${esc(t('settings'))}</h2>${row('bgm', t('bgm'))}${row('sfx', t('sfx'))}${row('labels', t('labels'))}
    <p class="muted">${esc(t('about'))}</p></div>`);
}

// ── 事件 ──
function goHome() {
  clearInterval(P?.timer); clearTimeout(P?.auto);
  P = null;
  show('home');
  renderHome();
  music('calm');
}
document.addEventListener('click', e => {
  const b = e.target.closest('button, [data-card]');
  if (!b) return;
  if (b.dataset.lang) { Sound.play('tap'); setLang(b.dataset.lang); }
  else if (b.dataset.mode) { Sound.play('tap'); startMode(b.dataset.mode); }
  else if (b.id === 'mDaily') { Sound.play('tap'); startMode('daily'); }
  else if (b.id === 'mBook') { Sound.play('tap'); renderBook(); show('book'); }
  else if (b.id === 'pBack' || b.id === 'bBack') goHome();
  else if (b.id === 'hSettings') showSettings();
  else if (b.id === 'modalClose') closeModal();
  else if (b.dataset.r) {
    const g = REGIONS.find(x => x.key === b.dataset.r);
    if (!g.ready) toast(esc(t('soonToast', t('region.' + g.key), t('regionUnit.' + g.key))));
  }
  else if (b.dataset.card) { Sound.play('tap'); showCard(b.dataset.card); }
  else if (b.hasAttribute('data-next')) advance();
  else if (b.hasAttribute('data-home')) { closeModal(); goHome(); }
  else if (b.dataset.again) { closeModal(); startMode(b.dataset.again); }
  else if (b.hasAttribute('data-peek')) { P.peek = true; playMap.mark(P.to, 'goal'); playMap.label(P.to, R.short(P.to), 'goal'); travelPanel(); }
  else if (b.hasAttribute('data-labels')) { Store.setSetting('labels', !Store.settings().labels); startExplore(); }
});
document.addEventListener('change', e => {
  const k = e.target.dataset.set;
  if (!k) return;
  Store.setSetting(k, e.target.checked);
  if (k === 'bgm') music(bgmStyle);
});
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
// 瀏覽器規定要使用者先互動才能出聲
document.addEventListener('pointerdown', function unlock() {
  Sound.init(); music(bgmStyle);
  document.removeEventListener('pointerdown', unlock);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) Sound.stopBgm(); else music(bgmStyle); });

// Android App 的返回鍵：先關彈窗、再回首頁，都沒有才讓 App 退到背景
window.KMAP = {
  onBack() {
    if (!$('#modal').hidden) { closeModal(); return true; }
    if ($('#home').hidden) { goHome(); return true; }
    return false;
  },
};

// ── 啟動 ──
if (!Store.settings().lang) Store.setSetting('lang', defaultLang());
R = regionData('japan');
$('#logoDog').innerHTML = komugiImg(44);
$('#appVer').textContent = 'v' + APP_VERSION;
applyLang();
renderTabs();
renderHome();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
