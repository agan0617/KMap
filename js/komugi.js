// Komugi：戴耳機的柴犬，旅行模式的旅人兼吉祥物。畫在 100×100 的座標裡（頭頂到下巴約 y8～90）。
// 配件（成就解鎖）也畫在同一套座標：帽子會超出上緣、身邊的東西會超出左右，所以圖片的 viewBox 留了邊。
const KOMUGI_SVG = `
<g class="komugi-art">
  <path d="M22 38 L14 8 L42 24 Z" fill="#d9822b"/><path d="M24 33 L19 15 L36 25 Z" fill="#f6d2a2"/>
  <path d="M78 38 L86 8 L58 24 Z" fill="#d9822b"/><path d="M76 33 L81 15 L64 25 Z" fill="#f6d2a2"/>
  <ellipse cx="50" cy="55" rx="36" ry="32" fill="#e8913a"/>
  <path d="M20 62 Q30 92 50 90 Q70 92 80 62 Q66 70 50 66 Q34 70 20 62 Z" fill="#fff7ea"/>
  <ellipse cx="36" cy="44" rx="6" ry="3" fill="#fff7ea"/><ellipse cx="64" cy="44" rx="6" ry="3" fill="#fff7ea"/>
  <circle cx="37" cy="54" r="4.2" fill="#2b2118"/><circle cx="63" cy="54" r="4.2" fill="#2b2118"/>
  <circle cx="38.4" cy="52.6" r="1.3" fill="#fff"/><circle cx="64.4" cy="52.6" r="1.3" fill="#fff"/>
  <ellipse cx="50" cy="66" rx="5" ry="3.6" fill="#2b2118"/>
  <path d="M50 69 Q50 75 44 75 M50 69 Q50 75 56 75" stroke="#2b2118" stroke-width="2" fill="none" stroke-linecap="round"/>
  <ellipse cx="29" cy="66" rx="5" ry="3" fill="#f3a3a0" opacity=".7"/><ellipse cx="71" cy="66" rx="5" ry="3" fill="#f3a3a0" opacity=".7"/>
  <path d="M14 52 Q14 14 50 12 Q86 14 86 52" stroke="#3a3f58" stroke-width="6" fill="none" stroke-linecap="round"/>
  <rect x="5" y="44" width="15" height="24" rx="6" fill="#3a3f58"/><rect x="80" y="44" width="15" height="24" rx="6" fill="#3a3f58"/>
  <rect x="8" y="48" width="6" height="16" rx="3" fill="#e05d5d"/><rect x="86" y="48" width="6" height="16" rx="3" fill="#e05d5d"/>
</g>`;

