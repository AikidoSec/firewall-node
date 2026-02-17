import { Context, getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import type { PackageFunctionInstrumentationInstruction } from "../agent/hooks/instrumentation/types";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForIdor } from "../vulnerabilities/idor/checkContextForIdor";
import { checkContextForPathTraversal } from "../vulnerabilities/path-traversal/checkContextForPathTraversal";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectSQLite } from "../vulnerabilities/sql-injection/dialects/SQLDialectSQLite";

export class BetterSQLite3 implements Wrapper {
  private readonly dialect: SQLDialect = new SQLDialectSQLite();

  private inspectQuery(operation: string, args: unknown[]): InterceptorResult {
    const context = getContext();
    if (!context) {
      return undefined;
    }

    if (args.length > 0) {
      if (typeof args[0] === "string" && args[0].length > 0) {
        const sql = args[0];
        return this.inspectSQLCommand(sql, context, operation);
      }
    }

    return undefined;
  }

  private inspectStatementOperation(
    operation: string,
    args: unknown[],
    statement: unknown
  ) {
    const context = getContext();
    if (!context) {
      return undefined;
    }

    if (
      statement &&
      typeof statement === "object" &&
      "source" in statement &&
      typeof statement.source === "string"
    ) {
      const sql = statement.source;
      // better-sqlite3 accepts params as an array: .all([v1, v2])
      // or as individual arguments: .all(v1, v2)
      let params: unknown[] | undefined;
      if (args.length > 0) {
        params = Array.isArray(args[0]) ? args[0] : args;
      }

      return this.inspectSQLCommand(sql, context, operation, params);
    }
  }

  private inspectSQLCommand(
    sql: string,
    context: Context,
    operation: string,
    params?: unknown[]
  ) {
    const sqlResult = checkContextForSqlInjection({
      operation: operation,
      sql: sql,
      context: context,
      dialect: this.dialect,
    });

    if (sqlResult) {
      return sqlResult;
    }

    return checkContextForIdor({
      sql,
      context,
      dialect: this.dialect,
      resolvePlaceholder: (placeholder, placeholderNumber) =>
        this.resolvePlaceholder(placeholder, placeholderNumber, params),
    });
  }

  private resolvePlaceholder(
    placeholder: string,
    placeholderNumber: number | undefined,
    params: unknown[] | undefined
  ): unknown {
    if (placeholder === "?" && placeholderNumber !== undefined && params) {
      if (placeholderNumber < params.length) {
        return params[placeholderNumber];
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
    const sqlFunctions = ["exec", "pragma"];
    const fsPathFunctions = ["backup", "loadExtension"];
    const statementSqlFunctions = ["run", "get", "all", "iterate", "bind"];

    const pkg = hooks
      .addPackage("better-sqlite3")
      .withVersion("^12.0.0 || ^11.0.0 || ^10.0.0 || ^9.0.0 || ^8.0.0");

    pkg.onRequire((exports, pkgInfo) => {
      for (const func of sqlFunctions) {
        wrapExport(exports.prototype, func, pkgInfo, {
          kind: "sql_op",
          inspectArgs: (args) => {
            return this.inspectQuery(`better-sqlite3.${func}`, args);
          },
        });
      }
      for (const func of fsPathFunctions) {
        wrapExport(exports.prototype, func, pkgInfo, {
          kind: "fs_op",
          inspectArgs: (args) => {
            return this.inspectPath(`better-sqlite3.${func}`, args);
          },
        });
      }

      wrapExport(exports.prototype, "prepare", pkgInfo, {
        kind: "sql_op",
        modifyReturnValue: (args, statement) => {
          for (const func of statementSqlFunctions) {
            wrapExport(statement, func, pkgInfo, {
              kind: "sql_op",
              inspectArgs: (args, _, statement) => {
                return this.inspectStatementOperation(
                  `better-sqlite3.prepare(...).${func}`,
                  args,
                  statement
                );
              },
            });
          }
          return statement;
        },
      });
    });

    const wrapperFunctionsInstructions: PackageFunctionInstrumentationInstruction[] =
      sqlFunctions.map((func) => ({
        name: `exports.${func}`,
        operationKind: "sql_op",
        nodeType: "FunctionAssignment",
        inspectArgs: (args) => {
          return this.inspectQuery(`better-sqlite3.${func}`, args);
        },
      }));

    wrapperFunctionsInstructions.push({
      name: "exports.prepare",
      operationKind: "sql_op",
      nodeType: "FunctionAssignment",
      modifyReturnValue: (args, statement) => {
        for (const func of statementSqlFunctions) {
          wrapExport(
            statement,
            func,
            {
              name: "better-sqlite3",
              type: "external",
            },
            {
              kind: "sql_op",
              inspectArgs: (args, _, statement) => {
                return this.inspectStatementOperation(
                  `better-sqlite3.prepare(...).${func}`,
                  args,
                  statement
                );
              },
            }
          );
        }
        return statement;
      },
    });

    wrapperFunctionsInstructions.push({
      name: "exports.loadExtension",
      operationKind: "fs_op",
      nodeType: "FunctionAssignment",
      inspectArgs: (args) => {
        return this.inspectPath("better-sqlite3.loadExtension", args);
      },
    });

    pkg.addFileInstrumentation({
      path: "lib/methods/wrappers.js",
      functions: wrapperFunctionsInstructions,
    });

    // Add backup instrumentation
    pkg.addFileInstrumentation({
      path: "lib/methods/backup.js",
      functions: [
        {
          name: "module.exports",
          operationKind: "fs_op",
          nodeType: "FunctionAssignment",
          inspectArgs: (args) => {
            return this.inspectPath("better-sqlite3.backup", args);
          },
        },
      ],
    });
  }
}
