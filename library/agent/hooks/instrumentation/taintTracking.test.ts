import * as t from "tap";
import { Context, runWithContext } from "../../Context";
import { __zen_wrapMethodCallResult } from "./taintTracking";
import { extractStringsFromUserInputCached } from "../../../helpers/extractStringsFromUserInputCached";
import { getSourceForUserString } from "../../../helpers/getSourceForUserString";
import { checkContextForSqlInjection } from "../../../vulnerabilities/sql-injection/checkContextForSqlInjection";
import { SQLDialectMySQL } from "../../../vulnerabilities/sql-injection/dialects/SQLDialectMySQL";

function createContext(overrides?: Partial<Context>): Context {
  return {
    remoteAddress: "::1",
    method: "GET",
    url: "http://localhost",
    query: {},
    headers: {},
    body: undefined,
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/test",
    ...overrides,
  };
}

t.test("it returns the result without context", async (t) => {
  // No context — hook should still execute the method and return the result
  const result = __zen_wrapMethodCallResult("hello", (s) =>
    (s as string).toUpperCase()
  );
  t.same(result, "HELLO");
});

t.test("it returns the result when subject is not user input", async (t) => {
  const context = createContext({ query: { name: "john" } });

  runWithContext(context, () => {
    const result = __zen_wrapMethodCallResult("not-user-input", (s) =>
      (s as string).toUpperCase()
    );
    t.same(result, "NOT-USER-INPUT");

    // Should NOT be tracked
    const cache = extractStringsFromUserInputCached(context);
    t.notOk(cache.has("NOT-USER-INPUT"));
  });
});

t.test("it tracks transformed value when subject is user input", async (t) => {
  const context = createContext({ query: { name: "hello" } });

  runWithContext(context, () => {
    const result = __zen_wrapMethodCallResult("hello", (s) =>
      (s as string).toUpperCase()
    );
    t.same(result, "HELLO");

    // Transformed value should be in the cache
    const cache = extractStringsFromUserInputCached(context);
    t.ok(cache.has("HELLO"));

    // Source attribution should trace back to query
    t.same(getSourceForUserString(context, "HELLO"), "query");
  });
});

t.test("it tracks through a chain of transformations", async (t) => {
  const context = createContext({ query: { name: "  Hello  " } });

  runWithContext(context, () => {
    // Simulate: name.trim().toLowerCase()
    const trimmed = __zen_wrapMethodCallResult("  Hello  ", (s) =>
      (s as string).trim()
    );
    t.same(trimmed, "Hello");

    const lowered = __zen_wrapMethodCallResult(trimmed, (s) =>
      (s as string).toLowerCase()
    );
    t.same(lowered, "hello");

    // Both intermediate and final values should be tracked
    const cache = extractStringsFromUserInputCached(context);
    t.ok(cache.has("Hello"));
    t.ok(cache.has("hello"));

    // Source attribution traces back to query for all
    t.same(getSourceForUserString(context, "Hello"), "query");
    t.same(getSourceForUserString(context, "hello"), "query");

    // Original payload is preserved through the chain
    t.same(context.taintTracking?.get("Hello")?.payload, "  Hello  ");
    t.same(context.taintTracking?.get("hello")?.payload, "  Hello  ");
  });
});

t.test("it tracks split results (string → array)", async (t) => {
  const context = createContext({ query: { csv: "a,b,c" } });

  runWithContext(context, () => {
    const parts = __zen_wrapMethodCallResult("a,b,c", (s) =>
      (s as string).split(",")
    );
    t.same(parts, ["a", "b", "c"]);

    // Each array element should be tracked
    const cache = extractStringsFromUserInputCached(context);
    t.ok(cache.has("a"));
    t.ok(cache.has("b"));
    t.ok(cache.has("c"));
  });
});

t.test(
  "it tracks array.reverse().join() chain (split-reverse-join)",
  async (t) => {
    const context = createContext({ query: { name: "hello" } });

    runWithContext(context, () => {
      // Simulate: name.split('').reverse().join('')
      const chars = __zen_wrapMethodCallResult("hello", (s) =>
        (s as string).split("")
      ) as string[];

      const reversed = __zen_wrapMethodCallResult(chars, (a) =>
        [...(a as string[])].reverse()
      ) as string[];

      const joined = __zen_wrapMethodCallResult(reversed, (a) =>
        (a as string[]).join("")
      );

      t.same(joined, "olleh");

      // Final reversed string should be tracked
      const cache = extractStringsFromUserInputCached(context);
      t.ok(cache.has("olleh"));

      // Source attribution traces back to query
      t.same(getSourceForUserString(context, "olleh"), "query");
    });
  }
);

