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
      limiter.check(key, ttl, maxAmount),
      `Request ${i + 1} should be allowed`
    );
  }
  t.notOk(
    limiter.check(key, ttl, maxAmount),
    `Request ${maxAmount + 1} should not be allowed`
  );
});

t.test("should reset after TTL has expired", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  for (let i = 0; i < maxAmount; i++) {
    t.ok(
      limiter.check(key, ttl, maxAmount),
      `Request ${i + 1} should be allowed`
    );
  }
  t.notOk(
    limiter.check(key, ttl, maxAmount),
    `Request ${maxAmount + 1} should not be allowed`
  );

  clock.tick(ttl + 1);

  t.ok(
    limiter.check(key, ttl, maxAmount),
    `Request after TTL should be allowed`
  );
});

t.test("should allow requests for different keys independently", async (t) => {
  const limiter = new RateLimiter(maxAmount, ttl);
  const key2 = "user2";

  for (let i = 0; i < maxAmount; i++) {
    t.ok(
      limiter.check(key, ttl, maxAmount),
      `Request ${i + 1} for key1 should be allowed`
    );
  }
  t.notOk(
    limiter.check(key, ttl, maxAmount),
    `Request ${maxAmount + 1} for key1 should not be allowed`
  );

  for (let i = 0; i < maxAmount; i++) {
    t.ok(
      limiter.check(key2, ttl, maxAmount),
      `Request ${i + 1} for key2 should be allowed`
    );
  }

  t.notOk(
    limiter.check(key2, ttl, maxAmount),
    `Request ${maxAmount + 1} for key2 should not be allowed`
  );
});
