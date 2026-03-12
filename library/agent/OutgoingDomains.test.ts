import * as t from "tap";
import { OutgoingDomains } from "./OutgoingDomains";

t.test("does not block by default", async (t) => {
  const outgoingDomains = new OutgoingDomains();
  t.equal(outgoingDomains.shouldBlockOutgoingRequest("example.com"), false);
});

t.test("blocks domains with block mode", async (t) => {
  const outgoingDomains = new OutgoingDomains([
    { hostname: "blocked.com", mode: "block" },
  ]);
  t.equal(outgoingDomains.shouldBlockOutgoingRequest("blocked.com"), true);
});

t.test("allows domains with allow mode", async (t) => {
  const outgoingDomains = new OutgoingDomains([
    { hostname: "allowed.com", mode: "allow" },
  ]);
  t.equal(outgoingDomains.shouldBlockOutgoingRequest("allowed.com"), false);
});

t.test(
  "blocks unknown domains when blockNewOutgoingRequests is true",
  async (t) => {
    const outgoingDomains = new OutgoingDomains([], true);
    t.equal(outgoingDomains.shouldBlockOutgoingRequest("unknown.com"), true);
  }
);

t.test(
  "allows known domains even when blockNewOutgoingRequests is true",
  async (t) => {
    const outgoingDomains = new OutgoingDomains(
      [{ hostname: "allowed.com", mode: "allow" }],
      true
    );
    t.equal(outgoingDomains.shouldBlockOutgoingRequest("allowed.com"), false);
  }
);

t.test(
  "blocks unknown domains but allows known allowed domains when blockNewOutgoingRequests is true",
  async (t) => {
    const outgoingDomains = new OutgoingDomains(
      [
        { hostname: "allowed.com", mode: "allow" },
        { hostname: "blocked.com", mode: "block" },
      ],
      true
    );
    t.equal(outgoingDomains.shouldBlockOutgoingRequest("unknown.com"), true);
    t.equal(outgoingDomains.shouldBlockOutgoingRequest("allowed.com"), false);
    t.equal(outgoingDomains.shouldBlockOutgoingRequest("blocked.com"), true);
  }
);

t.test(
  "blocks wildcard domains if new outgoing requests are not blocked",
  async (t) => {
    const outgoingDomains = new OutgoingDomains([
      { hostname: "*.example.com", mode: "block" },
      { hostname: "allowed.com", mode: "allow" },
    ]);

    t.equal(
      outgoingDomains.shouldBlockOutgoingRequest("sub.example.com"),
      true
    );
    t.equal(outgoingDomains.shouldBlockOutgoingRequest("example.com"), false);
    t.equal(outgoingDomains.shouldBlockOutgoingRequest("allowed.com"), false);
  }
);

t.test(
  "blocks wildcard domains if new outgoing requests are blocked",
  async (t) => {
    const outgoingDomains = new OutgoingDomains(
      [
        { hostname: "*.example.com", mode: "block" },
        { hostname: "allowed.com", mode: "allow" },
      ],
      true
    );

    t.equal(
      outgoingDomains.shouldBlockOutgoingRequest("sub.example.com"),
      true
    );
    t.equal(outgoingDomains.shouldBlockOutgoingRequest("example.com"), true);
    t.equal(outgoingDomains.shouldBlockOutgoingRequest("allowed.com"), false);
  }
);

t.test("allows wildcard domains if mode is allow", async (t) => {
  const outgoingDomains = new OutgoingDomains(
    [
      { hostname: "*.example.com", mode: "allow" },
      { hostname: "blocked.com", mode: "block" },
    ],
    true
  );

  t.equal(outgoingDomains.shouldBlockOutgoingRequest("sub.example.com"), false);
  t.equal(outgoingDomains.shouldBlockOutgoingRequest("example.com"), true);
  t.equal(outgoingDomains.shouldBlockOutgoingRequest("blocked.com"), true);
});

t.test(
  "does not block wildcard domains if new outgoing requests are blocked but mode is allow",
  async (t) => {
    const outgoingDomains = new OutgoingDomains(
      [{ hostname: "*.example.com", mode: "allow" }],
      true
    );

    t.equal(
      outgoingDomains.shouldBlockOutgoingRequest("sub.example.com"),
      false
    );
    t.equal(outgoingDomains.shouldBlockOutgoingRequest("example.com"), true);
  }
);

t.test(
  "allows multiple levels of subdomains with wildcard domains",
  async (t) => {
    const outgoingDomains = new OutgoingDomains([
      { hostname: "*.example.com", mode: "block" },
    ]);

    t.equal(
      outgoingDomains.shouldBlockOutgoingRequest("sub.example.com"),
      true
    );
    t.equal(
      outgoingDomains.shouldBlockOutgoingRequest("sub.sub.example.com"),
      true
    );
    t.equal(outgoingDomains.shouldBlockOutgoingRequest("example.com"), false);
  }
);

t.test("ignores tld wildcard matches", async (t) => {
  const outgoingDomains = new OutgoingDomains([
    { hostname: "*.com", mode: "block" },
  ]);

  t.equal(outgoingDomains.shouldBlockOutgoingRequest("example.com"), false);
  t.equal(outgoingDomains.shouldBlockOutgoingRequest("sub.example.com"), false);
});

t.test(
  "works with empty domain list and blockNewOutgoingRequests false",
  async (t) => {
    const outgoingDomains = new OutgoingDomains([], false);
    t.equal(outgoingDomains.shouldBlockOutgoingRequest("example.com"), false);
  }
);

t.test(
  "works with empty domain list and blockNewOutgoingRequests true",
  async (t) => {
    const outgoingDomains = new OutgoingDomains([], true);
    t.equal(outgoingDomains.shouldBlockOutgoingRequest("example.com"), true);
  }
);
