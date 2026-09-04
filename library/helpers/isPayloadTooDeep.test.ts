import * as t from "tap";
import { isPayloadTooDeep } from "./isPayloadTooDeep";

t.test("allows payloads at the configured depth", async (t) => {
  t.equal(isPayloadTooDeep({ one: { two: { value: "safe" } } }, 3), false);
});

t.test("rejects payloads beyond the configured depth", async (t) => {
  t.equal(
    isPayloadTooDeep({ one: { two: { three: { value: "hidden" } } } }, 3),
    true
  );
});

t.test("counts nested arrays toward the depth", async (t) => {
  t.equal(isPayloadTooDeep([[[["hidden"]]]], 3), true);
});

t.test("does not follow cycles forever", async (t) => {
  const payload: Record<string, unknown> = {};
  payload.self = payload;

  t.equal(isPayloadTooDeep(payload, 3), false);
});

t.test("fails closed when inspecting a payload throws", async (t) => {
  const payload = {};
  Object.defineProperty(payload, "nested", {
    enumerable: true,
    get() {
      throw new Error("unreadable");
    },
  });

  t.equal(isPayloadTooDeep(payload, 3), true);
});

t.test("handles very deeply nested payloads without overflowing", async (t) => {
  let payload: Record<string, unknown> = {};
  for (let depth = 0; depth < 10_000; depth++) {
    payload = { nested: payload };
  }

  t.equal(isPayloadTooDeep(payload, 100), true);
});
