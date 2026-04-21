import * as t from "tap";
import * as FakeTimers from "@sinonjs/fake-timers";
import { RateLimiter } from "./RateLimiter";

let clock: FakeTimers.InstalledClock;

t.before(async () => {
  clock = FakeTimers.install();
});

t.beforeEach(async () => {
  clock.reset();
});

t.after(async () => {
  clock.uninstall();
});

t.after(async () => {
  clock.uninstall();
});

const key = "user1";
const ttl = 60000; // 1 minute in milliseconds
const maxAmount = 5;

t.test("should allow up to maxAmount requests within TTL", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  for (let i = 0; i < maxAmount; i++) {
    t.same(
      limiter.isAllowed(key, ttl, maxAmount),
      { allowed: true },
      `Request ${i + 1} should be allowed`
    );
  }
  t.equal(
    limiter.isAllowed(key, ttl, maxAmount).allowed,
    false,
    `Request ${maxAmount + 1} should not be allowed`
  );
});

t.test("should reset after TTL has expired", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  for (let i = 0; i < maxAmount; i++) {
    t.same(
      limiter.isAllowed(key, ttl, maxAmount),
      { allowed: true },
      `Request ${i + 1} should be allowed`
    );
  }
  t.equal(
    limiter.isAllowed(key, ttl, maxAmount).allowed,
    false,
    `Request ${maxAmount + 1} should not be allowed`
  );

  clock.tick(ttl + 1);

  t.same(
    limiter.isAllowed(key, ttl, maxAmount),
    { allowed: true },
    `Request after TTL should be allowed`
  );
});

t.test("should allow requests for different keys independently", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  const key2 = "user2";

  for (let i = 0; i < maxAmount; i++) {
    t.same(
      limiter.isAllowed(key, ttl, maxAmount),
      { allowed: true },
      `Request ${i + 1} for key1 should be allowed`
    );
  }
  t.equal(
    limiter.isAllowed(key, ttl, maxAmount).allowed,
    false,
    `Request ${maxAmount + 1} for key1 should not be allowed`
  );

  for (let i = 0; i < maxAmount; i++) {
    t.same(
      limiter.isAllowed(key2, ttl, maxAmount),
      { allowed: true },
      `Request ${i + 1} for key2 should be allowed`
    );
  }

  t.equal(
    limiter.isAllowed(key2, ttl, maxAmount).allowed,
    false,
    `Request ${maxAmount + 1} for key2 should not be allowed`
  );
});

t.test("should handle TTL expiration", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  for (let i = 0; i < maxAmount; i++) {
    limiter.isAllowed(key, ttl, maxAmount);
  }

  clock.tick(ttl + 1);

  t.same(
    limiter.isAllowed(key, ttl, maxAmount),
    { allowed: true },
    `Request after TTL should be allowed`
  );
});

t.test("should allow requests exactly at limit", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  for (let i = 0; i < maxAmount; i++) {
    t.same(
      limiter.isAllowed(key, ttl, maxAmount),
      { allowed: true },
      `Request ${i + 1} should be allowed`
    );
  }
  t.equal(
    limiter.isAllowed(key, ttl, maxAmount).allowed,
    false,
    `Request ${maxAmount + 1} should not be allowed`
  );
});

t.test("should handle multiple rapid requests", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  for (let i = 0; i < maxAmount; i++) {
    t.same(
      limiter.isAllowed(key, ttl, maxAmount),
      { allowed: true },
      `Request ${i + 1} should be allowed`
    );
  }

  clock.tick(100);

  t.equal(
    limiter.isAllowed(key, ttl, maxAmount).allowed,
    false,
    `Request ${maxAmount + 1} should not be allowed`
  );
});

t.test("should handle different window sizes", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  const differentWindowSize = 1000; // 1 second window
  for (let i = 0; i < maxAmount; i++) {
    t.same(
      limiter.isAllowed(key, differentWindowSize, maxAmount),
      { allowed: true },
      `Request ${i + 1} should be allowed`
    );
  }
  t.equal(
    limiter.isAllowed(key, differentWindowSize, maxAmount).allowed,
    false,
    `Request ${maxAmount + 1} should not be allowed`
  );
});

