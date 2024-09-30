import t from "tap";

import wrapImport from "./wrapImport.js";
import Package from "./Package.js";
import BuiltinModule from "./BuiltinModule.js";

t.test("it works", async (t) => {
  const initialSqlite3 = await import("sqlite3");
  t.same(typeof initialSqlite3.default, "object");

  const sqlite3Pkg = new Package.Package("sqlite3");
  sqlite3Pkg.withVersion("^5.0.0").onRequire((exports, pkgInfo) => {
    t.same(pkgInfo.name, "sqlite3");
    t.same(pkgInfo.type, "external");
    t.ok(pkgInfo.path?.base.endsWith("node_modules/sqlite3"));
    t.same(pkgInfo.path?.relative, "lib/sqlite3.js");

    exports.default = 42;
  });

  const internalFs = new BuiltinModule.BuiltinModule("fs");
  internalFs.onRequire((exports, pkgInfo) => {
    t.same(pkgInfo.name, "fs");
    t.same(pkgInfo.type, "builtin");
    t.same(pkgInfo.path, undefined);

    exports.readFile = () => "hello from aikido";
  });

  wrapImport.wrapImport([sqlite3Pkg], [internalFs]);

  // Should not change anything
  wrapImport.wrapImport();

  const sqlite3 = await import("sqlite3");
  t.same(sqlite3.default, 42);

  const fs = await import("fs");
  t.same(fs.readFile(), "hello from aikido");
});
