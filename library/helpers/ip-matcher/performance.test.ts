// oxlint-disable no-console
import * as t from "tap";
import { IPMatcher } from "./IPMatcher";
import { createIPMatcher } from "./createIPMatcher";
import { loadNodeInternals } from "../loadNodeInternals";
import { BlockList } from "net";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSemverNodeVersion } from "../getNodeVersion";
import { isVersionGreaterOrEqual } from "../isVersionGreaterOrEqual";

// @esm-tests-skip

const testIpRanges = JSON.parse(
  readFileSync(join(__dirname, "./fixtures/testIPRanges.json"), "utf-8")
);
const ipsToCheck = JSON.parse(
  readFileSync(join(__dirname, "./fixtures/ipsToCheck.json"), "utf-8")
);
const nativeBenchmarkIpRangeFiles = [
  "list-1.json",
  "list-2.json",
  "list-3.json",
  "list-4.json",
  "list-5.json",
  "list-6.json",
];

const iterations = 500;
const maxNativeCreationBlockingMS = 50;

async function createAndMeasureNativeIPMatcher(networks: string[]) {
  let lastEventLoopTurnAt = performance.now();
  let maxEventLoopDelayMS = 0;
  let keepMeasuringEventLoop = true;

  const measureEventLoopTurn = () => {
    const now = performance.now();
    maxEventLoopDelayMS = Math.max(
      maxEventLoopDelayMS,
      now - lastEventLoopTurnAt
    );
    lastEventLoopTurnAt = now;

    if (keepMeasuringEventLoop) {
      setImmediate(measureEventLoopTurn);
    }
  };

  // Queue this before creation because it cannot run until the native binding
  // has copied every network string from JavaScript and returned control to Node.
  setImmediate(measureEventLoopTurn);

  const buildStartedAt = performance.now();
  const matcherPromise = createIPMatcher(networks);
  const creationDurationMS = performance.now() - buildStartedAt;

  let matcher: Awaited<ReturnType<typeof createIPMatcher>>;
  let buildDurationMS = 0;
  try {
    matcher = await matcherPromise;
    buildDurationMS = performance.now() - buildStartedAt;
  } finally {
    keepMeasuringEventLoop = false;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  return { matcher, creationDurationMS, buildDurationMS, maxEventLoopDelayMS };
}

t.test("test performance in comparison to node:net.blocklist", async (t) => {
  const ipMatcher = new IPMatcher(testIpRanges);
  const blockList = new BlockList();

  for (const ipRange of testIpRanges) {
    if (ipRange.includes("/")) {
      const [ip, mask] = ipRange.split("/");
      blockList.addSubnet(
        ip,
        parseInt(mask, 10),
        ip.includes(":") ? "ipv6" : "ipv4"
      );
    } else {
      blockList.addAddress(ipRange);
    }
  }

  const startIpMatcher = performance.now();
  for (let i = 0; i < iterations; i++) {
    for (const toCheck of ipsToCheck) {
      const blocked = ipMatcher.has(toCheck.ip);
      if (blocked !== toCheck.shouldExist) {
        throw new Error("Blocklist check returned wrong result");
      }
    }
  }
  const endIpMatcher = performance.now();
  const ipMatcherMs = (endIpMatcher - startIpMatcher) / iterations;

  const startBlockList = performance.now();
  for (let i = 0; i < iterations; i++) {
    for (const toCheck of ipsToCheck) {
      const blocked =
        blockList.check(toCheck.ip, "ipv4") ||
        blockList.check(toCheck.ip, "ipv6");
      if (blocked !== toCheck.shouldExist) {
        throw new Error("Blocklist check returned wrong result");
      }
    }
  }
  const endBlockList = performance.now();

  const blockListMs = (endBlockList - startBlockList) / iterations;

  const percentageDiff = ((blockListMs - ipMatcherMs) / ipMatcherMs) * 100;

  if (!isVersionGreaterOrEqual("26.8.0", getSemverNodeVersion())) {
    // Expect the IPMatcher to be faster than the BlockList
    // On Node.js 26.8.0 and later, the BlockList has been optimized and is now faster than the IPMatcher
    t.same(percentageDiff > 10, true);
  }
});

t.test("IPMatcher.has() throughput", async (t) => {
  const matcher = new IPMatcher(testIpRanges);

  // Warm up JIT
  for (let i = 0; i < 3_000; i++) {
    for (const { ip } of ipsToCheck) {
      matcher.has(ip);
    }
  }

  const iterations = 50_000;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    for (const { ip } of ipsToCheck) {
      matcher.has(ip);
    }
  }
  const end = performance.now();

  const totalCalls = iterations * ipsToCheck.length;
  const msPerCall = (end - start) / totalCalls;

  console.log(
    `has() took ${msPerCall.toFixed(6)}ms per call (${totalCalls.toLocaleString()} calls in ${(
      end - start
    ).toFixed(1)}ms)`
  );

  t.ok(
    msPerCall < 0.02,
    `expected has() to take less than 0.02ms per call, took ${msPerCall.toFixed(6)}ms`
  );
});

