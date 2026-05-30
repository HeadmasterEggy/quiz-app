import fitz
import re
import json
import os

doc = fitz.open("/Users/joey/Downloads/ilovepdf_merged.pdf")
pages_text = []
for i in range(doc.page_count):
    pages_text.append(doc[i].get_text())

all_text = "\n".join(pages_text)

# Let me try a different approach - I'll parse page by page and look for patterns
# For Canvas quizzes, the structure is:
# - Page header: INFO5995 WeekXX
# - Options at top of page
# - Question texts at bottom of page (after "Take the Quiz Again")
# - "Correct answer" appears after options

# Let me first identify all pages and their content
print("Analyzing page structure...")
for i, text in enumerate(pages_text[:10]):
    print(f"\n=== PAGE {i+1} ===")
    # Show first 500 chars and last 500 chars
    print("TOP:", text[:300].replace('\n', ' '))
    print("BOT:", text[-300:].replace('\n', ' '))
