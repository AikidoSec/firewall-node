import type { StatementSync } from "node:sqlite";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import type { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectSQLite } from "../vulnerabilities/sql-injection/dialects/SQLDialectSQLite";
import { checkContextForIdor } from "../vulnerabilities/idor/checkContextForIdor";
import { isPlainObject } from "../helpers/isPlainObject";

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
          inspectArgs: (args, _agent, subject) =>
            this.inspectStatementQuery(
              `node:sqlite.StatementSync.${func}`,
              args,
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

    if (
      args.length === 0 ||
      typeof args[0] !== "string" ||
      args[0].length === 0
    ) {
      return undefined;
    }

    const sql = args[0];

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
      resolvePlaceholder: () =>
        // node:sqlite does not support placeholders in exec
        undefined,
    });
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
    args: unknown[],
    statement: StatementSync & { [zenRawQuerySymbol]?: string }
  ): InterceptorResult {
    const context = getContext();
    const rawQuery = statement[zenRawQuerySymbol];
    if (!context || !rawQuery) {
      return undefined;
    }

    const sqlResult = checkContextForSqlInjection({
      operation: operation,
      sql: rawQuery,
      context: context,
      dialect: this.dialect,
    });

    if (sqlResult) {
      return sqlResult;
    }

    const { namedParameters, anonymousParameters } =
      this.extractStatementParameters(args);

    return checkContextForIdor({
      sql: rawQuery,
      context,
      dialect: this.dialect,
      resolvePlaceholder: (placeholder, placeholderNumber) =>
        this.resolvePlaceholder(
          placeholder,
          placeholderNumber,
          namedParameters,
          anonymousParameters
        ),
    });
  }

  private extractStatementParameters(args: unknown[]): {
    namedParameters: Record<string, unknown> | undefined;
    anonymousParameters: unknown[];
  } {
    if (args.length === 0) {
      return {
        namedParameters: undefined,
        anonymousParameters: [],
      };
    }

    if (isPlainObject(args[0])) {
      return {
        namedParameters: args[0] as Record<string, unknown>,
        anonymousParameters: args.slice(1),
      };
    }

    // node:sqlite treats the first argument as the optional named-parameters position.
    // For non-object first arguments, placeholders like '?' are not bound from that slot.
    return {
      namedParameters: undefined,
      anonymousParameters: args.slice(1),
    };
  }

  private resolvePlaceholder(
    placeholder: string,
    placeholderNumber: number | undefined,
    namedParameters: Record<string, unknown> | undefined,
    anonymousParameters: unknown[]
  ): unknown {
    if (placeholder === "?" && placeholderNumber !== undefined) {
      if (placeholderNumber < anonymousParameters.length) {
        return anonymousParameters[placeholderNumber];
      }
      return undefined;
    }

    if (!namedParameters || placeholder.length <= 1) {
      return undefined;
    }

    const prefix = placeholder[0];
    if (prefix !== ":" && prefix !== "@" && prefix !== "$") {
      return undefined;
    }

    const key = placeholder.slice(1);

    // node:sqlite supports all three prefixes interchangeably, so we check for the key with and without the prefix.
    if (Object.hasOwn(namedParameters, placeholder)) {
      return namedParameters[placeholder];
    }

    if (Object.hasOwn(namedParameters, key)) {
      return namedParameters[key];
    }

    return undefined;
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

    const sqlResult = checkContextForSqlInjection({
      operation: operation,
      sql: sql,
      context: context,
      dialect: this.dialect,
    });

    if (sqlResult) {
      return sqlResult;
    }

    // Todo idor
  }
}
