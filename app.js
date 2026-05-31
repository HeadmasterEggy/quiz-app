let questions = [];
let current = 0;
let score = 0;
let answered = false;
const answers = [];
const SCORE_HISTORY_KEY = 'quiz_score_history';

const $ = id => {
    const el = document.getElementById(id);
    if (!el) console.warn(`Element #${id} not found`);
    return el;
};
const show = id => {
    const el = $(id);
    if (el) el.classList.remove('hidden');
};
const hide = id => {
    const el = $(id);
    if (el) el.classList.add('hidden');
};

const DELAY_BEFORE_EXPLANATION = 600;
const OPTION_SHORTCUTS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const LOADING_CARD_HTML = `<div class="spinner"></div><p>Loading questions...</p>`;

function validateQuestion(q, index) {
    if (!q || typeof q.question !== 'string' || q.question.trim() === '') {
        console.warn(`Question ${index + 1}: missing or empty question text`);
        return false;
    }
    if (!Array.isArray(q.options) || q.options.length === 0) {
        console.warn(`Question ${index + 1}: missing or empty options`);
        return false;
    }
    if (typeof q.correct !== 'number' || q.correct < 0 || q.correct >= q.options.length) {
        console.warn(`Question ${index + 1}: correct index ${q.correct} is out of bounds (0-${q.options.length - 1})`);
        return false;
    }
    if (typeof q.explanation !== 'string' || q.explanation.trim() === '') {
        console.warn(`Question ${index + 1}: missing or empty explanation`);
        return false;
    }
    return true;
}

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function animateValue(element, start, end, duration, formatter) {
    const startTime = performance.now();
    function step(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 4);
        const value = Math.round(start + (end - start) * ease);
        element.textContent = formatter ? formatter(value) : value;
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

async function loadQuestions() {
    $('questionCounter').textContent = 'Loading...';
    $('loadingCard').innerHTML = LOADING_CARD_HTML;
    show('loadingCard');
    hide('quizCard');
    try {
        const res = await fetch('data/questions.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        questions = shuffleArray((data.questions || []).filter((q, i) => validateQuestion(q, i)));
        if (questions.length === 0) {
            throw new Error('No valid questions found in data file');
        }
        console.log(`Loaded ${questions.length} valid question(s)`);
        hide('loadingCard');
        $('quizCard').classList.add('active');
        showQuestion();
    } catch (err) {
        $('questionCounter').textContent = 'Error loading questions';
        $('loadingCard').innerHTML = `
            <p style="color:var(--error);margin-bottom:16px;">Failed to load: ${err.message}</p>
            <button class="retry-btn" onclick="loadQuestions()">↻ Retry</button>
        `;
    }
}

function renderOptions(q) {
    const opts = $('options');
    opts.innerHTML = '';
    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        const shortcut = OPTION_SHORTCUTS[i] || String(i + 1);
        btn.innerHTML = `<span class="label">${shortcut}</span><span class="text">${opt}</span><span class="key-hint">${shortcut}</span>`;
        btn.onclick = () => handleAnswer(i, btn);
        opts.appendChild(btn);
    });
}

