#!/bin/bash
# WSL run script for Digital Forensic Image Analysis Tool
# This script starts a local web server to run the application
# THIS should??? WORK?? but uhhh who knows

echo "========================================"
echo "Digital Forensic Image Analysis Tool"
echo "Starting Web Server"
echo "========================================"
echo ""

# Ensure wasm-pack is in PATH
export PATH="$HOME/.cargo/bin:$PATH"

# Check if pkg directory exists in root
if [ ! -d "../pkg" ]; then
    echo "WebAssembly module not found. Building..."
    if ! command -v wasm-pack &> /dev/null; then
        echo "[!]ERROR: wasm-pack is not installed[!]"
        echo "Please run scripts/setup.sh first to install wasm-pack"
        exit 1
    fi
    cd ../backend
    wasm-pack build --target web --out-dir ../pkg
    if [ $? -ne 0 ]; then
        echo "Failed to build WebAssembly module"
        exit 1
    fi
    cd ../scripts
fi

# Ensure pkg directory is accessible from frontend (copy or symlink)
if [ ! -d "../frontend/pkg" ] && [ -d "../pkg" ]; then
    echo "Linking pkg directory to frontend..."
    cd ../frontend
    ln -sf ../pkg pkg 2>/dev/null || cp -r ../pkg pkg
    cd ../scripts
fi

# Check for Python
if command -v python3 &> /dev/null; then
    echo "Starting Python HTTP server on http://localhost:8000"
    echo "Press Ctrl+C to stop the server"
    echo ""
    cd frontend
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    echo "Starting Python HTTP server on http://localhost:8000"
    echo "Press Ctrl+C to stop the server"
    echo ""
    cd ../frontend
    python -m http.server 8000
else
    echo "Python not found. Please install Python or use another web server."
    echo "Alternative: npx serve frontend"
    exit 1
fi


