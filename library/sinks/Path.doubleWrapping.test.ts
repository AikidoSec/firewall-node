import * as t from "tap";
import { isWindows } from "../helpers/isWindows";
import { isWrapped, originalSymbol } from "../helpers/wrap";
import { Path } from "./Path";
import { createTestAgent } from "../helpers/createTestAgent";

t.test(
  "it works",
  { skip: isWindows() ? "path is not the same as path/posix" : false },
  async (t) => {
    const agent = createTestAgent();

    agent.start([new Path()]);

    const { join, resolve, normalize } = require("path/posix");

    // Path required after path/posix
    require("path");

    const checkForDoubleWrapping = [join, resolve, normalize];
    for (const fn of checkForDoubleWrapping) {
      if (isWrapped(fn) && isWrapped(fn[originalSymbol])) {
        t.fail(`${fn.name} is double wrapped!`);
      }
    }
  }
);

t.test(
  "it works",
  { skip: !isWindows() ? "path is not the same as path/win32" : false },
  async (t) => {
    const agent = createTestAgent();

    agent.start([new Path()]);

    const { join, resolve, normalize } = require("path/win32");

    // Path required after path/win32
    require("path");

    const checkForDoubleWrapping = [join, resolve, normalize];
    for (const fn of checkForDoubleWrapping) {
      if (isWrapped(fn) && isWrapped(fn[originalSymbol])) {
        t.fail(`${fn.name} is double wrapped!`);
      }
    }
  }
);
