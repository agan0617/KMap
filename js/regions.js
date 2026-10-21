// 地區：地圖資料（data/*-map.js）＋知識卡湊成一個地區，依目前語言給地名與卡片內容。
// 知識卡有兩種寫法：
// - 日本（schema 預設）：data/japan-info.js 是中文底稿，data/japan-info.<en|ja>.js 是逐項對應的翻譯
// - 中國、世界（schema: 'multi'）：data/<區>-info.js 放分區與欄位名稱，data/<區>-units-*.js 每一區直接寫中英日三份
// 順序就是首頁分頁的順序，第一個是預設地區（Ken 是臺灣人，臺灣放第一個）
const REGIONS = [
  { key: 'taiwan', ready: true },
  { key: 'japan', ready: true },
  { key: 'china', ready: true },
  { key: 'world', ready: true },
];

// 日文新字體 → 台灣慣用的繁體字（中文介面顯示日本地名用）
const TRAD = { 静: '靜', 広: '廣', 徳: '德', 縄: '繩', 児: '兒', 戸: '戶', 浜: '濱', 沢: '澤', 関: '關', 黒: '黑', 県: '縣', 横: '橫', 区: '區', 奥: '奧' };
const toTrad = s => [...s].map(c => TRAD[c] || c).join('');
const capStem = s => s.replace(/[市區区]$/, '');

function japanProfile(key, info) {
  const tr = id => window.KMAP_I18N?.[`${key}.${lang()}`]?.units?.[id] || {};
  const jaShort = id => { const n = info.units[id].ja; return n === '北海道' ? n : n.replace(/[県府都]$/, ''); };
  const name = id => {
    const u = info.units[id], l = lang();
    return l === 'en' ? (tr(id).name || u.ja) : l === 'zh' ? toTrad(u.ja) : u.ja;
  };
  const short = id => { const l = lang(); return l === 'en' ? (tr(id).name || jaShort(id)) : l === 'zh' ? toTrad(jaShort(id)) : jaShort(id); };
  const sub = id => lang() === 'en' ? info.units[id].ja : info.units[id].kana;
  const stamp = id => lang() === 'zh' ? toTrad(jaShort(id)) : jaShort(id);
  const areaName = ak => window.KMAP_I18N?.[`${key}.${lang()}`]?.areas?.[ak] || info.areas[ak].name;
  const label = k => (k === 'book' ? t('book.japan') : t(k));
  // 知識卡內容：翻譯缺哪一欄就用中文底稿
  function card(id) {
    const u = info.units[id], x = tr(id), l = lang();
    const pick = (f, base) => (l !== 'zh' && x[f] != null ? x[f] : base);
    const capName = l === 'en' ? (x.cap || u.cap[0]) : l === 'zh' ? toTrad(u.cap[0]) : (x.cap || u.cap[0]);
    return {
      capLabel: t('capital')[u.ja.slice(-1)] || t('capital')['県'],
      cap: capName, capSub: l === 'en' ? u.cap[0] : u.cap[1],
      capClue: capStem(u.cap[0]) !== jaShort(id),
      old: u.old.map((o, i) => ({ n: l !== 'zh' ? (x.old?.[i] || o[0]) : o[0], sub: l === 'en' ? o[0] : o[1], q: o[2] })),
      foods: pick('foods', u.foods), sights: pick('sights', u.sights), fact: pick('fact', u.fact),
      dia: { w: u.dia[0], m: pick('dia', u.dia[1]), q: u.dia[2] !== 0 },
      wiki: l === 'en' ? `https://en.wikipedia.org/wiki/${encodeURIComponent((x.wiki || x.name || u.ja).replace(/ /g, '_'))}` : `https://ja.wikipedia.org/wiki/${encodeURIComponent(u.ja)}`,
      wikiTitle: l === 'en' ? (x.wiki || x.name || u.ja) : u.ja,
    };
  }
  // 出題時要遮掉的字：各語言的名稱與縣廳所在地名
  function maskWords(id) {
    const u = info.units[id], x = window.KMAP_I18N?.[`${key}.en`]?.units?.[id] || {};
    return [jaShort(id), toTrad(jaShort(id)), capStem(u.cap[0]), toTrad(capStem(u.cap[0])), x.name, x.cap];
  }
  return { name, short, sub, stamp, areaName, label, card, maskWords };
}

