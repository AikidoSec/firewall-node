#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Error: Node.js version is required"
  echo "Usage: bash scripts/test-alpine.sh <node-version>"
  exit 1
fi

NODE_VERSION="$1"

echo "Testing Zen on Alpine Linux (musl) with Node.js ${NODE_VERSION}..."

output=$(docker run --rm -e AIKIDO_DEBUG=true -w /app \
  -v "$(pwd)/build:/app/node_modules/@aikidosec/firewall" \
  "node:${NODE_VERSION}-alpine" \
  node -e "require('@aikidosec/firewall'); setTimeout(() => console.log('OK'), 1000);" 2>&1)

echo "$output"

if echo "$output" | grep -q "Failed to load native addon"; then
  echo "FAIL: Native addon failed to load on Alpine"
  exit 1
fi

if echo "$output" | grep -q "Cannot find native addon"; then
  echo "FAIL: Native addon not found on Alpine"
  exit 1
fi

if echo "$output" | grep -q "OK"; then
  echo "PASS: Zen loaded successfully on Alpine"
else
  echo "FAIL: Zen did not load correctly on Alpine"
  exit 1
fi
