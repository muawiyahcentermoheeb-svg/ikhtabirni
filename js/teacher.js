// شاشة المعلم — منطق توليد الأسئلة
import * as db from './db.js';

const $ = (id) => document.getElementById(id);
const teacherScreen = $('teacherScreen');
const settingsPanel = $('settingsPanel');
const questionPanel = $('questionPanel');

// تحميل السور من قاعدة البيانات
let surahs = [];
export async function loadSurahs() {
  surahs = await db.getSurahsByReverse();
  populateDropdowns();
}

// ملء القوائم المنسدلة
function populateDropdowns() {
  const fromSurah = $('fromSurah');
  const toSurah = $('toSurah');
  const fromJuz = $('fromJuz');
  const toJuz = $('toJuz');
  
  // سور (بالترتيب المعكوس: الناس → الفاتحة)
  fromSurah.innerHTML = surahs.map(s => `<option value="${s.revOrder}">${s.name}</option>`).join('');
  toSurah.innerHTML = fromSurah.innerHTML;
  
  // أجزاء (١ = عمّ، ٣٠ = البقرة)
  fromJuz.innerHTML = Array.from({length: 30}, (_, i) => 
    `<option value="${i+1}">جزء ${i+1}</option>`
  ).join('');
  toJuz.innerHTML = fromJuz.innerHTML;
}

// التصفية الذكية: عند اختيار "من"، قائمة "إلى" تعرض فقط ما يليها
export function setupSmartFiltering() {
  const fromSurah = $('fromSurah');
  const toSurah = $('toSurah');
  const fromJuz = $('fromJuz');
  const toJuz = $('toJuz');
  
  fromSurah.addEventListener('change', () => {
    const fromVal = parseInt(fromSurah.value);
    toSurah.innerHTML = surahs
      .filter(s => s.revOrder >= fromVal)
      .map(s => `<option value="${s.revOrder}">${s.name}</option>`)
      .join('');
  });
  
  fromJuz.addEventListener('change', () => {
    const fromVal = parseInt(fromJuz.value);
    toJuz.innerHTML = Array.from({length: 30 - fromVal + 1}, (_, i) => 
      `<option value="${fromVal + i}">جزء ${fromVal + i}</option>`
    ).join('');
  });
}

// توليد السؤال
export async function generateQuestion(settings) {
  const { rangeType, from, to, size, difficultyMethod, difficultyLevel, nonRepeat } = settings;
  
  // جلب الآيات حسب النطاق
  let verses = [];
  if (rangeType === 'surah') {
    verses = await db.getVersesBySurahRange(from, to);
  } else if (rangeType === 'juz') {
    verses = await db.getVersesByJuzRange(from, to);
  } else if (rangeType === 'single') {
    verses = await db.getVersesBySurah(from);
  }
  
  // تطبيق مستوى الصعوبة
  if (difficultyMethod === 'file') {
    verses = verses.filter(v => v.difficulty === difficultyLevel);
  } else if (difficultyMethod === 'position') {
    verses = filterByPosition(verses, difficultyLevel);
  }
  
  // قاعدة: لا "صعب" في جزء عمّ (الجزء ١ بالترتيب المعكوس)
  if (difficultyLevel === 'صعب' && rangeType === 'juz' && from === 1 && to === 1) {
    throw new Error('مستوى "صعب" غير متاح في جزء عمّ.');
  }
  
  // اختيار مجموعة آيات متتالية بالحجم المطلوب
  const question = selectConsecutiveVerses(verses, size);
  
  // قاعدة: سورة واحدة فقط لكل سؤال
  if (!isSingleSurah(question)) {
    throw new Error('السؤال يمتد لأكثر من سورة. اختر نطاقاً أضيق أو حجماً أصغر.');
  }
  
  return question;
}

// تصفية حسب موضع الصفحة (الطريقة الثانية)
function filterByPosition(verses, level) {
  if (level === 'سهل') {
    return verses.filter(v => v.lineStart <= 5); // بداية الصفحة
  } else if (level === 'متوسط') {
    return verses.filter(v => v.lineStart >= 6 && v.lineStart <= 10); // منتصف
  } else if (level === 'صعب') {
    return verses.filter(v => v.lineStart >= 11 || v.lineEnd <= 4); // آخر ٣ أسطر + أول ٤ من التالية
  }
  return verses;
}

// اختيار آيات متتالية بالحجم المطلوب
function selectConsecutiveVerses(verses, size) {
  if (verses.length === 0) return [];
  
  const startIdx = Math.floor(Math.random() * Math.max(1, verses.length - size + 1));
  const endIdx = Math.min(startIdx + size - 1, verses.length - 1);
  
  return verses.slice(startIdx, endIdx + 1);
}

// التحقق من أن السؤال من سورة واحدة
function isSingleSurah(verses) {
  if (verses.length === 0) return true;
  const firstSurah = verses[0].surahOrigNumber;
  return verses.every(v => v.surahOrigNumber === firstSurah);
}

// عرض السؤال
export function displayQuestion(verses) {
  if (verses.length === 0) {
    $('questionText').textContent = 'لا توجد آيات مطابقة للإعدادات.';
    $('surahName').textContent = '';
    return;
  }
  
  const text = verses.map(v => v.text).join(' ');
  const surahName = verses[0].surahName;
  
  $('questionText').textContent = text;
  $('surahName').textContent = `سورة ${surahName}`;
}

// حفظ الإعدادات تلقائياً
export function saveSettings(settings) {
  localStorage.setItem('teacherSettings', JSON.stringify(settings));
}

export function loadSettings() {
  const saved = localStorage.getItem('teacherSettings');
  return saved ? JSON.parse(saved) : null;
}

// التنقل بين الإعدادات والسؤال
export function showSettings() {
  settingsPanel.hidden = false;
  questionPanel.hidden = true;
}

export function showQuestion() {
  settingsPanel.hidden = true;
  questionPanel.hidden = false;
}
