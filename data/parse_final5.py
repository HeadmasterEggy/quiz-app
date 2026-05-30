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
    if not explanation or not options:
        return -1
    
    explanation = explanation.lower()
    best_match = -1
    best_score = 0
    
    for i, opt in enumerate(options):
        opt_clean = opt.lower()
        words = set(re.findall(r'\w+', opt_clean))
        exp_words = set(re.findall(r'\w+', explanation))
        if not words:
            continue
        overlap = len(words & exp_words)
        score = overlap / len(words)
        
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
# PARSE CANVAS QUIZZES - Simple approach
# ============================================================

all_canvas_questions = []

for week, text in sorted(canvas_quizzes.items()):
    print(f"\nParsing Week {week} ({len(text)} chars)")
    
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
        
        # Extract options and explanation
        lines = qblock.split('\n')
        options = []
        explanation = ""
        in_options = True
        current_option = None
        
        for line in lines:
            raw_line = line
            line = line.strip()
            if not line and not ('\xa0' in raw_line or '\u2022' in raw_line or '\u00a0' in raw_line):
                continue
            if line == 'Correct answer':
                in_options = False
                if current_option is not None:
                    options.append(current_option)
                    current_option = None
                continue
            
            if '\xa0' in raw_line or '\u2022' in raw_line or '\u00a0' in raw_line:
                if current_option is not None:
                    options.append(current_option)
                
                clean_opt = raw_line.replace('\xa0', '').replace('\u2022', '').replace('\u00a0', '').strip()
                if clean_opt and not clean_opt.startswith('(') and not clean_opt.startswith('5/31/26') and not clean_opt.startswith('INFO5995') and not clean_opt.startswith('http') and not clean_opt.startswith('Quiz Score') and not clean_opt.startswith('Take the Quiz Again'):
                    current_option = clean_opt
                else:
                    current_option = ''
            elif line == 'Correct answer' or line == 'Take the Quiz Again' or line.startswith('Quiz Score') or line.startswith('(MCQ') or line.startswith('(MAQ') or line.startswith('MCQ') or line.startswith('MAQ') or line.startswith('5/31/26') or line.startswith('INFO5995') or line.startswith('http'):
                if current_option is not None:
                    options.append(current_option)
                    current_option = None
                in_options = False
                if line == 'Correct answer':
                    in_options = False
            elif not in_options:
                if line not in ['Correct answer', 'Take the Quiz Again', 'Quiz Score'] and not line.startswith('5/31/26') and not line.startswith('INFO5995') and not line.startswith('http') and not line.startswith('(') and not line.startswith('Question'):
                    explanation += line + ' '
            elif current_option is not None:
                current_option += ' ' + line
        
        if current_option is not None:
            options.append(current_option)
        
        explanation = explanation.strip()
        explanation = re.sub(r'5/31/26.*$', '', explanation).strip()
        explanation = re.sub(r'INFO5995.*$', '', explanation).strip()
        explanation = re.sub(r'https?://.*$', '', explanation).strip()
        explanation = explanation.replace('\uea6a', '').strip()
        
        # Extract question text from the block
        question = ""
        for line in lines:
            line = line.strip()
            if line.startswith('(MCQ') or line.startswith('(MAQ') or line.startswith('MCQ') or line.startswith('MAQ'):
                q_match = re.match(r'\((MCQ|MAQ), choose (\w+)\)\s*(.*)', line)
                if not q_match:
                    q_match = re.match(r'(MCQ|MAQ)\s*\(choose (\w+)\)\s*(.*)', line)
                if q_match:
                    question = q_match.group(3)
                break
            elif line and not line.startswith('(') and not line.startswith('5/31/26') and not line.startswith('INFO5995') and not line.startswith('http') and not line.startswith('Correct answer') and not line.startswith('Quiz Score') and not line.startswith('Take the Quiz Again') and not line.startswith('Question') and not line.startswith('\uea6a') and len(line) > 50 and '?' in line:
                question = line
                break
        
        week_questions.append({
            'week': week,
            'num': q_num,
            'score': score,
            'max_score': max_score,
            'question': question,
            'options': options,
            'explanation': explanation
        })
    
    all_canvas_questions.extend(week_questions)

print(f"\nTotal Canvas questions parsed: {len(all_canvas_questions)}")

# ============================================================
# PARSE MOCK EXAMS
# ============================================================

all_mock_questions = []

for mock_name, text in mock_exams.items():
    print(f"\nParsing {mock_name} ({len(text)} chars)")
    
    # Remove page footers
    text = re.sub(r'page \d+ of \d+\s*', '', text)
    
    # Find Problem 1
    problem1_match = re.search(r'Problem 1\.\s*\[\d+ marks\]', text)
    if not problem1_match:
        print("  No Problem 1 found")
        continue
    
    # Find all markers
    markers = list(re.finditer(r'\((\d+)\)\s*', text))
    print(f"  Found {len(markers)} markers")
    
    questions = []
    
    # First question (before first marker)
    if markers:
        first_marker = markers[0]
        first_qtext = text[problem1_match.end():first_marker.start()]
        
        lines = first_qtext.strip().split('\n')
        q_lines = []
        for line in lines:
            line = line.strip()
            if line and not line.startswith('Each question') and not line.startswith('score +') and not line.startswith('and 0 otherwise') and not line.startswith('Each hard question') and not line.startswith('Each question has exactly'):
                q_lines.append(line)
        
        if q_lines:
            question = q_lines[0]
            options = []
            for line in q_lines[1:]:
                if re.match(r'[A-E]\.\s', line):
                    options.append(line[3:].strip())
            
            if not question.startswith('page'):
                questions.append({'num': 1, 'question': question, 'options': options})
    
    # Process each marker
    for i, marker in enumerate(markers):
        q_num = int(marker.group(1))
        start = marker.end()
        end = markers[i+1].start() if i+1 < len(markers) else len(text)
        qtext = text[start:end]
        
        lines = qtext.strip().split('\n')
        if not lines:
            continue
        
        question = lines[0].strip()
        options = []
        for line in lines[1:]:
            line = line.strip()
            if re.match(r'[A-E]\.\s', line):
                options.append(line[3:].strip())
        
        if question.startswith('page'):
            continue
        
        questions.append({'num': q_num + 1, 'question': question, 'options': options})
    
    print(f"  Extracted {len(questions)} questions")
    
    for q in questions:
        all_mock_questions.append({
            'mock': mock_name,
            'num': q['num'],
            'question': q['question'],
            'options': q['options']
        })

print(f"\nTotal Mock questions parsed: {len(all_mock_questions)}")

# Print some stats
for q in all_canvas_questions[:10]:
    print(f"Canvas W{q['week']} Q{q['num']}: {len(q['options'])} options, expl={len(q['explanation'])} chars, question={q['question'][:80]}")

for q in all_mock_questions[:10]:
    print(f"Mock {q['mock']} Q{q['num']}: {q['question'][:80]}")
