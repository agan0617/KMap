// Komugi：戴耳機的柴犬，旅行模式的旅人兼吉祥物。畫在 100×100 的座標裡。
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

function komugiImg(size) {
  return `<svg class="komugi" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${KOMUGI_SVG}</svg>`;
}
