import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForPathTraversal } from "../vulnerabilities/path-traversal/checkContextForPathTraversal";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
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

  wrap(hooks: Hooks) {
    const sqlFunctions = [
      "run",
      "get",
      "all",
      "each",
      "exec",
      "prepare",
      "map",
    ];

    hooks
      .addPackage("sqlite3")
      .withVersion("^5.0.0")
      .onRequire((exports, pkgInfo) => {
        let db: any;
        if (pkgInfo.isESMImport) {
          db = exports.default.Database.prototype;
        } else {
          db = exports.Database.prototype;
        }

        for (const func of sqlFunctions) {
          wrapExport(db, func, pkgInfo, {
            inspectArgs: (args, agent) => {
              return this.inspectQuery(`sqlite3.${func}`, args);
            },
          });
        }

        wrapExport(db, "backup", pkgInfo, {
          inspectArgs: (args, agent) => {
            return this.inspectPath(`sqlite3.backup`, args);
          },
        });
      });
  }
}
