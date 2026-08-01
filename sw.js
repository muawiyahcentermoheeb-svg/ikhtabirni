/* عامل الخدمة v6 — أوفلاين مطلق + تحديث قسري
   غيّر VER مع كل نشر ليصل التحديث للمستخدمين */
const VER = 'ikhtabirni-v6';
const CORE = VER + '-core', CDN = VER + '-cdn', FONT = VER + '-font';

const PRECACHE = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/app.js', './js/db.js', './js/importer.js',
  './js/teacher.js', './js/student.js', './js/constants.js',
  './assets/logo.png'
];

/* إضافة آمنة: ملفٌ فاشل لا يُسقط البقية (يحمي التثبيت) */
function addSafe(cache, urls) {
  return Promise.all(urls.map((u) => cache.add(u).catch(() => {})));
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CORE).then((c) => addSafe(c, PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(
      ks.filter((k) => ![CORE, CDN, FONT].includes(k)).map((k) => caches.delete(k))
    ))
    .then(() => self.clients.claim())
    .then(() => self.clients.matchAll().then((cs) =>
      cs.forEach((c) => { try { c.postMessage({ type: 'SW_ACTIVATED', ver: VER }); } catch (e) {} }))
    )
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);

  // مكتبة الإكسل من CDN
  if (u.hostname === 'cdn.jsdelivr.net') { e.respondWith(cacheFirst(r, CDN)); return; }
  // الخطوط
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') { e.respondWith(cacheFirst(r, FONT)); return; }
  // تنقّل الصفحات: الشبكة أولاً ثم النسخة المحلية
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r).then((x) => { const c = x.clone(); caches.open(CORE).then((cc) => cc.put('./index.html', c)); return x; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  // أصول نفس الأصل الثابتة: كاش أولاً = أوفلاين مطلق
  if (u.origin === self.location.origin) { e.respondWith(cacheFirst(r, CORE)); return; }
  // الباقي (تلاوات خارجية): شبكة ثم كاش
  e.respondWith(staleWhileRevalidate(r, CDN));
});

async function cacheFirst(r, name) {
  const hit = await caches.match(r);
  if (hit) return hit;
  try {
    const x = await fetch(r);
    if (x && x.ok) { const c = x.clone(); caches.open(name).then((cc) => cc.put(r, c)); }
    return x;
  } catch (e) { return hit || Response.error(); }
}
async function staleWhileRevalidate(r, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(r);
  const net = fetch(r).then((x) => { if (x && x.ok) cache.put(r, x.clone()); return x; }).catch(() => hit);
  return hit || net;
}
