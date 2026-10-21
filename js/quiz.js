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

  const capLabel = ja => ({ '県': '縣廳', '府': '府廳', '都': '都廳', '道': '道廳' })[ja.slice(-1)] || '首府';
  const stem = s => s.replace(/[県府都道市區（）都廳]/g, '');

  // 提示裡出現縣名或縣廳所在地名就等於洩題，日文寫法與繁中寫法都要遮
  const TRAD = { 静: '靜', 広: '廣', 徳: '德', 縄: '繩', 児: '兒', 戸: '戶', 浜: '濱', 沢: '澤', 関: '關', 黒: '黑' };
  const variants = s => [...new Set([s, [...s].map(c => TRAD[c] || c).join('')])];
  function masker(R, id) {
    const u = R.units[id];
    const words = [...variants(R.short(id)), ...variants(stem(u.cap[0]))].filter(w => w.length > 1).sort((a, b) => b.length - a.length);
    return t => words.reduce((s, w) => s.split(w).join('○○'), t);
  }

  // 一塊能出的知識題提示
  function clues(R, id) {
    const u = R.units[id], L = [], m = masker(R, id);
    if (stem(u.cap[0]) !== stem(u.ja)) L.push({ k: 'cap', tag: capLabel(u.ja) + '所在地', t: `${u.cap[0]}（${u.cap[1]}）` });
    for (const [n, k, q] of u.old) if (q) L.push({ k: 'old', tag: '舊國名', t: `${n}（${k}）` });
    for (const f of u.foods) L.push({ k: 'food', tag: '名產', t: m(f) });
    for (const s of u.sights) L.push({ k: 'sight', tag: '名勝', t: m(s) });
    L.push({ k: 'fact', tag: '這裡是…', t: m(u.fact) });
    if (u.dia && u.dia[2] !== 0) L.push({ k: 'dia', tag: '方言', t: `「${u.dia[0]}」＝${u.dia[1]}` });
    return L;
  }

  function question(R, type, id, r = Math.random) {
    if (type === 'mix') type = r() < 0.5 ? 'loc' : 'know';
    const u = R.units[id];
    if (type === 'loc') return { type, id, tag: '找位置', main: u.ja, sub: u.kana };
    const c = pick(clues(R, id), r);
    return { type, id, tag: c.tag, main: c.t, sub: '這是哪裡？', clue: c.k };
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
