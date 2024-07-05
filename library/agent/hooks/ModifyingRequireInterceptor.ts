import { Agent } from "../Agent";

type ModifyingRequireInterceptorFunction = (
  args: unknown[],
  originalReturnValue: unknown,
  agent: Agent
) => unknown;

export class ModifyingRequireInterceptor {
  constructor(
    private readonly name: string,
    private readonly interceptor: ModifyingRequireInterceptorFunction
  ) {
    if (!this.name) {
      throw new Error("Module name is required");
    }
  }

  getName() {
    return this.name;
  }

  getInterceptor() {
    return this.interceptor;
  }
}
