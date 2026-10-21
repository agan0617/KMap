// SVG 地圖：畫區塊、標籤、跨海連結、Komugi，支援拖曳、雙指縮放、滾輪縮放。
// 點擊用 pointerup 時的位置判斷，移動超過 8px 就當成拖曳不算點。
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};

function createMap(container, R, opts = {}) {
  const M = R.map;
  const svg = el('svg', { class: 'map' + (opts.static ? ' static' : ''), viewBox: `0 0 ${M.width} ${M.height}`, preserveAspectRatio: 'xMidYMid meet' });
  container.prepend(svg);
  const gFrames = el('g', { class: 'frames' }, svg);
  const gUnits = el('g', { class: 'units' }, svg);
  const gLinks = el('g', { class: 'links' }, svg);
  const gLabels = el('g', { class: 'labels' }, svg);
  const gMarks = el('g', { class: 'marks' }, svg);

  for (const f of M.frames || []) el('rect', { x: f.x, y: f.y, width: f.w, height: f.h, rx: 6 }, gFrames);
  // 底圖：不能點的地方（屬地、西撒哈拉…），讓地圖看起來完整
  if (M.bg) el('path', { d: M.bg, class: 'bg' }, gFrames);
  const paths = {}, dots = {};
  for (const id of R.ids) {
    paths[id] = el('path', { d: M.shapes[id].d, 'data-id': id, class: 'unit' }, gUnits);
  }
  // 太小點不到的（梵蒂岡、澳門…）另外畫一個固定螢幕大小的圓點
  // 門檻用地圖座標的面積（最大那一塊）：世界的盧森堡、汶萊，中國的港澳會有點；日本最小的沖繩本島也有 400 以上
  for (const id of R.ids) {
    const s = M.shapes[id];
    if (s.area < 25) dots[id] = el('circle', { cx: s.cx, cy: s.cy, r: 4, 'data-id': id, class: 'unit dot' }, gUnits);
  }
  const nodes = id => (dots[id] ? [paths[id], dots[id]] : [paths[id]]);
  // 選了範圍時，範圍外的區塊變淡
  function dim(ids) {
    const keep = ids ? new Set(ids) : null;
    for (const id of R.ids) for (const n of nodes(id)) n.classList.toggle('out', !!keep && !keep.has(id));
  }
  const labels = {};
  let tapCb = null;

  // ── 視角 ──
  // box：只看地圖的一部分（各洲分頁用世界地圖的一塊），「全圖」與拖曳範圍都以它為準
  const full = M.box ? { x: M.box[0], y: M.box[1], w: M.box[2], h: M.box[3] } : { x: 0, y: 0, w: M.width, h: M.height };
  let vb = { ...full };
  // 地圖座標每單位等於幾個螢幕像素的倒數；標籤與 Komugi 用它換算，縮放時保持固定的螢幕大小
  let unitPx = 1;
  function apply() {
    svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    const r = svg.getBoundingClientRect();
    unitPx = r.width ? Math.max(vb.w / r.width, vb.h / r.height) : vb.w / 600;
    gLabels.setAttribute('font-size', (11.5 * unitPx).toFixed(2));
    for (const d of Object.values(dots)) d.setAttribute('r', (5.5 * unitPx).toFixed(2));
    // 圖鑑的地名（auto）只在那一塊放得下字時才顯示，放大後自然冒出來
    for (const [id, t] of Object.entries(labels)) {
      if (!t._auto) continue;
      const b = bbox(id);
      t.style.display = Math.min(b.width, b.height * 2) / unitPx >= t.textContent.length * 11.5 * 0.95 ? '' : 'none';
    }
    for (const m of gMarks.children) if (m._place) m._place();
  }
  const boxes = {};
  // 有插圖框的區塊用框的大小判斷（沖繩本體很小，但框裡空間夠）
  function bbox(id) {
    if (boxes[id]) return boxes[id];
    const f = (M.frames || []).find(x => x.id === id);
    return (boxes[id] = f ? { width: f.w, height: f.h } : rawBox(id));
  }
  new ResizeObserver(apply).observe(svg);
  // 世界地圖的歐洲小國要放很大才看得清楚，可以放大比較多倍
  const maxZoom = M.width >= 2000 ? 40 : 10;
  function clamp() {
    const r = svg.getBoundingClientRect(), aspect = r.width && r.height ? r.width / r.height : full.w / full.h;
    vb.w = Math.max(M.width / maxZoom, Math.min(Math.max(full.w, full.h * aspect) * 1.2, vb.w));
    vb.h = vb.w / aspect;
    vb.x = Math.max(full.x - vb.w * 0.5, Math.min(full.x + full.w - vb.w * 0.5, vb.x));
    vb.y = Math.max(full.y - vb.h * 0.5, Math.min(full.y + full.h - vb.h * 0.5, vb.y));
  }
  const toSvg = (cx, cy) => {
    const p = svg.createSVGPoint(); p.x = cx; p.y = cy;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  };
  function zoomAt(factor, cx, cy) {
    const p = cx == null ? { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 } : toSvg(cx, cy);
    const nw = vb.w / factor;
    vb.x = p.x - (p.x - vb.x) * nw / vb.w;
    vb.y = p.y - (p.y - vb.y) * nw / vb.w;
    vb.w = nw; clamp(); apply();
  }
  // 「全圖」按鈕回到的視角：首頁選了範圍（某一洲、某個地方）就是那個範圍
  // 有寫好的取景框（世界地圖的各洲）就用它，否則用範圍內區塊的外框
  let home = null;
  function reset() {
    if (home?.view) focusRect(...home.view);
    else if (home) focus(home.ids, home.pad, true);
    else if (M.box) focusRect(...M.box);
    else { vb = { ...full }; apply(); }
  }
  function setHome(ids, view, pad = 1.15) { home = view ? { view } : ids && ids.length < R.ids.length ? { ids, pad } : null; reset(); }
  function focusRect(x, y, w, h) {
    const r = svg.getBoundingClientRect(), aspect = r.width && r.height ? r.width / r.height : full.w / full.h;
    vb.w = Math.max(w * 1.04, h * 1.04 * aspect); vb.h = vb.w / aspect;
    vb.x = x + w / 2 - vb.w / 2; vb.y = y + h / 2 - vb.h / 2;
    clamp(); apply();
  }
  // 從路徑字串算外框（不靠 getBBox，畫面藏著時也算得出來）
  const rawBoxes = {};
  function rawBox(id) {
    if (rawBoxes[id]) return rawBoxes[id];
    const n = M.shapes[id].d.match(/-?[\d.]+/g).map(Number);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < n.length; i += 2) { x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]); }
    return (rawBoxes[id] = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
  }
  function focus(ids, pad = 1.6, exact = false) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const id of ids) {
      const b = rawBox(id);
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
    }
    // 依容器的長寬比決定要以寬還是高為準，範圍才會剛好塞滿畫面
    const r = svg.getBoundingClientRect(), aspect = r.width && r.height ? r.width / r.height : full.w / full.h;
    let w = Math.max((x1 - x0) * pad, (y1 - y0) * pad * aspect);
    if (!exact) w = Math.max(w, full.w / 6);
    vb.w = w; vb.h = w / aspect;
    vb.x = (x0 + x1) / 2 - vb.w / 2; vb.y = (y0 + y1) / 2 - vb.h / 2;
    clamp(); apply();
  }

  // ── 指標事件 ──
  const pts = new Map();
  let moved = 0, pinch0 = null;
  svg.addEventListener('pointerdown', e => {
    svg.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) moved = 0;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), w: vb.w };
    }
  });
  svg.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 1) {
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 8 && !opts.static) {
        const r = svg.getBoundingClientRect(), k = Math.max(vb.w / r.width, vb.h / r.height);
        vb.x -= dx * k; vb.y -= dy * k; clamp(); apply();
      }
    } else if (pts.size === 2 && pinch0 && !opts.static) {
      moved = 99;
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const want = pinch0.w * pinch0.d / d;
      zoomAt(vb.w / want, (a.x + b.x) / 2, (a.y + b.y) / 2);
    }
  });
  const end = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch0 = null;
    if (pts.size === 0 && moved <= 8 && e.type === 'pointerup') {
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      // 點到海或底圖也回報（id 為 null），答完題點畫面任何地方都能進下一題
      const id = hit?.getAttribute?.('data-id') || null;
      if (tapCb) tapCb(id);
    }
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  if (!opts.static) svg.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, e.clientX, e.clientY); }, { passive: false });
  container.querySelector('.zoom')?.addEventListener('click', e => {
    const z = e.target.closest('button')?.dataset.z;
    if (z === 'in') zoomAt(1.5); else if (z === 'out') zoomAt(1 / 1.5); else if (z === 'reset') reset();
  });

  // ── 外觀 ──
  function paint(fn) { for (const id of R.ids) { const c = fn(id) || ''; for (const n of nodes(id)) n.style.fill = c; } }
  function mark(id, cls, on = true) { if (paths[id]) for (const n of nodes(id)) n.classList.toggle(cls, on); }
  function clearMarks(...cls) { for (const n of gUnits.children) n.classList.remove(...cls); }
  function flash(id, cls, ms = 900) { mark(id, cls); setTimeout(() => mark(id, cls, false), ms); }
  function label(id, text, cls = '') {
    labels[id]?.remove();
    if (text == null) { delete labels[id]; return; }
    const s = M.shapes[id];
    const t = el('text', { x: s.cx, y: s.cy, class: 'label ' + cls, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, gLabels);
    t.textContent = text;
    t._auto = cls === 'auto';
    labels[id] = t;
    if (t._auto) apply();
  }
  function clearLabels() { for (const id of Object.keys(labels)) label(id, null); }
  function showLinks(on) {
    gLinks.innerHTML = '';
    if (!on) return;
    for (const l of M.links || []) {
      if (!R.units[l.a] || !R.units[l.b]) continue;   // 各洲分頁不畫跨洲的連結
      const a = M.shapes[l.a], b = M.shapes[l.b];
      const ln = el('line', { x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy, class: 'link' }, gLinks);
      el('title', {}, ln).textContent = l.name;
    }
  }

  // Komugi 等標記：固定螢幕大小，跟著視角縮放
  function marker(html, id, size = 40) {
    const g = el('g', { class: 'marker' }, gMarks);
    const inner = el('g', {}, g);
    inner.innerHTML = html;
    g._id = id;
    g._place = () => {
      const s = M.shapes[g._id], k = unitPx * size / 100;
      // 用 CSS transform 才有移動動畫（SVG 的 transform 屬性不吃 transition）
      g.style.transform = `translate(${s.cx}px, ${s.cy}px) scale(${k}) translate(-50px, -100px)`;
    };
    g.moveTo = nid => { g._id = nid; g._place(); };
    g._place();
    return g;
  }
  function clearMarkers() { gMarks.innerHTML = ''; }
  function path(ids) {
    const old = gLinks.querySelector('.route'); old?.remove();
    if (!ids || ids.length < 2) return;
    const d = ids.map((id, i) => `${i ? 'L' : 'M'}${M.shapes[id].cx} ${M.shapes[id].cy}`).join('');
    el('path', { d, class: 'route' }, gLinks);
  }

  apply();
  return {
    svg, onTap: cb => { tapCb = cb; }, paint, mark, clearMarks, flash, label, clearLabels,
    showLinks, marker, clearMarkers, path, focus, reset, setHome, dim, zoomAt,
    destroy() { svg.remove(); },
  };
}
