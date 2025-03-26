import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectSQLite } from "../vulnerabilities/sql-injection/dialects/SQLDialectSQLite";

export class LibSQL implements Wrapper {
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

  wrap(hooks: Hooks) {
    const sqlFunctions = ["prepare", "exec", "pragma"];

    hooks
      .addPackage("libsql")
      .withVersion("^0.4.0")
      .onRequire((exports, pkgInfo) => {
        for (const func of sqlFunctions) {
          wrapExport(exports.prototype, func, pkgInfo, {
            inspectArgs: (args) => {
              return this.inspectQuery(`libsql.${func}`, args);
            },
          });
        }
      })
      .onFileRequire("./promise.js", (exports, pkgInfo) => {
        for (const func of sqlFunctions) {
          wrapExport(exports.prototype, func, pkgInfo, {
            inspectArgs: (args) => {
              return this.inspectQuery(`libsql.${func}`, args);
            },
          });
        }
      });
  }
}
