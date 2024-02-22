# Creating a new sink
Hi there! Here are some instrutions for creating a new sink : 

1. Go to the `agent/protect.ts` file and locate the `wrapInstalledPackages()` function, here add your package and the versions you will support : 
```diff
function wrapInstalledPackages() {
  const packages = [
    new Postgres(),
    new MongoDB(),
    new Express(),
+   new ExamplePackage(),
  ];
  ...
```

2. Go to sinks/ or sources/ and create a new class which has the following structure : 
```ts
import { WrapSelector, Wrapper } from "../agent/Wrapper";

const EXAMPLE_PACKAGE_VERSION_RANGE = "^8.11.0";

export class ExamplePackage extends Wrapper {
  constructor() {
    const functionWrapSelector: WrapSelector = {
      exportsSelector: (exports: any) => [exports.myObject.prototype],
      middleware: ExamplePackage.middleware,
    };

    super("example_package", EXAMPLE_PACKAGE_VERSION_RANGE, {
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
```
