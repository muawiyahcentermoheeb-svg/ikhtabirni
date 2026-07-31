const DB_NAME = 'ikhtabirni_db';
const DB_VER = 1;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('verses')) {
        db.createObjectStore('verses', { keyPath: 'origOrder' });
      }
      if (!db.objectStoreNames.contains('surahs')) {
        db.createObjectStore('surahs', { keyPath: 'origNumber' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, stores, mode = 'readwrite') { return db.transaction(stores, mode); }
function reqP(req) { return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }

export async function isReady() {
  try {
    const db = await open();
    const ready = await reqP(tx(db, ['meta'], 'readonly').objectStore('meta').get('ready'));
    const count = await reqP(tx(db, ['verses'], 'readonly').objectStore('verses').count());
    return ready?.value === true && count > 0;
  } catch { return false; }
}

export async function saveAll(verses, surahs, stats) {
  const db = await open();
  const t = tx(db, ['verses', 'surahs', 'meta']);
  t.objectStore('verses').clear();
  t.objectStore('surahs').clear();
  verses.forEach((v) => t.objectStore('verses').put(v));
  surahs.forEach((s) => t.objectStore('surahs').put(s));
  t.objectStore('meta').put({ key: 'stats', value: stats });
  t.objectStore('meta').put({ key: 'ready', value: true });
  return new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}

export async function getStats() {
  const db = await open();
  const r = await reqP(tx(db, ['meta'], 'readonly').objectStore('meta').get('stats'));
  return r?.value || null;
}

export async function getSurahsByReverse() {
  const db = await open();
  const all = await reqP(tx(db, ['surahs'], 'readonly').objectStore('surahs').getAll());
  return all.sort((a, b) => a.revOrder - b.revOrder);
}

export async function clearAll() {
  const db = await open();
  const t = tx(db, ['verses', 'surahs', 'meta']);
  t.objectStore('verses').clear();
  t.objectStore('surahs').clear();
  t.objectStore('meta').put({ key: 'ready', value: false });
  return new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}

// جلب جميع الآيات
export async function getAllVerses() {
  const db = await open();
  return await reqP(tx(db, ['verses'], 'readonly').objectStore('verses').getAll());
}

// جلب الآيات حسب نطاق السور (بالترتيب المعكوس)
export async function getVersesBySurahRange(fromRev, toRev) {
  const all = await getAllVerses();
  return all.filter(v => v.surahRevOrder >= fromRev && v.surahRevOrder <= toRev);
}

// جلب الآيات حسب نطاق الأجزاء (بالترتيب المعكوس)
export async function getVersesByJuzRange(fromRev, toRev) {
  const all = await getAllVerses();
  return all.filter(v => v.juzReverse >= fromRev && v.juzReverse <= toRev);
}

// جلب آيات سورة واحدة
export async function getVersesBySurah(surahRevOrder) {
  const all = await getAllVerses();
  return all.filter(v => v.surahRevOrder === surahRevOrder);
}
