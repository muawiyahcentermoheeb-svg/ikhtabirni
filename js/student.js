// ============================================================
//  اختبرني — للطالب  |  الألعاب الخمس + نطاق الحفظ + التحفيز
//  كل الأحداث الداخلية مربوطة هنا. app.js يستدعي enterStudent() فقط.
// ============================================================
import * as db from './db.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shuffle = (a) => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[x[i], x[j]] = [x[j], x[i]]; } return x; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const wordsOf = (t) => t.split(/\s+/).filter(Boolean);

const AUDIO = (n) => `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${n}.mp3`;

// ---------- الحالة ----------
let pool = [];                 // الآيات المتاحة حسب نطاق الطالب
let allSurahNames = [];        // كل أسماء السور (للعبة "إيه السورة دي")
let currentGame = 'complete';
let current = null;            // بيانات السؤال الحالي
let audio = null;
let progress = { score: 0, streak: 0, best: 0 };

const GAMES = {
  complete: 'كمّل الآية',
  order: 'رتّب الكلمات',
  hidden: 'خمّن الكلمة المخفية',
  surah: 'إيه السورة دي؟',
  listen: 'استمع وميّز',
};

// ---------- إظهار المناطق الثلاث ----------
function showView(name) {
  $('studentSetup').hidden = name !== 'setup';
  $('gamesMenu').hidden = name !== 'menu';
  $('gameArea').hidden = name !== 'play';
}

// ---------- التقدّم ----------
function loadProgress() {
  try { const r = JSON.parse(localStorage.getItem('ikhtabirni_progress') || '{}'); progress = { score: r.score || 0, streak: r.streak || 0, best: r.best || 0 }; }
  catch { progress = { score: 0, streak: 0, best: 0 }; }
}
function saveProgress() { localStorage.setItem('ikhtabirni_progress', JSON.stringify(progress)); }
function paintScore() { $('scoreDisplay').textContent = `النقاط: ${progress.score}`; $('streakDisplay').textContent = `متتالية: ${progress.streak} 🔥`; }

function reward(ok) {
  if (ok) { progress.score += 10; progress.streak++; progress.best = Math.max(progress.best, progress.streak); }
  else { progress.streak = 0; }
  saveProgress(); paintScore();
}

// ---------- الدخول لشاشة الطالب ----------
export async function enterStudent() {
  loadProgress(); paintScore();
  const surahs = await db.getSurahsByReverse();
  allSurahNames = surahs.map((s) => s.name);
  const opts = surahs.map((s) => `<option value="${s.revOrder}">${s.name}</option>`).join('');
  $('studentFromSurah').innerHTML = opts;
  $('studentToSurah').innerHTML = opts;
  $('studentSingleSelect').innerHTML = opts;
  $('studentFromJuz').innerHTML = Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}">جزء ${i + 1}</option>`).join('');
  $('studentToJuz').innerHTML = $('studentFromJuz').innerHTML;
  showView('setup');
}

export function toggleStudentRange(val) {
  $('studentSurahRange').hidden = val !== 'surah';
  $('studentJuzRange').hidden = val !== 'juz';
  $('studentSingleSurah').hidden = val !== 'single';
}

// ---------- بناء النطاق ثم عرض قائمة الألعاب ----------
export async function startStudent() {
  const type = $('studentRangeType').value;
  let verses = [];
  if (type === 'surah') verses = await db.getVersesBySurahRange(parseInt($('studentFromSurah').value), parseInt($('studentToSurah').value));
  else if (type === 'juz') verses = await db.getVersesByJuzRange(parseInt($('studentFromJuz').value), parseInt($('studentToJuz').value));
  else if (type === 'single') verses = await db.getVersesBySurah(parseInt($('studentSingleSelect').value));
  else verses = await db.getAllVerses();

  const lvl = document.querySelector('.chip.active[data-slevel]')?.dataset.slevel || 'الكل';
  if (lvl !== 'الكل') verses = verses.filter((v) => v.difficulty === lvl);

  if (!verses.length) { alert('لا توجد آيات في هذا النطاق/المستوى. وسّع النطاق أو غيّر المستوى.'); return; }
  pool = verses;
  showView('menu');
}

export function showGamesMenu() { stopAudio(); showView('menu'); }
export function showStudentSetup() { stopAudio(); showView('setup'); }

// ---------- تشغيل لعبة ----------
export function pickGame(key) {
  currentGame = key;
  $('gameTitle').textContent = GAMES[key] || 'لعبة';
  showView('play');
  nextQuestion();
}

export function nextQuestion() {
  stopAudio();
  $('resultMsg').hidden = true;
  $('optionsGrid').innerHTML = '';
  $('answerZone').innerHTML = ''; $('answerZone').hidden = true;
  $('wordsZone').innerHTML = ''; $('wordsZone').hidden = true;
  $('audioWrap').hidden = true;
  $('studentSurahHint').textContent = '';
  $('studentQuestionText').textContent = '';

  if (currentGame === 'complete') buildComplete();
  else if (currentGame === 'order') buildOrder();
  else if (currentGame === 'hidden') buildHidden();
  else if (currentGame === 'surah') buildSurah();
  else if (currentGame === 'listen') buildListen();
}

