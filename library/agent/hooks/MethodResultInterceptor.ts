import { Agent } from "../Agent";

export type ResultInterceptor = (
  args: unknown[],
  result: unknown,
  subject: unknown,
  agent: Agent
) => void;

export class MethodResultInterceptor {
  constructor(
    private readonly name: string,
    private readonly interceptor: ResultInterceptor
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
