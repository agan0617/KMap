// 從 Natural Earth 產生遊戲用的地圖資料：SVG 路徑＋相鄰關係。
// 用法：node tools/build-map.mjs <japan|china|world>
// 原始檔第一次會下載到 tools/.cache/，之後重用。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mapshaper from 'mapshaper';
import * as topojson from 'topojson-client';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CACHE = path.join(ROOT, 'tools', '.cache');
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const SOURCES = {
  admin1: ['admin1.geojson', NE + 'ne_10m_admin_1_states_provinces.geojson'],   // 1:10m 省縣級，約 40MB
  admin0: ['admin0-50m.geojson', NE + 'ne_50m_admin_0_countries.geojson'],      // 1:50m 國家，約 3MB
  // 台灣：Natural Earth 漏了連江縣（馬祖），改用 taiwan-atlas（內政部縣市界的 TopoJSON，政府資料開放授權）
  twatlas: ['tw-counties-10t.json', 'https://cdn.jsdelivr.net/npm/taiwan-atlas@2021.9.20/counties-10t.json', 'counties'],
};
const TW_ID = { A: 'TPE', F: 'NWT', B: 'TXG', D: 'TNN', H: 'TAO', E: 'KHH', C: 'KEE', O: 'HSZ', I: 'CYI', J: 'HSQ', K: 'MIA',
  N: 'CHA', M: 'NAN', P: 'YUN', Q: 'CYQ', T: 'PIF', G: 'ILA', U: 'HUA', V: 'TTT', X: 'PEN', W: 'KIN', Z: 'LIE' };

