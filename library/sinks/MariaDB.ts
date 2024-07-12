import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectMySQL } from "../vulnerabilities/sql-injection/dialects/SQLDialectMySQL";

export class MariaDB implements Wrapper {
  private readonly dialect: SQLDialect = new SQLDialectMySQL();

  private inspectQuery(args: unknown[]): InterceptorResult {
    const context = getContext();

    if (!context) {
      return undefined;
    }

    if (args.length > 0 && typeof args[0] === "string" && args[0].length > 0) {
      const sql = args[0];

      return checkContextForSqlInjection({
        sql: sql,
        context: context,
        operation: "MariaDB.query",
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
        operation: "MariaDB.query",
        dialect: this.dialect,
      });
    }

    return undefined;
  }

  wrap(hooks: Hooks) {
    const mariadb = hooks.addPackage("mariadb").withVersion("^3.0.0");

    const connection = mariadb
      .addFile("lib/connection")
      .addSubject((exports) => exports.prototype);

    connection
      .inspect("query", (args) => this.inspectQuery(args))
      .inspect("queryStream", (args) => this.inspectQuery(args))
      .inspect("execute", (args) => this.inspectQuery(args))
      .inspect("prepare", (args) => this.inspectQuery(args));
  }
}
