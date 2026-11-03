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

// Per-question history (mistakes book). Only right/wrong counts per question id are
// kept; an in-progress run is never saved or resumed.
const STATS_KEY = 'quiz_question_stats_v1';
const LAST_FILTER_KEY = 'quiz_last_filter_v1';
let questionStats = {};
let poolFilter = 'all';            // 'all' | 'unseen' | 'mistakes'
let examMode = false;
let examSubmitted = false;
let resultsShown = false;
const LANG_KEY = 'quiz_lang_v1';
const LANG_MODES = ['both', 'en', 'zh'];   // 中英对照 · English only · 中文 only
const LANG_LABELS = { both: '中/EN', en: 'EN', zh: '中' };
let langMode = 'both';

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

// Show English, Chinese, or both (Chinese underneath, muted) depending on the language mode.
function setBilingual(el, en, zh) {
    if (!el) return;
    const hasZh = zh && zh !== en;
    if (!hasZh || langMode === 'en') { setMath(el, en); return; }
    if (langMode === 'zh') { setMath(el, zh); return; }
    el.textContent = '';
    const top = document.createElement('span');
    top.className = 'bi-en';
    const sub = document.createElement('span');
    sub.className = 'bi-zh';
    sub.lang = 'zh';
    el.append(top, sub);
    setMath(top, en);
    setMath(sub, zh);
}

function initLang() {
    try { const v = localStorage.getItem(LANG_KEY); if (LANG_MODES.includes(v)) langMode = v; } catch { /* ignore */ }
    updateLangButton();
}

function updateLangButton() {
    const btn = $('langToggleBtn');
    if (!btn) return;
    const names = { both: '中英对照 Chinese + English', en: 'English only', zh: '只看中文 Chinese only' };
    btn.querySelector('.tool-icon').textContent = LANG_LABELS[langMode];
    btn.title = `Language: ${names[langMode]} (L to switch)`;
    btn.setAttribute('aria-label', btn.title);
}

function cycleLang() {
    langMode = LANG_MODES[(LANG_MODES.indexOf(langMode) + 1) % LANG_MODES.length];
    try { localStorage.setItem(LANG_KEY, langMode); } catch { /* ignore */ }
    updateLangButton();
    rerenderTexts();
}

// Re-render the question and option texts in place, keeping the answer state.
function rerenderTexts() {
    const q = questions[current];
    if (!q || $('quizCard').classList.contains('hidden')) return;
    setBilingual($('questionText'), q.question, q.questionZh);
    document.querySelectorAll('#options .option-btn .text').forEach((el, i) => setBilingual(el, q.options[i], q.optionsZh?.[i]));
}

function extractEmbeddedKnowledgeLocation(str) {
    return (str || '').match(/\n知识点：(.+)$/)?.[1]?.trim() || '';
}

function cleanExplanationText(str) {
    return (str || '').replace(/\n知识点：.+$/, '').trim();
}

function getKnowledgeLocation(q) {
    if (!q) return '';
    if (q.knowledgeLocation) return q.knowledgeLocation;
    const embedded = extractEmbeddedKnowledgeLocation(q.explanation);
    if (embedded) return embedded;
    return '';
}

// ── Question history (mistakes book) ──
function loadStats() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
}

function saveStats() {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(questionStats)); } catch { /* ignore */ }
}

function getStat(q) {
    return q && q.id != null ? questionStats[String(q.id)] : undefined;
}

function recordAttempt(q, ok) {
    if (!q || q.id == null) return;
    const key = String(q.id);
    const s = questionStats[key] || { c: 0, w: 0 };
    if (ok) s.c++; else s.w++;
    s.last = ok ? 1 : 0;
    s.t = Date.now();
    questionStats[key] = s;
    saveStats();
}

function isMistake(q) { const s = getStat(q); return !!s && s.last === 0; }
function isUnseen(q) { return !getStat(q); }

function matchesPool(q, pool) {
    if (pool === 'unseen') return isUnseen(q);
    if (pool === 'mistakes') return isMistake(q);
    return true;
}

function clearStats() {
    if (!window.confirm('Clear your answer history and mistakes book on this device?')) return;
    questionStats = {};
    saveStats();
    if (poolFilter !== 'all') poolFilter = 'all';
    saveLastFilter();
    buildPoolControls();
    startFresh(currentCourseFilter, currentWeekFilter);
}

function saveLastFilter() {
    try {
        localStorage.setItem(LAST_FILTER_KEY, JSON.stringify({ course: currentCourseFilter, week: currentWeekFilter, pool: poolFilter }));
    } catch { /* ignore */ }
}

function loadLastFilter() {
    try { return JSON.parse(localStorage.getItem(LAST_FILTER_KEY) || 'null'); } catch { return null; }
}

