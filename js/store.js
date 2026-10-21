// 進度存檔（瀏覽器 localStorage）。
// 每一塊的熟練度：0 未踏 → 1 到訪（答對一次）→ 2 熟悉（隔 2 天以上又答對）→ 3 制霸（熟悉＋找位置與知識題都答對過）。
// 另外用 Leitner 盒子排複習：答對往後排、答錯回到今天。
// 進度（regions）會由 js/sync.js 同步到 CloudSave；settings（語言、音樂…）只留在這台裝置。
const Store = (() => {
  const KEY = 'kmap.v1';
  const GAP_DAYS = 2;
  const INTERVALS = [0, 1, 2, 4, 8, 16];
  let s = read();

  function read() {
    let v = null;
    try { v = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* 私密模式等 */ }
    v = v || {};
    v.settings = Object.assign({ bgm: true, sfx: true, labels: true, lang: null }, v.settings);
    v.regions = v.regions || {};
    return v;
  }
  let onProgress = null;   // 進度有變時呼叫（雲端同步排程推上去）
  function save(progress = true) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* 存不了就算了 */ }
    if (progress) onProgress?.();
  }

  const today = () => { const d = new Date(); return Math.floor((d - d.getTimezoneOffset() * 60000) / 86400000); };
  const dayKey = (n = today()) => new Date(n * 86400000).toISOString().slice(0, 10);

  function region(key) {
    return s.regions[key] || (s.regions[key] = { units: {}, best: {}, daily: {} });
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
  function setDaily(key, score) {
    const r = region(key), k = dayKey();
    if (r.daily[k] == null) { r.daily[k] = score; save(); }
  }
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
    return r;
  }
  function mergeProgress(a = {}, b = {}) {
    const r = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) r[k] = mergeRegion(a[k], b[k]);
    return r;
  }
  // 雲端的進度併進來；回傳本機有沒有被改到
  function mergeIn(remote) {
    const merged = mergeProgress(s.regions, remote || {});
    const changed = JSON.stringify(merged) !== JSON.stringify(s.regions);
    if (changed) { s.regions = merged; save(false); }
    return changed;
  }

  return {
    settings: () => s.settings,
    setSetting(k, v) { s.settings[k] = v; save(false); },
    progress: () => s.regions, mergeProgress, mergeIn,
    onProgress(fn) { onProgress = fn; },
    today, dayKey, level, unit: (k, id) => region(k).units[id], record, nextHint, weight, counts,
    daily, setDaily, streak, best, setBest,
  };
})();
