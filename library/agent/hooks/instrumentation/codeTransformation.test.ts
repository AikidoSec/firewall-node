import * as t from "tap";
import { transformCode } from "./codeTransformation";

const compareCodeStrings = (code1: string, code2: string) => {
  return code1.replace(/\s+/g, "") === code2.replace(/\s+/g, "");
};

t.test("add inspectArgs to method definition (ESM)", async (t) => {
  const result = transformCode(
    "testpkg",
    "1.0.0",
    "test.js",
    `
        import { test } from "test";
        class Test {

            private testValue = 42;

            constructor() {
                this.testFunction(testValue);
            }
            testFunction(arg1) {
                console.log("test");
            }
        }
        `,
    "module",
    {
      path: "test.js",
      versionRange: "^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "testFunction",
          identifier: "testpkg.test.js.testFunction.v1.0.0",
          inspectArgs: true,
          modifyArgs: false,
          modifyReturnValue: false,
        },
      ],
    }
  );

  t.same(
    compareCodeStrings(
      result,
      `import { __instrumentInspectArgs, __instrumentModifyArgs } from "@aikidosec/firewall/instrument/internals";
    import { test } from "test";
    class Test {
        private testValue = 42;

        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {
            __instrumentInspectArgs("testpkg.test.js.testFunction.v1.0.0", arguments, "testpkg", "1.0.0", "testFunction");
            console.log("test");
        }
    }`
    ),
    true
  );
});

t.test("add inspectArgs to method definition (CJS)", async (t) => {
  const result = transformCode(
    "testpkg",
    "1.0.0",
    "test.js",
    `
          const { test } = require("test");
          class Test {
  
              private testValue = 42;
  
              constructor() {
                  this.testFunction(testValue);
              }
              testFunction(arg1) {
                  console.log("test");
              }
          }
          `,
    "commonjs",
    {
      path: "test.js",
      versionRange: "^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "testFunction",
          identifier: "testpkg.test.js.testFunction.v1.0.0",
          inspectArgs: true,
          modifyArgs: false,
          modifyReturnValue: false,
        },
      ],
    }
  );

  t.same(
    compareCodeStrings(
      result,
      `const { __instrumentInspectArgs, __instrumentModifyArgs } = require("@aikidosec/firewall/instrument/internals");
      const { test } = require("test");
      class Test {
          private testValue = 42;
  
          constructor() {
              this.testFunction(testValue);
          }
          testFunction(arg1) {
              __instrumentInspectArgs("testpkg.test.js.testFunction.v1.0.0", arguments, "testpkg", "1.0.0", "testFunction");
              console.log("test");
          }
      }`
    ),
    true
  );
});

t.test("wrong function name", async (t) => {
  const result = transformCode(
    "testpkg",
    "1.0.0",
    "test.js",
    `
            const { test } = require("test");
            class Test {
    
                private testValue = 42;
    
                constructor() {
                    this.testFunction(testValue);
                }
                testFunction(arg1) {
                    console.log("test");
                }
            }
            `,
    "commonjs",
    {
      path: "test.js",
      versionRange: "^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "testFunctionABC",
          identifier: "testpkg.test.js.testFunction.v1.0.0",
          inspectArgs: true,
          modifyArgs: false,
          modifyReturnValue: false,
        },
      ],
    }
  );

  t.same(
    compareCodeStrings(
      result,
      `const { __instrumentInspectArgs, __instrumentModifyArgs } = require("@aikidosec/firewall/instrument/internals");
        const { test } = require("test");
        class Test {
            private testValue = 42;
    
            constructor() {
                this.testFunction(testValue);
            }
            testFunction(arg1) {
                console.log("test");
            }
        }`
    ),
    true
  );
});

t.test("typescript code", async (t) => {
  const result = transformCode(
    "testpkg",
    "1.0.0",
    "test.ts",
    `
              import { test } from "test";
              class Test {
      
                  private testValue: number = 42;
      
                  constructor() {
                      this.testFunction(testValue);
                  }
                  testFunction(arg1) {
                      console.log("test");
                  }
              }
              `,
    "commonjs",
    {
      path: "test.ts",
      versionRange: "^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "testFunctionABC",
          identifier: "testpkg.test.js.testFunction.v1.0.0",
          inspectArgs: true,
          modifyArgs: false,
          modifyReturnValue: false,
        },
      ],
    }
  );

  t.same(
    compareCodeStrings(
      result,
      `import { __instrumentInspectArgs, __instrumentModifyArgs } from "@aikidosec/firewall/instrument/internals";
          import { test } from "test";
          class Test {
              private testValue: number = 42;
      
              constructor() {
                  this.testFunction(testValue);
              }
              testFunction(arg1) {
                  console.log("test");
              }
          }`
    ),
    true
  );
});

