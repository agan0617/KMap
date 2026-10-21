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
    if (c.dia?.q) L.push({ k: 'dia', tag: R.label('dia'), t: `「${c.dia.w}」＝${m(c.dia.m)}` });
    return L;
  }

  function question(R, type, id, r = Math.random) {
    if (type === 'mix') type = r() < 0.5 ? 'loc' : 'know';
    if (type === 'know') {
      const L = clues(R, id);
      if (L.length) { const c = pick(L, r); return { type, id, tag: c.tag, main: c.t, sub: t('where'), clue: c.k }; }
    }
    return { type: 'loc', id, tag: t('mode.loc'), main: R.name(id), sub: R.sub(id) };
  }

  // 一輪練習：依複習權重抽，不重複
  function session(R, type, n, pool = R.ids, r = Math.random, weightFn = id => Store.weight(R.key, id)) {
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
