import * as mod from "node:module";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as t from "tap";
import { createTestAgent } from "../../../helpers/createTestAgent";
import { isNewInstrumentationUnitTest } from "../../../helpers/isNewInstrumentationUnitTest";
import { wrap } from "../../../helpers/wrap";
import { applyHooks } from "../../applyHooks";
import { Hooks } from "../Hooks";

// Node.js refuses to strip types of files inside node_modules, so we can't load TypeScript packages
// natively. TypeScript sources reach our hook e.g. when a TS loader (like tsx) is used
const stripTypes = (mod as { stripTypeScriptTypes?: (code: string) => string })
  .stripTypeScriptTypes;

const skip =
  "registerHooks" in mod &&
  typeof stripTypes === "function" &&
  isNewInstrumentationUnitTest()
    ? false
    : "Recent Node.js version with stripTypeScriptTypes and new instrumentation required";

const testCases = [
  { name: "tscjs", file: "index.ts", format: "commonjs-typescript" },
  { name: "ctscjs", file: "index.cts", format: "commonjs-typescript" },
  { name: "tsesm", file: "index.ts", format: "module-typescript" },
  { name: "mtsesm", file: "index.mts", format: "module-typescript" },
] as const;

const sources = {
  "commonjs-typescript": `
interface Greeting {
  text: string;
}

function greet(name: string): Greeting {
  return { text: "Hello " + name };
}

module.exports = { greet };
`,
  "module-typescript": `
interface Greeting {
  text: string;
}

export function greet(name: string): Greeting {
  return { text: "Hello " + name };
}
`,
};

t.test("it instruments TypeScript modules", { skip }, async (t) => {
  const root = mkdtempSync(join(tmpdir(), "zen-ts-test-"));
  t.teardown(() => rmSync(root, { recursive: true, force: true }));

  const agent = createTestAgent();
  const failedToWrap: string[] = [];
  wrap(agent, "onFailedToWrapModule", function onFailedToWrapModule() {
    return function onFailedToWrapModule(path: string) {
      failedToWrap.push(path);
    };
  });

  const calls: Record<string, unknown[][]> = {};
  const hooks = new Hooks();

  for (const testCase of testCases) {
    const pkgName = `zen-ts-test-${testCase.name}`;
    const pkgDir = join(root, "node_modules", pkgName);
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, "package.json"),
      JSON.stringify({ name: pkgName, version: "1.0.0" })
    );
    writeFileSync(join(pkgDir, testCase.file), sources[testCase.format]);

    calls[testCase.name] = [];
    hooks
      .addPackage(pkgName)
      .withVersion("^1.0.0")
      .addFileInstrumentation({
        path: testCase.file,
        functions: [
          {
            nodeType: "FunctionDeclaration",
            name: "greet",
            operationKind: undefined,
            inspectArgs: (args) => {
              calls[testCase.name].push(args);
            },
          },
        ],
      });
  }

  type LoadHook = Parameters<typeof mod.registerHooks>[0]["load"];
  const isTestFile = (url: string) => url.includes("/zen-ts-test-");

  const tsSourceHook: LoadHook = (url, context, nextLoad) => {
    if (!isTestFile(url)) {
      return nextLoad!(url, context);
    }
    const testCase = testCases.find((c) => url.includes(`-${c.name}/`));
    if (!testCase) {
      throw new Error(`Unexpected test file ${url}`);
    }
    return {
      format: testCase.format,
      source: readFileSync(fileURLToPath(url), "utf-8"),
      shortCircuit: true,
    };
  };
  const tsSourceHandle = mod.registerHooks({ load: tsSourceHook });

  applyHooks(hooks, true);

  const stripTypesHook: LoadHook = (url, context, nextLoad) => {
    const result = nextLoad!(url, context);
    if (!isTestFile(url) || typeof result.source !== "string") {
      return result;
    }
    const isEsm = result.format === "module-typescript";
    // In unit tests the injected functions import is rewritten based on the format "module",
    // which does not match "module-typescript", so use the ESM wrapper for ESM manually.
    const code = isEsm
      ? result.source.replace("injectedFunctions.ts", "injectedFunctions.mjs")
      : result.source;
    const name = testCases.find((c) => url.includes(`-${c.name}/`))!.name;
    seenSources[name] = result.source;
    return {
      ...result,
      format: isEsm ? "module" : "commonjs",
      source: stripTypes!(code),
    };
  };
  const stripTypesHandle = mod.registerHooks({ load: stripTypesHook });
  t.teardown(() => {
    stripTypesHandle.deregister();
    tsSourceHandle.deregister();
  });

  const seenSources: Record<string, string> = {};

  for (const testCase of testCases) {
    const pkgDir = join(root, "node_modules", `zen-ts-test-${testCase.name}`);
    const tsPath = join(pkgDir, testCase.file);

    const isEsm = testCase.format === "module-typescript";
    const greet: (name: string) => { text: string } = isEsm
      ? (await import(tsPath)).greet
      : mod.createRequire(join(root, "index.js"))(tsPath).greet;

    t.match(seenSources[testCase.name], "__instrumentInspectArgs");
    t.match(seenSources[testCase.name], "interface Greeting");

    t.same(greet("Zen"), { text: "Hello Zen" });
    t.same(calls[testCase.name], [["Zen"]]);
  }

  t.same(failedToWrap, []);
});
