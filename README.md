# 📚 Course Quiz

A browser-based quiz app for USYD course revision.

**Live:** [qiao1.top/quiz-app](https://qiao1.top/quiz-app/)

## 📊 Content

| Course / Section | Questions |
|------------------|-----------|
| INFO5995 total | 185 |
| Week 02 – Security Basics | 5 |
| Week 03 – AI & Mobile Security | 10 |
| Week 04 – Cryptography Basics | 10 |
| Week 05 – Encryption, MAC, ECB | 10 |
| Week 06 – System Models, Diffie-Hellman | 10 |
| Week 07 – TLS, TCP/UDP | 10 |
| Week 08 – Auth, Passwords, Web Security | 10 |
| Week 09 – Crypto & Security Review | 10 |
| Week 10 – Blockchain & Consensus | 10 |
| Week 11 – Program Analysis | 10 |
| Week 12 – DeFi & Security | 10 |
| Mock Exam 2 | 40 |
| Mock Exam 1 | 40 |
| COMP5270 total | 110 |
| Week 01 – Random variables & expectation | 10 |
| Week 02 – Concentration inequalities & algorithm types | 10 |
| Week 03 – Balls into bins & hashing | 10 |
| Week 05 – Min-Cut & Karger algorithms | 10 |
| Week 06 – Hash tables | 10 |
| Week 07 – Approximate nearest neighbour | 10 |
| Week 08 – Streaming algorithms | 10 |
| Week 09 – Sketching | 10 |
| Week 10 – Linear programming & randomized rounding | 10 |
| Week 11 – Distribution learning & testing | 10 |
| Week 12 – Learning from experts | 10 |
| COMP5318 total | 60 |
| Practice Exam 1 (official key) | 30 |
| Practice Exam 2 (official key) | 30 |
| COMP5416 total | 3 |
| Week 07 Midterm Quiz (official feedback) | 3 |
| CSYS5030 total | 20 |
| Sample Exam (unofficial answers) | 20 |
| **Total** | **377** |

## ✨ Features

- **MCQ & MAQ** — single-select and multi-select question types
- **Course and week filters** — study one course or topic at a time
- **Shuffle mode** — randomize the current quiz without saving state
- **Inline explanations** — answer feedback shown below the question
- **Keyboard shortcuts** — A/B/C/D to select, Enter to advance, ←/→ to move
- **Wrong answer retry** — redo only the questions you missed in the current run
- **Mistakes book** — per-question right/wrong history kept on this device; filter to *Unseen* or *Mistakes* only (no half-finished runs are saved)
- **Exam mode** — timed run where answers stay hidden until you submit, then review every question
- **Results by topic** — weakest topics from the knowledge locations; tap any question number to review it
- **Semester grouping** — current semester's courses first, last course/week remembered
- **Unofficial-key tag** — questions whose answers have no official source are flagged
- **Dark theme** — easy on the eyes

## 🚀 Run Locally

Just open `index.html` in any browser. No build step, no server needed.

```
open index.html
```

## 🛠 Structure

```
quiz-app/
├── index.html          # Main page
├── app.js              # Quiz logic
├── styles.css          # Dark theme + animations
├── data/
│   ├── questions.js    # Embedded question data (loaded by <script>)
│   └── questions.json  # Source of truth for questions
└── .github/
    └── workflows/
        └── deploy.yml  # Auto-deploy to GitHub Pages on push
```

## 🔄 Auto-improvement

A cron job runs every 20 minutes to QA the app — finding bugs, improving accessibility, and polishing the UI. All changes are committed and pushed automatically.
