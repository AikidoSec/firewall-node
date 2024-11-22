import type { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapExport } from "../agent/hooks/wrapExport";
import { wrapNewInstance } from "../agent/hooks/wrapNewInstance";
import { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectMySQL } from "../vulnerabilities/sql-injection/dialects/SQLDialectMySQL";
import { SQLDialectGeneric } from "../vulnerabilities/sql-injection/dialects/SQLDialectGeneric";
import { SQLDialectPostgres } from "../vulnerabilities/sql-injection/dialects/SQLDialectPostgres";
import { SQLDialectSQLite } from "../vulnerabilities/sql-injection/dialects/SQLDialectSQLite";
import type { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import { getContext } from "../agent/Context";

export class Prisma implements Wrapper {
  private rawSQLMethodsToWrap = ["$queryRawUnsafe", "$executeRawUnsafe"];

  private dialect: SQLDialect = new SQLDialectGeneric();

  // Try to detect the SQL dialect used by the Prisma client, so we can use the correct SQL dialect for the SQL injection detection.
  private detectSQLDialect(clientInstance: any) {
    // https://github.com/prisma/prisma/blob/559988a47e50b4d4655dc45b11ceb9b5c73ef053/packages/generator-helper/src/types.ts#L75
    if (
      !clientInstance ||
      typeof clientInstance !== "object" ||
      !("_accelerateEngineConfig" in clientInstance) ||
      !clientInstance._accelerateEngineConfig ||
      typeof clientInstance._accelerateEngineConfig !== "object" ||
      !("activeProvider" in clientInstance._accelerateEngineConfig) ||
      typeof clientInstance._accelerateEngineConfig.activeProvider !== "string"
    ) {
      return;
    }

    switch (clientInstance._accelerateEngineConfig.activeProvider) {
      case "mysql":
        this.dialect = new SQLDialectMySQL();
        break;
      case "postgresql":
      case "postgres":
        this.dialect = new SQLDialectPostgres();
        break;
      case "sqlite":
        this.dialect = new SQLDialectSQLite();
        break;
      default:
        // Already set to generic
        break;
    }
  }

  private inspectQuery(args: unknown[], operation: string): InterceptorResult {
    const context = getContext();

    if (!context) {
      return undefined;
    }

    if (args.length > 0 && typeof args[0] === "string" && args[0].length > 0) {
      const sql: string = args[0];

      return checkContextForSqlInjection({
        sql: sql,
        context: context,
        operation: `prisma.${operation}`,
        dialect: this.dialect,
      });
    }

    return undefined;
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("@prisma/client")
      .withVersion("^5.0.0")
      .onRequire((exports, pkgInfo) => {
        wrapNewInstance(exports, "PrismaClient", pkgInfo, (instance) => {
          this.detectSQLDialect(instance);

          for (const method of this.rawSQLMethodsToWrap) {
            if (typeof instance[method] === "function") {
              wrapExport(instance, method, pkgInfo, {
                inspectArgs: (args) => {
                  return this.inspectQuery(args, method);
                },
              });
            }
          }

          // Todo support mongodb methods
        });
      });
  }
}
