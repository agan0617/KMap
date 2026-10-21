// Komugi：戴耳機的柴犬，旅行模式的旅人兼吉祥物。
// 頭畫在 100×100 的座標（頭頂到下巴約 y8～90）；全身畫在 120×160 的座標，頭整個往右移 10。
// 配件分 8 個部位，頭、眼睛、脖子用頭的座標（只畫頭的小圖也戴得上），其餘用全身的座標。
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

// 身體（坐姿）：尾巴與身體在頭後面，前腳另外畫，衣服才能夾在身體和前腳之間
const KOMUGI_TAIL = `<path d="M84 122 C104 124 110 102 99 94 C90 88 82 97 88 105" fill="none" stroke="#e8913a" stroke-width="10" stroke-linecap="round"/><path d="M94 99 C89 96 87 101 90 104" stroke="#fff7ea" stroke-width="5" fill="none" stroke-linecap="round"/>`;
const KOMUGI_BODY = `<ellipse cx="40" cy="142" rx="13" ry="8" fill="#d9822b"/><ellipse cx="80" cy="142" rx="13" ry="8" fill="#d9822b"/>
<path d="M36 98 Q31 140 43 147 L77 147 Q89 140 84 98 Q60 76 36 98 Z" fill="#e8913a"/><path d="M47 94 Q46 118 60 124 Q74 118 73 94 Q60 86 47 94 Z" fill="#fff7ea"/>`;
const KOMUGI_LEGS = `<rect x="46" y="124" width="11" height="25" rx="5.5" fill="#e8913a"/><rect x="63" y="124" width="11" height="25" rx="5.5" fill="#e8913a"/>
<ellipse cx="51.5" cy="148" rx="7" ry="4" fill="#fff7ea"/><ellipse cx="68.5" cy="148" rx="7" ry="4" fill="#fff7ea"/>`;

// 兩隻腳各畫一次的配件（x 位移 17）
const pair = s => s + `<g transform="translate(17 0)">${s}</g>`;

