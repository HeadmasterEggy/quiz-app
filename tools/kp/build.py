"""Merge the weekly exam-point banks into data/questions.json and data/questions.js.

Run from the repo root:  python3 tools/kp/build.py
Re-running is safe: questions with source == "kp" are replaced, others kept.
Option order is shuffled with a fixed seed so the key is not always A.
"""
import json
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(ROOT, "data", "questions.json")

import csys5030  # noqa: E402
from texify import texify_question  # noqa: E402
from formulas import add_formulas  # noqa: E402

# Courses whose plain-text formulas are wrapped in $...$ at build time.
TEXIFY = {"COMP5318"}

MODULES = [csys5030]
for name in ("comp5416", "comp5318"):
    try:
        MODULES.append(__import__(name))
    except ImportError:
        pass


def shuffled(item, rng):
    n = len(item["options"])
    order = list(range(n))
    rng.shuffle(order)
    out = dict(item)
    for key in ("options", "optionsZh", "optionNotes"):
        if key in item:
            out[key] = [item[key][i] for i in order]
    pos = {old: new for new, old in enumerate(order)}
    c = item["correct"]
    out["correct"] = sorted(pos[i] for i in c) if isinstance(c, list) else pos[c]
    return out


def main():
    data = json.load(open(DATA, encoding="utf-8"))
    kept = [q for q in data["questions"] if q.get("source") != "kp"]
    old_kp = [q["id"] for q in data["questions"] if q.get("source") == "kp"]
    total = sum(len(m.QUESTIONS) for m in MODULES)
    kept_ids = {q["id"] for q in kept}
    # Reuse the old kp id range when it is still free, so ids (and the
    # per-question stats saved in browsers) don't shift when static
    # questions with higher ids are added.
    start = min(old_kp) if old_kp else None
    if start is None or any(start <= i < start + total for i in kept_ids):
        start = max(kept_ids) + 1
    next_id = start
    new = []
    for mod in MODULES:
        rng = random.Random(mod.COURSE)
        weeks = []
        for item in mod.QUESTIONS:
            item = dict(item)
            w = item.pop("weekNo")
            loc = item.pop("loc")
            label = item.pop("weekLabel", None)
            suffix = item.pop("locSuffix", None)
            item.pop("officialNote", None)
            lecture = f"Week {w:02d}"
            week = label or lecture
            q = item if item.get("fixedOptions") else shuffled(item, rng)
            if mod.COURSE in TEXIFY:
                q = texify_question(dict(q))
            kl = f"W{w} {mod.TOPICS[w]} / {loc}" + (f" · {suffix}" if suffix else "")
            q.update({
                "id": next_id,
                "course": mod.COURSE,
                "week": week,
                "lectureWeek": lecture,
                "knowledgeLocation": kl,
                "source": "kp",
            })
            if not label:
                q["selfWritten"] = True
            add_formulas(q)
            next_id += 1
            new.append(q)
            if week not in weeks:
                weeks.append(week)
        weekly = sorted(w for w in weeks if w.startswith("Week "))
        sets = [w for w in weeks if not w.startswith("Week ")]
        # Keep every other set label of this course (e.g. "Week 07 Midterm Quiz",
        # which starts with "Week " but is not a kp week) so it stays selectable.
        static = {q["week"] for q in kept if q.get("course") == mod.COURSE and q.get("week")}
        old = [w for w in data["weeksByCourse"].get(mod.COURSE, [])
               if w not in weekly and w not in sets and (not w.startswith("Week ") or w in static)]
        old += sorted(w for w in static if w not in weekly and w not in sets and w not in old)
        exams = [w for w in old if w.startswith("Week ")]
        data["weeksByCourse"][mod.COURSE] = weekly + exams + sets + [w for w in old if w not in exams]
        print(f"{mod.COURSE}: {len(mod.QUESTIONS)} questions in {len(weeks)} weeks")
    data["questions"] = kept + new
    weeks_all = []
    for q in data["questions"]:
        if q.get("week") and q["week"] not in weeks_all:
            weeks_all.append(q["week"])
    if "weeks" in data:
        extra = [w for w in weeks_all if w not in data["weeks"]]
        data["weeks"] = sorted(w for w in data["weeks"] + extra if w.startswith("Week ")) + \
            [w for w in data["weeks"] + extra if not w.startswith("Week ")]
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    open(DATA, "w", encoding="utf-8").write(text)
    open(os.path.join(ROOT, "data", "questions.js"), "w", encoding="utf-8").write(
        "window.QUIZ_DATA = " + text.rstrip("\n") + "\n;\n")
    print("total", len(data["questions"]))


if __name__ == "__main__":
    main()
