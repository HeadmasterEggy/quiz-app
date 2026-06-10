let allQuestions = [];
let questions = [];
let current = 0;
let score = 0;
let answered = false;
const answers = [];
const THEME_KEY = 'quiz_theme';
const SHUFFLE_KEY = 'quiz_shuffle_enabled';
const OPTION_SHORTCUTS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

let selectedMAQ = [];
let currentCourseFilter = 'all';
let currentWeekFilter = 'all';
let shuffleEnabled = false;
let isRetryMode = false;
let explanationTimeout = null;

const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');

function isMAQ(q) { return Array.isArray(q.correct); }

function isInteractiveTarget(target) {
    return target?.closest('button, input, select, textarea, [contenteditable="true"]');
}

// Set text that may contain $...$ LaTeX, rendering it with KaTeX when available.
// Falls back to plain text if KaTeX hasn't loaded (e.g. offline / CDN blocked).
function setMath(el, str) {
    if (!el) return;
    el.textContent = str || '';
    if (window.renderMathInElement) {
        try {
            renderMathInElement(el, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '\\[', right: '\\]', display: true },
                    { left: '\\(', right: '\\)', display: false },
                    { left: '$', right: '$', display: false }
                ],
                throwOnError: false
            });
        } catch (e) { /* leave plain text on render error */ }
    }
}

function getCourses() {
    return window.QUIZ_DATA?.courses || [...new Set((window.QUIZ_DATA?.questions || []).map(q => q.course).filter(Boolean))];
}

function getWeeksForCourse(course) {
    if (!course || course === 'all') return [];
    return window.QUIZ_DATA?.weeksByCourse?.[course] || [...new Set((window.QUIZ_DATA?.questions || []).filter(q => q.course === course).map(q => q.week).filter(Boolean))];
}

function getFilteredQuestions(course, week) {
    return allQuestions.filter(q => {
        const matchesCourse = course === 'all' || q.course === course;
        const matchesWeek = week === 'all' || q.week === week;
        return matchesCourse && matchesWeek;
    });
}

function shuffled(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function groupedShuffleByCourse(items) {
    const grouped = new Map();
    items.forEach(q => {
        const key = q.course || 'Other';
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(q);
    });

    const configuredCourses = getCourses();
    const orderedCourses = [
        ...configuredCourses.filter(course => grouped.has(course)),
        ...[...grouped.keys()].filter(course => !configuredCourses.includes(course))
    ];

    return orderedCourses.flatMap(course => shuffled(grouped.get(course)));
}

function orderQuestions(items, course) {
    if (!shuffleEnabled) return [...items];
    return course === 'all' ? groupedShuffleByCourse(items) : shuffled(items);
}

function getShuffleScopeLabel() {
    if (currentCourseFilter === 'all') return 'by course';
    return currentWeekFilter === 'all' ? currentCourseFilter : `${currentCourseFilter} · ${currentWeekFilter}`;
}

function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Subtle haptics on touch devices that support it (no-op elsewhere)
function hapticFeedback(pattern) {
    if (prefersReducedMotion()) return;
    try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
}

function isCompactViewport() {
    return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
}

function afterLayout(fn) {
    if (window.requestAnimationFrame) {
        window.requestAnimationFrame(() => window.requestAnimationFrame(fn));
    } else {
        setTimeout(() => setTimeout(fn, 0), 0);
    }
}

function scrollActionIntoView(id) {
    const el = $(id);
    if (!el || el.classList.contains('hidden')) return;
    const block = isCompactViewport() ? 'end' : 'nearest';
    afterLayout(() => {
        if (!el.classList.contains('hidden')) {
            el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block, inline: 'nearest' });
        }
    });
}

// ── Theme ──
function applyTheme(theme) {
    const dark = theme !== 'light';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0f172a' : '#eef2ff');
    const btn = $('themeToggleBtn');
    if (btn) {
        btn.textContent = dark ? '☀️' : '🌙';
        const label = dark ? 'Switch to light theme' : 'Switch to dark theme';
        btn.title = label;
        btn.setAttribute('aria-label', label);
    }
}

function initTheme() {
    // The inline <head> script already set data-theme to avoid a flash; sync the button to it.
    let theme = document.documentElement.getAttribute('data-theme');
    if (theme !== 'light' && theme !== 'dark') {
        try { theme = localStorage.getItem(THEME_KEY); } catch { theme = null; }
        if (theme !== 'light' && theme !== 'dark') {
            theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        }
    }
    applyTheme(theme);
}

function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
}

function initShuffle() {
    try { shuffleEnabled = localStorage.getItem(SHUFFLE_KEY) === 'true'; }
    catch { shuffleEnabled = false; }
    updateShuffleButton();
}

