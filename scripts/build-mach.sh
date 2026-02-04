#!/bin/bash
set -e

echo "🏗️  Building Mach unified server..."

# Build frontend
echo "📦 Building frontend..."
cd src/mach/frontend
npm install
npm run build
cd ../../..

# Copy frontend dist to server location
echo "📋 Copying frontend assets..."
mkdir -p dist/mach-frontend
cp -r src/mach/frontend/dist/* dist/mach-frontend/

echo "✅ Build complete!"
echo ""
echo "To start the server:"
echo "  npm run mach:start"
