import * as t from "tap";
import { checkContextForPathTraversal } from "./checkContextForPathTraversal";

const unsafeContext = {
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
    route: undefined,
  },
};

t.test("it detects path traversal from route parameter", async () => {
  t.same(checkContextForPathTraversal(unsafeContext), {
    operation: "operation",
    kind: "path_traversal",
    source: "routeParams",
    pathsToPayload: [".path"],
    metadata: {
      filename: "../file/test.txt",
    },
    payload: "../file",
  });
});

t.test("it does not flag safe operation", async () => {
  t.same(
    checkContextForPathTraversal({
      filename: "../../web/spec-extension/cookies",
      operation: "path.normalize",
      context: {
        url: "/_next/static/RjAvHy_jB1ciRT_xBrSyI/_ssgManifest.js",
        method: "GET",
        headers: {
          host: "localhost:3000",
          connection: "keep-alive",
          pragma: "no-cache",
          "cache-control": "no-cache",
          "sec-ch-ua":
            '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          "sec-ch-ua-mobile": "?0",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "sec-ch-ua-platform": '"macOS"',
          accept: "*/*",
          "sec-fetch-site": "same-origin",
          "sec-fetch-mode": "no-cors",
          "sec-fetch-dest": "script",
          referer: "http://localhost:3000/",
          "accept-encoding": "gzip, deflate, br, zstd",
          "accept-language": "nl,en;q=0.9,en-US;q=0.8",
          cookie: "Phpstorm-8262f4a6=6a1925f9-2f0e-45ea-8336-a6988d56b1aa",
          "x-forwarded-host": "localhost:3000",
          "x-forwarded-port": "3000",
          "x-forwarded-proto": "http",
          "x-forwarded-for": "127.0.0.1",
        },
        route: undefined,
        query: {},
        source: "http.createServer",
        routeParams: {},
        cookies: {
          "Phpstorm-8262f4a6": "6a1925f9-2f0e-45ea-8336-a6988d56b1aa",
        },
        body: undefined,
        remoteAddress: "127.0.0.1",
      },
    }),
    undefined
  );
});

t.test("it detects path traversal with URL", async () => {
  t.same(
    checkContextForPathTraversal({
      ...unsafeContext,
      filename: new URL("file:///../file/test.txt"),
    }),
    {
      operation: "operation",
      kind: "path_traversal",
      source: "routeParams",
      pathsToPayload: [".path"],
      metadata: {
        filename: "/file/test.txt",
      },
      payload: "../file",
    }
  );
});

t.test("it detects path traversal with Buffer", async () => {
  t.same(
    checkContextForPathTraversal({
      ...unsafeContext,
      filename: Buffer.from("../file/test.txt"),
    }),
    {
      operation: "operation",
      kind: "path_traversal",
      source: "routeParams",
      pathsToPayload: [".path"],
      metadata: {
        filename: "../file/test.txt",
      },
      payload: "../file",
    }
  );
});

t.test("it ignores non utf-8 Buffer", async () => {
  t.same(
    checkContextForPathTraversal({
      ...unsafeContext,
      filename: Buffer.from([0x80, 0x81, 0x82, 0x83]),
    }),
    undefined
  );
});

t.test("it ignores invalid filename type", async () => {
  t.same(
    checkContextForPathTraversal({
      ...unsafeContext,
      // @ts-expect-error Testing invalid type
      filename: new Date(),
    }),
    undefined
  );
});

t.test("it works with control characters removed by new URL", async (t) => {
  const queries = [".\t./etc/passwd", ".\n./etc/passwd", ".\r./etc/passwd"];

  for (const query of queries) {
    t.same(
      checkContextForPathTraversal({
        filename: new URL(`file:///test/${query}`),
        operation: "operation",
        context: {
          cookies: {},
          headers: {},
          remoteAddress: "ip",
          method: "POST",
          url: "url",
          query: {
            q: query,
          },
          body: {},
          routeParams: {},
          source: "express",
          route: undefined,
        },
      }),
      {
        operation: "operation",
        kind: "path_traversal",
        source: "query",
        pathsToPayload: [".q"],
        metadata: {
          filename: "/etc/passwd",
        },
        payload: query,
      }
    );
  }
});

