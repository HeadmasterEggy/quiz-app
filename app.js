let allQuestions = [];
let questions = [];
let current = 0;
let score = 0;
let answered = false;
const answers = [];
const SCORE_KEY = 'quiz_score_history';
const WRONG_KEY = 'quiz_wrong_answers';
const OPTION_SHORTCUTS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

let selectedMAQ = []; // tracks selected options for MAQ
let currentWeekFilter = 'all';
let isRetryMode = false;

const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');

function isMAQ(q) { return Array.isArray(q.correct); }

// ── Load ──
function loadQuestions(filter = 'all') {
    currentWeekFilter = filter;
    hide('quizCard'); hide('resultsCard');
    show('loadingCard');
    $('questionCounter').textContent = 'Loading...';

    if (!window.QUIZ_DATA || !window.QUIZ_DATA.questions) {
        $('loadingCard').innerHTML = `<p style="color:var(--error)">No question data found</p>`;
        return;
    }

    allQuestions = window.QUIZ_DATA.questions;
    questions = filter === 'all' ? [...allQuestions] : allQuestions.filter(q => q.week === filter);

    current = 0; score = 0; answers.length = 0; isRetryMode = false;
    hide('loadingCard');
    showQuestion();
}

function buildWeekFilter() {
    const sel = $('weekFilter');
    sel.innerHTML = '<option value="all">All Weeks & Exams</option>';
    const weeks = window.QUIZ_DATA.weeks || [];
    weeks.forEach(w => {
        const count = (window.QUIZ_DATA.questions || []).filter(q => q.week === w).length;
        sel.innerHTML += `<option value="${w}">${w} (${count} Qs)</option>`;
    });
    sel.value = currentWeekFilter;
    sel.onchange = () => loadQuestions(sel.value);
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function renderOptions() {
    const q = questions[current];
    const opts = $('options');
    opts.innerHTML = '';
    const maq = isMAQ(q);
    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        const key = OPTION_SHORTCUTS[i];
        btn.innerHTML = `<span class="label">${key}</span><span class="text">${opt}</span>`;
        btn.onclick = () => maq ? handleMAQClick(i, btn) : handleAnswer(i, btn);
        opts.appendChild(btn);
    });

    // MAQ hint + check button
    if (maq) {
        $('maqHint').classList.remove('hidden');
        $('maqCheckBtn').classList.add('hidden');
    } else {
        $('maqHint').classList.add('hidden');
        $('maqCheckBtn').classList.add('hidden');
    }
}

// ── Show question ──
function showQuestion() {
    answered = false;
    selectedMAQ = [];
    if (current >= questions.length) { showResults(); return; }

    const q = questions[current];
    const source = q.week ? ` [${q.week}]` : '';
    $('questionCounter').textContent = `Q${current + 1} / ${questions.length}${source}`;
    $('progressFill').style.width = `${(current / questions.length) * 100}%`;
    $('questionText').textContent = q.question;
    renderOptions();
    hide('explanationInline');
    hide('nextBtn');
    show('quizCard');
    hide('resultsCard');
}

// ── MCQ: single click → immediate feedback ──
function handleAnswer(index, btn) {
    if (answered) return;
    answered = true;

    const q = questions[current];
    const allBtns = document.querySelectorAll('.option-btn');
    const isCorrect = index === q.correct;

    allBtns.forEach(b => b.classList.add('disabled'));
    btn.classList.add(isCorrect ? 'correct' : 'wrong');
    if (!isCorrect) allBtns[q.correct].classList.add('correct');
    if (isCorrect) score++;

    answers.push({ question: q, correct: isCorrect });
    if (!isCorrect) saveWrongAnswer(q);

    setTimeout(showInlineExplanation, 400, isCorrect, q);
}

// ── MAQ: two-click toggle → check button ──
function handleMAQClick(index, btn) {
    if (answered) return;

    if (selectedMAQ.includes(index)) {
        // Deselect
        selectedMAQ = selectedMAQ.filter(i => i !== index);
        btn.classList.remove('selected');
    } else if (selectedMAQ.length < 2) {
        // Select
        selectedMAQ.push(index);
        btn.classList.add('selected');
    }

    // Show check button when 2 selected
    const checkBtn = $('maqCheckBtn');
    if (selectedMAQ.length === 2) {
        checkBtn.classList.remove('hidden');
        checkBtn.focus();
    } else {
        checkBtn.classList.add('hidden');
    }
}

// ── MAQ: check both answers ──
function checkMAQ() {
    if (answered || selectedMAQ.length !== 2) return;
    answered = true;

    const q = questions[current];
    const correctIdx = q.correct; // [int, int]
    const allBtns = document.querySelectorAll('.option-btn');
    const sortedSel = [...selectedMAQ].sort();
    const sortedCorrect = [...correctIdx].sort();

    // Check if both selections are exactly the correct set
    const isFullyCorrect = sortedSel[0] === sortedCorrect[0] && sortedSel[1] === sortedCorrect[1];

    allBtns.forEach(b => b.classList.add('disabled'));

    // Highlight correct answers and user's selections
    correctIdx.forEach(i => allBtns[i]?.classList.add('correct'));
    selectedMAQ.forEach(i => {
        if (!correctIdx.includes(i)) allBtns[i]?.classList.add('wrong');
    });

    if (isFullyCorrect) score++;

    const wasCorrect = isFullyCorrect;
    answers.push({ question: q, correct: wasCorrect });
    if (!wasCorrect) saveWrongAnswer(q);

    setTimeout(showInlineExplanation, 400, wasCorrect, q);
}

