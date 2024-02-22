import { Hook } from "require-in-the-middle";
import { massWrap } from "shimmer";

export interface WrapSelector {
  wrapFunction: string;
  exportsSelector(exports: unknown): any[];
}
export class Wrapper {
  public readonly packageName;
  public readonly versionRange;
  private wrapSelectors;
  private middlewareFunction;
  constructor(
    packageName: string,
    versionRange: string,
    wrapSelectors: WrapSelector[],
    middlewareFunction: any
  ) {
    this.packageName = packageName;
    this.versionRange = versionRange;
    this.wrapSelectors = wrapSelectors;
    this.middlewareFunction = middlewareFunction;
  }
  private wrapFunction(exports: unknown) {
    for (const wrapSelector of this.wrapSelectors) {
      massWrap(
        wrapSelector.exportsSelector(exports),
        [wrapSelector.wrapFunction],
        function wrapFunction(original) {
          return function wrappedFunction(this: any, ...args: unknown[]) {
            this.middlewareFunction(args, wrapSelector.wrapFunction);
            return original.apply(this, args);
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
