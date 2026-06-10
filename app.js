let allQuestions = [];
let questions = [];
let current = 0;
let answered = false;
// Sparse array keyed by question position, so jumping around keeps scoring correct
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
    return target?.closest?.('button, input, select, textarea, [contenteditable="true"]');
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

// Return a copy of the question with its options reordered and `correct` remapped,
// so the original data in QUIZ_DATA is never mutated.
function withShuffledOptions(q) {
    const order = shuffled(q.options.map((_, i) => i));
    const remap = i => order.indexOf(i);
    return {
        ...q,
        options: order.map(i => q.options[i]),
        correct: Array.isArray(q.correct) ? q.correct.map(remap) : remap(q.correct)
    };
}

function orderQuestions(items, course) {
    if (!shuffleEnabled) return [...items];
    const arranged = course === 'all' ? groupedShuffleByCourse(items) : shuffled(items);
    return arranged.map(withShuffledOptions);
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
    current = 0; answers.length = 0; isRetryMode = false;
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
        closeDrawer();
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
    sel.onchange = () => { closeDrawer(); loadQuestions(currentCourseFilter, sel.value); };
}

function updateShuffleButton() {
    const btn = $('shuffleToggleBtn');
    if (!btn) return;
    btn.setAttribute('aria-pressed', shuffleEnabled ? 'true' : 'false');
    const scope = getShuffleScopeLabel();
    const label = shuffleEnabled ? `Shuffle on (questions & options): ${scope}` : `Shuffle off: ${scope}`;
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
    if (isJumpOpen()) closeJumpPanel();
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
    const caret = document.createElement('span');
    caret.className = 'counter-caret';
    caret.textContent = '▾';
    counter.appendChild(caret);
    $('progressFill').style.width = `${(current / questions.length) * 100}%`;
    const questionText = $('questionText');
    setMath(questionText, q.question);
    questionText.classList.remove('q-fade');
    void questionText.offsetWidth;
    questionText.classList.add('q-fade');
    renderOptions();
    hide('explanationInline'); hide('nextBtn');
    show('revealBtn');
    show('quizCard'); hide('resultsCard');
    updateNavButtons();
}

function updateNavButtons() {
    const prev = $('prevNavBtn');
    const next = $('nextNavBtn');
    if (!prev || !next) return;
    const onResults = !$('resultsCard').classList.contains('hidden');
    prev.disabled = !questions.length || (!onResults && current === 0);
    next.disabled = !questions.length || onResults;
}

function navPrev() {
    if (!questions.length) return;
    const onResults = !$('resultsCard').classList.contains('hidden');
    if (onResults) {
        current = Math.min(current, questions.length - 1);
        showQuestion();
        scrollQuizIntoView();
        return;
    }
    if (current > 0) {
        current--;
        showQuestion();
    }
}

function navNext() {
    if (!questions.length) return;
    if (!$('resultsCard').classList.contains('hidden')) return;
    if (current < questions.length - 1) {
        current++;
        showQuestion();
    } else {
        showResults();
    }
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
    hapticFeedback(isCorrect ? 12 : [10, 60, 18]);
    answers[current] = { question: q, correct: isCorrect };
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
    hapticFeedback(ok ? 12 : [10, 60, 18]);
    answers[current] = { question: q, correct: ok };
    explanationTimeout = setTimeout(showInlineExplanation, 400, ok, q);
}

function showInlineExplanation(isCorrect, q) {
    const badge = $('resultBadge');
    badge.className = 'result-badge ' + (isCorrect ? 'correct' : 'wrong');
    badge.textContent = isCorrect ? '✓ Correct!' : '✗ Wrong';
    setMath($('explanationText'), q.explanation);
    if (isJumpOpen()) buildJumpGrid();
    hide('maqHint'); hide('maqCheckBtn'); hide('revealBtn');
    show('explanationInline'); show('nextBtn');
    $('nextBtn').disabled = false;
    $('nextBtn').textContent = current < questions.length - 1 ? 'Next →' : 'See Results 🏆';
    // On compact viewports the next button is sticky-pinned, so bring the explanation into view instead
    scrollActionIntoView(isCompactViewport() ? 'explanationInline' : 'nextBtn');
}

// Reveal the correct answer without recording a score (question stays unanswered)
function revealAnswer() {
    if (answered || current >= questions.length) return;
    answered = true;
    const q = questions[current];
    const allBtns = document.querySelectorAll('.option-btn');
    const correctIdx = isMAQ(q) ? q.correct : [q.correct];
    allBtns.forEach(b => b.classList.add('disabled'));
    correctIdx.forEach(i => allBtns[i]?.classList.add('correct'));
    const badge = $('resultBadge');
    badge.className = 'result-badge revealed';
    badge.textContent = '👁 Answer revealed · not scored';
    setMath($('explanationText'), q.explanation);
    hide('maqHint'); hide('maqCheckBtn'); hide('revealBtn');
    show('explanationInline'); show('nextBtn');
    $('nextBtn').disabled = false;
    $('nextBtn').textContent = current < questions.length - 1 ? 'Next →' : 'See Results 🏆';
    scrollActionIntoView(isCompactViewport() ? 'explanationInline' : 'nextBtn');
}

