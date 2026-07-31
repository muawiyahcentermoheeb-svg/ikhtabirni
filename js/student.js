import * as db from './db.js';
const $ = (id) => document.getElementById(id);
let score = 0, streak = 0, current = null;

export async function initGame() {
  score = 0; streak = 0; paint();
  $('resultMsg').hidden = true;
  await next();
}
function paint() {
  $('scoreDisplay').textContent = `النقاط: ${score}`;
  $('streakDisplay').textContent = `متتالية: ${streak} 🔥`;
}
async function next() {
  $('resultMsg').hidden = true;
  $('optionsGrid').innerHTML = '';
  const all = await db.getAllVerses();
  const long = all.filter(v => v.text.split(' ').length >= 4);
  const target = long[Math.floor(Math.random() * long.length)];
  const words = target.text.split(' ');
  const split = Math.max(2, Math.floor(words.length * 0.6));
  const q = words.slice(0, split).join(' ');
  const a = words.slice(split).join(' ');
  current = { answer: a };
  $('studentQuestionText').textContent = q + ' …';
  $('studentSurahHint').textContent = `سورة ${target.surahName}`;

  const wrong = await db.getRandomVerses(3, target.origOrder);
  const opts = [{ text: a, ok: true }, ...wrong.map(v => {
    const w = v.text.split(' '); const s = Math.max(2, Math.floor(w.length*0.6));
    return { text: w.slice(s).join(' '), ok: false };
  })];
  for (let i = opts.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [opts[i],opts[j]]=[opts[j],opts[i]]; }

  const grid = $('optionsGrid');
  opts.forEach((o) => {
    const b = document.createElement('button');
    b.className = 'option-btn'; b.textContent = o.text;
    b.onclick = () => answer(o.ok, b);
    grid.appendChild(b);
  });
}
function answer(ok, btn) {
  document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
  const msg = $('resultMsg'); msg.hidden = false;
  if (ok) {
    btn.classList.add('correct'); score += 10; streak++;
    msg.textContent = '✅ أحسنت! بارك الله فيك'; msg.className = 'result-msg success';
  } else {
    btn.classList.add('wrong'); streak = 0;
    msg.textContent = `❌ الصواب: ${current.answer}`; msg.className = 'result-msg error';
    document.querySelectorAll('.option-btn').forEach(b => { if (b.textContent === current.answer) b.classList.add('correct'); });
  }
  paint();
  setTimeout(next, 1900);
}
