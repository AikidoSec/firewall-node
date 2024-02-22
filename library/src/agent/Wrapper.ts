import { Hook } from "require-in-the-middle";
import { massWrap } from "shimmer";

export interface WrapSelector {
  wrapFunctions: string[]
  exportsSelector(exports:unknown): any[]
};
export class Wrapper {
  private readonly packageName;
  private wrapSelector;
  private middlewareFunction;
  constructor(packageName:string, wrapSelector:WrapSelector, middlewareFunction:any) {
    this.packageName = packageName;
    this.wrapSelector = wrapSelector;
    this.middlewareFunction = middlewareFunction
  }
  private wrapFunction(exports: unknown) {
    const that = this;

    massWrap(
      this.wrapSelector.exportsSelector(exports),
      this.wrapSelector.wrapFunctions,
      function wrapFunction(original) {
        return function wrappedFunction(this: any, ...args: unknown[]) {
          this.middlewareFunction(args);
          return original.apply(this, args);
        };
      }
    );
  }

  private onModuleRequired<T>(exports: T): T {
    this.wrapFunction(exports);
    return exports;
  }

  wrap() {
    new Hook([this.packageName], this.onModuleRequired.bind(this));
  }
}