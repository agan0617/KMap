// 出題：找位置（loc）與知識找地點（know），以及鄰接旅行的起訖點。
const Quiz = (() => {
  // 可重現的亂數（今日挑戰用日期當種子，大家同一天同一組題）
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];
  function weighted(ids, w, r = Math.random) {
    const total = ids.reduce((s, id) => s + w(id), 0);
    let x = r() * total;
    for (const id of ids) { x -= w(id); if (x <= 0) return id; }
    return ids[ids.length - 1];
  }

  const stem = s => s.replace(/[県府都道市區区（）]/g, '');

  // 提示裡出現縣名或縣廳所在地名就等於洩題，各語言的寫法都遮成○○
  function masker(R, id) {
    const words = R.maskWords(id);
    return s => words.reduce((acc, w) => acc.split(w).join('○○'), s);
  }

  // 一塊能出的知識題提示（目前語言）
  function clues(R, id) {
    const u = R.units[id], c = R.card(id), L = [], m = masker(R, id);
    const both = (a, b) => (b && b !== a ? `${a}（${b}）` : a);
    if (stem(u.cap[0]) !== stem(u.ja)) L.push({ k: 'cap', tag: c.capLabel, t: both(c.cap, c.capSub) });
    for (const o of c.old) if (o.q) L.push({ k: 'old', tag: t('old'), t: both(o.n, o.sub) });
    for (const f of c.foods) L.push({ k: 'food', tag: t('foods'), t: m(f) });
    for (const s of c.sights) L.push({ k: 'sight', tag: t('sights'), t: m(s) });
    L.push({ k: 'fact', tag: t('factClue'), t: m(c.fact) });
    if (c.dia.q) L.push({ k: 'dia', tag: t('dia'), t: `「${c.dia.w}」＝${m(c.dia.m)}` });
    return L;
  }

  function question(R, type, id, r = Math.random) {
    if (type === 'mix') type = r() < 0.5 ? 'loc' : 'know';
    if (type === 'loc') return { type, id, tag: t('mode.loc'), main: R.name(id), sub: R.sub(id) };
    const c = pick(clues(R, id), r);
    return { type, id, tag: c.tag, main: c.t, sub: t('where'), clue: c.k };
  }

  // 一輪練習：依複習權重抽，不重複
  function session(R, type, n, r = Math.random, weightFn = id => Store.weight(R.key, id)) {
    const pool = [...R.ids], out = [];
    while (out.length < n && pool.length) {
      const id = weighted(pool, weightFn, r);
      pool.splice(pool.indexOf(id), 1);
      out.push(question(R, type, id, r));
    }
    return out;
  }
  function daily(R) {
    const seed = Store.today() * 7919 + R.key.length;
    const r = rng(seed);
    return session(R, 'mix', 10, r, () => 1);
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
  function trip(R) {
    for (let i = 0; i < 200; i++) {
      const a = pick(R.ids), { dist } = bfs(R, a);
      const far = R.ids.filter(b => dist[b] >= 4 && dist[b] <= 9);
      if (far.length) { const b = pick(far); return { from: a, to: b, best: dist[b] }; }
    }
    return null;
  }

  return { session, daily, question, clues, trip, route, bfs };
})();
