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
    t.equal(
      outgoingDomains.shouldBlockOutgoingRequest("sub.sub.sub.example.com"),
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

t.test("it does not match root domains with wildcard entries", async (t) => {
  const outgoingDomains = new OutgoingDomains([
    { hostname: "*.example.com", mode: "block" },
  ]);

  t.equal(outgoingDomains.shouldBlockOutgoingRequest("example.com"), false);
});

t.test("allows multiple levels of subdomains within blocklist", async (t) => {
  const outgoingDomains = new OutgoingDomains([
    { hostname: "*.sub.example.com", mode: "block" },
  ]);

  t.equal(outgoingDomains.shouldBlockOutgoingRequest("example.com"), false);
  t.equal(
    outgoingDomains.shouldBlockOutgoingRequest("test.example.com"),
    false
  );
  t.equal(
    outgoingDomains.shouldBlockOutgoingRequest("sub.sub.example.com"),
    true
  );
  t.equal(
    outgoingDomains.shouldBlockOutgoingRequest("sub.sub.sub.example.com"),
    true
  );
});

t.test(
  "getWildcardMatch returns undefined for non-matching hostname",
  async (t) => {
    const outgoingDomains = new OutgoingDomains([
      { hostname: "*.example.com", mode: "block" },
    ]);

    t.equal(outgoingDomains.getWildcardMatch("example.com"), undefined);
    t.equal(outgoingDomains.getWildcardMatch("other.com"), undefined);
    t.equal(outgoingDomains.getWildcardMatch("com"), undefined);
  }
);

t.test(
  "getWildcardMatch returns domain and mode for matching hostname",
  async (t) => {
    const outgoingDomains = new OutgoingDomains([
      { hostname: "*.example.com", mode: "block" },
    ]);

    t.same(outgoingDomains.getWildcardMatch("sub.example.com"), {
      domain: "*.example.com",
      mode: "block",
    });
  }
);

t.test("getWildcardMatch returns most specific wildcard match", async (t) => {
  const outgoingDomains = new OutgoingDomains([
    { hostname: "*.example.com", mode: "block" },
    { hostname: "*.sub.example.com", mode: "allow" },
    { hostname: "*.test.example.com", mode: "allow" },
    { hostname: "*.sub.sub.example.com", mode: "allow" },
  ]);

  t.same(outgoingDomains.getWildcardMatch("test.sub.sub.example.com"), {
    domain: "*.sub.sub.example.com",
    mode: "allow",
  });
  t.same(outgoingDomains.getWildcardMatch("api.sub.example.com"), {
    domain: "*.sub.example.com",
    mode: "allow",
  });
  t.same(outgoingDomains.getWildcardMatch("api.test.example.com"), {
    domain: "*.test.example.com",
    mode: "allow",
  });
  t.same(outgoingDomains.getWildcardMatch("foo.bar.example.com"), {
    domain: "*.example.com",
    mode: "block",
  });
  t.same(outgoingDomains.getWildcardMatch("api.example.com"), {
    domain: "*.example.com",
    mode: "block",
  });
});

t.test("getWildcardMatch returns domain and mode for allow mode", async (t) => {
  const outgoingDomains = new OutgoingDomains([
    { hostname: "*.example.com", mode: "allow" },
  ]);

  t.same(outgoingDomains.getWildcardMatch("sub.example.com"), {
    domain: "*.example.com",
    mode: "allow",
  });
});

t.test("getWildcardMatch matches deeply nested subdomains", async (t) => {
  const outgoingDomains = new OutgoingDomains([
    { hostname: "*.example.com", mode: "block" },
  ]);

  t.same(outgoingDomains.getWildcardMatch("a.b.c.example.com"), {
    domain: "*.example.com",
    mode: "block",
  });
});
