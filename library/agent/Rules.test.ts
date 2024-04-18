import * as t from "tap";
import { Rules } from "./Rules";

t.test("it returns false if empty rules", async () => {
  const rules = new Rules([]);
  t.same(rules.shouldIgnore("GET", "/foo"), false);
});

t.test("it works", async () => {
  const rules = new Rules([
    { method: "GET", route: "/foo", forceProtectionOff: false },
    { method: "POST", route: "/foo", forceProtectionOff: true },
  ]);

  t.same(rules.shouldIgnore("GET", "/foo"), false);
  t.same(rules.shouldIgnore("POST", "/foo"), true);
  t.same(rules.shouldIgnore("GET", "/unknown"), false);
});

t.test("it diffs old and new rules", async () => {
  t.same(new Rules([]).hasChanges(new Rules([])), false);
  t.same(
    new Rules([
      { method: "GET", route: "/foo", forceProtectionOff: false },
    ]).hasChanges(
      new Rules([{ method: "GET", route: "/foo", forceProtectionOff: false }])
    ),
    false
  );
  t.same(
    new Rules([
      { method: "GET", route: "/foo", forceProtectionOff: false },
    ]).hasChanges(
      new Rules([{ method: "GET", route: "/foo", forceProtectionOff: true }])
    ),
    true
  );
  t.same(
    new Rules([
      { method: "GET", route: "/foo", forceProtectionOff: false },
    ]).hasChanges(new Rules([])),
    true
  );
  t.same(
    new Rules([]).hasChanges(
      new Rules([{ method: "GET", route: "/foo", forceProtectionOff: false }])
    ),
    true
  );
  t.same(
    new Rules([
      { method: "GET", route: "/foo", forceProtectionOff: false },
    ]).hasChanges(
      new Rules([
        { method: "GET", route: "/foo", forceProtectionOff: false },
        { method: "POST", route: "/foo", forceProtectionOff: false },
      ])
    ),
    true
  );
  t.same(
    new Rules([
      { method: "GET", route: "/foo", forceProtectionOff: false },
    ]).hasChanges(
      new Rules([
        { method: "GET", route: "/foo", forceProtectionOff: false },
        { method: "POST", route: "/foo", forceProtectionOff: true },
      ])
    ),
    true
  );
});
