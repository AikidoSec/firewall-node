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
        filename: new URL("\u0014file:///test/../file/test.txt"),
        operation: "operation",
        context: {
          cookies: {},
          headers: {},
          remoteAddress: "ip",
          method: "POST",
          url: "url",
          query: {
            file: "\u0014file:///test/../file/test.txt",
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
        payload: "\u0014file:///test/../file/test.txt",
      }
    );

    t.same(
      checkContextForPathTraversal({
        filename: new URL("\u0015\u0015file:///test/../file/test.txt"),
        operation: "operation",
        context: {
          cookies: {},
          headers: {},
          remoteAddress: "ip",
          method: "POST",
          url: "url",
          query: {
            file: "\u0015\u0015file:///test/../file/test.txt",
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
        payload: "\u0015\u0015file:///test/../file/test.txt",
      }
    );

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

    t.same(
      checkContextForPathTraversal({
        filename: new URL(" file:///test/../file/test.txt"),
        operation: "operation",
        context: {
          cookies: {},
          headers: {},
          remoteAddress: "ip",
          method: "POST",
          url: "url",
          query: {
            file: " file:///test/../file/test.txt",
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
        payload: " file:///test/../file/test.txt",
      }
    );

    t.same(
      checkContextForPathTraversal({
        filename: new URL("\tfile:///test/../file/test.txt"),
        operation: "operation",
        context: {
          cookies: {},
          headers: {},
          remoteAddress: "ip",
          method: "POST",
          url: "url",
          query: {
            file: "\tfile:///test/../file/test.txt",
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
        payload: "\tfile:///test/../file/test.txt",
      }
    );
  }
);

t.test(
  "it detects path traversal using percent-encoded dot segments",
  async (t) => {
    const payloads = ["%2e%2e", ".%2e", "%2e.", "%2E%2E"];

    for (const dotSegment of payloads) {
      const payload = `${dotSegment}/etc/passwd`;
      t.same(
        checkContextForPathTraversal({
          filename: new URL(payload, "file:///var/www/uploads/"),
          operation: "operation",
          context: {
            cookies: {},
            headers: {},
            remoteAddress: "ip",
            method: "POST",
            url: "url",
            query: {
              file: payload,
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
            filename: "/var/www/etc/passwd",
          },
          payload: payload,
        },
        `payload: ${payload}`
      );
    }
  }
);

t.test(
  "it does not flag a segment that only looks like a dot segment",
  async () => {
    t.same(
      checkContextForPathTraversal({
        filename: new URL(
          "%2e%2e-backup/etc/passwd",
          "file:///var/www/uploads/"
        ),
        operation: "operation",
        context: {
          cookies: {},
          headers: {},
          remoteAddress: "ip",
          method: "POST",
          url: "url",
          query: {
            file: "%2e%2e-backup/etc/passwd",
          },
          body: {},
          routeParams: {},
          source: "express",
          route: undefined,
        },
      }),
      undefined
    );
  }
);

t.test(
  "it detects path traversal with encoded dot-segments and encoded target (pentest bypass scenario)",
  async (t) => {
    // This is the exact scenario from the pentest finding:
    // new URL("file:///public/%2e%2e/%65tc/passwd") normalizes to pathname "/%65tc/passwd"
    // The %2e%2e has been resolved by WHATWG URL parsing (moving up from /public/),
    // but %65 (which is 'e') remains encoded in pathname.
    // fileURLToPath() decodes it to "/etc/passwd", which is outside the intended directory.
    // The fix ensures we use fileURLToPath() in pathToString() so the detector sees
    // the actual path that will be accessed.
    
    const url = new URL("file:///public/%2e%2e/%65tc/passwd");
    
    // Verify the URL normalization behavior described in the pentest
    t.equal(url.pathname, "/%65tc/passwd", "URL.pathname has resolved %2e%2e but kept %65 encoded");
    
    // Now test that our detector catches this traversal
    const result = checkContextForPathTraversal({
      filename: url,
      operation: "fs.readFile",
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "url",
        query: {
          file: "file:///public/%2e%2e/%65tc/passwd",
        },
        body: {},
        routeParams: {},
        source: "express",
        route: undefined,
      },
    });
    
    t.same(result, {
      operation: "fs.readFile",
      kind: "path_traversal",
      source: "query",
      metadata: { filename: "/etc/passwd" },
    });
  }
);

t.test(
  "it detects path traversal with multiple encoded dot-segments and encoded target",
  async (t) => {
    // Test with multiple traversal segments
    const url = new URL("file:///var/www/public/%2e%2e/%2e%2e/%65tc/passwd");
    
    const result = checkContextForPathTraversal({
      filename: url,
      operation: "fs.readFile",
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "url",
        query: {
          file: "file:///var/www/public/%2e%2e/%2e%2e/%65tc/passwd",
        },
        body: {},
        routeParams: {},
        source: "express",
        route: undefined,
      },
    });
    
    t.same(result, {
      operation: "fs.readFile",
      kind: "path_traversal",
      metadata: { filename: "/var/etc/passwd" },
    });
  }
);

t.test(
  "it detects path traversal with mixed case encoded dot-segments",
  async (t) => {
    // Test with uppercase hex encoding
    const url = new URL("file:///public/%2E%2E/%65tc/passwd");
    
    const result = checkContextForPathTraversal({
      filename: url,
      operation: "fs.readFile",
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "url",
        query: {
          file: "file:///public/%2E%2E/%65tc/passwd",
        },
        body: {},
        routeParams: {},
        source: "express",
        route: undefined,
      },
    });
    
    t.same(result?.kind, "path_traversal", "Should be detected as path_traversal");
  }
);

t.test(
  "it detects path traversal with partially encoded dot-segments and encoded target",
  async (t) => {
    // Test .%2e variant
    const url1 = new URL("file:///public/.%2e/%65tc/passwd");
    
    const result1 = checkContextForPathTraversal({
      filename: url1,
      operation: "fs.readFile",
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "url",
        query: {
          file: "file:///public/.%2e/%65tc/passwd",
        },
        body: {},
        routeParams: {},
        source: "express",
        route: undefined,
      },
    });
    
    t.same(result1?.kind, "path_traversal", "Should be detected as path_traversal");
    
    // Test %2e. variant
    const url2 = new URL("file:///public/%2e./%65tc/passwd");
    
    const result2 = checkContextForPathTraversal({
      filename: url2,
      operation: "fs.readFile",
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "url",
        query: {
          file: "file:///public/%2e./%65tc/passwd",
        },
        body: {},
        routeParams: {},
        source: "express",
        route: undefined,
      },
    });
    
    t.same(result2?.kind, "path_traversal", "Should be detected as path_traversal");
  }
);

t.test(
  "it detects path traversal with fully encoded target path components",
  async (t) => {
    // Test where the entire target path is encoded
    const url = new URL("file:///uploads/%2e%2e/%2565%2574%2563/%2570%2561%2573%2573%2577%2564");
    
    const result = checkContextForPathTraversal({
      filename: url,
      operation: "fs.readFile",
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "url",
        query: {
          file: "file:///uploads/%2e%2e/%2565%2574%2563/%2570%2561%2573%2573%2577%2564",
        },
        body: {},
        routeParams: {},
        source: "express",
        route: undefined,
      },
    });
    
    t.same(result?.kind, "path_traversal", "Should be detected as path_traversal");
  }
);

t.test(
  "it detects path traversal when encoded traversal bypasses literal check",
  async (t) => {
    // This test verifies that the fix prevents the bypass where:
    // 1. URL.pathname no longer contains %2e%2e (it was resolved)
    // 2. URL.pathname doesn't contain literal ../ (it was resolved)
    // 3. But the actual filesystem path accessed is outside the intended directory
    
    const url = new URL("file:///var/www/html/%2e%2e/%2e%2e/%2e%2e/etc/shadow");
    
    // Verify URL.pathname doesn't contain the traversal markers
    t.notOk(url.pathname.includes(".."), "pathname should not contain literal ..");
    t.notOk(url.pathname.includes("%2e%2e"), "pathname should not contain %2e%2e");
    
    const result = checkContextForPathTraversal({
      filename: url,
      operation: "fs.readFile",
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "url",
        query: {
          file: "file:///var/www/html/%2e%2e/%2e%2e/%2e%2e/etc/shadow",
        },
        body: {},
        routeParams: {},
        source: "express",
        route: undefined,
      },
    });
    
    t.same(result, {
      operation: "fs.readFile",
      kind: "path_traversal",
      source: "query",
    });
  }
);
