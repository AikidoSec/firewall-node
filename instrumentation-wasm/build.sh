#!/usr/bin/env bash
set -e

# ------ CONFIGURATION ------

TARGET=nodejs
OUT_DIR=../library/agent/hooks/instrumentation/wasm
GENERATE_DTS=false

BINARYEN_VERSION=123 # wasm-opt
WASM_BINDGEN_VERSION=0.2.101

# ---------------------------

echo "Starting build process for wasm module"

# Always run from script's own directory and return at the end
SCRIPT_DIR="$(cd "$(dirname "$(realpath "$0")")" && pwd)"
pushd "$SCRIPT_DIR" > /dev/null

# Create directories
mkdir -p ./.bin/tmp
mkdir -p "$OUT_DIR"

# ------ Functions ------

download_binaryen() {
  set -e

  BINARYEN_BASE_URL="https://github.com/WebAssembly/binaryen/releases/download/version_$BINARYEN_VERSION"
  BINARYEN_EXTRACT_DIR="binaryen"

  # Detect OS
  case "$(uname -s)" in
    Linux*)  OS="linux" ;;
    Darwin*) OS="macos" ;;
    *) echo "Unsupported OS"; exit 1 ;;
  esac

  # Detect ARCH
  case "$(uname -m)" in
    x86_64) ARCH="x86_64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *) echo "Unsupported arch"; exit 1 ;;
  esac

  # Adjust ARM label for Linux
  [ "$ARCH" = "arm64" ] && [ "$OS" = "linux" ] && ARCH="aarch64"

  FILE="binaryen-version_${BINARYEN_VERSION}-${ARCH}-${OS}.tar.gz"

  mkdir -p ./.bin/tmp
  cd ./.bin/tmp

  echo "Downloading from $BINARYEN_BASE_URL/$FILE"

  curl -LO --fail "$BINARYEN_BASE_URL/$FILE"

  mkdir -p "../$BINARYEN_EXTRACT_DIR"
  tar -xzf "$FILE" -C "../$BINARYEN_EXTRACT_DIR" --strip-components=1

  cd ../..
  rm -rf ./.bin/tmp
}

download_wasm_bindgen() {
  set -e

  WASM_BINDGEN_URL_BASE="https://github.com/wasm-bindgen/wasm-bindgen/releases/download/$WASM_BINDGEN_VERSION"
  WASM_BINDGEN_DIR="wasm-bindgen"

  # Detect OS and ARCH for wasm-bindgen
  case "$(uname -s)" in
    Linux*)
      case "$(uname -m)" in
        x86_64)
          OS="unknown-linux-musl"
          ARCH="x86_64"
          ;;
        aarch64|arm64)
          OS="unknown-linux-gnu"
          ARCH="aarch64"
          ;;
        *) echo "Unsupported arch for Linux"; exit 1 ;;
      esac
      ;;
    Darwin*)
      OS="apple-darwin"
      case "$(uname -m)" in
        x86_64) ARCH="x86_64" ;;
        aarch64|arm64) ARCH="aarch64" ;;
        *) echo "Unsupported arch for Darwin"; exit 1 ;;
      esac
      ;;
    *) echo "Unsupported OS"; exit 1 ;;
  esac

  FILE="wasm-bindgen-${WASM_BINDGEN_VERSION}-${ARCH}-${OS}.tar.gz"

  mkdir -p ./.bin/tmp
  cd ./.bin/tmp

  echo "Downloading from $WASM_BINDGEN_URL_BASE/$FILE"

  curl -LO --fail "$WASM_BINDGEN_URL_BASE/$FILE"

  mkdir -p "../$WASM_BINDGEN_DIR"
  tar -xzf "$FILE" -C "../$WASM_BINDGEN_DIR" --strip-components=1

  cd ../..
  rm -rf ./.bin/tmp
}

# ------ Main Script ------

# Ensure rustc >= 1.30.0
MIN_RUSTC_VERSION=1.30.0
RUSTC_VERSION=$(rustc --version | cut -d' ' -f2)

# Compare versions using sort
if ! printf '%s\n%s\n' "$MIN_RUSTC_VERSION" "$RUSTC_VERSION" | sort -VC; then
  echo "rustc >= $MIN_RUSTC_VERSION required, found $RUSTC_VERSION"
  exit 1
fi

echo "Using rustc version: $RUSTC_VERSION"

# Ensure wasm32 target is installed
LIBDIR=$(rustc --target wasm32-unknown-unknown --print target-libdir)

if [ ! -d "$LIBDIR" ]; then
  echo "Target wasm32-unknown-unknown not installed. Installing using rustup..."

  # Check if rustup is installed
  if ! command -v rustup &> /dev/null; then
    echo "rustup is not installed. Please install the wasm32-unknown-unknown target manually or install rustup."
    exit 1
  fi

  rustup target add wasm32-unknown-unknown
fi

# Check if binaryen is already downloaded
if [ ! -d ".bin/binaryen" ]; then
  echo "Downloading binaryen..."
  download_binaryen
else
  echo "Found existing binaryen installation."
fi

# Check if wasm-bindgen is already downloaded
if [ ! -d ".bin/wasm-bindgen" ]; then
  echo "Downloading wasm-bindgen..."
  download_wasm_bindgen
else
  echo "Found existing wasm-bindgen installation."
fi

# Build the wasm module
echo "Building wasm module..."
cargo build --target wasm32-unknown-unknown --release

CRATE_NAME=$(basename "$(cargo metadata --format-version=1 --no-deps | jq -r '.packages[0].name')")
WASM_PATH=target/wasm32-unknown-unknown/release/${CRATE_NAME}.wasm

# wasm-bindgen
echo "Running wasm-bindgen..."
WASM_BINDGEN_OPTS=(--out-dir "$OUT_DIR" --target "$TARGET")
if [ "$GENERATE_DTS" != true ]; then
  WASM_BINDGEN_OPTS+=(--no-typescript)
fi
./.bin/wasm-bindgen/wasm-bindgen "${WASM_BINDGEN_OPTS[@]}" "$WASM_PATH"

# wasm-opt
echo "Running wasm-opt..."
./.bin/binaryen/bin/wasm-opt -O3 --enable-bulk-memory --enable-nontrapping-float-to-int -o "$OUT_DIR/${CRATE_NAME}_bg.wasm" "$OUT_DIR/${CRATE_NAME}_bg.wasm"

echo "Build completed successfully. Output is in $OUT_DIR"

# Switch back to the original directory
popd > /dev/null
