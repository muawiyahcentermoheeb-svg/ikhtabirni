import * as db from './db.js';

const $ = (id) => document.getElementById(id);

let surahs = [];

export async function loadSurahs() {
  surahs = await db.getSurahsByReverse();
  populateDropdowns();
}

function populateDropdowns() {
  const fromSurah = $('fromSurah');
  const toSurah = $('toSurah');
  const singleSurah = $('singleSurahSelect');
  
  const options = surahs.map(s => `<option value="${s.revOrder}">${s.name}</option>`).join('');
  fromSurah.innerHTML = options;
  toSurah.innerHTML = options;
  singleSurah.innerHTML = options;
}

export function setupSmartFiltering() {
  const fromSurah = $('fromSurah');
  const toSurah = $('toSurah');
  
  fromSurah.addEventListener('change', () => {
    const fromVal = parseInt(fromSurah.value);
    toSurah.innerHTML = surahs
      .filter(s => s.revOrder >= fromVal)
      .map(s => `<option value="${s.revOrder}">${s.name}</option>`)
      .join('');
  });
}

export async function generateQuestion(settings) {
  const { rangeType, from, to, size, difficultyMethod, difficultyLevel } = settings;
  
  let verses = [];
  
  if (rangeType === 'surah') {
    verses = await db.getVersesBySurahRange(from, to);
  } else if (rangeType === 'juz') {
    verses = await db.getVersesByJuzRange(from, to);
  } else if (rangeType === 'single') {
    verses = await db.getVersesBySurah(from);
  }
  
  if (verses.length === 0) {
    throw new Error('لا توجد آيات في النطاق المحدد.');
  }
  
  // تطبيق مستوى الصعوبة
  if (difficultyMethod === 'file') {
    verses = verses.filter(v => v.difficulty === difficultyLevel);
  }
  
  // قاعدة: لا "صعب" في جزء عمّ (الجزء 1 بالترتيب المعكوس)
  if (difficultyLevel === 'صعب' && rangeType === 'juz' && from === 1) {
    throw new Error('مستوى "صعب" غير متاح في جزء عمّ.');
  }
  
  if (verses.length === 0) {
    throw new Error(`لا توجد آيات بمستوى "${difficultyLevel}" في هذا النطاق.`);
  }
  
  // ترتيب الآيات
  verses.sort((a, b) => a.origOrder - b.origOrder);
  
  // اختيار آيات متتالية
  const maxStart = Math.max(0, verses.length - size);
  const startIdx = Math.floor(Math.random() * (maxStart + 1));
  const question = verses.slice(startIdx, startIdx + size);
  
  // التحقق من سورة واحدة
  const firstSurah = question[0].surahOrigNumber;
  const singleSurahVerses = question.filter(v => v.surahOrigNumber === firstSurah);
  
  if (singleSurahVerses.length === 0) {
    throw new Error('السؤال يمتد لأكثر من سورة.');
  }
  
  return singleSurahVerses;
}

export function displayQuestion(verses) {
  if (verses.length === 0) {
    $('questionText').textContent = 'لا توجد آيات مطابقة.';
    $('surahName').textContent = '';
    return;
  }
  
  const text = verses.map(v => v.text).join(' ');
  const surahName = verses[0].surahName;
  
  $('questionText').textContent = text;
  $('surahName').textContent = `سورة ${surahName}`;
}

export function saveSettings(settings) {
  localStorage.setItem('teacherSettings', JSON.stringify(settings));
}

export function loadSettings() {
  const saved = localStorage.getItem('teacherSettings');
  return saved ? JSON.parse(saved) : null;
}

export function showSettings() {
  $('settingsPanel').hidden = false;
  $('questionPanel').hidden = true;
}

export function showQuestion() {
  $('settingsPanel').hidden = true;
  $('questionPanel').hidden = false;
}
