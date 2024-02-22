import { Hook } from "require-in-the-middle";
import { Wrapper } from "../agent/Wrapper";

export class Mysql2 implements Wrapper {
  private wrapFunction(exports: unknown) {
    const that = this;
  }
  private onModuleRequired<T>(exports: T): T {
    this.wrapFunction(exports);
    return exports;
  }
  wrap() {
    new Hook(["mysql2"], this.onModuleRequired.bind(this));
  }
}
