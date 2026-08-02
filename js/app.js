// ============================================================
//  اختبرني — الرابط الرئيسي  |  بدءٌ حصينٌ لا يعلّق ولا يُفرغ
//  • الشعار يزول حين يصبح التطبيق جاهزاً فقط (لا مؤقّت أعمى)
//  • زر «دخول» احتياطي + بطاقة خطأ = لا تعليق أبداً
//  • يقرأ data/quran.json المضمّن إن وُجد (اكتفاء ذاتي)
//  • وحدة الطالب تُحمّل عند الحاجة فقط
//  ✦ الدفعة (أ١): نظام «النقاط» — نواة التحفيز
//      - العملة اسمها «نقطة»، وشكلها = شعار المركز دائرياً
//      - نقطة حضور يومية + سلسلة أيام حقيقية (تعمل فوراً)
//      - API عام (window.Ikhtabirni.addPoint) + حدث 'ikht:reward'
//        لوحدات أخرى (student.js في الدفعة أ٢) لتكسب النقاط
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

/* ============================================================
   ✦ نظام النقاط — التنسيقات (محجونة ذاتياً، لا تلمس style.css)
   ============================================================ */
(function injectRewardStyles() {
  if (document.getElementById('ikhtRewardStyles')) return;
  const st = document.createElement('style');
  st.id = 'ikhtRewardStyles';
  st.textContent = `
  /* ---- الزر العائم: شعار المركز دائرياً = العملة ---- */
  #ikhtFab{
    position:fixed; left:16px; bottom:18px; z-index:180;
    width:62px; height:62px; border-radius:50%; padding:0; cursor:pointer;
    border:2px solid rgba(212,175,55,.85);
    background:radial-gradient(circle at 50% 38%, #1a2433, #0a0f17 78%);
    box-shadow:0 10px 26px rgba(0,0,0,.55), 0 0 0 4px rgba(212,175,55,.10);
    display:flex; align-items:center; justify-content:center;
    transition:transform .18s ease, box-shadow .18s ease;
    -webkit-tap-highlight-color:transparent;
  }
  #ikhtFab:active{ transform:scale(.92); }
  #ikhtFab .coin{
    width:46px; height:46px; border-radius:50%; overflow:hidden;
    display:block; object-fit:cover; background:#0a0f17;
    box-shadow:inset 0 0 0 1px rgba(212,175,55,.5);
  }
  #ikhtFab::after{ /* هالة نابضة */
    content:''; position:absolute; inset:-2px; border-radius:50%;
    border:2px solid rgba(212,175,55,.55);
    animation:ikhtHalo 2.4s ease-out infinite; pointer-events:none;
  }
  @keyframes ikhtHalo{
    0%{ transform:scale(1); opacity:.7; }
    70%{ transform:scale(1.45); opacity:0; }
    100%{ transform:scale(1.45); opacity:0; }
  }
  #ikhtFab .fabPts{
    position:absolute; top:-6px; right:-6px; min-width:20px; height:20px;
    padding:0 5px; border-radius:10px; background:linear-gradient(180deg,#d4af37,#b8902a);
    color:#1a1305; font:800 11px/20px Cairo,system-ui,sans-serif; text-align:center;
    box-shadow:0 3px 8px rgba(0,0,0,.4);
  }

  /* ---- طبقة الإنجازات ---- */
  #achOverlay{
    position:fixed; inset:0; z-index:210; display:none;
    background:radial-gradient(circle at 50% 0%, #0c1320, #05080d 72%);
    color:#e9e6dc; font-family:Cairo,system-ui,sans-serif;
    overflow-y:auto; -webkit-overflow-scrolling:touch;
    animation:ikhtFade .35s ease;
  }
  #achOverlay.open{ display:block; }
  @keyframes ikhtFade{ from{opacity:0; transform:translateY(8px);} to{opacity:1; transform:none;} }

  /* نجوم ثمانية هندسية باهتة في الخلفية */
  .ach-stars{ position:fixed; inset:0; overflow:hidden; pointer-events:none; z-index:0; }
  .ach-star{ position:absolute; width:46px; height:46px; opacity:.06; animation:ikhtTw 5s ease-in-out infinite; }
  .ach-star::before, .ach-star::after{
    content:''; position:absolute; inset:0; border:2px solid #d4af37; border-radius:6px;
  }
  .ach-star::after{ transform:rotate(45deg); }
  @keyframes ikhtTw{ 0%,100%{opacity:.04; transform:scale(.9);} 50%{opacity:.12; transform:scale(1.05);} }

  .ach-wrap{ position:relative; z-index:1; max-width:520px; margin:0 auto; padding:18px 16px 40px; }
  .ach-top{ display:flex; align-items:center; justify-content:space-between; }
  .ach-title{ font-family:Amiri,serif; color:#d4af37; font-size:1.3rem; margin:0; }
  .ach-close{
    background:rgba(212,175,55,.12); border:1px solid rgba(212,175,55,.4); color:#d4af37;
    width:40px; height:40px; border-radius:50%; font-size:1.2rem; cursor:pointer; line-height:1;
  }

  /* بطاقة الرصيد: الشعار الدائري + الرقم الضخم */
  .ach-balance{
    margin:22px 0 18px; padding:22px 18px; border-radius:20px; text-align:center;
    background:linear-gradient(180deg, rgba(212,175,55,.10), rgba(212,175,55,.02));
    border:1px solid rgba(212,175,55,.35);
    box-shadow:0 16px 40px rgba(0,0,0,.45);
  }
  .ach-coin-lg{
    width:84px; height:84px; border-radius:50%; overflow:hidden; margin:0 auto 12px;
    border:3px solid #d4af37; box-shadow:0 0 22px rgba(212,175,55,.35), inset 0 0 0 2px rgba(255,255,255,.06);
    display:flex; align-items:center; justify-content:center; background:#0a0f17;
  }
  .ach-coin-lg img{ width:100%; height:100%; object-fit:cover; display:block; }
  .ach-num{
    font-family:Amiri,serif; font-weight:700; line-height:1;
    font-size:3.4rem; color:#f4d77a;
    text-shadow:0 0 22px rgba(212,175,55,.45);
  }
  .ach-numword{ color:#9fc4b8; font-size:.95rem; margin-top:4px; letter-spacing:.5px; }
  .ach-sub{ color:#7d8a98; font-size:.78rem; margin-top:10px; line-height:1.7; }

  .ach-grid{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .ach-card{
    background:rgba(255,255,255,.03); border:1px solid rgba(212,175,55,.22);
    border-radius:16px; padding:14px; text-align:center;
  }
  .ach-card h3{ margin:0 0 8px; font-size:.82rem; color:#c9b06a; font-weight:700; }

  /* حلقة السلسلة */
  .ring{ position:relative; width:96px; height:96px; margin:2px auto 6px; }
  .ring svg{ transform:rotate(-90deg); }
  .ring .rv{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .ring .rv b{ font-family:Amiri,serif; font-size:1.7rem; color:#f4d77a; line-height:1; }
  .ring .rv small{ color:#8a97a4; font-size:.62rem; margin-top:2px; }
  .ach-streak-goal{ color:#7d8a98; font-size:.7rem; }

  /* الشارات */
  .ach-badges{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .badge{ display:flex; flex-direction:column; align-items:center; gap:6px; opacity:.4; filter:grayscale(1) blur(.3px); transition:.4s; }
  .badge.on{ opacity:1; filter:none; }
  .badge .bd{
    width:50px; height:50px; border-radius:50%; display:flex; align-items:center; justify-content:center;
    border:2px solid rgba(212,175,55,.3); background:rgba(255,255,255,.03);
  }
  .badge.on .bd{ border-color:#d4af37; background:radial-gradient(circle at 50% 40%, rgba(212,175,55,.22), rgba(212,175,55,.04)); box-shadow:0 0 14px rgba(212,175,55,.3); }
  .badge .bn{ font-size:.7rem; color:#9aa6b2; line-height:1.3; }
  .badge.on .bn{ color:#e9e6dc; }

  /* إشعار الكسب */
  #ikhtToast{
    position:fixed; top:18px; left:50%; transform:translateX(-50%) translateY(-20px);
    z-index:320; display:flex; align-items:center; gap:10px;
    background:#131b27; border:1px solid rgba(212,175,55,.5); border-radius:14px;
    padding:8px 14px 8px 10px; box-shadow:0 14px 34px rgba(0,0,0,.55);
    opacity:0; pointer-events:none; transition:opacity .3s, transform .3s; max-width:90%;
  }
  #ikhtToast.show{ opacity:1; transform:translateX(-50%) translateY(0); }
  #ikhtToast .tc{ width:30px; height:30px; border-radius:50%; overflow:hidden; border:1.5px solid #d4af37; flex:0 0 auto; }
  #ikhtToast .tc img{ width:100%; height:100%; object-fit:cover; display:block; }
  #ikhtToast .tt{ color:#f4d77a; font:800 .9rem/1.3 Cairo,system-ui,sans-serif; }
  #ikhtToast .tr{ color:#9fc4b8; font-size:.74rem; }
  `;
  document.head.appendChild(st);
})();

