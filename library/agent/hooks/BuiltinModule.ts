import { RequireBuiltinInterceptor } from "./RequireInterceptor";

export class BuiltinModule {
  private requireInterceptors: RequireBuiltinInterceptor[] = [];

  constructor(private readonly name: string) {
    if (!this.name) {
      throw new Error("Name is required");
    }
  }

  getName() {
    return this.name;
  }

  onRequire(interceptor: RequireBuiltinInterceptor) {
    this.requireInterceptors.push(interceptor);
  }

  getRequireInterceptors() {
    return this.requireInterceptors;
  }
}
