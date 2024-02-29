import { hostname, platform, release } from "node:os";
import * as t from "tap";
import { ip } from "../helpers/ipAddress";
import { MongoDB } from "../sinks/MongoDB";
import { Agent } from "./Agent";
import { APIForTesting } from "./api/APIForTesting";
import { Token } from "./api/Token";
import { LoggerNoop } from "./logger/LoggerNoop";

t.test("it sends started event", async (t) => {
  const logger = new LoggerNoop();
  const api = new APIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, false);
  agent.start([new MongoDB()]);

  t.match(api.getEvents(), [
    {
      type: "started",
      agent: {
        dryMode: false,
        hostname: hostname(),
        version: "0.0.0",
        ipAddress: ip(),
        packages: {
          mongodb: "6.3.0",
        },
        preventedPrototypePollution: false,
        nodeEnv: "",
        serverless: false,
        os: {
          name: platform(),
          version: release(),
        },
      },
    },
  ]);
});

t.test("it throws error if already started", async () => {
  const logger = new LoggerNoop();
  const api = new APIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, false);
  agent.start([new MongoDB()]);
  t.throws(() => agent.start([new MongoDB()]), "Agent already started!");
});

t.test("when prevent prototype pollution is enabled", async (t) => {
  const logger = new LoggerNoop();
  const api = new APIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, true);
  agent.onPrototypePollutionPrevented();
  agent.start([]);
  t.match(api.getEvents(), [
    {
      agent: {
        preventedPrototypePollution: true,
      },
    },
  ]);
});

t.test("it does not start interval in serverless mode", async () => {
  const logger = new LoggerNoop();
  const api = new APIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, true);

  // This would otherwise keep the process running
  agent.start([]);
});

t.test("it keeps track of stats", async () => {
  const logger = new LoggerNoop();
  const api = new APIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, true);

  agent.start([]);
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
  const agent = new Agent(false, logger, api, token, true);

  agent.start([]);

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
