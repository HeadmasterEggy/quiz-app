import fitz
import re
import json
import os

doc = fitz.open("/Users/joey/Downloads/ilovepdf_merged.pdf")
pages_text = []
for i in range(doc.page_count):
    pages_text.append(doc[i].get_text())

all_text = "\n".join(pages_text)

# Let me write a more comprehensive parser
# For Canvas quizzes, I'll use the explanation text to determine correct answers

# Let me first find all Canvas quiz questions and extract them with their explanations
# The pattern for a question block is:
# Question X
# Y / Y pts
# options...
# Correct answer
# [explanation text]

# Let me extract all question blocks
question_blocks = []

# Find all occurrences of "Question N" followed by "pts"
question_pattern = re.compile(r'Question\s+(\d+)\s+\n\s*(\d+)\s*/\s*(\d+)\s*pts', re.MULTILINE)
questions_found = question_pattern.findall(all_text)
print(f"Questions found: {len(questions_found)}")

# For each question, find the options and explanation
# Let me use a different approach - split by "Correct answer"
parts = all_text.split("Correct answer")
print(f"Number of 'Correct answer' splits: {len(parts)}")

# Let me try to match the question text with options using a different strategy
# I'll look for the question texts at the bottom of pages

# Extract all text that matches the pattern (MCQ, choose X) or (MAQ, choose X)
question_text_pattern = re.compile(r'\((MCQ|MAQ), choose (\d+)\)\s*(.*?)(?=\n\s*5/31/26|\n\s*INFO5995|\n\s*Quiz Score|\n\s*Take the Quiz Again|$)', re.DOTALL)
question_texts = question_text_pattern.findall(all_text)
print(f"Question texts found: {len(question_texts)}")

for i, (qtype, num, text) in enumerate(question_texts[:20]):
    print(f"\nQ{i+1}: ({qtype}, choose {num})")
    print(text[:200])

# Let me also look at the full text and search for specific patterns
print("\n\n--- Looking at first 5000 chars ---")
print(all_text[:5000])
