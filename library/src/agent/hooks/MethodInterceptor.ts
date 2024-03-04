import { Agent } from "../Agent";
import { Context } from "../Context";

export type Interceptor = (
  args: unknown[],
  subject: unknown,
  agent: Agent,
  context: Context
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