// Short topic name used to group results, taken from the knowledge location.
function topicOf(q) {
    if (q.topic) return q.topic;
    const parts = getKnowledgeLocation(q).split(' / ').map(p => p.trim()).filter(Boolean);
    if (!parts.length) return q.week || 'Other';
    // Exam-sourced locations start with "Practice Exam 1 Q3" etc.; the topic follows.
    if (/exam|quiz/i.test(parts[0]) && parts[1]) return parts[1];
    return parts[0];
}

function renderQuestionTags(q) {
    const el = $('qTags');
    if (!el) return;
    el.innerHTML = '';
    if (q.unofficialAnswer) {
        const tag = document.createElement('span');
        tag.className = 'q-tag q-tag-warn';
        tag.textContent = '⚠ Unofficial answer key';
        tag.title = 'No official answers were released for this paper. The key was worked out independently, so double-check it.';
        el.appendChild(tag);
    }
    const s = getStat(q);
    if (s && !(examMode && !examSubmitted)) {
        const tag = document.createElement('span');
        tag.className = 'q-tag ' + (s.last === 0 ? 'q-tag-miss' : 'q-tag-seen');
        tag.textContent = s.last === 0 ? `📕 Missed last time · ✓${s.c} ✗${s.w}` : `Seen · ✓${s.c} ✗${s.w}`;
        el.appendChild(tag);
    }
    el.classList.toggle('hidden', !el.childElementCount);
}

function getNotesUrl(q) {
    const links = window.QUIZ_DATA?.notesLinks?.[q.course];
    return links && q.lectureWeek ? links[q.lectureWeek] || '' : '';
}

// `selected` is the chosen option index (or array for multi-answer); null when the answer was only revealed.
function renderExplanation(q, selected = null) {
    const el = $('explanationText');
    if (!el) return;
    el.innerHTML = '';
    const correctIdx = isMAQ(q) ? q.correct : [q.correct];
    const chosen = selected == null ? [] : (Array.isArray(selected) ? selected : [selected]);
    const notes = Array.isArray(q.optionNotes) ? q.optionNotes : null;

    const location = getKnowledgeLocation(q);
    const notesUrl = getNotesUrl(q);
    if (location || notesUrl) {
        const row = document.createElement('div');
        row.className = 'knowledge-location';
        const label = document.createElement('span');
        label.className = 'knowledge-label';
        label.textContent = '知识点位置';
        const text = document.createElement('span');
        text.className = 'knowledge-text';
        setMath(text, location || q.lectureWeek || '');
        row.append(label, text);
        if (notesUrl) {
            const link = document.createElement('a');
            link.className = 'notes-link';
            link.href = notesUrl;
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = '📖 复习笔记';
            link.title = `Open the ${q.course} ${q.lectureWeek} notes on the blog`;
            row.appendChild(link);
        }
        el.appendChild(row);
    }

    if (q.unofficialAnswer) {
        const warn = document.createElement('div');
        warn.className = 'unofficial-note';
        warn.textContent = '⚠ Unofficial answer: no official key was released for this paper. Double-check before relying on it.';
        el.appendChild(warn);
    }

    // Why the option you picked is wrong, before anything else
    const wrongPicks = chosen.filter(i => !correctIdx.includes(i));
    if (notes && wrongPicks.length) {
        const box = document.createElement('div');
        box.className = 'why-wrong';
        wrongPicks.forEach(i => {
            const line = document.createElement('div');
            const head = document.createElement('strong');
            head.textContent = `✗ You chose ${OPTION_SHORTCUTS[i]}: `;
            const body = document.createElement('span');
            setMath(body, notes[i] || '');
            line.append(head, body);
            box.appendChild(line);
        });
        const right = document.createElement('div');
        const head = document.createElement('strong');
        head.textContent = `✓ ${correctIdx.map(i => OPTION_SHORTCUTS[i]).join(', ')}: `;
        const body = document.createElement('span');
        setMath(body, correctIdx.map(i => notes[i]).filter(Boolean).join(' '));
        right.append(head, body);
        box.appendChild(right);
        el.appendChild(box);
    }

    if (q.explanationZh) {
        const zh = document.createElement('div');
        zh.className = 'explanation-zh';
        const tag = document.createElement('span');
        tag.className = 'zh-tag';
        tag.textContent = '要点';
        const text = document.createElement('span');
        setMath(text, q.explanationZh);
        zh.append(tag, text);
        el.appendChild(zh);
    }

    if (Array.isArray(q.steps) && q.steps.length) {
        const ol = document.createElement('ol');
        ol.className = 'explanation-steps';
        q.steps.forEach(step => {
            const li = document.createElement('li');
            setMath(li, step);
            ol.appendChild(li);
        });
        el.appendChild(ol);
    }

    const body = document.createElement('div');
    body.className = 'explanation-body';
    setMath(body, cleanExplanationText(q.explanation));
    el.appendChild(body);

    if (notes) {
        const details = document.createElement('details');
        details.className = 'option-notes';
        if (isWideLayout()) details.open = true;
        const summary = document.createElement('summary');
        summary.textContent = '逐项分析';
        details.appendChild(summary);
        q.options.forEach((opt, i) => {
            const row = document.createElement('div');
            const ok = correctIdx.includes(i);
            row.className = 'option-note ' + (ok ? 'is-correct' : 'is-wrong') + (chosen.includes(i) ? ' is-chosen' : '');
            const letter = document.createElement('span');
            letter.className = 'option-note-letter';
            letter.textContent = `${ok ? '✓' : '✗'} ${OPTION_SHORTCUTS[i]}`;
            const text = document.createElement('span');
            setMath(text, notes[i] || '');
            row.append(letter, text);
            details.appendChild(row);
        });
        el.appendChild(details);
    }
}

