// oxlint-disable no-console
import * as t from "tap";
import { IPMatcher } from "./IPMatcher";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const testIpRanges = JSON.parse(
  readFileSync(join(__dirname, "./fixtures/testIPRanges.json"), "utf-8")
);
const ipsToCheck = JSON.parse(
  readFileSync(join(__dirname, "./fixtures/ipsToCheck.json"), "utf-8")
);

// @esm-tests-skip

function gcAvailable() {
  return typeof global.gc === "function";
}

function heapUsedBytes() {
  global.gc!();
  return process.memoryUsage().heapUsed;
}

t.test("IPMatcher heap footprint per stored network", async (t) => {
  if (!gcAvailable()) {
    t.fail("global.gc() is not available, run node with --expose-gc");
    return;
  }

  const before = heapUsedBytes();
  const matcher = new IPMatcher(testIpRanges);
  const after = heapUsedBytes();

  const bytesPerNetwork = (after - before) / testIpRanges.length;

  console.log(
    `IPMatcher with ${testIpRanges.length} networks uses ~${(
      (after - before) /
      1024
    ).toFixed(2)} KB (~${bytesPerNetwork.toFixed(0)} bytes/network)`
  );

  t.ok(
    bytesPerNetwork < 500,
    `expected less than 500 bytes per stored network, got ${bytesPerNetwork.toFixed(0)}`
  );

  t.ok(matcher.has(testIpRanges[0].split("/")[0]));
});

t.test(
  "IPMatcher.has() does not leak memory under sustained load",
  async (t) => {
    if (!gcAvailable()) {
      t.fail("global.gc() is not available, run node with --expose-gc");
      return;
    }

    const matcher = new IPMatcher(testIpRanges);

    // Warm up so JIT compilation
    const warmupIterations = 3_000;
    for (let i = 0; i < warmupIterations; i++) {
      for (const { ip } of ipsToCheck) {
        matcher.has(ip);
      }
    }

    const before = heapUsedBytes();

    const iterations = 50_000;
    for (let i = 0; i < iterations; i++) {
      for (const { ip } of ipsToCheck) {
        matcher.has(ip);
      }
    }

    const after = heapUsedBytes();
    const diff = after - before;

    console.log(
      `Heap usage before: ${(before / 1024 / 1024).toFixed(2)} MB, after: ${(
        after /
        1024 /
        1024
      ).toFixed(2)} MB (diff: ${(diff / 1024).toFixed(2)} KB) after ${(
        iterations * ipsToCheck.length
      ).toLocaleString()} has() calls`
    );

    t.ok(
      diff < 500 * 1024,
      `expected heap growth below 500KB after sustained load, got ${(diff / 1024 / 1024).toFixed(2)}MB`
    );
  }
);
