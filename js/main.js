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
// 熟練度顏色＝從地圖底色（--land，隨底色主題變）往該分區的顏色混
let LAND = [0xec, 0xe5, 0xd3];
function mixColor(hex, k) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return '#' + c.map((v, i) => Math.round(LAND[i] + (v - LAND[i]) * k).toString(16).padStart(2, '0')).join('');
}
// 底色主題（設定裡切換，類似 K書吧）：auto 跟著系統深色模式在米／夜之間切；其餘固定
const THEMES = ['auto', 'paper', 'white', 'green', 'night'];
const darkMq = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const v = Store.settings().theme || 'paper';
  const eff = v === 'auto' ? (darkMq.matches ? 'night' : 'paper') : v;
  if (eff === 'paper') delete document.body.dataset.theme; else document.body.dataset.theme = eff;
  const cs = getComputedStyle(document.body);
  const land = cs.getPropertyValue('--land').trim();
  if (/^#[0-9a-f]{6}$/i.test(land)) LAND = [1, 3, 5].map(i => parseInt(land.slice(i, i + 2), 16));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cs.getPropertyValue('--paper').trim());
  homeMap?.paint(masteryColor);
  if (playMap && P && !P.qs) playMap.paint(masteryColor);
}
darkMq.addEventListener('change', applyTheme);
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
function openModal(html, onClose, fixed = false) {
  $('#modalBody').innerHTML = html;
  $('#modal .sheet').classList.toggle('fixed', fixed);
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
// ── 地區與範圍 ──
// 範圍＝首頁選的分區（日本的地方、中國的華北…、世界的各洲），出題與旅行只用範圍內的區塊
function scopeKey() { return (Store.settings().scope || {})[R.key] || 'all'; }
function pool() {
  const k = scopeKey();
  return k === 'all' ? R.ids : R.ids.filter(id => R.units[id].area === k);
}
// 首頁和圖鑑共用同一個範圍設定：在圖鑑切換也會記住，回首頁就是那個範圍
function setScope(k) {
  Store.setSetting('scope', Object.assign({}, Store.settings().scope, { [R.key]: k }));
  if (P?.mode === 'explore' && playMap && !$('#play').hidden) { applyScope(playMap); startExplore(); }
  else renderHome();
}
function applyScope(m) {
  const inScope = scopeKey() === 'all' ? null : pool();
  m.dim(inScope);
  m.setHome(inScope, R.map.views?.[scopeKey()]);
}
function switchRegion(key) {
  const next = regionData(key);
  if (!next) return;
  Store.setSetting('region', key);
  clearInterval(P?.timer); clearTimeout(P?.auto); P = null;
  R = next;
  homeMap?.destroy(); playMap?.destroy();
  homeMap = playMap = null;
  renderTabs();
  renderHome();
  music('calm');
}
const scopeChips = () => {
  const k = scopeKey(), keys = ['all', ...Object.keys(R.areas)];
  return keys.map(a => `<button type="button" class="${a === k ? 'on' : ''}" data-scope="${a}">${esc(a === 'all' ? t('scopeAll') : R.areaName(a))}</button>`).join('');
};
function renderScope() { $('#scopeTabs').innerHTML = scopeChips(); showOnChip(); }
// 分區很多（世界六洲、日本八地方）時，選中的那顆捲進畫面
const showOnChip = () => document.querySelectorAll('.scopes .on').forEach(b => b.scrollIntoView({ inline: 'center', block: 'nearest' }));

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
    homeMap = createMap($('#homeMap'), R, { static: true });
    homeMap.onTap(id => { if (!id) return; Sound.play('tap'); showCard(id); });
  }
  homeMap.paint(masteryColor);
  // 已解開（到訪以上）的地方標地名，跟圖鑑一樣塞得下才顯示（Ken 2026-10-21 要求）
  homeMap.clearLabels();
  for (const id of R.ids) if (Store.level(R.key, id) >= 1) homeMap.label(id, R.short(id), 'auto');
  applyScope(homeMap);
  renderScope();
  $('#mBook b').textContent = R.label('book');
  const c = Store.counts(R.key, R.ids), n = R.ids.length;
  const seg = (k, cls) => c[k] ? `<i class="${cls}" style="flex:${c[k]}"></i>` : '';
  $('#homeProgress').innerHTML = `
    <div class="bar">${seg(3, 'l3')}${seg(2, 'l2')}${seg(1, 'l1')}${seg(0, 'l0')}</div>
    <div class="legend"><span class="l3">${lv(3)} ${c[3]}</span><span class="l2">${lv(2)} ${c[2]}</span><span class="l1">${lv(1)} ${c[1]}</span><span class="l0">${lv(0)} ${c[0]}</span><b>${c[3]} / ${n}</b></div>`;
  const d = Store.daily(R.key), st = Store.streak(R.key);
  $('#dailyInfo').textContent = (d == null ? t('dailyNone', Rewards.EARN.daily) : t('dailyDone', d, ROUND)) + (st ? t('streak', st) : '') + (d == null ? '' : t('dailyAgainHint', Rewards.EARN.dailyAgain));
  // 地圖左上角的解鎖百分比：到訪以上的地方佔比（Ken 2026-10-21 要求）
  const unlocked = n - c[0];
  $('#homeUnlock').textContent = t('unlocked', Math.round(unlocked / n * 100), unlocked, n);
  $('#timedBest').textContent = Store.best(R.key, 'timed') ? t('timedBest', Store.best(R.key, 'timed')) : t('modeDesc.timed');
  $('#bookInfo').textContent = t('bookInfo', c[3], n);
  renderHero();
}

