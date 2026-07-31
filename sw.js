/* عامل الخدمة — غيّر VER مع كل نشر ليصل التحديث */
const VER = 'ikhtabirni-v3';
const CORE = `${VER}-core`;
const CDN  = `${VER}-cdn`;
const FONT = `${VER}-font`;

const PRECACHE = [
  './','./index.html','./manifest.webmanifest','./css/style.css',
  './js/app.js','./js/db.js','./js/importer.js','./js/teacher.js','./js/student.js','./js/constants.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CORE).then((c) => c.addAll(PRECACHE))
      .then(() => caches.open(CORE).then((c) => c.add('./assets/logo.png').catch(() => {})))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => ![CORE,CDN,FONT].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'cdn.jsdelivr.net') { e.respondWith(cacheFirst(req, CDN)); return; }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') { e.respondWith(cacheFirst(req, FONT)); return; }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(CORE).then((c) => c.put(req, cp)); return r; })
      .catch(() => caches.match(req).then((h) => h || caches.match('./index.html'))));
    return;
  }
  e.respondWith(staleWhileRevalidate(req, CORE));
});

async function cacheFirst(req, name) {
  const hit = await caches.match(req);
  const net = fetch(req).then((r) => { if (r && r.ok) { const cp = r.clone(); caches.open(name).then((c) => c.put(req, cp)); } return r; }).catch(() => hit);
  return hit || net;
}
async function staleWhileRevalidate(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  const net = fetch(req).then((r) => { if (r && r.ok) cache.put(req, r.clone()); return r; }).catch(() => hit);
  return hit || net;
}