// 世界區：哪些算「國家」、哪些併進別國、哪些只畫成底圖
const WORLD_MERGE = { SOL: 'SOM', CYN: 'CYP', HKG: 'CHN', MAC: 'CHN', ALD: 'FIN', GGY: 'GBR', JEY: 'GBR', IMN: 'GBR' };
const WORLD_DROP = ['ABW', 'CUW', 'SXM'];   // 荷蘭的加勒比海構成國：不是國家，太小也不畫成底圖
const WORLD_BG = ['GRL'];   // 格陵蘭是丹麥的自治領，不算國家，畫成底圖（併進丹麥的話點格陵蘭會變成答丹麥）
const WORLD_EXTRA = ['KAZ', 'CUB', 'ISR', 'KOS', 'PSX'];   // 資料裡類型不是「國家」但要算的
// mapshaper 的運算式包在雙引號裡，陣列與物件要用單引號寫
const js = v => JSON.stringify(v).replace(/"/g, "'");
const WORLD_ID = `(${js(WORLD_MERGE)})[ADM0_A3] || ADM0_A3`;
const WORLD_UNIT = `(['Sovereign country','Country'].includes(TYPE) || ${js(WORLD_EXTRA)}.includes(ADM0_A3)) && !${js([...WORLD_DROP, ...WORLD_BG])}.includes(ADM0_A3)`;

// 每個地區的設定：篩哪些區塊、id 怎麼算、怎麼投影、哪些區塊要搬進插圖框
const REGIONS = {
  japan: {
    src: 'admin1',
    filter: "adm0_a3 === 'JPN'",
    id: 'iso_3166_2',
    simplify: '6%',
    minIsland: '80km2',      // 小笠原、八丈島這類離島太小，留著只會把地圖撐大
    proj: { type: 'eqc', lat0: 36 },
    width: 1000,
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
  taiwan: {
    src: 'twatlas',
    filter: 'true',
    id: `'TW-' + ${js(TW_ID)}[COUNTYID]`,
    simplify: '35%',
    minIsland: '3km2',       // 留下綠島、蘭嶼、小琉球與馬祖的主要島
    proj: { type: 'eqc', lat0: 23.7 },
    width: 1000,
    // 金門、馬祖照一般台灣地圖的做法放進左上的插圖框（不然地圖要往西撐兩度經度的空海）
    insets: { 'TW-LIE': { dLon: -0.55, dLat: -1.0, scale: 1.6 }, 'TW-KIN': { dLon: 1.3, dLat: 0.05, scale: 1.4 } },
    links: [
      ['TW-PEN', 'TW-KHH', '臺華輪'],
      ['TW-PEN', 'TW-CYQ', '布袋—馬公航線'],
      ['TW-LIE', 'TW-KEE', '臺馬輪'],
    ],
  },
  china: {
    src: 'admin1',
    // 31 個省級行政區＋港澳；港澳在資料裡分成各區，合併成一塊。西沙群島那一筆不放
    filter: "['CHN','HKG','MAC'].includes(adm0_a3) && iso_3166_2 !== 'CN-X01~'",
    id: "adm0_a3 === 'HKG' ? 'CN-HK' : adm0_a3 === 'MAC' ? 'CN-MO' : iso_3166_2",
    simplify: '3%',
    minIsland: '300km2',
    keepTiny: ['CN-MO'],     // 澳門比去小島的門檻還小，另外補回來（不參與相鄰計算，靠 links 連廣東）
    proj: { type: 'eqc', lat0: 34 },
    width: 1000,
    links: [
      ['CN-GD', 'CN-HI', '瓊州海峽渡輪'],
      ['CN-LN', 'CN-SD', '渤海渡輪'],
      ['CN-MO', 'CN-GD', '拱北口岸'],
      ['CN-HK', 'CN-GD', '羅湖口岸'],
      ['CN-HK', 'CN-MO', '港珠澳大橋'],
    ],
  },
  world: {
    src: 'admin0',
    filter: WORLD_UNIT,
    id: WORLD_ID,
    // 底圖：屬地、西撒哈拉等不能點的地方，畫成灰色讓地圖完整（南極洲不畫）
    background: `!(${WORLD_UNIT}) && ADM0_A3 !== 'ATA' && !${js(WORLD_DROP)}.includes(ADM0_A3)`,
    simplify: '12%',
    minIsland: '0km2',
    proj: { type: 'equalEarth', lon0: 11 },
    width: 2000,
    iso2: true,
    // 各洲的取景範圍（經緯度）：俄羅斯、法國海外領土這類會把外框撐很大，所以手寫
    views: {
      asia: [25, -11, 150, 56], europe: [-25, 34, 45, 71], africa: [-19, -36, 52, 38],
      namerica: [-170, 6, -52, 72], samerica: [-83, -56, -33, 13], oceania: [112, -48, 180, 2],
    },
    links: [
      ['GBR', 'FRA', '英法海底隧道'],
      ['DNK', 'SWE', '厄勒海峽大橋'],
      ['ESP', 'MAR', '直布羅陀海峽渡輪'],
      ['RUS', 'USA', '白令海峽'],
      ['MYS', 'IDN', '麻六甲海峽渡輪'],
      ['SGP', 'MYS', '新柔長堤'],
      ['KOR', 'JPN', '釜山－下關渡輪'],
      ['AUS', 'PNG', '托雷斯海峽'],
      ['TWN', 'CHN', '臺灣海峽'],
      ['LKA', 'IND', '保克海峽'],
      ['BHR', 'SAU', '法赫德國王大橋'],
      ['ITA', 'MLT', '馬爾他渡輪'],
      ['GBR', 'IRL', '愛爾蘭海渡輪'],
      ['FIN', 'EST', '赫爾辛基－塔林渡輪'],
      ['PHL', 'MYS', '蘇祿海'],
      ['NZL', 'AUS', '塔斯曼海'],
      ['ISL', 'GBR', '北大西洋航線'],
      ['CUB', 'USA', '佛羅里達海峽'],
      ['JAM', 'CUB', '牙買加海峽'],
    ],
  },
};

async function source(key) {
  const [name, url, topoObj] = SOURCES[key];
  const file = path.join(CACHE, name);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(CACHE, { recursive: true });
    console.log('下載 ' + url);
    const r = await fetch(url);
    if (!r.ok) throw new Error('下載失敗 ' + r.status);
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  if (!topoObj) return file;
  // TopoJSON 來源先轉成 GeoJSON，後面的流程才一樣
  const geo = file.replace(/\.json$/, '.geojson');
  if (!fs.existsSync(geo)) {
    const t = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(geo, JSON.stringify(topojson.feature(t, t.objects[topoObj])));
  }
  return geo;
}

// ── 投影 ──
function projector(p) {
  const rad = Math.PI / 180;
  if (p.type === 'eqc') {
    const k = Math.cos(p.lat0 * rad);
    return (lon, lat) => [lon * k, -lat];
  }
  // Equal Earth（Šavrič 等人 2018）：等面積，形狀接近 Robinson
  const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
  return (lon, lat) => {
    let l = lon - p.lon0;
    const th = Math.asin(M * Math.sin(lat * rad)), t2 = th * th, t6 = t2 * t2 * t2;
    const x = (l * rad) * Math.cos(th) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
    const y = th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
    return [x * 100, -y * 100];
  };
}
// 換日線附近：整個環的平均經度落在切線以西就整環搬到東邊，避免橫跨整張圖的長線
function wrapRing(ring, p) {
  if (p.type !== 'equalEarth') return ring;
  const cut = p.lon0 - 180;
  const mean = ring.reduce((s, q) => s + q[0], 0) / ring.length;
  return mean < cut ? ring.map(([x, y]) => [x + 360, y]) : ring.map(([x, y]) => [x < cut - 5 ? x + 360 : x, y]);
}

async function run(cmd) {
  const out = await mapshaper.applyCommands(cmd);
  return JSON.parse(out['out.json']);
}

async function build(name) {
  const cfg = REGIONS[name];
  if (!cfg) throw new Error('沒有這個地區：' + name);
  const src = await source(cfg.src);
  const cmd = `-i "${src}" -filter "${cfg.filter}" -each "id = ${cfg.id}" -dissolve id `
    + `-filter-islands min-area=${cfg.minIsland} remove-empty `
    + `-simplify ${cfg.simplify} keep-shapes -o out.json format=topojson quantization=100000`;
  const topo = await run(cmd);
  const obj = Object.values(topo.objects)[0];
  const ids = obj.geometries.map(g => g.properties.id);
  const nb = topojson.neighbors(obj.geometries);
  const geo = topojson.feature(topo, obj);
  const missing = (cfg.keepTiny || []).filter(id => !ids.includes(id));
  if (missing.length) {
    const t3 = await run(`-i "${src}" -filter "${cfg.filter}" -each "id = ${cfg.id}" -filter "${js(missing)}.includes(id)" -dissolve id -simplify ${cfg.simplify} keep-shapes -o out.json format=topojson quantization=100000`);
    for (const f of topojson.feature(t3, Object.values(t3.objects)[0]).features) { geo.features.push(f); ids.push(f.properties.id); nb.push([]); }
  }
  let bgGeo = null;
  if (cfg.background) {
    const t2 = await run(`-i "${src}" -filter "${cfg.background}" -filter-fields ADM0_A3 -simplify ${cfg.simplify} keep-shapes -o out.json format=topojson quantization=100000`);
    bgGeo = topojson.feature(t2, Object.values(t2.objects)[0]);
  }

  const proj = projector(cfg.proj);
  // 插圖框裡的區塊可以放大（scale），以它自己的中心為準
  const centers = {};
  for (const f of geo.features) {
    const id = f.properties.id;
    if (!cfg.insets?.[id]) continue;
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const p of polysOf(f)) for (const r of p) for (const [x, y] of r) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
    centers[id] = [(a + c) / 2, (b + d) / 2];
  }
  const project = (ring, id) => wrapRing(ring, cfg.proj).map(([lon, lat]) => {
    const s = cfg.insets?.[id];
    if (s) {
      const [cx, cy] = centers[id], z = s.scale || 1;
      lon = cx + (lon - cx) * z + s.dLon; lat = cy + (lat - cy) * z + s.dLat;
    }
    return proj(lon, lat);
  });
  // 國旗用的 ISO 二碼：直接從原始檔查（合併後的區塊用主國的）
  const iso2 = {};
  if (cfg.iso2) for (const f of JSON.parse(fs.readFileSync(src, 'utf8')).features) iso2[f.properties.ADM0_A3] = f.properties.ISO_A2_EH;
  const rings = geo.features.map(f => ({ id: f.properties.id, iso2: iso2[f.properties.id], polys: polysOf(f).map(p => p.map(r => project(r, f.properties.id))) }));
  const bgRings = (bgGeo?.features || []).map(f => polysOf(f).map(p => p.map(r => project(r))));

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of rings) for (const p of f.polys) for (const r of p) for (const [x, y] of r) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  const pad = 16;
  const scale = (cfg.width - pad * 2) / (x1 - x0);
  const height = Math.round((y1 - y0) * scale + pad * 2);
  const P = ([x, y]) => [+((x - x0) * scale + pad).toFixed(1), +((y - y0) * scale + pad).toFixed(1)];
  const toD = polys => {
    let d = '';
    for (const p of polys) for (const r of p) {
      const pts = r.map(P);
      // 簡化後太小的環（< 1 單位）不畫，省檔案大小
      let w = 0; for (const q of pts) w = Math.max(w, Math.abs(q[0] - pts[0][0]) + Math.abs(q[1] - pts[0][1]));
      if (w < 1 && pts.length < 6 && polys.length > 1) continue;
      d += 'M' + pts.map(q => q.join(' ')).join('L') + 'Z';
    }
    return d;
  };

  const shapes = {};
  for (const f of rings) {
    let area = 0, cx = 0, cy = 0;
    for (const p of f.polys) {
      const pts = p[0].map(P);
      // 以最大的外環算標籤位置（多邊形重心）
      let a = 0, sx = 0, sy = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1], c = ax * by - bx * ay;
        a += c; sx += (ax + bx) * c; sy += (ay + by) * c;
      }
      if (Math.abs(a) > Math.abs(area)) { area = a; cx = sx / (3 * a); cy = sy / (3 * a); }
    }
    shapes[f.id] = { d: toD(f.polys), cx: Math.round(cx), cy: Math.round(cy), area: Math.round(Math.abs(area) / 2) };
    if (f.iso2 && f.iso2 !== '-99') shapes[f.id].iso2 = f.iso2;
  }
  const adj = {};
  ids.forEach((id, i) => { adj[id] = nb[i].map(j => ids[j]); });
  for (const [a, b] of cfg.adjFix?.remove || []) { adj[a] = adj[a].filter(x => x !== b); adj[b] = adj[b].filter(x => x !== a); }
  for (const [a, b] of cfg.adjFix?.add || []) { adj[a].push(b); adj[b].push(a); }
  for (const id of ids) adj[id] = [...new Set(adj[id])].sort();
  const links = (cfg.links || []).filter(([a, b]) => shapes[a] && shapes[b]).map(([a, b, n]) => ({ a, b, name: n }));

  // 插圖框：框住搬過去的區塊
  const frames = Object.keys(cfg.insets || {}).map(id => {
    let a = Infinity, b = Infinity, c = -Infinity, e = -Infinity;
    for (const f of rings.filter(r => r.id === id)) for (const p of f.polys) for (const r of p) for (const q of r) {
      const [x, y] = P(q); a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); e = Math.max(e, y);
    }
    return { id, x: Math.round(a - 10), y: Math.round(b - 10), w: Math.round(c - a + 20), h: Math.round(e - b + 20) };
  });
  const bg = bgRings.length ? bgRings.map(toD).join('') : undefined;
  // 取景範圍：沿經緯框的邊取點投影後的外框，[x, y, w, h]
  const views = cfg.views ? Object.fromEntries(Object.entries(cfg.views).map(([k, [lo0, la0, lo1, la1]]) => {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const lo = lo0 + (lo1 - lo0) * i / 10, la = la0 + (la1 - la0) * i / 10;
      pts.push(P(proj(lo, la0)), P(proj(lo, la1)), P(proj(lo0, la)), P(proj(lo1, la)));
    }
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return [k, [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)].map(Math.round)];
  })) : undefined;

  const data = { region: name, width: cfg.width, height, shapes, adj, links, frames, bg, views };
  const file = path.join(ROOT, 'data', `${name}-map.js`);
  fs.writeFileSync(file, `// 由 tools/build-map.mjs 產生，不要手改。來源：Natural Earth（公有領域）\n`
    + `window.KMAP_MAPS = window.KMAP_MAPS || {};\nwindow.KMAP_MAPS.${name} = ${JSON.stringify(data)};\n`);
  console.log(`${name}: ${ids.length} 區、${(fs.statSync(file).size / 1024).toFixed(0)}KB、${cfg.width}x${height}`);
  const lonely = ids.filter(id => !adj[id].length && !links.some(l => l.a === id || l.b === id));
  if (lonely.length) console.log('沒有鄰居：' + lonely.sort().join(' '));
  if (process.argv.includes('-v')) for (const id of ids.sort()) console.log(id, adj[id].join(','));
}
const polysOf = f => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates);

await build(process.argv[2] || 'japan');