function getRawCourses() {
    return window.QUIZ_DATA?.courses || [...new Set((window.QUIZ_DATA?.questions || []).map(q => q.course).filter(Boolean))];
}

function getCurrentSemester() { return window.QUIZ_DATA?.currentSemester || ''; }

// Courses grouped by semester, current semester first, then newest to oldest.
function getSemesterGroups() {
    const semesters = window.QUIZ_DATA?.courseSemesters || {};
    const groups = new Map();
    getRawCourses().forEach(course => {
        const sem = semesters[course] || '';
        if (!groups.has(sem)) groups.set(sem, []);
        groups.get(sem).push(course);
    });
    const current = getCurrentSemester();
    return [...groups.entries()]
        .sort(([a], [b]) => (b === current) - (a === current) || (a === '') - (b === '') || b.localeCompare(a))
        .map(([semester, courses]) => ({ semester, courses, isCurrent: !!semester && semester === current }));
}

function getCourses() {
    return getSemesterGroups().flatMap(g => g.courses);
}

function semesterLabel(group) {
    if (!group.semester) return 'Other';
    return group.isCurrent ? `${group.semester} · this semester` : group.semester;
}

function getDefaultCourse() {
    const group = getSemesterGroups().find(g => g.isCurrent);
    return group?.courses[0] || 'all';
}

function getWeeksForCourse(course) {
    if (!course || course === 'all') return [];
    return window.QUIZ_DATA?.weeksByCourse?.[course] || [...new Set((window.QUIZ_DATA?.questions || []).filter(q => q.course === course).map(q => q.week).filter(Boolean))];
}

function getFilteredQuestions(course, week, pool = poolFilter) {
    const items = (allQuestions.length ? allQuestions : (window.QUIZ_DATA?.questions || [])).filter(q => {
        const matchesCourse = course === 'all' || q.course === course;
        const matchesWeek = week === 'all' || q.week === week;
        return matchesCourse && matchesWeek && matchesPool(q, pool);
    });
    if (course !== 'all') return items;
    const order = getCourses();
    return [...items].sort((a, b) => order.indexOf(a.course) - order.indexOf(b.course));
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
    // Options like "Both A and B" refer to positions, so those questions keep their order.
    if (q.fixedOptions) return q;
    const order = shuffled(q.options.map((_, i) => i));
    const remap = i => order.indexOf(i);
    return {
        ...q,
        options: order.map(i => q.options[i]),
        optionNotes: Array.isArray(q.optionNotes) ? order.map(i => q.optionNotes[i]) : q.optionNotes,
        optionsZh: Array.isArray(q.optionsZh) ? order.map(i => q.optionsZh[i]) : q.optionsZh,
        correct: Array.isArray(q.correct) ? q.correct.map(remap) : remap(q.correct)
    };
}

// Calculation questions with a `generator` get fresh numbers from data/generators.js on every run.
// Stats stay keyed by the question id, so the mistakes book tracks the question type.
function withGeneratedNumbers(q) {
    const gen = q.generator && window.QUIZ_GENERATORS?.[q.generator];
    if (!gen) return q;
    // A few random draws can't produce four distinct options; try again, then keep the static numbers.
    for (let i = 0; i < 5; i++) {
        try { return { ...q, ...gen() }; } catch { /* draw again */ }
    }
    return q;
}

function orderQuestions(items, course) {
    items = items.map(withGeneratedNumbers);
    if (!shuffleEnabled) return items;
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

// Wide screens get the three-column layout: navigator · question · explanation.
const WIDE_MQ = window.matchMedia ? window.matchMedia('(min-width: 1100px)') : null;
function isWideLayout() { return !!(WIDE_MQ && WIDE_MQ.matches); }

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
    // 'nearest': short content is brought fully into view from below;
    // content taller than the viewport aligns its top so reading starts there
    afterLayout(() => {
        if (!el.classList.contains('hidden')) {
            el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
        }
    });
}

// ── Theme ──
function applyTheme(theme) {
    const dark = theme !== 'light';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0f172a' : '#eef2ff');
    const label = dark ? 'Switch to light theme' : 'Switch to dark theme';
    [$('themeToggleBtn')].forEach(btn => {
        if (!btn) return;
        const icon = btn.querySelector('.tool-icon') || btn;
        icon.textContent = dark ? '☀️' : '🌙';
        btn.title = label;
        btn.setAttribute('aria-label', label);
    });
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
    hide('quizCard'); hide('resultsCard'); hide('emptyCard');
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
    updateShuffleButton();
    hide('loadingCard');
    beginRun(orderQuestions(filtered, course), false);
}

