/* ?Ｙ?敹怠?嚗??典翰???舀?啜鈭雯??閮???VERSION嚗?敹怠???鋡急???*/
const VERSION = 'kmap-1.0.1';
const FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'data/japan-map.js', 'data/japan-info.js',
  'js/regions.js', 'js/store.js', 'js/audio.js', 'js/komugi.js', 'js/map.js', 'js/quiz.js', 'js/main.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  // cache: 'reload' 蝜??汗?函? HTTP 敹怠?嚗itHub Pages ??獢翰??10 ??
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
