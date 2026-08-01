// ============================================================
//  اختبرني — للطالب  |  مسابقات تنافسية + بطاقات مراجعة بالكشف
//  • كيس دون تكرار: لا يُعاد سؤال حتى تُستنفد آيات النطاق
//  • بطاقات المراجعة: إجابة مخفية تنكشف بالنقر + تقييم ذاتي
//  • أعداد الآيات وأسماء الأجزاء مشتقة من بياناتك (لا من الذاكرة)
// ============================================================
import * as db from './db.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shuffle = (a) => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[x[i], x[j]] = [x[j], x[i]]; } return x; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const wordsOf = (t) => t.split(/\s+/).filter(Boolean);
const hasLongWord = (v) => wordsOf(v.text).some((w) => w.replace(/[^\u0600-\u06FF]/g, '').length >= 4);
const AUDIO = (n) => `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${n}.mp3`;

// أسماء الأجزاء المتداولة (المطبوعة على هوامش مصحف المدينة) — الجزء ١ بلا اسم لفظي
const JUZ_NAMES = [null, null, 'سيقول', 'تلك الرسل', 'لن تنالوا', 'والمحصنات', 'لا يحب الله', 'وإذا سمعوا', 'ولو أننا', 'قال الملأ', 'واعلموا', 'يعتذرون', 'وما من دابة', 'وما أبرئ', 'ربما', 'سبحان الذي', 'قال ألم', 'اقترب', 'قد أفلح', 'وقال الذين', 'أمن خلق', 'اتل ما أوحي', 'ومن يقنت', 'وما لي', 'فمن أظلم', 'إليه يرد', 'حم', 'قال فما خطبكم', 'قد سمع', 'تبارك', 'عمّ'];

const GAMES = {
  complete: 'كمّل الآية', order: 'رتّب الكلمات', hidden: 'خمّن الكلمة المخفية', surah: 'أيُّ سورةٍ هذه؟', listen: 'استمع وميّز',
  'r-surah': 'مراجعة · من أيِّ سورة؟', 'r-juz': 'مراجعة · في أيِّ جزءٍ تقع؟', 'r-count': 'مراجعة · كم عدد آياتها؟',
  'r-next': 'مراجعة · ما الآية التي تليها؟', 'r-prev': 'مراجعة · ما الآية التي قبلها؟', 'r-review': 'مراجعة · راجِع الحفظ',
};

// ---------- الحالة ----------
let pool = [], allSurahNames = [], currentGame = 'complete', audio = null;
let progress = { score: 0, streak: 0, best: 0 };
const bags = {};
let allVersesCache = null, byOrig = new Map(), surahFullMap = new Map();
let revealEls = null;

// ---------- كيس دون تكرار (للآيات) ----------
function refillBag(key, filterFn) { let arr = pool.slice(); if (filterFn) arr = arr.filter(filterFn); bags[key] = shuffle(arr).map((v) => v.origOrder); }
function drawVerse(key, filterFn) {
  if (!bags[key] || !bags[key].length) refillBag(key, filterFn);
  if (!bags[key] || !bags[key].length) return null;
  const orig = bags[key].pop();
  return pool.find((v) => v.origOrder === orig) || null;
}
// كيس على مستوى السور الممثلة في النطاق
function drawSurahFromPool(key) {
  if (!bags[key] || !bags[key].length) {
    const seen = new Map(); pool.forEach((v) => { if (!seen.has(v.surahOrigNumber)) seen.set(v.surahOrigNumber, v.surahName); });
    bags[key] = shuffle([...seen.entries()].map(([num, name]) => ({ num, name })));
  }
  const item = bags[key].pop(); if (!item) return null;
  const full = surahFullMap.get(item.num);
  return { name: item.name, origNumber: item.num, verseCount: full ? full.verseCount : null };
}

// ---------- المناطق ----------
function showView(name) { $('studentSetup').hidden = name !== 'setup'; $('gamesMenu').hidden = name !== 'menu'; $('gameArea').hidden = name !== 'play'; }
function resetPlayArea() {
  const og = $('optionsGrid'); if (og) { og.innerHTML = ''; og.style.display = ''; }
  const az = $('answerZone'); if (az) { az.innerHTML = ''; az.hidden = true; az.style.borderColor = ''; }
  const wz = $('wordsZone'); if (wz) { wz.innerHTML = ''; wz.hidden = true; }
  const aw = $('audioWrap'); if (aw) aw.hidden = true;
  const rm = $('resultMsg'); if (rm) { rm.hidden = true; rm.textContent = ''; }
  $('studentSurahHint').textContent = ''; $('studentQuestionText').textContent = '';
  if (revealEls) revealEls.wrap.hidden = true;
}
function noContent() { resetPlayArea(); $('studentQuestionText').textContent = 'لا توجد آيات مطابقة لهذه البطاقة في النطاق المختار. وسِّع النطاق أو اختر «الكل».'; }

