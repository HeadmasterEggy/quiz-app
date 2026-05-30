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

# Let me write a more targeted parser
# First, I'll find all the actual quiz sections by looking for specific patterns

# Canvas quizzes start with "INFO5995 WeekXX" followed by "Due"
# Mock exams start with "INFO5995 Final exam (Mock"

# Let me find the major section boundaries by looking for the FIRST occurrence of each week on each page
# Actually, let me just use a simpler approach: find all "Take the Quiz Again" or "Quiz Score" markers
# and use those as section boundaries

# Actually, a better approach: since the PDF is just concatenated pages, let me identify the actual quiz
# boundaries by looking at the start of each page

quiz_pages = []
for i, text in enumerate(pages_text):
    lines = text.split('\n')
    first_line = lines[0].strip() if lines else ''
    
    # Check if this page starts a new quiz
    if 'Week' in first_line or 'Final exam' in first_line:
        quiz_pages.append((i, first_line, text))
    else:
        # Continuation page
        if quiz_pages:
            quiz_pages[-1] = (quiz_pages[-1][0], quiz_pages[-1][1], quiz_pages[-1][2] + '\n' + text)

print(f"Found {len(quiz_pages)} quiz sections")
for start, name, text in quiz_pages:
    print(f"  Page {start+1}: {name} ({len(text)} chars)")

# Now parse each quiz section
questions = []

for start, name, text in quiz_pages:
    print(f"\n{'='*60}")
    print(f"Parsing: {name}")
    
    if 'Final exam' in name:
        # Parse mock exam
        # Questions are numbered (1), (2), etc. with A, B, C, D options
        # Problem 1: Q1-25 (MCQ)
        # Problem 2: Q26-35 (MAQ, 2 out of 4)
        # Problem 3: Q36-40 (Hard MAQ, 2 out of 5)
        
        # Find all questions
        # Mock exam format: question number in parentheses, then question text, then options A-D or A-E
        mock_pattern = re.compile(r'\((\d+)\)\s*(.*?)(?=\([\d]+\)|$)', re.DOTALL)
        matches = mock_pattern.findall(text)
        print(f"  Found {len(matches)} mock questions")
        
        for num, qtext in matches:
            print(f"    Q{num}: {qtext[:100]}")
    else:
        # Parse Canvas quiz
        # Find all question texts with (MCQ/MAQ, choose X)
        qtext_pattern = re.compile(r'\((MCQ|MAQ), choose (\d+)\)\s*(.*?)(?=\n\s*5/31/26|\n\s*INFO5995|Quiz Score|Take the Quiz Again|$)', re.DOTALL)
        qtexts = qtext_pattern.findall(text)
        print(f"  Found {len(qtexts)} question texts")
        
        for qtype, num, qtext in qtexts:
            print(f"    ({qtype}, choose {num}): {qtext[:100]}")

print(f"\n\nTotal questions so far: {len(questions)}")
