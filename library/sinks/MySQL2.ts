import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectMySQL } from "../vulnerabilities/sql-injection/dialects/SQLDialectMySQL";

export class MySQL2 implements Wrapper {
  private readonly dialect: SQLDialect = new SQLDialectMySQL();

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

      if (
        isPlainObject(args[0]) &&
        args[0].sql &&
        typeof args[0].sql === "string"
      ) {
        const sql = args[0].sql;

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
    const pkg = hooks.addPackage("mysql2");
    // For all versions of mysql2 newer than 3.0.0
    pkg.withVersion("^3.0.0").onRequire((exports, pkgInfo) => {
      console.error("!!! mysql2");
      // Wrap connection.query
      wrapExport(exports.Connection.prototype, "query", pkgInfo, {
        inspectArgs: (args, agent) => this.inspectQuery("mysql2.query", args),
      });

      // Wrap connection.execute
      wrapExport(exports.Connection.prototype, "execute", pkgInfo, {
        inspectArgs: (args, agent) => this.inspectQuery("mysql2.execute", args),
      });
    });

    // For all versions of mysql2 newer than 3.11.0
    // Reason: https://github.com/sidorares/node-mysql2/pull/3081
    pkg
      .withVersion("^3.11.0")
      .onFileRequire("promise.js", (exports, pkgInfo) => {
        // Wrap PromiseConnection.query
        wrapExport(exports.PromiseConnection.prototype, "query", pkgInfo, {
          inspectArgs: (args, agent) => this.inspectQuery("mysql2.query", args),
        });

        // Wrap PromiseConnection.execute
        wrapExport(exports.PromiseConnection.prototype, "execute", pkgInfo, {
          inspectArgs: (args, agent) =>
            this.inspectQuery("mysql2.execute", args),
        });
      });
  }
}