function showQuestion() {
    answered = false;
    if (current >= questions.length) {
        showResults();
        return;
    }
    const q = questions[current];

    $('questionCounter').textContent = `Question ${current + 1} of ${questions.length}`;
    $('progressFill').style.width = `${((current) / questions.length) * 100}%`;
    $('questionText').textContent = q.question;

    renderOptions(q);

    $('quizCard').classList.remove('hidden', 'leaving');
    $('quizCard').classList.add('active');
    hide('explanationCard');
    hide('resultsCard');
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function handleAnswer(index, btn) {
    if (answered) return;
    answered = true;

    const q = questions[current];
    const isCorrect = index === q.correct;
    const allBtns = document.querySelectorAll('.option-btn');

    allBtns.forEach(b => b.classList.add('disabled'));

    if (isCorrect) {
        score++;
        btn.classList.add('correct');
    } else {
        btn.classList.add('wrong');
        btn.classList.add('shake');
        const correctBtn = allBtns[q.correct];
        if (correctBtn) correctBtn.classList.add('correct');
    }

    answers.push({ questionIndex: current, correct: isCorrect, question: q.question });

    await wait(DELAY_BEFORE_EXPLANATION);
    $('quizCard').classList.add('leaving');
    await wait(350);
    showExplanation(isCorrect, q);
}

function showExplanation(isCorrect, q) {
    hide('quizCard');
    show('explanationCard');

    const badge = $('resultBadge');
    badge.className = 'result-badge ' + (isCorrect ? 'correct' : 'wrong');
    badge.textContent = isCorrect ? '✓ Correct!' : '✗ Wrong';

    $('explanationText').textContent = q.explanation;
    $('nextBtn').textContent = current < questions.length - 1 ? 'Next Question →' : 'See Results 🏆';
}

function getScoreHistory() {
    try {
        const raw = localStorage.getItem(SCORE_HISTORY_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
}

function saveScore(correct, total) {
    try {
        const history = getScoreHistory();
        history.push({ correct, total, date: new Date().toISOString() });
        // Keep only last 20 attempts
        if (history.length > 20) history.shift();
        localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(history));
    } catch (err) {
        console.warn('Unable to save score history', err);
    }
}

function renderScoreHistory() {
    const history = getScoreHistory();
    if (history.length === 0) return;

    const best = history.reduce((max, h) => {
        const pct = h.correct / h.total;
        return pct > max.pct ? { pct, entry: h } : max;
    }, { pct: -1, entry: null });

    const attempts = history.length;

    const historyEl = document.createElement('div');
    historyEl.className = 'score-history';
    historyEl.innerHTML = `
        <div class="history-row">Best: <strong>${Math.round(best.pct * 100)}%</strong> (${best.entry.correct}/${best.entry.total})</div>
        <div class="history-row">Attempts: ${attempts}</div>
    `;

    const existing = document.querySelector('.score-history');
    if (existing) existing.remove();

    const resultsCard = $('resultsCard');
    resultsCard.insertBefore(historyEl, resultsCard.querySelector('.answers-review'));
}


function showResults() {
    hide('explanationCard');
    show('resultsCard');
    $('progressFill').style.width = '100%';

    const pct = Math.round((score / questions.length) * 100);
    animateValue($('finalScore'), 0, score, 800, v => `${v}/${questions.length}`);
    animateValue($('scorePercentage'), 0, pct, 800, v => `${v}%`);

    const wrongCount = questions.length - score;
    $('scoreBreakdown').textContent = `${score} correct, ${wrongCount} incorrect`;

    // Build per-question answer review
    const review = $('answersReview');
    review.innerHTML = '';
    answers.forEach(a => {
        const dot = document.createElement('span');
        dot.className = 'answer-dot ' + (a.correct ? 'dot-correct' : 'dot-wrong');
        const questionNumber = a.questionIndex + 1;
        const resultText = a.correct ? 'Correct' : 'Incorrect';
        dot.textContent = questionNumber;
        dot.setAttribute('aria-label', `Question ${questionNumber}: ${resultText}`);
        dot.title = `Q${questionNumber}: ${resultText} - ${a.question.substring(0, 60)}…`;
        review.appendChild(dot);
    });

    let msg = '';
    if (pct === 100) msg = 'Perfect score! Amazing! 🎉';
    else if (pct >= 80) msg = 'Great job! Almost there! 👏';
    else if (pct >= 60) msg = 'Good effort! Keep practicing! 💪';
    else msg = 'Keep learning! You\'ll get better! 📚';
    $('scoreMessage').textContent = msg;

    // Save and display score history
    saveScore(score, questions.length);
    renderScoreHistory();
}

$('nextBtn').onclick = () => {
    current++;
    if (current < questions.length) showQuestion();
    else showResults();
};

$('restartBtn').onclick = () => {
    current = 0;
    score = 0;
    answers.length = 0;
    const oldHistory = document.querySelector('.score-history');
    if (oldHistory) oldHistory.remove();
    showQuestion();
};

// Keyboard navigation: option letter to select, Enter/Space to advance
document.addEventListener('keydown', (e) => {
    const quizCard = $('quizCard');
    const explanationCard = $('explanationCard');
    const resultsCard = $('resultsCard');

    // Select options during the question phase
    if (!answered && quizCard && !quizCard.classList.contains('hidden')) {
        const key = e.key.toUpperCase();
        const optIndex = OPTION_SHORTCUTS.indexOf(key);
        if (optIndex >= 0) {
            const btns = document.querySelectorAll('.option-btn');
            if (btns[optIndex]) btns[optIndex].click();
        }
    }

    // Enter / Space to advance or restart
    if (e.key === 'Enter' || e.key === ' ') {
        if (explanationCard && !explanationCard.classList.contains('hidden')) {
            e.preventDefault();
            $('nextBtn').click();
        } else if (resultsCard && !resultsCard.classList.contains('hidden')) {
            e.preventDefault();
            $('restartBtn').click();
        }
    }
});

loadQuestions();