// ---------- التقدّم ----------
function loadProgress() { try { const r = JSON.parse(localStorage.getItem('ikhtabirni_progress') || '{}'); progress = { score: r.score || 0, streak: r.streak || 0, best: r.best || 0 }; } catch { progress = { score: 0, streak: 0, best: 0 }; } }
function saveProgress() { localStorage.setItem('ikhtabirni_progress', JSON.stringify(progress)); }
function paintScore() { $('scoreDisplay').textContent = `النقاط: ${progress.score}`; $('streakDisplay').textContent = `متتالية: ${progress.streak} 🔥`; }
function reward(ok) { if (ok) { progress.score += 10; progress.streak++; progress.best = Math.max(progress.best, progress.streak); } else { progress.streak = 0; } saveProgress(); paintScore(); }

// ---------- أنماط الكشف (تُحقن مرة واحدة) ----------
function injectRevealStyles() {
  if ($('revealStyles')) return;
  const s = document.createElement('style'); s.id = 'revealStyles';
  s.textContent =
    '.menu-section{font-family:var(--serif);color:var(--gold);font-size:.95rem;font-weight:700;margin:1.1rem 0 .5rem;padding-bottom:.3rem;border-bottom:1px solid var(--line)}' +
    '.menu-section:first-child{margin-top:0}.reveal-pick{border-inline-start-color:var(--green)!important}' +
    '.reveal-q{font-family:var(--serif);font-size:clamp(1.3rem,5.4vw,1.9rem);line-height:2.3;text-align:center;color:#f3ead2;background:linear-gradient(180deg,rgba(212,175,55,.05),rgba(59,130,246,.04));border:1px solid var(--gold-soft);border-radius:12px;padding:1.2rem 1rem;margin:.4rem 0 1rem}' +
    '.reveal-toggle{margin:.2rem 0}' +
    '.reveal-answer{max-height:0;opacity:0;overflow:hidden;transition:max-height .55s cubic-bezier(.2,.9,.3,1),opacity .4s ease,padding .4s ease;padding:0 1rem;border-radius:12px;background:rgba(46,204,113,.06);border:1px solid transparent}' +
    '.reveal-answer.show{max-height:70vh;opacity:1;padding:1.1rem 1rem;border-color:var(--green-soft)}' +
    '.reveal-ans-inner{font-family:var(--serif);font-size:clamp(1.15rem,4.8vw,1.6rem);line-height:2.2;text-align:center;color:var(--green)}' +
    '.reveal-self{display:flex;gap:.7rem;margin-top:1rem}.reveal-self .btn-secondary{flex:1}';
  document.head.appendChild(s);
}

