import * as t from "tap";
import { Endpoints } from "./Endpoints";

t.test("it returns false if empty rules", async () => {
  const rules = new Endpoints([]);
  t.same(rules.shouldIgnore("GET", "/foo"), false);
});

t.test("it works", async () => {
  const rules = new Endpoints([
    { method: "GET", route: "/foo", forceProtectionOff: false },
    { method: "POST", route: "/foo", forceProtectionOff: true },
    { method: "POST", route: /fly+/.source, forceProtectionOff: true },
  ]);

  t.same(rules.shouldIgnore("GET", "/foo"), false);
  t.same(rules.shouldIgnore("POST", "/foo"), true);
  t.same(rules.shouldIgnore("GET", "/unknown"), false);
  t.same(rules.shouldIgnore("POST", /fly+/), true);
});

t.test("it diffs old and new endpoints", async () => {
  t.same(new Endpoints([]).hasChanges(new Endpoints([])), false);
  t.same(
    new Endpoints([
      { method: "GET", route: "/foo", forceProtectionOff: false },
    ]).hasChanges(
      new Endpoints([
        { method: "GET", route: "/foo", forceProtectionOff: false },
      ])
    ),
    false
  );
  t.same(
    new Endpoints([
      { method: "GET", route: "/foo", forceProtectionOff: false },
    ]).hasChanges(
      new Endpoints([
        { method: "GET", route: "/foo", forceProtectionOff: true },
      ])
    ),
    true
  );
  t.same(
    new Endpoints([
      { method: "GET", route: "/foo", forceProtectionOff: false },
    ]).hasChanges(new Endpoints([])),
    true
  );
  t.same(
    new Endpoints([]).hasChanges(
      new Endpoints([
        { method: "GET", route: "/foo", forceProtectionOff: false },
      ])
    ),
    true
  );
  t.same(
    new Endpoints([
      { method: "GET", route: "/foo", forceProtectionOff: false },
    ]).hasChanges(
      new Endpoints([
        { method: "GET", route: "/foo", forceProtectionOff: false },
        { method: "POST", route: "/foo", forceProtectionOff: false },
      ])
    ),
    true
  );
  t.same(
    new Endpoints([
      { method: "GET", route: "/foo", forceProtectionOff: false },
    ]).hasChanges(
      new Endpoints([
        { method: "GET", route: "/foo", forceProtectionOff: false },
        { method: "POST", route: "/foo", forceProtectionOff: true },
      ])
    ),
    true
  );
});
