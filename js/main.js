// 畫面與玩法流程：首頁、找位置／知識找地點／今日挑戰／限時連擊、鄰接旅行、圖鑑、御朱印帳。
const $ = s => document.querySelector(s);
const LV = ['未踏', '到訪', '熟悉', '制霸'];
const MODE_NAME = { loc: '找位置', know: '知識找地點', daily: '今日挑戰', timed: '限時連擊', travel: '鄰接旅行', explore: '圖鑑' };
const ROUND = 10, TIMED_SEC = 60;

let R = null;          // 目前的地區資料
let homeMap = null, playMap = null;
let P = null;          // 目前這一局的狀態
let bgmStyle = 'calm';

// ── 共用小工具 ──
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function mixColor(hex, t) {
  const p = [0xec, 0xe5, 0xd3], c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return '#' + c.map((v, i) => Math.round(p[i] + (v - p[i]) * t).toString(16).padStart(2, '0')).join('');
}
function masteryColor(id) {
  const lv = Store.level(R.key, id);
  if (!lv) return '';
  return mixColor(R.areas[R.units[id].area].color, [0, 0.32, 0.62, 1][lv]);
}
let toastTimer = null;
function toast(html, ms = 1600) {
  const t = $('#toast');
  t.innerHTML = html; t.hidden = false; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
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

// ── 首頁 ──
function renderTabs() {
  $('#regionTabs').innerHTML = REGIONS.map(g =>
    `<button type="button" class="tab ${g.key === R.key ? 'on' : ''} ${g.ready ? '' : 'soon'}" data-r="${g.key}">${g.name}${g.ready ? '' : '<small>製作中</small>'}</button>`).join('');
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
    <div class="legend"><span class="l3">制霸 ${c[3]}</span><span class="l2">熟悉 ${c[2]}</span><span class="l1">到訪 ${c[1]}</span><span class="l0">未踏 ${c[0]}</span><b>${c[3]} / ${n}</b></div>`;
  const d = Store.daily(R.key), st = Store.streak(R.key);
  $('#dailyInfo').textContent = (d == null ? '今天還沒挑戰' : `今天 ${d} / ${ROUND}`) + (st ? `・連續 ${st} 天` : '');
  $('#timedBest').textContent = Store.best(R.key, 'timed') ? `最佳 ${Store.best(R.key, 'timed')} 分` : '60 秒能答對幾題';
  $('#bookInfo').textContent = `已蓋 ${c[3]} / ${n} 個章`;
}

// ── 知識卡 ──
function stampHtml(id, date) {
  return `<div class="stamp"><span>${esc(R.short(id))}</span>${date ? `<small>${esc(date.slice(5).replace('-', '.'))}</small>` : ''}</div>`;
}
function cardHtml(id) {
  const u = R.units[id], lv = Store.level(R.key, id), a = R.areas[u.area], rec = Store.unit(R.key, id);
  const chips = arr => arr.map(x => `<span class="chip">${esc(x)}</span>`).join('');
  const dots = [1, 2, 3].map(i => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('');
  return `
  <div class="card" style="--area:${a.color}">
    <div class="card-head">
      <div><div class="card-area">${esc(a.name)}</div><h2>${esc(u.ja)}</h2><div class="kana">${esc(u.kana)}</div></div>
      ${lv === 3 ? stampHtml(id, rec?.stamped) : ''}
    </div>
    <div class="mastery"><span class="dots">${dots}</span><b>${LV[lv]}</b><small>${esc(Store.nextHint(R.key, id))}</small></div>
    <dl>
      <dt>${u.ja.endsWith('県') ? '縣廳' : u.ja.endsWith('府') ? '府廳' : u.ja.endsWith('都') ? '都廳' : '道廳'}所在地</dt><dd>${esc(u.cap[0])}<small>${esc(u.cap[1])}</small></dd>
      <dt>舊國名</dt><dd>${u.old.map(o => `${esc(o[0])}<small>${esc(o[1])}</small>`).join('、')}</dd>
      <dt>名產</dt><dd>${chips(u.foods)}</dd>
      <dt>名勝</dt><dd>${chips(u.sights)}</dd>
      <dt>小知識</dt><dd>${esc(u.fact.replace(/○○/g, R.short(id)))}</dd>
      <dt>方言</dt><dd><b class="dia">${esc(u.dia[0])}</b> ${esc(u.dia[1])}</dd>
    </dl>
    <a class="src" href="https://ja.wikipedia.org/wiki/${encodeURIComponent(u.ja)}" target="_blank" rel="noopener">來源：日文維基百科〈${esc(u.ja)}〉</a>
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
  if (mode !== 'travel' && mode !== 'explore' && !R.ids.length) return;
  show('play');
  ensurePlayMap();
  $('#pTitle').textContent = MODE_NAME[mode];
  $('#pTimer').hidden = mode !== 'timed';
  clearInterval(P?.timer);
  P = { mode, i: 0, score: 0, combo: 0, maxCombo: 0, ups: [], stamps: [], answered: false };
  if (mode === 'explore') return startExplore();
  if (mode === 'travel') return startTravel();
  music(mode === 'timed' ? 'fast' : 'calm');
  if (mode === 'daily') P.qs = Quiz.daily(R);
  else if (mode === 'timed') { P.qs = []; P.left = TIMED_SEC; P.timer = setInterval(timedTick, 100); P.t0 = Date.now(); }
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
  if (P.mode === 'timed') setStat(`<b>${P.score}</b> 分${P.combo > 1 ? `<span class="combo">${P.combo} 連擊</span>` : ''}`);
  else setStat(`${Math.min(P.i + 1, P.qs.length)} / ${P.qs.length}${P.combo > 1 ? `<span class="combo">${P.combo} 連擊</span>` : ''}`);
}
function answer(id) {
  if (P.answered || !P.qs?.[P.i]) return;
  const q = P.qs[P.i], ok = id === q.id, u = R.units[q.id];
  P.answered = true;
  const ch = Store.record(R.key, q.id, q.type, ok);
  if (ch.to > ch.from) {
    P.ups.push({ id: q.id, to: ch.to });
    if (ch.to === 3) { P.stamps.push(q.id); toast(`${stampHtml(q.id)}<b>${esc(R.short(q.id))} 制霸！</b>`, 1800); Sound.play('stamp'); }
    else setTimeout(() => Sound.play('level'), 250);
  }
  playMap.paint(masteryColor);
  const name = `${esc(u.ja)}<small>${esc(u.kana)}</small>`;
  const cardBtn = `<button type="button" class="btn" data-card="${q.id}">看知識卡</button>`;
  if (ok) {
    P.combo++; P.maxCombo = Math.max(P.maxCombo, P.combo);
    P.score += P.mode === 'timed' ? 1 + Math.floor(P.combo / 5) : 1;
    Sound.play('ok', P.combo - 1);
    playMap.mark(id, 'ok'); playMap.label(id, R.short(id), 'ok');
    const up = ch.to > ch.from && ch.to < 3 ? `<span class="up">升級：${LV[ch.to]}</span>` : '';
    setPanel($('#pPrompt').innerHTML, `<div class="fb ok">答對！${q.type === 'know' ? '　' + name : ''}${up}</div>`,
      P.mode === 'timed' ? '' : `${q.type === 'know' ? cardBtn : ''}<button type="button" class="btn primary" data-next>下一題</button>`);
    P.auto = setTimeout(advance, P.mode === 'timed' ? 450 : 1300);
  } else {
    P.combo = 0;
    Sound.play('ng');
    playMap.mark(id, 'ng'); playMap.label(id, R.short(id), 'ng');
    playMap.mark(q.id, 'target'); playMap.label(q.id, R.short(q.id), 'target');
    setPanel($('#pPrompt').innerHTML, `<div class="fb ng">你點的是 ${esc(R.units[id].ja)}，答案是 ${name}</div>`,
      P.mode === 'timed' ? '' : `${cardBtn}<button type="button" class="btn primary" data-next>下一題</button>`);
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
  P.left = TIMED_SEC - (Date.now() - P.t0) / 1000;
  $('#pTimer i').style.width = Math.max(0, P.left / TIMED_SEC * 100) + '%';
  $('#pTimer').classList.toggle('hurry', P.left < 10);
  if (P.left <= 0) { clearInterval(P.timer); clearTimeout(P.auto); finishQuiz(); }
}
function finishQuiz() {
  clearInterval(P.timer);
  const total = P.mode === 'timed' ? null : P.qs.length;
  let head = '', extra = '';
  if (P.mode === 'timed') {
    const rec = Store.setBest(R.key, 'timed', P.score);
    head = `<div class="big-score">${P.score}<small> 分</small></div>${rec ? '<div class="new-rec">新紀錄！</div>' : `<div class="muted">最佳 ${Store.best(R.key, 'timed')} 分</div>`}`;
  } else {
    if (P.mode === 'daily') { Store.setDaily(R.key, P.score); extra = `<div class="muted">連續挑戰 ${Store.streak(R.key)} 天</div>`; }
    head = `<div class="big-score">${P.score}<small> / ${total}</small></div>${extra}`;
  }
  const ups = P.ups.filter(x => x.to < 3).map(x => `<span class="chip">${esc(R.short(x.id))} → ${LV[x.to]}</span>`).join('');
  const stamps = P.stamps.map(id => stampHtml(id)).join('');
  Sound.play(P.score >= (total || 10) * 0.8 ? 'goal' : 'level');
  openModal(`
    <div class="result">
      <div class="result-dog">${komugiImg(72)}</div>
      <h2>${MODE_NAME[P.mode]}結束</h2>
      ${head}
      <div class="muted">最高連擊 ${P.maxCombo}</div>
      ${stamps ? `<h3>新蓋的御朱印</h3><div class="stamps">${stamps}</div>` : ''}
      ${ups ? `<h3>升級</h3><div class="chips">${ups}</div>` : ''}
      <div class="actions">
        <button type="button" class="btn" data-home>回首頁</button>
        ${P.mode === 'daily' ? '' : `<button type="button" class="btn primary" data-again="${P.mode}">再來一輪</button>`}
      </div>
    </div>`, null);
  P.qs = null;
}

// ── 鄰接旅行 ──
function startTravel() {
  music('calm');
  const t = Quiz.trip(R);
  Object.assign(P, { from: t.from, to: t.to, best: t.best, cur: t.from, steps: 0, trail: [t.from], peek: false, done: false });
  playMap.showLinks(true);
  playMap.mark(t.from, 'here'); playMap.label(t.from, R.short(t.from), 'here');
  P.dog = playMap.marker(KOMUGI_SVG, t.from);
  // 放大到起點附近（三步內）小縣才點得到；不照終點的方向放大，免得洩題
  const { dist } = Quiz.bfs(R, t.from);
  playMap.focus(R.ids.filter(id => dist[id] <= 3 && !(R.map.frames || []).some(f => f.id === id)), 1.2);
  playMap.onTap(travelTap);
  travelPanel();
}
function travelPanel(fb = '') {
  const f = R.units[P.from], t = R.units[P.to];
  setPanel(`<span class="tag travel">鄰接旅行</span><div class="q-main">${esc(f.ja)} → <b>${esc(t.ja)}</b></div><div class="q-sub">${esc(t.kana)}・只能走到相鄰的地方，虛線是橋、隧道或航線</div>`,
    fb, P.peek ? '' : '<button type="button" class="btn" data-peek>看目的地（少一顆星）</button>');
  setStat(`${P.steps} 步`);
}
function travelTap(id) {
  if (P.done || id === P.cur) return;
  if (!R.graph[P.cur].has(id)) {
    Sound.play('ng');
    playMap.flash(id, 'ng', 600);
    travelPanel(`<div class="fb ng">${esc(R.short(id))} 跟 ${esc(R.short(P.cur))} 不相鄰</div>`);
    return;
  }
  const link = (R.map.links || []).find(l => (l.a === P.cur && l.b === id) || (l.b === P.cur && l.a === id));
  playMap.mark(P.cur, 'here', false); playMap.mark(P.cur, 'visited');
  P.cur = id; P.steps++; P.trail.push(id);
  playMap.mark(id, 'here'); playMap.label(id, R.short(id), 'here');
  P.dog.moveTo(id);
  Sound.play('step');
  if (id === P.to) return travelGoal();
  travelPanel(link ? `<div class="fb">走${esc(link.name)}到了 ${esc(R.units[id].ja)}</div>` : `<div class="fb">到了 ${esc(R.units[id].ja)}<small>${esc(R.units[id].kana)}</small></div>`);
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
  setStat(`${P.steps} 步`);
  setPanel(`<div class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div><div class="q-main">抵達 ${esc(R.units[P.to].ja)}！</div>
    <div class="q-sub">你走了 ${P.steps} 步，最短是 ${P.best} 步（地圖上的紅線）</div>`, '',
    `<button type="button" class="btn" data-card="${P.to}">看知識卡</button><button type="button" class="btn primary" data-again="travel">再走一趟</button>`);
}

// ── 圖鑑 ──
function startExplore() {
  music('calm');
  const labels = Store.settings().labels;
  if (labels) for (const id of R.ids) playMap.label(id, R.short(id), 'auto');
  playMap.onTap(id => { Sound.play('tap'); playMap.clearMarks('here'); playMap.mark(id, 'here'); showCard(id); });
  setPanel('<div class="q-sub">點地圖上的任何一塊看知識卡，雙指或滾輪可以放大</div>', '',
    `<button type="button" class="btn" data-labels>${labels ? '隱藏' : '顯示'}名稱</button>`);
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
    html += `<h3 style="--area:${a.color}">${esc(a.name)}</h3><div class="book-grid">`;
    for (const id of ids) {
      const lv = Store.level(R.key, id), rec = Store.unit(R.key, id);
      html += `<button type="button" class="slot lv${lv}" data-card="${id}">${lv === 3 ? stampHtml(id, rec.stamped) : `<span class="slot-name">${esc(R.short(id))}</span><span class="dots">${[1, 2, 3].map(i => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('')}</span>`}</button>`;
    }
    html += '</div>';
  }
  $('#bookBody').innerHTML = html;
}

// ── 設定 ──
function showSettings() {
  const s = Store.settings();
  const row = (k, name) => `<label class="set"><span>${name}</span><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}></label>`;
  openModal(`<div class="settings"><h2>設定</h2>${row('bgm', '背景音樂')}${row('sfx', '音效')}${row('labels', '圖鑑顯示地名')}
    <p class="muted">進度存在這個瀏覽器裡。地圖：Natural Earth（公有領域）；知識卡依日文維基百科整理。</p></div>`);
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
  if (b.dataset.mode) { Sound.play('tap'); startMode(b.dataset.mode); }
  else if (b.id === 'mDaily') { Sound.play('tap'); startMode('daily'); }
  else if (b.id === 'mBook') { Sound.play('tap'); renderBook(); show('book'); }
  else if (b.id === 'pBack' || b.id === 'bBack') goHome();
  else if (b.id === 'hSettings') showSettings();
  else if (b.id === 'modalClose') closeModal();
  else if (b.dataset.r) {
    const g = REGIONS.find(x => x.key === b.dataset.r);
    if (!g.ready) toast(`${g.name}（以${g.unit}為單位）製作中`);
  }
  else if (b.dataset.card) { Sound.play('tap'); showCard(b.dataset.card); }
  else if (b.hasAttribute('data-next')) advance();
  else if (b.hasAttribute('data-home')) { closeModal(); goHome(); }
  else if (b.dataset.again) { closeModal(); startMode(b.dataset.again); }
  else if (b.hasAttribute('data-peek')) { P.peek = true; playMap.mark(P.to, 'goal'); playMap.label(P.to, R.short(P.to), 'goal'); travelPanel(); }
  else if (b.hasAttribute('data-labels')) { Store.setSetting('labels', !Store.settings().labels); playMap.clearLabels(); startExplore(); }
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
R = regionData('japan');
$('#logoDog').innerHTML = komugiImg(44);
renderTabs();
renderHome();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
