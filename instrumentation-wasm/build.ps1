#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

# ------ CONFIGURATION ------
$TARGET = "nodejs"
$OUT_DIR = "..\library\agent\hooks\instrumentation\wasm"
$GENERATE_DTS = $false

$BINARYEN_VERSION = 123
$WASM_BINDGEN_VERSION = "0.2.100"

# ---------------------------

Write-Host "Starting build process for wasm module"

# Always run from script's own directory
$SCRIPT_DIR = Split-Path -Parent (Resolve-Path $MyInvocation.MyCommand.Path)
Push-Location $SCRIPT_DIR

# Create directories
New-Item -ItemType Directory -Path ".\.bin\tmp" -Force | Out-Null
New-Item -ItemType Directory -Path $OUT_DIR -Force | Out-Null

function Download-Binaryen {
    $BINARYEN_BASE_URL = "https://github.com/WebAssembly/binaryen/releases/download/version_$BINARYEN_VERSION"
    $BINARYEN_EXTRACT_DIR = "binaryen"
    $ARCH = "x86_64"
    $OS = "windows"

    $FILE = "binaryen-version_${BINARYEN_VERSION}-${ARCH}-${OS}.tar.gz"

    Push-Location ".\.bin\tmp"
    Write-Host "Downloading from $BINARYEN_BASE_URL/$FILE"
    Invoke-WebRequest "$BINARYEN_BASE_URL/$FILE" -OutFile $FILE
    New-Item -ItemType Directory -Path "..\$BINARYEN_EXTRACT_DIR" -Force | Out-Null
    tar -xzf $FILE -C "..\$BINARYEN_EXTRACT_DIR" --strip-components=1
    Pop-Location
}

function Download-WasmBindgen {
    $WASM_BINDGEN_URL_BASE = "https://github.com/wasm-bindgen/wasm-bindgen/releases/download/$WASM_BINDGEN_VERSION"
    $WASM_BINDGEN_DIR = "wasm-bindgen"
    $ARCH = "x86_64"
    $OS = "pc-windows-msvc"

    $FILE = "wasm-bindgen-${WASM_BINDGEN_VERSION}-${ARCH}-${OS}.tar.gz"

    Push-Location ".\.bin\tmp"
    Write-Host "Downloading from $WASM_BINDGEN_URL_BASE/$FILE"
    Invoke-WebRequest "$WASM_BINDGEN_URL_BASE/$FILE" -OutFile $FILE
    New-Item -ItemType Directory -Path "..\$WASM_BINDGEN_DIR" -Force | Out-Null
    tar -xzf $FILE -C "..\$WASM_BINDGEN_DIR" --strip-components=1
    Pop-Location
}

# Ensure rustc >= 1.30.0
$MIN_RUSTC_VERSION = "1.30.0"
$RUSTC_VERSION = (& rustc --version).Split()[1]

if ([Version]$RUSTC_VERSION -lt [Version]$MIN_RUSTC_VERSION) {
    Write-Error "rustc >= $MIN_RUSTC_VERSION required, found $RUSTC_VERSION"
    exit 1
}

Write-Host "Using rustc version: $RUSTC_VERSION"

# Ensure wasm32 target is installed
$LIBDIR = & rustc --target wasm32-unknown-unknown --print target-libdir
if (-not (Test-Path $LIBDIR)) {
    Write-Host "Target wasm32-unknown-unknown not installed. Installing..."
    if (-not (Get-Command rustup -ErrorAction SilentlyContinue)) {
        Write-Error "rustup not installed. Install target manually or install rustup."
        exit 1
    }
    rustup target add wasm32-unknown-unknown
}

# Check binaryen
if (-not (Test-Path ".bin\binaryen")) {
    Write-Host "Downloading binaryen..."
    Download-Binaryen
}
else {
    Write-Host "Found existing binaryen installation."
}

# Check wasm-bindgen
if (-not (Test-Path ".bin\wasm-bindgen")) {
    Write-Host "Downloading wasm-bindgen..."
    Download-WasmBindgen
}
else {
    Write-Host "Found existing wasm-bindgen installation."
}

Remove-Item -Recurse -Force ".\.bin\tmp"

# Build wasm module
Write-Host "Building wasm module..."

cargo build --target wasm32-unknown-unknown --release

# Extract crate name using PowerShell JSON parsing
$metadata = & cargo metadata --format-version=1 --no-deps
$CRATE_NAME = ($metadata | ConvertFrom-Json).packages[0].name
$WASM_PATH = "target\wasm32-unknown-unknown\release\${CRATE_NAME}.wasm"

# wasm-bindgen
Write-Host "Running wasm-bindgen..."
$WASM_BINDGEN_OPTS = @("--out-dir", $OUT_DIR, "--target", $TARGET)
if (-not $GENERATE_DTS) {
    $WASM_BINDGEN_OPTS += "--no-typescript"
}
& ".\.bin\wasm-bindgen\wasm-bindgen.exe" @WASM_BINDGEN_OPTS $WASM_PATH

# wasm-opt
Write-Host "Running wasm-opt..."
& ".\.bin\binaryen\bin\wasm-opt.exe" -O3 --enable-bulk-memory --enable-nontrapping-float-to-int -o "$OUT_DIR\${CRATE_NAME}_bg.wasm" "$OUT_DIR\${CRATE_NAME}_bg.wasm"

Write-Host "Build completed successfully. Output is in $OUT_DIR"

Pop-Location