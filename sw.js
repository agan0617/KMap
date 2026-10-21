/* 離線快取：先用快取、背景更新。版號在 js/version.js，改了網頁要記得加版號，舊快取才會被換掉 */
importScripts('js/version.js');
const VERSION = 'kmap-' + APP_VERSION;
const FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest', 'js/version.js',
  'data/japan-map.js', 'data/japan-info.js', 'data/japan-info.en.js', 'data/japan-info.ja.js',
  'js/store.js', 'js/i18n.js', 'js/regions.js', 'js/audio.js', 'js/komugi.js', 'js/map.js', 'js/quiz.js', 'js/main.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  // cache: 'reload' 繞過瀏覽器的 HTTP 快取，GitHub Pages 的檔案快取 10 分鐘
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
