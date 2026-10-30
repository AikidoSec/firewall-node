import * as mod from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as t from "tap";
import { createTestAgent } from "../../../helpers/createTestAgent";
import { wrap } from "../../../helpers/wrap";
import { Fastify } from "../../../sources/Fastify";
import { applyHooks } from "../../applyHooks";
import { Hooks } from "../Hooks";
import { onModuleLoad } from "./loadHook";

const fastifyPath = join(__dirname, "../../../node_modules/fastify/fastify.js");
const fastifyUrl = pathToFileURL(fastifyPath).href;
const fastifySource = readFileSync(fastifyPath, "utf-8");

function setup() {
  const agent = createTestAgent();
  const failedToWrap: string[] = [];
  wrap(agent, "onFailedToWrapModule", function onFailedToWrapModule() {
    return function onFailedToWrapModule(path: string) {
      failedToWrap.push(path);
    };
  });

  const hooks = new Hooks();
  new Fastify().wrap(hooks);
  applyHooks(hooks, true);

  return { failedToWrap };
}

function getSource(result: ReturnType<typeof onModuleLoad>): string {
  if (typeof result.source !== "string") {
    throw new Error("Expected the source to be a string");
  }
  return result.source;
}

const skip = !("registerHooks" in mod)
  ? "Recent Node.js version required"
  : false;

t.test("it instruments a string source", { skip }, async (t) => {
  const { failedToWrap } = setup();

  const result = onModuleLoad(fastifyUrl, undefined as any, {
    format: "commonjs",
    shortCircuit: undefined,
    source: fastifySource,
  });

  const source = getSource(result);
  t.match(source, "__instrumentModifyArgs");
  t.match(source, "module.exports = fastify");
  t.same(failedToWrap, []);
});

t.test("it instruments a buffer source", { skip }, async (t) => {
  const { failedToWrap } = setup();

  const result = onModuleLoad(fastifyUrl, undefined as any, {
    format: "commonjs",
    shortCircuit: undefined,
    source: new TextEncoder().encode(fastifySource),
  });

  const source = getSource(result);
  t.match(source, "__instrumentModifyArgs");
  t.match(source, "module.exports = fastify");
  t.same(failedToWrap, []);
});

for (const emptySource of [null, undefined]) {
  t.test(
    `it reads the file from disk if the source is ${emptySource}`,
    { skip },
    async (t) => {
      const { failedToWrap } = setup();

      const result = onModuleLoad(fastifyUrl, undefined as any, {
        format: "commonjs",
        shortCircuit: undefined,
        source: emptySource as any,
      });

      const source = getSource(result);
      t.match(source, "__instrumentModifyArgs");

      t.match(source, "module.exports = fastify");
      t.match(source, "module.exports.default = fastify");
      t.same(failedToWrap, []);
    }
  );
}

t.test(
  "it does not transform if decoding the source fails",
  { skip },
  async (t) => {
    const { failedToWrap } = setup();

    const previousLoadResult = {
      format: "commonjs",
      shortCircuit: undefined,
      source: 42 as any,
    };
    const result = onModuleLoad(
      fastifyUrl,
      undefined as any,
      previousLoadResult
    );

    t.equal(result, previousLoadResult);
    t.equal(result.source, 42);
    t.same(failedToWrap, [fastifyUrl]);
  }
);

t.test(
  "it does not transform if the source is missing and can not be read",
  { skip },
  async (t) => {
    const { failedToWrap } = setup();

    const previousLoadResult = {
      format: "commonjs",
      shortCircuit: undefined,
      source: null as any,
    };
    const result = onModuleLoad(
      fastifyPath,
      undefined as any,
      previousLoadResult
    );

    t.equal(result, previousLoadResult);
    t.equal(result.source, null);
    t.same(failedToWrap, [fastifyPath]);
  }
);
