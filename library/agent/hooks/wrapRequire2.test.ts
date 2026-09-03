import * as t from "tap";
import { startTestAgent } from "../../helpers/startTestAgent";
import { Hono as HonoSink } from "../../sources/Hono";
import { LoggerForTesting } from "../logger/LoggerForTesting";
import { Token } from "../api/Token";
import { getPackageVersion } from "../../helpers/getPackageVersion";

// @esm-tests-skip

t.test("it works", async (t) => {
  const logger = new LoggerForTesting();
  startTestAgent({
    wrappers: [new HonoSink()],
    block: true,
    rewrite: {},
    logger: logger,
    token: new Token("test-token"),
  });

  const honoVersion = getPackageVersion("hono");

  require("hono/utils/jwt");

  // It does not log supported when no interceptor is matching
  t.same(logger.getMessages(), [
    "Starting agent v0.0.0...",
    "Found token, reporting enabled!",
  ]);

  require("hono");

  // It logs supported when an interceptor is matching
  t.same(logger.getMessages(), [
    "Starting agent v0.0.0...",
    "Found token, reporting enabled!",
    `hono@${honoVersion} is supported!`,
  ]);
});