/* ---- تخزين النقاط (يتعايش مع أي محتوى سابق في المفتاح) ---- */
const PROG_KEY = 'ikhtabirni_progress';
function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROG_KEY) || '{}');
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return Object.assign({ points: 0, streak: 0, lastActiveDate: '' }, raw);
    }
  } catch (e) {}
  return { points: 0, streak: 0, lastActiveDate: '' };
}
function saveProgress(p) {
  try { localStorage.setItem(PROG_KEY, JSON.stringify(p)); } catch (e) {}
}
function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function daysBetween(a, b) { // a,b بصيغة yyyy-mm-dd
  const da = new Date(a + 'T00:00:00'), db2 = new Date(b + 'T00:00:00');
  return Math.round((db2 - da) / 86400000);
}
/* قاعدة لغوية مطابقة للعدد: نقطة / نقطتان / نقاط */
function ptsWord(n) {
  if (n === 1) return 'نقطة';
  if (n === 2) return 'نقطتان';
  const m = n % 100;
  if (m >= 3 && m <= 10) return 'نقاط';
  if (m >= 11 && m <= 19) return 'نقطة';
  const d = n % 10;
  if (d >= 3 && d <= 9) return 'نقاط';
  if (d === 2) return 'نقطتان';
  return 'نقطة';
}