// ---------- بناء عناصر الكشف ديناميكياً ----------
function ensureRevealDOM() {
  if (revealEls) return;
  const wrap = document.createElement('div'); wrap.id = 'revealWrap'; wrap.hidden = true;
  wrap.innerHTML =
    '<div id="revealQuestion" class="reveal-q"></div>' +
    '<button id="revealToggle" class="btn-primary reveal-toggle">👁 أظهر الإجابة</button>' +
    '<div id="revealAnswer" class="reveal-answer"></div>' +
    '<div id="revealSelf" class="reveal-self" hidden>' +
    '<button id="selfKnow" class="btn-secondary">✅ عرفتها</button>' +
    '<button id="selfReview" class="btn-secondary">🔁 أراجعها</button></div>';
  const ga = $('gameArea'), rm = $('resultMsg');
  if (rm) ga.insertBefore(wrap, rm); else ga.appendChild(wrap);
  revealEls = {
    wrap, question: wrap.querySelector('#revealQuestion'), toggle: wrap.querySelector('#revealToggle'),
    answer: wrap.querySelector('#revealAnswer'), self: wrap.querySelector('#revealSelf'),
    know: wrap.querySelector('#selfKnow'), review: wrap.querySelector('#selfReview'),
  };
  injectRevealStyles();
  revealEls.toggle.addEventListener('click', () => {
    const shown = !revealEls.answer.classList.contains('show');
    revealEls.answer.classList.toggle('show', shown);
    revealEls.toggle.textContent = shown ? '🙈 أخفِ الإجابة' : '👁 أظهر الإجابة';
    if (shown) revealEls.self.hidden = false;
  });
  revealEls.know.addEventListener('click', () => { reward(true); const m = $('resultMsg'); m.hidden = false; m.textContent = '✅ أحسنت، أتقنتها'; m.className = 'result-msg success'; setTimeout(nextQuestion, 900); });
  revealEls.review.addEventListener('click', () => { const m = $('resultMsg'); m.hidden = false; m.textContent = '🔁 لا بأس، ستُعاد عليك بهدوء'; m.className = 'result-msg'; setTimeout(nextQuestion, 900); });
}
function buildReveal(hint, qHTML, aHTML) {
  ensureRevealDOM(); resetPlayArea();
  revealEls.wrap.hidden = false;
  $('studentSurahHint').textContent = hint || '';
  revealEls.question.innerHTML = qHTML;
  revealEls.answer.innerHTML = '<div class="reveal-ans-inner">' + aHTML + '</div>';
  revealEls.answer.classList.remove('show');
  revealEls.toggle.textContent = '👁 أظهر الإجابة';
  revealEls.self.hidden = true;
}

// ---------- تعزيز قائمة الألعاب (عناوين + بطاقات مراجعة) ----------
function augmentGamesMenu() {
  const menu = $('gamesMenu'); if (!menu || menu.dataset.augmented) return; menu.dataset.augmented = '1';
  const list = menu.querySelector('.games-menu'); if (!list) return;
  const firstPick = list.querySelector('.game-pick');
  const h1 = document.createElement('div'); h1.className = 'menu-section'; h1.textContent = 'مسابقات تنافسية';
  if (firstPick) list.insertBefore(h1, firstPick);
  const sb = list.querySelector('[data-game="surah"] .gp-t'); if (sb) sb.textContent = 'أيُّ سورةٍ هذه؟';
  const sd = list.querySelector('[data-game="surah"] .gp-d'); if (sd) sd.textContent = 'اعرف السورة من مقطع قصير';
  const h2 = document.createElement('div'); h2.className = 'menu-section'; h2.textContent = 'بطاقات مراجعة — الإجابة مخفية';
  list.appendChild(h2);
  [['r-surah', 'من أيِّ سورةٍ هذه الآية؟', 'تذكَّر السورة من مقطع'], ['r-juz', 'في أيِّ جزءٍ تقع؟', 'استظهر رقم الجزء'],
   ['r-count', 'كم عدد آياتها؟', 'تذكَّر عدد آيات السورة'], ['r-next', 'ما الآية التي تليها؟', 'استحضر الآية التالية'],
   ['r-prev', 'ما الآية التي قبلها؟', 'استحضر الآية السابقة'], ['r-review', 'راجِع الحفظ', 'قارِن بدايتك بالآية كاملة']
  ].forEach(([k, t, d]) => {
    const b = document.createElement('button'); b.className = 'game-pick reveal-pick'; b.dataset.game = k;
    b.innerHTML = '<span class="gp-t">' + t + '</span><span class="gp-d">' + d + '</span>';
    b.addEventListener('click', () => pickGame(k)); list.appendChild(b);
  });
}

// ---------- الدخول ----------
export async function enterStudent() {
  loadProgress(); paintScore();
  const surahs = await db.getSurahsByReverse();
  surahFullMap = new Map(); surahs.forEach((s) => surahFullMap.set(s.origNumber, s));
  allSurahNames = surahs.map((s) => s.name);
  const opts = surahs.map((s) => `<option value="${s.revOrder}">${s.name}</option>`).join('');
  $('studentFromSurah').innerHTML = opts; $('studentToSurah').innerHTML = opts; $('studentSingleSelect').innerHTML = opts;
  $('studentFromJuz').innerHTML = Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}">جزء ${i + 1}</option>`).join('');
  $('studentToJuz').innerHTML = $('studentFromJuz').innerHTML;
  augmentGamesMenu();
  showView('setup');
}
export function toggleStudentRange(val) { $('studentSurahRange').hidden = val !== 'surah'; $('studentJuzRange').hidden = val !== 'juz'; $('studentSingleSurah').hidden = val !== 'single'; }

