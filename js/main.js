// 畫面與玩法流程：首頁、關卡模式（每 5 關一個限時關；每天第一次過關＝完成今日挑戰）、挑戰模式（只出找位置）、圖鑑、御朱印帳。
// 2026-10-22 Ken 要求：找位置／知識／選擇題三種題目只混在今日挑戰與關卡裡出，拿掉各自的入口、鄰接旅行與限時連擊。
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
  const n = Store.level(R.sk, id);
  if (!n) return '';
  return mixColor(R.areas[R.units[id].area].color, [0, 0.32, 0.62, 1][n]);
}
let toastTimer = null;
function toast(html, ms = 1600, cls = '') {
  const el = $('#toast');
  el.innerHTML = html; el.hidden = false; el.className = cls; void el.offsetWidth; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}
function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
}
function music(style) {
  bgmStyle = style;
  Sound.bgm(R.music, Store.settings().bgm ? style : null);
}
function openModal(html, onClose, fixed = false) {
  $('#modalBody').innerHTML = html;
  // fixed：true＝固定高度（衣櫃）；字串＝另外指定的版型 class（知識卡）
  $('#modal .sheet').className = 'sheet' + (fixed ? ' ' + (fixed === true ? 'fixed' : fixed) : '');
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
  // 答題中途切換：題目是出題當下的語言，從下一題起換新語言
}

