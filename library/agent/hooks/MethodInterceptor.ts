import { Agent } from "../Agent";
import { Kind } from "../Attack";
import { Source } from "../Source";

export type InterceptorResult = {
  operation: string;
  kind: Kind;
  source: Source;
  pathToPayload: string;
  metadata: Record<string, string>;
  payload: unknown;
} | void;

export type Interceptor = (
  args: unknown[],
  subject: unknown,
  agent: Agent
) => InterceptorResult;

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
