import { hostname, platform, release } from "node:os";
import * as t from "tap";
import { Agent } from "./Agent";
import { APIForTesting, Token } from "./API";
import { IDGeneratorFixed } from "./IDGenerator";
import { LoggerNoop } from "./Logger";
import { address } from "ip";

t.test("it sends install event once", async (t) => {
  const logger = new LoggerNoop();
  const api = new APIForTesting();
  const token = new Token("123");
  const agent = new Agent(
    true,
    logger,
    api,
    token,
    [],
    new IDGeneratorFixed("id"),
    false
  );
  agent.start();

  await new Promise((resolve) => setImmediate(resolve));
  t.match(api.getEvents(), [
    {
      type: "started",
      agent: {
        id: "id",
        dryMode: false,
        hostname: hostname(),
        version: "1.0.0",
        ipAddress: address(),
        packages: {},
        preventedPrototypePollution: false,
        nodeEnv: "",
        os: {
          name: platform(),
          version: release(),
        },
      },
    },
  ]);

  agent.start();
  await new Promise((resolve) => setImmediate(resolve));
  t.match(api.getEvents(), [
    {
      type: "started",
      agent: {
        id: "id",
        dryMode: false,
        hostname: hostname(),
        version: "1.0.0",
        ipAddress: address(),
        packages: {},
        preventedPrototypePollution: false,
        nodeEnv: "",
        os: {
          name: platform(),
          version: release(),
        },
      },
    },
  ]);

  // Stop setInterval from heartbeat
  agent.stop();
});

t.test("when prevent prototype pollution is enabled", async (t) => {
  const logger = new LoggerNoop();
  const api = new APIForTesting();
  const token = new Token("123");
  const agent = new Agent(
    true,
    logger,
    api,
    token,
    [],
    new IDGeneratorFixed("id"),
    false
  );
  agent.start();
  // @ts-expect-error Private property
  t.same(agent.info.preventedPrototypePollution, false);
  agent.onPrototypePollutionPrevented();
  // @ts-expect-error Private property
  t.same(agent.info.preventedPrototypePollution, true);
  agent.stop();
});

t.test("it does not start interval in serverless mode", async () => {
  const logger = new LoggerNoop();
  const api = new APIForTesting();
  const token = new Token("123");
  const agent = new Agent(
    true,
    logger,
    api,
    token,
    [],
    new IDGeneratorFixed("id"),
    true
  );

  // This would otherwise keep the process running
  agent.start();
});

t.test("it keeps track of stats", async () => {
  const logger = new LoggerNoop();
  const api = new APIForTesting();
  const token = new Token("123");
  const agent = new Agent(
    true,
    logger,
    api,
    token,
    [],
    new IDGeneratorFixed("id"),
    true
  );

  agent.start();
  agent.onInspectedCall({
    module: "mongodb",
    withoutContext: false,
    detectedAttack: false,
  });

  // @ts-expect-error Private property
  t.same(agent.stats, {
    mongodb: {
      blocked: 0,
      allowed: 1,
      withoutContext: 0,
      total: 1,
    },
  });

  agent.onInspectedCall({
    module: "mongodb",
    withoutContext: true,
    detectedAttack: false,
  });

  // @ts-expect-error Private property
  t.same(agent.stats, {
    mongodb: {
      blocked: 0,
      allowed: 2,
      withoutContext: 1,
      total: 2,
    },
  });

  agent.onInspectedCall({
    module: "mongodb",
    withoutContext: false,
    detectedAttack: true,
  });

  // @ts-expect-error Private property
  t.same(agent.stats, {
    mongodb: {
      blocked: 1,
      allowed: 2,
      withoutContext: 1,
      total: 3,
    },
  });
});

t.test("it keeps tracks of stats in dry mode", async () => {
  const logger = new LoggerNoop();
  const api = new APIForTesting();
  const token = new Token("123");
  const agent = new Agent(
    false,
    logger,
    api,
    token,
    [],
    new IDGeneratorFixed("id"),
    true
  );

  agent.start();

  agent.onInspectedCall({
    module: "mongodb",
    withoutContext: false,
    detectedAttack: true,
  });

  // @ts-expect-error Private property
  t.same(agent.stats, {
    mongodb: {
      blocked: 0,
      allowed: 1,
      withoutContext: 0,
      total: 1,
    },
  });
});
