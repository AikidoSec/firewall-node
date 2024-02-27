import { Interceptor, MethodInterceptor } from "./MethodInterceptor";
import {
  ModifyingArgumentsInterceptor,
  ModifyingArgumentsMethodInterceptor,
} from "./ModifyingArgumentsInterceptor";

export class Selector {
  private methods: (MethodInterceptor | ModifyingArgumentsMethodInterceptor)[] =
    [];

  constructor(private readonly selector: (exports: unknown) => unknown) {}

  inspect(methodName: string, interceptor: Interceptor) {
    const method = new MethodInterceptor(methodName, interceptor);
    this.methods.push(method);

    return method;
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

    return method;
  }

  getSelector() {
    return this.selector;
  }

  getMethodInterceptors() {
    return this.methods;
  }
}
