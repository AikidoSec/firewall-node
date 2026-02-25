import * as t from "tap";
import {
  wrapRequire,
  setPackagesToPatch,
  setBuiltinModulesToPatch,
  getOriginalRequire,
} from "./wrapRequire";
import { Package } from "./Package";
import { BuiltinModule } from "./BuiltinModule";

// @esm-tests-skip

t.test("Wrap require does not throw an error", async (t) => {
  wrapRequire();
  t.pass();
});

t.test("Wrapping require twice does not throw an error", async (t) => {
  wrapRequire();
  t.pass();
});

t.test("Can wrap external package", async (t) => {
  const initialSqlite3 = require("sqlite3");

  const pkg = new Package("sqlite3");
  pkg.withVersion("^5.0.0").onRequire((exports, pkgInfo) => {
    exports._test = "aikido";
    t.same(pkgInfo.name, "sqlite3");
    t.same(pkgInfo.type, "external");
    if (pkgInfo.type === "external") {
      t.ok(pkgInfo.path.base.endsWith("node_modules/sqlite3"));
      t.same(pkgInfo.path.relative, "lib/sqlite3.js");
    }
  });
  setPackagesToPatch([pkg]);

  // Require patched sqlite3
  const sqlite3 = require("sqlite3");
  t.same(sqlite3._test, "aikido");

  // Get cached sqlite3
  const sqlite3Cached = require("sqlite3");
  t.same(sqlite3Cached._test, "aikido");

  // Reset packages to patch, so on the next require we get the original sqlite3
  setPackagesToPatch([]);
  const unpatchedSqlite3 = require("sqlite3");

  t.same(initialSqlite3, unpatchedSqlite3);
});

t.test("Can wrap file of external package", async (t) => {
  const initialHonoBase = require("hono/hono-base");

  const pkg = new Package("hono");
  pkg
    .withVersion("^4.0.0")
    .onFileRequire("dist/cjs/hono-base.js", (exports, pkgInfo) => {
      exports._test = "aikido";
      t.same(pkgInfo.name, "hono");
      t.same(pkgInfo.type, "external");
      if (pkgInfo.type === "external") {
        t.ok(pkgInfo.path.base.endsWith("node_modules/hono"));
        t.same(pkgInfo.path.relative, "dist/cjs/hono-base.js");
      }
    });
  setPackagesToPatch([pkg]);

  // Require patched version of hono
  const honoBase = require("hono/hono-base");
  t.same(honoBase._test, "aikido");

  // Reset packages to patch, so on the next require we get the original hono
  setPackagesToPatch([]);
  const unpatchedHonoBase = require("hono/hono-base");
  t.same(initialHonoBase, unpatchedHonoBase);
});

t.test("Can wrap builtin module", async (t) => {
  const initialFs = require("fs");

  const module = new BuiltinModule("fs");
  module.onRequire((exports, pkgInfo) => {
    exports._test = "aikido";
    t.same(pkgInfo.name, "fs");
    t.same(pkgInfo.type, "builtin");
    // @ts-expect-error Test to ensure types are correct
    t.same(pkgInfo.path, undefined);
  });
  setBuiltinModulesToPatch([module]);

  // Require patched fs
  const fs = require("fs");
  t.same(fs._test, "aikido");

  // Get cached fs
  const fsCached = require("fs");
  t.same(fsCached._test, "aikido");

  // Reset builtin modules to patch, so on the next require we get the original fs
  setBuiltinModulesToPatch([]);
  const unpatchedFs = require("fs");
  t.same(initialFs, unpatchedFs);
});

t.test("Does not wrap package with not matching version", async (t) => {
  const initialSqlite3 = require("sqlite3");

  const pkg = new Package("sqlite3");
  pkg.withVersion("^100.0.0").onRequire((exports, pkgInfo) => {
    exports._test = "aikido";
  });
  setPackagesToPatch([pkg]);

  // Require original sqlite3
  const sqlite3 = require("sqlite3");
  t.same(sqlite3, initialSqlite3);
});

