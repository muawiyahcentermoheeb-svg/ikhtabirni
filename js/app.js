// ============================================================
//  اختبرني — الرابط الرئيسي  |  بدءٌ حصينٌ لا يعلّق ولا يُفرغ
//  • الشعار يزول حين يصبح التطبيق جاهزاً فقط (لا مؤقّت أعمى)
//  • زر «دخول» احتياطي + بطاقة خطأ = لا تعليق أبداً
//  • يقرأ data/quran.json المضمّن إن وُجد (اكتفاء ذاتي)
//  • وحدة الطالب تُحمّل عند الحاجة فقط
// ============================================================
import * as db from './db.js';
import { parseFile, loadEmbedded, downloadJSON } from './importer.js';
import * as teacher from './teacher.js';

const $ = (id) => document.getElementById(id);
const importScreen = $('importScreen'), homeScreen = $('homeScreen'),
      teacherScreen = $('teacherScreen'), studentScreen = $('studentScreen');
const fileInput = $('fileInput'), prog = $('importProgress'),
      progMsg = $('importMsg'), errBox = $('importError'), backBtn = $('backBtn');

let current = 'home';

/* ---------- أدوات مساعدة ---------- */
function withTimeout(promise, ms, fallback) {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(fallback); } }, ms);
    promise.then((v) => { if (!done) { done = true; clearTimeout(t); resolve(v); } },
                 () => { if (!done) { done = true; clearTimeout(t); resolve(fallback); } });
  });
}

/* ---------- شاشة الترحيب: إخفاءٌ مرتبطٌ بالحالة ---------- */
function splashStillThere() { const s = $('splashOverlay'); return !!s && !s.classList.contains('hide'); }
function hideSplash() {
  const sp = $('splashOverlay'); if (!sp || sp.classList.contains('hide')) return;
  sp.classList.add('hide');
  setTimeout(() => { try { sp.remove(); } catch (e) {} }, 700);
}
// إن ظهرت شاشةٌ فعلية خلف الشعار ⇒ الشعار يجب أن يزول فوراً
function ensureSplashGone() {
  const anyVisible = !importScreen.hidden || !homeScreen.hidden || !teacherScreen.hidden || !studentScreen.hidden;
  if (anyVisible && splashStillThere()) hideSplash();
}
// شبكة أمان: فحصٌ دوريٌّ قصير (لا يعتمد على حدث load الذي قد لا يُطلق بعد «فرض الإيقاف»)
const splashWatch = setInterval(ensureSplashGone, 250);
setTimeout(() => clearInterval(splashWatch), 20000);

// زر «دخول» احتياطي يُحقن داخل الشعار — طوق النجاة النهائي
function injectSplashFallback() {
  const s = $('splashOverlay'); if (!s || s.querySelector('#splashEnter')) return;
  const b = document.createElement('button');
  b.id = 'splashEnter';
  b.textContent = 'دخول';
  b.style.cssText = 'margin-top:1.4rem;opacity:0;transition:opacity .5s;background:linear-gradient(180deg,#d4af37,#b8902a);color:#1a1305;border:none;padding:.6rem 1.7rem;border-radius:12px;font-weight:800;font-family:inherit;cursor:pointer;pointer-events:none;box-shadow:0 8px 22px rgba(212,175,55,.3)';
  b.onclick = () => {
    const anyVisible = !importScreen.hidden || !homeScreen.hidden || !teacherScreen.hidden || !studentScreen.hidden;
    if (!anyVisible) { importScreen.hidden = false; current = 'import'; backBtn.hidden = true; } // لا فراغ أبداً
    const sp = $('splashOverlay'); if (sp) { sp.classList.add('hide'); setTimeout(() => { try { sp.remove(); } catch (e) {} }, 300); }
  };
  s.appendChild(b);
  setTimeout(() => { if (splashStillThere()) { b.style.opacity = '1'; b.style.pointerEvents = 'auto'; } }, 4000);
}
injectSplashFallback();

/* ---------- بطاقة خطأ مرئية (بديل الفراغ الصامت) ---------- */
function fatal(msg) {
  hideSplash();
  let box = $('bootError');
  if (!box) {
    box = document.createElement('div');
    box.id = 'bootError';
    box.style.cssText = 'position:fixed;inset:0;z-index:300;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.9rem;padding:1.6rem;background:radial-gradient(circle at 50% 40%,#0c1320,#05080d 75%);color:#e9e6dc;font-family:Cairo,system-ui,sans-serif;text-align:center';
    box.innerHTML =
      '<div style="font-size:2.6rem;filter:drop-shadow(0 0 16px rgba(212,175,55,.4))">⚠️</div>' +
      '<h2 style="color:#d4af37;font-family:Amiri,serif;font-size:1.45rem;margin:0">تعذّر بدء التطبيق</h2>' +
      '<p id="bootMsg" style="color:#9fc4b8;max-width:36ch;line-height:1.9;font-size:.92rem"></p>' +
      '<button id="bootRetry" style="margin-top:.4rem;background:linear-gradient(180deg,#d4af37,#b8902a);color:#1a1305;border:none;padding:.75rem 1.5rem;border-radius:12px;font-weight:800;font-family:inherit;cursor:pointer">إعادة المحاولة</button>' +
      '<p style="color:#5d6b7a;font-size:.72rem;max-width:42ch;line-height:1.7">إن تكرر: افتح التطبيق وأنت متصل بالإنترنت مرةً واحدة ليُخزَّن كل شيء، ثم أعد التشغيل.</p>';
    document.body.appendChild(box);
    box.querySelector('#bootRetry').onclick = () => location.reload();
  }
  const m = box.querySelector('#bootMsg'); if (m) m.textContent = String(msg || '');
  box.style.display = 'flex';
}

