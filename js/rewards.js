// 獎勵：肉球幣、扭蛋、成就、套裝稱號、旅程稱號。配件圖案在 js/komugi.js。
// 2026-10-22 Ken 要求獎勵平均分配到整個進程、只靠代幣與扭蛋機率控制，所以：
// - 扭蛋：全部配件都在池子裡。每扭固定 40% 出新配件、60% 出已經有的（退 10 幣）——
//   純隨機會「越齊越難抽到新的」，模擬下來前 50 關拿 30 件、第 351～400 關只剩 5 件；固定出新率則每 50 關穩定約 17 件、約 400 關集滿
//   新配件照稀有度挑，已經湊了幾件的套裝優先補（套裝稱號才不會全擠在後期）
// - 成就：只送肉球幣（1.14.0 以前會送指定配件，已經拿到的照樣留著）
// - 旅程稱號：所有分頁合計每過 20 關一個；套裝稱號：集滿一套
const Rewards = (() => {
  const PULL_COST = 30, DUP_REFUND = 10, NEW_RATE = 0.4, SET_BOOST = 3;
  const RATE = { N: 55, R: 30, SR: 12, SSR: 3 };
  // 賺幣規則（main.js 在對應的時機呼叫 earn）；關卡每多拿一顆星 +4，重打沒進步就沒有
  const EARN = { ok: 2, combo: 1, visit: 3, familiar: 5, stamp: 15, daily: 30, dailyPerfect: 30, dailyStreak: 5, dailyStreakMax: 50, dailyAgain: 5, dailyAgainPerfect: 5, levelStar: 4, guess: 2, ach: 30 };   // guess：猜猜我是誰每少看一條提示 +2   // 每天第一次要明顯比再挑戰好（Ken 2026-10-21）

  // stamps(region)：那個地區蓋了幾個章；全制霸用該地區的總數
  // 鄰接旅行（trip1、trip3x5）與限時連擊（timed20）的成就隨玩法一起拿掉了；舊存檔記的達成日期留著不影響
  const ACH = [
    { id: 'firstOk', target: 1, value: c => c.correct },
    { id: 'visit30', target: 30, value: c => c.visited },
    { id: 'stamp1', target: 1, value: c => c.stamps },
    { id: 'lv1', target: 1, value: c => c.levels },
    { id: 'combo10', target: 10, value: c => c.maxCombo },
    { id: 'lv3star10', target: 10, value: c => c.levels3 },
    { id: 'polyglot', target: 3, value: c => c.langs },
    { id: 'dailyPerfect', target: 1, value: c => c.dailyPerfect },
    { id: 'stamp10', target: 10, value: c => c.stamps },
    { id: 'lv50', target: 50, value: c => c.levels },
    { id: 'areaAll', target: 1, value: c => c.areasMastered },
    { id: 'regionVisitAll', target: 1, value: c => c.regionsVisited },
    { id: 'fourRegions', target: 4, value: c => c.regionsPlayed },
    { id: 'daily7', target: 7, value: c => c.streakBest },
    { id: 'stamp50', target: 50, value: c => c.stamps },
    { id: 'regionMaster', target: 1, value: c => c.regionsMastered },
    // 地區：臺灣
    { id: 'tw5', region: 'taiwan', target: 5, value: c => c.rs.taiwan },
    { id: 'tw12', region: 'taiwan', target: 12, value: c => c.rs.taiwan },
    { id: 'tw18', region: 'taiwan', target: 18, value: c => c.rs.taiwan },
    { id: 'twAll', region: 'taiwan', target: 22, value: c => c.rs.taiwan },
    // 日本
    { id: 'jp5', region: 'japan', target: 5, value: c => c.rs.japan },
    { id: 'jp20', region: 'japan', target: 20, value: c => c.rs.japan },
    { id: 'jp35', region: 'japan', target: 35, value: c => c.rs.japan },
    { id: 'jpAll', region: 'japan', target: 47, value: c => c.rs.japan },
    // 中國
    { id: 'cn5', region: 'china', target: 5, value: c => c.rs.china },
    { id: 'cn15', region: 'china', target: 15, value: c => c.rs.china },
    { id: 'cn25', region: 'china', target: 25, value: c => c.rs.china },
    { id: 'cnAll', region: 'china', target: 33, value: c => c.rs.china },
    // 世界
    { id: 'w10', region: 'world', target: 10, value: c => c.rs.world },
    { id: 'w50', region: 'world', target: 50, value: c => c.rs.world },
    { id: 'w100', region: 'world', target: 100, value: c => c.rs.world },
    { id: 'w150', region: 'world', target: 150, value: c => c.rs.world },
  ];
  const POOL = Object.keys(KOMUGI_ITEMS);
  const RAR_N = {};
  for (const k of POOL) RAR_N[KOMUGI_ITEMS[k].rar] = (RAR_N[KOMUGI_ITEMS[k].rar] || 0) + 1;
  // 旅程稱號：所有分頁合計過了幾關
  const JOURNEY_EVERY = 20;
  const JOURNEY = Array.from({ length: 20 }, (_, i) => ({ id: 'j' + (i + 1) * JOURNEY_EVERY, levels: (i + 1) * JOURNEY_EVERY }));

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
    const lvs = Object.values(Store.progress()).flatMap(r => Object.values(r.lv || {}));
    const c = { correct: 0, visited: 0, stamps: 0, areasMastered: 0, regionsVisited: 0, regionsMastered: 0, regionsPlayed: 0, rs: {},
      maxCombo: st.maxCombo || 0, dailyPerfect: st.dailyPerfect || 0,
      streakBest: st.streakBest || 0, langs: Object.keys(st.langs || {}).length,
      levels: lvs.filter(v => v > 0).length, levels3: lvs.filter(v => v >= 3).length };
    for (const g of REWARD_REGIONS.map(key => ({ key }))) {
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
  // 檢查新解鎖的成就：送幣，回傳新解鎖的清單
  function check() {
    const c = context(), got = Store.achievements(), fresh = [];
    for (const a of ACH) {
      if (got[a.id] || a.value(c) < a.target) continue;
      Store.unlock(a.id);
      Store.earn(EARN.ach);
      fresh.push(a);
    }
    return fresh;
  }

  // 依權重挑一個
  function weighted(list, w) {
    let x = Math.random() * list.reduce((s, k) => s + w(k), 0);
    for (const k of list) { x -= w(k); if (x <= 0) return k; }
    return list[list.length - 1];
  }
  // 套裝進度
  const setProgress = s => s.items.filter(i => Store.owns(i)).length;
  const setDone = s => setProgress(s) === s.items.length;
  // 這件配件所屬的套裝已經湊了幾件、還沒湊齊 → 優先給
  const helpsSet = k => SETS.some(s => s.items.includes(k) && setProgress(s) > 0 && !setDone(s));

  // 扭蛋：回傳 { item, dup, rar } 或 null（幣不夠）
  // 先決定這一扭出不出新的（40%；一件都沒有就一定出新的、全部都有就一定重複），再挑是哪一件
  function pull() {
    if (Store.coins() < PULL_COST) return null;
    Store.spend(PULL_COST);
    const un = POOL.filter(k => !Store.owns(k)), have = POOL.filter(k => Store.owns(k));
    const fresh = un.length > 0 && (!have.length || Math.random() < NEW_RATE);
    const rarW = k => RATE[KOMUGI_ITEMS[k].rar] / RAR_N[KOMUGI_ITEMS[k].rar];
    const item = fresh ? weighted(un, k => rarW(k) * (helpsSet(k) ? SET_BOOST : 1)) : weighted(have, rarW);
    if (fresh) grant(item); else Store.earn(DUP_REFUND);
    Store.pulled(false);
    return { item, dup: !fresh, rar: KOMUGI_ITEMS[item].rar };
  }
  const allOwned = () => POOL.every(k => Store.owns(k));

  // 旅程稱號：拿到了幾個、下一個還差幾關
  const journeyDone = j => Store.lvTotal() >= j.levels;
  function nextJourney() {
    const n = Store.lvTotal(), j = JOURNEY.find(x => n < x.levels);
    return j ? { j, left: j.levels - n } : null;
  }
  // 稱號能不能用：套裝集滿或旅程過關數夠
  function titleOk(id) {
    const s = SETS.find(x => x.id === id);
    if (s) return setDone(s);
    const j = JOURNEY.find(x => x.id === id);
    return !!j && journeyDone(j);
  }

  return { ACH, POOL, SETS, JOURNEY, RATE, EARN, PULL_COST, DUP_REFUND, NEW_RATE, context, check, pull, allOwned, setProgress, setDone, journeyDone, nextJourney, titleOk };
})();