function multiProfile(key, info, map) {
  const L = id => info.units[id][lang()] || info.units[id].zh;
  const WIKI = { zh: 'https://zh.wikipedia.org/zh-tw/', en: 'https://en.wikipedia.org/wiki/', ja: 'https://ja.wikipedia.org/wiki/' };
  const label = k => info.labels[lang()]?.[k] ?? t(k);
  function card(id) {
    const x = L(id), q = info.units[id].quiz || {}, l = lang();
    const has = (a, b) => a && b && a.toLowerCase().includes(b.toLowerCase());
    return {
      capLabel: label('cap'),
      cap: x.cap, capSub: x.capSub,
      // 首都名裡就有國名（新加坡、科威特市…）不拿來出題
      capClue: !!x.cap && !has(x.cap, x.short) && !has(info.units[id].en?.cap, info.units[id].en?.short),
      old: (x.old || []).map((o, i) => ({ n: o[0], sub: o[1], q: q.old?.[i] })),
      foods: x.foods || [], sights: x.sights || [], fact: x.fact || '',
      dia: x.dia ? { w: x.dia[0], m: x.dia[1], q: !!q.dia } : null,
      // 好幾個地方共有的名產名勝（查證時標的）：卡片照樣顯示，不拿來出題
      skip: new Set(q.skip || []),
      wiki: WIKI[l] + encodeURIComponent((x.wiki || x.name).replace(/ /g, '_')),
      wikiTitle: x.wiki || x.name,
      flag: info.flags ? flagOf(map.shapes[id]?.iso2) : '',
    };
  }
  function maskWords(id) {
    const u = info.units[id];
    const w = ['zh', 'en', 'ja'].flatMap(l => [u[l]?.name, u[l]?.short, u[l]?.cap && capStem(u[l].cap)]).filter(Boolean);
    return w.concat(w.map(s => s.replace(/臺/g, '台')), w.map(s => s.replace(/台/g, '臺')));
  }
  // 印章上的字：中國、台灣用短名；世界用 ISO 三碼（護照章）
  const stamp = id => (info.stamp === 'passport' ? id : (info.units[id].zh?.short || id));
  return {
    name: id => L(id).name, short: id => L(id).short || L(id).name, sub: id => L(id).sub || '',
    stamp, areaName: ak => info.areas[ak]?.[lang()] || info.areas[ak]?.zh || ak, label, card, maskWords,
  };
}

// 國旗 emoji：ISO 二碼轉成兩個區域指示符號（Windows 會顯示成字母，手機會是國旗）
function flagOf(iso2) {
  if (!iso2 || iso2.length !== 2) return '';
  return String.fromCodePoint(...[...iso2.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

function regionData(key) {
  const map = window.KMAP_MAPS?.[key], info = window.KMAP_INFO?.[key];
  if (!map || !info) return null;
  const ids = Object.keys(info.units).filter(id => map.shapes[id]).sort();
  const P = info.schema === 'multi' ? multiProfile(key, info, map) : japanProfile(key, info);
  const areas = {};
  for (const [k, a] of Object.entries(info.areas)) areas[k] = { color: a.color };
  const maskWords = id => [...new Set(P.maskWords(id).filter(s => s && s.length > 1))].sort((a, b) => b.length - a.length);

  // 隔海連結也算相鄰，鄰接旅行用
  const graph = {};
  for (const id of ids) graph[id] = new Set((map.adj[id] || []).filter(x => info.units[x]));
  for (const l of map.links || []) { graph[l.a]?.add(l.b); graph[l.b]?.add(l.a); }
  return { key, map, info, ids, units: info.units, areas, stampStyle: info.stamp || 'goshuin', ...P, maskWords, graph };
}
