// 成就：每個成就解鎖一件 Komugi 的配件（js/komugi.js 的 KOMUGI_ITEMS）。
// value(ctx) 算目前進度，達到 target 就解鎖；ctx 由 Store 的進度與統計現算，各地區合計。
const Rewards = (() => {
  const ACH = [
    { id: 'firstOk', item: 'strawhat', target: 1, value: c => c.correct },
    { id: 'visit30', item: 'scarf', target: 30, value: c => c.visited },
    { id: 'stamp1', item: 'camera', target: 1, value: c => c.stamps },
    { id: 'trip1', item: 'backpack', target: 1, value: c => c.trips },
    { id: 'combo10', item: 'sunglasses', target: 10, value: c => c.maxCombo },
    { id: 'timed20', item: 'headband', target: 20, value: c => c.timedBest },
    { id: 'polyglot', item: 'beret', target: 3, value: c => c.langs },
    { id: 'dailyPerfect', item: 'roundglasses', target: 1, value: c => c.dailyPerfect },
    { id: 'stamp10', item: 'bandana', target: 10, value: c => c.stamps },
    { id: 'trip3x5', item: 'suitcase', target: 5, value: c => c.trips3 },
    { id: 'areaAll', item: 'map', target: 1, value: c => c.areasMastered },
    { id: 'regionVisitAll', item: 'conical', target: 1, value: c => c.regionsVisited },
    { id: 'fourRegions', item: 'globe', target: 4, value: c => c.regionsPlayed },
    { id: 'daily7', item: 'gradcap', target: 7, value: c => c.streakBest },
    { id: 'stamp50', item: 'medal', target: 50, value: c => c.stamps },
    { id: 'regionMaster', item: 'crown', target: 1, value: c => c.regionsMastered },
  ];

  // 各地區資料只建一次（算分區全制霸要知道每一塊屬於哪一區）
  const cache = {};
  const reg = k => cache[k] || (cache[k] = regionData(k));

  function context() {
    const st = Store.stats();
    const c = { correct: 0, visited: 0, stamps: 0, areasMastered: 0, regionsVisited: 0, regionsMastered: 0, regionsPlayed: 0,
      trips: st.trips || 0, trips3: st.trips3 || 0, maxCombo: st.maxCombo || 0, dailyPerfect: st.dailyPerfect || 0,
      streakBest: st.streakBest || 0, langs: Object.keys(st.langs || {}).length, timedBest: 0 };
    for (const g of REGIONS) {
      const R = reg(g.key);
      if (!R) continue;
      const lv = id => Store.level(g.key, id);
      let ok = 0;
      for (const id of R.ids) { ok += Store.unit(g.key, id)?.ok || 0; if (lv(id) >= 1) c.visited++; if (lv(id) === 3) c.stamps++; }
      c.correct += ok;
      if (ok) c.regionsPlayed++;
      if (R.ids.every(id => lv(id) >= 1)) c.regionsVisited++;
      if (R.ids.every(id => lv(id) === 3)) c.regionsMastered++;
      for (const ak of Object.keys(R.areas)) {
        const ids = R.ids.filter(id => R.units[id].area === ak);
        if (ids.length && ids.every(id => lv(id) === 3)) c.areasMastered++;
      }
      c.timedBest = Math.max(c.timedBest, Store.best(g.key, 'timed'));
    }
    return c;
  }

  // 檢查有沒有新解鎖的成就：記下來、該部位空著就自動戴上，回傳新解鎖的清單
  function check() {
    const c = context(), got = Store.achievements(), fresh = [];
    for (const a of ACH) {
      if (got[a.id] || a.value(c) < a.target) continue;
      Store.unlock(a.id);
      const slot = KOMUGI_ITEMS[a.item].slot;
      if (!Store.outfit()[slot]) Store.wear(slot, a.item);
      fresh.push(a);
    }
    return fresh;
  }
  const progress = a => Math.min(a.value(context()), a.target);
  return { ACH, check, context, progress };
})();
