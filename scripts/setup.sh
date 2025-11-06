#!/bin/bash
# WSL setup script for Digital Forensic Image Analysis Tool
# This script sets up the development environment in WSL

echo "========================================"
echo "Digital Forensic Image Analysis Tool"
echo "Setup Script (WSL)"
echo "========================================"
echo ""

# Check if Rust is installed
echo "Checking for Rust installation..."
if ! command -v rustc &> /dev/null; then
    echo "Rust is not installed. Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
else
    echo "Rust is installed: $(rustc --version)"
fi

# Check if wasm-pack is installed
echo "Checking for wasm-pack..."
if ! command -v wasm-pack &> /dev/null; then
    echo "wasm-pack is not installed! Installing wasm-pack..."
    echo "This may take a few minutes..."
    # Try using the official installer first (faster and more reliable)
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
    if [ $? -ne 0 ]; then
        echo "Official installer failed, trying cargo install..."
        cargo install wasm-pack
    fi
    # Ensure cargo bin directory is in PATH
    export PATH="$HOME/.cargo/bin:$PATH"
    source $HOME/.cargo/env 2>/dev/null || true
else
    echo "wasm-pack is installed: $(wasm-pack --version)"
fi

# Ensure wasm-pack is in PATH
export PATH="$HOME/.cargo/bin:$PATH"
if ! command -v wasm-pack &> /dev/null; then
    echo "[!]ERROR: wasm-pack is still not found after installation[!]"
    echo ""
    echo "Please install wasm-pack manually by running one of these commands:"
    echo "  curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh"
    echo "  OR"
    echo "  cargo install wasm-pack"
    echo ""
    echo "Then ensure ~/.cargo/bin is in your PATH by adding this to ~/.bashrc or ~/.zshrc:"
    echo "  export PATH=\"\$HOME/.cargo/bin:\$PATH\""
    echo ""
    exit 1
fi

# Install Rust dependencies
echo "Installing Rust dependencies..."
cd backend
cargo build
if [ $? -ne 0 ]; then
    echo "[!]ERROR: Failed to build Rust project[!]"
    exit 1
fi
cd ..

# Build WebAssembly
echo "Building WebAssembly module..."
cd backend
wasm-pack build --target web --out-dir ../pkg
if [ $? -ne 0 ]; then
    echo "[!]ERROR: Failed to build WebAssembly module[!]"
    exit 1
fi
cd ..

echo ""
echo "========================================"
echo "Setup completed successfully!"
echo "========================================"
echo ""
echo "To run the project:"
echo "1. Start a local web server in the frontend directory"
echo "   Example: python3 -m http.server 8000"
echo "   Or: npx serve frontend"
echo "2. Open http://localhost:8000 in your browser"
echo ""

