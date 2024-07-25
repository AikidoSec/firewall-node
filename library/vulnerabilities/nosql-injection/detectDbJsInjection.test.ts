import * as t from "tap";
import { detectDbJsInjection } from "./detectDbJsInjection";

t.test("detects injection in $where operator", async (t) => {
  t.ok(
    detectDbJsInjection("this.name === 'admin'", {
      $where: "this.name === 'admin'",
    })
  );

  t.ok(
    detectDbJsInjection("a' && sleep(2000) && 'b", {
      $where: "this.name === 'a' && sleep(2000) && 'b'",
    })
  );

  t.ok(
    detectDbJsInjection('a" && sleep(2000) && "b', {
      $where: 'this.name === "a" && sleep(2000) && "b"',
    })
  );

  t.ok(
    detectDbJsInjection("a` && sleep(2000) && `b", {
      $where: "this.name === `a` && sleep(2000) && `b'",
    })
  );

  t.ok(
    detectDbJsInjection("a' && sleep(2000) && 'b", {
      $where: "this.name === 'a' && sleep(2000) && 'b'\"",
    })
  );
});

t.test(
  "does not detect injection in $where operator if not in user input",
  async (t) => {
    t.notOk(
      detectDbJsInjection("this.name === 'admin'", {
        $where: "this.name === 'user'",
      })
    );
    t.notOk(
      detectDbJsInjection("admin", {
        $where: "this.name === 'a' && sleep(2000) && 'b'",
      })
    );
    t.notOk(
      detectDbJsInjection("", {
        $where: "this.name === 'a' && sleep(2000) && 'b'",
      })
    );
  }
);

t.test("does not detect injection if securly encapsulated", async (t) => {
  t.notOk(
    detectDbJsInjection('a" sleep(2000) && "', {
      $where: "this.name === 'a\" sleep(2000) && \"'",
    })
  );
});

t.test("ignores non string values", async (t) => {
  t.notOk(
    detectDbJsInjection("test", {
      $where: 123,
    })
  );
});

t.test("detects injection in $function operator", async (t) => {
  t.ok(
    detectDbJsInjection("a` && sleep(2000) && `b", {
      $function: {
        body: "this.name === `a` && sleep(2000) && `b'",
        args: [],
        lang: "js",
      },
    })
  );
});
