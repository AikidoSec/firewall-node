import { Interceptor, MethodInterceptor } from "./MethodInterceptor";
import {
  ModifyingArgumentsInterceptor,
  ModifyingArgumentsMethodInterceptor,
} from "./ModifyingArgumentsInterceptor";

export class Global {
  private methods: (MethodInterceptor | ModifyingArgumentsMethodInterceptor)[] =
    [];

  constructor(private readonly name: string) {
    if (!this.name) {
      throw new Error("Name is required");
    }
  }

  /**
   * Inspect method calls without modifying arguments
   *
   * This is the preferred way to use when wrapping methods
   */
  inspect(interceptor: Interceptor) {
    const method = new MethodInterceptor(this.name, interceptor);
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
  modifyArguments(interceptor: ModifyingArgumentsInterceptor) {
    const method = new ModifyingArgumentsMethodInterceptor(
      this.name,
      interceptor
    );
    this.methods.push(method);

    return this;
  }

  getName() {
    return this.name;
  }

  getMethodInterceptors() {
    return this.methods;
  }
}
