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
  const svg = el('svg', { class: 'map', viewBox: `0 0 ${M.width} ${M.height}`, preserveAspectRatio: 'xMidYMid meet' });
  container.prepend(svg);
  const gFrames = el('g', { class: 'frames' }, svg);
  const gUnits = el('g', { class: 'units' }, svg);
  const gLinks = el('g', { class: 'links' }, svg);
  const gLabels = el('g', { class: 'labels' }, svg);
  const gMarks = el('g', { class: 'marks' }, svg);

  for (const f of M.frames || []) el('rect', { x: f.x, y: f.y, width: f.w, height: f.h, rx: 6 }, gFrames);
  const paths = {};
  for (const id of R.ids) {
    paths[id] = el('path', { d: M.shapes[id].d, 'data-id': id, class: 'unit' }, gUnits);
  }
  const labels = {};
  let tapCb = null;

  // ── 視角 ──
  const full = { x: 0, y: 0, w: M.width, h: M.height };
  let vb = { ...full };
  // 地圖座標每單位等於幾個螢幕像素的倒數；標籤與 Komugi 用它換算，縮放時保持固定的螢幕大小
  let unitPx = 1;
  function apply() {
    svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    const r = svg.getBoundingClientRect();
    unitPx = r.width ? Math.max(vb.w / r.width, vb.h / r.height) : vb.w / 600;
    gLabels.setAttribute('font-size', (11.5 * unitPx).toFixed(2));
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
    const b = f ? { width: f.w, height: f.h } : paths[id].getBBox();
    if (b.width) boxes[id] = b; // 畫面還藏著時 getBBox 是 0，不要記下來
    return b;
  }
  new ResizeObserver(apply).observe(svg);
  function clamp() {
    vb.w = Math.max(full.w / 8, Math.min(full.w * 1.2, vb.w));
    vb.h = vb.w * full.h / full.w;
    vb.x = Math.max(-vb.w * 0.5, Math.min(full.w - vb.w * 0.5, vb.x));
    vb.y = Math.max(-vb.h * 0.5, Math.min(full.h - vb.h * 0.5, vb.y));
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
  function reset() { vb = { ...full }; apply(); }
  function focus(ids, pad = 1.6) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const id of ids) {
      const b = paths[id].getBBox();
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
    }
    const w = Math.max((x1 - x0) * pad, (y1 - y0) * pad * full.w / full.h, full.w / 6);
    vb.w = w; vb.h = w * full.h / full.w;
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
      if (moved > 8) {
        const r = svg.getBoundingClientRect(), k = Math.max(vb.w / r.width, vb.h / r.height);
        vb.x -= dx * k; vb.y -= dy * k; clamp(); apply();
      }
    } else if (pts.size === 2 && pinch0) {
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
      const id = hit?.getAttribute?.('data-id');
      if (id && tapCb) tapCb(id);
    }
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, e.clientX, e.clientY); }, { passive: false });
  container.querySelector('.zoom')?.addEventListener('click', e => {
    const z = e.target.closest('button')?.dataset.z;
    if (z === 'in') zoomAt(1.5); else if (z === 'out') zoomAt(1 / 1.5); else if (z === 'reset') reset();
  });

  // ── 外觀 ──
  function paint(fn) { for (const id of R.ids) paths[id].style.fill = fn(id) || ''; }
  function mark(id, cls, on = true) { paths[id]?.classList.toggle(cls, on); }
  function clearMarks(...cls) { for (const p of Object.values(paths)) p.classList.remove(...cls); }
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
    showLinks, marker, clearMarkers, path, focus, reset, zoomAt,
    destroy() { svg.remove(); },
  };
}
