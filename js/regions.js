// 地區清單：地圖資料（data/*-map.js）＋知識卡（data/*-info.js，中文為底；
// data/*-info.<en|ja>.js 是翻譯）湊成一個地區。還沒做的地區 ready: false，首頁顯示「製作中」。
const REGIONS = [
  { key: 'japan', ready: true },
  { key: 'china', ready: false },
  { key: 'world', ready: false },
];

// 日文新字體 → 台灣慣用的繁體字（中文介面顯示地名用）
const TRAD = { 静: '靜', 広: '廣', 徳: '德', 縄: '繩', 児: '兒', 戸: '戶', 浜: '濱', 沢: '澤', 関: '關', 黒: '黑', 県: '縣', 横: '橫', 区: '區', 奥: '奧' };
const toTrad = s => [...s].map(c => TRAD[c] || c).join('');

function regionData(key) {
  const map = window.KMAP_MAPS?.[key], info = window.KMAP_INFO?.[key];
  if (!map || !info) return null;
  const ids = Object.keys(info.units).filter(id => map.shapes[id]).sort();
  const tr = id => window.KMAP_I18N?.[`${key}.${lang()}`]?.units?.[id] || {};
  const jaShort = id => { const n = info.units[id].ja; return n === '北海道' ? n : n.replace(/[県府都]$/, ''); };

  // 依目前語言的顯示名：name 全名、short 地圖標籤、sub 名字下面的小字、stamp 御朱印上的字
  const name = id => {
    const u = info.units[id], l = lang();
    return l === 'en' ? (tr(id).name || u.ja) : l === 'zh' ? toTrad(u.ja) : u.ja;
  };
  const short = id => { const l = lang(); return l === 'en' ? (tr(id).name || jaShort(id)) : l === 'zh' ? toTrad(jaShort(id)) : jaShort(id); };
  const sub = id => lang() === 'en' ? info.units[id].ja : info.units[id].kana;
  const stamp = id => lang() === 'zh' ? toTrad(jaShort(id)) : jaShort(id);
  const areaName = ak => window.KMAP_I18N?.[`${key}.${lang()}`]?.areas?.[ak] || info.areas[ak].name;

  // 知識卡內容：翻譯缺哪一欄就用中文底稿
  function card(id) {
    const u = info.units[id], x = tr(id), l = lang();
    const pick = (f, base) => (l !== 'zh' && x[f] != null ? x[f] : base);
    const capName = l === 'en' ? (x.cap || u.cap[0]) : l === 'zh' ? toTrad(u.cap[0]) : (x.cap || u.cap[0]);
    return {
      capLabel: t('capital')[u.ja.slice(-1)] || t('capital')['県'],
      cap: capName, capSub: l === 'en' ? u.cap[0] : u.cap[1],
      old: u.old.map((o, i) => ({ n: l === 'en' ? (x.old?.[i] || o[0]) : l === 'ja' ? (x.old?.[i] || o[0]) : o[0], sub: l === 'en' ? o[0] : o[1], q: o[2] })),
      foods: pick('foods', u.foods), sights: pick('sights', u.sights), fact: pick('fact', u.fact),
      dia: { w: u.dia[0], m: pick('dia', u.dia[1]), q: u.dia[2] !== 0 },
      wiki: l === 'en' ? `https://en.wikipedia.org/wiki/${encodeURIComponent((x.wiki || x.name || u.ja).replace(/ /g, '_'))}` : `https://ja.wikipedia.org/wiki/${encodeURIComponent(u.ja)}`,
      wikiTitle: l === 'en' ? (x.wiki || x.name || u.ja) : u.ja,
    };
  }
  // 出題時要遮掉的字：各語言的名稱與縣廳所在地名都遮，免得提示洩題
  function maskWords(id) {
    const u = info.units[id], x = window.KMAP_I18N?.[`${key}.en`]?.units?.[id] || {};
    const capStem = s => s.replace(/[市區区]$/, '');
    const w = [jaShort(id), toTrad(jaShort(id)), capStem(u.cap[0]), toTrad(capStem(u.cap[0])), x.name, x.cap];
    return [...new Set(w.filter(s => s && s.length > 1))].sort((a, b) => b.length - a.length);
  }

  // 隔海連結也算相鄰，鄰接旅行用
  const graph = {};
  for (const id of ids) graph[id] = new Set(map.adj[id] || []);
  for (const l of map.links || []) { graph[l.a]?.add(l.b); graph[l.b]?.add(l.a); }
  return { key, map, info, ids, units: info.units, areas: info.areas, name, short, sub, stamp, areaName, card, maskWords, graph };
}
