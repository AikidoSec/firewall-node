import * as t from "tap";
import { getMaxWsMsgSize } from "./getMaxWsMsgSize";

t.test(
  "returns default max body size when AIKIDO_MAX_WS_MSG_SIZE_MB is not set",
  async (t) => {
    delete process.env.AIKIDO_MAX_WS_MSG_SIZE_MB;
    t.equal(
      getMaxWsMsgSize(),
      20 * 1024 * 1024,
      "should return 20 MB as default"
    );
  }
);

t.test(
  "returns parsed value from AIKIDO_MAX_WS_MSG_SIZE_MB without suffix",
  async (t) => {
    process.env.AIKIDO_MAX_WS_MSG_SIZE_MB = "10";
    t.equal(getMaxWsMsgSize(), 10 * 1024 * 1024, "should return 10 MB");
  }
);

t.test(
  "returns default max body size for non-numeric AIKIDO_MAX_WS_MSG_SIZE_MB",
  async (t) => {
    process.env.AIKIDO_MAX_WS_MSG_SIZE_MB = "invalid";
    t.equal(
      getMaxWsMsgSize(),
      20 * 1024 * 1024,
      "should return 20 MB as default"
    );
  }
);

t.test(
  "returns default max body size for negative AIKIDO_MAX_WS_MSG_SIZE_MB",
  async (t) => {
    process.env.AIKIDO_MAX_WS_MSG_SIZE_MB = "-5";
    t.equal(
      getMaxWsMsgSize(),
      20 * 1024 * 1024,
      "should return 20 MB as default"
    );
  }
);
