import * as db from './db.js';
import { parseFile } from './importer.js';

const $ = (id) => document.getElementById(id);
const importScreen = $('importScreen'), homeScreen = $('homeScreen');
const fileInput = $('fileInput'), prog = $('importProgress'), progMsg = $('importMsg'), errBox = $('importError');

/* شارة الاتصال */
function paintNet() {
  const b = $('netBadge');
  const on = navigator.onLine;
  b.textContent = on ? '● متصل' : '● غير متصل';
  b.className = 'net-badge ' + (on ? 'on' : 'off');
}
window.addEventListener('online', paintNet);
window.addEventListener('offline', paintNet);
paintNet();

/* عامل الخدمة */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

/* عرض الإحصاء بعد النجاح */
function renderHome(stats) {
  const g = $('statsGrid');
  const d = stats.difficulty;
  const cells = [
    ['الآيات', stats.verseCount],
    ['السور', stats.surahCount],
    ['الأجزاء', stats.juzCount],
    ['سهل', d.سهل],
    ['متوسط', d.متوسط],
    ['صعب', d.صعب],
  ];
  g.innerHTML = cells.map(([l, n]) => `<div class="stat"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('');

  const sl = $('sampleList');
  sl.innerHTML = ['سهل', 'متوسط', 'صعب'].map((lvl) => {
    const s = stats.samples?.[lvl];
    if (!s) return `<div class="sample lvl-${lvl}">لا توجد عينة لمستوى «${lvl}».</div>`;
    return `<div class="sample lvl-${lvl}">${escapeHtml(s.text)}
      <span class="meta">${lvl} · ${s.surahName} · صفحة ${s.page} · جزء معكوس ${s.juzReverse}</span></div>`;
  }).join('');

  if (stats.warnings?.length) {
    g.insertAdjacentHTML('beforeend',
      `<div class="stat warn" style="grid-column:1/-1"><div class="n">⚠</div><div class="l">${escapeHtml(stats.warnings.join(' — '))}</div></div>`);
  }
  importScreen.hidden = true;
  homeScreen.hidden = false;
}

function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* الاستيراد */
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  errBox.hidden = true; prog.hidden = false; progMsg.textContent = 'جارٍ قراءة الملف…';
  try {
    progMsg.textContent = 'جارٍ تحليل الآيات واشتقاق الأجزاء…';
    const { verses, surahs, stats } = await parseFile(file);
    progMsg.textContent = `جارٍ حفظ ${verses.length} آية محلياً…`;
    await db.saveAll(verses, surahs, stats);
    prog.hidden = true;
    renderHome(stats);
  } catch (err) {
    prog.hidden = true;
    errBox.hidden = false;
    errBox.textContent = 'خطأ: ' + (err?.message || err);
  } finally {
    fileInput.value = '';
  }
});

/* إعادة الاستيراد */
$('reimportBtn').addEventListener('click', async () => {
  if (!confirm('سيُمسح ما حُفظ محلياً وتعود لشاشة تحميل الملف. متابعة؟')) return;
  await db.clearAll();
  homeScreen.hidden = true;
  importScreen.hidden = false;
});

/* بطاقات الميزات (المعلم = الخطوة التالية) */
document.querySelectorAll('.feature-card').forEach((c) => {
  c.addEventListener('click', () => {
    if (c.disabled) return;
    alert('شاشة «' + c.dataset.go + '» تُبنى في الخطوة التالية فوق هذا الأساس الجاهز.');
  });
});

/* البدء */
(async () => {
  if (await db.isReady()) {
    const stats = await db.getStats();
    if (stats) { renderHome(stats); return; }
  }
  importScreen.hidden = false;
})();
