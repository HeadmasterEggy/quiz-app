r"""Formulas printed under the question on the COMP5318 practice exam papers.

The papers (COMP5318_Practice_Exam_{1,2,3}.pdf) print the formulas a calculation
question needs, as images, directly under its stem. This table transcribes them to
LaTeX, one entry per printed line, keyed by (exam, question number). A question in
the quiz gets a "formulas" list only when its knowledge location names a practice
exam question that has printed formulas; Part B sub-parts (a)/(b) share the formulas
of their question. Every other question (self-written, weekly kp) gets none.

Run from the repo root to (re)apply:  python3 tools/kp/formulas.py
build.py also calls add_formulas() when it rebuilds the kp questions.
"""
import json
import os
import re

PAPER = {
    # ── Practice Exam 1 ──
    (1, 3): [r"$U_c = \sum_{i \in N_c} 1, \qquad W_c = \sum_{i \in N_c} \dfrac{1}{d_i^2}$"],
    (1, 7): [r"$b_1 = \dfrac{S_{xy}}{S_{xx}}, \qquad b_0 = \bar{y} - b_1\bar{x}, \qquad \hat{y} = b_0 + b_1 x$"],
    (1, 10): [r"$\text{Precision} = \dfrac{TP}{TP + FP}, \qquad \text{Recall} = \dfrac{TP}{TP + FN}$"],
    (1, 14): [r"$\lVert w \rVert = \sqrt{\sum_i w_i^2}, \qquad \text{full width} = \dfrac{2}{\lVert w \rVert}$"],
    (1, 17): [r"$\text{Retained variance}(k) = 100\,\dfrac{\sum_{i=1}^{k} \lambda_i}{\sum_{i=1}^{d} \lambda_i}\,\%$"],
    (1, 19): [r"$w_{\text{new}} = w + \eta(t - a)x, \qquad b_{\text{new}} = b + \eta(t - a)$"],
    (1, 22): [r"$\text{Parameters} = F_{out}(K_h K_w C_{in} + 1)$"],
    (1, 25): [r"$P(j \mid x) = \dfrac{\pi_j f_j(x)}{\sum_k \pi_k f_k(x)}$"],
    (1, 27): [r"$P(S_2 = B \mid S_0 = A) = \sum_{j \in \{A, B\}} a_{Aj}\, a_{jB}$"],
    (1, 30): [r"$Q_{new}(s,a) = Q_{old}(s,a) + \alpha\left[r + \gamma \max_{a'} Q(s',a') - Q_{old}(s,a)\right]$"],
    (1, 31): [r"$H(S) = -\sum_c p_c \log_2 p_c$",
              r"$IG = H(\text{parent}) - \sum_j \dfrac{n_j}{n} H(\text{child}_j)$",
              r"$\log_2(0.5) = -1, \quad \log_2(0.25) = -2, \quad \log_2(0.75) \approx -0.4150$"],
    (1, 32): [r"$u_A = x_1 + x_2 - 3, \qquad u_B = 2x_1 - x_2$",
              r"$h_A = \text{ReLU}(u_A), \qquad h_B = \text{ReLU}(u_B)$",
              r"$z = h_A + 2h_B$",
              r"$\text{ReLU}(u) = \max(0, u), \qquad \sigma(z) = \dfrac{1}{1 + e^{-z}}$"],
    (1, 33): [r"$d^2(x, c) = \sum_i (x_i - c_i)^2, \qquad \mu_{j,new} = \dfrac{1}{|C_j|} \sum_{x \in C_j} x$"],
    (1, 34): [r"$f_1(k) = \pi_k e_k(x), \qquad f_2(k) = e_k(y) \sum_j f_1(j)\, a_{jk}$",
              r"$P(x, y) = \sum_k f_2(k)$"],
    # ── Practice Exam 2 ──
    (2, 3): [r"$d_1(x, y) = \sum_i |x_i - y_i|, \qquad d_2(x, y) = \sqrt{\sum_i (x_i - y_i)^2}$"],
    (2, 7): [r"$\text{MAE} = \dfrac{1}{n} \sum_i |y_i - \hat{y}_i|, \qquad \text{MSE} = \dfrac{1}{n} \sum_i (y_i - \hat{y}_i)^2$"],
    (2, 10): [r"$\text{Recall} = \dfrac{TP}{TP + FN}, \qquad F_1 = \dfrac{2TP}{2TP + FP + FN}$"],
    (2, 14): [r"$K(x, y) = (x^T y + 2)^2, \qquad x^T y = \sum_i x_i y_i$"],
    (2, 17): [r"$\text{Retained variance}(k) = 100\,\dfrac{\sum_{i=1}^{k} \lambda_i}{\sum_{i=1}^{d} \lambda_i}\,\%$"],
    (2, 19): [r"$w_{new} = w_{old} - \eta \nabla L(w_{old})$"],
    (2, 22): [r"$n_{out} = \left\lfloor \dfrac{n_{in} + 2p - f}{s} \right\rfloor + 1$"],
    (2, 25): [r"$d_{single}(A, B) = \min_{x \in A,\, y \in B} |x - y|$",
              r"$d_{average}(A, B) = \dfrac{1}{|A||B|} \sum_{x \in A,\, y \in B} |x - y|$"],
    (2, 27): [r"$V_t(k) = e_k(o_t) \max_j \left[V_{t-1}(j)\, a_{jk}\right]$"],
    (2, 30): [r"$Q^*(s, a) = \sum_j p_j \left[r_j + \gamma V^*(s_j')\right]$"],
    (2, 31): [r"$s_c = P(c)\, P(F_1 \mid c)\, P(F_2 \mid c)$",
              r"$P(c \mid F_1, F_2) = \dfrac{s_c}{\sum_k s_k}$"],
    (2, 32): [r"$S_{xy} = \sum_i (x_i - \bar{x})(y_i - \bar{y}), \qquad S_{xx} = \sum_i (x_i - \bar{x})^2$",
              r"$b_1 = \dfrac{S_{xy}}{S_{xx}}, \qquad b_0 = \bar{y} - b_1\bar{x}, \qquad \hat{y}_i = b_0 + b_1 x_i$",
              r"$\text{MSE} = \dfrac{1}{n} \sum_i (y_i - \hat{y}_i)^2$"],
    (2, 33): [r"$d_{single}(U, V) = \min_{x \in U,\, y \in V} |x - y|$",
              r"$d_{complete}(U, V) = \max_{x \in U,\, y \in V} |x - y|$"],
    (2, 34): [r"$u_A = x_1 + 2x_2 - 1, \qquad u_B = 2x_1 - x_2 - 2$",
              r"$h_A = \text{ReLU}(u_A), \qquad h_B = \text{ReLU}(u_B)$",
              r"$z = 3h_A + h_B - 1$",
              r"$\text{ReLU}(u) = \max(0, u), \qquad \sigma(z) = \dfrac{1}{1 + e^{-z}}$"],
    # ── Practice Exam 3 ──
    (3, 3): [r"$W_c = \sum_{i \in N_c} \dfrac{1}{d_i^2}$"],
    (3, 7): [r"$p(y = 1 \mid x) = \dfrac{1}{1 + e^{-z}}$"],
    (3, 10): [r"$\text{Accuracy} = \dfrac{TP + TN}{TP + TN + FP + FN}, \qquad F_1 = \dfrac{2TP}{2TP + FP + FN}$"],
    (3, 14): [r"$g(x) = \sum_i w_i x_i + b$"],
    (3, 17): [r"$\text{Retained variance}(k) = 100\,\dfrac{\sum_{i=1}^{k} \lambda_i}{\sum_{i=1}^{d} \lambda_i}\,\%$"],
    (3, 19): [r"$w_{new} = w + \eta(t - a)x, \qquad b_{new} = b + \eta(t - a)$"],
    (3, 22): [r"$\text{Parameters} = F_{out}(K_h K_w C_{in} + 1)$"],
    (3, 25): [r"$d_{complete}(A, B) = \max_{x \in A,\, y \in B} |x - y|, \qquad d_{single}(A, B) = \min_{x \in A,\, y \in B} |x - y|$"],
    (3, 27): [r"$f_t(k) = e_k(o_t) \sum_j f_{t-1}(j)\, a_{jk}$"],
    (3, 30): [r"$Q_{new}(s, a) = Q_{old}(s, a) + \alpha\left[r - Q_{old}(s, a)\right] \quad \text{(terminal)}$"],
    (3, 31): [r"$H(S) = -\sum_c p_c \log_2 p_c$",
              r"$IG = H(\text{parent}) - \sum_j \dfrac{n_j}{n} H(\text{child}_j)$",
              r"$\log_2(0.5) = -1, \quad \log_2(0.2) \approx -2.3219, \quad \log_2(0.8) \approx -0.3219$"],
    (3, 32): [r"$u = w^T x + b, \qquad a = 1 \text{ if } u \ge 0, \text{ else } a = 0$",
              r"$w_{new} = w + \eta(t - a)x, \qquad b_{new} = b + \eta(t - a)$"],
    (3, 33): [r"$d^2(x, c) = \sum_i (x_i - c_i)^2, \qquad \mu_{j,new} = \dfrac{1}{|C_j|} \sum_{x \in C_j} x$",
              r"$\text{SSE} = \sum_j \sum_{x \in C_j} \lVert x - \mu_j \rVert^2$"],
    (3, 34): [r"$V_1(k) = \pi_k e_k(x), \qquad V_2(k) = e_k(y) \max_j \left[V_1(j)\, a_{jk}\right]$",
              r"$f_1(k) = \pi_k e_k(x), \qquad f_2(k) = e_k(y) \sum_j f_1(j)\, a_{jk}$",
              r"$P(x, y) = \sum_k f_2(k)$"],
}

