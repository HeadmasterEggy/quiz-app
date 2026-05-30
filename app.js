let questions = [];
let current = 0;
let score = 0;
let answered = false;

const $ = id => document.getElementById(id);

async function loadQuestions() {
    $('questionCounter').textContent = 'Loading...';
    $('loadingCard').classList.remove('hidden');
    $('quizCard').classList.add('hidden');
    try {
        const res = await fetch('data/questions.json');
        const data = await res.json();
        questions = data.questions;
        $('loadingCard').classList.add('hidden');
        $('quizCard').classList.add('active');
        showQuestion();
    } catch (err) {
        $('questionCounter').textContent = 'Error loading questions';
        $('loadingCard').innerHTML = '<p style="color:var(--error)">Failed to load questions. Please check the data file.</p>';
    }
}

function showQuestion() {
    answered = false;
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
    }, 600);
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

loadQuestions();
