// oxlint-disable no-console
import * as t from "tap";
import { IPMatcher } from "./IPMatcher";
import { BlockList } from "net";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// @esm-tests-skip

const testIpRanges = JSON.parse(
  readFileSync(join(__dirname, "./fixtures/testIPRanges.json"), "utf-8")
);
const ipsToCheck = JSON.parse(
  readFileSync(join(__dirname, "./fixtures/ipsToCheck.json"), "utf-8")
);

const iterations = 500;

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

  // Expect the IPMatcher to be faster than the BlockList
  t.same(percentageDiff > 10, true);
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
