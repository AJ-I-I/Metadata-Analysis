# PowerShell run script for Digital Forensic Image Analysis Tool
# This script starts a local web server to run the application

Write-Host "========================================" -ForegroundColor Green
Write-Host "Digital Forensic Image Analysis Tool" -ForegroundColor Green
Write-Host "Starting Web Server" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if pkg directory exists
if (-not (Test-Path "..\pkg")) {
    Write-Host "WebAssembly module not found. Building..." -ForegroundColor Red
    Set-Location ..\backend
    wasm-pack build --target web --out-dir ..\pkg
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[!]ERROR: Failed to build WebAssembly module[!]" -ForegroundColor Red
        exit
    }
    Set-Location ..\scripts
}

# Check for Python
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    $python = Get-Command python3 -ErrorAction SilentlyContinue
}

if ($python) {
    Write-Host "Starting Python HTTP server on http://localhost:8000" -ForegroundColor Purple
    Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
    Write-Host ""
    Set-Location ..\frontend
    python -m http.server 8000
} else {
    Write-Host "[!]ERROR: Python not found. Please install Python or use another web server[!]" -ForegroundColor Red
    Write-Host "Alternative: npx serve frontend" -ForegroundColor Yellow
}


