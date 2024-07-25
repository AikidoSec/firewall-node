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

  t.ok(
    detectDbJsInjection("a' && sleep(2000) && 'b", {
      $where: "function() { return this.name === 'a' && sleep(2000) && 'b' }",
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

t.test("ignores", async (t) => {
  t.notOk(
    detectDbJsInjection("test", {
      $where: 123,
    })
  );
  t.notOk(
    detectDbJsInjection("this.name === 'admin'", {
      $test: "this.name === 'admin'",
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

t.test(
  "does not detect injection in $function operator if not in user input",
  async (t) => {
    t.notOk(
      detectDbJsInjection("test", {
        $function: {
          body: "this.name === `a` && sleep(2000) && `b'",
          args: [],
          lang: "js",
        },
      })
    );
  }
);

t.test("detects injection in $accumulator operator", async (t) => {
  t.ok(
    detectDbJsInjection("a` && sleep(2000) && `b", {
      $accumulator: {
        init: "this.name === `a` && sleep(2000) && `b'",
        lang: "js",
      },
    })
  );

  t.ok(
    detectDbJsInjection("a` && sleep(2000) && `b", {
      $accumulator: {
        accumulate: "this.name === `a` && sleep(2000) && `b'",
        lang: "js",
      },
    })
  );

  t.ok(
    detectDbJsInjection("a` && sleep(2000) && `b", {
      $accumulator: {
        merge: "this.name === `a` && sleep(2000) && `b'",
        lang: "js",
      },
    })
  );

  t.ok(
    detectDbJsInjection("a` && sleep(2000) && `b", {
      $accumulator: {
        finalize: "this.name === `a` && sleep(2000) && `b'",
        lang: "js",
      },
    })
  );

  t.ok(
    detectDbJsInjection("a` && sleep(2000) && `b", {
      $accumulator: {
        init: "function() { return true; }",
        finalize:
          "function() { return this.name === `a` && sleep(2000) && `b' }",
        lang: "js",
      },
    })
  );
});

t.test("Ignores with invalid lang", async (t) => {
  t.notOk(
    detectDbJsInjection("a` && sleep(2000) && `b", {
      $accumulator: {
        init: "this.name === `a` && sleep(2000) && `b'",
        lang: "invalid",
      },
    })
  );
  t.notOk(
    detectDbJsInjection("a` && sleep(2000) && `b", {
      $function: {
        body: "this.name === `a` && sleep(2000) && `b'",
        args: [],
        lang: "invalid",
      },
    })
  );
});

t.test("Ignores without code", async (t) => {
  t.notOk(
    detectDbJsInjection("a` && sleep(2000) && `b", {
      $accumulator: {
        lang: "js",
      },
    })
  );

  t.notOk(
    detectDbJsInjection("a` && sleep(2000) && `b", {
      $function: {
        lang: "js",
      },
    })
  );
});

t.test("Ignores where with object", async (t) => {
  t.notOk(
    detectDbJsInjection("a` && sleep(2000) && `b", {
      $where: {
        lang: "js",
      },
    })
  );
});
