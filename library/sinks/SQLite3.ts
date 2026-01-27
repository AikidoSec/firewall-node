import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { wrapExport } from "../agent/hooks/wrapExport";
import type { PartialWrapPackageInfo } from "../agent/hooks/WrapPackageInfo";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForPathTraversal } from "../vulnerabilities/path-traversal/checkContextForPathTraversal";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import type { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectSQLite } from "../vulnerabilities/sql-injection/dialects/SQLDialectSQLite";

export class SQLite3 implements Wrapper {
  private readonly dialect: SQLDialect = new SQLDialectSQLite();

  private inspectQuery(operation: string, args: unknown[]): InterceptorResult {
    const context = getContext();
    if (!context) {
      return undefined;
    }

    if (args.length > 0) {
      if (typeof args[0] === "string" && args[0].length > 0) {
        const sql = args[0];

        return checkContextForSqlInjection({
          operation: operation,
          sql: sql,
          context: context,
          dialect: this.dialect,
        });
      }
    }

    return undefined;
  }

  /**
   * Inspect path of sqlite3.backup for path traversal
   */
  private inspectPath(operation: string, args: unknown[]) {
    const context = getContext();
    if (!context) {
      return undefined;
    }

    if (args.length === 0 || typeof args[0] !== "string") {
      return undefined;
    }
    const filename = args[0];

    const result = checkContextForPathTraversal({
      filename: filename,
      operation: operation,
      context: context,
      checkPathStart: true,
    });

    if (result) {
      return result;
    }

    return undefined;
  }

  private wrapDatabasePrototype(db: any, pkgInfo: PartialWrapPackageInfo) {
    const sqlFunctions = [
      "run",
      "get",
      "all",
      "each",
      "exec",
      "prepare",
      "map",
    ];

    for (const func of sqlFunctions) {
      wrapExport(db, func, pkgInfo, {
        kind: "sql_op",
        inspectArgs: (args) => {
          return this.inspectQuery(`sqlite3.${func}`, args);
        },
      });
    }

    wrapExport(db, "backup", pkgInfo, {
      kind: "fs_op",
      inspectArgs: (args) => {
        return this.inspectPath(`sqlite3.backup`, args);
      },
    });
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("sqlite3")
      .withVersion("^5.0.0")
      .onRequire((exports, pkgInfo) => {
        const db = exports.Database.prototype;
        this.wrapDatabasePrototype(db, pkgInfo);
      })
      .addFileInstrumentation({
        path: "lib/sqlite3.js",
        functions: [],
        accessLocalVariables: {
          names: ["sqlite3"],
          cb: (vars, pkgInfo) => {
            this.wrapDatabasePrototype(vars[0].Database.prototype, pkgInfo);
          },
        },
      });
  }
}
