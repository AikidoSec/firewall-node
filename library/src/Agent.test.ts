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
    new IDGeneratorFixed("id")
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
        os: {
          name: platform(),
          version: release(),
        },
      },
    },
  ]);

  agent.stop();
});