LOC = re.compile(r"Practice Exam (\d) Q(\d+)")


def formulas_for(q):
    if q.get("course") != "COMP5318":
        return []
    m = LOC.search(q.get("knowledgeLocation", ""))
    if not m:
        return []
    return [_row(f) for f in PAPER.get((int(m.group(1)), int(m.group(2))), [])]


def _row(f):
    """One printed line -> one row. Formulas the paper sets side by side become
    separate $...$ pieces so a narrow screen wraps between them, not inside one.
    \\displaystyle puts sum/max/min limits underneath, as on the paper."""
    parts = f.strip("$").split(r", \qquad ")
    return "  ".join("$\\displaystyle " + p + ("," if i < len(parts) - 1 else "") + "$"
                     for i, p in enumerate(parts))


def add_formulas(q):
    f = formulas_for(q)
    if f:
        q["formulas"] = f
    else:
        q.pop("formulas", None)
    return q


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(os.path.dirname(here))
    path = os.path.join(root, "data", "questions.json")
    data = json.load(open(path, encoding="utf-8"))
    n = 0
    for q in data["questions"]:
        if q.get("course") == "COMP5318":
            add_formulas(q)
            n += "formulas" in q
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    open(path, "w", encoding="utf-8").write(text)
    open(os.path.join(root, "data", "questions.js"), "w", encoding="utf-8").write(
        "window.QUIZ_DATA = " + text.rstrip("\n") + "\n;\n")
    print("COMP5318 questions with formulas:", n)


if __name__ == "__main__":
    main()