// ── 知識卡 ──
// 印章樣式依地區：日本圓形御朱印、中國方形印章、世界護照入境章
function stampHtml(id, date) {
  const color = R.stampStyle === 'passport' ? R.areas[R.units[id].area].color : '';
  return `<div class="stamp ${R.stampStyle}"${color ? ` style="--stamp:${color}"` : ''}><span>${esc(R.stamp(id))}</span>${date ? `<small>${esc(date.slice(5).replace('-', '.'))}</small>` : ''}</div>`;
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
      <div><div class="card-area">${esc(R.areaName(u.area))}</div><h2>${c.flag ? `<span class="flag">${c.flag}</span>` : ''}${esc(R.name(id))}</h2><div class="kana">${esc(R.sub(id))}</div></div>
      ${n === 3 ? stampHtml(id, rec?.stamped) : ''}
    </div>
    <div class="mastery"><span class="dots">${dots}</span><b>${lv(n)}</b><small>${esc(hintText(Store.nextHint(R.key, id)))}</small></div>
    <dl>
      ${c.cap ? `<dt>${esc(c.capLabel)}</dt><dd>${esc(c.cap)}<small>${esc(c.capSub || '')}</small></dd>` : ''}
      ${c.old.length ? `<dt>${esc(R.label('old'))}</dt><dd>${c.old.map(o => `${esc(o.n)}<small>${esc(o.sub)}</small>`).join(lang() === 'en' ? ', ' : '、')}</dd>` : ''}
      ${c.foods.length ? `<dt>${esc(t('foods'))}</dt><dd>${chips(c.foods)}</dd>` : ''}
      ${c.sights.length ? `<dt>${esc(t('sights'))}</dt><dd>${chips(c.sights)}</dd>` : ''}
      ${c.fact ? `<dt>${esc(t('fact'))}</dt><dd>${esc(c.fact.replace(/○○/g, R.short(id)))}</dd>` : ''}
      ${c.dia ? `<dt>${esc(R.label('dia'))}</dt><dd><b class="dia">${esc(c.dia.w)}</b> ${esc(c.dia.m)}</dd>` : ''}
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
  applyScope(playMap);
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
  $('#pTitle').textContent = mode === 'book' ? R.label('book') : t('mode.' + mode);
  $('#pTimer').hidden = mode !== 'timed';
  clearInterval(P?.timer);
  P = { mode, i: 0, score: 0, combo: 0, maxCombo: 0, ups: [], stamps: [], answered: false, marks: [], items: [] };
  if (mode === 'explore') return startExplore();
  if (mode === 'travel') return startTravel();
  music(mode === 'timed' ? 'fast' : 'calm');
  // 作答中地圖不照熟練度上色：已學過的地方有顏色，等於把答案範圍先圈出來（Ken 2026-10-21 指出）
  playMap.paint(() => '');
  // 今日挑戰：每天第一次是固定題組（分享用）；做完再玩就換一組新題（照複習優先度出），另給再挑戰獎勵（Ken 2026-10-21 要求）
  if (mode === 'daily') { P.again = Store.daily(R.key) != null; P.qs = P.again ? Quiz.session(R, 'mix', ROUND, R.ids) : Quiz.daily(R); }
  else if (mode === 'timed') { P.qs = []; P.timer = setInterval(timedTick, 100); P.t0 = Date.now(); }
  else P.qs = Quiz.session(R, mode, ROUND, pool());
  playMap.onTap(answer);
  nextQuestion();
}

