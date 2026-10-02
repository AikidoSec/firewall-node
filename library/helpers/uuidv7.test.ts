import * as t from "tap";
import { uuidv7 } from "./uuidv7";

const uuidv7Regex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

t.test("it returns a valid UUIDv7", async (t) => {
  t.match(uuidv7(), uuidv7Regex);
});

t.test("it returns different values on every call", async (t) => {
  t.not(uuidv7(), uuidv7());
});

t.test("it embeds a valid millisecond timestamp", async (t) => {
  const before = Date.now();
  const id = uuidv7();
  const after = Date.now();

  const ms = parseInt(id.slice(0, 8) + id.slice(9, 13), 16);

  t.ok(ms >= before, "timestamp should not be before the call");
  t.ok(ms <= after, "timestamp should not be after the call");
});
