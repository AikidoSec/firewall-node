import * as t from "tap";
import { AttackWaveDetector } from "./AttackWaveDetector";
import type { Context } from "../../agent/Context";
import * as FakeTimers from "@sinonjs/fake-timers";

function getTestContext(
  ip: string | undefined,
  path: string,
  method: string
): Context {
  return {
    remoteAddress: ip,
    method: method,
    url: `http://localhost:4000${path}`,
    query: {},
    headers: {
      "content-type": "application/json",
    },
    body: {},
    cookies: {},
    routeParams: {},
    source: "express",
    route: path,
  };
}

function newAttackWaveDetector() {
  return new AttackWaveDetector({
    attackWaveThreshold: 6,
    attackWaveTimeFrame: 60 * 1000,
    minTimeBetweenEvents: 60 * 60 * 1000,
    maxLRUEntries: 10_000,
  });
}

t.test("no ip address", async (t) => {
  const detector = newAttackWaveDetector();
  detector.check(getTestContext(undefined, "/wp-config.php", "GET"));
});

t.test("not a web scanner", async (t) => {
  const detector = newAttackWaveDetector();

  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/", "OPTIONS"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/login", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/dashboard", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/dashboard/2", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/settings", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/dashboard", "GET"));
  t.notOk(detector.shouldReport("::1"));

  t.notOk(detector.shouldReport("::2"));
});

t.test("a web scanner", async (t) => {
  const detector = newAttackWaveDetector();
  detector.check(getTestContext("::1", "/wp-config.php", "GET"));
  detector.check(getTestContext("::1", "/wp-config.php.bak", "GET"));
  detector.check(getTestContext("::1", "/.git/config", "GET"));
  detector.check(getTestContext("::1", "/.env", "GET"));
  detector.check(getTestContext("::1", "/.htaccess", "GET"));
  // Is true because the threshold is 6
  detector.check(getTestContext("::1", "/.htpasswd", "GET"));
  t.ok(detector.shouldReport("::1"));

  // False again because event should have been sent last time
  detector.check(getTestContext("::1", "/.htpasswd", "GET"));
});

t.test("a web scanner with delays", async (t) => {
  const clock = FakeTimers.install();
  const detector = newAttackWaveDetector();
  detector.check(getTestContext("::1", "/wp-config.php", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/wp-config.php.bak", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/.git/config", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/.env", "GET"));
  t.notOk(detector.shouldReport("::1"));

  clock.tick(30 * 1000);

  detector.check(getTestContext("::1", "/.htaccess", "GET"));
  t.notOk(detector.shouldReport("::1"));

  // Is true because the threshold is 6
  detector.check(getTestContext("::1", "/.htpasswd", "GET"));
  t.ok(detector.shouldReport("::1"));
  // False again because event should have been sent last time
  detector.check(getTestContext("::1", "/.htpasswd", "GET"));
  t.notOk(detector.shouldReport("::1"));

  clock.tick(30 * 60 * 1000);

  // Still false because minimum time between events is 1 hour
  detector.check(getTestContext("::1", "/.env", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/wp-config.php", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/wp-config.php.bak", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/.git/config", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/.env", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/.htaccess", "GET"));
  t.notOk(detector.shouldReport("::1"));

  clock.tick(32 * 60 * 1000);

  // Should resend event after 1 hour
  detector.check(getTestContext("::1", "/.env", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/wp-config.php", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/wp-config.php.bak", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/.git/config", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/.env", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/.htaccess", "GET"));
  t.ok(detector.shouldReport("::1"));

  clock.uninstall();
});

t.test("a slow web scanner that triggers in the second interval", async (t) => {
  const clock = FakeTimers.install();
  const detector = newAttackWaveDetector();
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/wp-config.php", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/wp-config.php.bak", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/.git/config", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/.env", "GET"));
  t.notOk(detector.shouldReport("::1"));

  clock.tick(62 * 1000);

  detector.check(getTestContext("::1", "/.env", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/wp-config.php", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/wp-config.php.bak", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/.git/config", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/.env", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/.htaccess", "GET"));
  t.ok(detector.shouldReport("::1"));

  clock.uninstall();
});

t.test("a slow web scanner that triggers in the third interval", async (t) => {
  const clock = FakeTimers.install();
  const detector = newAttackWaveDetector();
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/wp-config.php", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/wp-config.php.bak", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/.git/config", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/.env", "GET"));
  t.notOk(detector.shouldReport("::1"));

  clock.tick(62 * 1000);

  // Still false because minimum time between events is 1 hour
  detector.check(getTestContext("::1", "/.env", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/wp-config.php", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/wp-config.php.bak", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/.git/config", "GET"));
  t.notOk(detector.shouldReport("::1"));

  clock.tick(62 * 1000);

  // Should resend event after 1 hour
  detector.check(getTestContext("::1", "/.env", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/wp-config.php", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/wp-config.php.bak", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/.git/config", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/.env", "GET"));
  t.notOk(detector.shouldReport("::1"));
  detector.check(getTestContext("::1", "/.htaccess", "GET"));
  t.ok(detector.shouldReport("::1"));

  clock.uninstall();
});

t.test("increase attack count manually", async (t) => {
  const detector = newAttackWaveDetector();

  for (let i = 0; i < 6; i++) {
    t.notOk(detector.shouldReport("::1"));
    detector.increaseSuspiciousCount("::1");
  }
  t.ok(detector.shouldReport("::1"));

  t.same(detector.getSuspiciousCount("::1"), 6);
});