// ---------- بناء النطاق ----------
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
  Object.keys(bags).forEach((k) => delete bags[k]);
  if (!allVersesCache) { allVersesCache = await db.getAllVerses(); byOrig = new Map(); allVersesCache.forEach((v) => byOrig.set(v.origOrder, v)); }
  showView('menu');
}
export function showGamesMenu() { stopAudio(); augmentGamesMenu(); showView('menu'); }
export function showStudentSetup() { stopAudio(); showView('setup'); }

// ---------- تشغيل ----------
export function pickGame(key) { currentGame = key; $('gameTitle').textContent = GAMES[key] || 'مسابقة'; showView('play'); nextQuestion(); }
export function nextQuestion() {
  stopAudio(); resetPlayArea();
  if (currentGame.startsWith('r-')) { buildRevealByKind(currentGame); return; }
  if (currentGame === 'complete') buildComplete();
  else if (currentGame === 'order') buildOrder();
  else if (currentGame === 'hidden') buildHidden();
  else if (currentGame === 'surah') buildSurah();
  else if (currentGame === 'listen') buildListen();
}

// ---------- النتيجة (تنافسي) ----------
function finish(ok, correctText) {
  reward(ok);
  const msg = $('resultMsg'); msg.hidden = false;
  if (ok) { msg.textContent = pick(['✅ أحسنت!', '✅ بارك الله فيك', '✅ ممتاز!', '✅ ما شاء الله']); msg.className = 'result-msg success'; }
  else { msg.textContent = '❌ الصواب: ' + correctText; msg.className = 'result-msg error'; }
  document.querySelectorAll('.option-btn').forEach((b) => (b.disabled = true));
}
function optionButtons(choices, onPick) {
  const grid = $('optionsGrid'); grid.innerHTML = '';
  choices.forEach((c) => { const b = document.createElement('button'); b.className = 'option-btn'; b.textContent = c.text; b.onclick = () => onPick(c, b); grid.appendChild(b); });
}

// ============================================================ بطاقات المراجعة
function buildRevealByKind(kind) {
  if (kind === 'r-surah') {
    const v = drawVerse('r-surah', (vv) => wordsOf(vv.text).length >= 4); if (!v) { noContent(); return; }
    const short = wordsOf(v.text).slice(0, Math.min(7, wordsOf(v.text).length)).join(' ');
    buildReveal('', `<span style="font-family:var(--serif)">${esc(short)} …</span>`, 'سورة ' + esc(v.surahName));
  } else if (kind === 'r-juz') {
    const v = drawVerse('r-juz', null); if (!v) { noContent(); return; }
    const nm = JUZ_NAMES[v.juzOriginal];
    buildReveal('', `<span style="font-family:var(--serif)">${esc(v.text)}</span>`, 'الجزء ' + v.juzOriginal + (nm ? ' · ' + esc(nm) : '') + ' · سورة ' + esc(v.surahName));
  } else if (kind === 'r-count') {
    const s = drawSurahFromPool('r-count'); if (!s) { noContent(); return; }
    buildReveal('', 'كم عدد آيات سورة <b style="color:var(--gold)">' + esc(s.name) + '</b> ؟', (s.verseCount != null ? s.verseCount + ' آية' : 'غير متوفر'));
  } else if (kind === 'r-next') {
    const v = drawVerse('r-next', null); if (!v) { noContent(); return; }
    const nx = byOrig.get(v.origOrder + 1);
    const ans = (nx && nx.surahOrigNumber === v.surahOrigNumber) ? esc(nx.text) : 'هذه آخر آية في سورتها — ليست لها آية تالية.';
    buildReveal('سورة ' + esc(v.surahName), `<span style="font-family:var(--serif)">${esc(v.text)}</span>`, ans);
  } else if (kind === 'r-prev') {
    const v = drawVerse('r-prev', null); if (!v) { noContent(); return; }
    const pv = byOrig.get(v.origOrder - 1);
    const ans = (pv && pv.surahOrigNumber === v.surahOrigNumber) ? esc(pv.text) : 'هذه أول آية في سورتها — ليست لها آية سابقة.';
    buildReveal('سورة ' + esc(v.surahName), `<span style="font-family:var(--serif)">${esc(v.text)}</span>`, ans);
  } else if (kind === 'r-review') {
    const v = drawVerse('r-review', (vv) => wordsOf(vv.text).length >= 4); if (!v) { noContent(); return; }
    const head = wordsOf(v.text).slice(0, 4).join(' ');
    buildReveal('سورة ' + esc(v.surahName), `<span style="font-family:var(--serif)">${esc(head)} …</span>`, esc(v.text));
  }
}

