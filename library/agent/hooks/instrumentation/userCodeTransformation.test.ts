import * as t from "tap";
import { transformUserCode } from "./userCodeTransformation";

const compareCodeStrings = (code1: string, code2: string) => {
  return code1.replace(/\s+/g, "") === code2.replace(/\s+/g, "");
};

t.before(() => {
  process.env.AIKIDO_TEST_NEW_INSTRUMENTATION = "false";
});

t.after(() => {
  process.env.AIKIDO_TEST_NEW_INSTRUMENTATION = "true";
});

const isSameCode = (t: any, actual: string, expected: string) => {
  t.same(
    compareCodeStrings(actual, expected),
    true,
    `Expected:\n${expected}\n\nGot:\n${actual}`
  );
};

t.test("wraps simple method call (ESM)", async (t) => {
  const result = transformUserCode(
    "app.js",
    `
    import express from "express";
    const name = req.query.name;
    const upper = name.toUpperCase();
    `,
    "module"
  );

  t.ok(result);
  isSameCode(
    t,
    result!,
    `import { __zen_wrapMethodCallResult } from "@aikidosec/firewall/instrument/internals";
    import express from "express";
    const name = req.query.name;
    const upper = __zen_wrapMethodCallResult(name, (__a) => __a.toUpperCase());`
  );
});

t.test("wraps simple method call (CJS)", async (t) => {
  const result = transformUserCode(
    "app.js",
    `
    const express = require("express");
    const name = req.query.name;
    const upper = name.toUpperCase();
    `,
    "commonjs"
  );

  t.ok(result);
  isSameCode(
    t,
    result!,
    `const { __zen_wrapMethodCallResult } = require("@aikidosec/firewall/instrument/internals");
    const express = require("express");
    const name = req.query.name;
    const upper = __zen_wrapMethodCallResult(name, (__a) => __a.toUpperCase());`
  );
});

t.test("wraps chained method calls", async (t) => {
  const result = transformUserCode(
    "app.js",
    `const cleaned = name.trim().toLowerCase();`,
    "module"
  );

  t.ok(result);
  // exit_expression (bottom-up) means trim() is wrapped first, then toLowerCase()
  isSameCode(
    t,
    result!,
    `import { __zen_wrapMethodCallResult } from "@aikidosec/firewall/instrument/internals";
    const cleaned = __zen_wrapMethodCallResult(__zen_wrapMethodCallResult(name, (__a) => __a.trim()), (__a) => __a.toLowerCase());`
  );
});

t.test("wraps method calls with arguments", async (t) => {
  const result = transformUserCode(
    "app.js",
    `const escaped = input.replace("'", "\\\\'");`,
    "module"
  );

  t.ok(result);
  isSameCode(
    t,
    result!,
    `import { __zen_wrapMethodCallResult } from "@aikidosec/firewall/instrument/internals";
    const escaped = __zen_wrapMethodCallResult(input, (__a) => __a.replace("'", "\\\\'"));`
  );
});

t.test("wraps split and join", async (t) => {
  const result = transformUserCode(
    "app.js",
    `const reversed = name.split("").reverse().join("");`,
    "module"
  );

  t.ok(result);
  isSameCode(
    t,
    result!,
    `import { __zen_wrapMethodCallResult } from "@aikidosec/firewall/instrument/internals";
    const reversed = __zen_wrapMethodCallResult(__zen_wrapMethodCallResult(__zen_wrapMethodCallResult(name, (__a) => __a.split("")), (__a) => __a.reverse()), (__a) => __a.join(""));`
  );
});

t.test("does not wrap non-target methods", async (t) => {
  const code = `
    const result = obj.customMethod();
    console.log("hello");
    arr.push(1);
    str.indexOf("x");
  `;
  const result = transformUserCode("app.js", code, "module");

  // No target methods, so result should be the original code
  t.ok(result);
  isSameCode(t, result!, code);
});

t.test("wraps multiple different method calls", async (t) => {
  const result = transformUserCode(
    "app.js",
    `
    const a = x.trim();
    const b = y.toLowerCase();
    const c = z.slice(0, 5);
    `,
    "module"
  );

  t.ok(result);
  isSameCode(
    t,
    result!,
    `import { __zen_wrapMethodCallResult } from "@aikidosec/firewall/instrument/internals";
    const a = __zen_wrapMethodCallResult(x, (__a) => __a.trim());
    const b = __zen_wrapMethodCallResult(y, (__a) => __a.toLowerCase());
    const c = __zen_wrapMethodCallResult(z, (__a) => __a.slice(0, 5));`
  );
});

t.test("handles complex subject expressions", async (t) => {
  const result = transformUserCode(
    "app.js",
    `const upper = getInput().toUpperCase();`,
    "module"
  );

  t.ok(result);
  isSameCode(
    t,
    result!,
    `import { __zen_wrapMethodCallResult } from "@aikidosec/firewall/instrument/internals";
    const upper = __zen_wrapMethodCallResult(getInput(), (__a) => __a.toUpperCase());`
  );
});

t.test("handles member expression subject", async (t) => {
  const result = transformUserCode(
    "app.js",
    `const upper = req.query.name.toUpperCase();`,
    "module"
  );

  t.ok(result);
  isSameCode(
    t,
    result!,
    `import { __zen_wrapMethodCallResult } from "@aikidosec/firewall/instrument/internals";
    const upper = __zen_wrapMethodCallResult(req.query.name, (__a) => __a.toUpperCase());`
  );
});

