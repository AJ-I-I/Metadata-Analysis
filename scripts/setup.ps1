# PowerShell setup script for Digital Forensic Image Analysis Tool
# This script sets up the development environment on Windows
# THIS SHOULD WORK but yknow, who knows, who cares

Write-Host "========================================" -ForegroundColor Green
Write-Host "Digital Forensic Image Analysis Tool" -ForegroundColor Green
Write-Host "Setup Script (PowerShell)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if Rust is installed
Write-Host "Checking for Rust installation..." -ForegroundColor Yellow
$rustInstalled = Get-Command rustc -ErrorAction SilentlyContinue

if (-not $rustInstalled) {
    Write-Host "Rust is not installed. Installing Rust..." -ForegroundColor Yellow
    Write-Host "Please visit https://rustup.rs/ to install Rust" -ForegroundColor Yellow
    Write-Host "Or run: Invoke-WebRequest https://win.rustup.rs/x86_64 -OutFile rustup-init.exe; .\rustup-init.exe" -ForegroundColor Yellow
    $installRust = Read-Host "Do you want to download and run rustup-init.exe? (Y/N)"
    if ($installRust -eq "Y" -or $installRust -eq "y") {
        Invoke-WebRequest https://win.rustup.rs/x86_64 -OutFile rustup-init.exe
        Write-Host "Running rustup-init.exe..." -ForegroundColor Yellow
        Start-Process -FilePath ".\rustup-init.exe" -Wait
        Remove-Item rustup-init.exe
        Write-Host "Please restart your terminal and run this script again." -ForegroundColor Yellow
        exit
    } else {
        Write-Host "Please install Rust manually and run this script again." -ForegroundColor Red
        exit
    }
} else {
    Write-Host "Rust is installed: $((rustc --version))" -ForegroundColor Green
}

# Check if wasm-pack is installed
Write-Host "Checking for wasm-pack..." -ForegroundColor Yellow
$wasmPackInstalled = Get-Command wasm-pack -ErrorAction SilentlyContinue

if (-not $wasmPackInstalled) {
    Write-Host "wasm-pack is not installed. Installing wasm-pack..." -ForegroundColor Yellow
    cargo install wasm-pack
} else {
    Write-Host "wasm-pack is installed: $((wasm-pack --version))" -ForegroundColor Green
}

# Install Rust dependencies
Write-Host "Installing Rust dependencies..." -ForegroundColor Yellow
Set-Location backend
cargo build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to build Rust project" -ForegroundColor Red
    exit
}
Set-Location ..

# Build WebAssembly
Write-Host "Building WebAssembly module..." -ForegroundColor Yellow
Set-Location backend
wasm-pack build --target web --out-dir ../pkg
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to build WebAssembly module" -ForegroundColor Red
    exit
}
Set-Location ..

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Setup completed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "To run the project:" -ForegroundColor Yellow
Write-Host "1. Start a local web server in the frontend directory" -ForegroundColor Yellow
Write-Host "   Example: python -m http.server 8000" -ForegroundColor Yellow
Write-Host "   Or: npx serve frontend" -ForegroundColor Yellow
Write-Host "2. Open http://localhost:8000 in your browser" -ForegroundColor Yellow
Write-Host ""

