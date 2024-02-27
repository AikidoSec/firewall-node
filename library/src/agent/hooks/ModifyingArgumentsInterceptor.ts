export type ModifyingArgumentsInterceptor = (
  args: unknown[],
  subject: unknown
) => unknown[];

export class ModifyingArgumentsMethodInterceptor {
  constructor(
    private readonly name: string,
    private readonly interceptor: ModifyingArgumentsInterceptor
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
