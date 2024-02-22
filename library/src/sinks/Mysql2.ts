import { getInstance } from "../agent/AgentSingleton";
import { getContext } from "../agent/Context";
import { WrapSelector, Wrapper } from "../agent/Wrapper";

const EXAMPLE_PACKAGE_VERSION_RANGE = "^3.9.0";

export class Mysql2 extends Wrapper {
  constructor() {
    const functionWrapSelector: WrapSelector = {
      exportsSelector: (exports: any) => [exports.myObject.prototype],
      middleware: Mysql2.middleware,
    };

    super("pg", EXAMPLE_PACKAGE_VERSION_RANGE, {
      my_function: functionWrapSelector,
    });
  }
  static middleware(args: unknown[]) {}
}
