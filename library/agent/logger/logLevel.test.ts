import * as t from "tap";
import { getLogLevel, AikidoLogLevel, shouldLog } from "./logLevel";

const defaultLogLevel = AikidoLogLevel.info;

t.test("it returns the default log level", async (t) => {
  t.equal(getLogLevel(), defaultLogLevel);
});

t.test("it returns the log level from the environment variable", async (t) => {
  process.env.AIKIDO_LOG_LEVEL = "debug";
  t.equal(getLogLevel(), AikidoLogLevel.debug);
  process.env.AIKIDO_LOG_LEVEL = "info";
  t.equal(getLogLevel(), AikidoLogLevel.info);
  process.env.AIKIDO_LOG_LEVEL = "warn";
  t.equal(getLogLevel(), AikidoLogLevel.warn);
  process.env.AIKIDO_LOG_LEVEL = "error";
  t.equal(getLogLevel(), AikidoLogLevel.error);
  process.env.AIKIDO_LOG_LEVEL = "123456";
  t.equal(getLogLevel(), defaultLogLevel);
  process.env.AIKIDO_LOG_LEVEL = undefined;
});

t.test("it respects the AIKIDO_DEBUG environment variable", async (t) => {
  t.equal(getLogLevel(), defaultLogLevel);
  process.env.AIKIDO_DEBUG = "1";
  t.equal(getLogLevel(), AikidoLogLevel.debug);
  process.env.AIKIDO_LOG_LEVEL = "warn";
  t.equal(getLogLevel(), AikidoLogLevel.debug);
  process.env.AIKIDO_DEBUG = "0";
  t.equal(getLogLevel(), AikidoLogLevel.warn);
  process.env.AIKIDO_DEBUG = undefined;
});

t.test("test shouldLog", async (t) => {
  process.env.AIKIDO_LOG_LEVEL = "debug";
  t.equal(getLogLevel(), AikidoLogLevel.debug);
  t.equal(true, shouldLog(AikidoLogLevel.debug));
  t.equal(true, shouldLog(AikidoLogLevel.info));
  t.equal(true, shouldLog(AikidoLogLevel.warn));
  t.equal(true, shouldLog(AikidoLogLevel.error));
  process.env.AIKIDO_LOG_LEVEL = "info";
  t.equal(getLogLevel(), AikidoLogLevel.info);
  t.equal(false, shouldLog(AikidoLogLevel.debug));
  t.equal(true, shouldLog(AikidoLogLevel.info));
  t.equal(true, shouldLog(AikidoLogLevel.warn));
  t.equal(true, shouldLog(AikidoLogLevel.error));
  process.env.AIKIDO_LOG_LEVEL = "warn";
  t.equal(getLogLevel(), AikidoLogLevel.warn);
  t.equal(false, shouldLog(AikidoLogLevel.debug));
  t.equal(false, shouldLog(AikidoLogLevel.info));
  t.equal(true, shouldLog(AikidoLogLevel.warn));
  t.equal(true, shouldLog(AikidoLogLevel.error));
  process.env.AIKIDO_LOG_LEVEL = "error";
  t.equal(getLogLevel(), AikidoLogLevel.error);
  t.equal(false, shouldLog(AikidoLogLevel.debug));
  t.equal(false, shouldLog(AikidoLogLevel.info));
  t.equal(false, shouldLog(AikidoLogLevel.warn));
  t.equal(true, shouldLog(AikidoLogLevel.error));
  process.env.AIKIDO_LOG_LEVEL = undefined;
  t.equal(getLogLevel(), defaultLogLevel);
  t.equal(false, shouldLog(AikidoLogLevel.debug));
  t.equal(true, shouldLog(AikidoLogLevel.info));
});
