import * as t from "tap";
import { checkContextForPathTraversal } from "./checkContextForPathTraversal";

t.test("it detects path traversal from route parameter", async () => {
  t.same(
    checkContextForPathTraversal({
      filename: "../file/test.txt",
      operation: "operation",
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "url",
        query: {},
        body: {},
        routeParams: {
          path: "../file",
        },
        source: "express",
      },
    }),
    {
      operation: "operation",
      kind: "path_traversal",
      source: "routeParams",
      pathToPayload: ".path",
      metadata: {},
      payload: "../file",
    }
  );
});
