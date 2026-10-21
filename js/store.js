// 進度存檔（瀏覽器 localStorage）。
// 每一塊的熟練度：0 未踏 → 1 到訪（答對一次）→ 2 熟悉（隔 2 天以上又答對）→ 3 制霸（熟悉＋找位置與知識題都答對過）。
// 另外用 Leitner 盒子排複習：答對往後排、答錯回到今天。
// 進度（regions）與 meta（統計、成就、Komugi 裝扮）會由 js/sync.js 同步到 CloudSave；settings（語言、音樂…）只留在這台裝置。
const Store = (() => {
  const KEY = 'kmap.v1';
  const GAP_DAYS = 2;
  const INTERVALS = [0, 1, 2, 4, 8, 16];
  let s = read();

  function read() {
    let v = null;
    try { v = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* 私密模式等 */ }
    v = v || {};
    v.settings = Object.assign({ bgm: true, sfx: true, labels: true, lang: null, theme: 'paper' }, v.settings);
    v.regions = v.regions || {};
    v.meta = Object.assign({ stats: {}, ach: {}, outfit: {}, outfitAt: 0, owned: {}, earn: {}, spend: {}, pulls: {}, pity: {}, title: null, titleAt: 0 }, v.meta);
    return v;
  }
  // 裝置 id：肉球幣、扭蛋次數按裝置分開記，合併時各裝置取大的再加總，兩台同時玩不會吃掉對方的幣
  const DEV = (() => {
    let d = null;
    try { d = localStorage.getItem('kmap.dev'); } catch (e) { /* 私密模式 */ }
    if (!d) { d = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); try { localStorage.setItem('kmap.dev', d); } catch (e) { /* 存不了就每次新的 */ } }
    return d;
  })();
  const sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
  let onProgress = null;   // 進度有變時呼叫（雲端同步排程推上去）
  function save(progress = true) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* 存不了就算了 */ }
    if (progress) onProgress?.();
  }

  const today = () => { const d = new Date(); return Math.floor((d - d.getTimezoneOffset() * 60000) / 86400000); };
  const dayKey = (n = today()) => new Date(n * 86400000).toISOString().slice(0, 10);

  function region(key) {
    return s.regions[key] || (s.regions[key] = { units: {}, best: {}, daily: {}, grid: {} });
  }
  function unit(key, id) {
    const r = region(key);
    return r.units[id] || (r.units[id] = { lvl: 0, ok: 0, ng: 0, box: 0, due: 0, first: null, last: null, types: {} });
  }
  const level = (key, id) => region(key).units[id]?.lvl || 0;

  // 記一次作答，回傳 { from, to } 熟練度變化
  function record(key, id, type, correct) {
    const u = unit(key, id), t = today(), from = u.lvl;
    u.at = Date.now();
    if (correct) {
      u.ok++;
      if (u.first == null) u.first = t;
      u.last = t;
      u.types[type] = (u.types[type] || 0) + 1;
      u.box = Math.min(u.box + 1, INTERVALS.length - 1);
      u.due = t + INTERVALS[u.box];
      if (u.lvl < 1) u.lvl = 1;
      if (u.lvl < 2 && t - u.first >= GAP_DAYS) u.lvl = 2;
      if (u.lvl === 2 && u.types.loc && u.types.know) { u.lvl = 3; u.stamped = dayKey(t); }
    } else {
      u.ng++;
      u.box = 0;
      u.due = t;
    }
    save();
    return { from, to: u.lvl };
  }

  // 離下一級還差什麼（給知識卡顯示，文字由介面依語言組）
  function nextHint(key, id) {
    const u = region(key).units[id];
    if (!u || u.lvl === 0) return { k: 'l0' };
    if (u.lvl === 1) {
      const wait = u.first + GAP_DAYS - today();
      return wait > 0 ? { k: 'wait', n: wait } : { k: 'today' };
    }
    if (u.lvl === 2) {
      const need = ['loc', 'know'].filter(m => !u.types[m]);
      return need.length ? { k: 'need', modes: need } : { k: 'once' };
    }
    return { k: 'stamped', date: u.stamped };
  }

  // 出題權重：該複習的、錯過的、還沒碰過的優先
  function weight(key, id) {
    const u = region(key).units[id];
    if (!u) return 3;
    const late = today() - u.due;
    if (late >= 0) return 4 + Math.min(late, 4) + (u.ng > u.ok ? 2 : 0);
    return 0.4;
  }

  function counts(key, ids) {
    const c = [0, 0, 0, 0];
    for (const id of ids) c[level(key, id)]++;
    return c;
  }

  // 今日挑戰：每天第一次的成績才算，連續天數另計
  function daily(key) { return region(key).daily[dayKey()] ?? null; }
  // grid：每題對錯的方格字串（分享用），跟分數一樣只記當天第一次
  function setDaily(key, score, grid) {
    const r = region(key), k = dayKey();
    if (r.daily[k] == null) {
      r.daily[k] = score;
      (r.grid = r.grid || {})[k] = grid;
      s.meta.stats.streakBest = Math.max(s.meta.stats.streakBest || 0, streak(key));
      if (score === 10) s.meta.stats.dailyPerfect = (s.meta.stats.dailyPerfect || 0) + 1;
      save();
    }
  }
  const dailyGrid = key => region(key).grid?.[dayKey()] || '';
  function streak(key) {
    const r = region(key);
    let n = 0, t = today();
    if (r.daily[dayKey(t)] == null) t--;
    while (r.daily[dayKey(t)] != null) { n++; t--; }
    return n;
  }

  function best(key, mode) { return region(key).best[mode] || 0; }
  function setBest(key, mode, v) {
    const r = region(key);
    if (v > (r.best[mode] || 0)) { r.best[mode] = v; save(); return true; }
    return false;
  }

  // ── 合併兩份進度（雲端同步用）：熟練度、次數取高的，複習排程用最近玩的那一份 ──
  const minN = (a, b) => (a == null ? b : b == null ? a : Math.min(a, b));
  function mergeUnit(a, b) {
    if (!a) return b;
    if (!b) return a;
    const r = Object.assign({}, (a.at || 0) >= (b.at || 0) ? a : b);
    r.lvl = Math.max(a.lvl || 0, b.lvl || 0);
    r.ok = Math.max(a.ok || 0, b.ok || 0); r.ng = Math.max(a.ng || 0, b.ng || 0);
    r.first = minN(a.first, b.first);
    r.last = Math.max(a.last ?? -1, b.last ?? -1); if (r.last < 0) r.last = null;
    r.types = {};
    for (const k of new Set([...Object.keys(a.types || {}), ...Object.keys(b.types || {})])) r.types[k] = Math.max(a.types?.[k] || 0, b.types?.[k] || 0);
    if (r.lvl === 3) r.stamped = [a.stamped, b.stamped].filter(Boolean).sort()[0] || r.stamped;
    return r;
  }
  function mergeRegion(a = {}, b = {}) {
    const r = { units: {}, best: {}, daily: {} };
    for (const id of new Set([...Object.keys(a.units || {}), ...Object.keys(b.units || {})])) r.units[id] = mergeUnit(a.units?.[id], b.units?.[id]);
    for (const k of new Set([...Object.keys(a.best || {}), ...Object.keys(b.best || {})])) r.best[k] = Math.max(a.best?.[k] || 0, b.best?.[k] || 0);
    Object.assign(r.daily, b.daily, a.daily);   // 同一天兩邊都有就留本機的（每天只記第一次）
    r.grid = Object.assign({}, b.grid, a.grid);
    return r;
  }
  // 統計取大的（語言是集合）、成就聯集取最早的日期、裝扮用最近改的那一份
  function mergeMeta(a = {}, b = {}) {
    const r = { stats: {}, ach: {}, outfit: {}, outfitAt: 0, owned: {} };
    const sa = a.stats || {}, sb = b.stats || {};
    for (const k of new Set([...Object.keys(sa), ...Object.keys(sb)])) {
      r.stats[k] = k === 'langs' ? Object.assign({}, sb.langs, sa.langs) : Math.max(sa[k] || 0, sb[k] || 0);
    }
    for (const k of new Set([...Object.keys(a.ach || {}), ...Object.keys(b.ach || {})])) {
      r.ach[k] = [a.ach?.[k], b.ach?.[k]].filter(Boolean).sort()[0];
    }
    const newer = (a.outfitAt || 0) >= (b.outfitAt || 0) ? a : b;
    r.outfit = Object.assign({}, newer.outfit); r.outfitAt = newer.outfitAt || 0;
    for (const k of new Set([...Object.keys(a.owned || {}), ...Object.keys(b.owned || {})])) r.owned[k] = [a.owned?.[k], b.owned?.[k]].filter(Boolean).sort()[0];
    for (const f of ['earn', 'spend', 'pulls', 'pity']) {
      r[f] = {};
      for (const d of new Set([...Object.keys(a[f] || {}), ...Object.keys(b[f] || {})])) r[f][d] = Math.max(a[f]?.[d] || 0, b[f]?.[d] || 0);
    }
    const nt = (a.titleAt || 0) >= (b.titleAt || 0) ? a : b;
    r.title = nt.title || null; r.titleAt = nt.titleAt || 0;
    return r;
  }
  function mergeProgress(a = {}, b = {}) {
    const r = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) r[k] = mergeRegion(a[k], b[k]);
    return r;
  }
  // 雲端的進度與 meta 併進來；回傳本機有沒有被改到
  function mergeIn(remote, remoteMeta) {
    const merged = mergeProgress(s.regions, remote || {}), meta = mergeMeta(s.meta, remoteMeta || {});
    const changed = JSON.stringify([merged, meta]) !== JSON.stringify([s.regions, s.meta]);
    if (changed) { s.regions = merged; s.meta = meta; save(false); }
    return changed;
  }
  // 雲端那份跟本機合併後是否就等於本機（不等於就要推上去）
  const sameAsLocal = (remote, remoteMeta) =>
    JSON.stringify([mergeProgress(remote || {}, {}), mergeMeta(remoteMeta || {}, {})]) === JSON.stringify([mergeProgress(s.regions, {}), mergeMeta(s.meta, {})]);

  // ── 統計、成就、裝扮 ──
  function stat(k, v) {
    const st = s.meta.stats;
    if (k === 'langs') { if (st.langs?.[v]) return; st.langs = Object.assign({}, st.langs, { [v]: 1 }); }
    else if (k === 'trips' || k === 'trips3') st[k] = (st[k] || 0) + 1;
    else if ((st[k] || 0) >= v) return;
    else st[k] = v;
    save();
  }
  function unlock(id) { if (!s.meta.ach[id]) { s.meta.ach[id] = dayKey(); save(); } }
  // ── 肉球幣、配件、扭蛋 ──
  const M = () => s.meta;
  const coins = () => sum(M().earn) - sum(M().spend);
  function earn(n) { if (n > 0) { M().earn[DEV] = (M().earn[DEV] || 0) + n; save(); } }
  function spend(n) { M().spend[DEV] = (M().spend[DEV] || 0) + n; save(); }
  const owns = item => !!M().owned[item];
  function own(item) { if (!M().owned[item]) { M().owned[item] = dayKey(); save(); } }
  const pullCount = () => sum(M().pulls);
  const pity = () => M().pity[DEV] || 0;
  // 抽完一次：rare＝這次出了 SR 以上（保底計數歸零）
  function pulled(rare) { M().pulls[DEV] = (M().pulls[DEV] || 0) + 1; M().pity[DEV] = rare ? 0 : pity() + 1; save(); }
  function setTitle(id) { M().title = id; M().titleAt = Date.now(); save(); }
  function wear(slot, item) {
    s.meta.outfit = Object.assign({}, s.meta.outfit, { [slot]: item || undefined });
    if (!item) delete s.meta.outfit[slot];
    s.meta.outfitAt = Date.now();
    save();
  }

  return {
    settings: () => s.settings,
    setSetting(k, v) { s.settings[k] = v; save(false); },
    progress: () => s.regions, meta: () => s.meta, mergeProgress, mergeIn, sameAsLocal,
    stats: () => s.meta.stats, stat, achievements: () => s.meta.ach, unlock, outfit: () => s.meta.outfit, wear, dailyGrid,
    coins, earn, spend, owns, own, owned: () => s.meta.owned, pullCount, pity, pulled, title: () => s.meta.title, setTitle,
    onProgress(fn) { onProgress = fn; },
    today, dayKey, level, unit: (k, id) => region(k).units[id], record, nextHint, weight, counts,
    daily, setDaily, streak, best, setBest,
  };
})();
