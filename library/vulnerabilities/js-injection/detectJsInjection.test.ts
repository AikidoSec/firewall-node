import * as t from "tap";
import { detectJsInjection } from "./detectJsInjection";

t.test("it detects JS injections", async (t) => {
  t.same(
    detectJsInjection(
      '1 + 1; console.log("hello")',
      '1 + 1; console.log("hello")'
    ),
    true
  );
  t.same(detectJsInjection("const x = 1 + 1; fetch();", "+ 1; fetch()"), true);
  t.same(
    detectJsInjection("const test = 'Hello World!'; //';", "Hello World!'; //"),
    true
  );
  t.same(
    detectJsInjection(
      "if (username === 'admin' || 1 === 1) { return true; } //') {}",
      "admin' || 1 === 1) { return true; } //"
    ),
    true
  );
  t.same(
    detectJsInjection(
      "packet.readDateTimeString('abc'); process.exit(1); // ');",
      "abc'); process.exit(1); //"
    ),
    true
  );
  t.same(
    detectJsInjection(
      "const window={}; alert('!'); return window.__NUXT__",
      "alert('!');"
    ),
    true
  );
  t.same(
    detectJsInjection(
      "const obj = { test: 'value', isAdmin: true }; //'};",
      "value', isAdmin: true }; //"
    ),
    true
  );
});

t.test("does not detect JS injections", async (t) => {
  t.same(detectJsInjection("1 + 1", "1 + 1"), false);
  t.same(detectJsInjection("1 + 1", "const x = 1 + 1; x"), false);
  t.same(detectJsInjection("1 + 1", "1 + 1; console.log('hello')"), false);
  t.same(detectJsInjection("1 + 1", "1"), false);
  t.same(detectJsInjection("1 + 1", "abc"), false);
  t.same(detectJsInjection("const x = 'test'", "test"), false);
  t.same(detectJsInjection("const x = 'test'", ""), false);
  t.same(detectJsInjection("const test = 'abcde_123';", "abcde_123"), false);
  t.same(detectJsInjection("const test = [1, 2, 3];", "1, 2, 3"), false);

  t.same(
    detectJsInjection("const test = 'Hello World!';", "Hello World!"),
    false
  );
  t.same(
    detectJsInjection(
      "if(username === 'admin' || 1 === 1) { return true; }",
      "admin"
    ),
    false
  );
  t.same(
    detectJsInjection("const obj = { test: 'value', isAdmin: true };", "value"),
    false
  );
});

t.test("test source type", async (t) => {
  t.same(
    detectJsInjection(
      "const test: string = 'Hello World!'; console.log('test'); //';",
      "Hello World!'; console.log('test'); //",
      "js"
    ),
    false // Cannot be parsed as JS, it's TS
  );
  t.same(
    detectJsInjection(
      "const test: string = 'Hello World!'; console.log('test'); //';",
      "Hello World!'; console.log('test'); //",
      "ts"
    ),
    true
  );
});
