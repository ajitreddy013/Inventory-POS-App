#!/bin/bash

# Windows Build Script for Inventory POS App
# This script handles building the Windows version on macOS, 
# working around Wine compatibility issues

set -e

echo "🏗️  Building Windows version of Inventory POS App"
echo "================================================"

# Step 1: Build React app
echo "📦 Building React application..."
npm run build

# Step 2: Temporarily move icon to prevent Wine issues
echo "🔄 Temporarily moving icon file to prevent Wine issues..."
if [ -f "assets/icon.ico" ]; then
    mv assets/icon.ico assets/icon.ico.bak
    echo "✅ Icon moved to backup"
fi

# Step 3: Build Windows executable
echo "🖥️  Building Windows executable..."
ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES=true npx electron-builder --win portable --x64

# Step 4: Restore icon file
echo "🔄 Restoring icon file..."
if [ -f "assets/icon.ico.bak" ]; then
    mv assets/icon.ico.bak assets/icon.ico
    echo "✅ Icon restored"
fi

# Step 5: Show results
echo "🎉 Build complete!"
echo "📁 Build files are located in: ./dist/"
echo ""
echo "Generated files:"
ls -la dist/ | grep -E "\.(exe|zip)$" || echo "No executable files found"

echo ""
echo "🚀 The Windows portable executable is ready for distribution!"
echo "   Transfer the .exe file to your Windows machine and run it."
