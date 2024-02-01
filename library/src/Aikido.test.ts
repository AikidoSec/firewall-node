import { hostname } from "node:os";
import * as t from "tap";
import { Aikido } from "./Aikido";
import { APIForTesting, Token } from "./API";
import { LoggerNoop } from "./Logger";

t.test("it sends install event once", async (t) => {
  const logger = new LoggerNoop();
  const api = new APIForTesting();
  const token = new Token("123");
  const aikido = new Aikido(logger, api, token);
  aikido.installed();

  await new Promise((resolve) => setImmediate(resolve));
  t.match(api.getEvents(), [
    {
      type: "installed",
      hostname: hostname(),
      version: "1.0.0",
    },
  ]);

  aikido.installed();
  await new Promise((resolve) => setImmediate(resolve));
  t.match(api.getEvents(), [
    {
      type: "installed",
      hostname: hostname(),
      version: "1.0.0",
    },
  ]);
});