/* ---------- toast تحديث عامل الخدمة ---------- */
function showUpdateToast() {
  if ($('updateToast')) return;
  const t = document.createElement('div');
  t.id = 'updateToast';
  t.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:250;background:#131b27;border:1px solid rgba(212,175,55,.45);color:#e9e6dc;padding:.7rem 1rem;border-radius:12px;display:flex;gap:.8rem;align-items:center;box-shadow:0 14px 34px rgba(0,0,0,.5);font-family:Cairo,system-ui,sans-serif;font-size:.85rem;max-width:92%';
  t.innerHTML = '<span>يتوفر إصدار أحدث</span><button id="updNow" style="background:linear-gradient(180deg,#d4af37,#b8902a);color:#1a1305;border:none;padding:.4rem .9rem;border-radius:8px;font-weight:800;cursor:pointer;font-family:inherit">تحديث</button>';
  document.body.appendChild(t);
  t.querySelector('#updNow').onclick = () => {
    try { navigator.serviceWorker.controller && navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
    t.remove();
  };
}

/* ---------- شارة الاتصال ---------- */
function paintNet() {
  const b = $('netBadge'), on = navigator.onLine;
  b.textContent = on ? '● متصل' : '● غير متصل';
  b.className = 'net-badge ' + (on ? 'on' : 'off');
}
window.addEventListener('online', paintNet);
window.addEventListener('offline', paintNet);
paintNet();

/* ---------- عامل الخدمة + التحديث ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      setInterval(() => { reg.update().catch(() => {}); }, 60 * 60 * 1000);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing; if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateToast();
        });
      });
    }).catch(() => {});
  });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    if (sessionStorage.getItem('ikht_sw_reloaded')) { sessionStorage.removeItem('ikht_sw_reloaded'); return; }
    reloading = true; sessionStorage.setItem('ikht_sw_reloaded', '1');
    setTimeout(() => location.reload(), 350);
  });
}

/* ---------- وحدة الطالب: تحميل كسول ---------- */
let studentMod = null;
async function loadStudent() {
  if (studentMod) return studentMod;
  studentMod = await import('./student.js');
  return studentMod;
}

/* ---------- إدارة الشاشات ---------- */
async function showScreen(name) {
  current = name;
  importScreen.hidden  = name !== 'import';
  homeScreen.hidden    = name !== 'home';
  teacherScreen.hidden = !(name === 'teacher-settings' || name === 'teacher-question');
  studentScreen.hidden = name !== 'student';

  if (name === 'teacher-settings' || name === 'teacher-question') {
    await teacher.ensureReady();
    if (name === 'teacher-question') teacher.showQuestion(); else teacher.showSettings();
  }
  if (name === 'student') {
    try { const m = await loadStudent(); await m.enterStudent(); }
    catch (e) { studentScreen.hidden = true; homeScreen.hidden = false; current = 'home'; alert('تعذّر تحميل مسابقات الطالب: ' + (e && e.message ? e.message : e)); }
  }
  backBtn.hidden = (name === 'home' || name === 'import');
  ensureSplashGone();
}

/* ---------- الرجوع خطوةً خطوة ---------- */
backBtn.addEventListener('click', async () => {
  if (current === 'student') {
    try {
      const m = await loadStudent();
      const setup = $('studentSetup'), menu = $('gamesMenu');
      if (setup && !setup.hidden) { showScreen('home'); return; }
      if (menu && !menu.hidden) { m.showStudentSetup(); return; }
      m.showGamesMenu(); return;
    } catch (e) { showScreen('home'); return; }
  }
  if (current === 'teacher-question') { showScreen('teacher-settings'); return; }
  if (current === 'teacher-settings') { showScreen('home'); return; }
});

/* ---------- الرئيسية ---------- */
function renderHome(stats) {
  const d = stats.difficulty || {};
  const cells = [['الآيات', stats.verseCount], ['السور', stats.surahCount], ['الأجزاء', stats.juzCount],
                 ['سهل', d['سهل'] || 0], ['متوسط', d['متوسط'] || 0], ['صعب', d['صعب'] || 0]];
  $('statsGrid').innerHTML = cells.map(([l, n]) =>
    `<div class="stat"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('');
}

/* ---------- تصدير البيانات لتضمينها (تسافر مع التطبيق) ---------- */
async function exportData() {
  const btn = $('exportBtn');
  try {
    const verses = await db.getAllVerses();
    const surahs = await db.getSurahsByReverse();
    const stats = await db.getStats();
    if (!verses || !verses.length) { alert('لا توجد بيانات محفوظة للتصدير بعد.'); return; }
    downloadJSON({ verses, surahs, stats }, 'quran.json');
    if (btn) { const old = btn.textContent; btn.textContent = '✅ تم تنزيل quran.json'; btn.disabled = true; setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 2600); }
  } catch (e) { alert('تعذّر التصدير: ' + (e && e.message ? e.message : e)); }
}
const exportBtnEl = $('exportBtn'); if (exportBtnEl) exportBtnEl.addEventListener('click', exportData);

/* ---------- الاستيراد من الإكسل ---------- */
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0]; if (!file) return;
  errBox.hidden = true; prog.hidden = false; progMsg.textContent = 'جارٍ قراءة الملف…';
  try {
    const { verses, surahs, stats } = await parseFile(file);
    progMsg.textContent = `جارٍ حفظ ${verses.length} آية محلياً…`;
    await db.saveAll(verses, surahs, stats);
    prog.hidden = true; renderHome(stats); showScreen('home');
  } catch (err) { prog.hidden = true; errBox.hidden = false; errBox.textContent = 'خطأ: ' + (err && err.message ? err.message : err); }
  finally { fileInput.value = ''; }
});
$('reimportBtn').addEventListener('click', async () => {
  if (!confirm('سيُمسح ما حُفظ محلياً وتعود لشاشة تحميل الملف. متابعة؟')) return;
  await db.clearAll(); showScreen('import');
});

/* ---------- التثبيت ---------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('installBtn').hidden = false; });
$('installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  try { const { outcome } = await deferredPrompt.userChoice; if (outcome === 'accepted') $('installBtn').hidden = true; } catch (e) {}
  deferredPrompt = null;
});

/* ---------- البطاقتان ---------- */
document.querySelectorAll('.feature-card').forEach((c) => c.addEventListener('click', () => {
  if (c.disabled) return;
  showScreen(c.dataset.go === 'teacher' ? 'teacher-settings' : 'student');
}));

/* ---------- منطق المعلم ---------- */
function readSettings() {
  const rangeType = $('rangeType').value;
  const from = rangeType === 'surah' ? parseInt($('fromSurah').value) : rangeType === 'juz' ? parseInt($('fromJuz').value) : parseInt($('singleSurahSelect').value);
  const to = rangeType === 'surah' ? parseInt($('toSurah').value) : rangeType === 'juz' ? parseInt($('toJuz').value) : from;
  const sizeChip = document.querySelector('.chip.active[data-size]');
  const lvlChip = document.querySelector('.chip.active[data-level]');
  return {
    rangeType, from, to,
    size: sizeChip ? parseInt(sizeChip.dataset.size) : 7,
    difficultyMethod: $('difficultyMethod').value,
    difficultyLevel: lvlChip ? lvlChip.dataset.level : 'سهل',
  };
}
$('generateBtn').addEventListener('click', async () => {
  const settings = readSettings();
  try { const verses = await teacher.generateQuestion(settings); teacher.displayQuestion(verses); teacher.saveSettings(settings); showScreen('teacher-question'); }
  catch (err) { alert(err && err.message ? err.message : err); }
});
$('changeSettingsBtn').addEventListener('click', () => showScreen('teacher-settings'));
$('changeQuestionBtn').addEventListener('click', async () => {
  const s = teacher.loadSettings(); if (!s) return;
  try { teacher.displayQuestion(await teacher.generateQuestion(s)); teacher.showQuestion(); }
  catch (e) { alert(e && e.message ? e.message : e); }
});

/* ---------- الشرائح + نوع النطاق ---------- */
document.querySelectorAll('.chip').forEach((chip) => chip.addEventListener('click', () => {
  chip.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.remove('active')); chip.classList.add('active');
}));
$('rangeType').addEventListener('change', (e) => teacher.toggleRange(e.target.value));

/* ---------- البدء الحصين ---------- */
(async () => {
  try {
    let stats = null;
    if (await db.isReady()) {
      stats = await db.getStats();                 // جلسة سابقة محفوظة
    } else {
      // لا قاعدة محفوظة ⇒ جرّب البيانات المضمّنة قبل أن تطلب الإكسل
      const embedded = await withTimeout(loadEmbedded(), 4000, null);
      if (embedded) {
        await db.saveAll(embedded.verses, embedded.surahs, embedded.stats);
        stats = embedded.stats;
      }
    }
    if (stats) { renderHome(stats); current = 'home'; }
    else { current = 'import'; }

    importScreen.hidden  = current !== 'import';
    homeScreen.hidden    = current !== 'home';
    teacherScreen.hidden = true; studentScreen.hidden = true; backBtn.hidden = true;
    hideSplash();        // التطبيق جاهز لعرض شاشة ⇒ الشعار يزول الآن (لا قبله)
  } catch (e) {
    fatal(e && e.message ? e.message : String(e));
  }
})();
