import * as t from "tap";
import { getInternalDispatcherOptions } from "./getInternalDispatcherOptions";

async function getUndiciAgentForNodeVersion() {
  const bundledUndiciMajorVersion = process.versions.undici?.split(".")[0];

  if (!bundledUndiciMajorVersion) {
    throw new Error("Undici is not available in this Node.js version");
  }

  const undici = await import(`undici-v${bundledUndiciMajorVersion}`);

  return undici.Agent;
}

t.test(
  "finds the internal options on a real undici Agent",
  { skip: !global.fetch ? "fetch is not available" : false },
  async (t) => {
    const UndiciAgent = await getUndiciAgentForNodeVersion();
    const dispatcher = new UndiciAgent();

    const options = getInternalDispatcherOptions(dispatcher);

    t.ok(options, "found internal options");
  }
);

t.test(
  "returns the connect option that was passed in",
  { skip: !global.fetch ? "fetch is not available" : false },
  async (t) => {
    const lookup = () => {};
    const UndiciAgent = await getUndiciAgentForNodeVersion();

    const dispatcher = new UndiciAgent({ connect: { lookup } });

    const options = getInternalDispatcherOptions(dispatcher) as {
      connect?: { lookup?: unknown };
    };

    t.equal(options.connect?.lookup, lookup);
  }
);

t.test(
  "returns undefined when there is no options symbol",
  { skip: !global.fetch ? "fetch is not available" : false },
  async (t) => {
    const instance = {};

    t.same(getInternalDispatcherOptions(instance), undefined);
  }
);

t.test("ignores unrelated symbols", async (t) => {
  const instance = {
    [Symbol("not-options")]: { connect: {} },
  };

  t.same(getInternalDispatcherOptions(instance), undefined);
});

t.test(
  "finds an options symbol regardless of enumerability",
  { skip: !global.fetch ? "fetch is not available" : false },
  async (t) => {
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
  }
);
