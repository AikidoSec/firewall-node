import { LookupAddress, lookup } from "dns";
import * as t from "tap";
import { ReportingAPIForTesting } from "../../agent/api/ReportingAPIForTesting";
import { Token } from "../../agent/api/Token";
import { Context, runWithContext } from "../../agent/Context";
import { wrap } from "../../helpers/wrap";
import { inspectDNSLookupCalls } from "./inspectDNSLookupCalls";
import { getMajorNodeVersion } from "../../helpers/getNodeVersion";
import { createTestAgent } from "../../helpers/createTestAgent";

wrap(console, "log", function log() {
  return function log() {
    // Don't log during test
  };
});

const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://app.example.com:4000",
  query: {},
  headers: {},
  body: {
    image: "http://localhost",
  },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test("it resolves private IPv4 without context", (t) => {
  const agent = createTestAgent({
    token: new Token("123"),
  });
  agent.start([]);

  const wrappedLookup = inspectDNSLookupCalls(
    lookup,
    agent,
    "module",
    "operation"
  );

  wrappedLookup("localhost", { family: 4 }, (err, address) => {
    t.same(err, null);
    t.same(address, "127.0.0.1");
    t.end();
  });
});

t.test("it resolves private IPv6 without context", (t) => {
  const agent = createTestAgent({
    token: new Token("123"),
  });
  agent.start([]);

  const wrappedLookup = inspectDNSLookupCalls(
    lookup,
    agent,
    "module",
    "operation"
  );

  wrappedLookup("localhost", {}, (err, address) => {
    t.same(err, null);
    t.same(address, getMajorNodeVersion() === 16 ? "127.0.0.1" : "::1");
    t.end();
  });
});

t.test("it blocks lookup in blocking mode", (t) => {
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    token: new Token("123"),
    api,
  });
  agent.start([]);
  api.clear();

  const wrappedLookup = inspectDNSLookupCalls(
    lookup,
    agent,
    "module",
    "operation"
  );

  runWithContext(context, () => {
    wrappedLookup("localhost", {}, (err, address) => {
      t.same(err instanceof Error, true);
      if (err instanceof Error) {
        t.same(
          err.message,
          "Zen has blocked a server-side request forgery: operation(...) originating from body.image"
        );
      }
      t.same(address, undefined);
      t.match(api.getEvents(), [
        {
          type: "detected_attack",
          attack: {
            kind: "ssrf",
            metadata: {
              hostname: "localhost",
            },
          },
        },
      ]);
      t.end();
    });
  });
});

t.test("it allows resolved public IP", (t) => {
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    token: new Token("123"),
    api,
  });
  agent.start([]);
  api.clear();

  const wrappedLookup = inspectDNSLookupCalls(
    lookup,
    agent,
    "module",
    "operation"
  );

  runWithContext(
    { ...context, body: { image: "http://www.google.be" } },
    () => {
      wrappedLookup("www.google.be", {}, (err, address) => {
        t.same(err, null);
        t.ok(typeof address === "string");
        t.same(api.getEvents(), []);
        t.end();
      });
    }
  );
});

t.test(
  "it does not block resolved private IP if not found in user input",
  (t) => {
    const api = new ReportingAPIForTesting();
    const agent = createTestAgent({
      token: new Token("123"),
      api,
    });
    agent.start([]);
    api.clear();

    const wrappedLookup = inspectDNSLookupCalls(
      lookup,
      agent,
      "module",
      "operation"
    );

    runWithContext({ ...context, body: undefined }, () => {
      wrappedLookup("localhost", {}, (err, address) => {
        t.same(err, null);
        t.same(address, getMajorNodeVersion() === 16 ? "127.0.0.1" : "::1");
        t.same(api.getEvents(), []);
        t.end();
      });
    });
  }
);

