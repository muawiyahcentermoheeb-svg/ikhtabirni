// يقرأ ملف الإكسل/CSV داخل المتصفح ويبني الجداول — لا بيانات وهمية
import { SURAH_NAMES, DIFFICULTIES } from './constants.js';

const norm = (s) => String(s ?? '').replace(/\s+/g, '').toLowerCase();

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const line = (rows[i] || []).map(norm);
    if (line.some((c) => c.includes('verse') || c.includes('الآية') || c.includes('verse_text')) &&
        line.some((c) => c.includes('accumalative') || c.includes('original'))) return i;
    if (line.some((c) => c.includes('verse'))) return i; // احتياط
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
  // عمود الصعوبة = أول عمود قيمته سهل/متوسط/صعب
  col.difficulty = -1;
  if (firstData) {
    for (let j = 0; j < firstData.length; j++) {
      const val = norm(firstData[j]);
      if (DIFFICULTIES.includes(String(firstData[j]).trim()) || /^(سهل|متوسط|صعب)$/.test(val)) { col.difficulty = j; break; }
    }
  }
  return col;
}

function numFromId(id, fallback) {
  const m = String(id ?? '').match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : fallback;
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

  // بناء الآيات
  let verses = [];
  for (const r of dataRows) {
    const origOrder = parseInt(r[col.origOrder], 10);
    if (!Number.isFinite(origOrder)) continue;
    const text = String(r[col.text] ?? '').trim();
    if (!text) continue;
    verses.push({
      origOrder,
      text,
      revOrder: parseInt(r[col.revOrder], 10) || 0,
      surahRevOrder: parseInt(r[col.surahRev], 10) || 0,
      surahOrigOrderInSurah: parseInt(r[col.surahOrigOrd], 10) || 0,
      partId: String(r[col.partId] ?? ''),
      surahId: String(r[col.surahId] ?? ''),
      page: parseInt(r[col.page], 10) || 0,
      lineStart: parseInt(r[col.lineStart], 10) || 0,
      lineEnd: parseInt(r[col.lineEnd], 10) || 0,
      difficulty: col.difficulty >= 0 ? String(r[col.difficulty] ?? '').trim() : 'سهل',
    });
  }
  if (!verses.length) throw new Error('لم تُستخرج آيات صالحة من الملف.');

  verses.sort((a, b) => a.origOrder - b.origOrder);

  // اشتقاق رقم الجزء الأصلي من ترتيب ظهور part_id (آمن مهما كانت أرقامه)
  const partToJuz = new Map();
  let juzCounter = 0;
  for (const v of verses) {
    if (!partToJuz.has(v.partId)) partToJuz.set(v.partId, ++juzCounter);
    v.juzOriginal = partToJuz.get(v.partId);
  }
  const warnings = [];
  if (juzCounter !== 30) warnings.push(`عدد الأجزاء المكتشفة = ${juzCounter} (المتوقع ٣٠). سيعمل التطبيق لكن راجع الملف.`);

  // رقم الجزء المعكوس + رقم السورة الأصلي
  const totalJuz = juzCounter;
  const surahAgg = new Map();
  for (const v of verses) {
    v.juzReverse = (totalJuz + 1) - v.juzOriginal;
    if (v.juzReverse < 1) v.juzReverse = 1;
    v.surahOrigNumber = numFromId(v.surahId, v.surahOrigOrderInSurah);
    const name = SURAH_NAMES[v.surahOrigNumber - 1] || `سورة ${v.surahOrigNumber}`;
    v.surahName = name;

    if (!surahAgg.has(v.surahOrigNumber)) {
      surahAgg.set(v.surahOrigNumber, {
        origNumber: v.surahOrigNumber, revOrder: v.surahRevOrder, name,
        verseCount: 0, firstJuzRev: v.juzReverse,
      });
    }
    const s = surahAgg.get(v.surahOrigNumber);
    s.verseCount++;
  }
  const surahs = [...surahAgg.values()].sort((a, b) => a.revOrder - b.revOrder);

  // إحصاءات
  const diff = { سهل: 0, متوسط: 0, صعب: 0, unknown: 0 };
  for (const v of verses) { diff[DIFFICULTIES.includes(v.difficulty) ? v.difficulty : 'unknown']++; }
  if (diff.unknown) warnings.push(`يوجد ${diff.unknown} آية بمستوى صعوبة غير معروف.`);

  const stats = {
    verseCount: verses.length,
    surahCount: surahs.length,
    juzCount: totalJuz,
    difficulty: diff,
    firstText: verses[0].text.slice(0, 40),
    lastText: verses[verses.length - 1].text.slice(0, 40),
    warnings,
    samples: {
      سهل: verses.find((v) => v.difficulty === 'سهل'),
      متوسط: verses.find((v) => v.difficulty === 'متوسط'),
      صعب: verses.find((v) => v.difficulty === 'صعب'),
    },
  };

  // نحذف الحقول المساعدة الثقيلة قبل الحفظ
  verses = verses.map(({ partId, surahId, surahOrigOrderInSurah, ...rest }) => rest);
  return { verses, surahs, stats };
}
