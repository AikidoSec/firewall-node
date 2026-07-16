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
    maxSamplesPerIP: 5,
  });
}

t.test("no ip address", async (t) => {
  const detector = newAttackWaveDetector();
  t.notOk(
    detector.check(getTestContext(undefined, "/wp-config.php", "GET"), 404)
  );
});

t.test("not a web scanner", async (t) => {
  const detector = newAttackWaveDetector();
  t.notOk(detector.check(getTestContext("::1", "/", "OPTIONS"), 200));
  t.notOk(detector.check(getTestContext("::1", "/", "GET"), 200));
  t.notOk(detector.check(getTestContext("::1", "/login", "GET"), 200));
  t.notOk(detector.check(getTestContext("::1", "/dashboard", "GET"), 200));
  t.notOk(detector.check(getTestContext("::1", "/dashboard/2", "GET"), 200));
  t.notOk(detector.check(getTestContext("::1", "/settings", "GET"), 200));
  t.notOk(detector.check(getTestContext("::1", "/", "GET"), 200));
  t.notOk(detector.check(getTestContext("::1", "/dashboard", "GET"), 200));
});

t.test("a web scanner", async (t) => {
  const detector = newAttackWaveDetector();
  t.notOk(detector.check(getTestContext("::1", "/wp-config.php", "GET"), 404));
  t.notOk(
    detector.check(getTestContext("::1", "/wp-config.php.bak", "GET"), 404)
  );
  t.notOk(detector.check(getTestContext("::1", "/.git/config", "GET"), 404));
  t.notOk(detector.check(getTestContext("::1", "/.env", "GET"), 404));
  t.notOk(detector.check(getTestContext("::1", "/.htaccess", "GET"), 404));
  // Is true because the threshold is 6
  t.ok(detector.check(getTestContext("::1", "/.htpasswd", "GET"), 404));
  // False again because event should have been sent last time
  t.notOk(detector.check(getTestContext("::1", "/.htpasswd", "GET"), 404));
});

t.test("a web scanner with delays", async (t) => {
  const clock = FakeTimers.install();
  const detector = newAttackWaveDetector();
  t.notOk(detector.check(getTestContext("::1", "/wp-config.php", "GET"), 404));
  t.notOk(
    detector.check(getTestContext("::1", "/wp-config.php.bak", "GET"), 404)
  );
  t.notOk(detector.check(getTestContext("::1", "/.git/config", "GET"), 404));
  t.notOk(detector.check(getTestContext("::1", "/.env", "GET"), 404));

  clock.tick(30 * 1000);

  t.notOk(detector.check(getTestContext("::1", "/.htaccess", "GET"), 404));
  // Is true because the threshold is 6
  t.ok(detector.check(getTestContext("::1", "/.htpasswd", "GET"), 404));
  // False again because event should have been sent last time
  t.notOk(detector.check(getTestContext("::1", "/.htpasswd", "GET"), 404));

  clock.tick(30 * 60 * 1000);

  // Still false because minimum time between events is 1 hour
  t.notOk(detector.check(getTestContext("::1", "/.env", "GET"), 404));
  t.notOk(detector.check(getTestContext("::1", "/wp-config.php", "GET"), 404));
  t.notOk(
    detector.check(getTestContext("::1", "/wp-config.php.bak", "GET"), 404)
  );
  t.notOk(detector.check(getTestContext("::1", "/.git/config", "GET"), 404));
  t.notOk(detector.check(getTestContext("::1", "/.env", "GET"), 404));
  t.notOk(detector.check(getTestContext("::1", "/.htaccess", "GET"), 404));

  clock.tick(32 * 60 * 1000);

  // Should resend event after 1 hour
  t.notOk(detector.check(getTestContext("::1", "/.env", "GET"), 404));
  t.notOk(detector.check(getTestContext("::1", "/wp-config.php", "GET"), 404));
  t.notOk(
    detector.check(getTestContext("::1", "/wp-config.php.bak", "GET"), 404)
  );
  t.notOk(detector.check(getTestContext("::1", "/.git/config", "GET"), 404));
  t.notOk(detector.check(getTestContext("::1", "/.env", "GET"), 404));
  t.ok(detector.check(getTestContext("::1", "/.htaccess", "GET"), 404));

  clock.uninstall();
});

t.test("a slow web scanner that triggers in the second interval", async (t) => {
  const clock = FakeTimers.install();
  const detector = newAttackWaveDetector();
  t.notOk(detector.check(getTestContext("::1", "/wp-config.php", "GET"), 404));
  t.notOk(
    detector.check(getTestContext("::1", "/wp-config.php.bak", "GET"), 404)
  );
  t.notOk(detector.check(getTestContext("::1", "/.git/config", "GET"), 404));
  t.notOk(detector.check(getTestContext("::1", "/.env", "GET"), 404));

  clock.tick(62 * 1000);

  t.notOk(detector.check(getTestContext("::1", "/.env", "GET"), 404));
  t.notOk(detector.check(getTestContext("::1", "/wp-config.php", "GET"), 404));
  t.notOk(
    detector.check(getTestContext("::1", "/wp-config.php.bak", "GET"), 404)
  );
  t.notOk(detector.check(getTestContext("::1", "/.git/config", "GET"), 404));
  t.notOk(detector.check(getTestContext("::1", "/.env", "GET"), 404));
  t.ok(detector.check(getTestContext("::1", "/.htaccess", "GET"), 404));

  clock.uninstall();
});

