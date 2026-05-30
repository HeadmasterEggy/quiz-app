import fitz
import re
import json
import os
import sys

os.makedirs("/Users/joey/.openclaw/workspace-main/quiz-app/data", exist_ok=True)

doc = fitz.open("/Users/joey/Downloads/ilovepdf_merged.pdf")
pages_text = []
for i in range(doc.page_count):
    pages_text.append(doc[i].get_text())

all_text = "\n".join(pages_text)

# Helper function to clean text
def clean_text(text):
    text = text.replace('\xa0', ' ').replace('\uea6a', '').strip()
    text = re.sub(r'\s+', ' ', text)
    return text

# ============================================================
# GROUP PAGES INTO SECTIONS
# ============================================================

canvas_quizzes = {}
mock_exams = {}
current_section = None
current_type = None

for i, text in enumerate(pages_text):
    lines = text.split('\n')
    first_line = lines[0].strip() if lines else ''
    
    week_match = re.match(r'INFO5995 Week\s*(\w+)', first_line)
    mock_match = re.match(r'INFO5995 Final exam \((Mock[^)]*)', first_line)
    
    if week_match:
        week = week_match.group(1)
        if week in canvas_quizzes:
            canvas_quizzes[week] += '\n' + text
        else:
            canvas_quizzes[week] = text
        current_section = week
        current_type = 'canvas'
    elif mock_match:
        mock_name = mock_match.group(1).strip()
        if mock_name in mock_exams:
            mock_exams[mock_name] += '\n' + text
        else:
            mock_exams[mock_name] = text
        current_section = mock_name
        current_type = 'mock'
    else:
        if current_type == 'canvas' and current_section:
            canvas_quizzes[current_section] += '\n' + text
        elif current_type == 'mock' and current_section:
            mock_exams[current_section] += '\n' + text

print(f"Canvas quizzes: {list(canvas_quizzes.keys())}")
print(f"Mock exams: {list(mock_exams.keys())}")

# ============================================================
# PARSE CANVAS QUIZZES
# ============================================================

all_canvas_questions = []

for week, text in sorted(canvas_quizzes.items()):
    print(f"\n{'='*60}")
    print(f"Parsing Week {week} ({len(text)} chars)")
    
    # Find all question headers
    qheaders = list(re.finditer(r'Question\s+(\d+)\s+\n\s*(\d+)\s*/\s*(\d+)\s*pts', text))
    print(f"  Found {len(qheaders)} question headers")
    
    # For each question, extract the options and explanation
    for i, m in enumerate(qheaders):
        q_num = m.group(1)
        score = m.group(2)
        max_score = m.group(3)
        
        start = m.end()
        end = qheaders[i+1].start() if i+1 < len(qheaders) else len(text)
        qblock = text[start:end]
        
        print(f"  Q{q_num}: {score}/{max_score} - block length: {len(qblock)}")
        print(f"    Block preview: {qblock[:200]}")

print("\n\nDone analyzing")
