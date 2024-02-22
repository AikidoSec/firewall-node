import { WrapSelector, Wrapper } from "../agent/Wrapper";

const MARIADB_PACKAGE_VERSION = "^3.2.0";

export class MariaDB extends Wrapper {
  constructor() {
    const functionWrapSelector: WrapSelector = {
      exportsSelector: (exports: any) => [exports.myObject.prototype],
      middleware: MariaDB.middleware,
    };

    super("mariadb", MARIADB_PACKAGE_VERSION, {
      my_function: functionWrapSelector,
    });
  }
  static middleware(args: unknown[], operation: string) {
    // Here you can use args to get the arguments passed to the to be intercepted function
    // In the operation variable, you find the function that was intercepted
    // You can return modified arguments or just return in which case nothing gets changed
    return ["these arguments get sent to the function"];
  }
}