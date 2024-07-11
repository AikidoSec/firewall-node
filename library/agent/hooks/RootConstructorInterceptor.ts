import { Interceptor } from "./MethodInterceptor";

/**
 * Intercepts the construction of a new object that is not exported as a property of a module.
 * For example, the `URL` constructor.
 */
export class RootConstructorInterceptor {
  constructor(
    private readonly name: string,
    private readonly interceptor: Interceptor
  ) {}

  getInterceptor() {
    return this.interceptor;
  }

  getName() {
    return this.name;
  }
}