// ---------- النتيجة ----------
function finish(ok, correctText) {
  reward(ok);
  const msg = $('resultMsg'); msg.hidden = false;
  if (ok) { msg.textContent = pick(['✅ أحسنت!', '✅ بارك الله فيك', '✅ ممتاز!', '✅ ما شاء الله']); msg.className = 'result-msg success'; }
  else { msg.textContent = '❌ الصواب: ' + correctText; msg.className = 'result-msg error'; }
  document.querySelectorAll('.option-btn').forEach((b) => (b.disabled = true));
}

function optionButtons(choices, onPick) {
  const grid = $('optionsGrid'); grid.innerHTML = '';
  choices.forEach((c) => {
    const b = document.createElement('button');
    b.className = 'option-btn'; b.textContent = c.text;
    b.onclick = () => onPick(c, b);
    grid.appendChild(b);
  });
}

// ============================================================
//  ١) كمّل الآية
// ============================================================
function buildComplete() {
  const v = pick(pool);
  const w = wordsOf(v.text);
  if (w.length < 3) return nextQuestion();
  const split = Math.max(1, Math.floor(w.length * 0.6));
  const head = w.slice(0, split).join(' ');
  const tail = w.slice(split).join(' ');
  $('studentSurahHint').textContent = `سورة ${v.surahName}`;
  $('studentQuestionText').textContent = head + ' …';

  const wrongs = shuffle(pool.filter((x) => x.origOrder !== v.origOrder)).slice(0, 3)
    .map((x) => { const ww = wordsOf(x.text); const s = Math.max(1, Math.floor(ww.length * 0.6)); return ww.slice(s).join(' '); })
    .filter((t) => t && t !== tail);
  while (wrongs.length < 3) wrongs.push('…');
  optionButtons(shuffle([{ text: tail, ok: true }, ...wrongs.slice(0, 3).map((t) => ({ text: t, ok: false }))]),
    (c, b) => {
      if (c.ok) { b.classList.add('correct'); finish(true, tail); }
      else { b.classList.add('wrong'); document.querySelectorAll('.option-btn').forEach((x) => { if (x.textContent === tail) x.classList.add('correct'); }); finish(false, tail); }
    });
}

// ============================================================
//  ٢) رتّب الكلمات  (نقر ينقل ↔ منطقة الإجابة)
// ============================================================
function buildOrder() {
  const v = pick(pool);
  const correct = wordsOf(v.text);
  if (correct.length < 2) return nextQuestion();
  $('studentSurahHint').textContent = `سورة ${v.surahName} — رتّب بالضغط`;
  $('studentQuestionText').textContent = 'اضغط الكلمات بالترتيب الصحيح:';
  $('answerZone').hidden = false; $('wordsZone').hidden = false;
  const placed = [];

  const render = () => {
    const az = $('answerZone'); az.innerHTML = '';
    placed.forEach((word, i) => {
      const c = document.createElement('button'); c.className = 'word-chip placed'; c.textContent = word;
      c.onclick = () => { placed.splice(i, 1); render(); };
      az.appendChild(c);
    });
    const wz = $('wordsZone'); wz.innerHTML = '';
    const remaining = correct.map((w, i) => ({ w, i })).filter((o) => !placed.includes(o.i));
    shuffle(remaining).forEach((o) => {
      const c = document.createElement('button'); c.className = 'word-chip'; c.textContent = correct[o.i];
      c.onclick = () => { placed.push(o.i); render(); check(); };
      wz.appendChild(c);
    });
  };

  const check = () => {
    if (placed.length < correct.length) return;
    const ok = placed.every((idx, i) => idx === i);
    const az = $('answerZone');
    if (ok) { az.style.borderColor = 'var(--green)'; reward(true); const m = $('resultMsg'); m.hidden = false; m.textContent = pick(['✅ أحسنت!', '✅ ترتيب صحيح!']); m.className = 'result-msg success'; setTimeout(nextQuestion, 1400); }
    else { az.style.borderColor = 'var(--coral)'; const m = $('resultMsg'); m.hidden = false; m.textContent = '❌ الترتيب غير صحيح، حاول مجدداً'; m.className = 'result-msg error'; reward(false); setTimeout(() => { placed.length = 0; az.style.borderColor = ''; m.hidden = true; render(); }, 1300); }
  };
  render();
}

