import * as FakeTimers from "@sinonjs/fake-timers";
import * as t from "tap";
import { yieldToEventLoop } from "./yieldToEventLoop";

t.test("it resolves", async () => {
  await yieldToEventLoop();
});

t.test("it does not resolve before the immediate fires", async (t) => {
  const clock = FakeTimers.install();

  let resolved = false;
  const promise = yieldToEventLoop().then(() => {
    resolved = true;
  });

  t.same(resolved, false);

  await clock.runAllAsync();
  await promise;

  t.same(resolved, true);

  clock.uninstall();
});
