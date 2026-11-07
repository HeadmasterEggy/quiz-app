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
| COMP5318 total | 132 |
| Week 01 – Introduction (exam points) | 4 |
| Week 02 – Data Preprocessing & kNN (exam points) | 8 |
| Week 03 – Linear & Logistic Regression (exam points) | 6 |
| Week 04 – Naive Bayes & Evaluation (exam points) | 7 |
| Week 05 – Decision Trees & Ensembles (exam points) | 6 |
| Week 06 – SVM & PCA (exam points) | 8 |
| Week 07 – Neural Networks & Backpropagation (exam points) | 8 |
| Week 08 – CNN, RNN & LSTM (exam points) | 6 |
| Week 09 – Clustering I (k-means, GMM, hierarchical) (exam points) | 6 |
| Week 11 – Markov Models & HMM (exam points) | 6 |
| Week 12 – Reinforcement Learning (exam points) | 7 |
| Practice Exam 1 (official key) | 30 |
| Practice Exam 2 (official key) | 30 |
| COMP5416 total | 137 |
| Week 01 – Introduction & Game Theory (exam points) | 8 |
| Week 02 – Performance (exam points) | 9 |
| Week 03 – Applications (HTTP, FTP, Email) (exam points) | 10 |
| Week 04 – DNS, Sockets & P2P (exam points) | 9 |
| Week 05 – Transport Layer & rdt (exam points) | 8 |
| Week 06 – TCP (exam points) | 10 |
| Week 07 – Socket Programming Lab (exam points) | 2 |
| Week 08 – Multimedia Networking (exam points) | 8 |
| Week 10 – SIP, QoS & Wireless (exam points) | 7 |
| Week 11 – WiFi, Cellular & Mobility (exam points) | 7 |
| Week 12 – 5G, Bluetooth, Satellites & QUIC (exam points) | 8 |
| Sample Exam (official key; two misprinted answer boxes corrected from the official working) | 14 |
| Week 07 Midterm Quiz (official feedback) | 3 |
| Textbook Practice (Kurose & Ross problem types, unofficial answers; calculation questions get new numbers each run) | 34 |
| CSYS5030 total | 117 |
| Week 01 – Uncertainty & Entropy I (exam points) | 9 |
| Week 02 – Uncertainty & Entropy II (exam points) | 9 |
| Week 03 – Mutual Information (exam points) | 8 |
| Week 04 – Conditional Mutual Information (exam points) | 8 |
| Week 05 – JIDT Software (exam points) | 6 |
| Week 06 – Information-Theoretic Estimators (exam points) | 9 |
| Week 07 – Statistical Significance (exam points) | 9 |
| Week 08 – Self-Organisation (exam points) | 8 |
| Week 09 – Information Processing & Entropy Rate (exam points) | 7 |
| Week 10 – Active Information Storage (exam points) | 8 |
| Week 11 – Transfer Entropy (exam points) | 8 |
| Week 12 – Effective Network Inference (exam points) | 8 |
| Sample Exam (unofficial answers) | 20 |
| **Total** | **680** |

Weekly *exam points* questions are generated from `tools/kp/*.py`; run `python3 tools/kp/build.py` to rebuild `data/questions.json` and `data/questions.js`.

## ✨ Features

- **MCQ & MAQ** — single-select and multi-select question types
- **Course and week filters** — study one course or topic at a time
- **Shuffle mode** — randomize the current quiz without saving state
- **Inline explanations** — answer feedback shown below the question
- **Keyboard shortcuts** — A/B/C/D to select, Enter to advance, ←/→ to move, S to show the answer (hints shown on desktop)
- **Wide-screen layout** — on screens ≥1100px: always-visible question navigator with this run's accuracy, explanation pinned beside the question
- **Wrong answer retry** — redo only the questions you missed in the current run
- **Mistakes book** — per-question right/wrong history kept on this device; filter to *Unseen* or *Mistakes* only (no half-finished runs are saved)
- **Exam mode** — answers stay hidden until you submit, then review every question
- **Results by topic** — weakest topics from the knowledge locations; tap any question number to review it
- **Semester grouping** — current semester's courses first, last course/week remembered
- **Richer explanations** — "why your pick is wrong" callout, 中文要点, step-by-step working (KaTeX), option-by-option notes, and a 📖 link to the matching weekly notes on qiao1.top
- **Fresh numbers** — COMP5416 textbook-practice calculation questions are regenerated every run (`data/generators.js`), with distractors built from common mistakes
- **Unofficial-key tag** — questions whose answers have no official source are flagged
- **中/EN translation** — every question stem and option has a Chinese translation; switch between 中英对照, English only and 中文 only with the 中/EN button or the L key
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
│   ├── generators.js   # Fresh-number generators for calculation questions
│   └── questions.json  # Source of truth for questions
└── .github/
    └── workflows/
        └── deploy.yml  # Auto-deploy to GitHub Pages on push
```

## 🔄 Auto-improvement

A cron job runs every 20 minutes to QA the app — finding bugs, improving accessibility, and polishing the UI. All changes are committed and pushed automatically.
