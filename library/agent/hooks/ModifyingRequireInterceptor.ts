import { Agent } from "../Agent";

export type ModifyingRequireInterceptorFunction = (
  args: unknown[],
  original: unknown
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
