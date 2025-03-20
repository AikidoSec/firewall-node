import { MonitoredSinkStatsKind } from "../api/Event";
import { InterceptorObject } from "./wrapExport";

export class Global {
  constructor(
    private readonly name: string,
    private readonly interceptors: InterceptorObject,
    private readonly kind: MonitoredSinkStatsKind
  ) {
    if (!this.name) {
      throw new Error("Name is required");
    }
    if (!this.interceptors) {
      throw new Error("Interceptors are required");
    }
  }

  getName() {
    return this.name;
  }

  getInterceptors() {
    return this.interceptors;
  }

  getKind() {
    return this.kind;
  }
}
