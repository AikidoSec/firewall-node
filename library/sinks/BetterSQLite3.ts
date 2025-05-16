import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForPathTraversal } from "../vulnerabilities/path-traversal/checkContextForPathTraversal";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectSQLite } from "../vulnerabilities/sql-injection/dialects/SQLDialectSQLite";

export class BetterSQLite3 implements Wrapper {
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

  wrap(hooks: Hooks) {
    const sqlFunctions = ["prepare", "exec", "pragma"];
    const fsPathFunctions = ["backup", "loadExtension"];

    hooks
      .addPackage("better-sqlite3")
      .withVersion("^11.0.0 || ^10.0.0 || ^9.0.0 || ^8.0.0")
      .onRequire((exports, pkgInfo) => {
        for (const func of sqlFunctions) {
          wrapExport(exports.prototype, func, pkgInfo, {
            kind: "sql_op",
            inspectArgs: (args) => {
              return this.inspectQuery(`better-sqlite3.${func}`, args);
            },
          });
        }
        for (const func of fsPathFunctions) {
          wrapExport(exports.prototype, func, pkgInfo, {
            kind: "sql_op",
            inspectArgs: (args) => {
              return this.inspectPath(`better-sqlite3.${func}`, args);
            },
          });
        }
      });
  }
}