// ============================================================ ١) كمّل الآية
function buildComplete() {
  const v = drawVerse('complete', (vv) => wordsOf(vv.text).length >= 3); if (!v) { noContent(); return; }
  const w = wordsOf(v.text); const split = Math.max(1, Math.floor(w.length * 0.6));
  const head = w.slice(0, split).join(' '), tail = w.slice(split).join(' ');
  $('studentSurahHint').textContent = `سورة ${v.surahName}`; $('studentQuestionText').textContent = head + ' …';
  const wrongs = [...new Set(shuffle(pool.filter((x) => x.origOrder !== v.origOrder)).slice(0, 6)
    .map((x) => { const ww = wordsOf(x.text); const s = Math.max(1, Math.floor(ww.length * 0.6)); return ww.slice(s).join(' '); })
    .filter((t) => t && t !== tail))].slice(0, 3);
  while (wrongs.length < 3) wrongs.push('…');
  optionButtons(shuffle([{ text: tail, ok: true }, ...wrongs.map((t) => ({ text: t, ok: false }))]), (c, b) => {
    if (c.ok) { b.classList.add('correct'); finish(true, tail); }
    else { b.classList.add('wrong'); document.querySelectorAll('.option-btn').forEach((x) => { if (x.textContent === tail) x.classList.add('correct'); }); finish(false, tail); }
  });
}
// ============================================================ ٢) رتّب الكلمات
function buildOrder() {
  const v = drawVerse('order', (vv) => wordsOf(vv.text).length >= 2); if (!v) { noContent(); return; }
  const correct = wordsOf(v.text);
  $('studentSurahHint').textContent = `سورة ${v.surahName} — رتّب بالضغط`; $('studentQuestionText').textContent = 'اضغط الكلمات بالترتيب الصحيح:';
  $('answerZone').hidden = false; $('wordsZone').hidden = false;
  const placed = [];
  const render = () => {
    const az = $('answerZone'); az.innerHTML = '';
    placed.forEach((word, i) => { const c = document.createElement('button'); c.className = 'word-chip placed'; c.textContent = word; c.onclick = () => { placed.splice(i, 1); render(); }; az.appendChild(c); });
    const wz = $('wordsZone'); wz.innerHTML = '';
    shuffle(correct.map((w, i) => ({ w, i })).filter((o) => !placed.includes(o.i))).forEach((o) => {
      const c = document.createElement('button'); c.className = 'word-chip'; c.textContent = correct[o.i];
      c.onclick = () => { placed.push(o.i); render(); check(); }; wz.appendChild(c);
    });
  };
  const check = () => {
    if (placed.length < correct.length) return;
    const ok = placed.every((idx, i) => idx === i); const az = $('answerZone');
    if (ok) { az.style.borderColor = 'var(--green)'; reward(true); const m = $('resultMsg'); m.hidden = false; m.textContent = pick(['✅ أحسنت!', '✅ ترتيب صحيح!']); m.className = 'result-msg success'; setTimeout(nextQuestion, 1400); }
    else { az.style.borderColor = 'var(--coral)'; const m = $('resultMsg'); m.hidden = false; m.textContent = '❌ الترتيب غير صحيح، حاول مجدداً'; m.className = 'result-msg error'; reward(false); setTimeout(() => { placed.length = 0; az.style.borderColor = ''; m.hidden = true; render(); }, 1300); }
  };
  render();
}
// ============================================================ ٣) خمّن الكلمة المخفية
function buildHidden() {
  const v = drawVerse('hidden', hasLongWord); if (!v) { noContent(); return; }
  const w = wordsOf(v.text); const cand = w.map((x, i) => ({ x, i })).filter((o) => o.x.replace(/[^\u0600-\u06FF]/g, '').length >= 4);
  if (!cand.length) { noContent(); return; }
  const hidden = pick(cand); const masked = w.map((x, i) => (i === hidden.i ? '▢▢' : x)).join(' ');
  $('studentSurahHint').textContent = `سورة ${v.surahName}`; $('studentQuestionText').innerHTML = `<span style="font-family:var(--serif)">${esc(masked)}</span>`;
  const uniq = [...new Set(shuffle(pool.filter((x) => x.origOrder !== v.origOrder)).flatMap((x) => wordsOf(x.text)).filter((t) => t.replace(/[^\u0600-\u06FF]/g, '').length >= 4 && t !== hidden.x))].slice(0, 3);
  while (uniq.length < 3) uniq.push(pick(allSurahNames));
  optionButtons(shuffle([{ text: hidden.x, ok: true }, ...uniq.map((t) => ({ text: t, ok: false }))]), (c, b) => {
    if (c.ok) { b.classList.add('correct'); $('studentQuestionText').innerHTML = `<span style="font-family:var(--serif)">${esc(w.map((x, i) => i === hidden.i ? `<b style="color:var(--gold)">${esc(x)}</b>` : esc(x)).join(' '))}</span>`; finish(true, hidden.x); }
    else { b.classList.add('wrong'); document.querySelectorAll('.option-btn').forEach((x) => { if (x.textContent === hidden.x) x.classList.add('correct'); }); finish(false, hidden.x); }
  });
}
// ============================================================ ٤) أيُّ سورةٍ هذه؟ (تنافسي)
function buildSurah() {
  const v = drawVerse('surah', null); if (!v) { noContent(); return; }
  const short = wordsOf(v.text).slice(0, Math.min(8, wordsOf(v.text).length)).join(' ');
  $('studentQuestionText').innerHTML = `<span style="font-family:var(--serif)">${esc(short)} …</span>`;
  const wrongs = shuffle(allSurahNames.filter((n) => n !== v.surahName)).slice(0, 3);
  optionButtons(shuffle([{ text: v.surahName, ok: true }, ...wrongs.map((n) => ({ text: n, ok: false }))]), (c, b) => {
    if (c.ok) { b.classList.add('correct'); finish(true, v.surahName); }
    else { b.classList.add('wrong'); document.querySelectorAll('.option-btn').forEach((x) => { if (x.textContent === v.surahName) x.classList.add('correct'); }); finish(false, v.surahName); }
  });
}
// ============================================================ ٥) استمع وميّز
function buildListen() {
  const v = drawVerse('listen', null); if (!v) { noContent(); return; }
  $('studentSurahHint').textContent = `سورة ${v.surahName} — استمع ثم اختر النص`; $('studentQuestionText').textContent = 'اضغط «استمع» ثم اختر الآية الصحيحة:';
  $('audioWrap').hidden = false; audio = new Audio(AUDIO(v.origOrder));
  audio.onerror = () => { $('studentQuestionText').textContent = 'تعذّر تحميل الصوت (يحتاج اتصالاً بالإنترنت أول مرة).'; };
  const wrongs = shuffle(pool.filter((x) => x.origOrder !== v.origOrder)).slice(0, 2);
  optionButtons(shuffle([{ text: v.text, ok: true }, ...wrongs.map((x) => ({ text: x.text, ok: false }))]), (c, b) => {
    if (c.ok) { b.classList.add('correct'); finish(true, wordsOf(v.text).slice(0, 6).join(' ') + ' …'); }
    else { b.classList.add('wrong'); document.querySelectorAll('.option-btn').forEach((x) => { if (x.textContent === v.text) x.classList.add('correct'); }); finish(false, wordsOf(v.text).slice(0, 6).join(' ') + ' …'); }
  });
}
function stopAudio() { if (audio) { try { audio.pause(); audio.currentTime = 0; } catch {} audio = null; } }

// ============================================================ ربط الأحداث (بدفاع)
const _on = (id, ev, fn) => { const e = $(id); if (e) e.addEventListener(ev, fn); };
_on('studentRangeType', 'change', (e) => toggleStudentRange(e.target.value));
_on('studentStartBtn', 'click', startStudent);
_on('changeStudentRangeBtn', 'click', showStudentSetup);
_on('gameMenuBtn', 'click', showGamesMenu);
_on('gameNextBtn', 'click', nextQuestion);
_on('audioBtn', 'click', () => { if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); } });
document.querySelectorAll('.game-pick').forEach((b) => b.addEventListener('click', () => pickGame(b.dataset.game)));
document.querySelectorAll('.chip[data-slevel]').forEach((c) => c.addEventListener('click', () => { document.querySelectorAll('.chip[data-slevel]').forEach((x) => x.classList.remove('active')); c.classList.add('active'); }));
