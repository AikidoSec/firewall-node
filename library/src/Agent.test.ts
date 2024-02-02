import { hostname } from "node:os";
import * as t from "tap";
import { Agent } from "./Agent";
import { APIForTesting, Token } from "./API";
import { LoggerNoop } from "./Logger";
import { address } from "ip";

t.test("it sends install event once", async (t) => {
  const logger = new LoggerNoop();
  const api = new APIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, []);
  agent.start();

  await new Promise((resolve) => setImmediate(resolve));
  t.match(api.getEvents(), [
    {
      type: "installed",
      instance: {
        hostname: hostname(),
        version: "1.0.0",
        ipAddress: address(),
        packages: {},
      },
    },
  ]);

  agent.start();
  await new Promise((resolve) => setImmediate(resolve));
  t.match(api.getEvents(), [
    {
      type: "installed",
      instance: {
        hostname: hostname(),
        version: "1.0.0",
        ipAddress: address(),
        packages: {},
      },
    },
  ]);
});
