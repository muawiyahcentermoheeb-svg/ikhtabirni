// ============================================================
//  اختبرني — الرابط الرئيسي  |  يوحّد الشاشات + الرجوع خطوةً خطوة
//  ملاحظة: لا نعتمد على history API — الرجوع عبر السهم يقرأ الحالة
//  مباشرةً (أدقّ في التطبيق المثبّت الذي لا شريط تنقّل فيه).
// ============================================================
import * as db from './db.js';
import { parseFile } from './importer.js';
import * as teacher from './teacher.js';
import { enterStudent, showGamesMenu, showStudentSetup } from './student.js';

const $ = (id) => document.getElementById(id);
const importScreen = $('importScreen'), homeScreen = $('homeScreen'),
      teacherScreen = $('teacherScreen'), studentScreen = $('studentScreen');
const fileInput = $('fileInput'), prog = $('importProgress'),
      progMsg = $('importMsg'), errBox = $('importError'), backBtn = $('backBtn');

let current = 'home'; // import | home | teacher-settings | teacher-question | student

/* ---------- شاشة الترحيب ٣ ثوانٍ ---------- */
function hideSplash() {
  const sp = $('splashOverlay'); if (!sp) return;
  sp.classList.add('hide');
  setTimeout(() => sp.remove(), 700);
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

/* ---------- عامل الخدمة ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
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
  if (name === 'student') await enterStudent();

  backBtn.hidden = (name === 'home' || name === 'import');
}

/* ---------- الرجوع خطوةً خطوة (السهم في الهيدر) ---------- */
backBtn.addEventListener('click', () => {
  if (current === 'student') {
    // داخل الطالب: لعب → قائمة → إعداد → رئيسية
    if (!$('gameArea').hidden)      { showGamesMenu();      return; }
    if (!$('gamesMenu').hidden)     { showStudentSetup();   return; }
    showScreen('home');             // نحن في شاشة «حدّد حفظك»
    return;
  }
  if (current === 'teacher-question') { showScreen('teacher-settings'); return; }
  if (current === 'teacher-settings') { showScreen('home');             return; }
});

/* ---------- الرئيسية ---------- */
function renderHome(stats) {
  const d = stats.difficulty;
  const cells = [['الآيات', stats.verseCount], ['السور', stats.surahCount], ['الأجزاء', stats.juzCount],
                 ['سهل', d.سهل], ['متوسط', d.متوسط], ['صعب', d.صعب]];
  $('statsGrid').innerHTML = cells.map(([l, n]) =>
    `<div class="stat"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('');
}

/* ---------- الاستيراد ---------- */
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0]; if (!file) return;
  errBox.hidden = true; prog.hidden = false; progMsg.textContent = 'جارٍ قراءة الملف…';
  try {
    const { verses, surahs, stats } = await parseFile(file);
    progMsg.textContent = `جارٍ حفظ ${verses.length} آية محلياً…`;
    await db.saveAll(verses, surahs, stats);
    prog.hidden = true;
    renderHome(stats);
    showScreen('home');
  } catch (err) {
    prog.hidden = true; errBox.hidden = false;
    errBox.textContent = 'خطأ: ' + (err?.message || err);
  } finally { fileInput.value = ''; }
});
$('reimportBtn').addEventListener('click', async () => {
  if (!confirm('سيُمسح ما حُفظ محلياً وتعود لشاشة تحميل الملف. متابعة؟')) return;
  await db.clearAll();
  showScreen('import');
});

/* ---------- التثبيت كتطبيق مستقل ---------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); deferredPrompt = e; $('installBtn').hidden = false;
});
$('installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') $('installBtn').hidden = true;
  deferredPrompt = null;
});

/* ---------- التنقّل من البطاقتين ---------- */
document.querySelectorAll('.feature-card').forEach((c) => c.addEventListener('click', () => {
  if (c.disabled) return;
  showScreen(c.dataset.go === 'teacher' ? 'teacher-settings' : 'student');
}));

/* ---------- منطق المعلم ---------- */
function readSettings() {
  const rangeType = $('rangeType').value;
  const from = rangeType === 'surah' ? parseInt($('fromSurah').value)
             : rangeType === 'juz'   ? parseInt($('fromJuz').value)
             : parseInt($('singleSurahSelect').value);
  const to   = rangeType === 'surah' ? parseInt($('toSurah').value)
             : rangeType === 'juz'   ? parseInt($('toJuz').value) : from;
  return {
    rangeType, from, to,
    size: parseInt(document.querySelector('.chip.active[data-size]')?.dataset.size || '7'),
    difficultyMethod: $('difficultyMethod').value,
    difficultyLevel: document.querySelector('.chip.active[data-level]')?.dataset.level || 'سهل',
  };
}
$('generateBtn').addEventListener('click', async () => {
  const settings = readSettings();
  try {
    const verses = await teacher.generateQuestion(settings);
    teacher.displayQuestion(verses);
    teacher.saveSettings(settings);
    showScreen('teacher-question');
  } catch (err) { alert(err.message); }
});
$('changeSettingsBtn').addEventListener('click', () => showScreen('teacher-settings'));
$('changeQuestionBtn').addEventListener('click', async () => {
  const s = teacher.loadSettings(); if (!s) return;
  try { teacher.displayQuestion(await teacher.generateQuestion(s)); teacher.showQuestion(); }
  catch (e) { alert(e.message); }
});

/* ---------- الشرائح + نوع النطاق (ربط عام واحد) ---------- */
document.querySelectorAll('.chip').forEach((chip) => chip.addEventListener('click', () => {
  chip.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
  chip.classList.add('active');
}));
$('rangeType').addEventListener('change', (e) => teacher.toggleRange(e.target.value));

/* ---------- البدء ---------- */
(async () => {
  if (await db.isReady()) {
    const stats = await db.getStats();
    if (stats) { renderHome(stats); current = 'home'; backBtn.hidden = true; }
    else { current = 'import'; backBtn.hidden = true; }
  } else {
    current = 'import'; backBtn.hidden = true;
  }
  setTimeout(hideSplash, 3000);
})();
