import * as t from "tap";
import { setTimeout } from "timers/promises";
import { PendingEvents } from "./PendingEvents";

t.test("it tracks and waits for pending promises", async (t) => {
  const pendingEvents = new PendingEvents();
  let resolved = false;

  const promise = setTimeout(100).then(() => {
    resolved = true;
  });

  pendingEvents.onAPICall(promise);

  t.equal(resolved, false);
  await pendingEvents.waitUntilSent(1000);
  t.equal(resolved, true);
});

t.test("it removes promises from memory after they complete", async (t) => {
  const pendingEvents = new PendingEvents();

  for (let i = 0; i < 100; i++) {
    const promise = Promise.resolve();
    pendingEvents.onAPICall(promise);
  }

  await pendingEvents.waitUntilSent(1000);

  t.equal(
    (pendingEvents as any).pendingPromises.size,
    0,
    "should have cleaned up all promises"
  );
});

t.test("it removes rejected promises from memory", async (t) => {
  const pendingEvents = new PendingEvents();

  for (let i = 0; i < 50; i++) {
    const promise = Promise.reject(new Error("test error")).catch(() => {
      // NOOP
    });
    pendingEvents.onAPICall(promise);
  }

  await pendingEvents.waitUntilSent(1000);

  t.equal(
    (pendingEvents as any).pendingPromises.size,
    0,
    "should have cleaned up all rejected promises"
  );
});

t.test("it times out if promises take too long", async (t) => {
  const pendingEvents = new PendingEvents();

  const promise = setTimeout(5000);

  pendingEvents.onAPICall(promise);

  const start = Date.now();
  await pendingEvents.waitUntilSent(100);
  const duration = Date.now() - start;

  t.ok(duration < 200, "should timeout quickly");
});

t.test("it returns immediately if no pending promises", async (t) => {
  const pendingEvents = new PendingEvents();

  const start = Date.now();
  await pendingEvents.waitUntilSent(1000);
  const duration = Date.now() - start;

  t.ok(duration < 50, "should return immediately");
});

t.test("same promises is only tracked once", async (t) => {
  const pendingEvents = new PendingEvents();

  const promise = setTimeout(100);
  pendingEvents.onAPICall(promise);
  pendingEvents.onAPICall(promise);
  pendingEvents.onAPICall(promise);

  t.equal(
    (pendingEvents as any).pendingPromises.size,
    1,
    "should only track one instance of the same promise"
  );
  await pendingEvents.waitUntilSent(1000);
  t.equal(
    (pendingEvents as any).pendingPromises.size,
    0,
    "should have cleaned up the promise"
  );
});