t.test("Native IPMatcher creation does not block the event loop", async (t) => {
  if (!loadNodeInternals().bindings?.createIPMatcher) {
    t.skip("native IPMatcher is unavailable", () => {});
    return;
  }

  const nativeBenchmarkIpRanges: string[][] = nativeBenchmarkIpRangeFiles.map(
    (fileName) =>
      JSON.parse(
        readFileSync(
          join(__dirname, "./fixtures/native-ip-matcher", fileName),
          "utf-8"
        )
      )
  );
  const creationDurations: number[] = [];
  const buildDurations: number[] = [];
  const eventLoopDelays: number[] = [];
  for (const [index, networks] of nativeBenchmarkIpRanges.entries()) {
    const {
      matcher,
      creationDurationMS,
      buildDurationMS,
      maxEventLoopDelayMS,
    } = await createAndMeasureNativeIPMatcher(networks);

    creationDurations.push(creationDurationMS);
    buildDurations.push(buildDurationMS);
    eventLoopDelays.push(maxEventLoopDelayMS);

    t.ok(
      matcher.has(networks[0]),
      `matcher contains the first network in list ${index + 1}`
    );
    t.ok(
      creationDurationMS < maxNativeCreationBlockingMS,
      `expected native creation for list ${index + 1} to return within ${maxNativeCreationBlockingMS}ms, took ${creationDurationMS.toFixed(2)}ms`
    );
    t.ok(
      maxEventLoopDelayMS < maxNativeCreationBlockingMS,
      `expected native creation for list ${index + 1} not to block the event loop for ${maxNativeCreationBlockingMS}ms, took ${maxEventLoopDelayMS.toFixed(2)}ms`
    );
  }

  const networkCount = nativeBenchmarkIpRanges.reduce(
    (count, networks) => count + networks.length,
    0
  );
  console.log(
    `native creation processed ${networkCount.toLocaleString()} networks; calls took ${creationDurations
      .map((duration) => duration.toFixed(2))
      .join(", ")}ms; builds took ${buildDurations
      .map((duration) => duration.toFixed(2))
      .join(
        ", "
      )}ms; maximum event-loop delay was ${Math.max(...eventLoopDelays).toFixed(2)}ms`
  );
});

t.test("Native IPMatcher.has() throughput", async (t) => {
  if (!loadNodeInternals().bindings?.createIPMatcher) {
    t.skip("native IPMatcher is unavailable", () => {});
    return;
  }

  const matcher = await createIPMatcher(testIpRanges);

  for (let i = 0; i < 3_000; i++) {
    for (const { ip } of ipsToCheck) {
      matcher.has(ip);
    }
  }

  const iterations = 50_000;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    for (const { ip } of ipsToCheck) {
      matcher.has(ip);
    }
  }
  const end = performance.now();

  const totalCalls = iterations * ipsToCheck.length;
  const msPerCall = (end - start) / totalCalls;

  console.log(
    `native has() took ${msPerCall.toFixed(6)}ms per call (${totalCalls.toLocaleString()} calls in ${(
      end - start
    ).toFixed(1)}ms)`
  );

  t.ok(
    msPerCall < 0.02,
    `expected native has() to take less than 0.02ms per call, took ${msPerCall.toFixed(6)}ms`
  );
});