/* ---- إشعار الكسب (شعار دائري صغير + السبب) ---- */
let toastTimer = null;
function showRewardToast(reason) {
  let t = document.getElementById('ikhtToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'ikhtToast';
    t.innerHTML = '<span class="tc"><img src="./assets/logo.png" alt=""></span>' +
                  '<span><span class="tt">+١ نقطة</span><br><span class="tr"></span></span>';
    document.body.appendChild(t);
  }
  t.querySelector('.tr').textContent = reason || '';
  // عدّل الأرقام إلى عربية شرقية للعرض
  t.querySelector('.tt').textContent = '+١ نقطة';
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
function toArabicDigits(s) {
  return String(s).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);
}

/* ---- إضافة نقطة (الواجهة العامة لكل الوحدات) ---- */
function addPoint(reason) {
  const p = loadProgress();
  p.points = (Number(p.points) || 0) + 1;
  saveProgress(p);
  showRewardToast(reason || '');
  if (achOverlay && achOverlay.classList.contains('open')) renderAchievements();
  updateFabBadge();
  return p;
}
// حدث عام: أي وحدة تطلقه ⇒ تُضاف نقطة (student.js في أ٢)
window.addEventListener('ikht:reward', (e) => {
  const r = (e && e.detail && e.detail.reason) ? e.detail.reason : '';
  addPoint(r);
});
// API عام مكشوف لوحدات أخرى
window.Ikhtabirni = window.Ikhtabirni || {};
window.Ikhtabirni.addPoint = (reason) => addPoint(reason);
window.Ikhtabirni.getProgress = () => loadProgress();

/* ---- نقطة الحضور اليومية + سلسلة الأيام (تعمل فوراً) ---- */
function applyDailyAttendance() {
  const p = loadProgress();
  const today = todayKey();
  if (p.lastActiveDate === today) return { gained: false, progress: p };
  const prev = p.lastActiveDate;
  if (!prev) {
    p.streak = 1;
  } else {
    const diff = daysBetween(prev, today);
    p.streak = (diff === 1) ? (Number(p.streak) || 0) + 1 : 1; // انقطاع ⇒ تعود لـ١ بهدوء
  }
  p.lastActiveDate = today;
  p.points = (Number(p.points) || 0) + 1; // نقطة حضور اليوم
  saveProgress(p);
  return { gained: true, progress: p };
}

