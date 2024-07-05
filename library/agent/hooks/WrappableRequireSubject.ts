import {
  ModifyingArgumentsInterceptor,
  ModifyingArgumentsMethodInterceptor,
} from "./ModifyingArgumentsInterceptor";

export class WrappableRequireSubject {
  private methods: ModifyingArgumentsMethodInterceptor[] = [];

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

  getInterceptors() {
    return this.methods;
  }
}
