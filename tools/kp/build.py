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

# Courses whose banks are built into the app. csys5030.py and comp5318.py are
# written but held back; add them here to publish them.
ENABLED = ["comp5416"]
MODULES = [__import__(name) for name in ENABLED]


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
    next_id = max(q["id"] for q in kept) + 1
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
            kl = f"W{w} {mod.TOPICS[w]} / {loc}" + (f" · {suffix}" if suffix else "")
            q.update({
                "id": next_id,
                "course": mod.COURSE,
                "week": week,
                "lectureWeek": lecture,
                "knowledgeLocation": kl,
                "source": "kp",
            })
            next_id += 1
            new.append(q)
            if week not in weeks:
                weeks.append(week)
        weekly = sorted(w for w in weeks if w.startswith("Week "))
        sets = [w for w in weeks if not w.startswith("Week ")]
        old = [w for w in data["weeksByCourse"].get(mod.COURSE, []) if not w.startswith("Week ") and w not in sets]
        data["weeksByCourse"][mod.COURSE] = weekly + sets + old
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
