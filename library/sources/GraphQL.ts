/* eslint-disable prefer-rest-params */
import { getContext, mutateContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import type { ExecutionArgs } from "graphql/execution/execute";
import { extractInputsFromDocument } from "./graphql/extractInputsFromDocument";

export class GraphQL implements Wrapper {
  private inspectGraphQLExecute(args: unknown[]): void {
    if (!Array.isArray(args) || typeof args[0] !== "object") {
      return;
    }
    const executeArgs = args[0] as ExecutionArgs;
    const context = getContext();
    if (!context) {
      // We expect the context to be set by the wrapped http server
      return;
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

  wrap(hooks: Hooks) {
    hooks
      .addPackage("graphql")
      .withVersion("^16.0.0")
      .addFile("execution/execute.js")
      .addSubject((exports) => exports)
      .inspect("execute", (args) => this.inspectGraphQLExecute(args))
      .inspect("executeSync", (args) => this.inspectGraphQLExecute(args));
  }
}
