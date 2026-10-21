// 獎勵：肉球幣、扭蛋、成就、套裝稱號。配件圖案在 js/komugi.js。
// - 成就：達到條件就送一件指定配件＋肉球幣。地區成就（某地區蓋幾個章）送該地區的限定配件，逼你把地圖學熟
// - 扭蛋：30 幣一次，依稀有度抽「扭蛋池」裡的配件；每 10 抽保底一件 SR 以上；抽到重複的退 10 幣
// - 套裝：集滿一套給稱號，可以一鍵換上整套
const Rewards = (() => {
  const PULL_COST = 30, DUP_REFUND = 10, PITY = 10;
  const RATE = { N: 55, R: 30, SR: 12, SSR: 3 };
  // 賺幣規則（main.js 在對應的時機呼叫 earn）
  const EARN = { ok: 2, combo: 1, visit: 3, familiar: 5, stamp: 15, daily: 10, dailyPerfect: 20, star: 5, ach: 30 };

  // stamps(region)：那個地區蓋了幾個章；全制霸用該地區的總數
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
    // 地區限定：臺灣
    { id: 'tw5', region: 'taiwan', item: 'slippers', target: 5, value: c => c.rs.taiwan },
    { id: 'tw12', region: 'taiwan', item: 'bubbletea', target: 12, value: c => c.rs.taiwan },
    { id: 'twAll', region: 'taiwan', item: 'taipei101', target: 22, value: c => c.rs.taiwan },
    // 日本
    { id: 'jp5', region: 'japan', item: 'uchiwa', target: 5, value: c => c.rs.japan },
    { id: 'jp20', region: 'japan', item: 'yukata', target: 20, value: c => c.rs.japan },
    { id: 'jpAll', region: 'japan', item: 'fuji', target: 47, value: c => c.rs.japan },
    // 中國
    { id: 'cn5', region: 'china', item: 'tanghulu', target: 5, value: c => c.rs.china },
    { id: 'cn15', region: 'china', item: 'qipao', target: 15, value: c => c.rs.china },
    { id: 'cnAll', region: 'china', item: 'greatwall', target: 33, value: c => c.rs.china },
    // 世界
    { id: 'w10', region: 'world', item: 'sombrero', target: 10, value: c => c.rs.world },
    { id: 'w50', region: 'world', item: 'suit', target: 50, value: c => c.rs.world },
    { id: 'w100', region: 'world', item: 'eiffel', target: 100, value: c => c.rs.world },
    // 1.6.0：每個地區再加一階，送夥伴或頭盔
    { id: 'tw18', region: 'taiwan', item: 'formosanbear', target: 18, value: c => c.rs.taiwan },
    { id: 'jp35', region: 'japan', item: 'kabuto', target: 35, value: c => c.rs.japan },
    { id: 'cn25', region: 'china', item: 'panda', target: 25, value: c => c.rs.china },
    { id: 'w150', region: 'world', item: 'dragon', target: 150, value: c => c.rs.world },
  ];
  const ACH_ITEMS = new Set(ACH.map(a => a.item));
  // 扭蛋池：不是成就送的配件
  const POOL = Object.keys(KOMUGI_ITEMS).filter(k => !ACH_ITEMS.has(k));

  // 套裝：集滿就有稱號
  const SETS = [
    { id: 'taiwan', items: ['slippers', 'bubbletea', 'jersey', 'taipei101'] },
    { id: 'matsuri', items: ['yukata', 'uchiwa', 'geta', 'hachimaki'] },
    { id: 'china', items: ['qipao', 'tanghulu', 'lantern', 'greatwall'] },
    { id: 'explorer', items: ['cowboy', 'magnifier', 'map', 'boots'] },
    { id: 'foodie', items: ['chefhat', 'onigiri', 'icecream'] },
    { id: 'space', items: ['astronaut', 'goggles', 'night'] },
    { id: 'wizard', items: ['wizardhat', 'cape', 'monocle'] },
    { id: 'star', items: ['suit', 'bowtie', 'mic'] },
    { id: 'winter', items: ['santahat', 'sweater', 'scarf'] },
    { id: 'rainy', items: ['raincoat', 'rainboots', 'umbrella'] },
    { id: 'summer', items: ['lei', 'beach', 'balloon'] },
    { id: 'angel', items: ['angelwings', 'flowercrown', 'heartglasses'] },
    { id: 'king', items: ['crown', 'medal', 'trophy'] },
    // 1.6.0
    { id: 'pirate', items: ['piratehat', 'eyepatch', 'piratecoat', 'cutlass', 'parrot'] },
    { id: 'ninja', items: ['ninjahood', 'ninjasuit', 'shuriken'] },
    { id: 'school', items: ['sailoruniform', 'randoseru', 'bandaid', 'lollipop'] },
    { id: 'cat', items: ['catears', 'whiskers', 'cat'] },
    { id: 'nightmarket', items: ['nightmarket', 'pineapplecake', 'formosanbear'] },
    { id: 'samurai', items: ['kabuto', 'armor', 'torii'] },
    { id: 'panda', items: ['hanfu', 'panda', 'bamboo'] },
    { id: 'ocean', items: ['flippers', 'surfboard', 'penguin'] },
    { id: 'party', items: ['partyhat', 'cheekstars', 'rainbow'] },
    { id: 'future', items: ['jetpack', 'vr', 'space'] },
    { id: 'dragon', items: ['dragon', 'magicwand', 'batwings'] },
    { id: 'ice', items: ['snow', 'beanie', 'iceskates'] },
  ];

  const cache = {};
  const reg = k => cache[k] || (cache[k] = regionData(k));
  function context() {
    const st = Store.stats();
    const c = { correct: 0, visited: 0, stamps: 0, areasMastered: 0, regionsVisited: 0, regionsMastered: 0, regionsPlayed: 0, rs: {},
      trips: st.trips || 0, trips3: st.trips3 || 0, maxCombo: st.maxCombo || 0, dailyPerfect: st.dailyPerfect || 0,
      streakBest: st.streakBest || 0, langs: Object.keys(st.langs || {}).length, timedBest: 0 };
    for (const g of REGIONS) {
      const R = reg(g.key);
      if (!R) continue;
      const lv = id => Store.level(g.key, id);
      let ok = 0, rs = 0;
      for (const id of R.ids) { ok += Store.unit(g.key, id)?.ok || 0; if (lv(id) >= 1) c.visited++; if (lv(id) === 3) rs++; }
      c.stamps += rs; c.rs[g.key] = rs; c.correct += ok;
      if (ok) c.regionsPlayed++;
      if (R.ids.every(id => lv(id) >= 1)) c.regionsVisited++;
      if (rs === R.ids.length) c.regionsMastered++;
      for (const ak of Object.keys(R.areas)) {
        const ids = R.ids.filter(id => R.units[id].area === ak);
        if (ids.length && ids.every(id => lv(id) === 3)) c.areasMastered++;
      }
      c.timedBest = Math.max(c.timedBest, Store.best(g.key, 'timed'));
    }
    return c;
  }

  // 拿到一件配件：該部位空著就自動穿上
  function grant(item) {
    const fresh = !Store.owns(item);
    Store.own(item);
    const slot = KOMUGI_ITEMS[item].slot;
    if (fresh && !Store.outfit()[slot]) Store.wear(slot, item);
    return fresh;
  }
  // 檢查新解鎖的成就：送配件＋幣，回傳新解鎖的清單（舊存檔的成就也會在這裡補發配件）
  function check() {
    const c = context(), got = Store.achievements(), fresh = [];
    for (const a of ACH) {
      if (got[a.id]) { if (!Store.owns(a.item)) Store.own(a.item); continue; }
      if (a.value(c) < a.target) continue;
      Store.unlock(a.id);
      grant(a.item);
      Store.earn(EARN.ach);
      fresh.push(a);
    }
    return fresh;
  }

  // 扭蛋：回傳 { item, dup, rar } 或 null（幣不夠）
  function pull() {
    if (Store.coins() < PULL_COST) return null;
    Store.spend(PULL_COST);
    const n = Store.pullCount() + 1;
    const guarantee = Store.pity() + 1 >= PITY;
    const rars = guarantee ? ['SR', 'SSR'] : Object.keys(RATE);
    let x = Math.random() * rars.reduce((s, r) => s + RATE[r], 0), rar = rars[0];
    for (const r of rars) { x -= RATE[r]; if (x <= 0) { rar = r; break; } }
    const pool = POOL.filter(k => KOMUGI_ITEMS[k].rar === rar);
    const item = pool[Math.floor(Math.random() * pool.length)];
    const dup = Store.owns(item);
    if (dup) Store.earn(DUP_REFUND); else grant(item);
    Store.pulled(rar === 'SR' || rar === 'SSR');
    return { item, dup, rar, n };
  }

  // 套裝進度
  const setProgress = s => s.items.filter(i => Store.owns(i)).length;
  const setDone = s => setProgress(s) === s.items.length;

  // 首頁對話框用：最接近完成、還沒拿到的成就（優先目前所在地區的地區成就，因為那是學地圖的動力）
  function nextGoal(region) {
    const c = context(), got = Store.achievements();
    let best = null;
    for (const a of ACH) {
      if (got[a.id]) continue;
      const v = Math.min(a.value(c), a.target), ratio = v / a.target + (a.region === region ? 0.15 : a.region ? 0.05 : 0);
      if (!best || ratio > best.ratio) best = { a, left: a.target - v, ratio };
    }
    return best;
  }

  return { ACH, POOL, SETS, RATE, EARN, PULL_COST, DUP_REFUND, PITY, context, check, pull, setProgress, setDone, nextGoal };
})();
