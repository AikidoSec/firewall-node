/* eslint-disable prefer-rest-params */
import { Agent } from "../agent/Agent";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import type { ExecutionArgs } from "graphql/execution/execute";
import { extractInputsFromDocument } from "./graphql/extractInputsFromDocument";
import { extractTopLevelFieldsFromDocument } from "./graphql/extractTopLevelFieldsFromDocument";

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
          topLevelFields.fields
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
        context.graphql.push(...userInputs);
      } else {
        context.graphql = userInputs;
      }
    }
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("graphql")
      .withVersion("^16.0.0")
      .addFile("execution/execute.js")
      .addSubject((exports) => exports)
      .inspect("execute", this.inspectGraphQLExecute)
      .inspect("executeSync", this.inspectGraphQLExecute);
  }
}