t.test(
  "it does not block resolved private IP if endpoint protection is turned off",
  async (t) => {
    const api = new ReportingAPIForTesting({
      success: true,
      heartbeatIntervalInMS: 10 * 60 * 1000,
      endpoints: [
        {
          method: "POST",
          route: "/posts/:id",
          forceProtectionOff: true,
          rateLimiting: {
            enabled: false,
            windowSizeInMS: 60 * 1000,
            maxRequests: 100,
          },
        },
      ],
      blockedUserIds: [],
      allowedIPAddresses: [],
      configUpdatedAt: 0,
    });
    const agent = createTestAgent({
      token: new Token("123"),
      api,
    });
    agent.start([]);

    await new Promise((resolve) => setTimeout(resolve, 0));

    api.clear();

    const wrappedLookup = inspectDNSLookupCalls(
      lookup,
      agent,
      "module",
      "operation"
    );

    await new Promise<void>((resolve) => {
      runWithContext(context, () => {
        wrappedLookup("localhost", {}, (err, address) => {
          t.same(err, null);
          t.same(address, getMajorNodeVersion() === 16 ? "127.0.0.1" : "::1");
          t.same(api.getEvents(), []);
          resolve();
        });
      });
    });
  }
);

t.test("it blocks lookup in blocking mode with all option", (t) => {
  const agent = createTestAgent({
    token: new Token("123"),
  });
  agent.start([]);

  const wrappedLookup = inspectDNSLookupCalls(
    lookup,
    agent,
    "module",
    "operation"
  );

  runWithContext(context, () => {
    wrappedLookup("localhost", { all: true }, (err, address) => {
      t.same(err instanceof Error, true);
      if (err instanceof Error) {
        t.same(
          err.message,
          "Zen has blocked a server-side request forgery: operation(...) originating from body.image"
        );
      }
      t.same(address, undefined);
      t.end();
    });
  });
});

t.test("it does not block in dry mode", (t) => {
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    block: false,
    token: new Token("123"),
    api,
  });
  agent.start([]);
  api.clear();

  const wrappedLookup = inspectDNSLookupCalls(
    lookup,
    agent,
    "module",
    "operation"
  );

  runWithContext(context, () => {
    wrappedLookup("localhost", {}, (err, address) => {
      t.same(err, null);
      t.same(address, getMajorNodeVersion() === 16 ? "127.0.0.1" : "::1");
      t.match(api.getEvents(), [
        {
          type: "detected_attack",
          attack: {
            kind: "ssrf",
          },
        },
      ]);
      t.end();
    });
  });
});

t.test("it ignores invalid args", (t) => {
  const agent = createTestAgent({
    token: new Token("123"),
  });
  agent.start([]);

  const wrappedLookup = inspectDNSLookupCalls(
    lookup,
    agent,
    "module",
    "operation"
  );

  // @ts-expect-error Testing invalid args
  const error = t.throws(() => wrappedLookup());
  if (error instanceof Error) {
    // The "callback" argument must be of type function
    t.match(error.message, /callback/i);
  }
  t.end();
});

t.test("it ignores if lookup returns error", (t) => {
  const agent = createTestAgent({
    token: new Token("123"),
  });
  agent.start([]);

  const wrappedLookup = inspectDNSLookupCalls(
    (_: any, callback: Function) => callback(new Error("lookup failed")),
    agent,
    "module",
    "operation"
  );

  // @ts-expect-error Testing
  wrappedLookup("localhost", (err, address) => {
    t.same(err instanceof Error, true);
    if (err instanceof Error) {
      t.same(err.message, "lookup failed");
    }
    t.same(address, undefined);
    t.end();
  });
});

const imdsMockLookup = (
  hostname: string,
  options: any,
  callback: (
    err: any,
    address: string | LookupAddress[],
    family: number
  ) => void
) => {
  if (
    hostname === "imds.test.com" ||
    hostname === "metadata.google.internal" ||
    hostname === "metadata.goog"
  ) {
    return callback(null, "169.254.169.254", 4);
  }
  return lookup(hostname, options, callback);
};

