import * as t from "tap";
import { cleanupStackTrace } from "./cleanupStackTrace";

t.test("it works", async () => {
  const stack = `
Error
    at Collection.wrap (/Users/hansott/Code/node-RASP/build/agent/applyHooks.js:149:33)
    at Posts.all (/Users/hansott/Code/node-RASP/sample-apps/express-mongodb/posts.js:30:36)
    at /Users/hansott/Code/node-RASP/sample-apps/express-mongodb/app.js:49:41
    at asyncUtilWrap (/Users/hansott/Code/node-RASP/node_modules/express-async-handler/index.js:3:20)
    at /Users/hansott/Code/node-RASP/build/sources/express/wrapRequestHandler.js:22:20
    at runWithContext (/Users/hansott/Code/node-RASP/build/agent/Context.js:34:16)
    at /Users/hansott/Code/node-RASP/build/sources/express/wrapRequestHandler.js:12:45
    at Layer.handle [as handle_request] (/Users/hansott/Code/node-RASP/node_modules/express/lib/router/layer.js:95:5)
    at next (/Users/hansott/Code/node-RASP/node_modules/express/lib/router/route.js:149:13)
    at Route.dispatch (/Users/hansott/Code/node-RASP/node_modules/express/lib/router/route.js:119:3)
`.trim();

  const cleaned = cleanupStackTrace(
    stack,
    "/Users/hansott/Code/node-RASP/build"
  );

  const expected = `
Error
    at Posts.all (/Users/hansott/Code/node-RASP/sample-apps/express-mongodb/posts.js:30:36)
    at /Users/hansott/Code/node-RASP/sample-apps/express-mongodb/app.js:49:41
    at asyncUtilWrap (/Users/hansott/Code/node-RASP/node_modules/express-async-handler/index.js:3:20)
    at Layer.handle [as handle_request] (/Users/hansott/Code/node-RASP/node_modules/express/lib/router/layer.js:95:5)
    at next (/Users/hansott/Code/node-RASP/node_modules/express/lib/router/route.js:149:13)
    at Route.dispatch (/Users/hansott/Code/node-RASP/node_modules/express/lib/router/route.js:119:3)
`.trim();

  t.same(cleaned, expected);
});
