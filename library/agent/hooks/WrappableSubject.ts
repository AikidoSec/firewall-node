import { ConstructorInterceptor } from "./ConstructorInterceptor";
import { Interceptor, MethodInterceptor } from "./MethodInterceptor";
import {
  MethodResultInterceptor,
  ResultInterceptor,
} from "./MethodResultInterceptor";
import {
  ModifyingArgumentsInterceptor,
  ModifyingArgumentsMethodInterceptor,
} from "./ModifyingArgumentsInterceptor";

/**
 * A subject represents an object from package exports that we want to hook into.
 */
export class WrappableSubject {
  private methods: (
    | MethodInterceptor
    | ModifyingArgumentsMethodInterceptor
    | ConstructorInterceptor
    | MethodResultInterceptor
  )[] = [];

  constructor(private readonly selector: (exports: unknown) => unknown) {}

  /**
   * Inspect method calls without modifying arguments
   *
   * This is the preferred way to use when wrapping methods
   */
  inspect(methodName: string, interceptor: Interceptor) {
    const method = new MethodInterceptor(methodName, interceptor);
    this.methods.push(method);

    return this;
  }

  /**
   * Inspection of method results. Also includes the arguments passed to the method.
   *
   * ! Currently only useable for sources and not for sinks. !
   *
   * If not necessary, use inspect instead.
   */
  inspectResult(methodName: string, interceptor: ResultInterceptor) {
    const method = new MethodResultInterceptor(methodName, interceptor);
    this.methods.push(method);

    return this;
  }

  /**
   * Inspect methods call and return modified arguments
   *
   * e.g. to append our middleware to express routes
   *
   * Don't use this unless you have to, it's better to use inspect
   */
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

  inspectNewInstance(name: string) {
    const construct = new ConstructorInterceptor(name);
    this.methods.push(construct);

    return construct;
  }

  getSelector() {
    return this.selector;
  }

  getMethodInterceptors() {
    return this.methods;
  }
}