t.test("Blocks IMDS SSRF with untrusted domain", async (t) => {
  const agent = createTestAgent({
    token: new Token("123"),
  });
  agent.start([]);

  const wrappedLookup = inspectDNSLookupCalls(
    imdsMockLookup,
    agent,
    "module",
    "operation"
  );

  await Promise.all([
    new Promise<void>((resolve) => {
      wrappedLookup("imds.test.com", { family: 4 }, (err, address) => {
        t.same(err instanceof Error, true);
        if (err instanceof Error) {
          t.same(
            err.message,
            "Zen has blocked a stored server-side request forgery: operation(...) originating from unknown source"
          );
        }
        t.same(address, undefined);
        resolve();
      });
    }),
    new Promise<void>((resolve) => {
      runWithContext(context, () => {
        wrappedLookup("imds.test.com", { family: 4 }, (err, address) => {
          t.same(err instanceof Error, true);
          if (err instanceof Error) {
            t.same(
              err.message,
              "Zen has blocked a stored server-side request forgery: operation(...) originating from unknown source"
            );
          }
          t.same(address, undefined);
          resolve();
        });
      });
    }),
  ]);
});

t.test(
  "it ignores IMDS SSRF with untrusted domain when endpoint protection is force off",
  async (t) => {
    const api = new ReportingAPIForTesting({
      success: true,
      heartbeatIntervalInMS: 10 * 60 * 1000,
      endpoints: [
        {
          method: "POST",
          route: "/posts/:id",
          forceProtectionOff: true,
          rateLimiting: {
            enabled: false,
            windowSizeInMS: 60 * 1000,
            maxRequests: 100,
          },
        },
      ],
      blockedUserIds: [],
      allowedIPAddresses: [],
      configUpdatedAt: 0,
    });
    const agent = createTestAgent({
      token: new Token("123"),
      api,
    });
    agent.start([]);

    // Wait for the agent to start
    await new Promise((resolve) => setTimeout(resolve, 0));

    const wrappedLookup = inspectDNSLookupCalls(
      imdsMockLookup,
      agent,
      "module",
      "operation"
    );

    runWithContext(context, () => {
      wrappedLookup("imds.test.com", { family: 4 }, (err, address) => {
        t.same(err, null);
        t.same(address, "169.254.169.254");
        t.end();
      });
    });
  }
);

t.test("Does not block IMDS SSRF with Google metadata domain", async (t) => {
  const agent = createTestAgent({
    token: new Token("123"),
  });
  agent.start([]);

  const wrappedLookup = inspectDNSLookupCalls(
    imdsMockLookup,
    agent,
    "module",
    "operation"
  );

  await Promise.all([
    new Promise<void>((resolve) => {
      wrappedLookup(
        "metadata.google.internal",
        { family: 4 },
        (err, address) => {
          t.same(err, null);
          t.same(address, "169.254.169.254");
          resolve();
        }
      );
    }),
    new Promise<void>((resolve) => {
      runWithContext(context, () => {
        wrappedLookup(
          "metadata.google.internal",
          { family: 4 },
          (err, address) => {
            t.same(err, null);
            t.same(address, "169.254.169.254");
            resolve();
          }
        );
      });
    }),
  ]);
});

t.test("it ignores when the argument is an IP address", async (t) => {
  const agent = createTestAgent({
    token: new Token("123"),
  });
  agent.start([]);

  const wrappedLookup = inspectDNSLookupCalls(
    lookup,
    agent,
    "module",
    "operation"
  );

  await Promise.all([
    new Promise<void>((resolve) => {
      runWithContext(
        { ...context, routeParams: { id: "169.254.169.254" } },
        () => {
          wrappedLookup("169.254.169.254", {}, (err, address) => {
            t.same(err, null);
            t.same(address, "169.254.169.254");
            resolve();
          });
        }
      );
    }),
    new Promise<void>((resolve) => {
      runWithContext(
        { ...context, routeParams: { id: "fd00:ec2::254" } },
        () => {
          wrappedLookup("fd00:ec2::254", {}, (err, address) => {
            t.same(err, null);
            t.same(address, "fd00:ec2::254");
            resolve();
          });
        }
      );
    }),
  ]);
});

