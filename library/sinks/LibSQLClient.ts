import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectSQLite } from "../vulnerabilities/sql-injection/dialects/SQLDialectSQLite";

export class LibSQLClient implements Wrapper {
  private readonly dialect: SQLDialect = new SQLDialectSQLite();

  private inspectQuery(operation: string, args: unknown[]): InterceptorResult {
    const context = getContext();
    if (!context || args.length === 0) {
      return undefined;
    }

    const sqlStatements = this.extractSQLStatements(args);

    for (const sql of sqlStatements) {
      const result = checkContextForSqlInjection({
        sql,
        context,
        operation: operation,
        dialect: this.dialect,
      });

      if (result) {
        return result;
      }
    }

    return undefined;
  }

  private extractSQLStatements(args: unknown[]): string[] {
    // Argument is a string
    if (typeof args[0] === "string" && args[0].length > 0) {
      return [args[0] as string];
    }

    // Argument is an object with a sql property that is a string
    if (
      isPlainObject(args[0]) &&
      !Array.isArray(args[0]) &&
      typeof args[0].sql === "string"
    ) {
      return [args[0].sql];
    }

    // Argument is an array of strings or objects with a sql property
    if (Array.isArray(args[0])) {
      return args[0].flatMap((arg) => {
        if (typeof arg === "string") {
          return [arg];
        }

        if (isPlainObject(arg) && typeof arg.sql === "string") {
          return [arg.sql];
        }

        return [];
      });
    }

    return [];
  }

  wrap(hooks: Hooks) {
    const sqlFunctions = ["execute", "executeMultiple", "batch", "migrate"];

    // Todo transactions

    hooks
      .addPackage("@libsql/client")
      .withVersion("^0.14.0")
      .onRequire((exports, pkgInfo) => {
        // Modify the return value of createClient function -> the client object
        wrapExport(exports, "createClient", pkgInfo, {
          modifyReturnValue: (args, returnValue, agent) => {
            // Wrap all SQL functions
            for (const func of sqlFunctions) {
              wrapExport(returnValue, func, pkgInfo, {
                inspectArgs: (args) => {
                  return this.inspectQuery(`@libsql/client.${func}`, args);
                },
              });
            }
            return returnValue;
          },
        });
      });
  }
}
