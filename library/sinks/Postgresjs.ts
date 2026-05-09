import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { Wrapper } from "../agent/Wrapper";
import { getContext } from "../agent/Context";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectPostgres } from "../vulnerabilities/sql-injection/dialects/SQLDialectPostgres";
import { wrapExport } from "../agent/hooks/wrapExport";

export class Postgresjs implements Wrapper {
  private readonly dialect: SQLDialect = new SQLDialectPostgres();

  private inspectQuery(args: unknown[]): InterceptorResult {
    const context = getContext();

    if (!context) {
      return undefined;
    }

    if (args.length > 0 && typeof args[0] === "string" && args[0].length > 0) {
      const sql: string = args[0];

      return checkContextForSqlInjection({
        sql: sql,
        context: context,
        operation: "sql.unsafe",
        dialect: this.dialect,
      });
    }

    return undefined;
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("postgres")
      .withVersion("^3.0.0")
      .onRequire((exports, pkgInfo) => {
        return wrapExport(exports, undefined, pkgInfo, {
          kind: undefined,
          modifyReturnValue: (args, returnValue) => {
            wrapExport(returnValue, "unsafe", pkgInfo, {
              kind: "sql_op",
              inspectArgs: (args) => this.inspectQuery(args),
            });
            return returnValue;
          },
        });
      })
      .addMultiFileInstrumentation(
        [
          "src/index.js", // ESM
          "cjs/src/index.js", // CJS
        ],
        [
          {
            name: "unsafe",
            nodeType: "FunctionDeclaration",
            operationKind: "sql_op",
            inspectArgs: (args) => this.inspectQuery(args),
          },
        ]
      );
  }
}