// Start a run over the given questions (a fresh quiz or a retry of wrong answers).
function beginRun(items, retry) {
    questions = items;
    current = 0; answers.length = 0; isRetryMode = retry;
    resultsShown = false; examSubmitted = false;
    hide('resultsCard'); hide('backResultsBtn');
    if (!questions.length) { showEmptyState(); return; }
    hide('emptyCard');
    updateExamBar();
    showQuestion();
}

function showEmptyState() {
    hide('quizCard'); hide('resultsCard'); hide('examBar');
    const where = currentCourseFilter === 'all' ? 'all courses'
        : currentWeekFilter === 'all' ? currentCourseFilter : `${currentCourseFilter} · ${currentWeekFilter}`;
    const msg = poolFilter === 'mistakes' ? [`🎉`, `No mistakes to review in ${where}.`]
        : poolFilter === 'unseen' ? [`✅`, `You have answered every question in ${where} at least once.`]
        : [`📭`, `No questions in ${where}.`];
    $('emptyEmoji').textContent = msg[0];
    $('emptyText').textContent = msg[1];
    $('emptyAllBtn').classList.toggle('hidden', poolFilter === 'all');
    $('questionCounter').textContent = 'No questions';
    $('progressFill').style.width = '0%';
    show('emptyCard');
    updateNavButtons();
    updateSideNav();
}

// ── Exam mode ──
function examInProgress() { return examMode && !examSubmitted; }

function updateExamBar() {
    const bar = $('examBar');
    if (!bar) return;
    if (!examMode || !questions.length) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    const done = answers.filter(Boolean).length;
    $('examAnswered').textContent = examSubmitted ? 'Submitted' : `${done}/${questions.length} answered`;
    $('examSubmitBtn').classList.toggle('hidden', examSubmitted);
    updateSideNav();
}

function toggleExamMode() {
    examMode = !examMode;
    const btn = $('examToggleBtn');
    btn.setAttribute('aria-pressed', examMode ? 'true' : 'false');
    btn.title = examMode ? 'Exam mode on: answers are revealed after you submit' : 'Exam mode: answers revealed only after you submit';
    btn.blur(); // keep A/B/C/D and Enter shortcuts working right after toggling
    startFresh(currentCourseFilter, currentWeekFilter);
}

function submitExam() {
    if (!examInProgress()) return;
    const unanswered = questions.length - answers.filter(Boolean).length;
    if (unanswered && !window.confirm(`${unanswered} question${unanswered !== 1 ? 's are' : ' is'} unanswered. Submit anyway?`)) return;
    examSubmitted = true;
    answers.forEach(a => { if (a) recordAttempt(a.question, a.correct); });
    buildPoolControls();
    updateExamBar();
    showResults();
}

function buildCourseFilter() {
    const sel = $('courseFilter');
    if (!sel) return;
    sel.innerHTML = '<option value="all">All Courses</option>';
    getSemesterGroups().forEach(group => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = semesterLabel(group);
        group.courses.forEach(course => {
            const count = (window.QUIZ_DATA.questions || []).filter(q => q.course === course).length;
            const option = document.createElement('option');
            option.value = course;
            option.textContent = `${course} (${count} Qs)`;
            optgroup.appendChild(option);
        });
        sel.appendChild(optgroup);
    });
    sel.value = currentCourseFilter;
    sel.onchange = () => selectCourse(sel.value);
}

// Shared selection flow for both the desktop selects and the drawer chips.
// Picking a course keeps the drawer open so a week can be chosen next;
// picking a week (or All Courses) closes it and goes straight to the quiz.
function selectCourse(course) {
    currentCourseFilter = course;
    currentWeekFilter = 'all';
    const sel = $('courseFilter');
    if (sel) sel.value = course;
    buildWeekFilter();
    buildFilterChips();
    if (course === 'all') closeDrawer();
    loadQuestions(course, 'all');
    buildPoolControls();
    saveLastFilter();
}

function selectWeek(week) {
    currentWeekFilter = week;
    const sel = $('weekFilter');
    if (sel) sel.value = week;
    buildFilterChips();
    closeDrawer();
    loadQuestions(currentCourseFilter, week);
    buildPoolControls();
    saveLastFilter();
}

function selectPool(pool) {
    poolFilter = pool;
    buildPoolControls();
    saveLastFilter();
    startFresh(currentCourseFilter, currentWeekFilter);
}

