"""Attach the formulas a COMP5318 calculation question needs, as the exam paper gives them.

Each calculation question gets a "formulas" list of LaTeX strings ($...$). The app
shows them in a box under the question stem. A question is matched to a topic by
its knowledge location (falling back to the stem), and only questions with numbers
in the stem and in at least two options count as calculations.

Run from the repo root to (re)apply to every COMP5318 question:
    python3 tools/kp/formulas.py
build.py also calls add_formulas() when it rebuilds the kp questions.
"""
import json
import os
import re

DIST = [r"$d_{\text{Euc}}(x,y) = \sqrt{\sum_i (x_i - y_i)^2}$", r"$d_{\text{Man}}(x,y) = \sum_i |x_i - y_i|$"]
LINKAGE = [r"$\text{single: } d(A,B) = \min_{a\in A,\, b\in B} d(a,b)$",
           r"$\text{complete: } d(A,B) = \max_{a\in A,\, b\in B} d(a,b)$",
           r"$\text{average: } d(A,B) = \dfrac{1}{|A||B|}\sum_{a\in A}\sum_{b\in B} d(a,b)$"]
ENTROPY = [r"$H(S) = -\sum_c p_c \log_2 p_c,\quad 0\log_2 0 = 0$",
           r"$IG(S, A) = H(S) - \sum_v \dfrac{|S_v|}{|S|} H(S_v)$"]
METRICS = [r"$\text{Accuracy} = \dfrac{TP + TN}{TP + TN + FP + FN}$",
           r"$P = \dfrac{TP}{TP + FP},\quad R = \dfrac{TP}{TP + FN}$",
           r"$F_1 = \dfrac{2PR}{P + R}$"]
NB = [r"$P(c \mid x) \propto P(c)\prod_i P(x_i \mid c)$",
      r"$P(c \mid x) = \dfrac{P(c)\prod_i P(x_i \mid c)}{\sum_{c'} P(c')\prod_i P(x_i \mid c')}$"]
LAPLACE = [r"$P(x_i = v \mid c) = \dfrac{n_{v,c} + 1}{n_c + k}\quad(k = \text{number of values of } x_i)$"]
LSQ = [r"$S_{xy} = \sum_i (x_i - \bar{x})(y_i - \bar{y}),\quad S_{xx} = \sum_i (x_i - \bar{x})^2$",
       r"$b_1 = \dfrac{S_{xy}}{S_{xx}},\quad b_0 = \bar{y} - b_1\bar{x},\quad \hat{y} = b_0 + b_1 x$",
       r"$\text{SSE} = \sum_i (y_i - \hat{y}_i)^2$"]
REG_ERR = [r"$\text{MAE} = \dfrac{1}{n}\sum_i |y_i - \hat{y}_i|$", r"$\text{MSE} = \dfrac{1}{n}\sum_i (y_i - \hat{y}_i)^2$"]
LOGISTIC = [r"$z = w_0 + \sum_i w_i x_i,\quad \sigma(z) = \dfrac{1}{1 + e^{-z}}$",
            r"$\text{predict class 1 if } \sigma(z) \ge 0.5$"]
GD = [r"$w \leftarrow w - \eta\, \dfrac{\partial L}{\partial w}$"]
PERCEPTRON = [r"$u = \mathbf{w}\cdot\mathbf{x} + b,\quad a = 1 \text{ if } u \ge 0 \text{ else } 0$",
              r"$\mathbf{w} \leftarrow \mathbf{w} + \eta(t - a)\mathbf{x},\quad b \leftarrow b + \eta(t - a)$"]
FORWARD_NN = [r"$a = g\left(\sum_i w_i x_i + b\right)$",
              r"$\text{ReLU}(z) = \max(0, z),\quad \sigma(z) = \dfrac{1}{1 + e^{-z}}$"]
DENSE = [r"$\text{params} = (n_{\text{in}} + 1)\times n_{\text{out}}$"]
CNN_SIZE = [r"$\text{output size} = \left\lfloor \dfrac{n + 2p - f}{s} \right\rfloor + 1$"]
CNN_PARAMS = [r"$\text{params} = (f \times f \times C_{\text{in}} + 1)\times C_{\text{out}}$"]
SVM = [r"$g(\mathbf{x}) = \mathbf{w}^T\mathbf{x} + b,\quad \hat{y} = \operatorname{sign}(g(\mathbf{x}))$"]
MARGIN = [r"$\text{margin} = \dfrac{2}{\lVert \mathbf{w} \rVert},\quad \lVert \mathbf{w} \rVert = \sqrt{\sum_i w_i^2}$"]
KERNELS = [r"$\text{polynomial: } K(\mathbf{x}, \mathbf{z}) = (\mathbf{x}^T\mathbf{z} + c)^d$",
           r"$\text{RBF: } K(\mathbf{x}, \mathbf{z}) = \exp(-\gamma \lVert \mathbf{x} - \mathbf{z} \rVert^2)$"]
