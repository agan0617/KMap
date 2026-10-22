// 出題：找位置（loc）、知識找地點（know）、選擇題（choice），混在今日挑戰與關卡裡出。
// pool 是這一輪能出題的區塊；沒給就是整個地區。
const Quiz = (() => {
  // 可重現的亂數（今日挑戰用日期當種子，大家同一天同一組題）
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  }
  const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];
  function weighted(ids, w, r = Math.random) {
    const total = ids.reduce((s, id) => s + w(id), 0);
    let x = r() * total;
    for (const id of ids) { x -= w(id); if (x <= 0) return id; }
    return ids[ids.length - 1];
  }

  // 提示裡出現自己的名稱或首府名就等於洩題，各語言的寫法都遮成○○
  function masker(R, id) {
    const words = R.maskWords(id);
    return s => words.reduce((acc, w) => acc.split(w).join('○○'), s);
  }
  // 名產、名勝若有兩個地方寫成一樣就不出題（答案不唯一）
  const dupCache = {};
  function dups(R) {
    const k = R.key + '.' + lang();
    if (dupCache[k]) return dupCache[k];
    const n = {};
    for (const id of R.ids) { const c = R.card(id); for (const s of [...c.foods, ...c.sights]) n[s] = (n[s] || 0) + 1; }
    return (dupCache[k] = new Set(Object.keys(n).filter(s => n[s] > 1)));
  }

  // 一塊能出的知識題提示（目前語言）
  function clues(R, id) {
    const c = R.card(id), L = [], m = masker(R, id), dup = dups(R);
    const both = (a, b) => (b && b !== a ? `${a}（${b}）` : a);
    if (c.capClue) L.push({ k: 'cap', tag: c.capLabel, t: both(c.cap, c.capSub) });
    for (const o of c.old) if (o.q) L.push({ k: 'old', tag: R.label('old'), t: both(o.n, o.sub) });
    const ok = (f, s, i) => !dup.has(s) && !c.skip?.has(`${f}:${i}`);
    c.foods.forEach((s, i) => { if (ok('foods', s, i)) L.push({ k: 'food', tag: t('foods'), t: m(s) }); });
    c.sights.forEach((s, i) => { if (ok('sights', s, i)) L.push({ k: 'sight', tag: t('sights'), t: m(s) }); });
    if (c.fact) L.push({ k: 'fact', tag: t('factClue'), t: m(c.fact) });
    for (const f of c.facts || []) L.push({ k: 'fact', tag: t('factClue'), t: m(f) });
    if (c.dia?.q) L.push({ k: 'dia', tag: R.label('dia'), t: `「${c.dia.w}」＝${m(c.dia.m)}` });
    // 擴充的新知識（data/extra-*.js）：k 用類別區分，猜猜我是誰才會挑不同類的
    for (const e of c.extra || []) L.push({ k: 'x.' + e.k, tag: t('xk.' + e.k), t: m(e.t) });
    return L;
  }

  // ── 不靠知識卡、用地圖本身出的題（2026-10-21 Ken 要求題目多元化）：答案都要唯一 ──
  const nbOf = (R, id) => [...(R.graph[id] || [])];
  // 放在插圖框裡的地方（沖繩、金門、馬祖）在地圖上的位置不是真實方位，方位類的題目都不用它們
  const framed = (R, id) => (R.map.frames || []).some(f => f.id === id);
  // 地圖座標 y 向下：0＝北，順時針每 45° 一格
  function dir8(R, from, to) {
    const a = R.map.shapes[from], b = R.map.shapes[to];
    return Math.round(((Math.atan2(b.cx - a.cx, a.cy - b.cy) * 180 / Math.PI + 360) % 360) / 45) % 8;
  }
  // 鄰居題：給答案的 2～3 個鄰居，沒有別的地方也同時和它們都相鄰才出
  function nbClue(R, id, r) {
    const nb = nbOf(R, id);
    if (nb.length < 2) return null;
    const given = [...nb].sort(() => r() - 0.5).slice(0, Math.min(3, nb.length));
    const others = R.ids.filter(x => x !== id && given.every(g => R.graph[x]?.has(g)));
    if (others.length) return null;
    return { k: 'nb', tag: t('qt.nb'), t: t('qnb', given.map(g => R.short(g)).join(t('ex.listSep'))) };
  }
  // 方位題：「X 的東邊鄰居」，X 在那個方向只有答案一個鄰居才出
  function dirClue(R, id, r) {
    if (framed(R, id)) return null;
    const cands = nbOf(R, id).filter(x => !framed(R, x) && nbOf(R, x).every(y => !framed(R, y))).filter(x => {
      const d = dir8(R, x, id);
      return nbOf(R, x).filter(y => dir8(R, x, y) === d).length === 1;
    });
    if (!cands.length) return null;
    const x = pick(cands, r), d = dir8(R, x, id);
    return { k: 'dir', tag: t('qt.dir'), t: t('qdir', R.short(x), t('ex.dir')[d]), from: x };
  }
  // 剪影題 2026-10-22 拿掉了（Ken 說很無聊）
  // 國旗題：只有各洲（世界的國家）有
  function flagClue(R, id) {
    const f = R.card(id).flag;
    return f ? { k: 'flag', tag: t('qt.flag'), t: f, flag: true } : null;
  }

  // 外語名題：用另一種語言的名稱找位置（中文介面出英文或日文名、英文介面出中文或日文名…），名稱跟目前語言一樣的不出
  function foreignClue(R, id, r) {
    const here = R.name(id), langs = ['zh', 'en', 'ja'].filter(l => l !== lang());
    // 日文漢字跟中文只差新舊字體（青森県／青森縣、台北／臺北）的也算一樣，不出
    const norm = x => toTrad(x).replace(/台/g, '臺').replace(/[県縣府都道省市州]$/, '');
    const ok = langs.map(l => [l, R.nameIn(id, l)]).filter(([, n]) => n && !norm(n).includes(norm(here)) && !norm(here).includes(norm(n)));
    if (!ok.length) return null;
    const [l, n] = pick(ok, r);
    return { k: 'foreign', tag: t('qt.foreign'), t: n, sub: t('qforeign', t('langName.' + l)) };
  }
  // 連結題：「從 A 經由〈青函隧道〉可以到哪裡？」（地圖上的橋、隧道、航線；同一條連結兩頭都能出）
  function linkClue(R, id, r) {
    const ls = (R.map.links || []).filter(l => (l.a === id && R.units[l.b]) || (l.b === id && R.units[l.a]));
    if (!ls.length) return null;
    const l = pick(ls, r), from = l.a === id ? l.b : l.a;
    return { k: 'link', tag: t('qt.link'), t: t('qlink', R.short(from), t('links')[l.name] || l.name), from, sub: '' };
  }

  // 猜猜我是誰（2026-10-22）：三條不同類的提示一條一條亮，越早點對越多幣；提示不夠三條的地方不出
  function guessClue(R, id, r) {
    const byKind = {};
    for (const c of clues(R, id)) (byKind[c.k] = byKind[c.k] || []).push(c);
    const kinds = shuffle(Object.keys(byKind), r);
    if (kinds.length < 3) return null;
    // 首府放最後一條（最好猜）
    const order = kinds.sort((a, b) => (a === 'cap') - (b === 'cap')).slice(0, 3);
    return { k: 'guess', tag: t('qt.guess'), t: '', list: order.map(k => pick(byKind[k], r)) };
  }

  // ── 排行題（Ken 2026-10-22 要求「最大的縣、人口最多的縣、最東邊」）：面積、人口、人口密度從 data/stats.js 算 ──
  const STATS = ['area', 'pop', 'dens'];
  function fmtStat(k, v) {
    const l = lang(), n = x => Math.round(x).toLocaleString('en');
    if (k === 'area') return l === 'zh' ? `${n(v)} 平方公里` : `${n(v)} km²`;
    if (k === 'dens') return l === 'zh' ? `每平方公里 ${n(v)} 人` : l === 'ja' ? `1 km² あたり ${n(v)} 人` : `${n(v)} people/km²`;
    const d = (x, k2) => (x >= 10 * k2 ? Math.round(x / k2) : Math.round(x / k2 * 10) / 10);
    if (l === 'en') return v >= 1e6 ? `${d(v, 1e6)} million` : `${n(v)}`;
    const wan = l === 'zh' ? '萬' : '万';
    return v >= 1e8 ? `${d(v, 1e8)} 億人` : v >= 1e4 ? `${d(v, 1e4)} ${wan}人` : `${n(v)} 人`;
  }
  // 這一頁照某項排序（大到小）
  const ranked = (R, k) => R.ids.filter(x => R.stats[x]).sort((a, b) => R.stats[b][k] - R.stats[a][k]);
  const statLine = (R, k, x) => `${R.short(x)} ${fmtStat(k, R.stats[x][k])}`;
  // 點地圖：「臺灣人口第 2 多的是哪裡？」只問前三名與最後兩名，而且跟前後名次差 3% 以上
  function statClue(R, id, r) {
    if (!R.stats[id]) return null;
    const opts = [];
    for (const k of STATS) {
      const list = ranked(R, k), n = list.length, i = list.indexOf(id);
      if (n < 5) continue;
      const v = x => R.stats[x][k], far = (a, b) => !b || Math.abs(v(a) - v(b)) / Math.max(v(a), v(b)) >= 0.03;
      if (!far(id, list[i - 1]) || !far(id, list[i + 1])) continue;
      if (i < 3) opts.push({ k, big: true, rank: i + 1, list, i });
      else if (i >= n - 2) opts.push({ k, big: false, rank: n - i, list, i });
    }
    if (!opts.length) return null;
    const o = pick(opts, r), dir = o.big ? 'big' : 'small';
    const phrase = o.rank === 1 ? t(`qs.${dir}1.${o.k}`) : t(`qs.${dir}N.${o.k}`, t('qs.nth', o.rank));
    const near = o.list.slice(Math.max(0, o.i - 1), o.i + 2).map(x => statLine(R, o.k, x)).join(t('ex.listSep'));
    return { k: 'stat', tag: t('qt.stat'), t: t('qs.ask', t('region.' + R.key), phrase), sub: '', ex: [t('ex.rank', t('qs.name.' + o.k), near)] };
  }
  // 點地圖：「之最」題（極點、最高峰、最大的湖…），題目與解說在 data/stats.js 的 records
  function recordClue(R, id, r) {
    const recs = R.records.filter(x => x.answer === id);
    if (!recs.length) return null;
    const x = pick(recs, r), l = lang();
    const note = l === 'en' ? x.noteEn : l === 'ja' ? x.noteJa : x.note;
    return { k: 'rec', tag: t('qt.rec'), t: x[l] || x.zh, sub: '', ex: note ? [`${R.short(id)}：${note}`] : [] };
  }

  // ── 選擇題（Ken 2026-10-21 要求：不只點地圖，也要有四選一）──
  // 干擾選項優先挑同一分區、再挑鄰居，太好猜的（別的分區、遠方）最後才補
  function distract(R, id, n, ok, r) {
    const area = R.units[id].area, nb = R.graph[id] || new Set();
    const tiers = [R.ids.filter(x => x !== id && R.units[x].area === area), R.ids.filter(x => x !== id && nb.has(x)), R.ids.filter(x => x !== id)];
    const out = [];
    for (const tier of tiers) {
      const c = tier.filter(x => !out.includes(x) && ok(x)).sort(() => r() - 0.5);
      while (out.length < n && c.length) out.push(c.pop());
      if (out.length >= n) break;
    }
    return out;
  }
  const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function choice(R, id, r) {
    const c = R.card(id), dup = dups(R), kinds = [];
    const names = (others, label) => shuffle([{ label: label(id), ok: true, id }, ...others.map(x => ({ label: label(x), ok: false, id: x }))], r);
    const nameOpts = () => { const o = distract(R, id, 3, () => true, r); return o.length === 3 ? names(o, x => R.name(x)) : null; };
    // 這塊是哪裡：地圖上亮一塊
    kinds.push(() => { const o = nameOpts(); return o && { kind: 'which', tag: t('ct.which'), main: t('cq.which'), mark: id, options: o }; });
    // 首府／首都是？（首府名裡就有地名的不出）
    if (c.cap && c.capClue) kinds.push(() => {
      const o = distract(R, id, 3, x => { const k = R.card(x); return k.cap && k.cap !== c.cap; }, r);
      return o.length === 3 && { kind: 'cap', tag: c.capLabel, main: t('cq.cap', R.name(id), c.capLabel), options: names(o, x => R.card(x).cap) };
    });
    // 哪一個是 X 的名產／名勝？（別的地方也有同名的不出）
    for (const [f, lab] of [['foods', 'foods'], ['sights', 'sights']]) {
      const mine = c[f].filter((s, i) => !dup.has(s) && !c.skip?.has(`${f}:${i}`));
      if (mine.length) kinds.push(() => {
        const o = distract(R, id, 3, x => R.card(x)[f].some(s => !dup.has(s)), r);
        if (o.length < 3) return null;
        const pickOf = x => { const a = R.card(x)[f].filter(s => !dup.has(s)); return a[Math.floor(r() * a.length)]; };
        const opts = shuffle([{ label: pick(mine, r), ok: true, id }, ...o.map(x => ({ label: pickOf(x), ok: false, id: x }))], r);
        return { kind: f, tag: t(lab), main: t(f === 'foods' ? 'cq.food' : 'cq.sight', R.name(id)), options: opts };
      });
    }
    // 哪裡和 X 相鄰？（答案是 X 的一個鄰居，其他三個都不相鄰）
    const nb = [...(R.graph[id] || [])];
    if (nb.length) kinds.push(() => {
      const ans = pick(nb, r), o = distract(R, id, 3, x => !R.graph[id].has(x), r);
      return o.length === 3 && { kind: 'nb', tag: t('qt.nb'), main: t('cq.nb', R.name(id)), mark: id, answerId: ans,
        options: shuffle([{ label: R.name(ans), ok: true, id: ans }, ...o.map(x => ({ label: R.name(x), ok: false, id: x }))], r) };
    });
    // 這四個哪個最北／南／東／西？（第一名要明顯勝出，差太少不出）
    kinds.push(() => {
      if (framed(R, id)) return null;
      const four = [id, ...distract(R, id, 3, x => !framed(R, x), r)];
      if (four.length < 4) return null;
      const dirs = ['n', 's', 'e', 'w'], d = pick(dirs, r), S = x => R.map.shapes[x];
      const v = x => d === 'n' ? -S(x).cy : d === 's' ? S(x).cy : d === 'e' ? S(x).cx : -S(x).cx;
      const sorted = [...four].sort((a, b) => v(b) - v(a));
      const span = Math.max(...four.map(x => S(x).cx)) - Math.min(...four.map(x => S(x).cx)) + Math.max(...four.map(x => S(x).cy)) - Math.min(...four.map(x => S(x).cy));
      if (v(sorted[0]) - v(sorted[1]) < span * 0.08) return null;
      return { kind: 'most', dir: d, tag: t('ct.most'), main: t('cq.most', t('cdir.' + d)), answerId: sorted[0], marks: four,
        options: shuffle(four.map(x => ({ label: R.name(x), ok: x === sorted[0], id: x })), r) };
    });
    // 看國旗選名字
    if (c.flag) kinds.push(() => { const o = nameOpts(); return o && { kind: 'flag', tag: t('qt.flag'), main: c.flag, options: o }; });
    // 排行：兩個比大小、四個選最大（差距要夠，太接近的不出）
    if (R.stats[id]) {
      kinds.push(() => {
        const k = pick(STATS, r), v = x => R.stats[x][k];
        const o = distract(R, id, 1, x => R.stats[x] && Math.abs(v(x) - v(id)) / Math.max(v(x), v(id)) >= 0.08, r)[0];
        if (!o) return null;
        const two = shuffle([id, o], r), win = v(id) > v(o) ? id : o;
        return { kind: 'cmp', tag: t('ct.cmp'), main: t('cq.cmp', R.name(two[0]), R.name(two[1]), t('qs.more.' + k)), answerId: win, marks: two,
          options: two.map(x => ({ label: R.name(x), ok: x === win, id: x })), ex: [two.map(x => statLine(R, k, x)).join(t('ex.listSep'))] };
      });
      kinds.push(() => {
        const k = pick(STATS, r), v = x => R.stats[x][k];
        const four = [id, ...distract(R, id, 3, x => !!R.stats[x], r)];
        if (four.length < 4) return null;
        const s = [...four].sort((a, b) => v(b) - v(a));
        if ((v(s[0]) - v(s[1])) / v(s[0]) < 0.1) return null;
        return { kind: 'rank4', tag: t('ct.cmp'), main: t('cq.rank4', t(`qs.big1.${k}`)), answerId: s[0], marks: four,
          options: shuffle(four.map(x => ({ label: R.name(x), ok: x === s[0], id: x })), r), ex: [s.map(x => statLine(R, k, x)).join(t('ex.listSep'))] };
      });
    }
    // 是非題（2026-10-22）：「〇〇是 X 的名產？」一半是真的、一半換成同一分區別的地方的
    const own = f => R.card(id)[f].filter((s, i) => !dup.has(s) && !c.skip?.has(`${f}:${i}`));
    // 是非題、連連看各佔一個題型（名產或名勝隨機挑一種），才不會出得比其他題型多
    const fs = ['foods', 'sights'].filter(f => own(f).length);
    if (fs.length) kinds.push(() => {
      const f = pick(fs, r), truth = r() < 0.5;
      let item = pick(own(f), r), owner = id;
      if (!truth) {
        const o = distract(R, id, 1, x => R.card(x)[f].some(s => !dup.has(s)), r)[0];
        if (!o) return null;
        owner = o; item = pick(R.card(o)[f].filter(s => !dup.has(s)), r);
      }
      return { kind: 'tf', tag: t('ct.tf'), main: t(f === 'foods' ? 'cq.tfFood' : 'cq.tfSight', item, R.name(id)), owner, item,
        options: [{ label: t('tf.yes'), ok: truth, id }, { label: t('tf.no'), ok: !truth, id }] };
    });
    // 連連看（2026-10-22）：四個地方配四個名產或名勝，全部配對、中間沒配錯才算答對
    if (fs.length) kinds.push(() => {
      const f = pick(fs, r), o = distract(R, id, 3, x => R.card(x)[f].some(s => !dup.has(s)), r);
      if (o.length < 3) return null;
      const four = shuffle([id, ...o], r);
      const items = four.map(x => x === id ? pick(own(f), r) : pick(R.card(x)[f].filter(s => !dup.has(s)), r));
      return { kind: 'match', tag: t('ct.match'), main: t(f === 'foods' ? 'cq.matchFood' : 'cq.matchSight'), places: four, items,
        right: shuffle(four.map((_, i) => i), r), options: [{ label: '', ok: true, id }, { label: '', ok: false, id }] };
    });
    for (const k of shuffle(kinds, r)) { const q = k(); if (q) return Object.assign({ type: 'choice', id: q.answerId || id, sub: '' }, q); }
    return null;
  }

  function question(R, type, id, r = Math.random) {
    // 知識類多一點（Ken 2026-10-22 要「多一點小知識」）
    if (type === 'mix') { const x = r(); type = x < 0.25 ? 'loc' : x < 0.65 ? 'know' : 'choice'; }
    if (type === 'choice') { const q = choice(R, id, r); if (q) return q; type = 'know'; }
    if (type === 'know') {
      // 先抽題型再抽提示：知識卡提示一半、其餘題型平分另一半，才不會被知識卡的條數淹沒
      const L = clues(R, id);
      const special = [nbClue(R, id, r), dirClue(R, id, r), flagClue(R, id), foreignClue(R, id, r), linkClue(R, id, r), guessClue(R, id, r), statClue(R, id, r), recordClue(R, id, r)].filter(Boolean);
      const c = special.length && (!L.length || r() < 0.5) ? pick(special, r) : L.length ? pick(L, r) : null;
      if (c) {
        const sub = c.sub ?? (c.k === 'flag' ? t('qflag') : t('where'));
        return { type, id, tag: c.tag, main: c.t, sub, clue: c.k, from: c.from, list: c.list, ex: c.ex };
      }
    }
    return { type: 'loc', id, tag: t('mode.loc'), main: R.name(id), sub: R.sub(id) };
  }

  // 一輪練習：依複習權重抽，不重複
  function session(R, type, n, pool = R.ids, r = Math.random, weightFn = id => Store.weight(R.sk, id)) {
    const left = [...pool], out = [];
    while (out.length < n && left.length) {
      const id = weighted(left, weightFn, r);
      left.splice(left.indexOf(id), 1);
      out.push(question(R, type, id, r));
    }
    return out;
  }
  // ── 關卡（Ken 2026-10-22 要求）：無限往下、題目從整區題庫隨機抽 ──
  // 用分頁＋關號當種子，同一關重打是同一組題（回來刷星）；每 5 關一個限時關
  const TIMED_EVERY = 5;
  const isTimedLevel = n => n % TIMED_EVERY === 0;
  function seedOf(R, n) {
    let h = 2166136261;
    for (const ch of R.key + ':' + n) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return h >>> 0;
  }
  // 普通關 10 題；限時關先備 60 題（60 秒答不完）
  function level(R, n) {
    const r = rng(seedOf(R, n)), want = isTimedLevel(n) ? 60 : 10, out = [];
    // 地方抽完一輪才重來，題數比地方多的區（南美 12 國）也不會同一個地方連出
    while (out.length < want) out.push(...session(R, 'mix', Math.min(want - out.length, R.ids.length), R.ids, r, () => 1));
    return out;
  }

  return { session, question, clues, level, isTimedLevel, fmtStat };
})();
