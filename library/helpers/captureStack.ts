let capturingStack = false;

// With source maps enabled, Node calls path.resolve for every CommonJS stack frame
// while building a stack. If the payload equals one of those files, we'd report a fake attack.
// True while we read a stack, so those nested calls can be skipped.
export function isCapturingStack(): boolean {
  return capturingStack;
}

export function captureStack(): string {
  capturingStack = true;
  try {
    return new Error().stack ?? "";
  } finally {
    capturingStack = false;
  }
}

// Only match the installed package, not any path containing the name
const sourceMapSupportFrame =
  /node_modules[\\/](@cspotcode[\\/])?source-map-support[\\/]/;

// True if the stack comes from Node's source map support or the source-map-support package
export function isStackFromSourceMapLookup(stack: string): boolean {
  return (
    stack.includes("node:internal/source_map/") ||
    sourceMapSupportFrame.test(stack)
  );
}