// ── 答題流程 ──
function nextQuestion() {
  if (P.mode === 'timed') P.qs[P.i] = Quiz.session(R, 'mix', 1, pool())[0];
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
  // 答完後再點畫面任何地方＝下一題（Ken 2026-10-21 要求）；限時連擊會自己跳
  if (P.answered && P.qs && P.mode !== 'timed') return advance();
  if (!id || P.answered || !P.qs?.[P.i]) return;
  const q = P.qs[P.i], ok = id === q.id;
  P.answered = true;
  const ch = Store.record(R.key, q.id, q.type, ok);
  P.marks.push(ok ? '🟩' : '🟥');
  if (ok) { Store.stat('langs', lang()); Store.stat('maxCombo', P.combo + 1); gain(Rewards.EARN.ok + (P.combo + 1 >= 5 ? Rewards.EARN.combo : 0)); }
  if (ch.to > ch.from) gain(LEVEL_COINS[ch.to]);
  celebrate(Rewards.check());
  if (ch.to > ch.from) {
    P.ups.push({ id: q.id, to: ch.to });
    if (ch.to === 3) { P.stamps.push(q.id); toast(`${stampHtml(q.id)}<b>${esc(t('mastered', R.short(q.id)))}</b>`, 1800); Sound.play('stamp'); }
    else setTimeout(() => Sound.play('level'), 250);
  }
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
    if (P.mode === 'daily') {
      const perfect = P.score === P.qs.length, E = Rewards.EARN;
      if (!P.again) Store.setDaily(R.key, P.score, P.marks.join(''));   // 成績與方格只記每天第一次；先記才算得到今天的連續天數
      const streak = Store.streak(R.key);
      // 每天第一次：基本 +30、全對 +30、連續天數每天 +5（最多 +50）；再挑戰只有 +5（全對 +5），差距要大才會每天來
      const parts = P.again
        ? [[t('dailyAgainBonus'), E.dailyAgain], perfect && [t('perfectBonus'), E.dailyAgainPerfect]]
        : [[t('dailyBonus'), E.daily], perfect && [t('perfectBonus'), E.dailyPerfect], streak > 1 && [t('streakBonus', streak), Math.min(E.dailyStreak * streak, E.dailyStreakMax)]];
      const got = parts.filter(Boolean), bonus = got.reduce((s, [, n]) => s + n, 0);
      gain(bonus);
      extra = `<div class="daily-bonus"><b>🎁 +${bonus} 🐾</b><small>${got.map(([k, n]) => `${esc(k)} +${n}`).join('・')}</small></div><div class="muted">${esc(t('streakDays', streak))}</div>`;
    }
    head = `<div class="big-score">${P.score}<small> / ${total}</small></div>${extra}`;
  }
  const ups = P.ups.filter(x => x.to < 3).map(x => `<span class="chip">${esc(R.short(x.id))} → ${esc(lv(x.to))}</span>`).join('');
  const stamps = P.stamps.map(id => stampHtml(id)).join('');
  celebrate(Rewards.check());   // 限時最佳分數、今日挑戰全對／連續天數在結算時才算得出來
  const items = P.items.map(it => `<div class="item-tile got rar-${KOMUGI_ITEMS[it].rar}">${itemImg(it, 56)}<small>${esc(itemName(it))}</small></div>`).join('');
  Sound.play(P.score >= (total || 10) * 0.8 ? 'goal' : 'level');
  openModal(`
    <div class="result">
      <div class="result-dog">${komugiImg(72)}</div>
      <h2>${esc(t('finished', t('mode.' + P.mode)))}</h2>
      ${head}
      <div class="muted">${esc(t('maxCombo', P.maxCombo))}</div>
      ${P.coins ? `<div class="coins">${esc(t('coinsGot', '+' + P.coins))}</div>` : ''}
      ${stamps ? `<h3>${esc(t('newStamps'))}</h3><div class="stamps">${stamps}</div>` : ''}
      ${ups ? `<h3>${esc(t('ups'))}</h3><div class="chips">${ups}</div>` : ''}
      ${items ? `<h3>${esc(t('closet.newItems'))}</h3><div class="items">${items}</div>` : ''}
      <div class="actions">
        <button type="button" class="btn" data-home>${esc(t('home'))}</button>
        ${P.mode === 'daily' ? `<button type="button" class="btn" data-share>${esc(t('share.btn'))}</button><button type="button" class="btn primary" data-again="daily">${esc(t('dailyAgain'))}</button>` : `<button type="button" class="btn primary" data-again="${P.mode}">${esc(t('again'))}</button>`}
      </div>
    </div>`, null);
  P.qs = null;
}

