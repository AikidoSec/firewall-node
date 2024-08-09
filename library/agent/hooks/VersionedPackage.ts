import { RequireInterceptor } from "./RequireInterceptor";

export class VersionedPackage {
  private requireInterceptors: RequireInterceptor[] = [];

  constructor(private readonly range: string) {
    if (!this.range) {
      throw new Error("Version range is required");
    }
  }

  getRange() {
    return this.range;
  }

  onRequire(interceptor: RequireInterceptor) {
    if (typeof interceptor !== "function") {
      throw new Error("Interceptor must be a function");
    }
    this.requireInterceptors.push(interceptor);
  }

  getRequireInterceptors() {
    return this.requireInterceptors;
  }
}