t.test("Does not wrap package with no interceptors", async (t) => {
  const initialSqlite3 = require("sqlite3");

  const pkg = new Package("sqlite3");
  pkg.withVersion("^5.0.0");
  setPackagesToPatch([pkg]);

  // Require original sqlite3
  const sqlite3 = require("sqlite3");
  t.same(sqlite3, initialSqlite3);
});

t.test("Does not wrap package without version", async (t) => {
  const initialSqlite3 = require("sqlite3");

  const pkg = new Package("sqlite3");
  setPackagesToPatch([pkg]);

  // Require original sqlite3
  const sqlite3 = require("sqlite3");
  t.same(sqlite3, initialSqlite3);
});

t.test("Replace default export", async (t) => {
  const initialSqlite3 = require("sqlite3");

  const pkg = new Package("sqlite3");
  pkg.withVersion("^5.0.0").onRequire((exports, pkgInfo) => {
    return "aikido";
  });
  setPackagesToPatch([pkg]);

  // Require patched sqlite3
  const sqlite3 = require("sqlite3");
  t.same(sqlite3, "aikido");

  // Reset packages to patch, so on the next require we get the original sqlite3
  setPackagesToPatch([]);
  const unpatchedSqlite3 = require("sqlite3");

  t.same(initialSqlite3, unpatchedSqlite3);
});

t.test("Confirm its caching the exports", async (t) => {
  let counter = 0;

  const pkg = new Package("sqlite3");
  pkg.withVersion("^5.0.0").onRequire((exports, pkgInfo) => {
    counter++;
    return "aikido";
  });
  setPackagesToPatch([pkg]);

  // Require patched sqlite3
  const sqlite3 = require("sqlite3");
  t.same(sqlite3, "aikido");
  const sqlite3Cached = require("sqlite3");
  t.same(sqlite3Cached, "aikido");

  setPackagesToPatch([]);

  t.same(counter, 1);
});

t.test("Returns original exports on exception", async (t) => {
  const initialSqlite3 = require("sqlite3");

  const pkg = new Package("sqlite3");
  pkg.withVersion("^5.0.0").onRequire((exports, pkgInfo) => {
    exports._test = "aikido";
    throw new Error("Test error");
  });
  setPackagesToPatch([pkg]);

  // Should return original sqlite3
  const sqlite3 = require("sqlite3");
  t.same(sqlite3, initialSqlite3);
});

t.test("Require non-existing package", async (t) => {
  const error = t.throws(() => require("unknown"));
  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.match(error.message, /Cannot find module .unknown./);
  }
});

t.test("Not wrapped using original require", async (t) => {
  const initialFs = require("fs");

  const mod = new BuiltinModule("fs");
  mod.onRequire((exports, pkgInfo) => {
    exports._test = "aikido";
  });
  setBuiltinModulesToPatch([mod]);

  // Require patched sqlite3
  const fs = require("fs");
  t.same(fs._test, "aikido");

  // Require original sqlite3
  const fsOriginal = getOriginalRequire()("fs");
  t.same(fsOriginal, initialFs);
});

t.test("Require json file", async (t) => {
  const json = require("../../package.json");
  t.same(json.name, "@aikidosec/firewall");
});