function saveShufflePreference() {
    try { localStorage.setItem(SHUFFLE_KEY, shuffleEnabled ? 'true' : 'false'); }
    catch { /* ignore */ }
}

function clearLegacyQuizMemory() {
    try {
        localStorage.removeItem('quiz_score_history');
        localStorage.removeItem('quiz_wrong_answers');
        if (typeof localStorage.key === 'function') {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key?.startsWith('quiz_session_state_')) localStorage.removeItem(key);
            }
        }
    } catch { /* ignore */ }
}

// ── Load ──
function loadQuestions(course = 'all', week = 'all') {
    currentCourseFilter = course;
    currentWeekFilter = week;
    hide('quizCard'); hide('resultsCard');
    show('loadingCard');

    if (!window.QUIZ_DATA || !window.QUIZ_DATA.questions) {
        $('loadingCard').innerHTML = `<p style="color:var(--error)">No question data found</p>`;
        return;
    }

    allQuestions = window.QUIZ_DATA.questions || [];
    startFresh(course, week);
}

function startFresh(course = 'all', week = 'all') {
    currentCourseFilter = course;
    currentWeekFilter = week;
    const filtered = getFilteredQuestions(course, week);
    questions = orderQuestions(filtered, course);
    current = 0; score = 0; answers.length = 0; isRetryMode = false;
    updateShuffleButton();
    hide('loadingCard');
    showQuestion();
}

function buildCourseFilter() {
    const sel = $('courseFilter');
    if (!sel) return;
    sel.innerHTML = '<option value="all">All Courses</option>';
    getCourses().forEach(course => {
        const count = (window.QUIZ_DATA.questions || []).filter(q => q.course === course).length;
        const option = document.createElement('option');
        option.value = course;
        option.textContent = `${course} (${count} Qs)`;
        sel.appendChild(option);
    });
    sel.value = currentCourseFilter;
    sel.onchange = () => {
        currentCourseFilter = sel.value;
        currentWeekFilter = 'all';
        buildWeekFilter();
        loadQuestions(currentCourseFilter, currentWeekFilter);
    };
}

function buildWeekFilter() {
    const sel = $('weekFilter');
    sel.innerHTML = `<option value="all">${currentCourseFilter === 'all' ? 'All Weeks & Exams' : `All ${currentCourseFilter} Weeks & Exams`}</option>`;
    const weeks = getWeeksForCourse(currentCourseFilter);
    weeks.forEach(w => {
        const count = (window.QUIZ_DATA.questions || []).filter(q => q.course === currentCourseFilter && q.week === w).length;
        const option = document.createElement('option');
        option.value = w;
        option.textContent = `${w} (${count} Qs)`;
        sel.appendChild(option);
    });
    sel.value = currentWeekFilter;
    sel.disabled = currentCourseFilter === 'all';
    sel.title = sel.disabled ? 'Select a course to filter by week' : 'Filter by week';
    sel.onchange = () => loadQuestions(currentCourseFilter, sel.value);
}

function updateShuffleButton() {
    const btn = $('shuffleToggleBtn');
    if (!btn) return;
    btn.setAttribute('aria-pressed', shuffleEnabled ? 'true' : 'false');
    const scope = getShuffleScopeLabel();
    const label = shuffleEnabled ? `Shuffle on: ${scope}` : `Shuffle off: ${scope}`;
    btn.title = label;
    btn.setAttribute('aria-label', label);
}

function toggleShuffle() {
    shuffleEnabled = !shuffleEnabled;
    saveShufflePreference();
    updateShuffleButton();
    startFresh(currentCourseFilter, currentWeekFilter);
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
        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = key;
        const text = document.createElement('span');
        text.className = 'text';
        setMath(text, opt);
        btn.append(label, text);
        if (maq) btn.setAttribute('aria-pressed', 'false');
        btn.onclick = () => maq ? handleMAQClick(i, btn) : handleAnswer(i, btn);
        opts.appendChild(btn);
    });
    if (maq) {
        updateMaqHint();
        show('maqHint');
        hide('maqCheckBtn');
    }
    else { hide('maqHint'); hide('maqCheckBtn'); }
}

function updateMaqHint() {
    const q = questions[current];
    if (!q || !isMAQ(q)) return;
    const n = q.correct.length;
    const base = `Pick <strong>${n}</strong> answer${n !== 1 ? 's' : ''}`;
    $('maqHint').innerHTML = selectedMAQ.length ? `${base} · <strong>${selectedMAQ.length}/${n}</strong> selected` : base;
}