// 配件：slot＝部位、rar＝稀有度（N／R／SR／SSR）。來源（成就或扭蛋）寫在 js/rewards.js
const KOMUGI_ITEMS = {
  // ── 頭（頭的座標）──
  strawhat: { slot: 'head', rar: 'R', svg: `<ellipse cx="50" cy="14" rx="34" ry="7" fill="#e6c36a" stroke="#b8933d" stroke-width="1.5"/><path d="M33 14 Q33 -6 50 -6 Q67 -6 67 14 Z" fill="#f0d27e" stroke="#b8933d" stroke-width="1.5"/><rect x="33" y="6" width="34" height="5" fill="#d9534f"/>` },
  beret: { slot: 'head', rar: 'R', svg: `<ellipse cx="44" cy="11" rx="28" ry="10" fill="#b23a48" transform="rotate(-10 44 11)"/><circle cx="47" cy="0" r="3" fill="#b23a48"/>` },
  headband: { slot: 'head', rar: 'N', svg: `<path d="M18 32 Q50 14 82 32 L82 40 Q50 22 18 40 Z" fill="#e05d5d"/><path d="M18 36 Q50 18 82 36" stroke="#fff" stroke-width="1.6" fill="none"/>` },
  hachimaki: { slot: 'head', rar: 'R', svg: `<path d="M18 32 Q50 14 82 32 L82 40 Q50 22 18 40 Z" fill="#fff" stroke="#ddd"/><circle cx="50" cy="26" r="4.5" fill="#d9534f"/><path d="M82 35 L95 28 M82 38 L93 45" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>` },
  gradcap: { slot: 'head', rar: 'SR', svg: `<path d="M32 12 L32 22 Q50 30 68 22 L68 12 L50 19 Z" fill="#3a3a4d"/><path d="M50 -5 L88 8 L50 21 L12 8 Z" fill="#2b2b3a"/><path d="M50 8 L82 12 L82 26" stroke="#e3a92b" stroke-width="2" fill="none"/><circle cx="82" cy="28" r="3" fill="#e3a92b"/>` },
  conical: { slot: 'head', rar: 'R', svg: `<path d="M50 -10 L94 20 Q50 30 6 20 Z" fill="#d8b56a" stroke="#a8823a" stroke-width="1.5"/><path d="M50 -10 L28 23 M50 -10 L72 23 M50 -10 L50 25" stroke="#a8823a" stroke-width="1"/>` },
  crown: { slot: 'head', rar: 'SSR', svg: `<path d="M28 20 L30 0 L40 10 L50 -6 L60 10 L70 0 L72 20 Z" fill="#f2c23a" stroke="#c99a1e" stroke-width="1.5"/><circle cx="50" cy="8" r="3" fill="#d9534f"/><circle cx="37" cy="14" r="2" fill="#4a90d9"/><circle cx="63" cy="14" r="2" fill="#4a90d9"/>` },
  chefhat: { slot: 'head', rar: 'R', svg: `<path d="M33 16 L33 4 Q24 -2 31 -9 Q36 -16 44 -11 Q50 -18 57 -11 Q65 -16 69 -9 Q76 -2 67 4 L67 16 Z" fill="#fff" stroke="#ccc" stroke-width="1.5"/><rect x="33" y="10" width="34" height="9" fill="#f4f4f4" stroke="#ccc" stroke-width="1.5"/>` },
  cowboy: { slot: 'head', rar: 'R', svg: `<ellipse cx="50" cy="18" rx="42" ry="7" fill="#8a5a32"/><path d="M30 18 Q30 -4 41 -1 Q50 4 59 -1 Q70 -4 70 18 Z" fill="#a8743f"/><rect x="31" y="11" width="38" height="4" fill="#5a3a20"/>` },
  sombrero: { slot: 'head', rar: 'SR', svg: `<ellipse cx="50" cy="18" rx="47" ry="8" fill="#e3a92b" stroke="#b5821a" stroke-width="1.5"/><path d="M36 18 Q38 -10 50 -10 Q62 -10 64 18 Z" fill="#e8b93a" stroke="#b5821a" stroke-width="1.5"/><path d="M37 11 L63 11" stroke="#d9534f" stroke-width="3"/><path d="M8 19 Q50 30 92 19" stroke="#6aae5b" stroke-width="2" stroke-dasharray="4 3" fill="none"/>` },
  flowercrown: { slot: 'head', rar: 'R', svg: `<path d="M20 26 Q50 2 80 26" stroke="#6aae5b" stroke-width="3" fill="none"/>${[[22, 24, '#f08cb0'], [31, 16, '#fff'], [41, 11, '#f2c23a'], [50, 9, '#f08cb0'], [59, 11, '#fff'], [69, 16, '#f2c23a'], [78, 24, '#f08cb0']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="5" fill="${c}" stroke="#e3a0b8" stroke-width="1"/><circle cx="${x}" cy="${y}" r="1.6" fill="#f2c23a"/>`).join('')}` },
  santahat: { slot: 'head', rar: 'SR', svg: `<path d="M27 20 Q36 -6 60 -8 Q82 -8 88 14 L82 17 Q76 4 64 6 Q72 12 73 20 Z" fill="#d9534f"/><rect x="23" y="15" width="54" height="9" rx="4.5" fill="#fff"/><circle cx="86" cy="17" r="5.5" fill="#fff"/>` },
  wizardhat: { slot: 'head', rar: 'SSR', svg: `<path d="M50 -26 L75 18 L25 18 Z" fill="#4b3c8f"/><ellipse cx="50" cy="18" rx="36" ry="6" fill="#4b3c8f"/><path d="M45 -2 l2 4.4 4.6 .4 -3.5 3 1 4.6 -4.1 -2.4 -4.1 2.4 1 -4.6 -3.5 -3 4.6 -.4 Z" fill="#f2c23a"/><circle cx="58" cy="9" r="1.8" fill="#f2c23a"/><circle cx="39" cy="12" r="1.3" fill="#f2c23a"/>` },
  hardhat: { slot: 'head', rar: 'N', svg: `<path d="M28 20 Q28 -1 50 -1 Q72 -1 72 20 Z" fill="#f2c23a"/><rect x="22" y="17" width="56" height="5" rx="2" fill="#e0a92a"/><rect x="47" y="-1" width="6" height="19" fill="#e0a92a"/>` },
  ribbon: { slot: 'head', rar: 'N', svg: `<path d="M64 16 L78 7 L78 25 Z M64 16 L50 7 L50 25 Z" fill="#f08cb0"/><circle cx="64" cy="16" r="3.8" fill="#d9608e"/>` },
  // ── 眼睛（頭的座標）──
  sunglasses: { slot: 'eyes', rar: 'R', svg: `<rect x="26" y="46" width="21" height="14" rx="5" fill="#222"/><rect x="53" y="46" width="21" height="14" rx="5" fill="#222"/><path d="M47 51 L53 51" stroke="#222" stroke-width="2.5"/><path d="M30 49 l6 0 M57 49 l6 0" stroke="#777" stroke-width="1.6"/>` },
  roundglasses: { slot: 'eyes', rar: 'R', svg: `<circle cx="37" cy="54" r="9" fill="rgba(255,255,255,.25)" stroke="#6b4fa0" stroke-width="2.5"/><circle cx="63" cy="54" r="9" fill="rgba(255,255,255,.25)" stroke="#6b4fa0" stroke-width="2.5"/><path d="M46 54 L54 54" stroke="#6b4fa0" stroke-width="2.5"/>` },
  heartglasses: { slot: 'eyes', rar: 'R', svg: `${[37, 63].map(x => `<path d="M${x} 62 C${x - 7} 56 ${x - 10} 52 ${x - 7} 48 C${x - 4} 45 ${x - 1} 47 ${x} 49 C${x + 1} 47 ${x + 4} 45 ${x + 7} 48 C${x + 10} 52 ${x + 7} 56 ${x} 62 Z" fill="#f06292" opacity=".9"/>`).join('')}<path d="M45 52 L55 52" stroke="#d81b60" stroke-width="2"/>` },
  goggles: { slot: 'eyes', rar: 'N', svg: `<rect x="24" y="45" width="52" height="18" rx="9" fill="rgba(120,200,255,.45)" stroke="#2a6b9b" stroke-width="3"/><path d="M50 45 L50 63" stroke="#2a6b9b" stroke-width="2"/><path d="M13 52 L24 52 M76 52 L87 52" stroke="#2a6b9b" stroke-width="3"/>` },
  eyepatch: { slot: 'eyes', rar: 'R', svg: `<path d="M14 40 L86 47" stroke="#222" stroke-width="1.6"/><ellipse cx="63" cy="54" rx="9.5" ry="8.5" fill="#222"/>` },
  monocle: { slot: 'eyes', rar: 'SR', svg: `<circle cx="63" cy="54" r="9" fill="rgba(255,255,255,.2)" stroke="#c99a1e" stroke-width="2.5"/><path d="M70 61 Q75 72 69 84" stroke="#c99a1e" stroke-width="1.2" fill="none"/>` },
  // ── 脖子（頭的座標）──
  scarf: { slot: 'neck', rar: 'R', svg: `<path d="M20 82 Q50 99 80 82 L82 91 Q50 108 18 91 Z" fill="#d9534f"/><path d="M64 94 L71 112 L60 110 L57 96 Z" fill="#c4433f"/>` },
  bandana: { slot: 'neck', rar: 'R', svg: `<path d="M22 84 Q50 95 78 84 L50 110 Z" fill="#3c6fb0"/><circle cx="41" cy="92" r="1.6" fill="#fff"/><circle cx="57" cy="94" r="1.6" fill="#fff"/><circle cx="50" cy="101" r="1.6" fill="#fff"/>` },
  camera: { slot: 'neck', rar: 'R', svg: `<path d="M28 80 L43 96 M72 80 L57 96" stroke="#333" stroke-width="1.6"/><rect x="38" y="92" width="24" height="15" rx="3" fill="#333"/><rect x="41" y="89" width="7" height="4" rx="1" fill="#333"/><circle cx="50" cy="99.5" r="4.6" fill="#777" stroke="#eee" stroke-width="1.2"/>` },
  medal: { slot: 'neck', rar: 'SSR', svg: `<path d="M40 84 L46 98 L54 98 L60 84" fill="#4a90d9"/><circle cx="50" cy="103" r="8" fill="#f2c23a" stroke="#c99a1e" stroke-width="1.5"/><path d="M50 98 l1.6 3.3 3.6 .5 -2.6 2.5 .6 3.6 -3.2 -1.7 -3.2 1.7 .6 -3.6 -2.6 -2.5 3.6 -.5 Z" fill="#fff6c9"/>` },
  bowtie: { slot: 'neck', rar: 'N', svg: `<path d="M50 89 L37 82 L37 96 Z M50 89 L63 82 L63 96 Z" fill="#d9534f"/><circle cx="50" cy="89" r="3.2" fill="#b23a48"/>` },
  lei: { slot: 'neck', rar: 'R', svg: `${[[22, 84], [30, 89], [38, 93], [46, 95], [54, 95], [62, 93], [70, 89], [78, 84]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="4.6" fill="${['#f08cb0', '#f2c23a', '#b47fd6', '#fff'][i % 4]}"/>`).join('')}` },
  bell: { slot: 'neck', rar: 'N', svg: `<path d="M22 84 Q50 97 78 84" stroke="#d9534f" stroke-width="5" fill="none"/><circle cx="50" cy="97" r="6.5" fill="#f2c23a" stroke="#c99a1e" stroke-width="1.5"/><path d="M46 99 L54 99" stroke="#8a6b1a" stroke-width="1.5"/>` },
  // ── 衣服（全身座標）──
  tshirt: { slot: 'body', rar: 'N', svg: `<path d="M36 100 Q60 92 84 100 L93 114 L82 119 L81 134 L39 134 L38 119 L27 114 Z" fill="#4a90d9"/><path d="M52 96 Q60 103 68 96" stroke="#3a78b8" stroke-width="2.5" fill="none"/><text x="60" y="124" font-size="9" text-anchor="middle" fill="#fff" font-weight="900" font-family="sans-serif">K</text>` },
  hoodie: { slot: 'body', rar: 'R', svg: `<path d="M36 100 Q60 92 84 100 L93 116 L82 121 L81 139 L39 139 L38 121 L27 116 Z" fill="#6aae5b"/><path d="M48 125 L72 125 L70 136 L50 136 Z" fill="#5a9a4c"/><path d="M54 98 L54 113 M66 98 L66 113" stroke="#fff" stroke-width="1.6"/>` },
  yukata: { slot: 'body', rar: 'SR', svg: `<path d="M36 100 Q60 94 84 100 L95 121 L84 123 L84 146 L36 146 L36 123 L25 121 Z" fill="#2b3f73"/><path d="M50 98 L60 118 L70 98" stroke="#fff" stroke-width="3" fill="none"/><rect x="36" y="118" width="48" height="8" fill="#e05d5d"/><circle cx="44" cy="135" r="2.2" fill="#9fc3ff"/><circle cx="76" cy="139" r="2.2" fill="#9fc3ff"/><circle cx="60" cy="141" r="2.2" fill="#9fc3ff"/><circle cx="31" cy="112" r="2" fill="#9fc3ff"/>` },
  qipao: { slot: 'body', rar: 'SR', svg: `<path d="M38 100 Q60 92 82 100 L85 147 L35 147 Z" fill="#c8402c"/><path d="M60 96 L60 104 L75 102" stroke="#f2c23a" stroke-width="1.8" fill="none"/><circle cx="49" cy="124" r="5" fill="none" stroke="#f2c23a" stroke-width="1.5"/><circle cx="71" cy="134" r="4" fill="none" stroke="#f2c23a" stroke-width="1.5"/><path d="M45 140 Q50 136 55 140" stroke="#f2c23a" stroke-width="1.5" fill="none"/>` },
  suit: { slot: 'body', rar: 'SR', svg: `<path d="M36 100 Q60 92 84 100 L93 118 L82 121 L82 141 L38 141 L38 121 L27 118 Z" fill="#2b2b3a"/><path d="M52 98 L60 121 L68 98 Z" fill="#fff"/><path d="M60 102 L57 106 L60 123 L63 106 Z" fill="#c8402c"/>` },
  raincoat: { slot: 'body', rar: 'N', svg: `<path d="M35 100 Q60 92 85 100 L94 120 L84 122 L86 146 L34 146 L36 122 L26 120 Z" fill="#f2c23a"/><path d="M60 98 L60 146" stroke="#d9a520" stroke-width="1.5"/><circle cx="64" cy="112" r="1.8" fill="#d9a520"/><circle cx="64" cy="124" r="1.8" fill="#d9a520"/><circle cx="64" cy="136" r="1.8" fill="#d9a520"/>` },
  sweater: { slot: 'body', rar: 'R', svg: `<path d="M36 100 Q60 92 84 100 L93 118 L82 121 L81 138 L39 138 L38 121 L27 118 Z" fill="#c8402c"/><path d="M38 112 l6 -5 6 5 6 -5 6 5 6 -5 6 5 6 -5 4 3 M39 126 l6 -5 6 5 6 -5 6 5 6 -5 6 5 6 -5" stroke="#fff" stroke-width="2" fill="none"/>` },
  jersey: { slot: 'body', rar: 'R', svg: `<path d="M36 100 Q60 92 84 100 L93 114 L82 119 L81 136 L39 136 L38 119 L27 114 Z" fill="#fff" stroke="#2a4f9b" stroke-width="2"/><path d="M27 114 L38 119 M93 114 L82 119" stroke="#2a4f9b" stroke-width="3"/><text x="60" y="128" font-size="15" text-anchor="middle" fill="#2a4f9b" font-weight="900" font-family="sans-serif">17</text>` },
  astronaut: { slot: 'body', rar: 'SSR', svg: `<path d="M34 100 Q60 90 86 100 L95 122 L84 124 L85 147 L35 147 L36 124 L25 122 Z" fill="#f2f2f2" stroke="#bbb" stroke-width="1.5"/><rect x="50" y="108" width="20" height="14" rx="3" fill="#cfd8e3" stroke="#999"/><circle cx="55" cy="115" r="2" fill="#e05d5d"/><circle cx="62" cy="115" r="2" fill="#4a90d9"/><circle cx="41" cy="112" r="4.5" fill="#2a4f9b"/><path d="M38 132 L82 132" stroke="#d9534f" stroke-width="3"/>` },
  // ── 背後（全身座標，畫在身體後面）──
  backpack: { slot: 'back', rar: 'R', svg: `<rect x="76" y="98" width="30" height="40" rx="8" fill="#8a5a32"/><rect x="81" y="116" width="20" height="13" rx="3" fill="#a8743f"/><path d="M84 98 Q91 88 98 98" stroke="#6d4626" stroke-width="3" fill="none"/>` },
  cape: { slot: 'back', rar: 'R', svg: `<path d="M36 98 Q60 90 84 98 L97 150 Q60 158 23 150 Z" fill="#c8402c"/><path d="M36 98 Q60 106 84 98" stroke="#8f2a1c" stroke-width="2" fill="none"/>` },
  angelwings: { slot: 'back', rar: 'SSR', svg: `<path d="M40 106 Q14 90 4 110 Q12 112 8 121 Q18 121 16 130 Q30 128 42 120 Z" fill="#fff" stroke="#d6d6d6" stroke-width="1.5"/><path d="M80 106 Q106 90 116 110 Q108 112 112 121 Q102 121 104 130 Q90 128 78 120 Z" fill="#fff" stroke="#d6d6d6" stroke-width="1.5"/>` },
  guitar: { slot: 'back', rar: 'SR', svg: `<g transform="rotate(-32 60 120)"><rect x="56" y="62" width="8" height="44" fill="#5a3a20"/><rect x="53" y="54" width="14" height="10" rx="2" fill="#3a2414"/><ellipse cx="60" cy="112" rx="16" ry="13" fill="#c8813a"/><ellipse cx="60" cy="128" rx="21" ry="16" fill="#c8813a"/><circle cx="60" cy="117" r="5" fill="#3a2414"/></g>` },
  shell: { slot: 'back', rar: 'N', svg: `<ellipse cx="60" cy="118" rx="35" ry="28" fill="#6aae5b" stroke="#4a8a3c" stroke-width="2"/><path d="M60 92 L60 146 M28 112 L92 112 M32 128 L88 128" stroke="#4a8a3c" stroke-width="2"/>` },
  // ── 手上（全身座標，拿在右邊或放在旁邊）──
  suitcase: { slot: 'hand', rar: 'R', svg: `<rect x="2" y="122" width="30" height="26" rx="4" fill="#3c8f8f"/><path d="M11 122 L11 116 L23 116 L23 122" stroke="#2a6b6b" stroke-width="2.5" fill="none"/><circle cx="10" cy="134" r="3.5" fill="#f2c23a"/><rect x="20" y="129" width="7" height="10" fill="#e05d5d"/>` },
  map: { slot: 'hand', rar: 'SR', svg: `<g transform="rotate(12 98 122)"><rect x="86" y="104" width="24" height="32" fill="#f4ecd8" stroke="#b8933d" stroke-width="1.5"/><path d="M94 104 L94 136 M102 104 L102 136" stroke="#c9b48a"/><path d="M88 113 L107 128" stroke="#d9534f" stroke-width="1.6" stroke-dasharray="2 2"/><circle cx="107" cy="128" r="2" fill="#d9534f"/></g>` },
  globe: { slot: 'hand', rar: 'SR', svg: `<circle cx="100" cy="124" r="13" fill="#4a90d9"/><path d="M92 117 q5 3 2 9 q-3 2 0 6 M104 114 q-3 4 1 7 q5 1 2 8" fill="#6aae5b"/><path d="M100 137 L100 145 M90 147 L110 147" stroke="#8a5a32" stroke-width="3"/>` },
  bubbletea: { slot: 'hand', rar: 'R', svg: `<path d="M88 112 L104 112 L101 142 L91 142 Z" fill="#f0dcc0" stroke="#b08a5a" stroke-width="1.5"/><rect x="87" y="108" width="18" height="5" rx="2" fill="#b08a5a"/><path d="M98 96 L95 124" stroke="#e05d5d" stroke-width="3"/>${[[93, 137], [98, 138], [95.5, 133], [100, 133]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#3a2414"/>`).join('')}` },
  uchiwa: { slot: 'hand', rar: 'R', svg: `<path d="M98 128 L98 148" stroke="#8a5a32" stroke-width="3"/><circle cx="98" cy="115" r="14" fill="#fff" stroke="#d9534f" stroke-width="2"/><circle cx="98" cy="115" r="5.5" fill="#d9534f"/>` },
  tanghulu: { slot: 'hand', rar: 'R', svg: `<path d="M98 98 L98 148" stroke="#8a5a32" stroke-width="2"/>${[103, 112, 121, 130].map(y => `<circle cx="98" cy="${y}" r="5" fill="#d9534f"/><circle cx="96.5" cy="${y - 1.6}" r="1.4" fill="#fff" opacity=".7"/>`).join('')}` },
  icecream: { slot: 'hand', rar: 'N', svg: `<path d="M91 118 L105 118 L98 144 Z" fill="#e0b070" stroke="#b8863d" stroke-width="1.2"/><circle cx="98" cy="113" r="8" fill="#f8c8d8"/><circle cx="98" cy="103" r="7" fill="#fff4d6"/><circle cx="98" cy="96" r="2.5" fill="#d9534f"/>` },
  magnifier: { slot: 'hand', rar: 'N', svg: `<circle cx="99" cy="112" r="10" fill="rgba(180,220,255,.5)" stroke="#555" stroke-width="3"/><path d="M93 120 L85 136" stroke="#8a5a32" stroke-width="4.5" stroke-linecap="round"/>` },
  umbrella: { slot: 'hand', rar: 'R', svg: `<path d="M98 98 L98 146 Q98 151 93 151" stroke="#555" stroke-width="2.2" fill="none"/><path d="M72 102 Q98 74 124 102 Q117 97 111 102 Q104 97 98 102 Q92 97 85 102 Q79 97 72 102 Z" fill="#6b4fa0"/>` },
  balloon: { slot: 'hand', rar: 'N', svg: `<path d="M96 104 Q92 122 96 140" stroke="#888" stroke-width="1.2" fill="none"/><ellipse cx="98" cy="90" rx="12" ry="14" fill="#e05d5d"/><path d="M95 104 L101 104 L98 100 Z" fill="#c4433f"/><ellipse cx="94" cy="85" rx="3" ry="5" fill="#fff" opacity=".45"/>` },
  mic: { slot: 'hand', rar: 'N', svg: `<rect x="95" y="114" width="7" height="26" rx="3" fill="#333"/><circle cx="98.5" cy="109" r="8" fill="#999" stroke="#666" stroke-width="1.5"/><path d="M92 109 L105 109 M98.5 102 L98.5 116" stroke="#777" stroke-width="1"/>` },
  onigiri: { slot: 'hand', rar: 'N', svg: `<path d="M98 110 Q110 128 106 138 Q98 142 90 138 Q86 128 98 110 Z" fill="#fff" stroke="#ddd" stroke-width="1.5"/><rect x="91" y="129" width="14" height="11" fill="#2b3a2b"/>` },
  lantern: { slot: 'hand', rar: 'SR', svg: `<path d="M98 96 L98 104" stroke="#333" stroke-width="1.5"/><ellipse cx="98" cy="118" rx="13" ry="13" fill="#d9534f"/><path d="M98 105 L98 131 M90 107 Q86 118 90 129 M106 107 Q110 118 106 129" stroke="#b23a48" stroke-width="1" fill="none"/><rect x="91" y="103" width="14" height="3.5" fill="#f2c23a"/><rect x="91" y="129.5" width="14" height="3.5" fill="#f2c23a"/><path d="M98 133 L98 143" stroke="#f2c23a" stroke-width="2"/>` },
  trophy: { slot: 'hand', rar: 'SSR', svg: `<path d="M88 104 L108 104 Q108 124 98 126 Q88 124 88 104 Z" fill="#f2c23a" stroke="#c99a1e" stroke-width="1.5"/><path d="M88 108 Q80 108 82 116 Q84 120 89 119 M108 108 Q116 108 114 116 Q112 120 107 119" stroke="#c99a1e" stroke-width="2" fill="none"/><rect x="95" y="126" width="6" height="10" fill="#c99a1e"/><rect x="88" y="136" width="20" height="6" rx="1.5" fill="#8a5a32"/>` },
  // ── 腳（全身座標，兩隻腳）──
  sneakers: { slot: 'feet', rar: 'N', svg: pair(`<path d="M44 147 Q44 140 51.5 140 Q59 140 59 147 L59 152 L44 152 Z" fill="#e05d5d"/><rect x="43" y="150" width="17" height="3.5" rx="1.5" fill="#fff"/>`) },
  geta: { slot: 'feet', rar: 'R', svg: pair(`<rect x="42" y="150" width="19" height="4" fill="#a8743f"/><rect x="44" y="154" width="4" height="4" fill="#8a5a32"/><rect x="55" y="154" width="4" height="4" fill="#8a5a32"/><path d="M46 149 L51.5 144 L57 149" stroke="#d9534f" stroke-width="2.2" fill="none"/>`) },
  slippers: { slot: 'feet', rar: 'R', svg: pair(`<rect x="42" y="149" width="19" height="4.5" rx="2" fill="#fff" stroke="#bbb"/><path d="M44 150 Q51.5 141 59 150" stroke="#2a5fbf" stroke-width="4.5" fill="none"/>`) },
  rainboots: { slot: 'feet', rar: 'N', svg: pair(`<path d="M45 134 L58 134 L58 147 L61 147 Q62 153 58 153 L45 153 Z" fill="#f2c23a" stroke="#d9a520" stroke-width="1"/>`) },
  rollerskates: { slot: 'feet', rar: 'SR', svg: pair(`<path d="M44 146 Q44 140 51.5 140 Q59 140 59 146 L60 151 L43 151 Z" fill="#f08cb0"/><circle cx="46" cy="154" r="2.6" fill="#555"/><circle cx="57" cy="154" r="2.6" fill="#555"/>`) },
  boots: { slot: 'feet', rar: 'R', svg: pair(`<path d="M45 136 L58 136 L58 147 Q62 147 62 151 L62 153 L45 153 Z" fill="#8a5a32"/><rect x="44" y="134" width="15" height="4" rx="1" fill="#6d4626"/>`) },
  // ── 背景（全身座標，畫在最後面）──
  sunset: { slot: 'bg', rar: 'N', svg: `<rect x="-12" y="-16" width="144" height="180" rx="16" fill="#ffd9a8"/><circle cx="60" cy="104" r="40" fill="#ff9e6d"/><rect x="-12" y="118" width="144" height="46" fill="#f2b880"/><path d="M-12 118 L132 118" stroke="#e8996a" stroke-width="2"/>` },
  night: { slot: 'bg', rar: 'R', svg: `<rect x="-12" y="-16" width="144" height="180" rx="16" fill="#1f2a4d"/><circle cx="100" cy="10" r="10" fill="#fff4c2"/><circle cx="105" cy="6" r="9" fill="#1f2a4d"/>${[[10, 10], [30, -4], [22, 40], [108, 50], [120, 90], [4, 80], [80, 30]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.5" fill="#fff"/>`).join('')}<rect x="-12" y="136" width="144" height="28" fill="#2c3a63"/>` },
  sakura: { slot: 'bg', rar: 'R', svg: `<rect x="-12" y="-16" width="144" height="180" rx="16" fill="#fde4ec"/><path d="M-12 30 Q20 0 40 -16" stroke="#8a5a32" stroke-width="5" fill="none"/>${[[0, 18], [14, 6], [26, -6], [8, 32], [110, 60], [96, 20], [118, 120], [4, 110], [30, 150]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#f8b6c8"/>`).join('')}<rect x="-12" y="140" width="144" height="24" fill="#f6cbd7"/>` },
  taipei101: { slot: 'bg', rar: 'SSR', svg: `<rect x="-12" y="-16" width="144" height="180" rx="16" fill="#cfe6f5"/><path d="M98 -6 L100 -6 L101 6 L106 8 L104 26 L108 28 L106 46 L110 48 L108 66 L112 68 L110 86 L114 88 L114 150 L84 150 L84 88 L88 86 L86 68 L90 66 L88 48 L92 46 L90 28 L94 26 L92 8 L97 6 Z" fill="#7aa6a0"/><rect x="-12" y="146" width="144" height="18" fill="#9fc3b8"/>` },
  fuji: { slot: 'bg', rar: 'SSR', svg: `<rect x="-12" y="-16" width="144" height="180" rx="16" fill="#cfe6f5"/><path d="M-12 140 L42 46 Q60 38 78 46 L132 140 Z" fill="#5f7fb0"/><path d="M42 46 Q60 38 78 46 L88 64 Q80 58 72 66 Q66 58 60 66 Q54 58 48 66 Q40 58 32 64 Z" fill="#fff"/><circle cx="104" cy="16" r="12" fill="#e05d5d"/><rect x="-12" y="138" width="144" height="26" fill="#9fc3b8"/>` },
  greatwall: { slot: 'bg', rar: 'SSR', svg: `<rect x="-12" y="-16" width="144" height="180" rx="16" fill="#e6f0d8"/><path d="M-12 90 Q20 60 50 80 Q80 100 132 70 L132 164 L-12 164 Z" fill="#8fbf7a"/><path d="M-12 92 Q20 62 50 82 Q80 102 132 72" stroke="#b8a07a" stroke-width="9" fill="none"/>${[[10, 74], [50, 78], [92, 86]].map(([x, y]) => `<rect x="${x - 6}" y="${y - 14}" width="12" height="14" fill="#a8906a"/>`).join('')}` },
  eiffel: { slot: 'bg', rar: 'SSR', svg: `<rect x="-12" y="-16" width="144" height="180" rx="16" fill="#dbe7f7"/><path d="M100 -8 L102 -8 L106 40 L110 42 L106 46 L114 96 L118 98 L112 100 L124 148 L114 148 Q101 118 88 148 L78 148 L90 100 L84 98 L88 96 L96 46 L92 42 L96 40 Z" fill="#6d5a4a"/><rect x="-12" y="146" width="144" height="18" fill="#b8cfa0"/>` },
  beach: { slot: 'bg', rar: 'N', svg: `<rect x="-12" y="-16" width="144" height="180" rx="16" fill="#bfe4f7"/><rect x="-12" y="100" width="144" height="30" fill="#4aa3d0"/><path d="M-12 104 q8 -4 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0" stroke="#fff" stroke-width="2" fill="none"/><rect x="-12" y="128" width="144" height="36" fill="#f2d79a"/><circle cx="104" cy="14" r="12" fill="#f2c23a"/>` },
};
const KOMUGI_SLOTS = ['head', 'eyes', 'neck', 'body', 'back', 'hand', 'feet', 'bg'];
const HEAD_SLOTS = ['head', 'eyes', 'neck'];

// 只畫頭（小圖示、地圖上的旅人、通知）：頭的座標，只戴頭、眼睛、脖子
function komugiArt(outfit = Store.outfit()) {
  return KOMUGI_SVG + HEAD_SLOTS.map(s => KOMUGI_ITEMS[outfit[s]]?.svg || '').join('');
}
function komugiImg(size, outfit) {
  return `<svg class="komugi" viewBox="-12 -14 124 128" width="${size}" height="${size}" aria-hidden="true">${komugiArt(outfit)}</svg>`;
}
// 全身：背景→背後→尾巴與身體→衣服→前腳→腳→頭→脖子、眼睛、頭→手上
function komugiFull(outfit = Store.outfit()) {
  const it = s => KOMUGI_ITEMS[outfit[s]]?.svg || '';
  const head = s => `<g transform="translate(10 0)">${it(s)}</g>`;
  return it('bg') + it('back') + KOMUGI_TAIL + KOMUGI_BODY + `<g transform="translate(0 -4)">${it('body')}</g>` + KOMUGI_LEGS + it('feet')
    + `<g transform="translate(10 0)">${KOMUGI_SVG}</g>` + head('neck') + head('eyes') + head('head') + it('hand');
}
function komugiFullImg(size, outfit) {
  return `<svg class="komugi full" viewBox="-12 -16 144 180" width="${size}" height="${size * 1.25}" aria-hidden="true">${komugiFull(outfit)}</svg>`;
}
// 配件縮圖：頭部配件用頭像，其他用全身
function itemImg(item, size) {
  const it = KOMUGI_ITEMS[item], o = { [it.slot]: item };
  return HEAD_SLOTS.includes(it.slot) ? komugiImg(size, o) : komugiFullImg(size * 0.8, o);
}