t.test("Reports stored SSRF without context", async (t) => {
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    token: new Token("123"),
    api,
  });
  agent.start([]);

  const wrappedLookup = inspectDNSLookupCalls(
    imdsMockLookup,
    agent,
    "http",
    "request"
  );

  await new Promise<void>((resolve) => {
    wrappedLookup("imds.test.com", { family: 4 }, (err, address) => {
      t.same(err instanceof Error, true);
      if (err instanceof Error) {
        t.same(
          err.message,
          "Zen has blocked a stored server-side request forgery: request(...) originating from unknown source"
        );
      }
      t.same(address, undefined);
      resolve();
    });
  });

  t.match(api.getEvents(), [
    {
      type: "started",
    },
    {
      type: "detected_attack",
      attack: {
        kind: "stored_ssrf",
        operation: "request",
        module: "http",
        blocked: true,
        source: undefined,
        path: "",
        payload: undefined,
        metadata: {
          hostname: "imds.test.com",
          privateIP: "169.254.169.254",
        },
        user: undefined,
      },
      request: undefined,
    },
  ]);
});

t.test("Reports stored SSRF with context set", async (t) => {
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    token: new Token("123"),
    api,
  });
  agent.start([]);

  await runWithContext(
    {
      remoteAddress: "::1",
      method: "POST",
      url: "http://app.example.com:4000",
      query: {},
      headers: {},
      body: {
        image: "test.png",
      },
      cookies: {},
      routeParams: {},
      source: "express",
      route: "/posts/:id",
    },
    async () => {
      const wrappedLookup = inspectDNSLookupCalls(
        imdsMockLookup,
        agent,
        "http",
        "request"
      );

      await new Promise<void>((resolve) => {
        wrappedLookup("imds.test.com", { family: 4 }, (err, address) => {
          t.same(err instanceof Error, true);
          if (err instanceof Error) {
            t.same(
              err.message,
              "Zen has blocked a stored server-side request forgery: request(...) originating from unknown source"
            );
          }
          t.same(address, undefined);
          resolve();
        });
      });
    }
  );

  t.match(api.getEvents(), [
    {
      type: "started",
    },
    {
      type: "detected_attack",
      attack: {
        kind: "stored_ssrf",
        operation: "request",
        module: "http",
        blocked: true,
        source: undefined,
        path: "",
        payload: undefined,
        metadata: {
          hostname: "imds.test.com",
          privateIP: "169.254.169.254",
        },
        user: undefined,
      },
      request: undefined,
    },
  ]);
});

t.test("Reports IDMS SSRF from current request context", async (t) => {
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    token: new Token("123"),
    api,
  });
  agent.start([]);

  await runWithContext(
    {
      remoteAddress: "::1",
      method: "POST",
      url: "http://app.example.com:4000",
      query: {},
      headers: {},
      body: {
        image: "https://imds.test.com",
      },
      cookies: {},
      routeParams: {},
      source: "express",
      route: "/posts/:id",
    },
    async () => {
      const wrappedLookup = inspectDNSLookupCalls(
        imdsMockLookup,
        agent,
        "http",
        "request"
      );

      await new Promise<void>((resolve) => {
        wrappedLookup("imds.test.com", { family: 4 }, (err, address) => {
          t.same(err instanceof Error, true);
          if (err instanceof Error) {
            t.same(
              err.message,
              "Zen has blocked a server-side request forgery: request(...) originating from body.image"
            );
          }
          t.same(address, undefined);
          resolve();
        });
      });
    }
  );

  t.match(api.getEvents(), [
    {
      type: "started",
    },
    {
      type: "detected_attack",
      attack: {
        kind: "ssrf",
        operation: "request",
        module: "http",
        blocked: true,
        source: "body",
        path: ".image",
        payload: '"https://imds.test.com"',
        metadata: {
          hostname: "imds.test.com",
          privateIP: "169.254.169.254",
        },
        user: undefined,
      },
      request: {
        method: "POST",
        ipAddress: "::1",
        url: "http://app.example.com:4000",
      },
    },
  ]);
});