t.test("it detects path traversal with non lowercase URL scheme", async () => {
  t.same(
    checkContextForPathTraversal({
      filename: new URL("filE:///../file/test.txt"),
      operation: "operation",
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "url",
        query: {
          file: "filE:///../file/test.txt",
        },
        body: {},
        routeParams: {},
        source: "express",
        route: undefined,
      },
    }),
    {
      operation: "operation",
      kind: "path_traversal",
      source: "query",
      pathsToPayload: [".file"],
      metadata: {
        filename: "/file/test.txt",
      },
      payload: "filE:///../file/test.txt",
    }
  );

  t.same(
    checkContextForPathTraversal({
      filename: new URL("filE:///test/../file/test.txt"),
      operation: "operation",
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "url",
        query: {
          file: "filE:///test/../file/test.txt",
        },
        body: {},
        routeParams: {},
        source: "express",
        route: undefined,
      },
    }),
    {
      operation: "operation",
      kind: "path_traversal",
      source: "query",
      pathsToPayload: [".file"],
      metadata: {
        filename: "/file/test.txt",
      },
      payload: "filE:///test/../file/test.txt",
    }
  );

  t.same(
    checkContextForPathTraversal({
      filename: new URL("filE:///test/../file/test.txt"),
      operation: "operation",
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "url",
        query: {
          file: "filE:///test/../file/test.txt",
        },
        body: {},
        routeParams: {},
        source: "express",
        route: undefined,
      },
    }),
    {
      operation: "operation",
      kind: "path_traversal",
      source: "query",
      pathsToPayload: [".file"],
      metadata: {
        filename: "/file/test.txt",
      },
      payload: "filE:///test/../file/test.txt",
    }
  );
  t.same(
    checkContextForPathTraversal({
      filename: new URL("filE:///test/../file/Test.txt"),
      operation: "operation",
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "url",
        query: {
          file: "filE:///test/../file/Test.txt",
        },
        body: {},
        routeParams: {},
        source: "express",
        route: undefined,
      },
    }),
    {
      operation: "operation",
      kind: "path_traversal",
      source: "query",
      pathsToPayload: [".file"],
      metadata: {
        filename: "/file/Test.txt",
      },
      payload: "filE:///test/../file/Test.txt",
    }
  );
});

t.test(
  "it detects path traversal with URL with non printable characters",
  async () => {
    t.same(
      checkContextForPathTraversal({
        filename: new URL("\x14file:///test/../file/test.txt"),
        operation: "operation",
        context: {
          cookies: {},
          headers: {},
          remoteAddress: "ip",
          method: "POST",
          url: "url",
          query: {
            file: "\x14file:///test/../file/test.txt",
          },
          body: {},
          routeParams: {},
          source: "express",
          route: undefined,
        },
      }),
      {
        operation: "operation",
        kind: "path_traversal",
        source: "query",
        pathsToPayload: [".file"],
        metadata: {
          filename: "/file/test.txt",
        },
        payload: "\x14file:///test/../file/test.txt",
      }
    );
  }
);

t.test(
  "it detects path traversal with URL with non printable characters",
  async () => {
    t.same(
      checkContextForPathTraversal({
        filename: new URL("\x15\x15file:///test/../file/test.txt"),
        operation: "operation",
        context: {
          cookies: {},
          headers: {},
          remoteAddress: "ip",
          method: "POST",
          url: "url",
          query: {
            file: "\x15\x15file:///test/../file/test.txt",
          },
          body: {},
          routeParams: {},
          source: "express",
          route: undefined,
        },
      }),
      {
        operation: "operation",
        kind: "path_traversal",
        source: "query",
        pathsToPayload: [".file"],
        metadata: {
          filename: "/file/test.txt",
        },
        payload: "\x15\x15file:///test/../file/test.txt",
      }
    );
  }
);

t.test(
  "it detects path traversal with URL with non printable characters",
  async () => {
    t.same(
      checkContextForPathTraversal({
        filename: new URL("\0file:///test/../file/test.txt"),
        operation: "operation",
        context: {
          cookies: {},
          headers: {},
          remoteAddress: "ip",
          method: "POST",
          url: "url",
          query: {
            file: "\0file:///test/../file/test.txt",
          },
          body: {},
          routeParams: {},
          source: "express",
          route: undefined,
        },
      }),
      {
        operation: "operation",
        kind: "path_traversal",
        source: "query",
        pathsToPayload: [".file"],
        metadata: {
          filename: "/file/test.txt",
        },
        payload: "\0file:///test/../file/test.txt",
      }
    );
  }
);
