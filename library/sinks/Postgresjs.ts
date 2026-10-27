import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { Wrapper } from "../agent/Wrapper";
import { getContext } from "../agent/Context";
import { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectPostgres } from "../vulnerabilities/sql-injection/dialects/SQLDialectPostgres";
import { wrapExport } from "../agent/hooks/wrapExport";
import { checkContextForSqlInjectionAndIdor } from "../vulnerabilities/checkContextForSqlInjectionAndIdor";

export class Postgresjs implements Wrapper {
  private readonly dialect: SQLDialect = new SQLDialectPostgres();

  private resolvePlaceholder(
    placeholder: string,
    params: unknown[] | undefined
  ): unknown {
    const match = /^\$(\d+)$/.exec(placeholder);
    if (!match || !params) {
      return undefined;
    }

    return params[Number.parseInt(match[1], 10) - 1];
  }

  private inspectQuery(args: unknown[]): InterceptorResult {
    if (typeof args[0] !== "string" || args[0].length === 0) {
      return undefined;
    }

    const sql = args[0];
    const params = Array.isArray(args[1]) ? args[1] : undefined;

    return checkContextForSqlInjectionAndIdor({
      sql,
      operation: "sql.unsafe",
      context: getContext(),
      dialect: this.dialect,
      resolvePlaceholder: (placeholder) =>
        this.resolvePlaceholder(placeholder, params),
    });
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
