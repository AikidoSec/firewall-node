import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { PackageFunctionInstrumentationInstruction } from "../agent/hooks/instrumentation/types";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { wrapExport } from "../agent/hooks/wrapExport";
import { WrapPackageInfo } from "../agent/hooks/WrapPackageInfo";
import { Wrapper } from "../agent/Wrapper";
import { isWrapped } from "../helpers/wrap";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import { checkContextForIdor } from "../vulnerabilities/idor/checkContextForIdor";
import { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectMySQL } from "../vulnerabilities/sql-injection/dialects/SQLDialectMySQL";

export class MySQL2 implements Wrapper {
  private readonly dialect: SQLDialect = new SQLDialectMySQL();

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

  private findParams(args: unknown[]): unknown[] | undefined {
    if (args.length >= 2 && Array.isArray(args[1])) {
      return args[1];
    }

    return undefined;
  }

  private getSQLStringFromArgs(args: unknown[]): {
    sql: string | undefined;
    params: unknown[] | undefined;
  } {
    if (args.length <= 0) {
      return { sql: undefined, params: undefined };
    }

    if (typeof args[0] === "string" && args[0].length > 0) {
      const sql = args[0];

      return {
        sql,
        params: this.findParams(args),
      };
    }

    // Do not use isPlainObject here, since mysql2 Pools pass complex objects
    if (
      args[0] &&
      typeof args[0] === "object" &&
      !Array.isArray(args[0]) &&
      "sql" in args[0] &&
      typeof args[0].sql === "string"
    ) {
      const sql = args[0].sql;

      return {
        sql,
        params: this.findParams(args),
      };
    }

    return { sql: undefined, params: undefined };
  }

  private inspectQuery(operation: string, args: unknown[]): InterceptorResult {
    const context = getContext();
    if (!context) {
      return undefined;
    }

    const { sql, params } = this.getSQLStringFromArgs(args);

    if (!sql) {
      return undefined;
    }

    // Check for SQL injection first to block malicious queries before parsing SQL query for IDOR analysis
    const sqlInjectionResult = checkContextForSqlInjection({
      operation: operation,
      sql: sql,
      context: context,
      dialect: this.dialect,
    });
    if (sqlInjectionResult) {
      return sqlInjectionResult;
    }

    return checkContextForIdor({
      sql,
      context,
      dialect: this.dialect,
      resolvePlaceholder: (placeholder, placeholderNumber) =>
        this.resolvePlaceholder(placeholder, placeholderNumber, params),
    });
  }

  // This function is copied from the OpenTelemetry MySQL2 instrumentation (Apache 2.0 license)
  // https://github.com/open-telemetry/opentelemetry-js-contrib/blob/21e1331a29e06092fb1e460ca99e0c28b1b57ac4/plugins/node/opentelemetry-instrumentation-mysql2/src/utils.ts#L150
  private getPrototypeToInstrument(connection: any) {
    const connectionPrototype = connection.prototype;
    const basePrototype = Object.getPrototypeOf(connectionPrototype);

    // mysql2@3.11.5 included a refactoring, where most code was moved out of the `Connection` class and into a shared base
    // so we need to instrument that instead, see https://github.com/sidorares/node-mysql2/pull/3081
    // This checks if the functions we're instrumenting are there on the base - we cannot use the presence of a base
    // prototype since EventEmitter is the base for mysql2@<=3.11.4
    if (
      typeof basePrototype?.query === "function" &&
      typeof basePrototype?.execute === "function"
    ) {
      return basePrototype;
    }

    // otherwise instrument the connection directly.
    return connectionPrototype;
  }

  private getConnectionFunctionInstructions(): PackageFunctionInstrumentationInstruction[] {
    return [
      {
        nodeType: "MethodDefinition",
        name: "query",
        inspectArgs: (args) => this.inspectQuery("mysql2.query", args),
        operationKind: "sql_op",
        bindContext: true,
      },
      {
        nodeType: "MethodDefinition",
        name: "execute",
        inspectArgs: (args) => this.inspectQuery("mysql2.execute", args),
        operationKind: "sql_op",
        bindContext: true,
      },
      {
        nodeType: "MethodDefinition",
        name: "prepare",
        inspectArgs: (args) => this.inspectQuery("mysql2.prepare", args),
        operationKind: "sql_op",
        bindContext: true,
      },
    ];
  }

