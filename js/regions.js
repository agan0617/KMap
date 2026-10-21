// 地區清單：地圖資料（data/*-map.js）＋知識卡（data/*-info.js）湊成一個地區。
// 還沒做的地區 ready: false，首頁顯示「製作中」。
const REGIONS = [
  { key: 'japan', name: '日本', unit: '都道府縣', ready: true },
  { key: 'china', name: '中國', unit: '省', ready: false },
  { key: 'world', name: '世界', unit: '國家', ready: false },
];

function regionData(key) {
  const map = window.KMAP_MAPS?.[key], info = window.KMAP_INFO?.[key];
  if (!map || !info) return null;
  const ids = Object.keys(info.units).filter(id => map.shapes[id]).sort();
  // 圖鑑與題目共用的顯示名：去掉「県／府／都」的短名用在地圖標籤
  const short = id => {
    const n = info.units[id].ja;
    return n === '北海道' ? n : n.replace(/[県府都]$/, '');
  };
  // 隔海連結也算相鄰，鄰接旅行用
  const graph = {};
  for (const id of ids) graph[id] = new Set(map.adj[id] || []);
  for (const l of map.links || []) { graph[l.a]?.add(l.b); graph[l.b]?.add(l.a); }
  return { key, map, info, ids, units: info.units, areas: info.areas, short, graph };
}