/* ---- الشارات (تُحسب من الحالة مباشرة — لا تخزين مزدوج) ---- */
const BADGES = [
  { id: 'first',  name: 'أول خطوة',  test: (p) => (p.points || 0) >= 1 },
  { id: 'streak3',name: 'مواظِب',    test: (p) => (p.streak || 0) >= 3 },
  { id: 'pts25',  name: 'جامع نور',  test: (p) => (p.points || 0) >= 25 },
  { id: 'streak7',name: 'أسبوع كامل',test: (p) => (p.streak || 0) >= 7 },
];
function star8SVG(size, color) {
  // نجمة ثمانية هندسية (مربعان متراكبان)
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">
    <rect x="5" y="5" width="14" height="14" rx="2" stroke="${color}" stroke-width="1.6"/>
    <rect x="5" y="5" width="14" height="14" rx="2" stroke="${color}" stroke-width="1.6" transform="rotate(45 12 12)"/>
  </svg>`;
}

/* ---- الزر العائم (العملة = الشعار الدائري) ---- */
let fabEl = null;
function injectFAB() {
  if (fabEl) return;
  fabEl = document.createElement('button');
  fabEl.id = 'ikhtFab';
  fabEl.setAttribute('aria-label', 'إنجازاتي');
  fabEl.innerHTML = '<img class="coin" src="./assets/logo.png" alt="نقاطي"><span class="fabPts">0</span>';
  fabEl.addEventListener('click', openAchievements);
  document.body.appendChild(fabEl);
  updateFabBadge();
}
function updateFabBadge() {
  if (!fabEl) return;
  const p = loadProgress();
  fabEl.querySelector('.fabPts').textContent = toArabicDigits(p.points || 0);
}
function updateFabVisibility() {
  if (!fabEl) return;
  fabEl.style.display = (current === 'home') ? 'flex' : 'none';
}

/* ---- طبقة الإنجازات ---- */
let achOverlay = null;
function buildAchievementsOverlay() {
  if (achOverlay) return;
  achOverlay = document.createElement('div');
  achOverlay.id = 'achOverlay';
  achOverlay.setAttribute('dir', 'rtl');
  // نجوم الخلفية
  let stars = '<div class="ach-stars">';
  const pos = [[8,12],[78,8],[20,40],[64,34],[12,72],[82,66],[44,84],[50,18]];
  pos.forEach(([x, y], i) => {
    stars += `<div class="ach-star" style="left:${x}%;top:${y}%;animation-delay:${i * 0.6}s"></div>`;
  });
  stars += '</div>';
  achOverlay.innerHTML = stars +
    '<div class="ach-wrap">' +
      '<div class="ach-top">' +
        '<h2 class="ach-title">إنجازاتي</h2>' +
        '<button class="ach-close" id="achClose" aria-label="إغلاق">✕</button>' +
      '</div>' +
      '<div class="ach-balance">' +
        '<div class="ach-coin-lg"><img src="./assets/logo.png" alt="شعار المركز"></div>' +
        '<div class="ach-num" id="achNum">0</div>' +
        '<div class="ach-numword" id="achWord">نقطة</div>' +
        '<div class="ach-sub">كل نقطة ثمرة حفظٍ ومراجعة — لا تُسحب أبداً، حتى عند الانقطاع.</div>' +
      '</div>' +
      '<div class="ach-grid">' +
        '<div class="ach-card">' +
          '<h3>سلسلة الأيام</h3>' +
          '<div class="ring" id="achRing"></div>' +
          '<div class="ach-streak-goal" id="achGoal"></div>' +
        '</div>' +
        '<div class="ach-card">' +
          '<h3>الشارات</h3>' +
          '<div class="ach-badges" id="achBadges"></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(achOverlay);
  achOverlay.querySelector('#achClose').addEventListener('click', closeAchievements);
}
function openAchievements() {
  buildAchievementsOverlay();
  achOverlay.classList.add('open');
  renderAchievements(true);
}
function closeAchievements() {
  if (achOverlay) achOverlay.classList.remove('open');
}
function animateNumber(el, from, to, dur) {
  const start = performance.now();
  from = Number(from) || 0; to = Number(to) || 0;
  function step(now) {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    const val = Math.round(from + (to - from) * eased);
    el.textContent = toArabicDigits(val);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
let lastRenderedPoints = null;
function renderAchievements(animate) {
  if (!achOverlay) return;
  const p = loadProgress();
  const numEl = achOverlay.querySelector('#achNum');
  const from = (animate && lastRenderedPoints != null) ? lastRenderedPoints : (animate ? 0 : p.points);
  animateNumber(numEl, from, p.points, animate ? 900 : 0);
  lastRenderedPoints = p.points;
  achOverlay.querySelector('#achWord').textContent = ptsWord(p.points || 0);

  // حلقة السلسلة
  const streak = Number(p.streak) || 0;
  const goals = [3, 7, 14, 30, 60, 100, 365];
  let goal = goals.find((g) => g > streak) || streak;
  const ratio = goal > 0 ? Math.min(1, streak / goal) : 0;
  const r = 42, c = 2 * Math.PI * r, off = c * (1 - ratio);
  achOverlay.querySelector('#achRing').innerHTML =
    `<svg width="96" height="96">
       <circle cx="48" cy="48" r="${r}" fill="none" stroke="rgba(212,175,55,.15)" stroke-width="7"/>
       <circle cx="48" cy="48" r="${r}" fill="none" stroke="#d4af37" stroke-width="7"
         stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
         style="transition:stroke-dashoffset .9s ease"/>
     </svg>
     <div class="rv"><b>${toArabicDigits(streak)}</b><small>يوم</small></div>`;
  achOverlay.querySelector('#achGoal').textContent =
    (streak >= goal) ? 'سلسلة مكتملة ✦' : ('الهدف التالي: ' + toArabicDigits(goal) + ' أيام');

  // الشارات
  achOverlay.querySelector('#achBadges').innerHTML = BADGES.map((b) => {
    const on = b.test(p);
    const col = on ? '#f4d77a' : '#5d6b7a';
    return `<div class="badge ${on ? 'on' : ''}">
              <div class="bd">${star8SVG(26, col)}</div>
              <div class="bn">${b.name}</div>
            </div>`;
  }).join('');
}

/* ============================================================
   (يتبع: المنطق الأصلي للتطبيق — بدون تغيير)
   ============================================================ */

/* ---------- شاشة الترحيب: إخفاءٌ مرتبطٌ بالحالة ---------- */
function splashStillThere() { const s = $('splashOverlay'); return !!s && !s.classList.contains('hide'); }
function hideSplash() {
  const sp = $('splashOverlay'); if (!sp || sp.classList.contains('hide')) return;
  sp.classList.add('hide');
  setTimeout(() => { try { sp.remove(); } catch (e) {} }, 700);
}
function ensureSplashGone() {
  const anyVisible = !importScreen.hidden || !homeScreen.hidden || !teacherScreen.hidden || !studentScreen.hidden;
  if (anyVisible && splashStillThere()) hideSplash();
}
const splashWatch = setInterval(ensureSplashGone, 250);
setTimeout(() => clearInterval(splashWatch), 20000);

function injectSplashFallback() {
  const s = $('splashOverlay'); if (!s || s.querySelector('#splashEnter')) return;
  const b = document.createElement('button');
  b.id = 'splashEnter';
  b.textContent = 'دخول';
  b.style.cssText = 'margin-top:1.4rem;opacity:0;transition:opacity .5s;background:linear-gradient(180deg,#d4af37,#b8902a);color:#1a1305;border:none;padding:.6rem 1.7rem;border-radius:12px;font-weight:800;font-family:inherit;cursor:pointer;pointer-events:none;box-shadow:0 8px 22px rgba(212,175,55,.3)';
  b.onclick = () => {
    const anyVisible = !importScreen.hidden || !homeScreen.hidden || !teacherScreen.hidden || !studentScreen.hidden;
    if (!anyVisible) { importScreen.hidden = false; current = 'import'; backBtn.hidden = true; }
    const sp = $('splashOverlay'); if (sp) { sp.classList.add('hide'); setTimeout(() => { try { sp.remove(); } catch (e) {} }, 300); }
  };
  s.appendChild(b);
  setTimeout(() => { if (splashStillThere()) { b.style.opacity = '1'; b.style.pointerEvents = 'auto'; } }, 4000);
}
injectSplashFallback();

/* ---------- بطاقة خطأ مرئية ---------- */
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
  updateFabVisibility();
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

/* ---------- تصدير البيانات ---------- */
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
      stats = await db.getStats();
    } else {
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

    // ✦ حقن الزر العائم + نقطة الحضور اليومية
    injectFAB();
    updateFabVisibility();
    const att = applyDailyAttendance();

    hideSplash();

    // إشعار الحضور بعد زوال الشعار (حتى لا يُخفى خلفه)
    if (att.gained) {
      setTimeout(() => {
        showRewardToast('حضور اليوم ✦');
        updateFabBadge();
      }, 650);
    }
  } catch (e) {
    fatal(e && e.message ? e.message : String(e));
  }
})();
