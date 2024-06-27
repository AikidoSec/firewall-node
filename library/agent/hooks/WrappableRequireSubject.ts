import { Agent } from "../Agent";
import { wrapWithArgumentModification } from "../applyHooks";
import { addRequireInterceptor } from "../wrapRequire";
import {
  ModifyingArgumentsInterceptor,
  ModifyingArgumentsMethodInterceptor,
} from "./ModifyingArgumentsInterceptor";
import { ModifyingRequireInterceptor } from "./ModifyingRequireInterceptor";

export class WrappableRequireSubject {
  private methods: ModifyingArgumentsMethodInterceptor[] = [];

  constructor(private readonly name: string) {
    if (!this.name) {
      throw new Error("Module name is required");
    }

    this.intercept = this.intercept.bind(this);

    addRequireInterceptor(
      new ModifyingRequireInterceptor(name, this.intercept)
    );
  }

  modifyArguments(
    methodName: string,
    interceptor: ModifyingArgumentsInterceptor
  ) {
    const method = new ModifyingArgumentsMethodInterceptor(
      methodName,
      interceptor
    );
    this.methods.push(method);

    return this;
  }

  getName() {
    return this.name;
  }

  private intercept(
    args: unknown[],
    originalReturnValue: unknown,
    agent: Agent
  ) {
    for (const methodInterceptor of this.methods) {
      wrapWithArgumentModification(
        originalReturnValue,
        methodInterceptor,
        this.name,
        agent
      );
    }

    return originalReturnValue;
  }
}
