import * as db from './db.js';
const $ = (id) => document.getElementById(id);
let surahs = [], ready = false;

const LINES_PER_PAGE = 15;
const lineInPage = (ls) => ((ls - 1) % LINES_PER_PAGE) + 1;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export async function ensureReady() {
  if (!ready) {
    surahs = await db.getSurahsByReverse();
    populate();
    setupFiltering();
    applySaved();
    ready = true;
  }
}
function populate() {
  const opts = surahs.map(s => `<option value="${s.revOrder}">${s.name}</option>`).join('');
  $('fromSurah').innerHTML = opts; $('toSurah').innerHTML = opts; $('singleSurahSelect').innerHTML = opts;
  $('fromJuz').innerHTML = Array.from({length:30},(_,i)=>`<option value="${i+1}">جزء ${i+1}</option>`).join('');
  $('toJuz').innerHTML = $('fromJuz').innerHTML;
}
function setupFiltering() {
  $('fromSurah').addEventListener('change', () => {
    const v = parseInt($('fromSurah').value);
    $('toSurah').innerHTML = surahs.filter(s => s.revOrder >= v).map(s => `<option value="${s.revOrder}">${s.name}</option>`).join('');
  });
  $('fromJuz').addEventListener('change', () => {
    const v = parseInt($('fromJuz').value);
    $('toJuz').innerHTML = Array.from({length:30-v+1},(_,i)=>`<option value="${v+i}">جزء ${v+i}</option>`).join('');
  });
}
function applySaved() {
  const s = loadSettings(); if (!s) return;
  if (s.rangeType) { $('rangeType').value = s.rangeType; toggleRange(s.rangeType); }
  if (s.difficultyMethod) $('difficultyMethod').value = s.difficultyMethod;
  document.querySelectorAll('.chip[data-size]').forEach(c => c.classList.toggle('active', parseInt(c.dataset.size)===(s.size||7)));
  document.querySelectorAll('.chip[data-level]').forEach(c => c.classList.toggle('active', c.dataset.level===(s.difficultyLevel||'سهل')));
}
export function toggleRange(val) {
  $('surahRange').hidden = val !== 'surah';
  $('juzRange').hidden = val !== 'juz';
  $('singleSurah').hidden = val !== 'single';
}

// بناء مقطع متتالٍ في نفس السورة بعدد أسطر ≈ size
function buildSegment(arr, anchorIdx, size) {
  const anchor = arr[anchorIdx];
  const start = anchor.lineStart;
  const out = [anchor];
  for (let k = anchorIdx + 1; k < arr.length; k++) {
    const v = arr[k];
    if (v.surahOrigNumber !== anchor.surahOrigNumber) break;       // قاعدة سورة واحدة
    if (v.lineStart - start >= size) break;                         // اكتمل الحجم بالأسطر
    out.push(v);
  }
  return out;
}

export async function generateQuestion(settings) {
  const { rangeType, from, to, size, difficultyMethod, difficultyLevel } = settings;
  let all = [];
  if (rangeType === 'surah') all = await db.getVersesBySurahRange(from, to);
  else if (rangeType === 'juz') all = await db.getVersesByJuzRange(from, to);
  else all = await db.getVersesBySurah(from);
  if (!all.length) throw new Error('لا توجد آيات في النطاق المحدد.');

  // منع "صعب" إن كان النطاق كله داخل جزء عمّ
  if (difficultyLevel === 'صعب' && all.every(v => v.juzReverse === 1))
    throw new Error('مستوى «صعب» غير متاح في جزء عمّ.');

  // نقاط البداية الصالحة حسب المستوى
  let candidates;
  if (difficultyMethod === 'file') {
    candidates = all.filter(v => v.difficulty === difficultyLevel);
  } else {
    if (difficultyLevel === 'سهل') candidates = all.filter(v => lineInPage(v.lineStart) <= 5);
    else if (difficultyLevel === 'متوسط') candidates = all.filter(v => { const p = lineInPage(v.lineStart); return p >= 6 && p <= 12; });
    else candidates = all.filter(v => lineInPage(v.lineStart) >= 13); // آخر ٣ أسطر (الامتداد للصفحة/السورة التالية تضبطه قاعدة السورة الواحدة)
  }
  if (!candidates.length) throw new Error(`لا توجد نقطة بداية بمستوى «${difficultyLevel}» هنا. جرّب مستوى أو نطاقاً آخر.`);

  const anchor = candidates[Math.floor(Math.random() * candidates.length)];
  const anchorIdx = all.indexOf(anchor);
  return buildSegment(all, anchorIdx, size);
}

export function displayQuestion(verses) {
  if (!verses.length) { $('teacherQuestionText').innerHTML = 'لا توجد آيات مطابقة.'; $('teacherSurahName').textContent = ''; return; }
  const head = `${verses[0].surahName} · صفحة ${verses[0].page}`;
  const body = verses.map(v => esc(v.text)).join('<span class="ayah-sep">۝</span>');
  $('teacherSurahName').textContent = head;
  $('teacherQuestionText').innerHTML = `<div class="mushaf-page"><div class="mushaf-text">${body}</div></div>`;
}

export function saveSettings(s) { localStorage.setItem('teacherSettings', JSON.stringify(s)); }
export function loadSettings() { const r = localStorage.getItem('teacherSettings'); return r ? JSON.parse(r) : null; }
export function showSettings() { $('settingsPanel').hidden = false; $('questionPanel').hidden = true; }
export function showQuestion() { $('settingsPanel').hidden = true; $('questionPanel').hidden = false; }
