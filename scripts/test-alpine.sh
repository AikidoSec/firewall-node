#!/bin/bash
set -e

# Test that Zen loads correctly on Alpine Linux (musl)
# This script is meant to be run from the repo root after building.

echo "Testing Zen on Alpine Linux (musl)..."

output=$(docker run --rm -e AIKIDO_DEBUG=true -w /app \
  -v "$(pwd)/build:/app/node_modules/@aikidosec/firewall" \
  node:22-alpine \
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