PCA = [r"$\text{retained variance} = \dfrac{\sum_{i=1}^{k} \lambda_i}{\sum_{i=1}^{d} \lambda_i}$"]
KMEANS = [r"$\text{assign } x \text{ to } \arg\min_k \lVert x - \mu_k \rVert^2$",
          r"$\mu_k = \dfrac{1}{|C_k|}\sum_{x \in C_k} x$",
          r"$\text{SSE} = \sum_k \sum_{x \in C_k} \lVert x - \mu_k \rVert^2$"]
GMM = [r"$r_k(x) = \dfrac{\pi_k f_k(x)}{\sum_j \pi_j f_j(x)}$"]
MARKOV = [r"$P(s_1, \dots, s_T) = \pi_{s_1}\prod_{t=2}^{T} a_{s_{t-1} s_t}$",
          r"$P(s_{t+n} = k \mid s_t = j) = (A^n)_{jk}$"]
HMM_FWD = [r"$f_1(k) = \pi_k\, e_k(o_1)$",
           r"$f_t(k) = e_k(o_t) \sum_j f_{t-1}(j)\, a_{jk}$",
           r"$P(O) = \sum_k f_T(k)$"]
VITERBI = [r"$V_1(k) = \pi_k\, e_k(o_1)$",
           r"$V_t(k) = e_k(o_t) \max_j V_{t-1}(j)\, a_{jk}$"]
QLEARN = [r"$Q(s,a) \leftarrow Q(s,a) + \alpha\left[r + \gamma \max_{a'} Q(s',a') - Q(s,a)\right]$",
          r"$\text{terminal } s'\text{: target} = r$"]
EXP_VALUE = [r"$Q(s,a) = \sum_{s'} P(s' \mid s,a)\left[r + \gamma V(s')\right]$"]
EPS = [r"$\varepsilon\text{-greedy: random action w.p. } \varepsilon,\ \arg\max_a Q(s,a) \text{ w.p. } 1 - \varepsilon$"]
MINMAX = [r"$x' = \dfrac{x - \min}{\max - \min},\quad z = \dfrac{x - \mu}{\sigma}$"]
COSINE = [r"$\cos(x, y) = \dfrac{x \cdot y}{\lVert x \rVert\, \lVert y \rVert}$"]
BINARY = [r"$\text{SMC} = \dfrac{f_{11} + f_{00}}{f_{00} + f_{01} + f_{10} + f_{11}}$",
          r"$J = \dfrac{f_{11}}{f_{01} + f_{10} + f_{11}}$"]
WKNN = [r"$w_i = \dfrac{1}{d_i^2},\quad \text{vote}(c) = \sum_{i:\, y_i = c} w_i$"]

# (pattern on the knowledge-location topic, then on the stem) -> formulas. First match wins.
RULES = [
    (r"Viterbi", VITERBI),
    (r"Forward algorithm|forward algorithm", HMM_FWD),
    (r"Markov chain", MARKOV),
    (r"Terminal Q-learning|Q-learning", QLEARN),
    (r"Expected action value", EXP_VALUE),
    (r"Exploration", EPS),
    (r"Weighted k-NN|distance-weighted", WKNN),
    (r"SMC|Jaccard", BINARY),
    (r"Cosine", COSINE),
    (r"Scaling / calculation", MINMAX),
    (r"Distance", DIST),
    (r"Information gain", ENTROPY),
    (r"Laplace", LAPLACE + NB),
    (r"Naive Bayes", NB),
    (r"Classification metrics|Precision|F1", METRICS),
    (r"Least squares", LSQ),
    (r"MAE|Regression error", REG_ERR),
    (r"Logistic regression", LOGISTIC),
    (r"Gradient descent", GD),
    (r"Perceptron", PERCEPTRON),
    (r"Forward pass", FORWARD_NN),
    (r"Parameter count / dense", DENSE),
    (r"CNN.*output size|CNN output size", CNN_SIZE),
    (r"CNN.*param", CNN_PARAMS),
    (r"Linear SVM decision", SVM),
    (r"SVM margin", MARGIN),
    (r"[Kk]ernel", KERNELS),
    (r"PCA", PCA),
    (r"GMM", GMM),
    (r"Hierarchical|linkage|Agglomerative", LINKAGE),
    (r"[Kk]-means", KMEANS),
]

def _is_calc(q):
    stem = q.get("question", "")
    opts = q.get("options", [])
    return bool(re.search(r"\d", stem)) and sum(bool(re.search(r"\d", o)) for o in opts) >= 2


def formulas_for(q):
    if q.get("course") != "COMP5318" or not _is_calc(q):
        return []
    loc = q.get("knowledgeLocation", "").split(" · ")[0]
    topic = loc.split(" / ", 1)[1] if " / " in loc else loc
    for pat, f in RULES:
        if re.search(pat, topic):
            return list(f)
    return []


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
