/* eslint-disable prefer-rest-params */
import { Agent } from "../agent/Agent";
import { getInstance } from "../agent/AgentSingleton";
import { getContext, mutateContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import type { ExecutionArgs } from "graphql/execution/execute";
import { isPlainObject } from "../helpers/isPlainObject";
import { extractInputsFromDocument } from "./graphql/extractInputsFromDocument";
import { extractTopLevelFieldsFromDocument } from "./graphql/extractTopLevelFieldsFromDocument";
import { wrap } from "../helpers/wrap";
import { shouldRateLimitOperation } from "./graphql/shouldRateLimitOperation";

export class GraphQL implements Wrapper {
  private inspectGraphQLExecute(
    args: unknown[],
    subject: unknown,
    agent: Agent
  ): void {
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
        mutateContext(context, "graphql", context.graphql.concat(userInputs));
      } else {
        mutateContext(context, "graphql", userInputs);
      }
    }
  }

  private createExecuteWrapper(original: Function) {
    const { GraphQLError } = require("graphql");

    return function wrappedExecute(this: unknown) {
      const context = getContext();
      const agent = getInstance();

      if (!context || !agent) {
        return original.apply(this, arguments);
      }

      const args = Array.from(arguments);

      if (!Array.isArray(args) || !isPlainObject(args[0])) {
        return original.apply(this, arguments);
      }

      const result = shouldRateLimitOperation(
        agent,
        context,
        args[0] as unknown as ExecutionArgs
      );

      if (result.block) {
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

      return original.apply(this, arguments);
    };
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("graphql")
      .withVersion("^16.0.0")
      .addFile("execution/execute.js")
      .addSubject((exports) => {
        // We don't have a hook yet to modify the return value of a function
        // We need to refactor this system to allow for that
        // For now, we'll wrap the execute function manually
        wrap(exports, "execute", this.createExecuteWrapper);

        return exports;
      })
      .inspect("execute", this.inspectGraphQLExecute)
      .inspect("executeSync", this.inspectGraphQLExecute);
  }
}