t.test("a slow web scanner that triggers in the third interval", async (t) => {
  const clock = FakeTimers.install();
  const detector = newAttackWaveDetector();
  t.notOk(detector.check(getTestContext("::1", "/wp-config.php", "GET"), 404));
  t.notOk(
    detector.check(getTestContext("::1", "/wp-config.php.bak", "GET"), 404)
  );
  t.notOk(detector.check(getTestContext("::1", "/.git/config", "GET"), 404));
  t.notOk(detector.check(getTestContext("::1", "/.env", "GET"), 404));

  clock.tick(62 * 1000);

  // Still false because minimum time between events is 1 hour
  t.notOk(detector.check(getTestContext("::1", "/.env", "GET"), 404));
  t.notOk(detector.check(getTestContext("::1", "/wp-config.php", "GET"), 404));
  t.notOk(
    detector.check(getTestContext("::1", "/wp-config.php.bak", "GET"), 404)
  );
  t.notOk(detector.check(getTestContext("::1", "/.git/config", "GET"), 404));

  clock.tick(62 * 1000);

  // Should resend event after 1 hour
  t.notOk(detector.check(getTestContext("::1", "/.env", "GET"), 404));
  t.notOk(detector.check(getTestContext("::1", "/wp-config.php", "GET"), 404));
  t.notOk(
    detector.check(getTestContext("::1", "/wp-config.php.bak", "GET"), 404)
  );
  t.notOk(detector.check(getTestContext("::1", "/.git/config", "GET"), 404));
  t.notOk(detector.check(getTestContext("::1", "/.env", "GET"), 404));
  t.ok(detector.check(getTestContext("::1", "/.htaccess", "GET"), 404));

  clock.uninstall();
});

t.test("it collects samples correctly", async (t) => {
  const detector = newAttackWaveDetector();
  const ip = "::1";
  detector.check(getTestContext(ip, "/wp-config.php", "GET"), 404);
  detector.check(getTestContext(ip, "/wp-config.php.bak", "GET"), 404);
  detector.check(getTestContext(ip, "/.git/config", "GET"), 404);
  detector.check(getTestContext(ip, "/.env", "GET"), 404);
  detector.check(getTestContext(ip, "/.htaccess", "GET"), 404);

  detector.check(getTestContext(ip, "/.htaccess", "GET"), 404); // Duplicate
  detector.check(getTestContext("::2", "/test/.env", "GET"), 404); // Different IP

  const samples = detector.getSamplesForIP(ip);
  t.equal(samples.length, 5, "should have collected 5 samples");

  t.same(
    samples,
    [
      { method: "GET", url: "http://localhost:4000/wp-config.php" },
      { method: "GET", url: "http://localhost:4000/wp-config.php.bak" },
      { method: "GET", url: "http://localhost:4000/.git/config" },
      { method: "GET", url: "http://localhost:4000/.env" },
      { method: "GET", url: "http://localhost:4000/.htaccess" },
    ],
    "should have collected the correct samples"
  );
});

t.test("it limits samples correctly", async (t) => {
  const detector = newAttackWaveDetector();
  const ip = "::1";

  for (let i = 0; i < 10; i++) {
    detector.check(getTestContext(ip, `/${i}/.env`, "GET"), 404);
  }

  const samples = detector.getSamplesForIP(ip);
  t.equal(samples.length, 5, "should have collected maximum 5 samples");

  t.same(
    samples,
    [
      { method: "GET", url: "http://localhost:4000/0/.env" },
      { method: "GET", url: "http://localhost:4000/1/.env" },
      { method: "GET", url: "http://localhost:4000/2/.env" },
      { method: "GET", url: "http://localhost:4000/3/.env" },
      { method: "GET", url: "http://localhost:4000/4/.env" },
    ],
    "should have collected the correct samples"
  );
});

t.test("it does not delete samples too early", async (t) => {
  const clock = FakeTimers.install();
  const detector = newAttackWaveDetector();

  t.notOk(detector.check(getTestContext("::1", "/.env", "GET"), 404));
  clock.tick(10 * 1000);

  t.notOk(detector.check(getTestContext("::1", "/.env", "GET"), 404));
  clock.tick(10 * 1000);

  t.notOk(detector.check(getTestContext("::1", "/.env", "GET"), 404));
  clock.tick(10 * 1000);

  t.notOk(detector.check(getTestContext("::1", "/.env", "GET"), 404));
  clock.tick(10 * 1000);

  t.notOk(detector.check(getTestContext("::1", "/.env", "GET"), 404));
  clock.tick(10 * 1000);

  t.ok(detector.check(getTestContext("::1", "/.env", "GET"), 404));
  clock.tick(10 * 1000);

  t.notOk(detector.check(getTestContext("::1", "/.env", "GET"), 404));
  clock.tick(10 * 1000);

  t.notOk(detector.check(getTestContext("::1", "/.env", "GET"), 404));
  clock.tick(10 * 1000);

  t.same(
    detector.getSamplesForIP("::1"),
    [{ method: "GET", url: "http://localhost:4000/.env" }],
    "should still have the sample stored"
  );

  clock.uninstall();
});
