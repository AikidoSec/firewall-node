// oxlint-disable no-console
import * as t from "tap";
import { warnIfUsingTurbopackWithOldSystem } from "./warnIfUsingTurbopackWithOldSystem";

const originalEnv = {
  TURBOPACK: process.env.TURBOPACK,
  __NEXT_PRIVATE_STANDALONE_CONFIG:
    process.env.__NEXT_PRIVATE_STANDALONE_CONFIG,
};

t.beforeEach(() => {
  delete process.env.TURBOPACK;
  delete process.env.__NEXT_PRIVATE_STANDALONE_CONFIG;
});

t.afterEach(() => {
  process.env.TURBOPACK = originalEnv.TURBOPACK;
  process.env.__NEXT_PRIVATE_STANDALONE_CONFIG =
    originalEnv.__NEXT_PRIVATE_STANDALONE_CONFIG;
});

t.test("it warns when TURBOPACK env variable is set", async (t) => {
  process.env.TURBOPACK = "1";

  const warnings: unknown[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);

  warnIfUsingTurbopackWithOldSystem();

  await new Promise<void>((resolve) => setImmediate(resolve));

  console.warn = originalWarn;
  t.equal(warnings.length, 1);
  t.match(String(warnings[0]), /Zen might not be protecting your application/);
});

t.test(
  "it warns when __NEXT_PRIVATE_STANDALONE_CONFIG has turbopack key",
  async (t) => {
    process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify({
      turbopack: { root: "/app" },
    });

    const warnings: unknown[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args);

    warnIfUsingTurbopackWithOldSystem();

    await new Promise<void>((resolve) => setImmediate(resolve));

    console.warn = originalWarn;
    t.equal(warnings.length, 1);
    t.match(
      String(warnings[0]),
      /Zen might not be protecting your application/
    );
  }
);

t.test("it does not warn when Turbopack is not detected", async (t) => {
  const warnings: unknown[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);

  warnIfUsingTurbopackWithOldSystem();

  await new Promise<void>((resolve) => setImmediate(resolve));

  console.warn = originalWarn;
  t.equal(warnings.length, 0);
});

t.test("it catches errors thrown inside setImmediate", async (t) => {
  process.env.TURBOPACK = "1";

  const originalWarn = console.warn;
  console.warn = () => {
    throw new Error("console.warn exploded");
  };

  warnIfUsingTurbopackWithOldSystem();

  await new Promise<void>((resolve) => setImmediate(resolve));

  console.warn = originalWarn;
  t.pass("no uncaught error");
});
