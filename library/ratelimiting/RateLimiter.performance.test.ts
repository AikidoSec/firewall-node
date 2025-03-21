import * as t from "tap";
import { RateLimiter } from "./RateLimiter";

const ttl = 60000; // 1 minute in milliseconds
const keyCount = 50_000;

const keys = Array.from({ length: keyCount }, (_, i) => `user${i}`);

t.test("check performance for first check for a key", async (t) => {
  const limiter = new RateLimiter(100_000_000, ttl);

  const checkStart = performance.now();

  for (const key of keys) {
    limiter.isAllowed(key, ttl, 3);
  }

  const checkEnd = performance.now();
  const timePerCheck = (checkEnd - checkStart) / keyCount;

  if (timePerCheck > 0.001 /* ms */) {
    t.fail(`Performance test failed: ${timePerCheck}ms per check`);
  } else {
    t.pass(`Performance test passed: ${timePerCheck}ms per check`);
  }
});

t.test(
  "check performance for second check for a key (still allowed)",
  async (t) => {
    const limiter = new RateLimiter(100_000_000, ttl);

    for (const key of keys) {
      limiter.isAllowed(key, ttl, 3);
    }

    const checkStart = performance.now();

    for (const key of keys) {
      limiter.isAllowed(key, ttl, 3);
    }

    const checkEnd = performance.now();
    const timePerCheck = (checkEnd - checkStart) / keyCount;

    if (timePerCheck > 0.001 /* ms */) {
      t.fail(`Performance test failed: ${timePerCheck}ms per check`);
    } else {
      t.pass(`Performance test passed: ${timePerCheck}ms per check`);
    }
  }
);

t.test("check performance a blocked key", async (t) => {
  const limiter = new RateLimiter(100_000_000, ttl);

  for (const key of keys) {
    limiter.isAllowed(key, ttl, 2);
    limiter.isAllowed(key, ttl, 2);
  }

  const checkStart = performance.now();

  for (const key of keys) {
    limiter.isAllowed(key, ttl, 2);
  }

  const checkEnd = performance.now();
  const timePerCheck = (checkEnd - checkStart) / keyCount;

  if (timePerCheck > 0.001 /* ms */) {
    t.fail(`Performance test failed: ${timePerCheck}ms per check`);
  } else {
    t.pass(`Performance test passed: ${timePerCheck}ms per check`);
  }
});