t.test("should handle sliding window with intermittent requests", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  for (let i = 0; i < maxAmount; i++) {
    t.same(
      limiter.isAllowed(key, ttl, maxAmount),
      { allowed: true },
      `Request ${i + 1} should be allowed`
    );
    clock.tick(100);
  }

  clock.tick(ttl + 1);

  t.same(
    limiter.isAllowed(key, ttl, maxAmount),
    { allowed: true },
    `Request after sliding window should be allowed`
  );
});

t.test("should handle sliding window edge case", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  for (let i = 0; i < maxAmount; i++) {
    t.same(
      limiter.isAllowed(key, ttl, maxAmount),
      { allowed: true },
      `Request ${i + 1} should be allowed`
    );
  }

  clock.tick(ttl + 1);

  t.same(
    limiter.isAllowed(key, ttl, maxAmount),
    { allowed: true },
    `Request after sliding window should be allowed`
  );

  clock.tick(ttl + 1);

  t.same(
    limiter.isAllowed(key, ttl, maxAmount),
    { allowed: true },
    `Request after sliding window should be allowed`
  );
});

t.test("should handle sliding window with delayed requests", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  for (let i = 0; i < maxAmount; i++) {
    t.same(
      limiter.isAllowed(key, ttl, maxAmount),
      { allowed: true },
      `Request ${i + 1} should be allowed`
    );
    clock.tick(100);
  }

  clock.tick(ttl + 1);

  t.same(
    limiter.isAllowed(key, ttl, maxAmount),
    { allowed: true },
    `Request after sliding window should be allowed`
  );
});

t.test("should handle sliding window with burst requests", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  for (let i = 0; i < maxAmount; i++) {
    t.same(
      limiter.isAllowed(key, ttl, maxAmount),
      { allowed: true },
      `Request ${i + 1} should be allowed`
    );
  }

  clock.tick(ttl / 2 + 1);

  t.equal(
    limiter.isAllowed(key, ttl, maxAmount).allowed,
    false,
    `Request ${maxAmount + 1} should not be allowed`
  );
  t.equal(
    limiter.isAllowed(key, ttl, maxAmount).allowed,
    false,
    `Request ${maxAmount + 2} should not be allowed`
  );
  t.equal(
    limiter.isAllowed(key, ttl, maxAmount).allowed,
    false,
    `Request ${maxAmount + 3} should not be allowed`
  );

  clock.tick(ttl / 2 + 1);

  for (let i = 0; i < 2; i++) {
    t.same(
      limiter.isAllowed(key, ttl, maxAmount),
      { allowed: true },
      `Request ${i + 1} should be allowed`
    );
  }

  t.equal(
    limiter.isAllowed(key, ttl, maxAmount).allowed,
    false,
    `Request ${maxAmount + 1} should not be allowed`
  );

  clock.tick(ttl + 1);

  t.same(
    limiter.isAllowed(key, ttl, maxAmount),
    { allowed: true },
    `Request after sliding window should be allowed`
  );
});

t.test("should return retryAfterMs when rate limited", async (t) => {
  const windowSize = 10000;
  const max = 2;
  const limiter = new RateLimiter(max, windowSize);

  t.same(limiter.isAllowed(key, windowSize, max), { allowed: true });

  clock.tick(3000);

  t.same(limiter.isAllowed(key, windowSize, max), { allowed: true });

  clock.tick(2000);

  const result = limiter.isAllowed(key, windowSize, max);
  t.equal(result.allowed, false);
  if (!result.allowed) {
    // Oldest timestamp is at t=0, window is 10000ms, current time is 5000ms
    // retryAfterMs = 0 + 10000 - 5000 = 5000
    t.equal(result.retryAfterMs, 5000);
  }
});

t.test(
  "retryAfterMs decreases as time passes towards window expiry",
  async (t) => {
    const windowSize = 10000;
    const max = 1;
    const limiter = new RateLimiter(max, windowSize);

    t.same(limiter.isAllowed(key, windowSize, max), { allowed: true });

    clock.tick(4000);

    const result = limiter.isAllowed(key, windowSize, max);
    t.equal(result.allowed, false);
    if (!result.allowed) {
      t.equal(result.retryAfterMs, 6000);
    }

    clock.tick(3000);

    const result2 = limiter.isAllowed(key, windowSize, max);
    t.equal(result2.allowed, false);
    if (!result2.allowed) {
      t.equal(result2.retryAfterMs, 3000);
    }
  }
);
