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
    t.ok(
      limiter.isAllowed(key, ttl, maxAmount),
      `Request ${i + 1} should be allowed`
    );
  }
  t.notOk(
    limiter.isAllowed(key, ttl, maxAmount),
    `Request ${maxAmount + 1} should not be allowed`
  );
});

t.test("should reset after TTL has expired", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  for (let i = 0; i < maxAmount; i++) {
    t.ok(
      limiter.isAllowed(key, ttl, maxAmount),
      `Request ${i + 1} should be allowed`
    );
  }
  t.notOk(
    limiter.isAllowed(key, ttl, maxAmount),
    `Request ${maxAmount + 1} should not be allowed`
  );

  clock.tick(ttl + 1);

  t.ok(
    limiter.isAllowed(key, ttl, maxAmount),
    `Request after TTL should be allowed`
  );
});

t.test("should allow requests for different keys independently", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  const key2 = "user2";

  for (let i = 0; i < maxAmount; i++) {
    t.ok(
      limiter.isAllowed(key, ttl, maxAmount),
      `Request ${i + 1} for key1 should be allowed`
    );
  }
  t.notOk(
    limiter.isAllowed(key, ttl, maxAmount),
    `Request ${maxAmount + 1} for key1 should not be allowed`
  );

  for (let i = 0; i < maxAmount; i++) {
    t.ok(
      limiter.isAllowed(key2, ttl, maxAmount),
      `Request ${i + 1} for key2 should be allowed`
    );
  }

  t.notOk(
    limiter.isAllowed(key2, ttl, maxAmount),
    `Request ${maxAmount + 1} for key2 should not be allowed`
  );
});

t.test("should handle TTL expiration", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  for (let i = 0; i < maxAmount; i++) {
    limiter.isAllowed(key, ttl, maxAmount);
  }

  clock.tick(ttl + 1);

  t.ok(
    limiter.isAllowed(key, ttl, maxAmount),
    `Request after TTL should be allowed`
  );
});

t.test("should allow requests exactly at limit", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  for (let i = 0; i < maxAmount; i++) {
    t.ok(
      limiter.isAllowed(key, ttl, maxAmount),
      `Request ${i + 1} should be allowed`
    );
  }
  t.notOk(
    limiter.isAllowed(key, ttl, maxAmount),
    `Request ${maxAmount + 1} should not be allowed`
  );
});

t.test("should handle multiple rapid requests", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  for (let i = 0; i < maxAmount; i++) {
    t.ok(
      limiter.isAllowed(key, ttl, maxAmount),
      `Request ${i + 1} should be allowed`
    );
  }

  clock.tick(100);

  t.notOk(
    limiter.isAllowed(key, ttl, maxAmount),
    `Request ${maxAmount + 1} should not be allowed`
  );
});

t.test("should handle different window sizes", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  const differentWindowSize = 1000; // 1 second window
  for (let i = 0; i < maxAmount; i++) {
    t.ok(
      limiter.isAllowed(key, differentWindowSize, maxAmount),
      `Request ${i + 1} should be allowed`
    );
  }
  t.notOk(
    limiter.isAllowed(key, differentWindowSize, maxAmount),
    `Request ${maxAmount + 1} should not be allowed`
  );
});

t.test("should handle sliding window with intermittent requests", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  for (let i = 0; i < maxAmount; i++) {
    t.ok(
      limiter.isAllowed(key, ttl, maxAmount),
      `Request ${i + 1} should be allowed`
    );
    clock.tick(100);
  }

  clock.tick(ttl + 1);

  t.ok(
    limiter.isAllowed(key, ttl, maxAmount),
    `Request after sliding window should be allowed`
  );
});

t.test("should handle sliding window edge case", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  for (let i = 0; i < maxAmount; i++) {
    t.ok(
      limiter.isAllowed(key, ttl, maxAmount),
      `Request ${i + 1} should be allowed`
    );
  }

  clock.tick(ttl + 1);

  t.ok(
    limiter.isAllowed(key, ttl, maxAmount),
    `Request after sliding window should be allowed`
  );

  clock.tick(ttl + 1);

  t.ok(
    limiter.isAllowed(key, ttl, maxAmount),
    `Request after sliding window should be allowed`
  );
});

t.test("should handle sliding window with delayed requests", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  for (let i = 0; i < maxAmount; i++) {
    t.ok(
      limiter.isAllowed(key, ttl, maxAmount),
      `Request ${i + 1} should be allowed`
    );
    clock.tick(100);
  }

  clock.tick(ttl + 1);

  t.ok(
    limiter.isAllowed(key, ttl, maxAmount),
    `Request after sliding window should be allowed`
  );
});

t.test("should handle sliding window with burst requests", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  for (let i = 0; i < maxAmount; i++) {
    t.ok(
      limiter.isAllowed(key, ttl, maxAmount),
      `Request ${i + 1} should be allowed`
    );
  }

  clock.tick(ttl / 2 + 1);

  t.notOk(
    limiter.isAllowed(key, ttl, maxAmount),
    `Request ${maxAmount + 1} should not be allowed`
  );
  t.notOk(
    limiter.isAllowed(key, ttl, maxAmount),
    `Request ${maxAmount + 2} should not be allowed`
  );
  t.notOk(
    limiter.isAllowed(key, ttl, maxAmount),
    `Request ${maxAmount + 3} should not be allowed`
  );

  clock.tick(ttl / 2 + 1);

  for (let i = 0; i < 2; i++) {
    t.ok(
      limiter.isAllowed(key, ttl, maxAmount),
      `Request ${i + 1} should be allowed`
    );
  }

  t.notOk(
    limiter.isAllowed(key, ttl, maxAmount),
    `Request ${maxAmount + 1} should not be allowed`
  );

  clock.tick(ttl + 1);

  t.ok(
    limiter.isAllowed(key, ttl, maxAmount),
    `Request after sliding window should be allowed`
  );
});
