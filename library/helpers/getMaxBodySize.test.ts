import * as t from "tap";
import { getMaxBodySize } from "./getMaxBodySize";

t.test(
  "returns default max body size when AIKIDO_MAX_BODY_SIZE is not set",
  async (t) => {
    delete process.env.AIKIDO_MAX_BODY_SIZE;
    t.equal(
      getMaxBodySize(),
      20 * 1024 * 1024,
      "should return 20 MB as default"
    );
  }
);

t.test(
  "returns parsed value from AIKIDO_MAX_BODY_SIZE without suffix",
  async (t) => {
    process.env.AIKIDO_MAX_BODY_SIZE = "10";
    t.equal(getMaxBodySize(), 10 * 1024 * 1024, "should return 10 MB");
  }
);

t.test(
  'returns parsed value from AIKIDO_MAX_BODY_SIZE with lowercase "m" suffix',
  async (t) => {
    process.env.AIKIDO_MAX_BODY_SIZE = "15m";
    t.equal(getMaxBodySize(), 15 * 1024 * 1024, "should return 15 MB");
  }
);

t.test(
  'returns parsed value from AIKIDO_MAX_BODY_SIZE with uppercase "M" suffix',
  async (t) => {
    process.env.AIKIDO_MAX_BODY_SIZE = "20M";
    t.equal(getMaxBodySize(), 20 * 1024 * 1024, "should return 20 MB");
  }
);

t.test(
  "returns default max body size for non-numeric AIKIDO_MAX_BODY_SIZE",
  async (t) => {
    process.env.AIKIDO_MAX_BODY_SIZE = "invalid";
    t.equal(
      getMaxBodySize(),
      20 * 1024 * 1024,
      "should return 20 MB as default"
    );
  }
);

t.test(
  "returns default max body size for negative AIKIDO_MAX_BODY_SIZE",
  async (t) => {
    process.env.AIKIDO_MAX_BODY_SIZE = "-5";
    t.equal(
      getMaxBodySize(),
      20 * 1024 * 1024,
      "should return 20 MB as default"
    );
  }
);
