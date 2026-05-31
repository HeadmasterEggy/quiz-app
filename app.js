let allQuestions = [];
let questions = [];
let current = 0;
let score = 0;
let answered = false;
const answers = [];
const SCORE_KEY = 'quiz_score_history';
const WRONG_KEY = 'quiz_wrong_answers';
const STATE_KEY = 'quiz_session_state';
const OPTION_SHORTCUTS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

let selectedMAQ = [];
let currentWeekFilter = 'all';
let isRetryMode = false;

const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');

function isMAQ(q) { return Array.isArray(q.correct); }

function isInteractiveTarget(target) {
    return target?.closest('button, input, select, textarea, [contenteditable="true"]');
}

// ── State persistence ──
function saveState() {
    if (isRetryMode) return; // don't persist retry sessions
    try {
        const state = {
            filter: currentWeekFilter,
            questionIds: questions.map(q => q.id),
            current, score,
            answers: answers.map(a => ({ qid: a.question.id, correct: a.correct })),
            timestamp: Date.now()
        };
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
}

function loadState() {
    try {
        const raw = localStorage.getItem(STATE_KEY);
        if (!raw) return null;
        const state = JSON.parse(raw);
        if (!state.questionIds || !state.questionIds.length) return null;
        // Expire after 24 hours
        if (Date.now() - state.timestamp > 86400000) {
            localStorage.removeItem(STATE_KEY);
            return null;
        }
        return state;
    } catch { return null; }
}

function clearState() {
    try { localStorage.removeItem(STATE_KEY); } catch { /* ignore */ }
}

// ── Resume from saved state ──
function resumeState(state) {
    currentWeekFilter = state.filter;
    // Look up questions by ID from allQuestions
    const lookup = {};
    allQuestions.forEach(q => lookup[q.id] = q);
    questions = state.questionIds.map(id => lookup[id]).filter(Boolean);
    if (!questions.length) return false;
    current = state.current;
    score = state.score;
    answers.length = 0;
    (state.answers || []).forEach(a => {
        const q = lookup[a.qid];
        if (q) answers.push({ question: q, correct: a.correct });
    });
    isRetryMode = false;
    // Update dropdown
    const sel = $('weekFilter');
    if (sel) sel.value = state.filter;
    return true;
}

// ── Load ──
function loadQuestions(filter = 'all', skipState = false) {
    currentWeekFilter = filter;
    hide('quizCard'); hide('resultsCard'); hide('resumeBanner');
    show('loadingCard');

    if (!window.QUIZ_DATA || !window.QUIZ_DATA.questions) {
        $('loadingCard').innerHTML = `<p style="color:var(--error)">No question data found</p>`;
        return;
    }

    allQuestions = window.QUIZ_DATA.questions || [];

    if (!skipState) {
        const saved = loadState();
        if (saved && saved.filter === filter && saved.current < saved.questionIds.length) {
            hide('loadingCard');
            showResumeBanner(saved);
            return;
        }
    }

    startFresh(filter);
}

function startFresh(filter) {
    clearState();
    currentWeekFilter = filter;
    questions = filter === 'all' ? [...allQuestions] : allQuestions.filter(q => q.week === filter);
    current = 0; score = 0; answers.length = 0; isRetryMode = false;
    hide('loadingCard');
    showQuestion();
}

function showResumeBanner(saved) {
    show('resumeBanner');
    const answeredCount = (saved.answers || []).length;
    const pct = answeredCount ? Math.round((saved.score / answeredCount) * 100) : 0;
    $('resumeText').textContent = `Saved: Q${(saved.current || 0) + 1}/${saved.questionIds.length} · Score ${saved.score}/${answeredCount} (${pct}%)`;
    $('resumeBtn').onclick = () => {
        if (resumeState(saved)) {
            hide('resumeBanner');
            hide('loadingCard');
            showQuestion();
            saveState();
        }
    };
    $('resumeDiscardBtn').onclick = () => {
        clearState();
        hide('resumeBanner');
        startFresh(currentWeekFilter);
    };
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

function renderOptions() {
    const q = questions[current];
    const opts = $('options');
    opts.innerHTML = '';
    const maq = isMAQ(q);
    const maqCount = maq ? q.correct.length : 0;
    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        const key = OPTION_SHORTCUTS[i];
        btn.innerHTML = `<span class="label">${key}</span><span class="text">${opt}</span>`;
        if (maq) btn.setAttribute('aria-pressed', 'false');
        btn.onclick = () => maq ? handleMAQClick(i, btn) : handleAnswer(i, btn);
        opts.appendChild(btn);
    });
    if (maq) {
        $('maqHint').innerHTML = `Pick <strong>${maqCount}</strong> answer${maqCount !== 1 ? 's' : ''}`;
        show('maqHint');
        hide('maqCheckBtn');
    }
    else { hide('maqHint'); hide('maqCheckBtn'); }
}

function showQuestion() {
    answered = false; selectedMAQ = [];
    if (current >= questions.length) { showResults(); return; }

    const q = questions[current];
    const source = q.week ? ` [${q.week}]` : '';
    $('questionCounter').textContent = `Q${current + 1} / ${questions.length}${source}`;
    $('progressFill').style.width = `${(current / questions.length) * 100}%`;
    $('questionText').textContent = q.question;
    renderOptions();
    hide('explanationInline'); hide('nextBtn');
    show('quizCard'); hide('resultsCard');
}

