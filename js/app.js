import * as db from './db.js';
import { parseFile } from './importer.js';
import * as teacher from './teacher.js';
import * as student from './student.js';

const $ = (id) => document.getElementById(id);
const importScreen=$('importScreen'), homeScreen=$('homeScreen'), teacherScreen=$('teacherScreen'), studentScreen=$('studentScreen');
const fileInput=$('fileInput'), prog=$('importProgress'), progMsg=$('importMsg'), errBox=$('importError'), backBtn=$('backBtn');
let current = 'home';

/* ---------- شاشة الترحيب ٣ ثوانٍ ---------- */
function hideSplash() {
  const sp = $('splashOverlay'); if (!sp) return;
  sp.classList.add('hide');
  setTimeout(() => sp.remove(), 700);
}

/* ---------- شارة الاتصال ---------- */
function paintNet() {
  const b=$('netBadge'), on=navigator.onLine;
  b.textContent = on ? '● متصل' : '● غير متصل';
  b.className = 'net-badge ' + (on ? 'on' : 'off');
}
window.addEventListener('online', paintNet); window.addEventListener('offline', paintNet); paintNet();

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(()=>{}));

/* ---------- إدارة الشاشات + الرجوع خطوةً خطوة ---------- */
async function showScreen(name, push = true) {
  current = name;
  importScreen.hidden = name !== 'import';
  homeScreen.hidden = name !== 'home';
  teacherScreen.hidden = !name.startsWith('teacher');
  studentScreen.hidden = name !== 'student';

  if (name.startsWith('teacher')) {
    await teacher.ensureReady();
    if (name.endsWith('question')) teacher.showQuestion(); else teacher.showSettings();
  }
  if (name === 'student') student.initGame();

  backBtn.hidden = (name === 'home' || name === 'import');
  if (push) history.pushState({ name }, '', '#' + name);
}
window.addEventListener('popstate', (e) => { showScreen(e.state?.name || 'home', false); });
backBtn.addEventListener('click', () => history.back());

/* ---------- الرئيسية ---------- */
function renderHome(stats) {
  const d = stats.difficulty;
  const cells = [['الآيات',stats.verseCount],['السور',stats.surahCount],['الأجزاء',stats.juzCount],['سهل',d.سهل],['متوسط',d.متوسط],['صعب',d.صعب]];
  $('statsGrid').innerHTML = cells.map(([l,n])=>`<div class="stat"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('');
  importScreen.hidden = true; homeScreen.hidden = false;
}

/* ---------- الاستيراد ---------- */
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0]; if (!file) return;
  errBox.hidden = true; prog.hidden = false; progMsg.textContent = 'جارٍ قراءة الملف…';
  try {
    const { verses, surahs, stats } = await parseFile(file);
    progMsg.textContent = `جارٍ حفظ ${verses.length} آية محلياً…`;
    await db.saveAll(verses, surahs, stats);
    prog.hidden = true; renderHome(stats); showScreen('home', false);
  } catch (err) { prog.hidden = true; errBox.hidden = false; errBox.textContent = 'خطأ: ' + (err?.message || err); }
  finally { fileInput.value = ''; }
});
$('reimportBtn').addEventListener('click', async () => {
  if (!confirm('سيُمسح ما حُفظ محلياً. متابعة؟')) return;
  await db.clearAll(); showScreen('import', false);
});

/* ---------- التثبيت كتطبيق ---------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('installBtn').hidden = false; });
$('installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') $('installBtn').hidden = true;
  deferredPrompt = null;
});

/* ---------- التنقل من البطاقات ---------- */
document.querySelectorAll('.feature-card').forEach((c) => c.addEventListener('click', () => {
  if (c.disabled) return;
  showScreen(c.dataset.go === 'teacher' ? 'teacher-settings' : 'student');
}));

/* ---------- منطق المعلم ---------- */
function readSettings() {
  const rangeType = $('rangeType').value;
  const from = rangeType==='surah'?parseInt($('fromSurah').value):rangeType==='juz'?parseInt($('fromJuz').value):parseInt($('singleSurahSelect').value);
  const to = rangeType==='surah'?parseInt($('toSurah').value):rangeType==='juz'?parseInt($('toJuz').value):from;
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
  try { teacher.displayQuestion(await teacher.generateQuestion(s)); teacher.showQuestion(); } catch (e) { alert(e.message); }
});

/* شرائح + نوع النطاق (مرة واحدة) */
document.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => {
  chip.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
}));
$('rangeType').addEventListener('change', (e) => teacher.toggleRange(e.target.value));

/* ---------- البدء ---------- */
(async () => {
  const ready = await db.isReady();
  const initial = ready ? 'home' : 'import';
  if (ready) { const st = await db.getStats(); if (st) renderHome(st); }
  history.replaceState({ name: initial }, '', '#' + initial);
  current = initial;
  backBtn.hidden = true;
  setTimeout(hideSplash, 3000);
})();
