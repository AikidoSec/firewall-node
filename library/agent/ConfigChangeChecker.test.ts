import * as FakeTimers from "@sinonjs/fake-timers";
import * as t from "tap";
import { Token } from "./api/Token";
import { ConfigAPIForTesting } from "./config-api/ConfigAPIForTesting";
import { ConfigChangeChecker } from "./ConfigChangeChecker";
import { LoggerForTesting } from "./logger/LoggerForTesting";
import { LoggerNoop } from "./logger/LoggerNoop";

t.test("it throws error if interval already started", async () => {
  const api = new ConfigAPIForTesting();
  const checker = new ConfigChangeChecker(
    api,
    new Token("token"),
    undefined,
    new LoggerNoop(),
    0
  );

  checker.startPolling(() => {});
  t.throws(() => checker.startPolling(() => {}));
});

t.test("it does not poll if no token", async () => {
  const api = new ConfigAPIForTesting();
  const logger = new LoggerForTesting();
  const checker = new ConfigChangeChecker(api, undefined, undefined, logger, 0);

  checker.startPolling(() => {});
  t.same(logger.getMessages(), [
    "No token provided, not polling for config updates",
  ]);
});

t.test("it does not poll if serverless", async () => {
  const api = new ConfigAPIForTesting();
  const logger = new LoggerForTesting();
  const checker = new ConfigChangeChecker(
    api,
    new Token("token"),
    "lambda",
    logger,
    0
  );

  checker.startPolling(() => {});
  t.same(logger.getMessages(), [
    "Running in serverless environment, not polling for config updates",
  ]);
});

t.test("it polls for config updates", async () => {
  const clock = FakeTimers.install();

  const api = new ConfigAPIForTesting();
  const logger = new LoggerForTesting();
  const checker = new ConfigChangeChecker(
    api,
    new Token("token"),
    undefined,
    logger,
    0
  );

  const calls = [];

  checker.startPolling((config) => {
    calls.push({ config: config, time: Date.now() });
  });

  await clock.nextAsync();

  t.same(logger.getMessages(), []);
  t.same(calls, []);

  api.update(1);

  await clock.nextAsync();

  t.same(calls, [
    {
      config: {
        configUpdatedAt: 1,
        success: true,
        endpoints: [],
        heartbeatIntervalInMS: 10 * 60 * 1000,
      },
      time: 2 * 60 * 1000,
    },
  ]);

  await clock.nextAsync();

  t.same(calls, [
    {
      config: {
        configUpdatedAt: 1,
        success: true,
        endpoints: [],
        heartbeatIntervalInMS: 10 * 60 * 1000,
      },
      time: 2 * 60 * 1000,
    },
  ]);

  clock.uninstall();
});
