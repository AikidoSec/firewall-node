import * as t from "tap";
import { wrapExport } from "./wrapExport";
import { LoggerForTesting } from "../logger/LoggerForTesting";
import { Token } from "../api/Token";
import { bindContext } from "../Context";
import { createTestAgent } from "../../helpers/createTestAgent";

t.test("Agent is not initialized", async (t) => {
  try {
    wrapExport(
      {},
      "test",
      { name: "test", type: "external" },
      {
        inspectArgs: () => {},
      },
      "outgoing_http"
    );
    t.fail();
  } catch (e: unknown) {
    t.ok(e instanceof Error);
    if (e instanceof Error) {
      t.same(e.message, "Can not wrap exports if agent is not initialized");
    }
  }
});

const logger = new LoggerForTesting();

createTestAgent({
  logger,
  token: new Token("123"),
});

t.test("Inspect args", async (t) => {
  t.plan(2);
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
      inspectArgs: (args) => {
        t.same(args, ["input"]);
      },
    },
    "outgoing_http"
  );

  t.same(toWrap.test("input"), "input");
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
      modifyArgs: (args) => {
        return ["modified"];
      },
    },
    "outgoing_http"
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
      modifyReturnValue: (args) => {
        return "modified";
      },
    },
    "outgoing_http"
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
      inspectArgs: (args) => {
        t.same(args, ["input"]);
      },
      modifyArgs: (args) => {
        return ["modArgs"];
      },
      modifyReturnValue: (args, returnVal) => {
        return returnVal + "modReturn";
      },
    },
    "outgoing_http"
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
      inspectArgs: () => {
        throw new Error("Error in interceptor");
      },
      modifyArgs: () => {
        throw new Error("Error in interceptor");
      },
      modifyReturnValue: () => {
        throw new Error("Error in interceptor");
      },
    },
    "outgoing_http"
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
      inspectArgs: (args) => {
        t.same(args, ["input", bindContext(() => {})]);
      },
    },
    "outgoing_http"
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
      inspectArgs: () => {},
    },
    "outgoing_http"
  );

  t.match(logger.getMessages(), [
    "Failed to wrap method test123 in module test",
  ]);
});

t.test("Wrap default export", async (t) => {
  t.plan(2);
  const toWrap = (input: string) => {
    return input;
  };

  const patched = wrapExport(
    toWrap,
    undefined,
    { name: "test", type: "external" },
    {
      inspectArgs: (args) => {
        t.same(args, ["input"]);
      },
    },
    "outgoing_http"
  ) as Function;

  t.same(patched("input"), "input");
});
