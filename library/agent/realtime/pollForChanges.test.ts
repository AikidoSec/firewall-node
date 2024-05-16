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

  const calls: { url: string; method: string }[] = [];
  let configUpdatedAt = 0;

  wrap(fetch, "fetch", function fetch() {
    return async function fetch(params) {
      calls.push({
        url: params.url.toString(),
        method: params.method,
      });

      if (params.url.hostname.startsWith("runtime")) {
        return {
          body: JSON.stringify({
            configUpdatedAt: configUpdatedAt,
          }),
          statusCode: 200,
        };
      }

      if (params.url.hostname.startsWith("guard")) {
        return {
          body: JSON.stringify({
            endpoints: [],
            heartbeatIntervalInMS: 10 * 60 * 1000,
            configUpdatedAt: configUpdatedAt,
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
  t.same(calls, []);

  await clock.nextAsync();

  t.same(configUpdates, []);
  t.same(calls, [
    {
      url: "https://runtime.aikido.dev/config",
      method: "GET",
    },
  ]);

  configUpdatedAt = 1;
  await clock.nextAsync();

  t.same(configUpdates, [
    {
      endpoints: [],
      heartbeatIntervalInMS: 10 * 60 * 1000,
      configUpdatedAt: 1,
    },
  ]);
  t.same(calls, [
    {
      url: "https://runtime.aikido.dev/config",
      method: "GET",
    },
    {
      url: "https://runtime.aikido.dev/config",
      method: "GET",
    },
    {
      url: "https://guard.aikido.dev/api/runtime/config",
      method: "GET",
    },
  ]);

  await clock.nextAsync();

  t.same(configUpdates, [
    {
      endpoints: [],
      heartbeatIntervalInMS: 10 * 60 * 1000,
      configUpdatedAt: 1,
    },
  ]);
  t.same(calls, [
    {
      url: "https://runtime.aikido.dev/config",
      method: "GET",
    },
    {
      url: "https://runtime.aikido.dev/config",
      method: "GET",
    },
    {
      url: "https://guard.aikido.dev/api/runtime/config",
      method: "GET",
    },
    {
      url: "https://runtime.aikido.dev/config",
      method: "GET",
    },
  ]);

  configUpdatedAt = 2;
  await clock.nextAsync();

  t.same(configUpdates, [
    {
      endpoints: [],
      heartbeatIntervalInMS: 10 * 60 * 1000,
      configUpdatedAt: 1,
    },
    {
      endpoints: [],
      heartbeatIntervalInMS: 10 * 60 * 1000,
      configUpdatedAt: 2,
    },
  ]);
  t.same(calls, [
    {
      url: "https://runtime.aikido.dev/config",
      method: "GET",
    },
    {
      url: "https://runtime.aikido.dev/config",
      method: "GET",
    },
    {
      url: "https://guard.aikido.dev/api/runtime/config",
      method: "GET",
    },
    {
      url: "https://runtime.aikido.dev/config",
      method: "GET",
    },
    {
      url: "https://runtime.aikido.dev/config",
      method: "GET",
    },
    {
      url: "https://guard.aikido.dev/api/runtime/config",
      method: "GET",
    },
  ]);

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
