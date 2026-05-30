import fitz
import re
import json
import os

# Create output directory if needed
os.makedirs("/Users/joey/.openclaw/workspace-main/quiz-app/data", exist_ok=True)

# Open the PDF
doc = fitz.open("/Users/joey/Downloads/ilovepdf_merged.pdf")

# Extract all text page by page
pages_text = []
for i in range(doc.page_count):
    page = doc[i]
    text = page.get_text()
    pages_text.append(text)

print(f"Total pages: {len(pages_text)}")

# Now I need to parse all this. Let me first identify sections by looking for headers
all_text = "\n".join(pages_text)

# Let me find all the Canvas quiz sections and mock exam sections
# Weeks: INFO5995 Week02, Week03, ..., Week12
# Mock exams: INFO5995 Final exam (Mock 2, s1, 2026) and INFO5995 Final exam (Mock, s1, 2026)

# For Canvas quizzes, the structure is complex. Let me write a more targeted parser.
# I'll look for patterns and extract questions manually.

questions = []
question_id = 1

# For now, let me try to extract all questions using a more systematic approach
# I'll search for question texts and their options

# Let me extract the text and look for patterns more carefully
print("Looking for patterns...")

# Find all occurrences of "(MCQ, choose" or "(MAQ, choose"
mcq_pattern = re.compile(r'\((?:MCQ|MAQ), choose (\d+)\)\s*(.*?)(?=\(MCQ|\(MAQ|Question \d+|INFO5995|Quiz Score|5/31/26|$)', re.DOTALL)

matches = mcq_pattern.findall(all_text)
print(f"Found {len(matches)} MCQ/MAQ matches")

# Actually, let me look at the structure more carefully
# The question texts appear at the bottom of pages with "Take the Quiz Again" before them
# But sometimes they appear in the middle of the page too

# Let me try a different approach - extract sections and then parse questions within each section
sections = []

# Find week boundaries
week_boundaries = list(re.finditer(r'INFO5995 Week\w+', all_text))
print(f"Week boundaries: {len(week_boundaries)}")
for m in week_boundaries:
    print(f"  {m.group()} at pos {m.start()}")

# Find mock exam boundaries
mock_boundaries = list(re.finditer(r'INFO5995 Final exam \(Mock', all_text))
print(f"Mock exam boundaries: {len(mock_boundaries)}")
for m in mock_boundaries:
    print(f"  {m.group()} at pos {m.start()}")