// ── 鄰接旅行 ──
function startTravel() {
  music('calm');
  const trip = Quiz.trip(R, pool());
  Object.assign(P, { from: trip.from, to: trip.to, best: trip.best, cur: trip.from, steps: 0, trail: [trip.from], peek: false, done: false });
  playMap.showLinks(true);
  playMap.mark(trip.from, 'here'); playMap.label(trip.from, R.short(trip.from), 'here');
  P.dog = playMap.marker(komugiArt(), trip.from);
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
  if (!id || P.done || id === P.cur) return;
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
    if (ch.to > ch.from) gain(LEVEL_COINS[ch.to]);
  }
  gain(stars * Rewards.EARN.star);
  Store.stat('trips');
  if (stars === 3) Store.stat('trips3');
  celebrate(Rewards.check());
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
  playMap.onTap(id => { if (!id) return; Sound.play('tap'); playMap.clearMarks('here'); playMap.mark(id, 'here'); showCard(id); });
  setPanel(`<nav class="scopes">${scopeChips()}</nav><div class="q-sub">${esc(t('exploreHint'))}</div>`, '',
    `<button type="button" class="btn" data-labels>${esc(t(labels ? 'hideNames' : 'showNames'))}</button>`);
  showOnChip();
  setStat('');
}

// ── 御朱印帳 ──
function renderBook() {
  const c = Store.counts(R.key, R.ids);
  $('#book .hud-title').textContent = R.label('book');
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

// ── Komugi：首頁小屋、成就、衣櫃、扭蛋 ──
const itemName = it => t('closet.items')[it] || it;
const achText = a => t('closet.ach')[a.id].replace('{0}', a.target);
function refreshDog() {
  $('#logoDog').innerHTML = komugiImg(44);
  renderHero();
}
// 首頁小屋：全身 Komugi、稱號、下一個獎勵、肉球幣、扭蛋還能抽幾次
function renderHero() {
  if (!$('#heroDog')) return;
  $('#heroDog').innerHTML = komugiFullImg(104);
  const title = Store.title();
  $('#heroTitle').textContent = t('closet.titles')[title && Rewards.SETS.some(x => x.id === title && Rewards.setDone(x)) ? title : 'none'];
  const g = Rewards.nextGoal(R?.key);
  $('#heroBubble').textContent = g ? t('hero.goal', achText(g.a), g.left, itemName(g.a.item)) : t('hero.allDone');
  $('#heroCoins').textContent = '🐾 ' + Store.coins();
  const n = Math.floor(Store.coins() / Rewards.PULL_COST);
  $('#gachaBadge').hidden = !n; $('#gachaBadge').textContent = n;
}
// 賺肉球幣：記到這一局的合計，畫面上跳一下
function gain(n) {
  if (!n) return;
  Store.earn(n);
  if (P) P.coins = (P.coins || 0) + n;
  const s = $('#pStat');
  if (s && !$('#play').hidden) {
    const f = document.createElement('span'); f.className = 'coin-pop'; f.textContent = `+${n}🐾`;
    s.appendChild(f); setTimeout(() => f.remove(), 900);
  }
}
const LEVEL_COINS = [0, Rewards.EARN.visit, Rewards.EARN.familiar, Rewards.EARN.stamp];
// 新解鎖的成就：跳通知、記到這一局的結算裡（成就的幣在 Rewards.check 裡已經發了）
function celebrate(fresh) {
  if (!fresh.length) return;
  fresh.forEach((a, i) => setTimeout(() => {
    toast(`${itemImg(a.item, 64)}<b>${esc(t('closet.got', itemName(a.item)))}</b>`, 2200);
    Sound.play('level');
  }, 400 + i * 2300));
  if (P) { P.items.push(...fresh.map(a => a.item)); P.coins = (P.coins || 0) + fresh.length * Rewards.EARN.ach; }
  refreshDog();
}

// 衣櫃：上面是全身預覽，下面依部位分頁，最後一頁是套裝
let closetTab = 'head';
function closetHtml() {
  const outfit = Store.outfit(), ctx = Rewards.context(), got = Store.achievements();
  const total = Object.keys(KOMUGI_ITEMS).length, have = Object.keys(KOMUGI_ITEMS).filter(Store.owns).length;
  const tabs = [...KOMUGI_SLOTS, 'sets'].map(k => `<button type="button" class="${k === closetTab ? 'on' : ''}" data-ctab="${k}">${esc(k === 'sets' ? t('closet.sets') : t('closet.slots')[k])}</button>`).join('');
  let body = '';
  if (closetTab === 'sets') {
    for (const st of Rewards.SETS) {
      const done = Rewards.setDone(st), on = Store.title() === st.id;
      body += `<div class="set-row ${done ? 'done' : ''}"><div class="set-head"><b>${esc(t('closet.setNames')[st.id])}</b><small>「${esc(t('closet.titles')[st.id])}」 ${Rewards.setProgress(st)} / ${st.items.length}</small></div>
        <div class="set-items">${st.items.map(i => `<span class="mini ${Store.owns(i) ? '' : 'locked'}" title="${esc(itemName(i))}">${itemImg(i, 40)}</span>`).join('')}</div>
        ${done ? `<div class="set-actions"><button type="button" class="btn small" data-wearset="${st.id}">${esc(t('closet.wearSet'))}</button><button type="button" class="btn small ${on ? 'primary' : ''}" data-title="${st.id}">${esc(on ? t('closet.titleOn') : t('closet.useTitle'))}</button></div>` : ''}</div>`;
    }
  } else {
    body = '<div class="items">';
    for (const it of Object.keys(KOMUGI_ITEMS).filter(k => KOMUGI_ITEMS[k].slot === closetTab)) {
      const own = Store.owns(it), on = outfit[closetTab] === it, rar = KOMUGI_ITEMS[it].rar;
      const a = Rewards.ACH.find(x => x.item === it);
      const how = own ? (on ? t('closet.wearing') : '') : a ? `${achText(a)}・${Math.min(a.value(ctx), a.target)} / ${a.target}` : t('closet.locked');
      body += `<button type="button" class="item-tile rar-${rar} ${own ? 'got' : 'locked'} ${on ? 'on' : ''}" ${own ? `data-wear="${it}"` : 'disabled'}>
        <i class="rar">${rar}</i>${itemImg(it, 56)}<b>${esc(own || a ? itemName(it) : '？？？')}</b><small>${esc(how)}</small></button>`;
    }
    body += '</div>';
  }
  return `<div class="closet"><div class="closet-dog">${komugiFullImg(120)}</div><h2>${esc(t('closet.title'))}</h2>
    <p class="muted">${esc(t('closet.desc'))} ${esc(t('closet.owned', have, total))}</p>
    <nav class="scopes ctabs">${tabs}</nav>${body}</div>`;
}
function showCloset() { openModal(closetHtml(), null, true); showOnChip(); }
function rerenderCloset() { const y = $('#modal .sheet').scrollTop; $('#modalBody').innerHTML = closetHtml(); $('#modal .sheet').scrollTop = y; refreshDog(); }
function toggleWear(item) {
  const slot = KOMUGI_ITEMS[item].slot;
  Store.wear(slot, Store.outfit()[slot] === item ? null : item);
  rerenderCloset();
}
function wearSet(id) { for (const i of Rewards.SETS.find(x => x.id === id).items) Store.wear(KOMUGI_ITEMS[i].slot, i); rerenderCloset(); }

// 扭蛋機
function gachaHtml(res) {
  const coins = Store.coins(), can = coins >= Rewards.PULL_COST;
  const machine = `<svg viewBox="0 0 120 150" width="120" height="150" class="machine ${res === 'spin' ? 'spin' : ''}"><rect x="20" y="70" width="80" height="70" rx="10" fill="#c8402c"/><circle cx="60" cy="48" r="42" fill="rgba(255,255,255,.75)" stroke="#c8402c" stroke-width="4"/>
    ${[[42, 40, '#4a90d9'], [62, 30, '#f2c23a'], [76, 50, '#6aae5b'], [50, 62, '#f08cb0'], [70, 68, '#9a74c9'], [36, 58, '#e0864a']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="9" fill="${c}"/>`).join('')}
    <circle cx="60" cy="100" r="11" fill="#fff4dc" stroke="#8f2a1c" stroke-width="3"/><path d="M53 100 L67 100" stroke="#8f2a1c" stroke-width="4" stroke-linecap="round"/><rect x="44" y="120" width="32" height="12" rx="4" fill="#8f2a1c"/></svg>`;
  let out = '';
  if (res && res !== 'spin') {
    const r = res;
    out = `<div class="gacha-res rar-${r.rar}"><i class="rar">${r.rar}</i>${itemImg(r.item, 96)}<b>${esc(itemName(r.item))}</b>
      <small>${r.dup ? esc(t('gacha.dup', Rewards.DUP_REFUND)) : `<em class="new">${esc(t('gacha.isNew'))}</em>`}</small></div>`;
  }
  const left = Rewards.PITY - Store.pity();
  return `<div class="gacha"><h2>${esc(t('gacha.title'))}</h2>${res && res !== 'spin' ? out : machine}
    <div class="coins big">🐾 ${coins}</div><div class="muted">${esc(t('gacha.cost', Rewards.PULL_COST))}・${esc(t('gacha.pity', left))}</div>
    ${can ? '' : `<p class="muted">${esc(t('gacha.notEnough'))}</p>`}
    <div class="actions">
      ${res && res !== 'spin' && !res.dup ? `<button type="button" class="btn" data-wear-now="${res.item}">${esc(t('gacha.wear'))}</button>` : ''}
      <button type="button" class="btn primary" data-pull ${can ? '' : 'disabled'}>${esc(res && res !== 'spin' ? t('gacha.again') : t('gacha.pull'))}</button>
    </div>
    <details class="muted small"><summary>${esc(t('gacha.rates'))}</summary>${esc(t('gacha.earnTip'))}</details></div>`;
}
function showGacha() { openModal(gachaHtml()); }
function doPull() {
  if (Store.coins() < Rewards.PULL_COST) return;
  $('#modalBody').innerHTML = gachaHtml('spin');
  Sound.play('tick');
  setTimeout(() => {
    const r = Rewards.pull();
    if (!r) return;
    Sound.play(r.rar === 'SSR' || r.rar === 'SR' ? 'goal' : r.dup ? 'tap' : 'level');
    $('#modalBody').innerHTML = gachaHtml(r);
    refreshDog();
  }, 1100);
}
// ── 今日挑戰分享：方格＋連續天數，手機叫出分享選單，不行就複製 ──
async function shareDaily() {
  const grid = Store.dailyGrid(R.key) || P?.marks?.join('') || '';
  const score = Store.daily(R.key) ?? 0, st = Store.streak(R.key);
  const text = `${t('appName')} ${t('mode.daily')} ${Store.dayKey()}・${t('region.' + R.key)}\n${grid} ${score}/10${st ? '\n' + t('share.streak', st) : ''}\nhttps://agan0617.github.io/KMap/`;
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e2) { /* 真的複製不了 */ }
    ta.remove();
  }
  toast(esc(t('share.copied')));
}