// ── Results ──
function showResults() {
    if (isJumpOpen()) closeJumpPanel();
    hide('quizCard'); hide('nextBtn'); show('resultsCard');
    $('progressFill').style.width = '100%';
    $('questionCounter').textContent = `Done · ${questions.length} question${questions.length !== 1 ? 's' : ''}`;
    const total = questions.length;
    const correct = answers.filter(a => a && a.correct).length;
    const answeredCount = answers.filter(Boolean).length;
    const wrong = answeredCount - correct;
    const skipped = total - answeredCount;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    $('finalScore').textContent = `${correct}/${total}`;
    $('scorePercentage').textContent = `${pct}%`;
    $('scoreBreakdown').textContent = `${correct} ✓ · ${wrong} ✗` + (skipped ? ` · ${skipped} skipped` : '');
    $('scoreMessage').textContent = pct === 100 ? 'Perfect! 🎉' : pct >= 80 ? 'Great job! 👏' : pct >= 60 ? 'Good effort! 💪' : 'Keep practicing! 📚';

    const review = $('answersReview'); review.innerHTML = '';
    for (let i = 0; i < total; i++) {
        const a = answers[i];
        const dot = document.createElement('span');
        dot.className = 'answer-dot ' + (a ? (a.correct ? 'dot-correct' : 'dot-wrong') : 'dot-skipped');
        dot.textContent = i + 1;
        dot.title = a
            ? `Q${i + 1}: ${a.correct ? '✓' : '✗'} — ${(a.question.question || '').substring(0, 80)}`
            : `Q${i + 1}: skipped`;
        review.appendChild(dot);
    }

    const wrongCount = wrong;
    if (wrongCount > 0 && !isRetryMode) {
        $('retryWrongBtn').textContent = `🔄 Retry ${wrongCount} Wrong`;
        show('retryWrongBtn');
    } else hide('retryWrongBtn');

    updateNavButtons();
}

function retryWrongAnswers() {
    const wrongQs = answers.filter(a => a && !a.correct).map(a => a.question);
    if (!wrongQs.length) return;
    questions = orderQuestions(wrongQs, currentCourseFilter);
    current = 0; answers.length = 0; isRetryMode = true;
    showQuestion();
}

// ── Settings drawer (mobile) ──
function isDrawerOpen() {
    const el = $('headerControls');
    return el ? el.classList.contains('open') : false;
}

function openDrawer() {
    $('headerControls').classList.add('open');
    show('drawerBackdrop');
    $('menuBtn').setAttribute('aria-expanded', 'true');
    document.body.classList.add('drawer-open');
}

function closeDrawer() {
    $('headerControls').classList.remove('open');
    hide('drawerBackdrop');
    $('menuBtn').setAttribute('aria-expanded', 'false');
    document.body.classList.remove('drawer-open');
}

function toggleDrawer() {
    if (isDrawerOpen()) closeDrawer();
    else openDrawer();
}

// ── Jump-to-question panel ──
function isJumpOpen() {
    const panel = $('jumpPanel');
    return panel ? !panel.classList.contains('hidden') : false;
}

function buildJumpGrid() {
    const grid = $('jumpGrid');
    grid.innerHTML = '';
    questions.forEach((q, i) => {
        const chip = document.createElement('button');
        chip.className = 'jump-chip';
        const a = answers[i];
        if (a) chip.classList.add(a.correct ? 'answered-correct' : 'answered-wrong');
        if (i === current) chip.classList.add('current');
        chip.textContent = i + 1;
        const sourceParts = [q.course, q.week].filter(Boolean);
        chip.title = `Q${i + 1}` + (sourceParts.length ? ` · ${sourceParts.join(' · ')}` : '') + (a ? (a.correct ? ' · ✓' : ' · ✗') : '');
        chip.onclick = () => jumpToQuestion(i);
        grid.appendChild(chip);
    });
}

function openJumpPanel() {
    buildJumpGrid();
    show('jumpPanel');
    $('questionCounter').setAttribute('aria-expanded', 'true');
    const cur = document.querySelector('.jump-chip.current');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
}

function closeJumpPanel() {
    hide('jumpPanel');
    $('questionCounter').setAttribute('aria-expanded', 'false');
}

function toggleJumpPanel() {
    if (!questions.length) return;
    if (isJumpOpen()) closeJumpPanel();
    else openJumpPanel();
}

function jumpToQuestion(i) {
    if (i < 0 || i >= questions.length) return;
    current = i;
    showQuestion();
    scrollQuizIntoView();
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
$('headerRestartBtn').onclick = () => { closeDrawer(); restart(); };
$('retryWrongBtn').onclick = retryWrongAnswers;
$('maqCheckBtn').onclick = checkMAQ;
$('shuffleToggleBtn').onclick = () => { closeDrawer(); toggleShuffle(); };
$('questionCounter').onclick = toggleJumpPanel;
$('menuBtn').onclick = toggleDrawer;
$('drawerCloseBtn').onclick = closeDrawer;
$('drawerBackdrop').onclick = closeDrawer;
$('prevNavBtn').onclick = navPrev;
$('nextNavBtn').onclick = navNext;
$('revealBtn').onclick = revealAnswer;
$('jumpResultsBtn').onclick = () => { closeJumpPanel(); showResults(); };

document.addEventListener('click', (e) => {
    if (!isJumpOpen()) return;
    if (e.target.closest('#jumpPanel') || e.target.closest('#questionCounter')) return;
    closeJumpPanel();
});
var themeBtn = $('themeToggleBtn');
if (themeBtn) themeBtn.onclick = toggleTheme;
else console.warn('themeToggleBtn not found in DOM');

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (isDrawerOpen()) { closeDrawer(); return; }
        if (isJumpOpen()) { closeJumpPanel(); return; }
    }
    if (isInteractiveTarget(e.target)) return;

    if (e.key === 'ArrowLeft') { e.preventDefault(); navPrev(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); navNext(); return; }

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
