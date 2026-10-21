// 從 Natural Earth 1:10m 行政區界產生遊戲用的地圖資料：SVG 路徑＋相鄰關係。
// 用法：node tools/build-map.mjs japan
// 原始檔（約 40MB）第一次會下載到 tools/.cache/，之後重用。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mapshaper from 'mapshaper';
import * as topojson from 'topojson-client';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CACHE = path.join(ROOT, 'tools', '.cache');
const SRC_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson';

// 每個地區的設定：篩哪些區塊、怎麼投影、哪些區塊要搬進插圖框
const REGIONS = {
  japan: {
    filter: "adm0_a3 === 'JPN'",
    simplify: '6%',
    minIsland: '80km2',      // 小笠原、八丈島這類離島太小，留著只會把地圖撐大
    lat0: 36,                 // 投影的標準緯線
    width: 1000,
    pad: 16,
    // 沖繩照一般日本地圖的做法放進左上的插圖框
    insets: { 'JP-47': { dLon: 6.4, dLat: 13.6, scale: 1.25 } },
    // 1:10m 資料在渡良瀨遊水地一帶不夠精細：算出茨城－群馬相鄰、漏了栃木－埼玉
    adjFix: { remove: [['JP-08', 'JP-10']], add: [['JP-09', 'JP-11']] },
    // 隔海但有橋、隧道或航路相連，鄰接旅行可以走
    links: [
      ['JP-01', 'JP-02', '青函隧道'],
      ['JP-28', 'JP-36', '明石海峽大橋・大鳴門橋'],
      ['JP-33', 'JP-37', '瀨戶大橋'],
      ['JP-34', 'JP-38', '島波海道'],
      ['JP-35', 'JP-40', '關門海峽'],
      ['JP-46', 'JP-47', '渡輪航線'],
    ],
  },
};

async function ensureSource() {
  const file = path.join(CACHE, 'admin1.geojson');
  if (!fs.existsSync(file)) {
    fs.mkdirSync(CACHE, { recursive: true });
    console.log('下載 Natural Earth admin-1 …');
    const r = await fetch(SRC_URL);
    if (!r.ok) throw new Error('下載失敗 ' + r.status);
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  return file;
}

async function build(name) {
  const cfg = REGIONS[name];
  if (!cfg) throw new Error('沒有這個地區：' + name);
  const src = await ensureSource();
  const cmd = `-i "${src}" -filter "${cfg.filter}" -filter-fields iso_3166_2,name -filter-islands min-area=${cfg.minIsland} remove-empty `
    + `-simplify ${cfg.simplify} keep-shapes -o out.json format=topojson quantization=100000`;
  const out = await mapshaper.applyCommands(cmd);
  const topo = JSON.parse(out['out.json']);
  const obj = Object.values(topo.objects)[0];
  const ids = obj.geometries.map(g => g.properties.iso_3166_2);
  const nb = topojson.neighbors(obj.geometries);
  const geo = topojson.feature(topo, obj);

  // 等距圓柱投影，經度乘 cos(標準緯線) 讓形狀不會被拉寬
  const k = Math.cos(cfg.lat0 * Math.PI / 180);
  // 插圖框裡的區塊可以放大（scale），以它自己的中心為準
  const centers = {};
  for (const f of geo.features) {
    const id = f.properties.iso_3166_2;
    if (!cfg.insets?.[id]) continue;
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const p of polys) for (const r of p) for (const [x, y] of r) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
    centers[id] = [(a + c) / 2, (b + d) / 2];
  }
  const proj = (lon, lat, id) => {
    const s = cfg.insets?.[id];
    if (s) {
      const [cx, cy] = centers[id], z = s.scale || 1;
      lon = cx + (lon - cx) * z + s.dLon; lat = cy + (lat - cy) * z + s.dLat;
    }
    return [lon * k, -lat];
  };
  const rings = geo.features.map(f => {
    const id = f.properties.iso_3166_2;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    return { id, polys: polys.map(p => p.map(r => r.map(([x, y]) => proj(x, y, id)))) };
  });
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of rings) for (const p of f.polys) for (const r of p) for (const [x, y] of r) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  const scale = (cfg.width - cfg.pad * 2) / (x1 - x0);
  const height = Math.round((y1 - y0) * scale + cfg.pad * 2);
  const P = ([x, y]) => [+((x - x0) * scale + cfg.pad).toFixed(1), +((y - y0) * scale + cfg.pad).toFixed(1)];

  const shapes = {};
  for (const f of rings) {
    let d = '', area = 0, cx = 0, cy = 0;
    for (const p of f.polys) for (const [ri, r] of p.entries()) {
      const pts = r.map(P);
      d += 'M' + pts.map(q => q.join(' ')).join('L') + 'Z';
      if (ri) continue;
      // 以最大的外環算標籤位置（多邊形重心）
      let a = 0, sx = 0, sy = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1], c = ax * by - bx * ay;
        a += c; sx += (ax + bx) * c; sy += (ay + by) * c;
      }
      if (Math.abs(a) > Math.abs(area)) { area = a; cx = sx / (3 * a); cy = sy / (3 * a); }
    }
    shapes[f.id] = { d, cx: Math.round(cx), cy: Math.round(cy), area: Math.round(Math.abs(area) / 2) };
  }
  const adj = {};
  ids.forEach((id, i) => { adj[id] = nb[i].map(j => ids[j]); });
  for (const [a, b] of cfg.adjFix?.remove || []) { adj[a] = adj[a].filter(x => x !== b); adj[b] = adj[b].filter(x => x !== a); }
  for (const [a, b] of cfg.adjFix?.add || []) { adj[a].push(b); adj[b].push(a); }
  for (const id of ids) adj[id].sort();
  const links = (cfg.links || []).map(([a, b, name]) => ({ a, b, name }));

  // 插圖框：框住搬過去的區塊
  const frames = Object.keys(cfg.insets || {}).map(id => {
    let a = Infinity, b = Infinity, c = -Infinity, e = -Infinity;
    for (const f of rings.filter(r => r.id === id)) for (const p of f.polys) for (const r of p) for (const q of r) {
      const [x, y] = P(q); a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); e = Math.max(e, y);
    }
    return { id, x: Math.round(a - 10), y: Math.round(b - 10), w: Math.round(c - a + 20), h: Math.round(e - b + 20) };
  });

  const data = { region: name, width: cfg.width, height, shapes, adj, links, frames };
  const file = path.join(ROOT, 'data', `${name}-map.js`);
  fs.writeFileSync(file, `// 由 tools/build-map.mjs 產生，不要手改。來源：Natural Earth 1:10m admin-1（公有領域）\n`
    + `window.KMAP_MAPS = window.KMAP_MAPS || {};\nwindow.KMAP_MAPS.${name} = ${JSON.stringify(data)};\n`);
  console.log(`${name}: ${ids.length} 區、${width(file)}、${cfg.width}x${height}`);
  for (const id of ids.sort()) console.log(id, adj[id].join(','));
}
const width = f => (fs.statSync(f).size / 1024).toFixed(0) + 'KB';

await build(process.argv[2] || 'japan');