t.test("typescript code in a js file", async (t) => {
  try {
    transformCode(
      "testpkg",
      "1.0.0",
      "test.js",
      `
                import { test } from "test";
                class Test {
        
                    private testValue: number = 42;
        
                    constructor() {
                        this.testFunction(testValue);
                    }
                    testFunction(arg1) {
                        console.log("test");
                    }
                }
                `,
      "commonjs",
      {
        path: "test.js",
        versionRange: "^1.0.0",
        functions: [
          {
            nodeType: "MethodDefinition",
            name: "testFunctionABC",
            identifier: "testmodule.test.js.testFunction.v1.0.0",
            inspectArgs: true,
            modifyArgs: false,
            modifyReturnValue: false,
          },
        ],
      }
    );
    t.fail("Should throw an error");
  } catch (error) {
    t.ok(error instanceof Error);
    if (error instanceof Error) {
      t.match(error.message, "Error transforming code: #ERR:");
      t.match(
        error.message,
        "Expected a semicolon or an implicit semicolon after a statement, but found none"
      );
    }
  }
});

t.test("empty code", async (t) => {
  const result = transformCode("testpkg", "1.0.0", "test.mjs", "", "commonjs", {
    path: "test.mjs",
    versionRange: "^1.0.0",
    functions: [
      {
        nodeType: "MethodDefinition",
        name: "testFunctionABC",
        identifier: "testmodule.test.js.testFunction.v1.0.0",
        inspectArgs: true,
        modifyArgs: false,
        modifyReturnValue: false,
      },
    ],
  });

  t.same(
    compareCodeStrings(
      result,
      `import { __instrumentInspectArgs, __instrumentModifyArgs } from "@aikidosec/firewall/instrument/internals";`
    ),
    true
  );
});

t.test("add modifyArgs to method definition (ESM)", async (t) => {
  const result = transformCode(
    "testpkg",
    "1.0.0",
    "test.js",
    `
          import { test } from "test";
          class Test {
  
              private testValue = 42;
  
              constructor() {
                  this.testFunction(testValue);
              }
              testFunction(arg1) {
                  console.log("test");
              }
          }
          `,
    "module",
    {
      path: "test.js",
      versionRange: "^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "testFunction",
          identifier: "testmodule.test.js.testFunction.v1.0.0",
          inspectArgs: false,
          modifyArgs: true,
          modifyReturnValue: false,
        },
      ],
    }
  );

  t.same(
    compareCodeStrings(
      result,
      `import { __instrumentInspectArgs, __instrumentModifyArgs } from "@aikidosec/firewall/instrument/internals";
      import { test } from "test";
      class Test {
          private testValue = 42;
  
          constructor() {
              this.testFunction(testValue);
          }
          testFunction(arg1) {
              [arg1] = __instrumentModifyArgs("testmodule.test.js.testFunction.v1.0.0", [arg1]);
              console.log("test");
          }
      }`
    ),
    true
  );
});

t.test(
  "add modifyArgs and inspectArgs to method definition (ESM)",
  async (t) => {
    const result = transformCode(
      "testpkg",
      "1.0.0",
      "test.js",
      `
            import { test } from "test";
            class Test {
    
                private testValue = 42;
    
                constructor() {
                    this.testFunction2(testValue);
                }
                testFunction2(arg1) {
                    console.log("test");
                }
            }
            `,
      "module",
      {
        path: "test.js",
        versionRange: "^1.0.0",
        functions: [
          {
            nodeType: "MethodDefinition",
            name: "testFunction2",
            identifier: "testpkg.test.js.testFunction2.v1.0.0",
            inspectArgs: true,
            modifyArgs: true,
            modifyReturnValue: false,
          },
        ],
      }
    );

    t.same(
      compareCodeStrings(
        result,
        `import { __instrumentInspectArgs, __instrumentModifyArgs } from "@aikidosec/firewall/instrument/internals";
        import { test } from "test";
        class Test {
            private testValue = 42;
    
            constructor() {
                this.testFunction2(testValue);
            }
            testFunction2(arg1) {
                __instrumentInspectArgs("testpkg.test.js.testFunction2.v1.0.0", arguments, "testpkg", "1.0.0", "testFunction2");
                [arg1] = __instrumentModifyArgs("testpkg.test.js.testFunction2.v1.0.0", [arg1]);
                console.log("test");
            }
        }`
      ),
      true
    );
  }
);