function showQuestion() {
    if (explanationTimeout) { clearTimeout(explanationTimeout); explanationTimeout = null; }
    answered = false; selectedMAQ = [];
    if (current >= questions.length) { showResults(); return; }

    const q = questions[current];
    const counter = $('questionCounter');
    counter.textContent = '';
    const num = document.createElement('span');
    num.className = 'counter-num';
    num.textContent = `Q${current + 1} / ${questions.length}`;
    counter.appendChild(num);
    const sourceParts = [q.course, q.week].filter(Boolean);
    if (sourceParts.length) {
        const chip = document.createElement('span');
        chip.className = 'counter-chip';
        chip.textContent = sourceParts.join(' · ');
        chip.title = chip.textContent;
        counter.appendChild(chip);
    }
    $('progressFill').style.width = `${(current / questions.length) * 100}%`;
    const questionText = $('questionText');
    setMath(questionText, q.question);
    questionText.classList.remove('q-fade');
    void questionText.offsetWidth;
    questionText.classList.add('q-fade');
    renderOptions();
    hide('explanationInline'); hide('nextBtn');
    show('quizCard'); hide('resultsCard');
}

function scrollQuizIntoView() {
    $('quizCard').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
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
    hapticFeedback(isCorrect ? 12 : [10, 60, 18]);
    answers.push({ question: q, correct: isCorrect });
    explanationTimeout = setTimeout(showInlineExplanation, 400, isCorrect, q);
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
        hapticFeedback(8);
    }
    updateMaqHint();
    if (selectedMAQ.length === maxSelect) {
        show('maqCheckBtn');
        // On compact viewports the check button is sticky-pinned, so it is already visible
        if (!isCompactViewport()) scrollActionIntoView('maqCheckBtn');
    } else hide('maqCheckBtn');
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
    hapticFeedback(ok ? 12 : [10, 60, 18]);
    answers.push({ question: q, correct: ok });
    explanationTimeout = setTimeout(showInlineExplanation, 400, ok, q);
}

function showInlineExplanation(isCorrect, q) {
    const badge = $('resultBadge');
    badge.className = 'result-badge ' + (isCorrect ? 'correct' : 'wrong');
    badge.textContent = isCorrect ? '✓ Correct!' : '✗ Wrong';
    setMath($('explanationText'), q.explanation);
    hide('maqHint'); hide('maqCheckBtn');
    show('explanationInline'); show('nextBtn');
    $('nextBtn').disabled = false;
    $('nextBtn').textContent = current < questions.length - 1 ? 'Next →' : 'See Results 🏆';
    // On compact viewports the next button is sticky-pinned, so bring the explanation into view instead
    scrollActionIntoView(isCompactViewport() ? 'explanationInline' : 'nextBtn');
}

// ── Results ──
function showResults() {
    hide('quizCard'); hide('nextBtn'); show('resultsCard');
    $('progressFill').style.width = '100%';
    $('questionCounter').textContent = `Done · ${questions.length} question${questions.length !== 1 ? 's' : ''}`;
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

}

function retryWrongAnswers() {
    const wrongQs = answers.filter(a => !a.correct).map(a => a.question);
    if (!wrongQs.length) return;
    questions = orderQuestions(wrongQs, currentCourseFilter);
    current = 0; score = 0; answers.length = 0; isRetryMode = true;
    $('questionCounter').textContent = `Retry: ${questions.length} wrong`;
    showQuestion();
}

function restart() {
    startFresh(currentCourseFilter, currentWeekFilter);
}

// ── Event bindings ──
$('nextBtn').onclick = () => {
    if ($('nextBtn').disabled) return;
    $('nextBtn').disabled = true;
    current++;
    if (current < questions.length) { showQuestion(); scrollQuizIntoView(); }
    else showResults();
};
$('restartBtn').onclick = restart;
$('headerRestartBtn').onclick = restart;
$('retryWrongBtn').onclick = retryWrongAnswers;
$('maqCheckBtn').onclick = checkMAQ;
$('shuffleToggleBtn').onclick = toggleShuffle;
var themeBtn = $('themeToggleBtn');
if (themeBtn) themeBtn.onclick = toggleTheme;
else console.warn('themeToggleBtn not found in DOM');

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
    document.addEventListener('DOMContentLoaded', () => { initTheme(); clearLegacyQuizMemory(); initShuffle(); buildCourseFilter(); buildWeekFilter(); loadQuestions('all', 'all'); });
} else {
    initTheme(); clearLegacyQuizMemory(); initShuffle(); buildCourseFilter(); buildWeekFilter(); loadQuestions('all', 'all');
}