  private getPoolFunctionInstructions(): PackageFunctionInstrumentationInstruction[] {
    return [
      {
        nodeType: "MethodDefinition",
        name: "getConnection",
        // This is required to bind the context, so that we do not loose context
        // on pool operations like pool.query or pool.execute which internally call getConnection
        // with a callback function
        inspectArgs: () => {},
        operationKind: "sql_op",
        bindContext: true,
      },
      {
        nodeType: "MethodDefinition",
        name: "query",
        inspectArgs: (args) => this.inspectQuery("mysql2.query", args),
        operationKind: "sql_op",
        bindContext: true,
      },
      {
        nodeType: "MethodDefinition",
        name: "execute",
        inspectArgs: (args) => this.inspectQuery("mysql2.execute", args),
        operationKind: "sql_op",
        bindContext: true,
      },
    ];
  }

  wrap(hooks: Hooks) {
    const wrapConnectionAndPool = (
      exports: any,
      pkgInfo: WrapPackageInfo,
      isPromise: boolean
    ) => {
      const connectionPrototype = this.getPrototypeToInstrument(
        isPromise ? exports.PromiseConnection : exports.Connection
      );

      if (!isWrapped(connectionPrototype.query)) {
        // Wrap connection.query
        wrapExport(connectionPrototype, "query", pkgInfo, {
          kind: "sql_op",
          inspectArgs: (args) => this.inspectQuery("mysql2.query", args),
        });
      }

      if (!isWrapped(connectionPrototype.execute)) {
        // Wrap connection.execute
        wrapExport(connectionPrototype, "execute", pkgInfo, {
          kind: "sql_op",
          inspectArgs: (args) => this.inspectQuery("mysql2.execute", args),
        });
      }

      if (!isWrapped(connectionPrototype.prepare)) {
        // Wrap connection.prepare
        wrapExport(connectionPrototype, "prepare", pkgInfo, {
          kind: "sql_op",
          inspectArgs: (args) => this.inspectQuery("mysql2.prepare", args),
        });
      }

      const poolPrototype = this.getPrototypeToInstrument(
        isPromise ? exports.PromisePool : exports.Pool
      );

      if (!isWrapped(poolPrototype.getConnection)) {
        // Wrap pool.getConnection
        wrapExport(poolPrototype, "getConnection", pkgInfo, {
          kind: "sql_op",
          // This is required to bind the context, so that we do not loose context
          // on pool operations like pool.query or pool.execute which internally call getConnection
          // with a callback function
          inspectArgs: () => {},
        });
      }

      if (!isWrapped(poolPrototype.query)) {
        // Wrap pool.query
        wrapExport(poolPrototype, "query", pkgInfo, {
          kind: "sql_op",
          inspectArgs: (args) => this.inspectQuery("mysql2.query", args),
        });
      }

      if (!isWrapped(poolPrototype.execute)) {
        // Wrap pool.execute
        wrapExport(poolPrototype, "execute", pkgInfo, {
          kind: "sql_op",
          inspectArgs: (args) => this.inspectQuery("mysql2.execute", args),
        });
      }
    };

    const pkg = hooks.addPackage("mysql2");
    // For all versions of mysql2 newer than 3.0.0
    pkg
      .withVersion("^3.0.0")
      .onRequire((exports, pkgInfo) =>
        wrapConnectionAndPool(exports, pkgInfo, false)
      )
      .addFileInstrumentation({
        path: "lib/connection.js",
        functions: this.getConnectionFunctionInstructions(),
      })
      .addFileInstrumentation({
        path: "lib/pool.js",
        functions: this.getPoolFunctionInstructions(),
      });

    // For all versions of mysql2 newer than / equal 3.11.5
    // Reason: https://github.com/sidorares/node-mysql2/pull/3081
    pkg
      .withVersion("^3.11.5")
      .onFileRequire("promise.js", (exports, pkgInfo) => {
        return wrapConnectionAndPool(exports, pkgInfo, true);
      })
      .addFileInstrumentation({
        path: "lib/base/connection.js",
        functions: this.getConnectionFunctionInstructions(),
      })
      .addFileInstrumentation({
        path: "lib/base/pool.js",
        functions: this.getPoolFunctionInstructions(),
      });
  }
}
