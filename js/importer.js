// يقرأ ملف الإكسل/CSV داخل المتصفح ويبني الجداول — لا بيانات وهمية
import { SURAH_NAMES, DIFFICULTIES } from './constants.js';

const norm = (s) => String(s ?? '').replace(/\s+/g, '').toLowerCase();

// جدول حدود الأجزاء (صفحة البداية لكل جزء في المصحف)
const JUZ_PAGE_STARTS = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182,
  201, 222, 242, 262, 282, 302, 322, 342, 362, 382,
  402, 422, 442, 462, 482, 502, 522, 542, 562, 582
];

function getJuzFromPage(pageNo) {
  for (let i = JUZ_PAGE_STARTS.length - 1; i >= 0; i--) {
    if (pageNo >= JUZ_PAGE_STARTS[i]) return i + 1;
  }
  return 1;
}

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const line = (rows[i] || []).map(norm);
    if (line.some((c) => c.includes('verse') || c.includes('الآية')) &&
        line.some((c) => c.includes('accumalative') || c.includes('original'))) return i;
  }
  return 0;
}

function detectCols(header, firstData) {
  const h = header.map(norm);
  const has = (frag) => h.findIndex((c) => c.includes(frag));
  const col = {
    text: has('verse'),
    origOrder: has('original_accumalative'),
    revOrder: has('reverse_accumalative'),
    surahRev: has('reverse_surah_order'),
    surahOrigOrd: has('original_surah_order'),
    partId: has('part_id'),
    surahId: has('surah_id'),
    page: has('page_no') !== -1 ? has('page_no') : has('page'),
    lineStart: has('line_start'),
    lineEnd: has('line_end'),
  };
  col.difficulty = -1;
  if (firstData) {
    for (let j = 0; j < firstData.length; j++) {
      const val = String(firstData[j] ?? '').trim();
      if (DIFFICULTIES.includes(val) || /^(سهل|متوسط|صعب)$/.test(val)) { col.difficulty = j; break; }
    }
  }
  return col;
}

function extractNumberFromId(id) {
  const m = String(id ?? '').match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 0;
}

export async function parseFile(file) {
  if (typeof window.XLSX === 'undefined') throw new Error('تعذّر تحميل أداة قراءة الإكسل. تأكد من الاتصال مرة واحدة ثم أعد المحاولة.');
  const buf = await file.arrayBuffer();
  const wb = window.XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
  if (!rows.length) throw new Error('الملف فارغ.');

  const hi = findHeaderRow(rows);
  const header = rows[hi] || [];
  const dataRows = rows.slice(hi + 1).filter((r) => r && r.some((c) => String(c).trim() !== ''));
  const col = detectCols(header, dataRows[0]);

  if (col.text < 0 || col.origOrder < 0) throw new Error('تعذّر التعرف على أعمدة النص والترتيب في الملف.');

  let verses = [];
  for (const r of dataRows) {
    const origOrder = parseInt(r[col.origOrder], 10);
    if (!Number.isFinite(origOrder)) continue;
    const text = String(r[col.text] ?? '').trim();
    if (!text) continue;
    
    const pageNo = parseInt(r[col.page], 10) || 0;
    const juzOriginal = getJuzFromPage(pageNo);
    const juzReverse = 31 - juzOriginal;
    const surahOrigNumber = extractNumberFromId(r[col.surahId]);
    const surahRevOrder = parseInt(r[col.surahRev], 10) || 0;
    
    verses.push({
      origOrder,
      text,
      revOrder: parseInt(r[col.revOrder], 10) || 0,
      surahRevOrder,
      surahOrigNumber,
      surahName: SURAH_NAMES[surahOrigNumber - 1] || `سورة ${surahOrigNumber}`,
      juzOriginal,
      juzReverse,
      page: pageNo,
      lineStart: parseInt(r[col.lineStart], 10) || 0,
      lineEnd: parseInt(r[col.lineEnd], 10) || 0,
      difficulty: col.difficulty >= 0 ? String(r[col.difficulty] ?? '').trim() : 'سهل',
    });
  }
  
  if (!verses.length) throw new Error('لم تُستخرج آيات صالحة من الملف.');
  verses.sort((a, b) => a.origOrder - b.origOrder);

  const surahAgg = new Map();
  for (const v of verses) {
    if (!surahAgg.has(v.surahOrigNumber)) {
      surahAgg.set(v.surahOrigNumber, {
        origNumber: v.surahOrigNumber,
        revOrder: v.surahRevOrder,
        name: v.surahName,
        verseCount: 0,
      });
    }
    surahAgg.get(v.surahOrigNumber).verseCount++;
  }
  const surahs = [...surahAgg.values()].sort((a, b) => a.revOrder - b.revOrder);

  const diff = { سهل: 0, متوسط: 0, صعب: 0, unknown: 0 };
  for (const v of verses) {
    diff[DIFFICULTIES.includes(v.difficulty) ? v.difficulty : 'unknown']++;
  }
  const warnings = [];
  if (diff.unknown) warnings.push(`يوجد ${diff.unknown} آية بمستوى صعوبة غير معروف.`);

  const stats = {
    verseCount: verses.length,
    surahCount: surahs.length,
    juzCount: 30,
    difficulty: diff,
    warnings,
    samples: {
      سهل: verses.find((v) => v.difficulty === 'سهل'),
      متوسط: verses.find((v) => v.difficulty === 'متوسط'),
      صعب: verses.find((v) => v.difficulty === 'صعب'),
    },
  };

  return { verses, surahs, stats };
}
