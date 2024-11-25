import type { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapNewInstance } from "../agent/hooks/wrapNewInstance";
import { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectMySQL } from "../vulnerabilities/sql-injection/dialects/SQLDialectMySQL";
import { SQLDialectGeneric } from "../vulnerabilities/sql-injection/dialects/SQLDialectGeneric";
import { SQLDialectPostgres } from "../vulnerabilities/sql-injection/dialects/SQLDialectPostgres";
import { SQLDialectSQLite } from "../vulnerabilities/sql-injection/dialects/SQLDialectSQLite";
import type { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import { getContext } from "../agent/Context";
import type { PrismaPromise } from "@prisma/client";
import { onInspectionInterceptorResult } from "../agent/hooks/wrapExport";
import { getInstance } from "../agent/AgentSingleton";
import type { Agent } from "../agent/Agent";
import { WrapPackageInfo } from "../agent/hooks/WrapPackageInfo";

type AllOperationsQueryExtension = {
  model?: string;
  operation: string;
  args: any;
  query: (args: any) => PrismaPromise<any>;
};

export class Prisma implements Wrapper {
  private rawSQLMethodsToProtect = ["$queryRawUnsafe", "$executeRawUnsafe"];

  // Check if the prisma client is a NoSQL client
  private isNoSQLClient(clientInstance: any): boolean {
    if (
      !clientInstance ||
      typeof clientInstance !== "object" ||
      !("_engineConfig" in clientInstance) ||
      !clientInstance._engineConfig ||
      typeof clientInstance._engineConfig !== "object" ||
      !("activeProvider" in clientInstance._engineConfig) ||
      typeof clientInstance._engineConfig.activeProvider !== "string"
    ) {
      return false;
    }

    return clientInstance._engineConfig.activeProvider === "mongodb";
  }

  // Try to detect the SQL dialect used by the Prisma client, so we can use the correct SQL dialect for the SQL injection detection.
  private getClientSQLDialect(clientInstance: any): SQLDialect {
    // https://github.com/prisma/prisma/blob/559988a47e50b4d4655dc45b11ceb9b5c73ef053/packages/generator-helper/src/types.ts#L75
    if (
      !clientInstance ||
      typeof clientInstance !== "object" ||
      !("_engineConfig" in clientInstance) ||
      !clientInstance._engineConfig ||
      typeof clientInstance._engineConfig !== "object" ||
      !("activeProvider" in clientInstance._engineConfig) ||
      typeof clientInstance._engineConfig.activeProvider !== "string"
    ) {
      return new SQLDialectGeneric();
    }

    switch (clientInstance._engineConfig.activeProvider) {
      case "mysql":
        return new SQLDialectMySQL();
      case "postgresql":
      case "postgres":
        return new SQLDialectPostgres();
      case "sqlite":
        return new SQLDialectSQLite();
      default:
        return new SQLDialectGeneric();
    }
  }

  private inspectSQLQuery(
    args: unknown[],
    operation: string,
    dialect: SQLDialect
  ): InterceptorResult {
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
        dialect: dialect,
      });
    }

    return undefined;
  }

  private onClientOperation({
    model,
    operation,
    args,
    query,
    isNoSQLClient,
    sqlDialect,
    agent,
    pkgInfo,
  }: AllOperationsQueryExtension & {
    isNoSQLClient: boolean;
    sqlDialect?: SQLDialect;
    agent: Agent;
    pkgInfo: WrapPackageInfo;
  }) {
    let inspectionResult: InterceptorResult | undefined;
    const start = performance.now();

    if (!isNoSQLClient && this.rawSQLMethodsToProtect.includes(operation)) {
      inspectionResult = this.inspectSQLQuery(
        args,
        operation,
        sqlDialect || new SQLDialectGeneric()
      );
    }

    if (inspectionResult) {
      onInspectionInterceptorResult(
        getContext(),
        agent,
        inspectionResult,
        pkgInfo,
        start
      );
    }

    return query(args);
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("@prisma/client")
      .withVersion("^5.0.0")
      .onRequire((exports, pkgInfo) => {
        wrapNewInstance(exports, "PrismaClient", pkgInfo, (instance) => {
          const isNoSQLClient = this.isNoSQLClient(instance);

          const agent = getInstance();
          if (!agent) {
            return;
          }

          // https://www.prisma.io/docs/orm/prisma-client/client-extensions/query#modify-all-operations-in-all-models-of-your-schema
          return instance.$extends({
            query: {
              $allOperations: ({
                model,
                operation,
                args,
                query,
              }: AllOperationsQueryExtension) => {
                return this.onClientOperation({
                  model,
                  operation,
                  args,
                  query,
                  isNoSQLClient,
                  sqlDialect: !isNoSQLClient
                    ? this.getClientSQLDialect(instance)
                    : undefined,
                  agent,
                  pkgInfo,
                });
              },
            },
          });
        });
      });
  }
}
