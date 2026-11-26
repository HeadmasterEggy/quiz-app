"""Wrap the formulas in plain-text question fields in $...$ LaTeX.

Text such as "f₂(A) = 0.4×0.354 = 0.1416" becomes "$f_2(A) = 0.4\\times0.354 = 0.1416$".
Existing $...$ segments are left alone, so running it twice changes nothing.

A run of math tokens (numbers, one-letter or known variable names, Greek
letters, operators, brackets) is converted only if it contains a real
operator or a subscripted/Greek symbol; bare numbers and ordinary prose stay
as they are. Top-level commas/semicolons and two operands separated only by
a space end a run.
"""
import re

SUB = dict(zip("₀₁₂₃₄₅₆₇₈₉ₐₑₒₓₖₙₜᵢⱼ₊₋", "0123456789aeoxkntij+-"))
SUP = dict(zip("⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺·ᵀⁿ", "0123456789-+.Tn"))
GREEK = {"α": r"\alpha", "β": r"\beta", "γ": r"\gamma", "δ": r"\delta", "Δ": r"\Delta",
         "ε": r"\varepsilon", "η": r"\eta", "θ": r"\theta", "λ": r"\lambda", "μ": r"\mu",
         "π": r"\pi", "ρ": r"\rho", "σ": r"\sigma", "τ": r"\tau", "φ": r"\phi", "ω": r"\omega",
         "Σ": r"\Sigma", "∇": r"\nabla", "∂": r"\partial"}
OPS = {"√": r"\surd", "←": r"\leftarrow", "…": r"\dots", "±": r"\pm", "–": r"\text{–}", "×": r"\times", "−": "-", "-": "-", "+": "+", "=": "=", "≥": r"\ge", "≤": r"\le",
       "≈": r"\approx", "≠": r"\ne", "<": "<", ">": ">", "→": r"\to", "·": r"\cdot", "/": "/",
       "∝": r"\propto", "|": "|", "‖": r"\|", "∞": r"\infty", "^": "^", "*": r"\times"}
STRONG_OPS = set("×−=≥≤≈≠<>·/∝‖^√←")
FUNCS = {"log": r"\log", "max": r"\max", "min": r"\min", "exp": r"\exp", "tanh": r"\tanh",
         "argmax": r"\arg\max", "argmin": r"\arg\min", "ReLU": r"\text{ReLU}", "sign": r"\operatorname{sign}"}
NAMES = {"Sxy": "S_{xy}", "Sxx": "S_{xx}", "SSE": r"\text{SSE}", "MSE": r"\text{MSE}", "MAE": r"\text{MAE}",
         "IG": r"\text{IG}", "SMC": r"\text{SMC}", "TP": r"\text{TP}", "FP": r"\text{FP}", "FN": r"\text{FN}",
         "TN": r"\text{TN}", "Acc": r"\text{Acc}", "wnew": r"w_{\text{new}}", "bnew": r"b_{\text{new}}",
         "MUNEWA": r"\mu_1^{\text{new}}", "MUNEWB": r"\mu_2^{\text{new}}"}
TOKEN = re.compile(
    r"(?P<num>\d+(?:\.\d+)?%?)"
    r"|(?P<name>[A-Za-z]{2,})"
    r"|(?P<word>[\u4e00-\u9fff]+)"
    r"|(?P<id>[A-Za-zα-ωΑ-Ω∇∂][̄̂]?)"
    r"|(?P<sub>[₀-₉ₐₑₒₓₖₙₜᵢⱼ₊₋]+)"
    r"|(?P<sup>[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺ᵀⁿ](?:[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺·ᵀⁿ]*[⁰¹²³⁴⁵⁶⁷⁸⁹ᵀⁿ])?)"
    r"|(?P<prime>′)"
    r"|(?P<us>_(?:\{[^}]*\}|[A-Za-z0-9]+))"
    r"|(?P<op>[×−\-+=≥≤≈≠<>→·/∝|‖∞^*–±√←…])"
    r"|(?P<open>[(\[{])|(?P<close>[)\]}])"
    r"|(?P<comma>,)"
    r"|(?P<space>[ \t]+)"
    r"|(?P<other>.)", re.S)


