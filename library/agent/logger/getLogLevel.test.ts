import * as t from "tap";
import { getLogLevel } from "./getLogLevel";

t.test("it returns the default log level", async (t) => {
  t.equal(getLogLevel(), "info");
});

t.test("it returns the log level from the environment variable", async (t) => {
  process.env.AIKIDO_LOG_LEVEL = "debug";
  t.equal(getLogLevel(), "debug");
  process.env.AIKIDO_LOG_LEVEL = "info";
  t.equal(getLogLevel(), "info");
  process.env.AIKIDO_LOG_LEVEL = "warn";
  t.equal(getLogLevel(), "warn");
  process.env.AIKIDO_LOG_LEVEL = "error";
  t.equal(getLogLevel(), "error");
  process.env.AIKIDO_LOG_LEVEL = "123456";
  t.equal(getLogLevel(), "info");
  process.env.AIKIDO_LOG_LEVEL = undefined;
});

t.test("it respects the AIKIDO_DEBUG environment variable", async (t) => {
  t.equal(getLogLevel(), "info");
  process.env.AIKIDO_DEBUG = "1";
  t.equal(getLogLevel(), "debug");
  process.env.AIKIDO_LOG_LEVEL = "warn";
  t.equal(getLogLevel(), "debug");
  process.env.AIKIDO_DEBUG = "0";
  t.equal(getLogLevel(), "warn");
  process.env.AIKIDO_DEBUG = undefined;
});
