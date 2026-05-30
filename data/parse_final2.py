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
# PARSE CANVAS QUIZZES
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
        
        for line in lines:
            raw_line = line
            line = line.strip()
            if not line:
                continue
            if line == 'Correct answer':
                in_options = False
                continue
            
            # Check if this is an option (has \xa0 or bullet point in raw line)
            if in_options and ('\xa0' in raw_line or '\u2022' in raw_line or '\u00a0' in raw_line):
                clean_opt = line
                # Skip if it's a question marker or footer
                if clean_opt and not clean_opt.startswith('(') and not clean_opt.startswith('5/31/26') and not clean_opt.startswith('INFO5995') and not clean_opt.startswith('http') and not clean_opt.startswith('Quiz Score') and not clean_opt.startswith('Take the Quiz Again'):
                    options.append(clean_opt)
            elif not in_options:
                # This is explanation text
                if line not in ['Correct answer', 'Take the Quiz Again', 'Quiz Score'] and not line.startswith('5/31/26') and not line.startswith('INFO5995') and not line.startswith('http') and not line.startswith('('):
                    explanation += line + ' '
        
        explanation = explanation.strip()
        explanation = re.sub(r'5/31/26.*$', '', explanation).strip()
        explanation = re.sub(r'INFO5995.*$', '', explanation).strip()
        explanation = re.sub(r'https?://.*$', '', explanation).strip()
        explanation = explanation.replace('\uea6a', '').strip()
        
        # Also check for question text in the explanation
        # For some questions, the question text is mixed with the explanation
        
        week_questions.append({
            'week': week,
            'num': q_num,
            'score': score,
            'max_score': max_score,
            'options': options,
            'explanation': explanation
        })
    
    all_canvas_questions.extend(week_questions)

print(f"\nTotal Canvas questions parsed: {len(all_canvas_questions)}")

# ============================================================
# PARSE MOCK EXAMS - Using improved regex approach
# ============================================================

all_mock_questions = []

for mock_name, text in mock_exams.items():
    print(f"\nParsing {mock_name} ({len(text)} chars)")
    
    # Remove page footers like "page 2 of 13"
    text = re.sub(r'page \d+ of \d+\s*', '', text)
    
    # Find all questions using regex
    # Pattern: (N) followed by text until next (N+1) or end
    # But we also need to capture the first question before (1)
    
    # First, find where Problem 1 starts
    problem1_match = re.search(r'Problem 1\.\s*\[\d+ marks\]', text)
    if not problem1_match:
        print("  No Problem 1 found")
        continue
    
    # Find all (N) markers
    markers = list(re.finditer(r'\((\d+)\)\s*', text))
    print(f"  Found {len(markers)} markers")
    
    questions = []
    
    # The first question starts after Problem 1 and ends at the first marker
    if markers:
        first_marker = markers[0]
        first_qtext = text[problem1_match.end():first_marker.start()]
        
        # Parse the first question
        lines = first_qtext.strip().split('\n')
        # Remove instructions like "Each question has only one correct answer..."
        q_lines = []
        for line in lines:
            line = line.strip()
            if line and not line.startswith('Each question') and not line.startswith('score +') and not line.startswith('and 0 otherwise'):
                q_lines.append(line)
        
        if q_lines:
            # Extract question and options
            question = q_lines[0]
            options = []
            for line in q_lines[1:]:
                if re.match(r'[A-E]\.\s', line):
                    options.append(line[3:].strip())
            
            questions.append({
                'num': 1,
                'question': question,
                'options': options
            })
    
    # Now process each marker
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
        
        # Skip page-only questions
        if question.startswith('page'):
            continue
        
        questions.append({
            'num': q_num + 1,  # Because marker (1) is end of Q1, so text after it is Q2
            'question': question,
            'options': options
        })
    
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
for q in all_canvas_questions[:5]:
    print(f"Canvas W{q['week']} Q{q['num']}: {len(q['options'])} options, expl={len(q['explanation'])} chars")

for q in all_mock_questions[:5]:
    print(f"Mock {q['mock']} Q{q['num']}: {q['question'][:80]}")
