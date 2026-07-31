import * as db from './db.js';

const $ = (id) => document.getElementById(id);

let currentScore = 0;
let currentStreak = 0;
let currentQuestion = null;

export async function initGame() {
  currentScore = 0;
  currentStreak = 0;
  updateScoreDisplay();
  await loadNextQuestion();
}

function updateScoreDisplay() {
  $('scoreDisplay').textContent = `النقاط: ${currentScore}`;
  $('streakDisplay').textContent = `متتالية: ${currentStreak} 🔥`;
}

async function loadNextQuestion() {
  // إخفاء النتيجة السابقة
  $('resultMsg').hidden = true;
  $('optionsGrid').innerHTML = '';
  
  // جلب آية عشوائية (تفضل الآيات الطويلة قليلاً)
  const allVerses = await db.getAllVerses();
  const longVerses = allVerses.filter(v => v.text.split(' ').length >= 4);
  const targetVerse = longVerses[Math.floor(Math.random() * longVerses.length)];
  
  // تقسيم الآية: السؤال (البداية) والإجابة (النهاية)
  const words = targetVerse.text.split(' ');
  const splitIndex = Math.max(2, Math.floor(words.length * 0.6)); // نخفي آخر 40%
  const questionText = words.slice(0, splitIndex).join(' ');
  const answerText = words.slice(splitIndex).join(' ');
  
  currentQuestion = {
    origOrder: targetVerse.origOrder,
    question: questionText,
    answer: answerText,
    surahName: targetVerse.surahName
  };
  
  // عرض السؤال
  $('questionText').textContent = questionText + ' ...';
  $('surahHint').textContent = `سورة: ${targetVerse.surahName}`;
  
  // إنشاء الخيارات (1 صحيح + 3 خطأ)
  const distractors = await db.getRandomVerses(3, targetVerse.origOrder);
  const options = [
    { text: answerText, correct: true },
    ...distractors.map(v => {
      const vWords = v.text.split(' ');
      const vSplit = Math.max(2, Math.floor(vWords.length * 0.6));
      return { text: vWords.slice(vSplit).join(' '), correct: false };
    })
  ];
  
  // خلط الخيارات
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  
  // رسم الأزرار
  const grid = $('optionsGrid');
  options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt.text;
    btn.onclick = () => handleAnswer(opt.correct, btn);
    grid.appendChild(btn);
  });
}

function handleAnswer(isCorrect, btnElement) {
  // تعطيل كل الأزرار
  document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
  
  const msg = $('resultMsg');
  msg.hidden = false;
  
  if (isCorrect) {
    btnElement.classList.add('correct');
    currentScore += 10;
    currentStreak++;
    msg.textContent = '✅ إجابة صحيحة! بارك الله فيك';
    msg.className = 'result-msg success';
  } else {
    btnElement.classList.add('wrong');
    currentStreak = 0;
    msg.textContent = `❌ الإجابة الصحيحة: ${currentQuestion.answer}`;
    msg.className = 'result-msg error';
    
    // تلوين الزر الصحيح
    document.querySelectorAll('.option-btn').forEach(b => {
      if (b.textContent === currentQuestion.answer) b.classList.add('correct');
    });
  }
  
  updateScoreDisplay();
  
  // الانتقال للسؤال التالي بعد ثانيتين
  setTimeout(loadNextQuestion, 2000);
}

export function showStudentScreen() {
  $('homeScreen').hidden = true;
  $('teacherScreen').hidden = true;
  $('studentScreen').hidden = false;
  initGame();
}

export function hideStudentScreen() {
  $('studentScreen').hidden = true;
  $('homeScreen').hidden = false;
}
