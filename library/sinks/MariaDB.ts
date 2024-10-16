import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { wrapExport } from "../agent/hooks/wrapExport";
import { WrapPackageInfo } from "../agent/hooks/WrapPackageInfo";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectMySQL } from "../vulnerabilities/sql-injection/dialects/SQLDialectMySQL";

export class MariaDB implements Wrapper {
  private readonly dialect: SQLDialect = new SQLDialectMySQL();

  private inspectQuery(args: unknown[], operation: string): InterceptorResult {
    const context = getContext();

    if (!context) {
      return undefined;
    }

    if (args.length > 0 && typeof args[0] === "string" && args[0].length > 0) {
      const sql = args[0];

      return checkContextForSqlInjection({
        sql: sql,
        context: context,
        operation: `mariadb.${operation}`,
        dialect: this.dialect,
      });
    }

    if (
      args.length > 0 &&
      isPlainObject(args[0]) &&
      args[0].sql &&
      typeof args[0].sql === "string"
    ) {
      const sql = args[0].sql;

      return checkContextForSqlInjection({
        sql: sql,
        context: context,
        operation: `mariadb.${operation}`,
        dialect: this.dialect,
      });
    }

    return undefined;
  }

  private wrapConnection(exports: any, pkgInfo: WrapPackageInfo) {
    const functions = [
      "query",
      "queryStream",
      "execute",
      "prepare",
      "prepareExecute",
      "executePromise",
      "batch",
    ];

    for (const fn of functions) {
      wrapExport(exports.prototype, fn, pkgInfo, {
        inspectArgs: (args) => this.inspectQuery(args, fn),
      });
    }
  }

  wrap(hooks: Hooks) {
    const mariadb = hooks.addPackage("mariadb").withVersion("^3.0.0");

    mariadb.onFileRequire("lib/connection.js", (exports, pkgInfo) => {
      this.wrapConnection(exports, pkgInfo);
    });

    mariadb.onFileRequire("lib/connection-callback.js", (exports, pkgInfo) => {
      this.wrapConnection(exports, pkgInfo);
    });
  }
}