// Segmented All / Unseen / Mistakes control, counted within the current course & week.
function buildPoolControls() {
    const seg = $('poolSeg');
    if (!seg) return;
    seg.innerHTML = '';
    const base = getFilteredQuestions(currentCourseFilter, currentWeekFilter, 'all');
    const pools = [
        ['all', 'All', base.length],
        ['unseen', 'Unseen', base.filter(isUnseen).length],
        ['mistakes', '📕 Mistakes', base.filter(isMistake).length]
    ];
    pools.forEach(([value, label, count]) => {
        const btn = document.createElement('button');
        btn.className = 'pool-btn' + (poolFilter === value ? ' active' : '');
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', poolFilter === value ? 'true' : 'false');
        btn.textContent = label;
        const n = document.createElement('span');
        n.className = 'pool-count';
        n.textContent = count;
        btn.appendChild(n);
        btn.onclick = () => selectPool(value);
        seg.appendChild(btn);
    });
    if (Object.keys(questionStats).length) {
        const clear = document.createElement('button');
        clear.className = 'pool-clear';
        clear.textContent = 'Clear history';
        clear.title = 'Forget which questions you got right or wrong on this device';
        clear.onclick = clearStats;
        seg.appendChild(clear);
    }
    const resultsClear = $('resultsClearBtn');
    if (resultsClear) resultsClear.classList.toggle('hidden', !Object.keys(questionStats).length);
}

function buildFilterChips() {
    const courseList = $('courseChips');
    const weekList = $('weekChips');
    if (!courseList || !weekList) return;
    const allQs = window.QUIZ_DATA?.questions || [];

    const makeChip = (text, count, active, onClick) => {
        const chip = document.createElement('button');
        chip.className = 'filter-chip' + (active ? ' active' : '');
        chip.textContent = text;
        if (count != null) {
            const n = document.createElement('span');
            n.className = 'chip-count';
            n.textContent = ` · ${count}`;
            chip.appendChild(n);
        }
        chip.onclick = onClick;
        return chip;
    };

    courseList.innerHTML = '';
    courseList.appendChild(makeChip('All Courses', allQs.length, currentCourseFilter === 'all', () => selectCourse('all')));
    getSemesterGroups().forEach(group => {
        const label = document.createElement('div');
        label.className = 'chip-group-label' + (group.isCurrent ? ' current' : '');
        label.textContent = semesterLabel(group);
        courseList.appendChild(label);
        group.courses.forEach(course => {
            const count = allQs.filter(q => q.course === course).length;
            const chip = makeChip(course, count, currentCourseFilter === course, () => selectCourse(course));
            const fullTitle = window.QUIZ_DATA?.courseTitles?.[course];
            if (fullTitle) chip.title = fullTitle;
            courseList.appendChild(chip);
        });
    });

    weekList.innerHTML = '';
    if (currentCourseFilter === 'all') {
        const hint = document.createElement('div');
        hint.className = 'chip-hint';
        hint.textContent = 'Pick a course above to filter by week or exam.';
        weekList.appendChild(hint);
        return;
    }
    const courseQs = allQs.filter(q => q.course === currentCourseFilter);
    weekList.appendChild(makeChip('All', courseQs.length, currentWeekFilter === 'all', () => selectWeek('all')));
    getWeeksForCourse(currentCourseFilter).forEach(w => {
        const count = courseQs.filter(q => q.week === w).length;
        weekList.appendChild(makeChip(w, count, currentWeekFilter === w, () => selectWeek(w)));
    });
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
    sel.onchange = () => selectWeek(sel.value);
}

function updateShuffleButton() {
    const scope = getShuffleScopeLabel();
    const label = shuffleEnabled ? `Shuffle on (questions & options): ${scope}` : `Shuffle off: ${scope}`;
    [$('shuffleToggleBtn')].forEach(btn => {
        if (!btn) return;
        btn.setAttribute('aria-pressed', shuffleEnabled ? 'true' : 'false');
        btn.title = label;
        btn.setAttribute('aria-label', label);
    });
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
        setBilingual(text, opt, q.optionsZh?.[i]);
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
    setBilingual(questionText, q.question, q.questionZh);
    questionText.classList.remove('q-fade');
    void questionText.offsetWidth;
    questionText.classList.add('q-fade');
    renderQuestionTags(q);
    renderOptions();
    hide('explanationInline'); hide('nextBtn');
    $('nextBtn').classList.remove('exam-next');
    show('quizCard'); hide('resultsCard'); hide('emptyCard');
    $('backResultsBtn').classList.toggle('hidden', !resultsShown);
    const a = answers[current];
    if (examInProgress()) {
        hide('revealBtn');
        if (a) {
            const allBtns = document.querySelectorAll('.option-btn');
            if (Array.isArray(a.selected)) {
                selectedMAQ = [...a.selected];
                selectedMAQ.forEach(i => { allBtns[i]?.classList.add('selected'); allBtns[i]?.setAttribute('aria-pressed', 'true'); });
                updateMaqHint();
            } else allBtns[a.selected]?.classList.add('selected');
        }
        showExamNext();
    } else if (a || (examMode && examSubmitted)) {
        renderReview(q, a);
    } else {
        show('revealBtn');
    }
    $('explPlaceholder').textContent = examInProgress()
        ? 'Explanations appear after you submit the exam.'
        : 'Answer to see the explanation here, or press S to show the answer.';
    $('kbdHints').classList.toggle('exam', examInProgress());
    updateNavButtons();
    updateSideNav();
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
        scrollQuizIntoView();
    }
}