// 配件：slot＝部位（同一部位只能戴一件）；back＝畫在頭後面
const KOMUGI_ITEMS = {
  strawhat: { slot: 'head', svg: `<ellipse cx="50" cy="14" rx="34" ry="7" fill="#e6c36a" stroke="#b8933d" stroke-width="1.5"/><path d="M33 14 Q33 -6 50 -6 Q67 -6 67 14 Z" fill="#f0d27e" stroke="#b8933d" stroke-width="1.5"/><rect x="33" y="6" width="34" height="5" fill="#d9534f"/>` },
  beret: { slot: 'head', svg: `<ellipse cx="44" cy="11" rx="28" ry="10" fill="#b23a48" transform="rotate(-10 44 11)"/><circle cx="47" cy="0" r="3" fill="#b23a48"/>` },
  headband: { slot: 'head', svg: `<path d="M18 32 Q50 14 82 32 L82 40 Q50 22 18 40 Z" fill="#e05d5d"/><path d="M18 36 Q50 18 82 36" stroke="#fff" stroke-width="1.6" fill="none"/>` },
  gradcap: { slot: 'head', svg: `<path d="M32 12 L32 22 Q50 30 68 22 L68 12 L50 19 Z" fill="#3a3a4d"/><path d="M50 -5 L88 8 L50 21 L12 8 Z" fill="#2b2b3a"/><path d="M50 8 L82 12 L82 26" stroke="#e3a92b" stroke-width="2" fill="none"/><circle cx="82" cy="28" r="3" fill="#e3a92b"/>` },
  conical: { slot: 'head', svg: `<path d="M50 -10 L94 20 Q50 30 6 20 Z" fill="#d8b56a" stroke="#a8823a" stroke-width="1.5"/><path d="M50 -10 L28 23 M50 -10 L72 23 M50 -10 L50 25" stroke="#a8823a" stroke-width="1"/>` },
  crown: { slot: 'head', svg: `<path d="M28 20 L30 0 L40 10 L50 -6 L60 10 L70 0 L72 20 Z" fill="#f2c23a" stroke="#c99a1e" stroke-width="1.5"/><circle cx="50" cy="8" r="3" fill="#d9534f"/><circle cx="37" cy="14" r="2" fill="#4a90d9"/><circle cx="63" cy="14" r="2" fill="#4a90d9"/>` },
  sunglasses: { slot: 'eyes', svg: `<rect x="26" y="46" width="21" height="14" rx="5" fill="#222"/><rect x="53" y="46" width="21" height="14" rx="5" fill="#222"/><path d="M47 51 L53 51" stroke="#222" stroke-width="2.5"/><path d="M30 49 l6 0 M57 49 l6 0" stroke="#777" stroke-width="1.6"/>` },
  roundglasses: { slot: 'eyes', svg: `<circle cx="37" cy="54" r="9" fill="rgba(255,255,255,.25)" stroke="#6b4fa0" stroke-width="2.5"/><circle cx="63" cy="54" r="9" fill="rgba(255,255,255,.25)" stroke="#6b4fa0" stroke-width="2.5"/><path d="M46 54 L54 54" stroke="#6b4fa0" stroke-width="2.5"/>` },
  scarf: { slot: 'neck', svg: `<path d="M20 82 Q50 99 80 82 L82 91 Q50 108 18 91 Z" fill="#d9534f"/><path d="M64 94 L71 112 L60 110 L57 96 Z" fill="#c4433f"/>` },
  bandana: { slot: 'neck', svg: `<path d="M22 84 Q50 95 78 84 L50 110 Z" fill="#3c6fb0"/><circle cx="41" cy="92" r="1.6" fill="#fff"/><circle cx="57" cy="94" r="1.6" fill="#fff"/><circle cx="50" cy="101" r="1.6" fill="#fff"/>` },
  camera: { slot: 'neck', svg: `<path d="M28 80 L43 96 M72 80 L57 96" stroke="#333" stroke-width="1.6"/><rect x="38" y="92" width="24" height="15" rx="3" fill="#333"/><rect x="41" y="89" width="7" height="4" rx="1" fill="#333"/><circle cx="50" cy="99.5" r="4.6" fill="#777" stroke="#eee" stroke-width="1.2"/>` },
  medal: { slot: 'neck', svg: `<path d="M40 84 L46 98 L54 98 L60 84" fill="#4a90d9"/><circle cx="50" cy="103" r="8" fill="#f2c23a" stroke="#c99a1e" stroke-width="1.5"/><path d="M50 98 l1.6 3.3 3.6 .5 -2.6 2.5 .6 3.6 -3.2 -1.7 -3.2 1.7 .6 -3.6 -2.6 -2.5 3.6 -.5 Z" fill="#fff6c9"/>` },
  backpack: { slot: 'extra', back: true, svg: `<rect x="72" y="56" width="30" height="38" rx="7" fill="#8a5a32"/><rect x="77" y="72" width="20" height="12" rx="3" fill="#a8743f"/><path d="M80 56 Q87 46 94 56" stroke="#6d4626" stroke-width="3" fill="none"/>` },
  suitcase: { slot: 'extra', svg: `<rect x="-8" y="70" width="28" height="24" rx="4" fill="#3c8f8f"/><path d="M0 70 L0 64 L12 64 L12 70" stroke="#2a6b6b" stroke-width="2.5" fill="none"/><circle cx="1" cy="81" r="3.5" fill="#f2c23a"/><rect x="10" y="76" width="6" height="9" fill="#e05d5d"/>` },
  map: { slot: 'extra', svg: `<g transform="rotate(12 94 80)"><rect x="83" y="62" width="22" height="30" fill="#f4ecd8" stroke="#b8933d" stroke-width="1.5"/><path d="M90 62 L90 92 M97 62 L97 92" stroke="#c9b48a"/><path d="M85 71 L103 85" stroke="#d9534f" stroke-width="1.6" stroke-dasharray="2 2"/><circle cx="103" cy="85" r="2" fill="#d9534f"/></g>` },
  globe: { slot: 'extra', svg: `<circle cx="96" cy="78" r="12" fill="#4a90d9"/><path d="M89 71 q5 3 2 9 q-3 2 0 6 M100 69 q-3 4 1 7 q5 1 2 7" fill="#6aae5b"/><path d="M96 90 L96 98 M87 99 L105 99" stroke="#8a5a32" stroke-width="2.5"/>` },
};
const KOMUGI_SLOTS = ['head', 'eyes', 'neck', 'extra'];

// 依裝扮組出整張圖：頭後面的配件先畫，其餘疊在臉上
function komugiArt(outfit = Store.outfit()) {
  const items = KOMUGI_SLOTS.map(s => KOMUGI_ITEMS[outfit[s]]).filter(Boolean);
  return items.filter(i => i.back).map(i => i.svg).join('') + KOMUGI_SVG + items.filter(i => !i.back).map(i => i.svg).join('');
}
function komugiImg(size, outfit) {
  return `<svg class="komugi" viewBox="-12 -14 124 128" width="${size}" height="${size}" aria-hidden="true">${komugiArt(outfit)}</svg>`;
}
