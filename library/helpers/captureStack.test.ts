import * as t from "tap";
import {
  captureStack,
  isCapturingStack,
  isStackFromSourceMapLookup,
} from "./captureStack";

t.test("it detects stacks created by node source maps", async () => {
  t.same(
    isStackFromSourceMapLookup(
      "Error\n    at pathToFileURL (node:internal/url:1674:58)\n    at findSourceMap (node:internal/source_map/source_map_cache:390:19)"
    ),
    true
  );
});

t.test("it detects stacks created by source-map-support", async () => {
  t.same(
    isStackFromSourceMapLookup(
      "Error\n    at getCacheKey (/app/node_modules/@cspotcode/source-map-support/source-map-support.js:160:14)"
    ),
    true
  );
  t.same(
    isStackFromSourceMapLookup(
      "Error\n    at getCacheKey (/app/node_modules/source-map-support/source-map-support.js:160:14)"
    ),
    true
  );
  t.same(
    isStackFromSourceMapLookup(
      "Error\n    at getCacheKey (C:\\app\\node_modules\\source-map-support\\source-map-support.js:160:14)"
    ),
    true
  );
});

t.test("it ignores normal stacks", async () => {
  t.same(
    isStackFromSourceMapLookup(
      "Error\n    at /app/dist/server.js:19:9\n    at Layer.handle (/app/node_modules/express/lib/router/layer.js:95:5)"
    ),
    false
  );
  t.same(
    isStackFromSourceMapLookup(
      "Error\n    at /app/source-map-support-demo/server.js:19:9"
    ),
    false
  );
});

t.test("it sets the capturing flag only while reading the stack", async () => {
  const original = Error.prepareStackTrace;
  const flagDuringRead: boolean[] = [];
  Error.prepareStackTrace = (err, callSites) => {
    flagDuringRead.push(isCapturingStack());
    return original ? original(err, callSites) : String(err);
  };

  try {
    t.same(isCapturingStack(), false);
    const stack = captureStack();
    t.same(typeof stack, "string");
    t.same(flagDuringRead, [true]);
    t.same(isCapturingStack(), false);
  } finally {
    Error.prepareStackTrace = original;
  }
});
