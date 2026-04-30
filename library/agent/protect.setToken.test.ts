/* oxlint-disable no-console */
import * as t from "tap";
import { ReportingAPIForTesting } from "./api/ReportingAPIForTesting";
import { Token } from "./api/Token";
import { getInstance, setInstance } from "./AgentSingleton";
import { createTestAgent } from "../helpers/createTestAgent";
import { cloudFunction, lambda, setToken } from "./protect";

t.beforeEach(() => {
  // @ts-expect-error Reset singleton for isolation
  setInstance(undefined);
  delete process.env.AIKIDO_BLOCK;
  delete process.env.AIKIDO_BLOCKING;
  delete process.env.AIKIDO_DEBUG;
  delete process.env.AIKIDO_DISABLE;
  delete process.env.AIKIDO_INSTRUMENT;
  delete process.env.AIKIDO_TOKEN;
});

t.test(
  "it sets the token on a serverless agent without starting reporting",
  async (t) => {
    const api = new ReportingAPIForTesting();
    const agent = createTestAgent({
      api,
      serverless: "lambda",
    });
    agent.start([]);

    t.equal(agent.hasToken(), false);

    setToken("test-token-123");

    t.equal(agent.hasToken(), true);

    // Give any accidental async reporting a tick to run
    await new Promise((resolve) => setTimeout(resolve, 10));

    const events = api.getEvents();
    const startedEvents = events.filter((e) => e.type === "started");
    t.equal(startedEvents.length, 0);
  }
);

t.test("it starts reporting for a non-serverless agent", async (t) => {
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    api,
  });
  agent.start([]);

  setToken("test-token-123");

  t.equal(agent.hasToken(), true);

  // Give the async onStart a tick to complete
  await new Promise((resolve) => setTimeout(resolve, 10));

  const events = api.getEvents();
  const startedEvents = events.filter((e) => e.type === "started");
  t.equal(startedEvents.length, 1);
});

t.test("it ignores setToken if agent already has a token", async (t) => {
  const api = new ReportingAPIForTesting();
  createTestAgent({
    api,
    token: new Token("existing-token"),
    serverless: "lambda",
  });

  setToken("new-token");

  const agent = getInstance()!;
  t.equal(agent.hasToken(), true);
});

t.test("it warns if no agent is running", async (t) => {
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (msg: string) => warnings.push(msg);

  setToken("test-token");

  console.warn = originalWarn;

  t.equal(warnings.length, 1);
  t.match(warnings[0], /AIKIDO_INSTRUMENT/);
});

t.test("it warns on empty string", async (t) => {
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (msg: string) => warnings.push(msg);

  setToken("");

  console.warn = originalWarn;

  t.equal(warnings.length, 1);
  t.match(warnings[0], /empty string/);
});

t.test(
  "AIKIDO_INSTRUMENT starts the lambda wrapper without a token",
  async (t) => {
    process.env.AIKIDO_INSTRUMENT = "true";

    lambda();

    const agent = getInstance();
    t.ok(agent);
    t.equal(agent?.hasToken(), false);
    t.equal(agent?.isServerless(), true);
  }
);

t.test(
  "AIKIDO_INSTRUMENT starts the cloud function wrapper without a token",
  async (t) => {
    process.env.AIKIDO_INSTRUMENT = "true";

    cloudFunction();

    const agent = getInstance();
    t.ok(agent);
    t.equal(agent?.hasToken(), false);
    t.equal(agent?.isServerless(), true);
  }
);