// Rest args like ...args are not supported at the moment, so we don't want to modify the source code
t.test("modify rest parameter args", async (t) => {
  const result = transformCode(
    "testpkg",
    "1.0.0",
    "test.js",
    `class Test {
          constructor() {
            this.testFunction(testValue);
          }
          testFunction(...args) {
            console.log("test");
          }
        }`,
    "module",
    {
      path: "test.js",
      versionRange: "^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "testFunction",
          identifier: "testmodule.test.js.testFunction.v1.0.0",
          inspectArgs: false,
          modifyArgs: true,
          modifyReturnValue: false,
        },
      ],
    }
  );

  t.same(
    compareCodeStrings(
      result,
      `import { __instrumentInspectArgs, __instrumentModifyArgs } from "@aikidosec/firewall/instrument/internals";
        class Test {
            constructor() {
                this.testFunction(testValue);
            }
            testFunction(...args) {
                console.log("test");
            }
        }`
    ),
    true
  );

  const result2 = transformCode(
    "testpkg",
    "1.0.0",
    "test.js",
    `class Test {
          constructor() {
            this.testFunction(testValue);
          }
          testFunction(abc, ...args) {
            console.log("test");
          }
        }`,
    "module",
    {
      path: "test.js",
      versionRange: "^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "testFunction",
          identifier: "testmodule.test.js.testFunction.v1.0.0",
          inspectArgs: false,
          modifyArgs: true,
          modifyReturnValue: false,
        },
      ],
    }
  );

  t.same(
    compareCodeStrings(
      result2,
      `import { __instrumentInspectArgs, __instrumentModifyArgs } from "@aikidosec/firewall/instrument/internals";
        class Test {
            constructor() {
                this.testFunction(testValue);
            }
            testFunction(abc, ...args) {
                [abc] = __instrumentModifyArgs("testmodule.test.js.testFunction.v1.0.0", [abc]);
                console.log("test");
            }
        }`
    ),
    true
  );
});

t.test("add inspectArgs to method definition (unambiguous)", async (t) => {
  const result = transformCode(
    "testpkg",
    "1.0.0",
    "test.js",
    `
        import { test } from "test";
        class Test {

            private testValue = 42;

            constructor() {
                this.testFunction(testValue);
            }
            testFunction(arg1) {
                console.log("test");
            }
        }
        `,
    "unambiguous",
    {
      path: "test.js",
      versionRange: "^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "testFunction",
          identifier: "testpkg.test.js.testFunction.v1.0.0",
          inspectArgs: true,
          modifyArgs: false,
          modifyReturnValue: false,
        },
      ],
    }
  );

  t.same(
    compareCodeStrings(
      result,
      `import { __instrumentInspectArgs, __instrumentModifyArgs } from "@aikidosec/firewall/instrument/internals";
    import { test } from "test";
    class Test {
        private testValue = 42;

        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {
            __instrumentInspectArgs("testpkg.test.js.testFunction.v1.0.0", arguments, "testpkg", "1.0.0", "testFunction");
            console.log("test");
        }
    }`
    ),
    true
  );

  const result2 = transformCode(
    "testpkg",
    "1.0.0",
    "test.js",
    `
        const { test } = require("test");
        class Test {

            private testValue = 42;

            constructor() {
                this.testFunction(testValue);
            }
            testFunction(arg1) {
                console.log("test");
            }
        }
        `,
    "unambiguous",
    {
      path: "test.js",
      versionRange: "^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "testFunction",
          identifier: "testpkg.test.js.testFunction.v1.0.0",
          inspectArgs: true,
          modifyArgs: false,
          modifyReturnValue: false,
        },
      ],
    }
  );

  t.same(
    compareCodeStrings(
      result2,
      `const { __instrumentInspectArgs, __instrumentModifyArgs } = require("@aikidosec/firewall/instrument/internals");
    const { test } = require("test");
    class Test {
        private testValue = 42;

        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {
            __instrumentInspectArgs("testpkg.test.js.testFunction.v1.0.0", arguments, "testpkg", "1.0.0", "testFunction");
            console.log("test");
        }
    }`
    ),
    true
  );
});
