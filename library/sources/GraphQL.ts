/* eslint-disable prefer-rest-params */
import { Agent } from "../agent/Agent";
import { getContext, updateContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import type { ExecutionArgs } from "graphql/execution/execute";
import { isPlainObject } from "../helpers/isPlainObject";
import { extractInputsFromDocument } from "./graphql/extractInputsFromDocument";
import { extractTopLevelFieldsFromDocument } from "./graphql/extractTopLevelFieldsFromDocument";
import { shouldRateLimitOperation } from "./graphql/shouldRateLimitOperation";
import { wrapExport } from "../agent/hooks/wrapExport";

export class GraphQL implements Wrapper {
  private inspectGraphQLExecute(args: unknown[], agent: Agent): void {
    if (!Array.isArray(args) || typeof args[0] !== "object") {
      return;
    }

    const executeArgs = args[0] as ExecutionArgs;
    const context = getContext();

    if (!context) {
      // We expect the context to be set by the wrapped http server
      return;
    }

    if (context.method && context.route) {
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

    const userInputs = extractInputsFromDocument(executeArgs.document);

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

    if (userInputs.length > 0) {
      if (Array.isArray(context.graphql)) {
        updateContext(context, "graphql", context.graphql.concat(userInputs));
      } else {
        updateContext(context, "graphql", userInputs);
      }
    }
  }

  private handleRateLimiting(
    args: unknown[],
    origReturnVal: unknown,
    agent: Agent
  ) {
    const context = getContext();

    if (!context || !agent) {
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
      const { GraphQLError } = require("graphql");

      return {
        errors: [
          new GraphQLError("You are rate limited by Aikido firewall.", {
            nodes: [result.field],
            extensions: {
              code: "RATE_LIMITED_BY_AIKIDO_FIREWALL",
              ipAddress: context.remoteAddress,
            },
          }),
        ],
      };
    }

    return origReturnVal;
  }

  wrap(hooks: Hooks) {
    const methods = ["execute", "executeSync"] as const;

    hooks
      .addPackage("graphql")
      .withVersion("^16.0.0")
      .onFileRequire("execution/execute.js", (exports, pkgInfo) => {
        for (const method of methods) {
          wrapExport(exports, method, pkgInfo, {
            modifyReturnValue: (args, returnValue, agent) =>
              this.handleRateLimiting(args, returnValue, agent),
            inspectArgs: (args, agent) =>
              this.inspectGraphQLExecute(args, agent),
          });
        }
      });
  }
}
