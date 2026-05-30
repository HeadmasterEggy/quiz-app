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

# Let me write a comprehensive parser
questions = []

# Helper function to clean text
def clean_text(text):
    text = text.replace('\xa0', ' ').replace('\uea6a', '').strip()
    text = re.sub(r'\s+', ' ', text)
    return text

# Let me first find all sections and their boundaries
section_boundaries = []

# Find Canvas quiz sections
week_matches = list(re.finditer(r'INFO5995 Week\w+', all_text))
for i, m in enumerate(week_matches):
    section_boundaries.append((m.start(), m.group(), 'canvas'))

# Find mock exam sections
mock_matches = list(re.finditer(r'INFO5995 Final exam \(Mock', all_text))
for i, m in enumerate(mock_matches):
    section_boundaries.append((m.start(), m.group(), 'mock'))

section_boundaries.sort()

print(f"Found {len(section_boundaries)} sections")
for start, name, stype in section_boundaries:
    print(f"  {name} ({stype}) at {start}")

# Extract sections
sections = []
for i in range(len(section_boundaries)):
    start = section_boundaries[i][0]
    end = section_boundaries[i+1][0] if i+1 < len(section_boundaries) else len(all_text)
    name = section_boundaries[i][1]
    stype = section_boundaries[i][2]
    text = all_text[start:end]
    sections.append((name, stype, text))

print(f"\nExtracted {len(sections)} sections")

# Now parse each section
for name, stype, text in sections:
    print(f"\n{'='*60}")
    print(f"Section: {name} ({stype})")
    print(f"Length: {len(text)} chars")
    
    if stype == 'canvas':
        # Parse Canvas quiz
        # Look for questions in this section
        # Each question has: "Question N", "X / Y pts", options, "Correct answer"
        # And question text at the bottom with (MCQ/MAQ, choose X)
        
        # Find all question blocks
        question_pattern = re.compile(r'Question\s+(\d+)\s+\n\s*(\d+)\s*/\s*(\d+)\s*pts\s*\n(.*?)(?=Question\s+\d+|Quiz Score|INFO5995|5/31/26|$)', re.DOTALL)
        q_matches = question_pattern.findall(text)
        print(f"  Found {len(q_matches)} question blocks")
        
        for q_num, score, max_score, q_text in q_matches:
            print(f"    Q{q_num}: {score}/{max_score}")
            print(f"    Options text: {q_text[:200]}")
    
    elif stype == 'mock':
        # Parse mock exam
        print(f"  Mock exam text preview: {text[:500]}")