// ── Shared: show explanation ──
function showInlineExplanation(isCorrect, q) {
    const badge = $('resultBadge');
    badge.className = 'result-badge ' + (isCorrect ? 'correct' : 'wrong');
    badge.textContent = isCorrect ? '✓ Correct!' : '✗ Wrong';
    $('explanationText').textContent = q.explanation || '';
    hide('maqHint');
    hide('maqCheckBtn');
    show('explanationInline');
    show('nextBtn');
    $('nextBtn').textContent = current < questions.length - 1 ? 'Next →' : 'See Results 🏆';
    $('nextBtn').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Wrong answer tracking ──
function saveWrongAnswer(q) {
    try {
        const raw = localStorage.getItem(WRONG_KEY);
        const list = raw ? JSON.parse(raw) : [];
        if (!list.find(w => w.question === q.question)) list.push(q);
        localStorage.setItem(WRONG_KEY, JSON.stringify(list));
    } catch { /* ignore */ }
}

function getWrongAnswers() {
    try { const raw = localStorage.getItem(WRONG_KEY); return raw ? JSON.parse(raw) : []; }
    catch { return []; }
}

function clearWrongAnswers() {
    try { localStorage.removeItem(WRONG_KEY); } catch { /* ignore */ }
}

// ── Show Results ──
function showResults() {
    hide('quizCard'); hide('nextBtn'); show('resultsCard');
    $('progressFill').style.width = '100%';

    const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;
    $('finalScore').textContent = `${score}/${questions.length}`;
    $('scorePercentage').textContent = `${pct}%`;
    $('scoreBreakdown').textContent = `${score} ✓ · ${questions.length - score} ✗`;

    let msg = pct === 100 ? 'Perfect! 🎉' : pct >= 80 ? 'Great job! 👏' : pct >= 60 ? 'Good effort! 💪' : 'Keep practicing! 📚';
    $('scoreMessage').textContent = msg;

    const review = $('answersReview');
    review.innerHTML = '';
    answers.forEach((a, i) => {
        const dot = document.createElement('span');
        dot.className = 'answer-dot ' + (a.correct ? 'dot-correct' : 'dot-wrong');
        dot.textContent = i + 1;
        dot.title = `Q${i + 1}: ${a.correct ? '✓' : '✗'} — ${(a.question.question || '').substring(0, 80)}`;
        review.appendChild(dot);
    });

    const wrongCount = answers.filter(a => !a.correct).length;
    const retryBtn = $('retryWrongBtn');
    if (wrongCount > 0 && !isRetryMode) {
        retryBtn.textContent = `🔄 Retry ${wrongCount} Wrong (${questions.length - score})`;
        retryBtn.classList.remove('hidden');
    } else {
        retryBtn.classList.add('hidden');
    }

    saveScore(); renderScoreHistory();
}

function retryWrongAnswers() {
    const wrong = getWrongAnswers();
    if (!wrong.length) return;
    questions = shuffle(wrong);
    current = 0; score = 0; answers.length = 0; isRetryMode = true;
    $('questionCounter').textContent = `Retry: ${questions.length} wrong`;
    showQuestion();
}

function saveScore() {
    try {
        const raw = localStorage.getItem(SCORE_KEY);
        const history = raw ? JSON.parse(raw) : [];
        history.push({ correct: score, total: questions.length, filter: currentWeekFilter, date: new Date().toISOString() });
        if (history.length > 20) history.shift();
        localStorage.setItem(SCORE_KEY, JSON.stringify(history));
    } catch { /* ignore */ }
}

function getScoreHistory() {
    try { const raw = localStorage.getItem(SCORE_KEY); return raw ? JSON.parse(raw) : []; }
    catch { return []; }
}

function renderScoreHistory() {
    const history = getScoreHistory().slice(-3).reverse();
    const el = $('scoreHistory');
    if (!history.length) { hide('scoreHistory'); return; }

    const heading = document.createElement('strong');
    heading.textContent = 'Recent attempts';
    el.replaceChildren(heading);

    history.forEach(item => {
        const pct = item.total ? Math.round((item.correct / item.total) * 100) : 0;
        const row = document.createElement('div');
        row.className = 'history-row';
        row.textContent = `${item.filter === 'all' ? 'All' : item.filter}: ${item.correct}/${item.total} (${pct}%)`;
        el.appendChild(row);
    });
    show('scoreHistory');
}

function restart() {
    clearWrongAnswers();
    current = 0; score = 0; answers.length = 0; isRetryMode = false;
    showQuestion();
}

// ── Event bindings ──
$('nextBtn').onclick = () => { current++; current < questions.length ? showQuestion() : showResults(); };
$('restartBtn').onclick = restart;
$('headerRestartBtn').onclick = restart;
$('retryWrongBtn').onclick = retryWrongAnswers;
$('maqCheckBtn').onclick = checkMAQ;

// Keyboard
document.addEventListener('keydown', (e) => {
    if (!$('quizCard').classList.contains('hidden')) {
        const idx = OPTION_SHORTCUTS.indexOf(e.key.toUpperCase());
        if (idx >= 0) document.querySelectorAll('.option-btn')[idx]?.click();
        if (e.key === 'Enter' && !$('maqCheckBtn').classList.contains('hidden')) {
            e.preventDefault();
            checkMAQ();
        }
    }
    if (e.key === 'Enter') {
        if (answered && !$('nextBtn').classList.contains('hidden')) $('nextBtn').click();
        else if (!$('resultsCard').classList.contains('hidden')) $('restartBtn').click();
    }
});

// ── Init ──
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { buildWeekFilter(); loadQuestions('all'); });
} else {
    buildWeekFilter(); loadQuestions('all');
}
