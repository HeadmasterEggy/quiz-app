import fitz
import re
import json
import os

os.makedirs("/Users/joey/.openclaw/workspace-main/quiz-app/data", exist_ok=True)

doc = fitz.open("/Users/joey/Downloads/ilovepdf_merged.pdf")
pages_text = []
for i in range(doc.page_count):
    pages_text.append(doc[i].get_text())

# Check first lines of first 15 pages
for i in range(min(15, len(pages_text))):
    text = pages_text[i]
    lines = text.split('\n')
    first_line = lines[0].strip() if lines else ''
    print(f"Page {i+1}: first line = {repr(first_line)}")
    print(f"  Length: {len(text)} chars")
