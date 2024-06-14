/* eslint-disable prefer-rest-params */
import { getContext } from "../agent/Context";
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
      // Todo ?
    }

    console.log(executeArgs);

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

    // Todo Add user inputs to the context
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("graphql")
      .withVersion("^16.0.0")
      .addFile("execution/execute.js")
      .addSubject((exports) => exports)
      .inspect("execute", (args) => this.inspectGraphQLExecute(args))
      .inspect("executeSync", (args) => this.inspectGraphQLExecute(args));
    // Todo parse?
  }
}
