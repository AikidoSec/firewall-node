import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { wrapExport } from "../agent/hooks/wrapExport";
import { WrapPackageInfo } from "../agent/hooks/WrapPackageInfo";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { isWrapped } from "../helpers/wrap";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectMySQL } from "../vulnerabilities/sql-injection/dialects/SQLDialectMySQL";

export class MySQL2 implements Wrapper {
  private readonly dialect: SQLDialect = new SQLDialectMySQL();

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

      if (
        isPlainObject(args[0]) &&
        args[0].sql &&
        typeof args[0].sql === "string"
      ) {
        const sql = args[0].sql;

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

  // This function is copied from the OpenTelemetry MySQL2 instrumentation (Apache 2.0 license)
  // https://github.com/open-telemetry/opentelemetry-js-contrib/blob/21e1331a29e06092fb1e460ca99e0c28b1b57ac4/plugins/node/opentelemetry-instrumentation-mysql2/src/utils.ts#L150
  private getConnectionPrototypeToInstrument(connection: any) {
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

  wrap(hooks: Hooks) {
    const wrapConnection = (
      exports: any,
      pkgInfo: WrapPackageInfo,
      isPromise: boolean
    ) => {
      const connectionPrototype = this.getConnectionPrototypeToInstrument(
        isPromise ? exports.PromiseConnection : exports.Connection
      );

      if (!isWrapped(connectionPrototype.query)) {
        // Wrap connection.query
        wrapExport(connectionPrototype, "query", pkgInfo, {
          inspectArgs: (args) => this.inspectQuery("mysql2.query", args),
        });
      }

      if (!isWrapped(connectionPrototype.execute)) {
        // Wrap connection.execute
        wrapExport(connectionPrototype, "execute", pkgInfo, {
          inspectArgs: (args) => this.inspectQuery("mysql2.execute", args),
        });
      }
    };

    const pkg = hooks.addPackage("mysql2");
    // For all versions of mysql2 newer than 3.0.0
    pkg
      .withVersion("^3.0.0")
      .onRequire((exports, pkgInfo) => wrapConnection(exports, pkgInfo, false));

    // For all versions of mysql2 newer than / equal 3.11.5
    // Reason: https://github.com/sidorares/node-mysql2/pull/3081
    pkg
      .withVersion("^3.11.5")
      .onFileRequire("promise.js", (exports, pkgInfo) => {
        return wrapConnection(exports, pkgInfo, true);
      })
      .addFileInstrumentation({
        path: "lib/base/connection.js",
        functions: [
          {
            nodeType: "MethodDefinition",
            name: "query",
            inspectArgs: (args) => this.inspectQuery("mysql2.query", args),
          },
          {
            nodeType: "MethodDefinition",
            name: "execute",
            inspectArgs: (args) => this.inspectQuery("mysql2.execute", args),
          },
        ],
      });
  }
}