// ── 設定 ──
function showSettings() {
  const s = Store.settings();
  const row = (k, name) => `<label class="set"><span>${esc(name)}</span><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}></label>`;
  const cur = s.theme || 'paper';
  const dots = { auto: 'linear-gradient(135deg, #f3ead7 50%, #15181c 50%)', paper: '#f3ead7', white: '#f6f6f2', green: '#d9e7d3', night: '#15181c' };
  const sw = THEMES.map(k => `<button type="button" class="sw" data-theme="${k}" aria-pressed="${k === cur}"><i style="background:${dots[k]}"></i>${esc(t('themes')[k])}</button>`).join('');
  openModal(`<div class="settings"><h2>${esc(t('settings'))}</h2>${row('bgm', t('bgm'))}${row('sfx', t('sfx'))}${row('labels', t('labels'))}
    <div class="set theme"><span>${esc(t('theme'))}</span><div class="swatches">${sw}</div></div>
    <div class="cloud" id="cloudBox">${cloudHtml()}</div>
    <p class="muted">${esc(t('about'))}</p></div>`);
}

// ── 雲端存檔（設定裡的一區）──
function cloudStatus() {
  const st = Sync.status;
  if (st === 'ok') return t('cloud.ok', new Date(Sync.lastSync).toLocaleTimeString(L_HTML(), { hour: '2-digit', minute: '2-digit' }));
  if (st === 'err') return t('cloud.err', Sync.error);
  return t('cloud.' + (st === 'sync' ? 'sync' : st === 'offline' ? 'offline' : 'off'));
}
const L_HTML = () => LANGS.find(x => x.key === lang()).html;
function cloudHtml() {
  const c = Sync.conf(), app = t('cloud.apps')[c.from];
  const head = `<h3>${esc(t('cloud.title'))}</h3><div class="cloud-st st-${Sync.connected() ? Sync.status : 'off'}">${esc(Sync.connected() ? cloudStatus() : t('cloud.off'))}</div>`;
  if (Sync.connected()) {
    return head + `<div class="muted">${esc(app ? t('cloud.reuse', app) : t('cloud.own'))}</div>
      <div class="actions"><button type="button" class="btn" data-cloud="off">${esc(t('cloud.disconnect'))}</button><button type="button" class="btn primary" data-cloud="now">${esc(t('cloud.now'))}</button></div>`;
  }
  const shared = Sync.sharedAvailable() ? `<button type="button" class="btn" data-cloud="shared">${esc(t('cloud.useShared', t('cloud.apps')['shuxia:gh'] + '／' + t('cloud.apps')['mt.gh']))}</button>` : '';
  return head + `<p class="muted">${esc(t('cloud.help'))}</p>
    <div class="token-row"><input id="tokenInput" type="password" autocomplete="off" placeholder="${esc(t('cloud.tokenPh'))}"><button type="button" class="btn primary" data-cloud="connect">${esc(t('cloud.connect'))}</button></div>
    ${shared ? `<div class="actions">${shared}</div>` : ''}`;
}
function refreshCloud() { const b = $('#cloudBox'); if (b) b.innerHTML = cloudHtml(); $('#hSettings').classList.toggle('warn', Sync.status === 'err'); }
// 雲端拉下來有新進度：重畫目前的畫面（答題中就不打斷，下一題自然用新的）
async function cloudPull() {
  const changed = await Sync.pull();
  if (!changed) return;
  refreshDog();
  celebrate(Rewards.check());
  if (!$('#home').hidden) renderHome();
  else if (!$('#book').hidden) renderBook();
  else if (playMap && P && !P.qs) playMap.paint(masteryColor);
}
async function cloudAction(a) {
  if (a === 'connect') {
    const tok = $('#tokenInput').value.trim();
    if (!tok) return;
    try { await Sync.connect(tok); } catch (e) { /* 狀態列會顯示錯誤 */ }
    if (!$('#home').hidden) renderHome();
  } else if (a === 'off') Sync.disconnect();
  else if (a === 'shared') { await Sync.reuseShared(); if (!$('#home').hidden) renderHome(); }
  else if (a === 'now') await cloudPull();
  refreshCloud();
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
  else if (b.id === 'hCloset' || b.id === 'heroDog' || b.id === 'logoDog') { Sound.play('tap'); closetTab = 'head'; showCloset(); }
  else if (b.id === 'hGacha') { Sound.play('tap'); showGacha(); }
  else if (b.dataset.ctab) { Sound.play('tap'); closetTab = b.dataset.ctab; rerenderCloset(); showOnChip(); }
  else if (b.dataset.wear) { Sound.play('tap'); toggleWear(b.dataset.wear); }
  else if (b.dataset.wearset) { Sound.play('level'); wearSet(b.dataset.wearset); }
  else if (b.dataset.title) { Sound.play('tap'); Store.setTitle(Store.title() === b.dataset.title ? null : b.dataset.title); rerenderCloset(); }
  else if (b.hasAttribute('data-pull')) doPull();
  else if (b.dataset.wearNow) { const it = b.dataset.wearNow; Store.wear(KOMUGI_ITEMS[it].slot, it); Sound.play('level'); refreshDog(); toast(`${itemImg(it, 56)}<b>${esc(itemName(it))}</b>`); }
  else if (b.hasAttribute('data-share')) shareDaily();
  else if (b.dataset.scope) { Sound.play('tap'); setScope(b.dataset.scope); }
  else if (b.id === 'pBack' || b.id === 'bBack') goHome();
  else if (b.id === 'hSettings') showSettings();
  else if (b.dataset.cloud) cloudAction(b.dataset.cloud);
  else if (b.id === 'modalClose') closeModal();
  else if (b.dataset.r) {
    const g = REGIONS.find(x => x.key === b.dataset.r);
    if (!g.ready) toast(esc(t('soonToast', t('region.' + g.key), t('regionUnit.' + g.key))));
    else if (g.key !== R.key) { Sound.play('tap'); switchRegion(g.key); }
  }
  else if (b.dataset.card) { Sound.play('tap'); showCard(b.dataset.card); }
  else if (b.hasAttribute('data-next')) advance();
  else if (b.hasAttribute('data-home')) { closeModal(); goHome(); }
  else if (b.dataset.again) { closeModal(); startMode(b.dataset.again); }
  else if (b.hasAttribute('data-peek')) { P.peek = true; playMap.mark(P.to, 'goal'); playMap.label(P.to, R.short(P.to), 'goal'); travelPanel(); }
  else if (b.hasAttribute('data-labels')) { Store.setSetting('labels', !Store.settings().labels); startExplore(); }
  else if (b.dataset.theme) { Store.setSetting('theme', b.dataset.theme); applyTheme(); document.querySelectorAll('.sw').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.theme === b.dataset.theme))); }
});
// 答完題點題目區（地圖以外、按鈕以外）也進下一題；地圖那邊由 answer() 處理
$('#pPanel').addEventListener('click', e => {
  if (!P?.answered || !P.qs || P.mode === 'timed' || e.target.closest('button, a')) return;
  advance();
});
document.addEventListener('change', e => {
  const k = e.target.dataset.set;
  if (!k) return;
  Store.setSetting(k, e.target.checked);
  if (k === 'bgm') music(bgmStyle);
});
// 按下和放開都在遮罩上才關：地圖在 pointerup 就開卡片，瀏覽器隨後補送的 click 會落在剛蓋上來的遮罩上
let downOnScrim = false;
$('#modal').addEventListener('pointerdown', e => { downOnScrim = e.target.id === 'modal'; });
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && downOnScrim) closeModal(); downOnScrim = false; });
// 瀏覽器規定要使用者先互動才能出聲
document.addEventListener('pointerdown', function unlock() {
  Sound.init(); music(bgmStyle);
  document.removeEventListener('pointerdown', unlock);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    Sound.stopBgm();
    // 切走前把還沒推的進度推上去（keepalive：頁面關掉也送得出去）
    if (Sync.timer) Sync.push(true);
  } else {
    music(bgmStyle);
    cloudPull();
  }
});

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
R = regionData(Store.settings().region || REGIONS[0].key) || regionData(REGIONS[0].key);
refreshDog();
$('#appVer').textContent = 'v' + APP_VERSION;
applyLang();
renderTabs();
applyTheme();
renderHome();
Store.onProgress(() => Sync.schedule());
celebrate(Rewards.check());
Sync.onStatus = refreshCloud;
cloudPull();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