function navNext() {
    if (!questions.length) return;
    if (!$('resultsCard').classList.contains('hidden')) return;
    if (current < questions.length - 1) {
        current++;
        showQuestion();
        scrollQuizIntoView();
    } else if (examInProgress()) {
        submitExam();
    } else {
        showResults();
    }
}

function scrollQuizIntoView() {
    $('quizCard').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

// ── MCQ ──
function handleAnswer(index, btn) {
    const q = questions[current];
    if (examInProgress()) {
        // Exam mode: just record the choice; it can be changed until submit.
        answers[current] = { question: q, selected: index, correct: index === q.correct };
        document.querySelectorAll('.option-btn').forEach((b, i) => b.classList.toggle('selected', i === index));
        hapticFeedback(8);
        updateExamBar();
        showExamNext();
        return;
    }
    if (answered) return; answered = true;
    const allBtns = document.querySelectorAll('.option-btn');
    const isCorrect = index === q.correct;
    allBtns.forEach(b => b.classList.add('disabled'));
    btn.classList.add(isCorrect ? 'correct' : 'wrong');
    if (!isCorrect) allBtns[q.correct]?.classList.add('correct');
    hapticFeedback(isCorrect ? 12 : [10, 60, 18]);
    answers[current] = { question: q, selected: index, correct: isCorrect };
    recordAttempt(q, isCorrect);
    buildPoolControls();
    explanationTimeout = setTimeout(showInlineExplanation, 400, isCorrect, q);
}

function showExamNext() {
    const next = $('nextBtn');
    next.disabled = false;
    next.textContent = current < questions.length - 1 ? 'Next →' : 'Submit exam 🏁';
    next.classList.add('exam-next');
    show('nextBtn');
}

function maqIsCorrect(q, selected) {
    const a = [...selected].sort((x, y) => x - y);
    const b = [...q.correct].sort((x, y) => x - y);
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

// Show an already-answered (or, after an exam, unanswered) question as a locked review.
function renderReview(q, a) {
    answered = true;
    const allBtns = document.querySelectorAll('.option-btn');
    const correctIdx = isMAQ(q) ? q.correct : [q.correct];
    const selected = a ? (Array.isArray(a.selected) ? a.selected : (a.selected != null ? [a.selected] : [])) : [];
    allBtns.forEach(b => b.classList.add('disabled'));
    correctIdx.forEach(i => allBtns[i]?.classList.add('correct'));
    selected.forEach(i => { if (!correctIdx.includes(i)) allBtns[i]?.classList.add('wrong'); });
    hide('maqHint'); hide('maqCheckBtn'); hide('revealBtn');
    const badge = $('resultBadge');
    if (a) {
        badge.className = 'result-badge ' + (a.correct ? 'correct' : 'wrong');
        badge.textContent = a.correct ? '✓ Correct!' : '✗ Wrong';
    } else {
        badge.className = 'result-badge revealed';
        badge.textContent = '— Not answered';
    }
    renderExplanation(q, a ? a.selected : null);
    show('explanationInline'); show('nextBtn');
    $('nextBtn').disabled = false;
    $('nextBtn').textContent = current < questions.length - 1 ? 'Next →' : 'See Results 🏆';
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
    if (examInProgress()) {
        const q = questions[current];
        if (selectedMAQ.length === maxSelect) answers[current] = { question: q, selected: [...selectedMAQ], correct: maqIsCorrect(q, selectedMAQ) };
        else delete answers[current];
        updateExamBar();
        showExamNext();
        return;
    }
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
    const ok = maqIsCorrect(q, selectedMAQ);
    allBtns.forEach(b => b.classList.add('disabled'));
    correctIdx.forEach(i => allBtns[i]?.classList.add('correct'));
    selectedMAQ.forEach(i => { if (!correctIdx.includes(i)) allBtns[i]?.classList.add('wrong'); });
    hapticFeedback(ok ? 12 : [10, 60, 18]);
    answers[current] = { question: q, selected: [...selectedMAQ], correct: ok };
    recordAttempt(q, ok);
    buildPoolControls();
    explanationTimeout = setTimeout(showInlineExplanation, 400, ok, q);
}

function showInlineExplanation(isCorrect, q) {
    const badge = $('resultBadge');
    badge.className = 'result-badge ' + (isCorrect ? 'correct' : 'wrong');
    badge.textContent = isCorrect ? '✓ Correct!' : '✗ Wrong';
    renderExplanation(q, answers[current]?.selected ?? null);
    if (isJumpOpen()) buildJumpGrid();
    updateSideNav();
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
    renderExplanation(q, null);
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
    $('jumpResultsBtn').textContent = '🏁 View Results';
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

    resultsShown = true;
    hide('backResultsBtn');

    const review = $('answersReview'); review.innerHTML = '';
    for (let i = 0; i < total; i++) {
        const a = answers[i];
        const dot = document.createElement('button');
        dot.onclick = () => jumpToQuestion(i);
        dot.className = 'answer-dot ' + (a ? (a.correct ? 'dot-correct' : 'dot-wrong') : 'dot-skipped');
        dot.textContent = i + 1;
        dot.title = a
            ? `Q${i + 1}: ${a.correct ? '✓' : '✗'} — ${(a.question.question || '').substring(0, 80)}`
            : `Q${i + 1}: skipped`;
        review.appendChild(dot);
    }

    renderTopicSummary();

    const mistakesInScope = getFilteredQuestions(currentCourseFilter, currentWeekFilter, 'mistakes').length;
    const mistakesBtn = $('mistakesBtn');
    if (mistakesInScope && poolFilter !== 'mistakes') {
        mistakesBtn.textContent = `📕 Mistakes book (${mistakesInScope})`;
        show('mistakesBtn');
    } else hide('mistakesBtn');

    const wrongCount = wrong;
    if (wrongCount > 0 && !isRetryMode) {
        $('retryWrongBtn').textContent = `🔄 Retry ${wrongCount} Wrong`;
        show('retryWrongBtn');
    } else hide('retryWrongBtn');

    updateNavButtons();
    updateSideNav();
}

// Topics with the most wrong answers in this run, from each question's knowledge location.
function renderTopicSummary() {
    const box = $('topicSummary');
    box.innerHTML = '';
    const byTopic = new Map();
    answers.forEach(a => {
        if (!a) return;
        const q = a.question;
        const name = (currentCourseFilter === 'all' ? `${q.course} · ` : '') + topicOf(q);
        const t = byTopic.get(name) || { n: 0, wrong: 0 };
        t.n++; if (!a.correct) t.wrong++;
        byTopic.set(name, t);
    });
    const weak = [...byTopic.entries()].filter(([, t]) => t.wrong > 0)
        .sort(([, a], [, b]) => b.wrong - a.wrong || (b.wrong / b.n) - (a.wrong / a.n));
    if (!byTopic.size) { box.classList.add('hidden'); return; }
    const title = document.createElement('div');
    title.className = 'topic-title';
    title.textContent = weak.length ? 'Topics to review' : 'No weak topics in this run 🎉';
    box.appendChild(title);
    weak.slice(0, 8).forEach(([name, t]) => {
        const row = document.createElement('div');
        row.className = 'topic-row';
        const label = document.createElement('span');
        label.className = 'topic-name';
        setMath(label, name);
        const stat = document.createElement('span');
        stat.className = 'topic-stat';
        stat.textContent = `✗ ${t.wrong} / ${t.n}`;
        const bar = document.createElement('span');
        bar.className = 'topic-bar';
        bar.style.setProperty('--miss', `${Math.round((t.wrong / t.n) * 100)}%`);
        row.append(label, stat, bar);
        box.appendChild(row);
    });
    if (weak.length > 8) {
        const more = document.createElement('div');
        more.className = 'topic-more';
        more.textContent = `+${weak.length - 8} more topics with mistakes`;
        box.appendChild(more);
    }
    box.classList.remove('hidden');
}

function retryWrongAnswers() {
    const wrongQs = answers.filter(a => a && !a.correct).map(a => a.question);
    if (!wrongQs.length) return;
    beginRun(orderQuestions(wrongQs, currentCourseFilter), true);
}

// ── Settings drawer (mobile) ──
let drawerOpenedAt = 0;

function isDrawerOpen() {
    const el = $('headerControls');
    return el ? el.classList.contains('open') : false;
}

function openDrawer() {
    drawerOpenedAt = Date.now();
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

function buildJumpGrid(grid = $('jumpGrid'), highlightCurrent = true) {
    grid.innerHTML = '';
    questions.forEach((q, i) => {
        const chip = document.createElement('button');
        chip.className = 'jump-chip';
        const a = answers[i];
        if (a) chip.classList.add(examInProgress() ? 'answered-pending' : (a.correct ? 'answered-correct' : 'answered-wrong'));
        if (highlightCurrent && i === current) chip.classList.add('current');
        chip.textContent = i + 1;
        const sourceParts = [q.course, q.week].filter(Boolean);
        chip.title = `Q${i + 1}` + (sourceParts.length ? ` · ${sourceParts.join(' · ')}` : '') + (a ? (examInProgress() ? ' · answered' : (a.correct ? ' · ✓' : ' · ✗')) : '');
        chip.onclick = () => jumpToQuestion(i);
        grid.appendChild(chip);
    });
}

// Always-visible navigator on wide screens: question grid plus this run's score.
function updateSideNav() {
    const nav = $('sideNav');
    if (!nav) return;
    if (!questions.length) { nav.classList.add('hidden'); return; }
    nav.classList.remove('hidden');
    const onResults = !$('resultsCard').classList.contains('hidden');
    buildJumpGrid($('sideGrid'), !onResults);
    const done = answers.filter(Boolean);
    const right = done.filter(a => a.correct).length;
    const wrong = done.length - right;
    const stats = $('sideStats');
    if (examInProgress()) {
        stats.innerHTML = `<div class="side-title">📝 Exam</div><div class="side-row"><span>Answered</span><strong>${done.length}/${questions.length}</strong></div>`;
    } else {
        const acc = done.length ? Math.round(right / done.length * 100) + '%' : '–';
        stats.innerHTML = `<div class="side-title">This run</div>`
            + `<div class="side-row"><span>Answered</span><strong>${done.length}/${questions.length}</strong></div>`
            + `<div class="side-row"><span>Mistakes</span><strong class="${wrong ? 'is-wrong' : ''}">${wrong}</strong></div>`
            + `<div class="side-row"><span>Accuracy</span><strong>${acc}</strong></div>`;
    }
    $('sideResultsBtn').textContent = examInProgress() ? '🏁 Submit exam' : '🏁 View Results';
    const cur = $('sideGrid').querySelector('.jump-chip.current');
    if (cur && isWideLayout()) cur.scrollIntoView({ block: 'nearest' });
}

function openJumpPanel() {
    buildJumpGrid();
    $('jumpResultsBtn').textContent = examInProgress() ? '🏁 Submit exam' : '🏁 View Results';
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
    if (examInProgress() && current >= questions.length - 1) { submitExam(); return; }
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
$('langToggleBtn').onclick = () => { cycleLang(); $('langToggleBtn').blur(); };
$('questionCounter').onclick = toggleJumpPanel;
$('menuBtn').onclick = toggleDrawer;
$('drawerCloseBtn').onclick = closeDrawer;
// Guard against ghost/duplicate clicks landing on the backdrop right as the drawer opens
$('drawerBackdrop').onclick = () => { if (Date.now() - drawerOpenedAt > 350) closeDrawer(); };
$('prevNavBtn').onclick = navPrev;
$('nextNavBtn').onclick = navNext;
$('revealBtn').onclick = revealAnswer;
$('jumpResultsBtn').onclick = () => { closeJumpPanel(); if (examInProgress()) submitExam(); else showResults(); };
$('sideResultsBtn').onclick = () => { if (examInProgress()) submitExam(); else showResults(); };
$('examToggleBtn').onclick = toggleExamMode;
$('examSubmitBtn').onclick = submitExam;
$('backResultsBtn').onclick = () => { showResults(); window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' }); };
$('mistakesBtn').onclick = () => selectPool('mistakes');
$('resultsClearBtn').onclick = clearStats;
$('emptyAllBtn').onclick = () => selectPool('all');

document.addEventListener('click', (e) => {
    if (isJumpOpen() && !e.target.closest('#jumpPanel') && !e.target.closest('#questionCounter')) {
        closeJumpPanel();
    }
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

    if ((e.key === 'l' || e.key === 'L') && !e.metaKey && !e.ctrlKey && !e.altKey) { cycleLang(); return; }
    if ((e.key === 's' || e.key === 'S') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (!$('quizCard').classList.contains('hidden') && !$('revealBtn').classList.contains('hidden')) revealAnswer();
        return;
    }
    if (!$('quizCard').classList.contains('hidden')) {
        const idx = OPTION_SHORTCUTS.indexOf(e.key.toUpperCase());
        if (idx >= 0) document.querySelectorAll('.option-btn')[idx]?.click();
        if (e.key === 'Enter' && !$('maqCheckBtn').classList.contains('hidden')) {
            e.preventDefault(); checkMAQ();
        }
    }
    if (e.key === 'Enter') {
        if ((answered || examInProgress()) && !$('nextBtn').classList.contains('hidden')) $('nextBtn').click();
        else if (!$('resultsCard').classList.contains('hidden')) $('restartBtn').click();
    }
});

// ── Init ──
function initApp() {
    initTheme(); clearLegacyQuizMemory(); initShuffle(); initLang();
    questionStats = loadStats();
    // Reopen the last course/week/pool, else the first course of the current semester.
    const last = loadLastFilter();
    const courses = getCourses();
    let course = getDefaultCourse(), week = 'all';
    if (last && (last.course === 'all' || courses.includes(last.course))) {
        course = last.course;
        if (course !== 'all' && getWeeksForCourse(course).includes(last.week)) week = last.week;
        if (['all', 'unseen', 'mistakes'].includes(last.pool)) poolFilter = last.pool;
    }
    currentCourseFilter = course; currentWeekFilter = week;
    buildCourseFilter(); buildWeekFilter(); buildFilterChips(); buildPoolControls();
    loadQuestions(course, week);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