t.test("it tracks replace transformations", async (t) => {
  const context = createContext({
    query: { name: "O'Brien" },
  });

  runWithContext(context, () => {
    const escaped = __zen_wrapMethodCallResult("O'Brien", (s) =>
      (s as string).replace("'", "\\'")
    );
    t.same(escaped, "O\\'Brien");

    const cache = extractStringsFromUserInputCached(context);
    t.ok(cache.has("O\\'Brien"));
    t.same(getSourceForUserString(context, "O\\'Brien"), "query");
  });
});

t.test("it attributes to the correct source", async (t) => {
  const context = createContext({
    query: { q: "query-value" },
    body: { name: "body-value" },
  });

  runWithContext(context, () => {
    const fromQuery = __zen_wrapMethodCallResult("query-value", (s) =>
      (s as string).toUpperCase()
    );
    const fromBody = __zen_wrapMethodCallResult("body-value", (s) =>
      (s as string).toUpperCase()
    );

    t.same(getSourceForUserString(context, fromQuery as string), "query");
    t.same(getSourceForUserString(context, fromBody as string), "body");
  });
});

t.test("it does not break when method throws", async (t) => {
  const context = createContext({ query: { name: "hello" } });

  runWithContext(context, () => {
    t.throws(() => {
      __zen_wrapMethodCallResult("hello", () => {
        throw new Error("method error");
      });
    }, /method error/);
  });
});

t.test("it ignores empty string results", async (t) => {
  const context = createContext({ query: { name: "hello" } });

  runWithContext(context, () => {
    __zen_wrapMethodCallResult("hello", () => "");

    // Empty string should NOT be tracked
    const cache = extractStringsFromUserInputCached(context);
    t.notOk(cache.has(""));
  });
});

t.test("it ignores non-string non-array results", async (t) => {
  const context = createContext({ query: { name: "42" } });

  runWithContext(context, () => {
    const result = __zen_wrapMethodCallResult("42", () => 42);
    t.same(result, 42);
    // No crash, number result is just returned as-is
  });
});

t.test("it handles undefined subject (optional chaining)", async (t) => {
  const context = createContext({ query: { name: "hello" } });

  runWithContext(context, () => {
    // Simulates: a.b?.trim() where a.b is undefined
    const result = __zen_wrapMethodCallResult(undefined, (s) =>
      (s as any)?.trim()
    );
    t.same(result, undefined);
  });
});

t.test("it handles null subject (optional chaining)", async (t) => {
  const context = createContext({ query: { name: "hello" } });

  runWithContext(context, () => {
    // Simulates: a.b?.trim() where a.b is null
    const result = __zen_wrapMethodCallResult(null, (s) =>
      (s as any)?.trim()
    );
    t.same(result, undefined);
  });
});

t.test(
  "end-to-end: detects SQL injection through transformed input",
  async (t) => {
    const context = createContext({
      query: { search: "  '; DROP TABLE users; --  " },
    });

    runWithContext(context, () => {
      // Without taint tracking, if the user transforms the input,
      // Zen would not find the original value in the SQL query.
      // The original has leading/trailing spaces, so after trim()
      // the value differs from the original. Since SQL injection
      // detection already lowercases both sides, toLowerCase() alone
      // would not require taint tracking — but trim() does.

      // Simulate: search.trim()
      const trimmed = __zen_wrapMethodCallResult(
        "  '; DROP TABLE users; --  ",
        (s) => (s as string).trim()
      );

      // The transformed value is used in the SQL query
      const sql = `SELECT * FROM items WHERE name = '${trimmed as string}'`;

      const result = checkContextForSqlInjection({
        sql,
        operation: "mysql.query",
        context,
        dialect: new SQLDialectMySQL(),
      });

      t.ok(result, "SQL injection should be detected");
      if (result && "kind" in result) {
        t.same(result.kind, "sql_injection");
        t.same(result.source, "query");
      }
    });
  }
);
