"""Helpers for the weekly exam-point (考点) question banks.

Each course file defines QUESTIONS via Q(...). build.py merges them into
data/questions.json and data/questions.js.
"""


def Q(week, loc, q, opts, correct, exp, qz, oz=None, ez="", notes=None, steps=None):
    """One question.

    week   : lecture week number (int)
    loc    : "Topic / subtopic" (prefixed with W<n> automatically)
    q, qz  : English / Chinese stem
    opts   : English options
    oz     : Chinese options (None = same as English, e.g. numbers or formulas)
    correct: int index, or list of indices for multi-select
    exp, ez: English / Chinese explanation
    """
    if oz is None:
        oz = list(opts)
    assert len(oz) == len(opts), q
    item = {
        "question": q,
        "options": list(opts),
        "correct": correct,
        "explanation": exp,
        "weekNo": week,
        "loc": loc,
        "questionZh": qz,
        "optionsZh": list(oz),
    }
    if ez:
        item["explanationZh"] = ez
    if notes:
        assert len(notes) == len(opts), q
        item["optionNotes"] = notes
    if steps:
        item["steps"] = steps
    return item
