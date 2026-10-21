// 出題：找位置（loc）與知識找地點（know），以及鄰接旅行的起訖點。
// pool 是這一輪能出題的區塊（首頁選的範圍）；沒給就是整個地區。
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
    return L;
  }

  // ── 不靠知識卡、用地圖本身出的題（2026-10-21 Ken 要求題目多元化）：答案都要唯一 ──
  const nbOf = (R, id) => [...(R.graph[id] || [])];
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
    const cands = nbOf(R, id).filter(x => {
      const d = dir8(R, x, id);
      return nbOf(R, x).filter(y => dir8(R, x, y) === d).length === 1;
    });
    if (!cands.length) return null;
    const x = pick(cands, r), d = dir8(R, x, id);
    return { k: 'dir', tag: t('qt.dir'), t: t('qdir', R.short(x), t('ex.dir')[d]), from: x };
  }
  // 剪影題：只給形狀（太小的地方看不出形狀，不出）
  function shapeClue(R, id) {
    const s = R.map.shapes[id];
    if (!s || s.area < 150) return null;
    const n = s.d.match(/-?[\d.]+/g).map(Number);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < n.length; i += 2) { x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]); }
    const pad = Math.max(x1 - x0, y1 - y0) * 0.06;
    const html = `<svg class="silhouette" viewBox="${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}"><path d="${s.d}"/></svg>`;
    return { k: 'shape', tag: t('qt.shape'), t: '', html };
  }
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

  function question(R, type, id, r = Math.random) {
    if (type === 'mix') type = r() < 0.5 ? 'loc' : 'know';
    if (type === 'know') {
      // 先抽題型再抽提示：知識卡提示一半、其餘題型平分另一半，才不會被知識卡的條數淹沒
      const L = clues(R, id);
      const special = [nbClue(R, id, r), dirClue(R, id, r), shapeClue(R, id), flagClue(R, id), foreignClue(R, id, r), linkClue(R, id, r)].filter(Boolean);
      const c = special.length && (!L.length || r() < 0.5) ? pick(special, r) : L.length ? pick(L, r) : null;
      if (c) {
        const sub = c.sub ?? (c.k === 'shape' ? t('qshape') : c.k === 'flag' ? t('qflag') : t('where'));
        return { type, id, tag: c.tag, main: c.t, html: c.html, sub, clue: c.k, from: c.from };
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
  function daily(R) {
    const r = rng(Store.today() * 7919 + R.key.length * 131);
    return session(R, 'mix', 10, R.ids, r, () => 1);
  }

  // ── 鄰接旅行 ──
  function bfs(R, from) {
    const dist = { [from]: 0 }, prev = {}, q = [from];
    while (q.length) {
      const a = q.shift();
      for (const b of R.graph[a]) if (dist[b] == null) { dist[b] = dist[a] + 1; prev[b] = a; q.push(b); }
    }
    return { dist, prev };
  }
  function route(R, from, to) {
    const { prev } = bfs(R, from), out = [to];
    while (out[0] !== from) { const p = prev[out[0]]; if (!p) return null; out.unshift(p); }
    return out;
  }
  // 起訖點都在範圍內；範圍太小找不到 4 步以上的就放寬到 2 步
  function trip(R, pool = R.ids) {
    for (const min of [4, 3, 2]) {
      for (let i = 0; i < 200; i++) {
        const a = pick(pool), { dist } = bfs(R, a);
        const far = pool.filter(b => dist[b] >= min && dist[b] <= 9);
        if (far.length) { const b = pick(far); return { from: a, to: b, best: dist[b] }; }
      }
    }
    return null;
  }

  return { session, daily, question, clues, trip, route, bfs };
})();
