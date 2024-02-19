import { Hook } from "require-in-the-middle";
import { massWrap } from "shimmer";

export interface Middleware {
  middlewareFunction:(...args:any[]) => any;
  modules:object[] | object;
  functionNames: string[] | string;
}
export class Wrapper {
  private packageName;
  private middleware:Middleware[];
  constructor(packageName: string) {
    this.packageName = packageName;
    this.middleware = [];
  }
  public addMiddleware(middleware:Middleware) {
    this.middleware.push(middleware);
  }
  private addActiveMiddleware(middleware:Middleware) {
    // Make sure everything is a list
    let modulesArray, functionNamesArray;

    if(!Array.isArray(middleware.modules)) modulesArray = [middleware.modules];
    else modulesArray = middleware.modules;

    if(!Array.isArray(middleware.functionNames)) functionNamesArray = [middleware.functionNames];
    else functionNamesArray = middleware.functionNames;

    massWrap(modulesArray, functionNamesArray, function wrapFunction(original:any) {
      return function insertMiddleware(this:any) {
        middleware.middlewareFunction(arguments); // Call the middleware
        return original.apply(this, arguments);
      }
    });
  }
  private onModuleRequired<T>(exports: T): T {
    this.middleware.map(this.addActiveMiddleware);
    return exports;
  }
  public activate() {
      new Hook([this.packageName], this.onModuleRequired.bind(this));
  }
}