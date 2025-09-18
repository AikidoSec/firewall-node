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

const connectionFunctions = [
  "query",
  "execute",
  "prepare",
  "batch",
  "queryStream",
];

const poolFunctions = ["query", "execute", "batch"];

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
    for (const fn of connectionFunctions) {
      wrapExport(exports.prototype, fn, pkgInfo, {
        kind: "sql_op",
        inspectArgs: (args) => this.inspectQuery(args, fn),
      });
    }
  }

  private wrapPool(exports: any, pkgInfo: WrapPackageInfo) {
    for (const fn of poolFunctions) {
      wrapExport(exports.prototype, fn, pkgInfo, {
        kind: "sql_op",
        inspectArgs: (args) => this.inspectQuery(args, fn),
      });
    }
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("mariadb")
      .withVersion("^3.0.0")
      .onFileRequire("lib/connection-promise.js", (exports, pkgInfo) => {
        this.wrapConnection(exports, pkgInfo);
      })
      .onFileRequire("lib/connection-callback.js", (exports, pkgInfo) => {
        this.wrapConnection(exports, pkgInfo);
      })
      .onFileRequire("lib/pool-promise.js", (exports, pkgInfo) => {
        this.wrapPool(exports, pkgInfo);
      })
      .onFileRequire("lib/pool-callback.js", (exports, pkgInfo) => {
        this.wrapPool(exports, pkgInfo);
      })
      .addMultiFileInstrumentation(
        ["lib/connection-promise.js", "lib/connection-callback.js"],
        connectionFunctions.map((fn) => ({
          name: fn,
          nodeType: "MethodDefinition",
          operationKind: "sql_op",
          bindContext: true,
          inspectArgs: (args) => this.inspectQuery(args, fn),
        }))
      )
      .addMultiFileInstrumentation(
        ["lib/pool-promise.js", "lib/pool-callback.js"],
        poolFunctions.map((fn) => ({
          name: fn,
          nodeType: "MethodDefinition",
          operationKind: "sql_op",
          bindContext: true,
          inspectArgs: (args) => this.inspectQuery(args, fn),
        }))
      );
  }
}
