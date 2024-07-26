import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import type { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectSQLite } from "../vulnerabilities/sql-injection/dialects/SQLDialectSQLite";

export class NodeSQLite implements Wrapper {
  private readonly dialect: SQLDialect = new SQLDialectSQLite();

  wrap(hooks: Hooks) {
    const database = hooks
      .addBuiltinModule("node:sqlite")
      .addSubject((exports) => {
        return exports.DatabaseSync.prototype;
      });

    const sqlFunctions = ["exec", "prepare"];

    for (const func of sqlFunctions) {
      database.inspect(func, (args) => {
        return this.inspectQuery(`node:sqlite.${func}`, args);
      });
    }
  }

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
}