t.test("returns undefined for unparseable code", async (t) => {
  const result = transformUserCode("app.js", `const { = broken`, "module");
  t.same(result, undefined);
});

t.test("rejects already-transformed code", async (t) => {
  const result = transformUserCode(
    "app.js",
    `__zen_wrapMethodCallResult(x, (__a) => __a.trim())`,
    "module"
  );
  t.same(result, undefined);
});

t.test("unambiguous mode with ESM syntax", async (t) => {
  const result = transformUserCode(
    "app.js",
    `
    import { foo } from "bar";
    const x = name.trim();
    `,
    "unambiguous"
  );

  t.ok(result);
  isSameCode(
    t,
    result!,
    `import { __zen_wrapMethodCallResult } from "@aikidosec/firewall/instrument/internals";
    import { foo } from "bar";
    const x = __zen_wrapMethodCallResult(name, (__a) => __a.trim());`
  );
});

t.test("unambiguous mode with CJS syntax", async (t) => {
  const result = transformUserCode(
    "app.js",
    `
    const foo = require("bar");
    const x = name.trim();
    `,
    "unambiguous"
  );

  t.ok(result);
  isSameCode(
    t,
    result!,
    `const { __zen_wrapMethodCallResult } = require("@aikidosec/firewall/instrument/internals");
    const foo = require("bar");
    const x = __zen_wrapMethodCallResult(name, (__a) => __a.trim());`
  );
});

t.test("wraps optional chaining method call", async (t) => {
  const result = transformUserCode(
    "app.js",
    `const x = a.b?.trim();`,
    "module"
  );

  t.ok(result);
  isSameCode(
    t,
    result!,
    `import { __zen_wrapMethodCallResult } from "@aikidosec/firewall/instrument/internals";
    const x = __zen_wrapMethodCallResult(a.b, (__a) => __a?.trim());`
  );
});

t.test("wraps chained optional method calls", async (t) => {
  const result = transformUserCode(
    "app.js",
    `const x = a.b?.trim()?.toLowerCase();`,
    "module"
  );

  t.ok(result);
  isSameCode(
    t,
    result!,
    `import { __zen_wrapMethodCallResult } from "@aikidosec/firewall/instrument/internals";
    const x = __zen_wrapMethodCallResult(__zen_wrapMethodCallResult(a.b, (__a) => __a?.trim()), (__a) => __a?.toLowerCase());`
  );
});

t.test("wraps binary + operator", async (t) => {
  const result = transformUserCode(
    "app.js",
    `const greeting = "Hello " + name;`,
    "module"
  );

  t.ok(result);
  isSameCode(
    t,
    result!,
    `import { __zen_wrapConcat } from "@aikidosec/firewall/instrument/internals";
    const greeting = __zen_wrapConcat("Hello ", name);`
  );
});

t.test("wraps chained + operators", async (t) => {
  const result = transformUserCode(
    "app.js",
    `const sql = "SELECT * FROM " + table + " WHERE 1";`,
    "module"
  );

  t.ok(result);
  isSameCode(
    t,
    result!,
    `import { __zen_wrapConcat } from "@aikidosec/firewall/instrument/internals";
    const sql = __zen_wrapConcat(__zen_wrapConcat("SELECT * FROM ", table), " WHERE 1");`
  );
});

t.test("wraps += assignment (identifier)", async (t) => {
  const result = transformUserCode(
    "app.js",
    `let str = "Hello"; str += name;`,
    "module"
  );

  t.ok(result);
  isSameCode(
    t,
    result!,
    `import { __zen_wrapConcat } from "@aikidosec/firewall/instrument/internals";
    let str = "Hello"; str = __zen_wrapConcat(str, name);`
  );
});

t.test("wraps .concat() method call", async (t) => {
  const result = transformUserCode(
    "app.js",
    `const result = str.concat(a, b);`,
    "module"
  );

  t.ok(result);
  isSameCode(
    t,
    result!,
    `import { __zen_wrapConcat } from "@aikidosec/firewall/instrument/internals";
    const result = __zen_wrapConcat(str, a, b);`
  );
});

t.test("wraps .concat() with single argument", async (t) => {
  const result = transformUserCode(
    "app.js",
    `const result = str.concat(other);`,
    "module"
  );

  t.ok(result);
  isSameCode(
    t,
    result!,
    `import { __zen_wrapConcat } from "@aikidosec/firewall/instrument/internals";
    const result = __zen_wrapConcat(str, other);`
  );
});

t.test("imports both hooks when needed", async (t) => {
  const result = transformUserCode(
    "app.js",
    `
    const upper = name.toUpperCase();
    const greeting = "Hello " + upper;
    `,
    "module"
  );

  t.ok(result);
  isSameCode(
    t,
    result!,
    `import { __zen_wrapMethodCallResult, __zen_wrapConcat } from "@aikidosec/firewall/instrument/internals";
    const upper = __zen_wrapMethodCallResult(name, (__a) => __a.toUpperCase());
    const greeting = __zen_wrapConcat("Hello ", upper);`
  );
});

t.test("wraps + in CJS mode", async (t) => {
  const result = transformUserCode(
    "app.js",
    `
    const express = require("express");
    const greeting = "Hello " + name;
    `,
    "commonjs"
  );

  t.ok(result);
  isSameCode(
    t,
    result!,
    `const { __zen_wrapConcat } = require("@aikidosec/firewall/instrument/internals");
    const express = require("express");
    const greeting = __zen_wrapConcat("Hello ", name);`
  );
});
