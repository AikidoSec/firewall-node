import { Hook } from "require-in-the-middle";
import { massWrap } from "shimmer";

export class Wrapper {
  private packageName;
  constructor(
    packageName: string, 
    middleware:(...args:any[]) => any[],
    modules:object[],
    functionNames: never[]
  ) {
    this.packageName = packageName;
  }
  private wrapFunction(exports:unknown) {
    // @ts-expect-error This is magic that TypeScript doesn't understand
    massWrap(modules, functionNames, function wrapFunction(original:any) {
      return function insertMiddleware(this:any) {
        return original.apply(this, arguments);
      }
    })
  }
  private onModuleRequired<T>(exports: T): T {
    this.wrapFunction(exports);
    return exports;
  }
  public activate() {
      new Hook([this.packageName], this.onModuleRequired.bind(this));
  }
}