// ── MCQ ──
function handleAnswer(index, btn) {
    if (answered) return; answered = true;
    const q = questions[current];
    const allBtns = document.querySelectorAll('.option-btn');
    const isCorrect = index === q.correct;
    allBtns.forEach(b => b.classList.add('disabled'));
    btn.classList.add(isCorrect ? 'correct' : 'wrong');
    if (!isCorrect) allBtns[q.correct]?.classList.add('correct');
    if (isCorrect) score++;
    answers.push({ question: q, correct: isCorrect });
    if (!isCorrect) saveWrongAnswer(q);
    saveState();
    setTimeout(showInlineExplanation, 400, isCorrect, q);
}

// ── MAQ ──
function handleMAQClick(index, btn) {
    if (answered) return;
    const maxSelect = questions[current].correct.length;
    if (selectedMAQ.includes(index)) {
        selectedMAQ = selectedMAQ.filter(i => i !== index);
        btn.classList.remove('selected');
        btn.setAttribute('aria-pressed', 'false');
    } else if (selectedMAQ.length < maxSelect) {
        selectedMAQ.push(index);
        btn.classList.add('selected');
        btn.setAttribute('aria-pressed', 'true');
    }
    if (selectedMAQ.length === maxSelect) { show('maqCheckBtn'); $('maqCheckBtn').focus(); }
    else hide('maqCheckBtn');
}

function checkMAQ() {
    const q = questions[current];
    const maxSelect = q.correct.length;
    if (answered || selectedMAQ.length !== maxSelect) return; answered = true;
    const correctIdx = q.correct;
    const allBtns = document.querySelectorAll('.option-btn');
    const sortedSel = [...selectedMAQ].sort((a, b) => a - b);
    const sortedCorrect = [...correctIdx].sort((a, b) => a - b);
    const ok = sortedSel.length === sortedCorrect.length && sortedSel.every((val, i) => val === sortedCorrect[i]);
    allBtns.forEach(b => b.classList.add('disabled'));
    correctIdx.forEach(i => allBtns[i]?.classList.add('correct'));
    selectedMAQ.forEach(i => { if (!correctIdx.includes(i)) allBtns[i]?.classList.add('wrong'); });
    if (ok) score++;
    answers.push({ question: q, correct: ok });
    if (!ok) saveWrongAnswer(q);
    saveState();
    setTimeout(showInlineExplanation, 400, ok, q);
}

function showInlineExplanation(isCorrect, q) {
    const badge = $('resultBadge');
    badge.className = 'result-badge ' + (isCorrect ? 'correct' : 'wrong');
    badge.textContent = isCorrect ? '✓ Correct!' : '✗ Wrong';
    $('explanationText').textContent = q.explanation || '';
    hide('maqHint'); hide('maqCheckBtn');
    show('explanationInline'); show('nextBtn');
    $('nextBtn').disabled = false;
    $('nextBtn').textContent = current < questions.length - 1 ? 'Next →' : 'See Results 🏆';
    $('nextBtn').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Wrong answers ──
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

// ── Results ──
function showResults() {
    clearState();
    hide('quizCard'); hide('nextBtn'); show('resultsCard');
    $('progressFill').style.width = '100%';
    const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;
    $('finalScore').textContent = `${score}/${questions.length}`;
    $('scorePercentage').textContent = `${pct}%`;
    $('scoreBreakdown').textContent = `${score} ✓ · ${questions.length - score} ✗`;
    $('scoreMessage').textContent = pct === 100 ? 'Perfect! 🎉' : pct >= 80 ? 'Great job! 👏' : pct >= 60 ? 'Good effort! 💪' : 'Keep practicing! 📚';

    const review = $('answersReview'); review.innerHTML = '';
    answers.forEach((a, i) => {
        const dot = document.createElement('span');
        dot.className = 'answer-dot ' + (a.correct ? 'dot-correct' : 'dot-wrong');
        dot.textContent = i + 1;
        dot.title = `Q${i + 1}: ${a.correct ? '✓' : '✗'} — ${(a.question.question || '').substring(0, 80)}`;
        review.appendChild(dot);
    });

    const wrongCount = answers.filter(a => !a.correct).length;
    if (wrongCount > 0 && !isRetryMode) {
        $('retryWrongBtn').textContent = `🔄 Retry ${wrongCount} Wrong`;
        show('retryWrongBtn');
    } else hide('retryWrongBtn');

    saveScore(); renderScoreHistory();
}

function retryWrongAnswers() {
    // Use current session's wrong answers, not all-time localStorage (avoids mixing weeks)
    const wrongQs = answers.filter(a => !a.correct).map(a => a.question);
    if (!wrongQs.length) return;
    clearState();
    questions = wrongQs; current = 0; score = 0; answers.length = 0; isRetryMode = true;
    $('questionCounter').textContent = `Retry: ${questions.length} wrong`;
    showQuestion();
}

// ── Score history ──
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
    el.innerHTML = '<strong>Recent</strong>';
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
    clearState(); clearWrongAnswers();
    current = 0; score = 0; answers.length = 0; isRetryMode = false;
    showQuestion();
}

// ── Event bindings ──
$('nextBtn').onclick = () => {
    if ($('nextBtn').disabled) return;
    $('nextBtn').disabled = true;
    current++;
    if (current < questions.length) { saveState(); showQuestion(); }
    else showResults();
};
$('restartBtn').onclick = restart;
$('headerRestartBtn').onclick = restart;
$('retryWrongBtn').onclick = retryWrongAnswers;
$('maqCheckBtn').onclick = checkMAQ;

document.addEventListener('keydown', (e) => {
    if (isInteractiveTarget(e.target)) return;

    if (!$('quizCard').classList.contains('hidden')) {
        const idx = OPTION_SHORTCUTS.indexOf(e.key.toUpperCase());
        if (idx >= 0) document.querySelectorAll('.option-btn')[idx]?.click();
        if (e.key === 'Enter' && !$('maqCheckBtn').classList.contains('hidden')) {
            e.preventDefault(); checkMAQ();
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
