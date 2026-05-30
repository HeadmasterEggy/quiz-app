#!/usr/bin/env bash
set -e

cd /Users/joey/.openclaw/workspace-main/quiz-app

# Pull latest to avoid conflicts
git pull origin master || true

# Check if we have changes to make
echo "🤖 Iterating on quiz app..."

# Generate an improvement prompt for the agent
# The actual code improvement will be done by an OpenClaw agent via cron job
echo "Improvement cycle: $(date)" >> .improvements.log

# For now, the agent will handle improvements via the cron job payload
# This script ensures git is in sync

# Push any pending changes
if [ -n "$(git status --porcelain)" ]; then
  git add .
  git commit -m "✨ auto-improvement: $(date '+%Y-%m-%d %H:%M')"
  git push origin master
  echo "Pushed changes at $(date)"
else
  echo "No changes to push at $(date)"
fi
