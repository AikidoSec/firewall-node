import { lookup } from "dns";
import * as t from "tap";
import { Agent } from "../../agent/Agent";
import { ReportingAPIForTesting } from "../../agent/api/ReportingAPIForTesting";
import { Token } from "../../agent/api/Token";
import { Context, runWithContext } from "../../agent/Context";
import { LoggerNoop } from "../../agent/logger/LoggerNoop";
import { inspectLookupCalls } from "./inspectLookupCalls";

const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
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
  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, undefined);
  agent.start([]);

  const wrappedLookup = inspectLookupCalls(
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
  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, undefined);
  agent.start([]);

  const wrappedLookup = inspectLookupCalls(
    lookup,
    agent,
    "module",
    "operation"
  );

  wrappedLookup("localhost", (err, address) => {
    t.same(err, null);
    t.same(address, "::1");
    t.end();
  });
});

t.test("it blocks lookup in blocking mode", (t) => {
  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, undefined);
  agent.start([]);
  api.clear();

  const wrappedLookup = inspectLookupCalls(
    lookup,
    agent,
    "module",
    "operation"
  );

  runWithContext(context, () => {
    wrappedLookup("localhost", (err, address) => {
      t.same(err instanceof Error, true);
      t.same(
        err.message,
        "Aikido firewall has blocked a server-side request forgery: operation(...) originating from body.image"
      );
      t.same(address, undefined);
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

t.test("it allows resolved public IP", (t) => {
  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, undefined);
  agent.start([]);
  api.clear();

  const wrappedLookup = inspectLookupCalls(
    lookup,
    agent,
    "module",
    "operation"
  );

  runWithContext(
    { ...context, body: { image: "http://www.google.be" } },
    () => {
      wrappedLookup("www.google.be", (err, address) => {
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
    const logger = new LoggerNoop();
    const api = new ReportingAPIForTesting();
    const token = new Token("123");
    const agent = new Agent(true, logger, api, token, undefined);
    agent.start([]);
    api.clear();

    const wrappedLookup = inspectLookupCalls(
      lookup,
      agent,
      "module",
      "operation"
    );

    runWithContext({ ...context, body: undefined }, () => {
      wrappedLookup("localhost", (err, address) => {
        t.same(err, null);
        t.same(address, "::1");
        t.same(api.getEvents(), []);
        t.end();
      });
    });
  }
);

t.test(
  "it does not block resolved private IP if endpoint protection is turned off",
  (t) => {
    const logger = new LoggerNoop();
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
    const token = new Token("123");
    const agent = new Agent(true, logger, api, token, undefined);
    agent.start([]);
    api.clear();

    const wrappedLookup = inspectLookupCalls(
      lookup,
      agent,
      "module",
      "operation"
    );

    runWithContext(context, () => {
      wrappedLookup("localhost", (err, address) => {
        t.same(err, null);
        t.same(address, "::1");
        t.same(api.getEvents(), []);
        t.end();
      });
    });
  }
);

t.test("it blocks lookup in blocking mode with all option", (t) => {
  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, undefined);
  agent.start([]);

  const wrappedLookup = inspectLookupCalls(
    lookup,
    agent,
    "module",
    "operation"
  );

  runWithContext(context, () => {
    wrappedLookup("localhost", { all: true }, (err, addresses) => {
      t.same(err instanceof Error, true);
      t.same(
        err.message,
        "Aikido firewall has blocked a server-side request forgery: operation(...) originating from body.image"
      );
      t.same(addresses, undefined);
      t.end();
    });
  });
});

t.test("it does not block in dry mode", (t) => {
  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting();
  const token = new Token("123");
  const agent = new Agent(false, logger, api, token, undefined);
  agent.start([]);
  api.clear();

  const wrappedLookup = inspectLookupCalls(
    lookup,
    agent,
    "module",
    "operation"
  );

  runWithContext(context, () => {
    wrappedLookup("localhost", (err, address) => {
      t.same(err, null);
      t.same(address, "::1");
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
  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, undefined);
  agent.start([]);

  const wrappedLookup = inspectLookupCalls(
    lookup,
    agent,
    "module",
    "operation"
  );

  const error = t.throws(() => wrappedLookup());
  if (error instanceof Error) {
    // The "callback" argument must be of type function
    t.match(error.message, /callback/);
  }
  t.end();
});

t.test("it ignores if lookup returns error", (t) => {
  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, undefined);
  agent.start([]);

  const wrappedLookup = inspectLookupCalls(
    (_, callback) => callback(new Error("lookup failed")),
    agent,
    "module",
    "operation"
  );

  wrappedLookup("localhost", (err, address) => {
    t.same(err instanceof Error, true);
    t.same(err.message, "lookup failed");
    t.same(address, undefined);
    t.end();
  });
});