t.test("Pass invalid arguments to VersionedPackage", async (t) => {
  t.same(
    // @ts-expect-error Test with invalid arguments
    (t.throws(() => new Package()) as Error).message,
    "Package name is required"
  );
  t.same(
    // @ts-expect-error Test with invalid arguments
    (t.throws(() => new Package("test").withVersion()) as Error).message,
    "Version range is required"
  );
  t.same(
    (
      t.throws(() =>
        // @ts-expect-error Test with invalid arguments
        new Package("test").withVersion("^1.0.0").onRequire()
      ) as Error
    ).message,
    "Interceptor must be a function"
  );
  t.same(
    (
      t.throws(() =>
        new Package("test").withVersion("^1.0.0").onFileRequire("", () => {})
      ) as Error
    ).message,
    "Relative path must not be empty"
  );
  t.same(
    (
      t.throws(() =>
        new Package("test")
          .withVersion("^1.0.0")
          .onFileRequire("test", () => {})
          .onFileRequire("test", () => {})
      ) as Error
    ).message,
    "Interceptor for test already exists"
  );
  t.same(
    (
      t.throws(() =>
        new Package("test")
          .withVersion("^1.0.0")
          .onFileRequire("/test", () => {})
      ) as Error
    ).message,
    "Absolute paths are not allowed for require file interceptors"
  );
  t.same(
    (
      t.throws(() =>
        new Package("test")
          .withVersion("^1.0.0")
          .onFileRequire("../test", () => {})
      ) as Error
    ).message,
    "Relative paths with '..' are not allowed for require file interceptors"
  );

  t.same(
    new Package("test")
      .withVersion("^1.0.0")
      .onFileRequire("./test", () => {})
      .getRequireFileInterceptor("test"),
    () => {}
  );
});

t.test("Add two packages with same name", async (t) => {
  let intercepted = 0;
  const pkg = new Package("sqlite3");
  pkg.withVersion("^5.0.0").onRequire(() => {
    intercepted++;
  });
  const pkg2 = new Package("sqlite3");
  pkg2.withVersion("^5.0.0").onRequire(() => {
    intercepted++;
  });

  setPackagesToPatch([pkg, pkg2]);

  // Require patched sqlite3
  const sqlite3 = require("sqlite3");
  t.same(intercepted, 2);

  setPackagesToPatch([]);
});

t.test("Add two builtin modules with same name", async (t) => {
  let intercepted = 0;
  const mod = new BuiltinModule("fs");
  mod.onRequire(() => {
    intercepted++;
  });
  const mod2 = new BuiltinModule("fs");
  mod2.onRequire(() => {
    intercepted++;
  });

  setBuiltinModulesToPatch([mod, mod2]);

  // Require patched fs
  const fs = require("fs");
  t.same(intercepted, 2);

  setBuiltinModulesToPatch([]);
});

t.test(
  "Wraps process.getBuiltinModule",
  {
    skip: !process.getBuiltinModule
      ? "Not available in Node.js < v22.3.0"
      : false,
  },
  async (t) => {
    const originalFs = require("fs");

    const mod = new BuiltinModule("fs");
    mod.onRequire(() => {
      return "aikido";
    });
    setBuiltinModulesToPatch([mod]);

    // Require patched fs
    const fs = process.getBuiltinModule("fs");
    t.same(fs, "aikido");

    setBuiltinModulesToPatch([]);

    const fsUnpatched = require("fs");
    t.same(fsUnpatched, originalFs);
  }
);

t.test(
  "process.getBuiltinModule with non-existing module",
  {
    skip: !process.getBuiltinModule
      ? "Not available in Node.js < v22.3.0"
      : false,
  },
  async (t) => {
    const error = t.throws(() => process.getBuiltinModule("unknown"));
    t.ok(error instanceof Error);
    if (error instanceof Error) {
      t.match(error.message, /Cannot find module .unknown./);
    }
  }
);

t.test(
  "process.getBuiltinModule with non-builtin module",
  {
    skip: !process.getBuiltinModule
      ? "Not available in Node.js < v22.3.0"
      : false,
  },
  async (t) => {
    const error = t.throws(() => process.getBuiltinModule("sqlite3"));
    t.ok(error instanceof Error);
    if (error instanceof Error) {
      t.match(error.message, /Cannot find module .sqlite3./);
    }
  }
);

t.test("cleans up stack trace if the module is not found", async (t) => {
  const error = t.throws(() => require("unknown"));
  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.match(error.message, /Cannot find module 'unknown'/);
    t.match(error.stack, /node:internal\/modules/);
    t.notMatch(error.stack, /Module\.patchedRequire/);
  }

  const error2 = t.throws(() => require("./fixtures/require-throw-number"));
  t.same(error2, 1);
});
