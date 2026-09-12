#!/bin/bash
# Deployment Status Checker
# Shows current branch, commits, and deployment status

echo "=========================================="
echo "  LUMINA STOCK - Deployment Status"
echo "=========================================="
echo ""

# Current branch and commit
echo "📌 Current State:"
echo "   Branch: $(git branch --show-current)"
echo "   Commit: $(git rev-parse --short HEAD)"
echo "   Message: $(git log -1 --pretty=format:'%s')"
echo ""

# Branch comparison
echo "📊 Branch Comparison:"
MAIN_HASH=$(git rev-parse --short main)
DEV_HASH=$(git rev-parse --short dev/release)

if [ "$MAIN_HASH" = "$DEV_HASH" ]; then
    echo "   ✅ main and dev/release are identical ($MAIN_HASH)"
else
    echo "   ⚠️  main ($MAIN_HASH) ≠ dev/release ($DEV_HASH)"

    # Count unmerged commits
    UNMERGED=$(git rev-list main..dev/release --count)
    echo "   📝 Unmerged commits on dev/release: $UNMERGED"

    if [ "$UNMERGED" -gt 0 ]; then
        echo ""
        echo "   Recent unmerged commits:"
        git log main..dev/release --oneline | head -5 | sed 's/^/      /'
    fi
fi
echo ""

# Uncommitted changes
echo "📁 Working Tree:"
if git diff --quiet && git diff --cached --quiet; then
    echo "   ✅ Clean (no uncommitted changes)"
else
    echo "   ⚠️  Uncommitted changes:"
    git status --short | head -10 | sed 's/^/      /'
fi
echo ""

# Remote status
echo "🌐 Remote Status:"
REMOTE=$(git remote get-url origin)
echo "   Remote: $REMOTE"

# Check if local is ahead/behind
LOCAL=$(git rev-parse HEAD)
REMOTE_MAIN=$(git rev-parse origin/main 2>/dev/null || echo "unknown")

if [ "$LOCAL" = "$REMOTE_MAIN" ]; then
    echo "   ✅ Local matches origin/main"
else
    AHEAD=$(git rev-list HEAD..origin/main --count 2>/dev/null || echo "?")
    BEHIND=$(git rev-list origin/main..HEAD --count 2>/dev/null || echo "?")
    echo "   Local is $AHEAD ahead, $BEHIND behind origin/main"
fi
echo ""

# Vercel info
echo "🚀 Vercel Project:"
if [ -f ".vercel/project.json" ]; then
    PROJECT_ID=$(grep -o '"projectId":"[^"]*"' .vercel/project.json | cut -d'"' -f4)
    PROJECT_NAME=$(grep -o '"projectName":"[^"]*"' .vercel/project.json | cut -d'"' -f4)
    echo "   Project: $PROJECT_NAME"
    echo "   ID: $PROJECT_ID"
    echo "   Dashboard: https://vercel.com/dashboard"
else
    echo "   ⚠️  No .vercel/project.json found"
fi
echo ""

# Quick commands
echo "📋 Quick Commands:"
echo "   Deploy to production:"
echo "     git checkout main && git merge dev/release && git push origin main"
echo "     Then: Vercel Dashboard → Deployments → ⋮ → Promote to Production"
echo ""
echo "   Hotfix:"
echo "     git checkout main"
echo "     (make fix) && git commit -m 'fix: ...' && git push origin main"
echo "     Then: Promote to production in Vercel Dashboard"
echo ""
echo "=========================================="