// ============================================================
//  ٣) خمّن الكلمة المخفية
// ============================================================
function buildHidden() {
  const v = pick(pool);
  const w = wordsOf(v.text);
  const candidates = w.map((x, i) => ({ x, i })).filter((o) => o.x.replace(/[^\u0600-\u06FF]/g, '').length >= 4);
  if (!candidates.length) return nextQuestion();
  const hidden = pick(candidates);
  const masked = w.map((x, i) => (i === hidden.i ? '▢▢' : x)).join(' ');
  $('studentSurahHint').textContent = `سورة ${v.surahName}`;
  $('studentQuestionText').innerHTML = `<span style="font-family:var(--serif)">${esc(masked)}</span>`;

  const wrongs = shuffle(pool.filter((x) => x.origOrder !== v.origOrder))
    .flatMap((x) => wordsOf(x.text)).filter((t) => t.replace(/[^\u0600-\u06FF]/g, '').length >= 4 && t !== hidden.x);
  const uniq = [...new Set(wrongs)].slice(0, 3);
  while (uniq.length < 3) uniq.push(pick(allSurahNames));
  optionButtons(shuffle([{ text: hidden.x, ok: true }, ...uniq.map((t) => ({ text: t, ok: false }))]),
    (c, b) => {
      if (c.ok) { b.classList.add('correct'); $('studentQuestionText').innerHTML = `<span style="font-family:var(--serif)">${esc(w.map((x, i) => i === hidden.i ? `<b style="color:var(--gold)">${esc(x)}</b>` : esc(x)).join(' '))}</span>`; finish(true, hidden.x); }
      else { b.classList.add('wrong'); document.querySelectorAll('.option-btn').forEach((x) => { if (x.textContent === hidden.x) x.classList.add('correct'); }); finish(false, hidden.x); }
    });
}

// ============================================================
//  ٤) إيه السورة دي؟
// ============================================================
function buildSurah() {
  const v = pick(pool);
  const short = wordsOf(v.text).slice(0, Math.min(8, wordsOf(v.text).length)).join(' ');
  $('studentQuestionText').innerHTML = `<span style="font-family:var(--serif)">${esc(short)} …</span>`;
  const wrongs = shuffle(allSurahNames.filter((n) => n !== v.surahName)).slice(0, 3);
  optionButtons(shuffle([{ text: v.surahName, ok: true }, ...wrongs.map((n) => ({ text: n, ok: false }))]),
    (c, b) => {
      if (c.ok) { b.classList.add('correct'); finish(true, v.surahName); }
      else { b.classList.add('wrong'); document.querySelectorAll('.option-btn').forEach((x) => { if (x.textContent === v.surahName) x.classList.add('correct'); }); finish(false, v.surahName); }
    });
}

// ============================================================
//  ٥) استمع وميّز  (صوت من CDN — يحتاج إنترنت أول مرة)
// ============================================================
function buildListen() {
  const v = pick(pool);
  $('studentSurahHint').textContent = `سورة ${v.surahName} — استمع ثم اختر النص`;
  $('studentQuestionText').textContent = 'اضغط «استمع» ثم اختر الآية الصحيحة:';
  $('audioWrap').hidden = false;
  audio = new Audio(AUDIO(v.origOrder));
  audio.onerror = () => { $('studentQuestionText').textContent = 'تعذّر تحميل الصوت (يحتاج اتصالاً بالإنترنت أول مرة).'; };

  const wrongs = shuffle(pool.filter((x) => x.origOrder !== v.origOrder)).slice(0, 2);
  const choices = shuffle([{ text: v.text, ok: true }, ...wrongs.map((x) => ({ text: x.text, ok: false }))]);
  optionButtons(choices, (c, b) => {
    if (c.ok) { b.classList.add('correct'); finish(true, wordsOf(v.text).slice(0, 6).join(' ') + ' …'); }
    else { b.classList.add('wrong'); document.querySelectorAll('.option-btn').forEach((x) => { if (x.textContent === v.text) x.classList.add('correct'); }); finish(false, wordsOf(v.text).slice(0, 6).join(' ') + ' …'); }
  });
}

function stopAudio() { if (audio) { try { audio.pause(); audio.currentTime = 0; } catch {} audio = null; } }

// ============================================================
//  ربط أحداث أزرار الطالب (مرة واحدة عند تحميل الوحدة)
// ============================================================
$('studentRangeType').addEventListener('change', (e) => toggleStudentRange(e.target.value));
$('studentStartBtn').addEventListener('click', startStudent);
$('changeStudentRangeBtn').addEventListener('click', showStudentSetup);
$('gameMenuBtn').addEventListener('click', showGamesMenu);
$('gameNextBtn').addEventListener('click', nextQuestion);
$('audioBtn').addEventListener('click', () => { if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); } });
document.querySelectorAll('.game-pick').forEach((b) => b.addEventListener('click', () => pickGame(b.dataset.game)));
document.querySelectorAll('.chip[data-slevel]').forEach((c) => c.addEventListener('click', () => {
  document.querySelectorAll('.chip[data-slevel]').forEach((x) => x.classList.remove('active')); c.classList.add('active');
}));
