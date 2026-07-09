import * as t from "tap";
import { Agent as UndiciAgent } from "undici-v8";
import { getInternalDispatcherOptions } from "./getInternalDispatcherOptions";

t.test("finds the internal options on a real undici Agent", async (t) => {
  const dispatcher = new UndiciAgent();

  const options = getInternalDispatcherOptions(dispatcher);

  t.ok(options, "found internal options");
});

t.test("returns the connect option that was passed in", async (t) => {
  const lookup = () => {};
  const dispatcher = new UndiciAgent({ connect: { lookup } });

  const options = getInternalDispatcherOptions(dispatcher) as {
    connect?: { lookup?: unknown };
  };

  t.equal(options.connect?.lookup, lookup);
});

t.test("returns undefined when there is no options symbol", async (t) => {
  const instance = {};

  t.same(getInternalDispatcherOptions(instance), undefined);
});

t.test("ignores unrelated symbols", async (t) => {
  const instance = {
    [Symbol("not-options")]: { connect: {} },
  };

  t.same(getInternalDispatcherOptions(instance), undefined);
});

t.test("finds an options symbol regardless of enumerability", async (t) => {
  const optionsSymbol = Symbol("options");
  const connect = { lookup: () => {} };
  const instance = {};
  Object.defineProperty(instance, optionsSymbol, {
    value: { connect },
    enumerable: false,
  });

  const options = getInternalDispatcherOptions(instance) as {
    connect?: unknown;
  };

  t.equal(options.connect, connect);
});
