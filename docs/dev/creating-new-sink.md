# Creating a new sink
Hi there! Here are some instrutions for creating a new sink : 

1. Go to the `agent/protect.ts` file and locate the `wrapInstalledPackages()` function, here add your package and the versions you will support : 
```diff
const packages: Record<string, { range: string; wrapper: Wrapper }> = {
    ...
    ...
+    mysql2: {
+      range: "^3.9.0", // Current version
+      wrapper: new Mysql2()
+    },
    ...
    ...
```

2. Create a new Class for your sink in the sinks/ folder, here is an example of the most basic class : 
```js
export class ExampleSink implements Wrapper {
  private wrapFunction(exports: unknown) {
    const that = this;
  }
  private onModuleRequired<T>(exports: T): T {
    this.wrapFunction(exports);
    return exports;
  }
  wrap() {
    new Hook(["example-package"], this.onModuleRequired.bind(this));
  }
}
```