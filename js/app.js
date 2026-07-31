import * as db from './db.js';
import { parseFile } from './importer.js';
import { loadSurahs, setupSmartFiltering, generateQuestion, displayQuestion, saveSettings, loadSettings, showSettings, showQuestion } from './teacher.js';

const $ = (id) => document.getElementById(id);
const importScreen = $('importScreen');
const homeScreen = $('homeScreen');
const teacherScreen = $('teacherScreen');
const fileInput = $('fileInput');
const prog = $('importProgress');
const progMsg = $('importMsg');
const errBox = $('importError');

function paintNet() {
  const b = $('netBadge');
  const on = navigator.onLine;
  b.textContent = on ? '● متصل' : '● غير متصل';
  b.className = 'net-badge ' + (on ? 'on' : 'off');
}
window.addEventListener('online', paintNet);
window.addEventListener('offline', paintNet);
paintNet();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

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
    if (!s) return `<div class="sample">لا توجد عينة لمستوى «${lvl}».</div>`;
    return `<div class="sample">${s.text.slice(0, 80)}...<br><small>${lvl} · ${s.surahName} · صفحة ${s.page}</small></div>`;
  }).join('');

  importScreen.hidden = true;
  homeScreen.hidden = false;
}

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  errBox.hidden = true;
  prog.hidden = false;
  progMsg.textContent = 'جارٍ قراءة الملف…';
  
  try {
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

$('reimportBtn').addEventListener('click', async () => {
  if (!confirm('سيُمسح ما حُفظ محلياً. متابعة؟')) return;
  await db.clearAll();
  homeScreen.hidden = true;
  importScreen.hidden = false;
});

document.querySelectorAll('.feature-card').forEach((c) => {
  c.addEventListener('click', async () => {
    if (c.disabled) return;
    
    if (c.dataset.go === 'teacher') {
      homeScreen.hidden = true;
      teacherScreen.hidden = false;
      
      await loadSurahs();
      setupSmartFiltering();
      
      const saved = loadSettings();
      if (saved) {
        $('rangeType').value = saved.rangeType || 'surah';
        $('difficultyMethod').value = saved.difficultyMethod || 'file';
        $('nonRepeat').value = saved.nonRepeat || '20';
        
        // تحديث chips
        document.querySelectorAll('.chip[data-size]').forEach(chip => {
          chip.classList.toggle('active', parseInt(chip.dataset.size) === (saved.size || 7));
        });
        document.querySelectorAll('.chip[data-level]').forEach(chip => {
          chip.classList.toggle('active', chip.dataset.level === (saved.difficultyLevel || 'سهل'));
        });
      }
    }
  });
});

$('backToHome').addEventListener('click', () => {
  teacherScreen.hidden = true;
  homeScreen.hidden = false;
});

$('generateBtn').addEventListener('click', async () => {
  const rangeType = $('rangeType').value;
  const from = rangeType === 'surah' ? parseInt($('fromSurah').value) : 
               rangeType === 'juz' ? parseInt($('fromJuz').value) : 
               parseInt($('singleSurahSelect').value);
  const to = rangeType === 'surah' ? parseInt($('toSurah').value) : 
             rangeType === 'juz' ? parseInt($('toJuz').value) : from;
  
  const settings = {
    rangeType,
    from,
    to,
    size: parseInt(document.querySelector('.chip.active[data-size]')?.dataset.size || '7'),
    difficultyMethod: $('difficultyMethod').value,
    difficultyLevel: document.querySelector('.chip.active[data-level]')?.dataset.level || 'سهل',
    nonRepeat: parseInt($('nonRepeat').value)
  };
  
  try {
    const verses = await generateQuestion(settings);
    displayQuestion(verses);
    showQuestion();
    saveSettings(settings);
  } catch (err) {
    alert(err.message);
  }
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const parent = chip.parentElement;
    parent.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  });
});

$('rangeType').addEventListener('change', (e) => {
  const val = e.target.value;
  $('surahRange').hidden = val !== 'surah';
  $('juzRange').hidden = val !== 'juz';
  $('singleSurah').hidden = val !== 'single';
});

$('changeQuestionBtn').addEventListener('click', async () => {
  const settings = loadSettings();
  if (settings) {
    try {
      const verses = await generateQuestion(settings);
      displayQuestion(verses);
    } catch (err) {
      alert(err.message);
    }
  }
});

$('changeSettingsBtn').addEventListener('click', () => {
  showSettings();
});

(async () => {
  if (await db.isReady()) {
    const stats = await db.getStats();
    if (stats) { renderHome(stats); return; }
  }
  importScreen.hidden = false;
})();
