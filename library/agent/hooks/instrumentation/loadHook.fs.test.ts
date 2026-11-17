import * as mod from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as t from "tap";
import { createTestAgent } from "../../../helpers/createTestAgent";
import { isNewInstrumentationUnitTest } from "../../../helpers/isNewInstrumentationUnitTest";
import { wrap } from "../../../helpers/wrap";
import { FileSystem } from "../../../sinks/FileSystem";
import { Fastify } from "../../../sources/Fastify";
import { type Context, runWithContext } from "../../Context";
import { registerNodeHooks } from "./index";
import { onModuleLoad } from "./loadHook";

const fastifyPath = join(__dirname, "../../../node_modules/fastify/fastify.js");
const fastifyUrl = pathToFileURL(fastifyPath).href;

const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: { file: fastifyPath },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test(
  "reading the source of a module does not trigger the path traversal detection",
  {
    skip:
      !("registerHooks" in mod) || !isNewInstrumentationUnitTest()
        ? "Recent Node.js version and new instrumentation required"
        : false,
  },
  async (t) => {
    const agent = createTestAgent({ block: true });
    const failedToWrap: string[] = [];
    wrap(agent, "onFailedToWrapModule", function onFailedToWrapModule() {
      return function onFailedToWrapModule(path: string) {
        failedToWrap.push(path);
      };
    });

    agent.start([new FileSystem(), new Fastify()]);
    registerNodeHooks();

    const fs = require("fs") as typeof import("fs");
    runWithContext(context, () => {
      let error: unknown;
      try {
        fs.readFileSync(fastifyPath);
      } catch (e) {
        error = e;
      }
      t.match(String(error), /Zen has blocked a path traversal attack/);
    });

    const result = runWithContext(context, () =>
      onModuleLoad(fastifyUrl, undefined as any, {
        format: "commonjs",
        shortCircuit: undefined,
        source: null as any,
      })
    );

    t.same(failedToWrap, []);
    t.equal(typeof result.source, "string");
    t.match(result.source, "__instrumentModifyArgs");
    t.match(result.source, "module.exports = fastify");
  }
);
