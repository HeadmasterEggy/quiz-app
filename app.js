let questions = [];
let current = 0;
let score = 0;
let answered = false;

const $ = id => document.getElementById(id);

const DELAY_BEFORE_EXPLANATION = 600;

async function loadQuestions() {
    $('questionCounter').textContent = 'Loading...';
    $('loadingCard').classList.remove('hidden');
    $('quizCard').classList.add('hidden');
    try {
        const res = await fetch('data/questions.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        questions = data.questions;
        if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error('No questions found in data file');
        }
        $('loadingCard').classList.add('hidden');
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

    const opts = $('options');
    opts.innerHTML = '';
    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = `<span class="label">${String.fromCharCode(65 + i)}</span><span class="text">${opt}</span>`;
        btn.onclick = () => handleAnswer(i, btn);
        opts.appendChild(btn);
    });

    $('quizCard').classList.remove('hidden', 'leaving');
    $('quizCard').classList.add('active');
    $('explanationCard').classList.add('hidden');
    $('resultsCard').classList.add('hidden');
}

function handleAnswer(index, btn) {
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
        allBtns[q.correct].classList.add('correct');
    }

    setTimeout(() => {
        $('quizCard').classList.add('leaving');
        setTimeout(() => showExplanation(isCorrect, q), 350);
    }, DELAY_BEFORE_EXPLANATION);
}

function showExplanation(isCorrect, q) {
    $('quizCard').classList.add('hidden');
    $('explanationCard').classList.remove('hidden');

    const badge = $('resultBadge');
    badge.className = 'result-badge ' + (isCorrect ? 'correct' : 'wrong');
    badge.textContent = isCorrect ? '✓ Correct!' : '✗ Wrong';

    $('explanationText').textContent = q.explanation;
    $('nextBtn').textContent = current < questions.length - 1 ? 'Next Question →' : 'See Results 🏆';
}

function showResults() {
    $('explanationCard').classList.add('hidden');
    $('resultsCard').classList.remove('hidden');
    $('progressFill').style.width = '100%';

    const pct = Math.round((score / questions.length) * 100);
    $('finalScore').textContent = `${score}/${questions.length}`;

    let msg = '';
    if (pct === 100) msg = 'Perfect score! Amazing! 🎉';
    else if (pct >= 80) msg = 'Great job! Almost there! 👏';
    else if (pct >= 60) msg = 'Good effort! Keep practicing! 💪';
    else msg = 'Keep learning! You\'ll get better! 📚';
    $('scoreMessage').textContent = msg;
}

$('nextBtn').onclick = () => {
    current++;
    if (current < questions.length) showQuestion();
    else showResults();
};

$('restartBtn').onclick = () => {
    current = 0;
    score = 0;
    showQuestion();
};

// Keyboard navigation: 1-4 / A-D to select, Enter/Space to advance
document.addEventListener('keydown', (e) => {
    // Select options during the question phase
    if (!answered && !$('quizCard').classList.contains('hidden')) {
        let optIndex = -1;
        const key = e.key.toUpperCase();
        if (key >= '1' && key <= '4') optIndex = parseInt(key) - 1;
        else if (key >= 'A' && key <= 'D') optIndex = key.charCodeAt(0) - 65;
        if (optIndex >= 0) {
            const btns = document.querySelectorAll('.option-btn');
            if (btns[optIndex]) btns[optIndex].click();
        }
    }
    // Enter / Space to advance or restart
    if (e.key === 'Enter' || e.key === ' ') {
        if (!$('explanationCard').classList.contains('hidden')) {
            e.preventDefault();
            $('nextBtn').click();
        } else if (!$('resultsCard').classList.contains('hidden')) {
            e.preventDefault();
            $('restartBtn').click();
        }
    }
});

loadQuestions();
