import * as t from "tap";
import { checkContextForSensitiveFileAccess } from "./checkContextForSensitiveFile";

t.test("it detects sensitive file access", async (t) => {
  t.same(
    checkContextForSensitiveFileAccess({
      filename: "/app/data/static/.env",
      operation: "operation",
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "/static/.env",
        query: {},
        body: {},
        routeParams: {},
        source: "express",
        route: "",
      },
    }),
    {
      operation: "operation",
      kind: "sensitive_file_access",
      source: "url",
      pathsToPayload: ["."],
      metadata: {
        filename: "/app/data/static/.env",
      },
      payload: "/static/.env",
    }
  );
});

t.test("it detects sensitive file access", async (t) => {
  t.same(
    checkContextForSensitiveFileAccess({
      filename: "/app/data/static/.aws/keys.conf",
      operation: "operation",
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "/static/.aws/keys.conf?test=1",
        query: {},
        body: {},
        routeParams: {},
        source: "express",
        route: "",
      },
    }),
    {
      operation: "operation",
      kind: "sensitive_file_access",
      source: "url",
      pathsToPayload: ["."],
      metadata: {
        filename: "/app/data/static/.aws/keys.conf",
      },
      payload: "/static/.aws/keys.conf",
    }
  );
});

t.test("no sensitive file access", async (t) => {
  t.same(
    checkContextForSensitiveFileAccess({
      filename: "/app/data/static/test.txt",
      operation: "operation",
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "/static/test.txt",
        query: {},
        body: {},
        routeParams: {},
        source: "express",
        route: "",
      },
    }),
    undefined
  );
});

t.test("it detects sensitive file with double slash", async (t) => {
  t.same(
    checkContextForSensitiveFileAccess({
      filename: "/app/data/static/.aws/keys.conf",
      operation: "operation",
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "/static/.aws//keys.conf",
        query: {},
        body: {},
        routeParams: {},
        source: "express",
        route: "",
      },
    }),
    {
      operation: "operation",
      kind: "sensitive_file_access",
      source: "url",
      pathsToPayload: ["."],
      metadata: {
        filename: "/app/data/static/.aws/keys.conf",
      },
      payload: "/static/.aws//keys.conf",
    }
  );
});
