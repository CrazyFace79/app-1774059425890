#!/bin/bash

echo "🧪 Running BUTTONS & EXPORTS FIX PASS Tests..."

# Install Playwright if not installed
if ! command -v playwright &> /dev/null; then
    echo "📦 Installing Playwright..."
    npx playwright install
fi

# Run unit tests
echo "🔬 Running unit tests..."
npm run test:run
if [ $? -ne 0 ]; then
    echo "❌ Unit tests failed"
    exit 1
fi

# Build the project
echo "🏗️ Building project..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

# Run E2E tests
echo "🎭 Running E2E tests..."
npm run test:e2e
if [ $? -ne 0 ]; then
    echo "❌ E2E tests failed"
    exit 1
fi

echo "✅ All checks passed. Build OK"
