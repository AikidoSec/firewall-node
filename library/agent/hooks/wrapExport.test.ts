import * as t from "tap";
import { wrapExport } from "./wrapExport";
import { LoggerForTesting } from "../logger/LoggerForTesting";
import { Token } from "../api/Token";
import { bindContext } from "../Context";
import { createTestAgent } from "../../helpers/createTestAgent";

const logger = new LoggerForTesting();

createTestAgent({
  logger,
  token: new Token("123"),
});

t.test("Inspect args", async (t) => {
  let executedCallback = false;
  const toWrap = {
    test(input: string) {
      return input;
    },
  };

  wrapExport(
    toWrap,
    "test",
    { name: "test", type: "external" },
    {
      kind: "outgoing_http_op",
      inspectArgs: (args) => {
        executedCallback = true;
        t.same(args, ["input"]);
      },
    }
  );

  t.same(toWrap.test("input"), "input");
  t.ok(executedCallback);
});

t.test("Modify args", async (t) => {
  const toWrap = {
    test(input: string) {
      return input;
    },
  };

  wrapExport(
    toWrap,
    "test",
    { name: "test", type: "external" },
    {
      kind: "outgoing_http_op",
      modifyArgs: (args) => {
        return ["modified"];
      },
    }
  );

  t.same(toWrap.test("input"), "modified");
});

t.test("Modify return value", async (t) => {
  const toWrap = {
    test() {
      return "test";
    },
  };

  wrapExport(
    toWrap,
    "test",
    { name: "test", type: "external" },
    {
      kind: "outgoing_http_op",
      modifyReturnValue: (args) => {
        return "modified";
      },
    }
  );

  t.same(toWrap.test(), "modified");
});

t.test("Combine interceptors", async (t) => {
  const toWrap = {
    test(input: string) {
      return input;
    },
  };

  wrapExport(
    toWrap,
    "test",
    { name: "test", type: "external" },
    {
      kind: "outgoing_http_op",
      inspectArgs: (args) => {
        t.same(args, ["input"]);
      },
      modifyArgs: (args) => {
        return ["modArgs"];
      },
      modifyReturnValue: (args, returnVal) => {
        return returnVal + "modReturn";
      },
    }
  );

  t.same(toWrap.test("input"), "modArgsmodReturn");
});

t.test("Catches error in interceptors", async (t) => {
  const toWrap = {
    test() {
      return "test";
    },
  };

  wrapExport(
    toWrap,
    "test",
    { name: "test", type: "external" },
    {
      kind: "outgoing_http_op",
      inspectArgs: () => {
        throw new Error("Error in interceptor");
      },
      modifyArgs: () => {
        throw new Error("Error in interceptor");
      },
      modifyReturnValue: () => {
        throw new Error("Error in interceptor");
      },
    }
  );

  t.same(toWrap.test(), "test");
  t.match(
    logger.getMessages(),
    /Internal error in module "test" in method "test/
  );
});

t.test("With callback", async (t) => {
  const toWrap = {
    test(input: string, callback: (input: string) => void) {
      callback(input);
    },
  };

  wrapExport(
    toWrap,
    "test",
    { name: "test", type: "external" },
    {
      kind: "outgoing_http_op",
      inspectArgs: (args) => {
        t.same(args, ["input", bindContext(() => {})]);
      },
    }
  );

  toWrap.test("input", () => {});
});

t.test("Wrap non existing method", async (t) => {
  const toWrap = {};

  logger.clear();

  wrapExport(
    toWrap,
    "test123",
    { name: "test", type: "external" },
    {
      kind: "outgoing_http_op",
      inspectArgs: () => {},
    }
  );

  t.match(logger.getMessages(), [
    "Failed to wrap method test123 in module test: no original function test123 to wrap",
  ]);
});

t.test("Wrap default export", async (t) => {
  let executedCallback = false;
  const toWrap = (input: string) => {
    return input;
  };

  const patched = wrapExport(
    toWrap,
    undefined,
    { name: "test", type: "external" },
    {
      kind: "outgoing_http_op",
      inspectArgs: (args) => {
        executedCallback = true;
        t.same(args, ["input"]);
      },
    }
  ) as Function;

  t.same(patched("input"), "input");
  t.ok(executedCallback);
});
