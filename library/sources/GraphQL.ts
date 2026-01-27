/* eslint-disable max-lines-per-function */
import { Agent } from "../agent/Agent";
import { Context, getContext, updateContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { WrapPackageInfo } from "../agent/hooks/WrapPackageInfo";
import { Wrapper } from "../agent/Wrapper";
import type { ExecutionArgs } from "graphql/execution/execute";
import { isPlainObject } from "../helpers/isPlainObject";
import { extractInputsFromDocument } from "./graphql/extractInputsFromDocument";
import { extractTopLevelFieldsFromDocument } from "./graphql/extractTopLevelFieldsFromDocument";
import { isGraphQLOverHTTP } from "./graphql/isGraphQLOverHTTP";
import { shouldRateLimitOperation } from "./graphql/shouldRateLimitOperation";
import { wrapExport } from "../agent/hooks/wrapExport";

export class GraphQL implements Wrapper {
  private printSchema: typeof import("graphql").printSchema | undefined;
  private visit: typeof import("graphql").visit | undefined;
  private GraphQLError: typeof import("graphql").GraphQLError | undefined;

  private discoverGraphQLSchema(
    context: Context,
    executeArgs: ExecutionArgs,
    agent: Agent
  ) {
    if (!this.printSchema) {
      return;
    }

    if (!executeArgs.schema) {
      return;
    }

    if (!context.method || !context.route) {
      return;
    }

    if (!agent.hasGraphQLSchema(context.method, context.route)) {
      try {
        const schema = this.printSchema(executeArgs.schema);

        agent.onGraphQLSchema(context.method, context.route, schema);
      } catch {
        // Ignore errors
      }
    }
  }

  private discoverGraphQLQueryFields(
    context: Context,
    executeArgs: ExecutionArgs,
    agent: Agent
  ) {
    if (!context.method || !context.route) {
      return;
    }

    const topLevelFields = extractTopLevelFieldsFromDocument(
      executeArgs.document,
      executeArgs.operationName ? executeArgs.operationName : undefined
    );

    if (topLevelFields) {
      agent.onGraphQLExecute(
        context.method,
        context.route,
        topLevelFields.type,
        topLevelFields.fields.map((field) => field.name.value)
      );
    }
  }

  private inspectGraphQLExecute(args: unknown[], agent: Agent): void {
    if (!Array.isArray(args) || typeof args[0] !== "object" || !this.visit) {
      return;
    }

    const executeArgs = args[0] as ExecutionArgs;
    const context = getContext();

    if (!context) {
      // We expect the context to be set by the wrapped http server
      return;
    }

    if (
      context &&
      context.method &&
      context.route &&
      isGraphQLOverHTTP(context)
    ) {
      // We only want to discover GraphQL over HTTP
      // We should ignore queries coming from a GraphQL client in SSR mode
      this.discoverGraphQLSchema(context, executeArgs, agent);
      this.discoverGraphQLQueryFields(context, executeArgs, agent);
    }

    const userInputs = extractInputsFromDocument(
      executeArgs.document,
      this.visit
    );

    if (
      executeArgs.variableValues &&
      typeof executeArgs.variableValues === "object"
    ) {
      for (const value of Object.values(executeArgs.variableValues)) {
        if (typeof value === "string") {
          userInputs.push(value);
        }
      }
    }

    if (Array.isArray(context.graphql)) {
      updateContext(context, "graphql", context.graphql.concat(userInputs));
    } else {
      updateContext(context, "graphql", userInputs);
    }
  }

  private handleRateLimiting(
    args: unknown[],
    origReturnVal: unknown,
    agent: Agent
  ) {
    const context = getContext();

    if (!context || !agent || !this.GraphQLError) {
      return origReturnVal;
    }

    if (!Array.isArray(args) || !isPlainObject(args[0])) {
      return origReturnVal;
    }

    const result = shouldRateLimitOperation(
      agent,
      context,
      args[0] as unknown as ExecutionArgs
    );

    if (result.block) {
      // Mark the request as rate limited in the context
      updateContext(context, "rateLimitedEndpoint", result.endpoint);

      return {
        errors: [
          new this.GraphQLError("You are rate limited by Zen.", {
            nodes: [result.field],
            extensions: {
              code: "RATE_LIMITED_BY_ZEN",
              ipAddress: context.remoteAddress,
            },
          }),
        ],
      };
    }

    return origReturnVal;
  }

  private wrapExecution(exports: unknown, pkgInfo: WrapPackageInfo) {
    const methods = ["execute", "executeSync"];

    for (const method of methods) {
      wrapExport(exports, method, pkgInfo, {
        kind: "graphql_op",
        modifyReturnValue: (args, returnValue, agent) =>
          this.handleRateLimiting(args, returnValue, agent),
        inspectArgs: (args, agent) => this.inspectGraphQLExecute(args, agent),
      });
    }
  }

  wrap(hooks: Hooks) {
    const graphqlPkg = hooks
      .addPackage("graphql")
      .withVersion("^15.0.0 || ^16.0.0");

    graphqlPkg
      .onFileRequire("execution/execute.js", (exports, pkgInfo) => {
        this.wrapExecution(exports, pkgInfo);
      })
      .onRequire((exports) => {
        this.printSchema = exports.printSchema;
        this.visit = exports.visit;
        this.GraphQLError = exports.GraphQLError;
      })
      .addMultiFileInstrumentation(
        ["execution/execute.js", "execution/execute.mjs"],
        ["execute", "executeSync"].map((method) => ({
          name: method,
          operationKind: "graphql_op",
          nodeType: "FunctionDeclaration",
          modifyReturnValue: (args, returnValue, agent) =>
            this.handleRateLimiting(args, returnValue, agent),
          inspectArgs: (args, agent) => this.inspectGraphQLExecute(args, agent),
        }))
      );

    const localVariableAndFiles = new Map([
      ["language/visitor.js", "visit"],
      ["language/visitor.mjs", "visit"],
      ["utilities/printSchema.js", "printSchema"],
      ["utilities/printSchema.mjs", "printSchema"],
      ["error/GraphQLError.js", "GraphQLError"],
      ["error/GraphQLError.mjs", "GraphQLError"],
    ]);

    for (const [file, variable] of localVariableAndFiles) {
      graphqlPkg.addFileInstrumentation({
        path: file,
        functions: [],
        accessLocalVariables: {
          names: [variable],
          cb: (value) => {
            this[variable as keyof this] = value[0];
          },
        },
      });
    }

    hooks
      .addPackage("@graphql-tools/executor")
      .withVersion("^1.0.0")
      .onFileRequire("cjs/execution/execute.js", (exports, pkgInfo) => {
        this.wrapExecution(exports, pkgInfo);
      })
      .addMultiFileInstrumentation(
        ["cjs/execution/execute.js", "esm/execution/execute.js"],
        ["execute", "executeSync"].map((method) => ({
          name: method,
          operationKind: "graphql_op",
          nodeType: "FunctionDeclaration",
          modifyReturnValue: (args, returnValue, agent) =>
            this.handleRateLimiting(args, returnValue, agent),
          inspectArgs: (args, agent) => this.inspectGraphQLExecute(args, agent),
        }))
      );
  }
}
