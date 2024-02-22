import { Hook } from "require-in-the-middle";
import { massWrap } from "shimmer";

export type WrapSelector = {
  exportsSelector(exports: unknown): any[];
  middleware(args: unknown[], operation: string): unknown[] | any;
};
export class Wrapper {
  public readonly packageName;
  public readonly versionRange;
  private wrapSelectors;
  constructor(
    packageName: string,
    versionRange: string,
    wrapSelectors: Record<string, WrapSelector>
  ) {
    this.packageName = packageName;
    this.versionRange = versionRange;
    this.wrapSelectors = wrapSelectors;
  }
  private wrapFunction(exports: unknown) {
    const that = this;
    for (const operation in this.wrapSelectors) {
      const wrapSelector = this.wrapSelectors[operation];
      massWrap(
        wrapSelector.exportsSelector(exports),
        [operation],
        function wrapFunction(original) {
          return function wrappedFunction(this: any, ...args: unknown[]) {
            const returnedArgs:unknown[]|undefined = wrapSelector.middleware.call(this, args, operation)
            return original.apply(this, returnedArgs ?? args);
          };
        }
      );
    }
  }

  private onModuleRequired<T>(exports: T): T {
    this.wrapFunction(exports);
    return exports;
  }

  wrap() {
    new Hook([this.packageName], this.onModuleRequired.bind(this));
  }
}
