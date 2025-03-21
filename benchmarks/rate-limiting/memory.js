const { RateLimiter } = require("../../build/ratelimiting/RateLimiter");

const ttl = 60000; // 1 minute in milliseconds
const keyCount = 1_000_000;

(async () => {
  const keys = Array.from({ length: keyCount }, (_, i) => `user${i}`);
  const limiter = new RateLimiter(100_000_000, ttl);

  // Warmup, block all keys
  for (const key of keys) {
    limiter.isAllowed(key, ttl, 2);
    limiter.isAllowed(key, ttl, 2);
  }

  global.gc();

  const heapUsedBefore = process.memoryUsage().heapUsed;

  for (const key of keys) {
    limiter.isAllowed(key, ttl, 2);
  }

  global.gc();

  const heapUsedAfter = process.memoryUsage().heapUsed;
  const heapUsedDiff = heapUsedAfter - heapUsedBefore;

  if (heapUsedDiff > 0) {
    console.error(
      `Higher heap usage after rate limiting: +${heapUsedDiff} bytes`
    );
    process.exit(1);
  }

  console.info(`No memory leak detected`);
  process.exit(0);
})();
