import type { StatementSync } from "node:sqlite";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import type { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectSQLite } from "../vulnerabilities/sql-injection/dialects/SQLDialectSQLite";

const zenRawQuerySymbol = Symbol("zen.node.sqlite.rawQuery");

export class NodeSQLite implements Wrapper {
  private readonly dialect: SQLDialect = new SQLDialectSQLite();

  wrap(hooks: Hooks) {
    const dbSqlFunctions = ["exec"];
    const statementSqlFunctions = ["all", "get", "iterate", "run", "columns"];
    const tagStoreSqlFunctions = ["all", "get", "iterate", "run"];

    // Omit node: prefix because its an internal module
    hooks.addBuiltinModule("sqlite").onRequire((exports, pkgInfo) => {
      const dbSyncProto = exports.DatabaseSync.prototype;
      for (const func of dbSqlFunctions) {
        wrapExport(dbSyncProto, func, pkgInfo, {
          kind: "sql_op",
          inspectArgs: (args) => this.inspectQuery(`node:sqlite.${func}`, args),
        });
      }

      wrapExport(dbSyncProto, "prepare", pkgInfo, {
        kind: "sql_op",
        modifyReturnValue: (args, returnValue) =>
          this.addRawQueryToStatement(returnValue as StatementSync, args),
      });

      const statementProto = exports.StatementSync.prototype;
      for (const func of statementSqlFunctions) {
        wrapExport(statementProto, func, pkgInfo, {
          kind: "sql_op",
          inspectArgs: (_args, _agent, subject) =>
            this.inspectStatementQuery(
              `node:sqlite.StatementSync.${func}`,
              subject as StatementSync
            ),
        });
      }

      if (typeof dbSyncProto.createTagStore === "function") {
        wrapExport(dbSyncProto, "createTagStore", pkgInfo, {
          kind: "sql_op",
          modifyReturnValue: (_args, returnValue) => {
            for (const func of tagStoreSqlFunctions) {
              wrapExport(returnValue, func, pkgInfo, {
                kind: "sql_op",
                inspectArgs: (args) =>
                  this.inspectTagStoreQuery(
                    `node:sqlite.SQLTagStore.${func}`,
                    args
                  ),
              });
            }
            return returnValue;
          },
        });
      }
    });
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

  private addRawQueryToStatement(
    statement: StatementSync,
    args: unknown[]
  ): StatementSync {
    if (args.length === 0 || typeof args[0] !== "string") {
      return statement;
    }

    // Store the raw SQL query on the statement so we can use it later in the inspection.
    // We can not use the existing sourceSQL or expandedSQL properties
    // because e.g. comments get stripped out in those, and comments can be used in SQL injection attacks.
    Object.defineProperty(statement, zenRawQuerySymbol, {
      value: args[0],
      enumerable: false,
      configurable: false,
      writable: false,
    });

    return statement;
  }

  private inspectStatementQuery(
    operation: string,
    statement: StatementSync & { [zenRawQuerySymbol]?: string }
  ): InterceptorResult {
    const context = getContext();
    const rawQuery = statement[zenRawQuerySymbol];
    if (!context || !rawQuery) {
      return undefined;
    }

    return checkContextForSqlInjection({
      operation: operation,
      sql: rawQuery,
      context: context,
      dialect: this.dialect,
    });
  }

  private isTaggedTemplate(obj: unknown): obj is TemplateStringsArray {
    return Array.isArray(obj) && "raw" in obj && typeof obj.raw === "object";
  }

  private inspectTagStoreQuery(
    operation: string,
    args: unknown[]
  ): InterceptorResult {
    const context = getContext();
    if (!context) {
      return undefined;
    }

    if (args.length === 0 || !this.isTaggedTemplate(args[0])) {
      return undefined;
    }

    const sql = args[0].join("?");

    return checkContextForSqlInjection({
      operation: operation,
      sql: sql,
      context: context,
      dialect: this.dialect,
    });
  }
}
