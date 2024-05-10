import * as t from "tap";
import * as fetch from "../../helpers/fetch";
import { wrap } from "../../helpers/wrap";
import { Token } from "../api/Token";
import { LoggerForTesting } from "../logger/LoggerForTesting";
import { LoggerNoop } from "../logger/LoggerNoop";
import { pollForChanges } from "./pollForChanges";
import * as FakeTimers from "@sinonjs/fake-timers";

t.test("it does not start interval if no token", async (t) => {
  const logger = new LoggerForTesting();
  pollForChanges({
    onConfigUpdate: (config) => t.fail(),
    logger: logger,
    token: undefined,
    serverless: undefined,
    lastUpdatedAt: 0,
  });

  t.same(logger.getMessages(), [
    "No token provided, not polling for config updates",
  ]);
});

t.test("it does not start interval if serverless", async (t) => {
  const logger = new LoggerForTesting();
  pollForChanges({
    onConfigUpdate: (config) => t.fail(),
    logger: logger,
    token: new Token("123"),
    serverless: "true",
    lastUpdatedAt: 0,
  });

  t.same(logger.getMessages(), [
    "Running in serverless environment, not polling for config updates",
  ]);
});

t.test("it checks for config updates", async () => {
  const clock = FakeTimers.install();

  wrap(fetch, "fetch", function fetch() {
    return async function fetch(params) {
      if (params.url.hostname.startsWith("runtime")) {
        return {
          body: JSON.stringify({
            configUpdatedAt: 1,
          }),
          statusCode: 200,
        };
      }

      if (params.url.hostname.startsWith("guard")) {
        return {
          body: JSON.stringify({
            endpoints: [],
            heartbeatIntervalInMS: 10 * 60 * 1000,
            configUpdatedAt: 1,
          }),
          statusCode: 200,
        };
      }

      throw new Error(`Unknown hostname: ${params.url.hostname}`);
    };
  });

  const configUpdates = [];

  pollForChanges({
    onConfigUpdate: (config) => {
      configUpdates.push(config);
    },
    logger: new LoggerNoop(),
    token: new Token("123"),
    serverless: undefined,
    lastUpdatedAt: 0,
  });

  t.same(configUpdates, []);

  await clock.nextAsync();

  t.same(configUpdates, [
    {
      endpoints: [],
      heartbeatIntervalInMS: 10 * 60 * 1000,
      configUpdatedAt: 1,
    },
  ]);

  await clock.nextAsync();

  t.same(configUpdates.length, 1);

  clock.uninstall();
});

t.test("it deals with API throwing errors", async () => {
  const clock = FakeTimers.install();

  wrap(fetch, "fetch", function fetch() {
    return async function fetch() {
      throw new Error("Request timed out");
    };
  });

  const configUpdates = [];

  const logger = new LoggerForTesting();
  pollForChanges({
    onConfigUpdate: (config) => {
      configUpdates.push(config);
    },
    logger: logger,
    token: new Token("123"),
    serverless: undefined,
    lastUpdatedAt: 0,
  });

  t.same(configUpdates, []);
  t.same(logger.getMessages(), []);

  await clock.nextAsync();

  t.same(configUpdates, []);
  t.same(logger.getMessages(), ["Failed to check for config updates"]);

  clock.uninstall();
});