// ── 首頁 ──
function renderTabs() {
  $('#regionTabs').innerHTML = REGIONS.map(g =>
    `<button type="button" class="tab ${g.key === R.key ? 'on' : ''} ${g.ready ? '' : 'soon'}" data-r="${g.key}">${esc(t('region.' + g.key))}${g.ready ? '' : `<small>${esc(t('soon'))}</small>`}</button>`).join('');
  $('#regionTabs .on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}
function renderHome() {
  if (!homeMap) {
    homeMap = createMap($('#homeMap'), R, { static: true });
    homeMap.onTap(id => { if (!id) return; Sound.play('tap'); showCard(id); });
  }
  homeMap.paint(masteryColor);
  // 已解開（到訪以上）的地方標地名，跟圖鑑一樣塞得下才顯示（Ken 2026-10-21 要求）
  homeMap.clearLabels();
  for (const id of R.ids) if (Store.level(R.sk, id) >= 1) homeMap.label(id, R.short(id), 'auto');
  applyScope(homeMap);
  renderScope();
  $('#mBook b').textContent = R.label('book');
  const c = Store.counts(R.sk, R.ids), n = R.ids.length;
  const seg = (k, cls) => c[k] ? `<i class="${cls}" style="flex:${c[k]}"></i>` : '';
  $('#homeProgress').innerHTML = `
    <div class="bar">${seg(3, 'l3')}${seg(2, 'l2')}${seg(1, 'l1')}${seg(0, 'l0')}</div>
    <div class="legend"><span class="l3">${lv(3)} ${c[3]}</span><span class="l2">${lv(2)} ${c[2]}</span><span class="l1">${lv(1)} ${c[1]}</span><span class="l0">${lv(0)} ${c[0]}</span><b>${c[3]} / ${n}</b></div>`;
  // 地圖左上角的解鎖百分比：到訪以上的地方佔比（Ken 2026-10-21 要求）
  const unlocked = n - c[0];
  $('#homeUnlock').textContent = t('unlocked', Math.round(unlocked / n * 100), unlocked, n);
  const next = Store.lvNext(R.key);
  $('#levelGo').textContent = t('level.go', next) + (Quiz.isTimedLevel(next) ? `・${t('level.timed')}` : '');
  $('#levelInfo').textContent = t('level.info', Store.lvCount(R.key));
  // 每日獎勵（原本的今日挑戰）：今天還沒過關就提示第一關的獎勵，過了就顯示連續天數
  const st = Store.dayStreak();
  const cb = Store.best(R.key, chalKey());
  $('#chalTitle').textContent = `${t('chal.title')}・${scopeName()}`;
  $('#chalInfo').textContent = cb ? t('chal.info', CHAL_LIVES, cb) : t('chal.infoNew', CHAL_LIVES);
  // 卡片右半邊（Ken 2026-10-22 要求）：上面是今天完成了沒，下面把連續天數做成醒目的標籤
  $('#levelDay').innerHTML = `<small>${esc(t('level.dayLabel'))}</small><span>${esc(Store.clearedToday() ? t('level.dayOk') : t('level.dayTodo', Rewards.EARN.daily))}</span>`
    + (st ? `<em class="streak">🔥 ${esc(t('level.dayStreak', st))}</em>` : '');
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
  const u = R.units[id], n = Store.level(R.sk, id), a = R.areas[u.area], rec = Store.unit(R.sk, id), c = R.card(id);
  const chips = arr => arr.map(x => `<span class="chip">${esc(x)}</span>`).join('');
  const dots = [1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('');
  return `
  <div class="card" style="--area:${a.color}">
    <div class="card-head">
      <div><div class="card-area">${esc(R.areaName(u.area))}</div><h2>${c.flag ? `<span class="flag">${c.flag}</span>` : ''}${esc(R.name(id))}</h2><div class="kana">${esc(R.sub(id))}</div></div>
      ${n === 3 ? stampHtml(id, rec?.stamped) : ''}
    </div>
    <div class="mastery"><span class="dots">${dots}</span><b>${lv(n)}</b><small>${esc(hintText(Store.nextHint(R.sk, id)))}</small></div>
    <dl>
      ${c.cap ? `<dt>${esc(c.capLabel)}</dt><dd>${esc(c.cap)}<small>${esc(c.capSub || '')}</small></dd>` : ''}
      ${c.old.length ? `<dt>${esc(R.label('old'))}</dt><dd>${c.old.map(o => `${esc(o.n)}<small>${esc(o.sub)}</small>`).join(lang() === 'en' ? ', ' : '、')}</dd>` : ''}
      ${c.foods.length ? `<dt>${esc(t('foods'))}</dt><dd>${chips(c.foods)}</dd>` : ''}
      ${c.sights.length ? `<dt>${esc(t('sights'))}</dt><dd>${chips(c.sights)}</dd>` : ''}
      ${c.fact ? `<dt>${esc(t('fact'))}</dt><dd>${[c.fact, ...(c.facts || [])].map(f => esc(f.replace(/○○/g, R.short(id)))).join('<br>')}</dd>` : ''}
      ${c.dia ? `<dt>${esc(R.label('dia'))}</dt><dd><b class="dia">${esc(c.dia.w)}</b> ${esc(c.dia.m)}</dd>` : ''}
      ${R.stats[id] ? `<dt>${esc(t('qs.name.area'))}・${esc(t('qs.name.pop'))}</dt><dd>${esc(Quiz.fmtStat('area', R.stats[id].area))}・${esc(Quiz.fmtStat('pop', R.stats[id].pop))}</dd>` : ''}
      ${c.extra.length ? `<dt>${esc(t('xtra'))}</dt><dd class="xtra">${c.extra.map(e => `<small>${esc(t('xk.' + e.k))}</small>${esc(e.t.replace(/○○/g, R.short(id)))}`).join('<br>')}</dd>` : ''}
    </dl>
    <a class="src" href="${esc(c.wiki)}" target="_blank" rel="noopener">${esc(t('source', c.wikiTitle))}</a>
  </div>`;
}
// 知識卡的上一個／下一個（Ken 2026-10-21 要求，不用關掉卡片就能看下一個）：順序跟紀念章冊一樣，分區依序、區內照 id
function cardOrder() { return Object.keys(R.areas).flatMap(ak => R.ids.filter(id => R.units[id].area === ak)); }
function cardNav(id) {
  const ids = cardOrder(), i = ids.indexOf(id);
  if (i < 0 || ids.length < 2) return '';
  const prev = ids[(i - 1 + ids.length) % ids.length], next = ids[(i + 1) % ids.length];
  return `<div class="card-nav"><button type="button" class="btn" data-card="${prev}" data-nav="prev">‹ ${esc(R.short(prev))}</button>
    <small>${i + 1} / ${ids.length}</small><button type="button" class="btn" data-card="${next}" data-nav="next">${esc(R.short(next))} ›</button></div>`;
}
// 知識卡視窗大小固定、上一個／下一個釘在底部，切換時按鈕不會跟著內容長短跳（Ken 2026-10-21 要求）
function showCard(id) {
  const nav = cardNav(id);
  openModal(`<div class="card-scroll">${cardHtml(id)}</div>${nav}`, null, nav ? 'cardsheet' : false);
  $('#modal .card-scroll')?.scrollTo(0, 0);
}

// ── 遊玩畫面 ──
function ensurePlayMap() {
  if (!playMap) playMap = createMap($('#playMap'), R);
  playMap.clearMarks('ok', 'ng', 'target', 'visited', 'goal', 'here');
  playMap.clearLabels(); playMap.clearMarkers(); playMap.showLinks(false); playMap.path(null);
  playMap.paint(masteryColor);
  applyScope(playMap);
}
// ex＝答案解析：有的話面板分左右兩欄，題目與對錯在左、解析在題目旁邊；這時按鈕移到地圖右下角（Ken 2026-10-22 要求）
function setPanel(prompt, feedback = '', actions = '', ex = '') {
  $('#pPrompt').innerHTML = prompt;
  $('#pFeedback').innerHTML = feedback;
  $('#pActions').innerHTML = ex ? '' : actions;
  $('#pMapActs').innerHTML = ex ? actions : '';
  $('#pEx').innerHTML = ex; $('#pEx').hidden = !ex;
  $('#pPanel').classList.toggle('answered', !!ex);
}
function setStat(html) { $('#pStat').innerHTML = html; }

// mode：level／explore；level 要帶關號 n
function startMode(mode, n) {
  // 關卡照順序開：前一關沒有星就不能打
  if (mode === 'level' && n > 1 && !Store.lvStars(R.key, n - 1)) { toast(esc(t('level.locked', n - 1))); return; }
  show('play');
  ensurePlayMap();
  const timed = mode === 'level' && Quiz.isTimedLevel(n);
  // 關卡的標題後面寫過關條件（Ken 2026-10-22 要求從首頁卡片移過來）
  $('#pTitle').innerHTML = mode === 'level' ? `${esc(t('level.n', n) + (timed ? `・${t('level.timed')}` : ''))}<small class="cond">${esc(timed ? t('level.condTimed', needOf(n), TIMED_SEC) : t('level.cond', needOf(n)))}</small>`
    : esc(mode === 'chal' ? `${t('chal.title')}・${scopeName()}` : t('mode.' + mode));
  $('#pTimer').hidden = !timed;
  clearInterval(P?.timer);
  P = { mode, level: n, timed, i: 0, score: 0, combo: 0, maxCombo: 0, ups: [], stamps: [], answered: false, marks: [], achs: [], lives: CHAL_LIVES };
  if (mode === 'explore') return startExplore();
  music(timed ? 'fast' : 'calm');
  // 作答中地圖不照熟練度上色：已學過的地方有顏色，等於把答案範圍先圈出來（Ken 2026-10-21 指出）
  playMap.paint(() => '');
  // 找位置挑戰：題目答一題出一題（照複習優先度），只用首頁選的分區
  P.qs = mode === 'chal' ? [] : Quiz.level(R, n);
  if (timed) { P.timer = setInterval(timedTick, 100); P.t0 = Date.now(); }
  playMap.onTap(answer);
  nextQuestion();
}
// 過關門檻（Ken 2026-10-22 要求：沒有星星，只有過關與否，越後面越難）：
// 普通關 10 題要答對 5 + 每 10 關 1 題（第 10 關 6 題、第 20 關 7 題…），第 40 關起封頂 9 題（不要求全對）；
// 限時關 60 秒內要答對的題數＝同一關的普通門檻 + 2
const needOf = n => Math.min(9, 5 + Math.floor(n / 10)) + (Quiz.isTimedLevel(n) ? 2 : 0);

// ── 找位置挑戰（Ken 2026-10-22 要求：只想練找位置的入口）：照首頁選的分區出，錯 3 次結束，各分區記最佳 ──
const CHAL_LIVES = 3;
const scopeName = () => scopeKey() === 'all' ? t('region.' + R.key) : R.areaName(scopeKey());
const chalKey = () => 'chal:' + scopeKey();
function chalNext() {
  // 不跟上一題同一個地方
  const prev = P.qs[P.i - 1]?.id, ids = pool(), pick = ids.length > 1 ? ids.filter(x => x !== prev) : ids;
  return Quiz.session(R, 'loc', 1, pick)[0];
}

// ── 答題流程 ──
function nextQuestion() {
  if (P.mode === 'chal') { if (P.lives <= 0) return finishQuiz(); P.qs[P.i] = chalNext(); }
  const q = P.qs[P.i];
  if (!q) return finishQuiz();
  P.answered = false;
  playMap.clearMarks('ok', 'ng', 'target'); playMap.clearLabels();
  P.hint = 1; P.match = { pick: null, done: [], err: 0 };
  renderQuestion();
  updateStat();
}
function renderQuestion() {
  const q = P.qs[P.i];
  // 短的提示（名產、名勝、首府、國旗…）放大字，句子型的照一般字級
  const big = q.type === 'loc' || ['food', 'sight', 'cap', 'old', 'dia', 'flag', 'foreign'].includes(q.clue);
  const main = q.clue === 'guess' ? guessHtml(q) : q.html || esc(q.main);
  // 選擇題：四個選項放在題目下面（答完也留著，標出對錯）；「這塊是哪裡」「和誰相鄰」先在地圖上亮出題目那塊
  const choices = q.kind === 'match' ? matchHtml(q) : q.type === 'choice' ? `<div class="choices ${q.kind === 'tf' ? 'tf' : ''}">${q.options.map((o, i) => `<button type="button" class="btn choice" data-choice="${i}">${esc(o.label)}</button>`).join('')}</div>` : '';
  if (q.mark) playMap.mark(q.mark, 'target');
  const flagQ = q.clue === 'flag' || q.kind === 'flag', bigQ = q.type === 'choice' ? q.kind === 'flag' : big;
  // 猜猜我是誰：還有沒亮的提示就給「再一個提示」
  const hintBtn = q.clue === 'guess' && P.hint < q.list.length ? `<button type="button" class="btn" data-hint>${esc(t('guess.more', Rewards.EARN.guess))}</button>` : '';
  setPanel(`<span class="tag ${q.type}">${esc(q.tag)}</span><div class="q-main ${bigQ ? 'big' : ''} ${flagQ ? 'flag-q' : ''}">${main}</div>${q.sub ? `<div class="q-sub">${esc(q.sub)}</div>` : ''}${choices}`, '', hintBtn);
}
// 猜猜我是誰：已經亮的提示一條一行
const guessHtml = (q, all) => `<ol class="guess">${q.list.slice(0, all ? q.list.length : P.hint).map(c => `<li><small>${esc(c.tag)}</small>${esc(c.t)}</li>`).join('')}</ol>`;
// 連連看：左邊地方、右邊名產（順序打亂）；配對成功的兩邊一起變綠
function matchHtml(q) {
  const M = P.match;
  const left = q.places.map((x, i) => `<button type="button" class="btn mt ${M.done.includes(i) ? 'right' : M.pick === i ? 'on' : ''}" data-ml="${i}" ${M.done.includes(i) || P.answered ? 'disabled' : ''}>${esc(R.short(x))}</button>`).join('');
  const right = q.right.map(i => `<button type="button" class="btn mt ${M.done.includes(i) ? 'right' : ''}" data-mr="${i}" ${M.done.includes(i) || P.answered ? 'disabled' : ''}>${esc(q.items[i])}</button>`).join('');
  return `<div class="match"><div>${left}</div><div>${right}</div></div>`;
}
function matchTap(side, i) {
  const q = P.qs?.[P.i], M = P.match;
  if (!q || q.kind !== 'match' || P.answered) return;
  if (side === 'l') { M.pick = i; Sound.play('tap'); return renderQuestion(); }
  if (M.pick == null) return;
  if (M.pick === i) { M.done.push(i); Sound.play('ok', M.done.length - 1); }
  else { M.err++; Sound.play('ng'); }
  M.pick = null;
  if (M.done.length < q.places.length) return renderQuestion();
  renderQuestion();
  answer(null, M.err ? 1 : 0);
}
function updateStat() {
  const combo = P.combo > 1 ? `<span class="combo">${t('combo', P.combo)}</span>` : '';
  if (P.mode === 'chal') setStat(`${'❤️'.repeat(Math.max(0, P.lives))}${'🤍'.repeat(CHAL_LIVES - Math.max(0, P.lives))} ${esc(t('level.okN', P.score))}${combo}`);
  else if (P.timed) setStat(`${esc(t('level.okN', P.score))} / ${needOf(P.level)}${combo}`);
  else setStat(`${Math.min(P.i + 1, P.qs.length)} / ${P.qs.length}${combo}`);
}
function answer(id, choiceIdx) {
  // 答完後再點畫面任何地方＝下一題（Ken 2026-10-21 要求）；限時連擊會自己跳
  if (P.answered && P.qs && !P.timed) return advance();
  const q = P.qs?.[P.i];
  if (q?.type === 'choice') {
    // 選擇題只認按鈕；點地圖不算作答
    if (choiceIdx == null || P.answered) return;
    const o = q.options[choiceIdx];
    id = o.id;
    document.querySelectorAll('#pPrompt .btn.choice').forEach((b, i) => { b.disabled = true; b.classList.toggle('right', q.options[i].ok); b.classList.toggle('wrong', i === choiceIdx && !o.ok); });
    if (o.ok) id = q.id;
    else if (id === q.id) id = null;   // 選項是別的地方的首府／名產，但剛好對到答案本身的不會發生；保險起見當成沒點到地方
  }
  if (!q || P.answered || (!id && q.type !== 'choice')) return;
  const ok = q.type === 'choice' ? q.options[choiceIdx].ok : id === q.id;
  P.answered = true;
  // 選擇題算「知識」類，制霸條件（找位置＋知識都答對過）照舊
  const ch = Store.record(R.sk, q.id, q.type === 'choice' ? 'know' : q.type, ok);
  P.marks.push(ok ? '🟩' : '🟥');
  if (ok) { Store.stat('langs', lang()); Store.stat('maxCombo', P.combo + 1); gain(Rewards.EARN.ok + (P.combo + 1 >= 5 ? Rewards.EARN.combo : 0)); }
  // 猜猜我是誰：沒用到的提示每條 +2
  if (ok && q.clue === 'guess') gain(Rewards.EARN.guess * (q.list.length - P.hint));
  if (q.clue === 'guess') $('#pPrompt .q-main').innerHTML = guessHtml(q, true);
  if (q.kind === 'match') for (const x of q.places) if (x !== q.id) playMap.label(x, R.short(x), 'auto');
  if (q.kind === 'tf' && q.owner !== q.id) playMap.label(q.owner, R.short(q.owner), 'auto');
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
    P.score++;
    Sound.play('ok', P.combo - 1);
    if (q.marks) for (const x of q.marks) playMap.label(x, R.short(x), x === q.id ? 'ok' : 'auto');
    playMap.mark(q.id, 'ok'); playMap.label(q.id, R.short(q.id), 'ok');
    const up = ch.to > ch.from && ch.to < 3 ? `<span class="up">${esc(t('up', lv(ch.to)))}</span>` : '';
    setPanel($('#pPrompt').innerHTML, `<div class="fb ok">${esc(t('ok'))}${q.type !== 'loc' ? '　' + nameHtml(q.id) : ''}${up}</div>`,
      P.timed ? '' : `${cardBtn}${nextBtn}`, P.timed ? '' : explain(q));
    // 有解析要留時間讀，不自動跳；點畫面任何地方就下一題。限時連擊照舊自動跳
    if (P.timed) P.auto = setTimeout(advance, 450);
  } else {
    P.combo = 0;
    if (P.mode === 'chal') P.lives--;
    Sound.play('ng');
    if (id) { playMap.mark(id, 'ng'); playMap.label(id, R.short(id), 'ng'); }
    if (q.marks) for (const x of q.marks) if (x !== id) playMap.label(x, R.short(x), 'auto');
    playMap.mark(q.id, 'target'); playMap.label(q.id, R.short(q.id), 'target');
    const wrongTxt = q.kind === 'match' ? esc(t('match.wrong', P.match.err)) : q.type === 'choice' ? t('wrongChoice', esc(q.options[choiceIdx].label), esc(q.options.find(o => o.ok).label)) : t('wrong', esc(R.name(id)), nameHtml(q.id));
    setPanel($('#pPrompt').innerHTML, `<div class="fb ng">${wrongTxt}</div>`,
      P.timed ? '' : `${cardBtn}${nextBtn}`, P.timed ? '' : explain(q, id, q.type === 'choice' ? q.options[choiceIdx].label : null));
    if (P.timed) P.auto = setTimeout(advance, 1100);
  }
  updateStat();
}
// 答案解析（Ken 2026-10-21 要求）：答案在哪、和誰相鄰；答錯時點的地方在答案的哪個方向；知識題的提示原本屬於誰
function hops(from, to) {
  const dist = { [from]: 0 }, q = [from];
  while (q.length) { const a = q.shift(); if (a === to) return dist[a]; for (const b of R.graph[a] || []) if (dist[b] == null) { dist[b] = dist[a] + 1; q.push(b); } }
  return -1;
}
function dirOf(from, to) {
  const a = R.map.shapes[from], b = R.map.shapes[to];
  // 插圖框裡的地方（沖繩、金門、馬祖）位置不是真實方位
  if (!a || !b || (R.map.frames || []).some(f => f.id === from || f.id === to)) return '';
  // 地圖座標 y 向下：角度 0 = 北，順時針每 45° 一格
  const deg = (Math.atan2(b.cx - a.cx, a.cy - b.cy) * 180 / Math.PI + 360) % 360;
  return t('ex.dir')[Math.round(deg / 45) % 8];
}
function explain(q, picked, chosen) {
  const id = q.id, c = R.card(id), name = R.name(id), sep = t('ex.listSep');
  const nb = [...(R.graph[id] || [])].map(x => R.short(x));
  let where = t('ex.where', name, R.areaName(R.units[id].area)) + (nb.length ? t('ex.nb', nb.slice(0, 5).join(sep) + (nb.length > 5 ? sep + '…' : '')) : t('ex.island'));
  const lines = [where];
  // 選擇題選錯首府／名產／名勝：說明選到的那個其實是哪裡的
  if (picked && picked !== id && q.type === 'choice' && ['cap', 'foods', 'sights'].includes(q.kind)) lines.push(t('ex.is', chosen, R.name(picked)));
  else if (picked && picked !== id && dirOf(id, picked)) {
    const n = hops(picked, id);
    lines.push(t(q.type === 'choice' ? 'ex.chosen' : 'ex.picked', R.name(picked), name, dirOf(id, picked)) + (n === 1 ? t('ex.adj') : n > 1 ? t('ex.hops', n - 1) : t('ex.far')));
  }
  if (q.kind === 'most') lines.push(t('ex.most', t('cdir.' + q.dir), q.marks.map(x => R.short(x)).join(sep), name));
  else if (q.kind === 'nb') lines.push(t('ex.nbOf', R.name(q.mark), name));
  else if (q.kind === 'foods' || q.kind === 'sights') lines.push(t('ex.is', q.options.find(o => o.ok).label, R.name(q.mark || q.id)));
  else if (q.kind === 'tf') lines.push(t('ex.is', q.item, R.name(q.owner)));
  // 排行、之最題：出題時就算好的解說（名次與數字、極點的地名）
  if (q.ex) lines.push(...q.ex);
  else if (q.kind === 'match') q.places.forEach((x, i) => lines.push(t('ex.is', q.items[i], R.name(x))));
  if (q.type === 'choice' && q.kind !== 'which' && q.kind !== 'cap') { /* 上面已寫 */ }
  else if (q.clue === 'dir') lines.push(t('ex.at', name, R.short(q.from), dirOf(q.from, id)));
  else if (q.clue === 'flag') lines.push(t('ex.is', q.tag, name));
  else if (q.clue === 'foreign') lines.push(t('ex.is', q.main, name));
  else if (q.clue === 'link') lines.push(q.main.replace(/？|\?$/, '') + ' → ' + name);
  else if (q.clue === 'nb') { /* 第一行已列出鄰居 */ }
  else if (q.clue === 'guess' || q.clue === 'stat' || q.clue === 'rec') { /* 提示已在題目區，名次與解說在 q.ex */ }
  else if (q.type === 'know') lines.push(t('ex.clue', q.tag, q.main.split('○○').join(R.short(id)), name));
  else {
    if (c.cap) lines.push(t('ex.cap', c.capLabel, c.cap));
    if (c.fact) lines.push(c.fact.replace(/○○/g, R.short(id)));
  }
  return lines.map(s => `<p>${esc(s)}</p>`).join('');
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
  $('#pMapActs').innerHTML = '';
  if (P.mode === 'chal') return finishChal();
  const total = P.timed ? null : P.qs.length;
  // 關卡：答對題數到門檻就過關；第一次過這一關給過關獎勵（關卡照順序開，所以就是「打到新的一關」）
  const n = P.level, need = needOf(n), pass = P.score >= need, perfect = !P.timed && P.score === total, E = Rewards.EARN;
  const fresh = pass && Store.setLvStars(R.key, n, 1) > 0;
  if (fresh) gain(E.levelClear);
  // 今日挑戰（Ken 2026-10-22 要求併進關卡）：每天第一次過關（任何分頁）就算完成，基本 +30、全對再 +30、連續天數每天 +5（最多 +50）
  let day = '';
  if (pass && Store.dayClear()) {
    const streak = Store.dayStreak();
    if (perfect) Store.stat('dailyPerfect', (Store.stats().dailyPerfect || 0) + 1);
    const got = [[t('dailyBonus'), E.daily], perfect && [t('perfectBonus'), E.dailyPerfect], streak > 1 && [t('streakBonus', streak), Math.min(E.dailyStreak * streak, E.dailyStreakMax)]].filter(Boolean);
    const bonus = got.reduce((s, [, v]) => s + v, 0);
    gain(bonus);
    day = `<div class="daily-bonus day"><b>🎁 ${esc(t('level.dayGot', streak))} +${bonus} 🐾</b><small>${got.map(([k, v]) => `${esc(k)} +${v}`).join('・')}</small></div>`;
  }
  const head = `<div class="big-score">${P.score}<small>${total ? ` / ${total}` : ''}</small></div>
    <div class="${pass ? 'new-rec' : 'muted'}">${esc(pass ? t('level.clear') : t('level.fail', need))}</div>
    ${day}
    ${fresh ? `<div class="daily-bonus"><b>🎁 +${E.levelClear} 🐾</b><small>${esc(t('level.clearBonus'))}</small></div>` : ''}
    <div class="muted">${esc(P.timed ? t('level.timedGoal', need, TIMED_SEC) : t('level.goal', need, total))}</div>`;
  const actions = pass ? `<button type="button" class="btn primary" data-level="${n + 1}">${esc(t('level.next'))}</button>`
    : `<button type="button" class="btn primary" data-level="${n}">${esc(t('level.retry'))}</button>`;
  const ups = P.ups.filter(x => x.to < 3).map(x => `<span class="chip">${esc(R.short(x.id))} → ${esc(lv(x.to))}</span>`).join('');
  const stamps = P.stamps.map(id => stampHtml(id)).join('');
  celebrate(Rewards.check());   // 關卡星數、今日挑戰全對／連續天數在結算時才算得出來
  const achs = P.achs.map(a => `<span class="chip">🏅 ${esc(achText(a))}</span>`).join('');
  Sound.play(P.score >= (total || 10) * 0.8 ? 'goal' : 'level');
  const title = P.mode === 'level' ? t('level.n', P.level) + (P.timed ? `・${t('level.timed')}` : '') : t('mode.' + P.mode);
  openModal(`
    <div class="result">
      <div class="result-dog">${komugiImg(72)}</div>
      <h2>${esc(t('finished', title))}</h2>
      ${head}
      <div class="muted">${esc(t('maxCombo', P.maxCombo))}</div>
      ${P.coins ? `<div class="coins">${esc(t('coinsGot', '+' + P.coins))}</div>` : ''}
      ${stamps ? `<h3>${esc(t('newStamps'))}</h3><div class="stamps">${stamps}</div>` : ''}
      ${ups ? `<h3>${esc(t('ups'))}</h3><div class="chips">${ups}</div>` : ''}
      ${achs ? `<h3>${esc(t('closet.achTab'))}</h3><div class="chips">${achs}</div>` : ''}
      <div class="actions">
        <button type="button" class="btn" data-home>${esc(t('home'))}</button>
        ${actions}
      </div>
    </div>`, null);
  P.qs = null;
}

// 找位置挑戰的結算：答對幾題、這個分區的最佳紀錄
function finishChal() {
  const rec = Store.setBest(R.key, chalKey(), P.score), best = Store.best(R.key, chalKey());
  const ups = P.ups.filter(x => x.to < 3).map(x => `<span class="chip">${esc(R.short(x.id))} → ${esc(lv(x.to))}</span>`).join('');
  const stamps = P.stamps.map(id => stampHtml(id)).join('');
  celebrate(Rewards.check());
  Sound.play(rec ? 'goal' : 'level');
  openModal(`
    <div class="result">
      <div class="result-dog">${komugiImg(72)}</div>
      <h2>${esc(t('finished', `${t('chal.title')}・${scopeName()}`))}</h2>
      <div class="big-score">${P.score}<small>${esc(t('chal.unit'))}</small></div>
      ${rec && P.score ? `<div class="new-rec">${esc(t('newRec'))}</div>` : `<div class="muted">${esc(t('chal.best', best))}</div>`}
      <div class="muted">${esc(t('maxCombo', P.maxCombo))}</div>
      ${P.coins ? `<div class="coins">${esc(t('coinsGot', '+' + P.coins))}</div>` : ''}
      ${stamps ? `<h3>${esc(t('newStamps'))}</h3><div class="stamps">${stamps}</div>` : ''}
      ${ups ? `<h3>${esc(t('ups'))}</h3><div class="chips">${ups}</div>` : ''}
      <div class="actions">
        <button type="button" class="btn" data-home>${esc(t('home'))}</button>
        <button type="button" class="btn primary" id="mChalAgain">${esc(t('chal.again'))}</button>
      </div>
    </div>`, null);
  P.qs = null;
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
  const c = Store.counts(R.sk, R.ids);
  $('#book .hud-title').textContent = R.label('book');
  $('#bStat').textContent = `${c[3]} / ${R.ids.length}`;
  let html = '';
  for (const [ak, a] of Object.entries(R.areas)) {
    const ids = R.ids.filter(id => R.units[id].area === ak);
    if (!ids.length) continue;
    html += `<h3 style="--area:${a.color}">${esc(R.areaName(ak))}</h3><div class="book-grid">`;
    for (const id of ids) {
      const n = Store.level(R.sk, id), rec = Store.unit(R.sk, id);
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
// 首頁小屋：全身 Komugi、稱號、下一個旅程稱號、肉球幣、扭蛋還能抽幾次
function renderHero() {
  if (!$('#heroDog')) return;
  $('#heroDog').innerHTML = komugiFullImg(104);
  $('#heroTitle').textContent = titleName(curTitle());
  const g = Rewards.nextTitle();
  $('#heroBubble').textContent = g ? t('hero.goal', g.left, titleName('u' + g.k), g.pct.toFixed(1)) : t('hero.allDone');
  $('#heroCoins').textContent = '🐾 ' + Store.coins();
  const n = Math.floor(Store.coins() / Rewards.PULL_COST);
  $('#gachaBadge').hidden = !n; $('#gachaBadge').textContent = n;
  // 三顆按鈕平常同色；肉球幣夠扭時扭蛋才變紅（Ken 2026-10-21 指定）
  $('#hGacha').classList.toggle('primary', n > 0);
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
// 稱號名稱：旅程稱號 u1～u1000＝形容＋階級（每 50 個換一個階級），u0／沒選＝見習旅人；其餘是套裝稱號
function titleName(id) {
  const m = /^u(\d+)$/.exec(id || '');
  if (!m) return t('closet.titles')[id] || t('closet.titles').none;
  const k = +m[1];
  if (!k) return t('closet.titles').none;
  const d = t('closet.descs')[(k - 1) % 50], r = t('closet.ranks')[Math.floor((k - 1) / 50)];
  return lang() === 'en' ? `${d} ${r}` : d + r;
}
// 首頁顯示的稱號：自己選過且還能用就用那個，否則用最新拿到的旅程稱號
function curTitle() {
  const sel = Store.title();
  return sel && Rewards.titleOk(sel) ? sel : 'u' + Rewards.titleCount();
}
// 拿到新的旅程稱號就跳通知（記在 stats.titleN，換裝置不會重複跳）
function checkTitles() {
  const n = Rewards.titleCount(), was = Store.stats().titleN || 0;
  if (n <= was) return;
  Store.stat('titleN', n);
  if (was) toast(`<b>🎖 ${esc(t('closet.newTitle', titleName('u' + n)))}</b>${n - was > 1 ? `<small>${esc(t('closet.newTitles', n - was))}</small>` : ''}`, 2200, 'ach');
}
// 新解鎖的成就：跳通知、記到這一局的結算裡（成就的幣在 Rewards.check 裡已經發了）
function celebrate(fresh) {
  checkTitles();
  if (!fresh.length) return;
  fresh.forEach((a, i) => setTimeout(() => {
    toast(`<b>🏅 ${esc(t('closet.achGot', achText(a)))}</b><small>+${Rewards.EARN.ach} 🐾</small>`, 2200, 'ach');
    Sound.play('level');
  }, 400 + i * 2300));
  if (P) { P.achs.push(...fresh); P.coins = (P.coins || 0) + fresh.length * Rewards.EARN.ach; }
  refreshDog();
}
// 稱號列（旅程稱號、套裝稱號共用）：拿到了才有「設為稱號」
function titleRow(id, ok, sub, extra = '') {
  const on = Store.title() === id;
  return `<div class="set-row ${ok ? 'done' : ''}"><div class="set-head"><b>「${esc(titleName(id))}」</b><small>${esc(sub)}</small></div>${extra}
    ${ok ? `<div class="set-actions"><button type="button" class="btn small" data-wearset="${id}">${esc(t('closet.wearSet'))}</button><button type="button" class="btn small ${on ? 'primary' : ''}" data-title="${id}">${esc(on ? t('closet.titleOn') : t('closet.useTitle'))}</button></div>` : ''}</div>`;
}
// 旅程稱號：拿到的排成小標籤（最新的在前面，點了就設成稱號），後面接著三個還沒拿到的
function journeyHtml() {
  const n = Rewards.titleCount(), g = Rewards.nextTitle(), cur = curTitle();
  const chip = k => `<button type="button" class="tchip ${'u' + k === cur ? 'on' : ''}" data-title="u${k}">${esc(titleName('u' + k))}</button>`;
  const locked = [];
  for (let k = n + 1; k <= Math.min(Rewards.TITLE_N, n + 3); k++) locked.push(`<span class="tchip locked">${esc(titleName('u' + k))}</span>`);
  const got = [];
  for (let k = n; k >= 1; k--) got.push(chip(k));
  return `<h3>${esc(t('closet.journey'))} ${n} / ${Rewards.TITLE_N}</h3>
    <p class="muted small">${esc(t('closet.journeyHow', g ? g.pct.toFixed(1) : 100))}</p>
    <div class="tchips">${locked.reverse().join('')}${got.join('') || `<span class="tchip on">${esc(titleName('u0'))}</span>`}</div>`;
}

// 衣櫃：上面是全身預覽，下面依部位分頁，最後兩頁是稱號（旅程＋套裝）與成就
let closetTab = 'head';
function closetHtml() {
  const outfit = Store.outfit(), ctx = Rewards.context(), got = Store.achievements();
  const total = Object.keys(KOMUGI_ITEMS).length, have = Object.keys(KOMUGI_ITEMS).filter(Store.owns).length;
  const tabName = k => k === 'sets' ? t('closet.sets') : k === 'ach' ? t('closet.achTab') : t('closet.slots')[k];
  const tabs = [...KOMUGI_SLOTS, 'sets', 'ach'].map(k => `<button type="button" class="${k === closetTab ? 'on' : ''}" data-ctab="${k}">${esc(tabName(k))}</button>`).join('');
  let body = '';
  if (closetTab === 'ach') {
    for (const a of Rewards.ACH) {
      const v = Math.min(a.value(ctx), a.target), done = !!got[a.id];
      body += `<div class="set-row ${done ? 'done' : ''}"><div class="set-head"><b>${done ? '🏅' : '・'} ${esc(achText(a))}</b><small>${esc(done ? t('closet.achDone', got[a.id]) : `${v} / ${a.target}`)}</small></div></div>`;
    }
  } else if (closetTab === 'sets') {
    body += journeyHtml();
    body += `<h3>${esc(t('closet.setTitles'))}</h3>`;
    for (const st of Rewards.SETS) body += titleRow(st.id, Rewards.setDone(st), `${t('closet.setNames')[st.id]}・${Rewards.setProgress(st)} / ${st.items.length}`,
      `<div class="set-items">${st.items.map(i => `<span class="mini ${Store.owns(i) ? '' : 'locked'}" title="${esc(itemName(i))}">${itemImg(i, 40)}</span>`).join('')}</div>`);
  } else {
    body = '<div class="items">';
    for (const it of Object.keys(KOMUGI_ITEMS).filter(k => KOMUGI_ITEMS[k].slot === closetTab)) {
      const own = Store.owns(it), on = outfit[closetTab] === it, rar = KOMUGI_ITEMS[it].rar;
      const how = own ? (on ? t('closet.wearing') : '') : t('closet.locked');
      body += `<button type="button" class="item-tile rar-${rar} ${own ? 'got' : 'locked'} ${on ? 'on' : ''}" ${own ? `data-wear="${it}"` : 'disabled'}>
        <i class="rar">${rar}</i>${itemImg(it, 56)}<b>${esc(own ? itemName(it) : '？？？')}</b><small>${esc(how)}</small></button>`;
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
  if (Array.isArray(res)) {
    // 全部扭：一次列出這一輪拿到的所有配件，新的排前面
    const newN = res.filter(r => !r.dup).length, dupN = res.length - newN;
    const tiles = [...res].sort((a, b) => a.dup - b.dup).map(r => `<div class="item-tile got rar-${r.rar}"><i class="rar">${r.rar}</i>${itemImg(r.item, 48)}<b>${esc(itemName(r.item))}</b><small>${r.dup ? esc(t('gacha.dupShort')) : `<em class="new">${esc(t('gacha.isNew'))}</em>`}</small></div>`).join('');
    out = `<div class="muted">${esc(t('gacha.multiSum', res.length, newN, dupN, dupN * Rewards.DUP_REFUND))}</div><div class="items gacha-multi">${tiles}</div>`;
  } else if (res && res !== 'spin') {
    const r = res;
    out = `<div class="gacha-res rar-${r.rar}"><i class="rar">${r.rar}</i>${itemImg(r.item, 96)}<b>${esc(itemName(r.item))}</b>
      <small>${r.dup ? esc(t('gacha.dup', Rewards.DUP_REFUND)) : `<em class="new">${esc(t('gacha.isNew'))}</em>`}</small></div>`;
  }
  const n = Math.floor(coins / Rewards.PULL_COST);
  return `<div class="gacha"><h2>${esc(t('gacha.title'))}</h2>${res && res !== 'spin' ? out : machine}
    <div class="coins big">🐾 ${coins}</div><div class="muted">${esc(t('gacha.cost', Rewards.PULL_COST))}</div>
    ${Rewards.allOwned() ? `<p class="muted">${esc(t('gacha.allOwned'))}</p>` : ''}
    ${can ? '' : `<p class="muted">${esc(t('gacha.notEnough'))}</p>`}
    <div class="actions">
      ${res && res !== 'spin' && !Array.isArray(res) && !res.dup ? `<button type="button" class="btn" data-wear-now="${res.item}">${esc(t('gacha.wear'))}</button>` : ''}
      <button type="button" class="btn primary" data-pull ${can ? '' : 'disabled'}>${esc(res && res !== 'spin' ? t('gacha.again') : t('gacha.pull'))}</button>
      ${n >= 2 ? `<button type="button" class="btn primary" data-pull-all>${esc(t('gacha.pullAll', n))}</button>` : ''}
    </div>
    <p class="muted small">${esc(t('gacha.rates'))}</p><details class="muted small"><summary>${esc(t('gacha.earnTitle'))}</summary>${esc(t('gacha.earnTip'))}</details></div>`;
}
function showGacha() { openModal(gachaHtml()); }
// 全部扭：肉球幣夠幾次就扭幾次（重複退回的幣夠的話也接著扭），最後一次列出全部結果
function doPullAll() {
  if (Store.coins() < Rewards.PULL_COST) return;
  $('#modalBody').innerHTML = gachaHtml('spin');
  Sound.play('tick');
  setTimeout(() => {
    const got = [];
    while (Store.coins() >= Rewards.PULL_COST && got.length < 200) { const r = Rewards.pull(); if (!r) break; got.push(r); }
    if (!got.length) return;
    Sound.play(got.some(r => r.rar === 'SSR' || r.rar === 'SR') ? 'goal' : 'level');
    $('#modalBody').innerHTML = gachaHtml(got);
    refreshDog();
  }, 1100);
}
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
  else if (b.id === 'mLevel') { Sound.play('tap'); startMode('level', Store.lvNext(R.key)); }
  else if (b.id === 'mChal' || b.id === 'mChalAgain') { Sound.play('tap'); closeModal(); startMode('chal'); }
  else if (b.dataset.level) { Sound.play('tap'); closeModal(); startMode('level', +b.dataset.level); }
  else if (b.id === 'mBook') { Sound.play('tap'); renderBook(); show('book'); }
  else if (b.id === 'hCloset' || b.id === 'heroDog' || b.id === 'logoDog') { Sound.play('tap'); closetTab = 'head'; showCloset(); }
  else if (b.id === 'hGacha') { Sound.play('tap'); showGacha(); }
  else if (b.dataset.ctab) { Sound.play('tap'); closetTab = b.dataset.ctab; rerenderCloset(); showOnChip(); }
  else if (b.dataset.wear) { Sound.play('tap'); toggleWear(b.dataset.wear); }
  else if (b.dataset.wearset) { Sound.play('level'); wearSet(b.dataset.wearset); }
  else if (b.dataset.title) { Sound.play('tap'); Store.setTitle(Store.title() === b.dataset.title ? null : b.dataset.title); rerenderCloset(); }
  else if (b.hasAttribute('data-pull')) doPull();
  else if (b.hasAttribute('data-pull-all')) doPullAll();
  else if (b.dataset.wearNow) { const it = b.dataset.wearNow; Store.wear(KOMUGI_ITEMS[it].slot, it); Sound.play('level'); refreshDog(); toast(`${itemImg(it, 56)}<b>${esc(itemName(it))}</b>`); }
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
  else if (b.dataset.choice != null) answer(null, +b.dataset.choice);
  else if (b.dataset.ml != null) matchTap('l', +b.dataset.ml);
  else if (b.dataset.mr != null) matchTap('r', +b.dataset.mr);
  else if (b.hasAttribute('data-hint')) { if (P && !P.answered) { P.hint++; Sound.play('tap'); renderQuestion(); } }
  else if (b.hasAttribute('data-next')) advance();
  else if (b.hasAttribute('data-home')) { closeModal(); goHome(); }
  else if (b.hasAttribute('data-labels')) { Store.setSetting('labels', !Store.settings().labels); startExplore(); }
  else if (b.dataset.theme) { Store.setSetting('theme', b.dataset.theme); applyTheme(); document.querySelectorAll('.sw').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.theme === b.dataset.theme))); }
});
// 答完題點題目區（地圖以外、按鈕以外）也進下一題；地圖那邊由 answer() 處理
$('#pPanel').addEventListener('click', e => {
  if (!P?.answered || !P.qs || P.timed || e.target.closest('button, a')) return;
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
// 電腦上看知識卡：左右方向鍵切上一個／下一個
document.addEventListener('keydown', e => {
  if ($('#modal').hidden || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
  $(`#modal [data-nav="${e.key === 'ArrowLeft' ? 'prev' : 'next'}"]`)?.click();
});
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
// 1.10.0 以前存的是 world（拆成各洲前），改開亞洲
const savedRegion = Store.settings().region === 'world' ? 'asia' : Store.settings().region;
R = regionData(savedRegion || REGIONS[0].key) || regionData(REGIONS[0].key);
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
