import * as t from "tap";
import { getMaxBodySize } from "./getMaxBodySize";

t.test(
  "returns default max body size when MAX_WS_MSG_SIZE_MB is not set",
  async (t) => {
    delete process.env.MAX_WS_MSG_SIZE_MB;
    t.equal(
      getMaxBodySize(),
      20 * 1024 * 1024,
      "should return 20 MB as default"
    );
  }
);

t.test(
  "returns parsed value from MAX_WS_MSG_SIZE_MB without suffix",
  async (t) => {
    process.env.MAX_WS_MSG_SIZE_MB = "10";
    t.equal(getMaxBodySize(), 10 * 1024 * 1024, "should return 10 MB");
  }
);

t.test(
  "returns default max body size for non-numeric MAX_WS_MSG_SIZE_MB",
  async (t) => {
    process.env.MAX_WS_MSG_SIZE_MB = "invalid";
    t.equal(
      getMaxBodySize(),
      20 * 1024 * 1024,
      "should return 20 MB as default"
    );
  }
);

t.test(
  "returns default max body size for negative MAX_WS_MSG_SIZE_MB",
  async (t) => {
    process.env.MAX_WS_MSG_SIZE_MB = "-5";
    t.equal(
      getMaxBodySize(),
      20 * 1024 * 1024,
      "should return 20 MB as default"
    );
  }
);