def _tokens(text):
    toks = [(m.lastgroup, m.group()) for m in TOKEN.finditer(text)]
    out = []
    for i, (k, v) in enumerate(toks):
        if k == "name" and v in FUNCS:
            nxt = toks[i + 1] if i + 1 < len(toks) else None
            nn = toks[i + 2] if i + 2 < len(toks) else None
            used = nxt is not None and (nxt[0] in ("open", "sub") or
                                        (nxt[0] == "space" and nn is not None and nn[0] in ("num", "id", "open")))
            if not used:
                k = "word"  # "max pooling", "the max."
        out.append((k, v))
    return out


def _is_word(kind, val):
    return kind == "word" or (kind == "name" and val not in FUNCS and val not in NAMES)


def _ident(val):
    base = val[0]
    tex = GREEK.get(base, base)
    if len(val) > 1:
        tex = (r"\bar{%s}" if val[1] == "̄" else r"\hat{%s}") % tex
    return tex


def _render(toks):
    out = []
    prev = None
    for kind, val in toks:
        if kind == "num" and prev and prev[0] == "id" and re.fullmatch(r"\d+", val):
            t = "_{%s}" % val
        elif kind == "num":
            t = val.replace("%", r"\%")
        elif kind == "word":
            t = r"\text{%s}" % val
        elif kind == "name":
            if val in FUNCS:
                t = FUNCS[val]
            elif val in NAMES:
                t = NAMES[val]
            else:
                t = r"\text{%s}" % val
        elif kind == "id":
            t = _ident(val)
        elif kind == "sub":
            t = "_{%s}" % "".join(SUB[c] for c in val)
        elif kind == "sup":
            t = "^{%s}" % "".join(SUP[c] for c in val)
        elif kind == "prime":
            t = "'"
        elif kind == "us":
            s = val[1:]
            if s.startswith("{"):
                t = "_" + s.replace("−", "-")
            elif len(s) >= 2 and s.isalpha() and not s.isupper():
                t = r"_{\text{%s}}" % s
            else:
                t = "_{%s}" % s
        elif kind == "op":
            t = OPS[val]
            if t.startswith("\\") and t[-1].isalpha():
                t += " "
        elif kind == "open":
            t = r"\{" if val == "{" else val
        elif kind == "close":
            t = r"\}" if val == "}" else val
        elif kind == "comma":
            t = ","
        elif kind == "space":
            t = " "
        else:
            t = val
        # keep "\log_2 0.5" and "\max (" readable
        if prev and prev[0] == "sub" and kind == "num":
            out.append(" ")
        if prev and prev[0] in ("name", "id") and kind in ("num", "id", "name") and not t.startswith(("_", " ")) \
                and out and re.search(r"[A-Za-z]$", out[-1]):
            out.append(" ")
        out.append(t)
        prev = (kind, val)
    return "".join(out).strip()


ATOM = {"num", "id", "sub", "sup", "prime", "us"}


def _qualifies(toks):
    for kind, val in toks:
        if kind == "op" and val in STRONG_OPS:
            return True
        if kind in ("sub", "sup", "us"):
            return True
        if kind == "id" and (val[0] in GREEK or len(val) > 1):
            return True
        if kind == "name" and (val in FUNCS or val in NAMES):
            return True
    return False


