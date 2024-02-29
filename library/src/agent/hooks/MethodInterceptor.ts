import { Agent } from "../Agent";

export type Interceptor = (
  args: unknown[],
  subject: unknown,
  agent: Agent
) => void;

export class MethodInterceptor {
  constructor(
    private readonly name: string,
    private readonly interceptor: Interceptor
  ) {
    if (!this.name) {
      throw new Error("Method name is required");
    }
  }

  getName() {
    return this.name;
  }

  getInterceptor() {
    return this.interceptor;
  }
}
