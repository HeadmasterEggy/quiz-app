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

# Helper function to clean text
def clean_text(text):
    text = text.replace('\xa0', ' ').replace('\uea6a', '').strip()
    text = re.sub(r'\s+', ' ', text)
    return text

def find_best_matching_option(options, explanation):
    """Find which option best matches the explanation text."""
    explanation = explanation.lower()
    best_match = -1
    best_score = 0
    
    for i, opt in enumerate(options):
        opt_clean = opt.lower()
        words = set(re.findall(r'\w+', opt_clean))
        exp_words = set(re.findall(r'\w+', explanation))
        overlap = len(words & exp_words)
        score = overlap / max(len(words), 1)
        
        if score > best_score:
            best_score = score
            best_match = i
    
    return best_match

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

print(f"Canvas quizzes: {sorted(canvas_quizzes.keys())}")
print(f"Mock exams: {list(mock_exams.keys())}")

# ============================================================
# PARSE CANVAS QUIZZES
# ============================================================

all_canvas_questions = []

for week, text in sorted(canvas_quizzes.items()):
    print(f"\n{'='*60}")
    print(f"Parsing Week {week} ({len(text)} chars)")
    
    # Find all question headers
    qheaders = list(re.finditer(r'Question\s+(\d+)\s+(\d+)\s*/\s*(\d+)\s*pts', text))
    print(f"  Found {len(qheaders)} question headers")
    
    if not qheaders:
        continue
    
    week_questions = []
    
    for i, m in enumerate(qheaders):
        q_num = int(m.group(1))
        score = int(m.group(2))
        max_score = int(m.group(3))
        
        start = m.end()
        end = qheaders[i+1].start() if i+1 < len(qheaders) else len(text)
        qblock = text[start:end]
        
        # Extract options from the block
        lines = qblock.split('\n')
        options = []
        explanation = ""
        in_options = True
        
        for line in lines:
            raw_line = line
            line = line.strip()
            if not line:
                continue
            if line == 'Correct answer':
                in_options = False
                continue
            if in_options and ('\xa0' in raw_line or '  ' in raw_line or raw_line.startswith(' \u00a0') or raw_line.startswith(' \u2022')):
                # This is an option - check if it's not a question marker
                clean_opt = line
                if clean_opt and clean_opt not in ['Correct answer', 'Take the Quiz Again', 'Quiz Score'] and not clean_opt.startswith('('):
                    options.append(clean_opt)
            elif not in_options and line not in ['Correct answer', 'Take the Quiz Again', 'Quiz Score']:
                # This is explanation text
                if not line.startswith('(') and not line.startswith('5/31/26') and not line.startswith('INFO5995') and not line.startswith('http'):
                    explanation += line + ' '
        
        explanation = explanation.strip()
        explanation = re.sub(r'5/31/26.*$', '', explanation).strip()
        explanation = re.sub(r'INFO5995.*$', '', explanation).strip()
        explanation = re.sub(r'https?://.*$', '', explanation).strip()
        
        # Remove checkmark from explanation
        explanation = explanation.replace('\uea6a', '').strip()
        
        print(f"  Q{q_num}: {len(options)} options, explanation: {explanation[:100]}")
        
        week_questions.append({
            'week': week,
            'num': q_num,
            'score': score,
            'max_score': max_score,
            'options': options,
            'explanation': explanation
        })
    
    all_canvas_questions.extend(week_questions)

print(f"\n\nTotal Canvas questions parsed: {len(all_canvas_questions)}")

# ============================================================
# PARSE MOCK EXAMS
# ============================================================

all_mock_questions = []

for mock_name, text in mock_exams.items():
    print(f"\n{'='*60}")
    print(f"Parsing {mock_name} ({len(text)} chars)")
    
    # Find all questions - look for (N) on a line by itself
    lines = text.split('\n')
    current_question = None
    current_qtext = []
    current_options = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Check if this is a new question marker
        qmatch = re.match(r'\((\d+)\)\s*$', line)
        if qmatch:
            # Save previous question
            if current_question and current_qtext:
                question_text = ' '.join(current_qtext).strip()
                if not question_text.startswith('page'):
                    all_mock_questions.append({
                        'mock': mock_name,
                        'num': int(current_question),
                        'question': question_text,
                        'options': current_options
                    })
            
            current_question = qmatch.group(1)
            current_qtext = []
            current_options = []
            continue
        
        # Check if this is an option
        opt_match = re.match(r'([A-E])\.\s*(.*)', line)
        if opt_match and current_question:
            current_options.append(opt_match.group(2).strip())
            continue
        
        # Otherwise, this is part of the question text
        if current_question and line not in ['page']:
            current_qtext.append(line)
    
    # Save last question
    if current_question and current_qtext:
        question_text = ' '.join(current_qtext).strip()
        if not question_text.startswith('page'):
            all_mock_questions.append({
                'mock': mock_name,
                'num': int(current_question),
                'question': question_text,
                'options': current_options
            })

print(f"\n\nTotal Mock questions parsed: {len(all_mock_questions)}")

# ============================================================
# OUTPUT SAMPLE
# ============================================================

print("\n\nSample Canvas questions:")
for q in all_canvas_questions[:3]:
    print(f"  Week {q['week']} Q{q['num']}: {q['options']}")
    print(f"    Explanation: {q['explanation'][:100]}")

print("\nSample Mock questions:")
for q in all_mock_questions[:3]:
    print(f"  Mock {q['mock']} Q{q['num']}: {q['question'][:80]}")
    print(f"    Options: {q['options']}")