def _convert_plain(text):
    toks = _tokens(text)
    n = len(toks)
    out = []
    i = 0
    while i < n:
        kind, val = toks[i]
        starts = kind in ATOM or kind == "open" or (kind == "name" and not _is_word(kind, val)) \
            or (kind == "op" and val in "−∞‖|±√≥≤≈")
        # a word directly before "=" (e.g. "Accuracy = 0.85") becomes the left-hand side
        lhs_word = (_is_word(kind, val) and i + 2 < n and toks[i + 1][0] == "space"
                    and toks[i + 2] in (("op", "="), ("op", "≈")) and len(val) <= 12)
        if not (starts or lhs_word):
            out.append(val)
            i += 1
            continue
        j, depth, run = i, 0, []
        last_sig = None  # kind of last non-space token
        while j < n:
            k, v = toks[j]
            if k == "other" and not (depth > 0 and v in "'"):
                break
            if depth == 0:
                if k in ("comma",):
                    break
                if _is_word(k, v) and not (j == i and lhs_word):
                    break
                if k == "space":
                    # operand, space, operand (no operator between) ends the run
                    nk = toks[j + 1] if j + 1 < n else None
                    if nk is None:
                        break
                    if last_sig in ("operand",) and (nk[0] in ATOM or nk[0] in ("open",) or
                                                     (nk[0] == "name" and nk[1] in NAMES)):
                        break
                    if last_sig == "operand" and _is_word(*nk):
                        break
            else:
                if k == "name" and _is_word(k, v):
                    pass  # words inside f(...) become \text{}
            if k == "open":
                # a bracket group after a space that holds prose is not math
                if last_sig != "operand_tight":
                    close = _match(toks, j)
                    if close is None:
                        break
                    inner = toks[j + 1:close]
                    if any(_is_word(*t) and len(t[1]) >= 3 for t in inner) and depth == 0:
                        break
                depth += 1
            elif k == "close":
                if depth == 0:
                    break
                depth -= 1
            run.append((k, v))
            if k == "space":
                pass
            elif k == "name" and v in FUNCS:
                last_sig = "operand_tight" if j + 1 < n and toks[j + 1][0] == "open" else "op"
            elif k in ATOM or k == "close" or (k == "name"):
                last_sig = "operand_tight" if j + 1 < n and toks[j + 1][0] == "open" else "operand"
                if k == "close":
                    last_sig = "operand"
            else:
                last_sig = "op"
            j += 1
        if depth != 0:
            # unbalanced: back off to plain text for the first token
            out.append(val)
            i += 1
            continue
        # trim trailing operators / spaces
        while run and (run[-1][0] in ("space",) or (run[-1][0] == "op" and run[-1][1] in "→+−-=·×/<>≈≥≤–")):
            run.pop()
        if not run:
            out.append(val)
            i += 1
            continue
        consumed = len(run)
        if _qualifies(run) and any(k in ATOM or (k == "name") for k, _ in run):
            out.append("$" + _render(run) + "$")
        else:
            out.append("".join(v for _, v in run))
        i += consumed
    return "".join(out)


def _match(toks, j):
    depth = 0
    for x in range(j, len(toks)):
        if toks[x][0] == "open":
            depth += 1
        elif toks[x][0] == "close":
            depth -= 1
            if depth == 0:
                return x
    return None


PRE = [(re.compile(r"μ₁,new"), "MUNEWA"), (re.compile(r"μ₂,new"), "MUNEWB")]


NORM = {"ȳ": "y\u0304", "ŷ": "y\u0302", "ā": "a\u0304", "ō": "o\u0304"}


def texify(text):
    if not text or not isinstance(text, str):
        return text
    for a, b in NORM.items():
        text = text.replace(a, b)
    parts = re.split(r"(\$[^$]*\$)", text)
    res = []
    for p in parts:
        if p.startswith("$") and p.endswith("$") and len(p) > 1:
            res.append(p)
        else:
            for pat, rep in PRE:
                p = pat.sub(rep, p)
            res.append(_convert_plain(p))
    return "".join(res)


FIELDS = ("question", "questionZh", "options", "optionsZh", "explanation", "explanationZh", "optionNotes")


def texify_question(q):
    for f in FIELDS:
        v = q.get(f)
        if isinstance(v, list):
            q[f] = [texify(s) for s in v]
        elif isinstance(v, str):
            q[f] = texify(v)
    return q
