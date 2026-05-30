import fitz
import re
import json
import os

os.makedirs("/Users/joey/.openclaw/workspace-main/quiz-app/data", exist_ok=True)

doc = fitz.open("/Users/joey/Downloads/ilovepdf_merged.pdf")
pages_text = []
for i in range(doc.page_count):
    pages_text.append(doc[i].get_text())

all_text = "\n".join(pages_text)

# Let me write a comprehensive parser that handles all cases
questions = []

# Helper function to clean text
def clean_text(text):
    text = text.replace('\xa0', ' ').replace('\uea6a', '').strip()
    text = re.sub(r'\s+', ' ', text)
    return text

# ============================================================
# PARSE CANVAS QUIZZES
# ============================================================

# For Canvas quizzes, I need to find all questions by looking for the pattern:
# "Question N" followed by "X / Y pts" followed by options
# The question text is at the bottom of the page with (MCQ/MAQ, choose X)

# Let me first find all canvas quiz sections by looking for the first occurrence of each week
# I'll use the page number in the footer to track pages

canvas_quizzes = {}

for i, text in enumerate(pages_text):
    lines = text.split('\n')
    first_line = lines[0].strip() if lines else ''
    
    # Check if this page starts a new quiz
    week_match = re.match(r'INFO5995 Week\s*(\w+)', first_line)
    if week_match:
        week = week_match.group(1)
        canvas_quizzes[week] = text
    else:
        # Continuation page - add to the last week
        if canvas_quizzes:
            last_week = list(canvas_quizzes.keys())[-1]
            canvas_quizzes[last_week] += '\n' + text

print(f"Canvas quizzes: {list(canvas_quizzes.keys())}")

# Now parse each canvas quiz
for week, text in canvas_quizzes.items():
    print(f"\n{'='*60}")
    print(f"Week {week}: {len(text)} chars")
    
    # Find all question texts - look for (MCQ, choose X) or (MAQ, choose X) or variations
    # The question text may be at the bottom of the page
    
    # First, find all occurrences of question type markers
    qmarkers = list(re.finditer(r'\((?:MCQ|MAQ), choose (\w+)\)', text))
    print(f"  Found {len(qmarkers)} question markers")
    
    # Find all question headers (Question N X / Y pts)
    qheaders = list(re.finditer(r'Question\s+(\d+)\s+\n\s*(\d+)\s*/\s*(\d+)\s*pts', text))
    print(f"  Found {len(qheaders)} question headers")

print("\n\nDone analyzing Canvas quizzes")
