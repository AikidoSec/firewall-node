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

t.test("it works with error on top", async () => {
  const stack = `
/Users/hansott/Code/my-project/server/node_modules/@aikidosec/zen/agent/applyHooks.js:152
                    stack: cleanupStackTrace(new Error().stack!, libraryRoot),
                                             ^

Error
    at wrap (/Users/hansott/Code/my-project/server/node_modules/@aikidosec/zen/agent/applyHooks.js:152:33)
    at HttpClientUndici.send (/Users/hansott/Code/my-project/server/src/HttpClient.ts:166:22)
    at HttpClientTracingElasticsearch.send (/Users/hansott/Code/my-project/server/src/HttpClient.ts:144:36)
    at ElasticsearchClient.getIndex (/Users/hansott/Code/my-project/server/src/domain/Elasticsearch.ts:785:44)
    at IndexPreparer.prepare (/Users/hansott/Code/my-project/server/src/domain/Elasticsearch.ts:514:36)
    at UsersAndActivitiesElasticsearch.getIndex (/Users/hansott/Code/my-project/server/src/domain/UsersAndActivities.ts:1897:26)
    at UsersAndActivitiesElasticsearch.listUsers (/Users/hansott/Code/my-project/server/src/domain/UsersAndActivities.ts:3164:25)
    at processTicksAndRejections (node:internal/process/task_queues:96:5)
    at Object.unifiedUsers (/Users/hansott/Code/my-project/server/src/GraphQL/Mutation.ts:4491:31) /Users/hansott/Code/my-project/server/node_modules/@aikidosec/zen
`.trim();

  const cleaned = cleanupStackTrace(
    stack,
    "/Users/hansott/Code/my-project/server/node_modules/@aikidosec/zen"
  );

  const expected = `
Error
    at HttpClientUndici.send (/Users/hansott/Code/my-project/server/src/HttpClient.ts:166:22)
    at HttpClientTracingElasticsearch.send (/Users/hansott/Code/my-project/server/src/HttpClient.ts:144:36)
    at ElasticsearchClient.getIndex (/Users/hansott/Code/my-project/server/src/domain/Elasticsearch.ts:785:44)
    at IndexPreparer.prepare (/Users/hansott/Code/my-project/server/src/domain/Elasticsearch.ts:514:36)
    at UsersAndActivitiesElasticsearch.getIndex (/Users/hansott/Code/my-project/server/src/domain/UsersAndActivities.ts:1897:26)
    at UsersAndActivitiesElasticsearch.listUsers (/Users/hansott/Code/my-project/server/src/domain/UsersAndActivities.ts:3164:25)
    at processTicksAndRejections (node:internal/process/task_queues:96:5)
    at Object.unifiedUsers (/Users/hansott/Code/my-project/server/src/GraphQL/Mutation.ts:4491:31)
`.trim();

  t.same(cleaned, expected);
});

t.test("it works with error on top with compiled code", async () => {
  const stack = `
/Users/hansott/Code/my-project/server/node_modules/@aikidosec/zen/agent/applyHooks.js:152
                    stack: (0, cleanupStackTrace_1.cleanupStackTrace)(new Error().stack, libraryRoot),
                                                                      ^

Error
    at wrap (/Users/hansott/Code/my-project/server/node_modules/@aikidosec/zen/agent/applyHooks.js:152:33)
    at HttpClientUndici.send (/Users/hansott/Code/my-project/server/src/HttpClient.ts:166:22)
    at HttpClientTracingElasticsearch.send (/Users/hansott/Code/my-project/server/src/HttpClient.ts:144:36)
    at ElasticsearchClient.getIndex (/Users/hansott/Code/my-project/server/src/domain/Elasticsearch.ts:785:44)
    at IndexPreparer.prepare (/Users/hansott/Code/my-project/server/src/domain/Elasticsearch.ts:514:36)
    at UsersAndActivitiesElasticsearch.getIndex (/Users/hansott/Code/my-project/server/src/domain/UsersAndActivities.ts:1897:26)
    at UsersAndActivitiesElasticsearch.listUsers (/Users/hansott/Code/my-project/server/src/domain/UsersAndActivities.ts:3164:25)
    at processTicksAndRejections (node:internal/process/task_queues:96:5)
    at Object.unifiedUsers (/Users/hansott/Code/my-project/server/src/GraphQL/Mutation.ts:4491:31) /Users/hansott/Code/my-project/server/node_modules/@aikidosec/zen
`.trim();

  const cleaned = cleanupStackTrace(
    stack,
    "/Users/hansott/Code/my-project/server/node_modules/@aikidosec/zen"
  );

  const expected = `
Error
    at HttpClientUndici.send (/Users/hansott/Code/my-project/server/src/HttpClient.ts:166:22)
    at HttpClientTracingElasticsearch.send (/Users/hansott/Code/my-project/server/src/HttpClient.ts:144:36)
    at ElasticsearchClient.getIndex (/Users/hansott/Code/my-project/server/src/domain/Elasticsearch.ts:785:44)
    at IndexPreparer.prepare (/Users/hansott/Code/my-project/server/src/domain/Elasticsearch.ts:514:36)
    at UsersAndActivitiesElasticsearch.getIndex (/Users/hansott/Code/my-project/server/src/domain/UsersAndActivities.ts:1897:26)
    at UsersAndActivitiesElasticsearch.listUsers (/Users/hansott/Code/my-project/server/src/domain/UsersAndActivities.ts:3164:25)
    at processTicksAndRejections (node:internal/process/task_queues:96:5)
    at Object.unifiedUsers (/Users/hansott/Code/my-project/server/src/GraphQL/Mutation.ts:4491:31)
`.trim();

  t.same(cleaned, expected);
});

t.test("dns stack trace", async () => {
  const stack = `
Error
    at GetAddrInfoReqWrap.wrappedDNSLookupCallback [as callback] (/var/task/node_modules/@aikidosec/zen/vulnerabilities/ssrf/inspectDNSLookupCalls.js:96:20)
    at GetAddrInfoReqWrap.onlookup [as oncomplete] (node:dns:111:8)
    at GetAddrInfoReqWrap.callbackTrampoline (node:internal/async_hooks:130:17)
  `.trim();

  const cleaned = cleanupStackTrace(
    stack,
    "/var/task/node_modules/@aikidosec/zen"
  );

  const expected = `
Error
    at GetAddrInfoReqWrap.onlookup [as oncomplete] (node:dns:111:8)
    at GetAddrInfoReqWrap.callbackTrampoline (node:internal/async_hooks:130:17)
  `.trim();

  t.same(cleaned, expected);
});
