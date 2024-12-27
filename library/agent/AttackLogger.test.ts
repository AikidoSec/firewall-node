import { wrap } from "../helpers/wrap";
import { DetectedAttack } from "./api/Event";
import { AttackLogger } from "./AttackLogger";
import * as t from "tap";

const logs: string[] = [];
wrap(console, "log", function log() {
  return function log(...args: string[]) {
    logs.push(...args);
  };
});

t.test("it stops logging after max logs", async (t) => {
  const max = 10;
  const logger = new AttackLogger(max);

  for (let i = 0; i < max; i++) {
    logger.log(generateAttackEvent());
  }

  t.same(logs.length, max);

  logger.log(generateAttackEvent());

  logs[logs.length - 1].includes(
    `Zen has detected more than ${max} attacks. No longer logging them.`
  );

  logger.log(generateAttackEvent());

  t.same(logs.length, max + 1);
});

function generateAttackEvent(): DetectedAttack {
  return {
    type: "detected_attack",
    time: Date.now(),
    request: {
      url: undefined,
      method: undefined,
      ipAddress: undefined,
      userAgent: undefined,
      // @ts-expect-error Test
      headers: undefined,
      body: undefined,
      source: "express",
      route: "/posts/:id",
    },
    attack: {
      module: "module",
      blocked: false,
      source: "body",
      path: "path",
      stack: "stack",
      kind: "nosql_injection",
      metadata: {},
      operation: "operation",
      payload: "payload",
      user: undefined,
    },
    agent: {
      version: "1.0.0",
      library: "firewall-node",
      dryMode: false,
      hostname: "hostname",
      packages: {},
      ipAddress: "ipAddress",
      preventedPrototypePollution: false,
      nodeEnv: "",
      os: {
        name: "os",
        version: "version",
      },
      serverless: false,
      incompatiblePackages: {
        prototypePollution: {},
      },
      stack: [],
      platform: {
        version: "version",
        arch: "arch",
      },
    },
  };
}
