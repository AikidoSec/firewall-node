/* eslint-disable prefer-rest-params */
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";

export class GraphQL implements Wrapper {
  private inspectGraphQL(args: unknown[]): void {
    console.log("Inspecting GraphQL request", args);
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("graphql")
      .withVersion("^16.0.0")
      .addFile("execution/execute.js")
      .addSubject((exports) => exports)
      .inspect("execute", (args) => this.inspectGraphQL(args))
      .inspect("executeSync", (args) => this.inspectGraphQL(args));
  }
}
