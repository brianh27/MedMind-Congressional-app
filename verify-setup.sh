#!/bin/bash

# Environment Setup Verification Script
echo "🔍 Verifying MedMind App Security Setup..."

# Check if .env files are properly excluded
echo "✅ Checking .gitignore configuration..."
if grep -q ".env" .gitignore; then
    echo "   ✓ Root .gitignore excludes .env files"
else
    echo "   ❌ Root .gitignore missing .env exclusions"
fi

if grep -q ".env" frontend/.gitignore; then
    echo "   ✓ Frontend .gitignore excludes .env files"
else
    echo "   ❌ Frontend .gitignore missing .env exclusions"
fi

# Check if .env.example files exist
echo "✅ Checking for .env.example templates..."
if [[ -f "backend/.env.example" ]]; then
    echo "   ✓ Backend .env.example template exists"
else
    echo "   ❌ Backend .env.example template missing"
fi

if [[ -f "frontend/.env.example" ]]; then
    echo "   ✓ Frontend .env.example template exists"
else
    echo "   ❌ Frontend .env.example template missing"
fi

# Check if actual .env files are present (should NOT be)
echo "✅ Checking for .env files (should NOT exist in repo)..."
if [[ -f "backend/.env" ]]; then
    echo "   ❌ Backend .env file found - REMOVE BEFORE COMMITTING"
else
    echo "   ✓ Backend .env file properly excluded"
fi

if [[ -f "frontend/.env" ]]; then
    echo "   ❌ Frontend .env file found - REMOVE BEFORE COMMITTING"
else
    echo "   ✓ Frontend .env file properly excluded"
fi

# Check if API keys are in code (should NOT be)
echo "✅ Checking for hardcoded API keys..."
if grep -r "sk-emergent" . --exclude-dir=node_modules --exclude-dir=.git --exclude="*.example" 2>/dev/null; then
    echo "   ❌ Hardcoded API keys found in codebase"
else
    echo "   ✓ No hardcoded API keys found"
fi

echo ""
echo "🎉 Security verification complete!"
echo "📋 Next steps:"
echo "   1. Copy .env.example files to .env in both backend/ and frontend/"
echo "   2. Add your actual API keys and configuration to the .env files"
echo "   3. Start the backend: cd backend && uvicorn server:app --reload"
echo "   4. Start the frontend: cd frontend && npm start"