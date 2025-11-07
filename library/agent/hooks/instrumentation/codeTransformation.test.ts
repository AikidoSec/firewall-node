import * as t from "tap";
import { transformCode } from "./codeTransformation";

const compareCodeStrings = (code1: string, code2: string) => {
  return code1.replace(/\s+/g, "") === code2.replace(/\s+/g, "");
};

t.before(() => {
  // Skip replacing the import path for unit tests from @aikidosec/firewall/instrument/internals to the local path
  process.env.AIKIDO_TEST_NEW_INSTRUMENTATION = "false";
});

t.after(() => {
  process.env.AIKIDO_TEST_NEW_INSTRUMENTATION = "true";
});

const isSameCode = (t: any, code1: string, code2: string) => {
  t.same(compareCodeStrings(code1, code2), true);
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
      identifier: "testpkg.test.js.^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "testFunction",
          identifier: "testpkg.test.js.testFunction.MethodDefinition.v1.0.0",
          inspectArgs: true,
          modifyArgs: false,
          modifyReturnValue: false,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    }
  );

  isSameCode(
    t,
    result,
    `import { __instrumentInspectArgs } from "@aikidosec/firewall/instrument/internals";
    import { test } from "test";
    class Test {
        private testValue = 42;

        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {
            __instrumentInspectArgs("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, "1.0.0", this);
            console.log("test");
        }
    }`
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
      identifier: "testpkg.test.js.^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "testFunction",
          identifier: "testpkg.test.js.testFunction.MethodDefinition.v1.0.0",
          inspectArgs: true,
          modifyArgs: false,
          modifyReturnValue: false,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    }
  );

  isSameCode(
    t,
    result,
    `const { __instrumentInspectArgs } = require("@aikidosec/firewall/instrument/internals");
      const { test } = require("test");
      class Test {
          private testValue = 42;
  
          constructor() {
              this.testFunction(testValue);
          }
          testFunction(arg1) {
              __instrumentInspectArgs("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, "1.0.0", this);
              console.log("test");
          }
      }`
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
      identifier: "testpkg.test.js.^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "testFunctionABC",
          identifier: "testpkg.test.js.testFunction.MethodDefinition.v1.0.0",
          inspectArgs: true,
          modifyArgs: false,
          modifyReturnValue: false,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    }
  );

  isSameCode(
    t,
    result,
    `const { __instrumentInspectArgs } = require("@aikidosec/firewall/instrument/internals");
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
      identifier: "testpkg.test.js.^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "testFunctionABC",
          identifier: "testpkg.test.js.testFunction.MethodDefinition.v1.0.0",
          inspectArgs: true,
          modifyArgs: false,
          modifyReturnValue: false,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    }
  );

  isSameCode(
    t,
    result,
    `import { __instrumentInspectArgs } from "@aikidosec/firewall/instrument/internals";
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
        identifier: "testpkg.test.js.^1.0.0",
        functions: [
          {
            nodeType: "MethodDefinition",
            name: "testFunctionABC",
            identifier:
              "testmodule.test.js.testFunction.MethodDefinition.v1.0.0",
            inspectArgs: true,
            modifyArgs: false,
            modifyReturnValue: false,
            modifyArgumentsObject: false,
          },
        ],
        accessLocalVariables: [],
      }
    );
    t.fail("Should throw an error");
  } catch (error) {
    t.ok(error instanceof Error);
    if (error instanceof Error) {
      t.match(
        error.message,
        "Error transforming code: Error while parsing code:"
      );
      t.match(error.message, 'Expected `;` but found `:`"');
    }
  }
});

t.test("empty code", async (t) => {
  const result = transformCode("testpkg", "1.0.0", "test.mjs", "", "commonjs", {
    path: "test.mjs",
    versionRange: "^1.0.0",
    identifier: "testpkg.test.mjs.^1.0.0",
    functions: [
      {
        nodeType: "MethodDefinition",
        name: "testFunctionABC",
        identifier: "testmodule.test.js.testFunction.MethodDefinition.v1.0.0",
        inspectArgs: true,
        modifyArgs: false,
        modifyReturnValue: false,
        modifyArgumentsObject: false,
      },
    ],
    accessLocalVariables: [],
  });

  isSameCode(
    t,
    result,
    `import { __instrumentInspectArgs } from "@aikidosec/firewall/instrument/internals";`
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
      identifier: "testpkg.test.js.^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "testFunction",
          identifier: "testmodule.test.js.testFunction.MethodDefinition.v1.0.0",
          inspectArgs: false,
          modifyArgs: true,
          modifyReturnValue: false,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    }
  );

  isSameCode(
    t,
    result,
    `import { __instrumentModifyArgs } from "@aikidosec/firewall/instrument/internals";
      import { test } from "test";
      class Test {
          private testValue = 42;
  
          constructor() {
              this.testFunction(testValue);
          }
          testFunction(arg1) {
              [arg1] = __instrumentModifyArgs("testmodule.test.js.testFunction.MethodDefinition.v1.0.0", [arg1], this);
              console.log("test");
          }
      }`
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
        identifier: "testpkg.test.js.^1.0.0",
        functions: [
          {
            nodeType: "MethodDefinition",
            name: "testFunction2",
            identifier: "testpkg.test.js.testFunction2.MethodDefinition.v1.0.0",
            inspectArgs: true,
            modifyArgs: true,
            modifyReturnValue: false,
            modifyArgumentsObject: false,
          },
        ],
        accessLocalVariables: [],
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
                __instrumentInspectArgs("testpkg.test.js.testFunction2.MethodDefinition.v1.0.0", arguments, "1.0.0", this);
                [arg1] = __instrumentModifyArgs("testpkg.test.js.testFunction2.MethodDefinition.v1.0.0", [arg1], this);
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
      identifier: "testpkg.test.js.^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "testFunction",
          identifier: "testpkg.test.js.testFunction.MethodDefinition.v1.0.0",
          inspectArgs: false,
          modifyArgs: true,
          modifyReturnValue: false,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    }
  );

  isSameCode(
    t,
    result,
    `import { __instrumentModifyArgs } from "@aikidosec/firewall/instrument/internals";
        class Test {
            constructor() {
                this.testFunction(testValue);
            }
            testFunction(...args) {
                console.log("test");
            }
        }`
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
      identifier: "testpkg.test.js.^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "testFunction",
          identifier: "testmodule.test.js.testFunction.MethodDefinition.v1.0.0",
          inspectArgs: false,
          modifyArgs: true,
          modifyReturnValue: false,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    }
  );

  isSameCode(
    t,
    result2,
    `import { __instrumentModifyArgs } from "@aikidosec/firewall/instrument/internals";
        class Test {
            constructor() {
                this.testFunction(testValue);
            }
            testFunction(abc, ...args) {
                [abc] = __instrumentModifyArgs("testmodule.test.js.testFunction.MethodDefinition.v1.0.0", [abc], this);
                console.log("test");
            }
        }`
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
      identifier: "testpkg.test.js.^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "testFunction",
          identifier: "testpkg.test.js.testFunction.MethodDefinition.v1.0.0",
          inspectArgs: true,
          modifyArgs: false,
          modifyReturnValue: false,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    }
  );

  isSameCode(
    t,
    result,
    `import { __instrumentInspectArgs } from "@aikidosec/firewall/instrument/internals";
    import { test } from "test";
    class Test {
        private testValue = 42;

        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {
            __instrumentInspectArgs("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, "1.0.0", this);
            console.log("test");
        }
    }`
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
      identifier: "testpkg.test.js.^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "testFunction",
          identifier: "testpkg.test.js.testFunction.MethodDefinition.v1.0.0",
          inspectArgs: true,
          modifyArgs: false,
          modifyReturnValue: false,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    }
  );

  isSameCode(
    t,
    result2,
    `const { __instrumentInspectArgs } = require("@aikidosec/firewall/instrument/internals");
    const { test } = require("test");
    class Test {
        private testValue = 42;

        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {
            __instrumentInspectArgs("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, "1.0.0", this);
            console.log("test");
        }
    }`
  );
});

t.test(
  "add inspectArgs to static function assignment expression (CJS)",
  async (t) => {
    const result = transformCode(
      "express",
      "1.0.0",
      "application.js",
      `
        const app = require("example");
        app.use = function (fn) {
            console.log("test");
        };
        `,
      "commonjs",
      {
        path: "application.js",
        versionRange: "^1.0.0",
        identifier: "testpkg.test.js.^1.0.0",
        functions: [
          {
            nodeType: "FunctionAssignment",
            name: "app.use",
            identifier:
              "express.application.js.app.use.MethodDefinition.v1.0.0",
            inspectArgs: true,
            modifyArgs: false,
            modifyReturnValue: false,
            modifyArgumentsObject: false,
          },
        ],
        accessLocalVariables: [],
      }
    );

    t.same(
      compareCodeStrings(
        result,
        `const { __instrumentInspectArgs } = require("@aikidosec/firewall/instrument/internals");
        const app = require("example");
        app.use = function (fn) {
            __instrumentInspectArgs("express.application.js.app.use.MethodDefinition.v1.0.0", arguments, "1.0.0", this);
            console.log("test");
        };`
      ),
      true
    );
  }
);

t.test(
  "add modifyArgs to static function assignment expression (CJS)",
  async (t) => {
    const result = transformCode(
      "express",
      "1.0.0",
      "application.js",
      `
        const app = require("example");
        app.use = function (fn, arg2, arg3) {
            console.log("test");
        };
        `,
      "commonjs",
      {
        path: "application.js",
        versionRange: "^1.0.0",
        identifier: "testpkg.test.js.^1.0.0",
        functions: [
          {
            nodeType: "FunctionAssignment",
            name: "app.use",
            identifier:
              "express.application.js.app.use.MethodDefinition.v1.0.0",
            inspectArgs: false,
            modifyArgs: true,
            modifyReturnValue: false,
            modifyArgumentsObject: false,
          },
        ],
        accessLocalVariables: [],
      }
    );

    t.same(
      compareCodeStrings(
        result,
        `const { __instrumentModifyArgs } = require("@aikidosec/firewall/instrument/internals");
        const app = require("example");
        app.use = function (fn, arg2, arg3) {
            [fn, arg2, arg3] = __instrumentModifyArgs("express.application.js.app.use.MethodDefinition.v1.0.0", [fn, arg2, arg3], this);
            console.log("test");
        };`
      ),
      true
    );
  }
);

t.test(
  "add inspectArgs to dynamic function assignment expression (CJS)",
  async (t) => {
    const result = transformCode(
      "express",
      "1.0.0",
      "application.js",
      `
        const app = require("example");
        const key = "get";
        app[key] = function (fn) {
            console.log("test");
        };
        `,
      "commonjs",
      {
        path: "application.js",
        versionRange: "^1.0.0",
        identifier: "testpkg.test.js.^1.0.0",
        functions: [
          {
            nodeType: "FunctionAssignment",
            name: "app[key]",
            identifier:
              "express.application.js.app[key].MethodDefinition.v1.0.0",
            inspectArgs: true,
            modifyArgs: false,
            modifyReturnValue: false,
            modifyArgumentsObject: false,
          },
        ],
        accessLocalVariables: [],
      }
    );

    t.same(
      compareCodeStrings(
        result,
        `const { __instrumentInspectArgs } = require("@aikidosec/firewall/instrument/internals");
        const app = require("example");
        const key = "get";
        app[key] = function (fn) {
            __instrumentInspectArgs("express.application.js.app[key].MethodDefinition.v1.0.0", arguments, "1.0.0", this);
            console.log("test");
        };`
      ),
      true
    );
  }
);

t.test(
  "add modifyArgs to dynamic function assignment expression (CJS)",
  async (t) => {
    const result = transformCode(
      "express",
      "1.0.0",
      "application.js",
      `
        const app = require("example");
        const key = "get";
        app[key] = function (fn) {
            console.log("test");
        };
        `,
      "commonjs",
      {
        path: "application.js",
        versionRange: "^1.0.0",
        identifier: "testpkg.test.js.^1.0.0",
        functions: [
          {
            nodeType: "FunctionAssignment",
            name: "app[key]",
            identifier:
              "express.application.js.app[key].MethodDefinition.v1.0.0",
            inspectArgs: false,
            modifyArgs: true,
            modifyReturnValue: false,
            modifyArgumentsObject: false,
          },
        ],
        accessLocalVariables: [],
      }
    );

    t.same(
      compareCodeStrings(
        result,
        `const { __instrumentModifyArgs } = require("@aikidosec/firewall/instrument/internals");
        const app = require("example");
        const key = "get";
        app[key] = function (fn) {
          [fn] = __instrumentModifyArgs("express.application.js.app[key].MethodDefinition.v1.0.0", [fn], this);
          console.log("test");
        };`
      ),
      true
    );
  }
);

t.test(
  "add modifyArgs to dynamic function assignment expression with arguments object (CJS)",
  async (t) => {
    const result = transformCode(
      "express",
      "1.0.0",
      "application.js",
      `
        const app = require("example");
        const key = "get";
        app[key] = function (fn) {
            console.log("test");
        };
        `,
      "commonjs",
      {
        path: "application.js",
        versionRange: "^1.0.0",
        identifier: "testpkg.test.js.^1.0.0",
        functions: [
          {
            nodeType: "FunctionAssignment",
            name: "app[key]",
            identifier:
              "express.application.js.app[key].MethodDefinition.v1.0.0",
            inspectArgs: false,
            modifyArgs: true,
            modifyReturnValue: false,
            modifyArgumentsObject: true,
          },
        ],
        accessLocalVariables: [],
      }
    );

    t.same(
      compareCodeStrings(
        result,
        `const { __instrumentModifyArgs } = require("@aikidosec/firewall/instrument/internals");
        const app = require("example");
        const key = "get";
        app[key] = function (fn) {
          Object.assign(arguments, __instrumentModifyArgs("express.application.js.app[key].MethodDefinition.v1.0.0", Array.from(arguments), this));
          console.log("test");
        };`
      ),
      true
    );
  }
);

t.test("does not modify code if function name is not found", async (t) => {
  const result = transformCode(
    "express",
    "1.0.0",
    "application.js",
    `
        const app = require("example");
        const key = "get";
        app[key2] = function (fn) {
            console.log("test");
        };
        `,
    "commonjs",
    {
      path: "application.js",
      versionRange: "^1.0.0",
      identifier: "testpkg.test.js.^1.0.0",
      functions: [
        {
          nodeType: "FunctionAssignment",
          name: "app[key]",
          identifier: "express.application.js.app[key].MethodDefinition.v1.0.0",
          inspectArgs: false,
          modifyArgs: true,
          modifyReturnValue: false,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    }
  );

  isSameCode(
    t,
    result,
    `const { __instrumentModifyArgs } = require("@aikidosec/firewall/instrument/internals");
        const app = require("example");
        const key = "get";
        app[key2] = function (fn) {
          console.log("test");
        };`
  );
});

t.test("add modifyArgs to method definition (ESM)", async (t) => {
  const testWithReturnStatement = (returnStatement: string) =>
    transformCode(
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

                ${returnStatement}
            }
        }
        `,
      "module",
      {
        path: "test.js",
        versionRange: "^1.0.0",
        identifier: "testpkg.test.js.^1.0.0",
        functions: [
          {
            nodeType: "MethodDefinition",
            name: "testFunction",
            identifier: "testpkg.test.js.testFunction.MethodDefinition.v1.0.0",
            inspectArgs: false,
            modifyArgs: false,
            modifyReturnValue: true,
            modifyArgumentsObject: false,
          },
        ],
        accessLocalVariables: [],
      }
    );

  isSameCode(
    t,
    testWithReturnStatement("return arg1;"),
    `import { __instrumentModifyReturnValue } from "@aikidosec/firewall/instrument/internals";
    import { test } from "test";
    class Test {
        private testValue = 42;

        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {
            console.log("test");

            return __instrumentModifyReturnValue("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, arg1, this);
        }
    }`
  );

  isSameCode(
    t,
    testWithReturnStatement("return 'test';"),
    `import { __instrumentModifyReturnValue } from "@aikidosec/firewall/instrument/internals";
    import { test } from "test";
    class Test {
        private testValue = 42;

        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {
            console.log("test");

            return __instrumentModifyReturnValue("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments,"test", this);
        }
    }`
  );

  isSameCode(
    t,
    testWithReturnStatement("return 'test\"';"),
    `import { __instrumentModifyReturnValue } from "@aikidosec/firewall/instrument/internals";
    import { test } from "test";
    class Test {
        private testValue = 42;

        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {
            console.log("test");

            return __instrumentModifyReturnValue("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, "test\\"", this);
        }
    }`
  );

  isSameCode(
    t,
    testWithReturnStatement("return [1, 2];"),
    `import { __instrumentModifyReturnValue } from "@aikidosec/firewall/instrument/internals";
    import { test } from "test";
    class Test {
        private testValue = 42;

        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {
            console.log("test");

            return __instrumentModifyReturnValue("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, [1, 2], this);
        }
    }`
  );

  isSameCode(
    t,
    testWithReturnStatement("return function() { return 42; };"),
    `import { __instrumentModifyReturnValue } from "@aikidosec/firewall/instrument/internals";
    import { test } from "test";
    class Test {
        private testValue = 42;

        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {
            console.log("test");

            return __instrumentModifyReturnValue("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, function() { return 42; }, this);
        }
    }`
  );

  isSameCode(
    t,
    testWithReturnStatement(
      'return funcCall({foo: [1], test: Symbol("abc")});'
    ),
    `import { __instrumentModifyReturnValue } from "@aikidosec/firewall/instrument/internals";
    import { test } from "test";
    class Test {
        private testValue = 42;

        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {
            console.log("test");

            return __instrumentModifyReturnValue("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, funcCall({foo: [1], test: Symbol("abc")}), this);
        }
    }`
  );

  isSameCode(
    t,
    testWithReturnStatement("return function() { return 42; };"),
    `import { __instrumentModifyReturnValue } from "@aikidosec/firewall/instrument/internals";
    import { test } from "test";
    class Test {
        private testValue = 42;

        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {
            console.log("test");

            return __instrumentModifyReturnValue("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, function() { return 42; }, this);
        }
    }`
  );

  isSameCode(
    t,
    testWithReturnStatement(`
    {
      return 42;
      }
    `),
    `import { __instrumentModifyReturnValue } from "@aikidosec/firewall/instrument/internals";
    import { test } from "test";
    class Test {
        private testValue = 42;

        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {
            console.log("test");
            {
                return __instrumentModifyReturnValue("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, 42, this);
            }
        }
    }`
  );

  isSameCode(
    t,
    testWithReturnStatement(`
      if(true) {
        return 42;
      } else {
        return false;
      }
    `),
    `import { __instrumentModifyReturnValue } from "@aikidosec/firewall/instrument/internals";
    import { test } from "test";
    class Test {
        private testValue = 42;

        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {
            console.log("test");
            if(true) {
              return __instrumentModifyReturnValue("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, 42, this);
            } else {
              return __instrumentModifyReturnValue("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, false, this);
          }
        }
    }`
  );

  isSameCode(
    t,
    testWithReturnStatement(`
      do {
        return 42;
      } while (true);
    `),
    `import { __instrumentModifyReturnValue } from "@aikidosec/firewall/instrument/internals";
    import { test } from "test";
    class Test {
        private testValue = 42;

        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {
            console.log("test");
            do {
              return __instrumentModifyReturnValue("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, 42, this);
            } while (true);
        }
    }`
  );

  isSameCode(
    t,
    testWithReturnStatement(`
      while (true) {
        return 42;
      }
    `),
    `import { __instrumentModifyReturnValue } from "@aikidosec/firewall/instrument/internals";
    import { test } from "test";
    class Test {
        private testValue = 42;

        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {
            console.log("test");
            while (true) {
              return __instrumentModifyReturnValue("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, 42, this);
            }
        }
    }`
  );

  isSameCode(
    t,
    testWithReturnStatement(`
      for (const key in obj) {
        return 42;
      }
    `),
    `import { __instrumentModifyReturnValue } from "@aikidosec/firewall/instrument/internals";
    import { test } from "test";
    class Test {
        private testValue = 42;

        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {
            console.log("test");
            for (const key in obj) {
              return __instrumentModifyReturnValue("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, 42, this);
            }
        }
    }`
  );

  isSameCode(
    t,
    testWithReturnStatement(`
      for (const value of iterable) {
        return 42;
      }
    `),
    `import { __instrumentModifyReturnValue } from "@aikidosec/firewall/instrument/internals";
    import { test } from "test";
    class Test {
        private testValue = 42;
        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {

            console.log("test");
            for (const value of iterable) {
              return __instrumentModifyReturnValue("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, 42, this);
            }
        }
    }`
  );

  isSameCode(
    t,
    testWithReturnStatement(`
      for (let i = 0; i < 10; i++) {
        return i;
      }
    `),
    `import { __instrumentModifyReturnValue } from "@aikidosec/firewall/instrument/internals";
    import { test } from "test";
    class Test {
        private testValue = 42;
        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {

            console.log("test");
            for (let i = 0; i < 10; i++) {
              return __instrumentModifyReturnValue("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, i, this);
            }
        }
    }`
  );

  isSameCode(
    t,
    testWithReturnStatement(`
      switch (value) {
        case 1:
          return 42;
        case 2:
          return 24;
        default:
          return 0;
      }
    `),
    `import { __instrumentModifyReturnValue } from "@aikidosec/firewall/instrument/internals";
    import { test } from "test";
    class Test {
        private testValue = 42;
        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {
            console.log("test");
            switch (value) {
              case 1:
                return __instrumentModifyReturnValue("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, 42, this);
              case 2:
                return __instrumentModifyReturnValue("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, 24, this);
              default:
                return __instrumentModifyReturnValue("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, 0, this);
            }
        }
    }`
  );

  isSameCode(
    t,
    testWithReturnStatement(`
      try {
        return 42;
      } catch (error) {
        console.error(error);
        return 0;
      }
    `),
    `import { __instrumentModifyReturnValue } from "@aikidosec/firewall/instrument/internals";
    import { test } from "test";
    class Test {
        private testValue = 42;
        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {
            console.log("test");
            try {
              return __instrumentModifyReturnValue("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, 42, this);
            } catch (error) {
              console.error(error);
              return __instrumentModifyReturnValue("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, 0, this);
            }
        }
    }`
  );

  isSameCode(
    t,
    testWithReturnStatement(`
      x: while (true) {
        return 42;
      }
    `),
    `import { __instrumentModifyReturnValue } from "@aikidosec/firewall/instrument/internals";
    import { test } from "test";
    class Test {
        private testValue = 42;
        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {
            console.log("test");
            x: while (true) {
              return __instrumentModifyReturnValue("testpkg.test.js.testFunction.MethodDefinition.v1.0.0", arguments, 42, this);
            }
        }
    }`
  );
});

t.test("it adds all imports if necessary (CJS)", async (t) => {
  const result = transformCode(
    "express",
    "1.0.0",
    "application.js",
    `
        test();
        `,
    "commonjs",
    {
      path: "application.js",
      versionRange: "^1.0.0",
      identifier: "testpkg.test.js.^1.0.0",
      functions: [
        {
          nodeType: "FunctionAssignment",
          name: "app[key]",
          identifier: "express.application.js.app[key].MethodDefinition.v1.0.0",
          inspectArgs: true,
          modifyArgs: true,
          modifyReturnValue: true,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    }
  );

  isSameCode(
    t,
    result,
    `const { __instrumentInspectArgs, __instrumentModifyArgs, __instrumentModifyReturnValue } = require("@aikidosec/firewall/instrument/internals");
    test();`
  );
});

t.test(
  "it does not add a empty require if no imports are needed (CJS)",
  async (t) => {
    const result = transformCode(
      "express",
      "1.0.0",
      "application.js",
      `test();`,
      "commonjs",
      {
        path: "application.js",
        versionRange: "^1.0.0",
        identifier: "testpkg.test.js.^1.0.0",
        functions: [
          {
            nodeType: "FunctionAssignment",
            name: "app[key]",
            identifier:
              "express.application.js.app[key].MethodDefinition.v1.0.0",
            inspectArgs: false,
            modifyArgs: false,
            modifyReturnValue: false,
            modifyArgumentsObject: false,
          },
        ],
        accessLocalVariables: [],
      }
    );

    isSameCode(t, result, `test();`);
  }
);

t.test(
  "it does not add a empty import if no imports are needed (ESM)",
  async (t) => {
    const result = transformCode(
      "express",
      "1.0.0",
      "application.js",
      `test();`,
      "module",
      {
        path: "application.js",
        versionRange: "^1.0.0",
        identifier: "testpkg.test.js.^1.0.0",
        functions: [
          {
            nodeType: "FunctionAssignment",
            name: "app[key]",
            identifier:
              "express.application.js.app[key].MethodDefinition.v1.0.0",
            inspectArgs: false,
            modifyArgs: false,
            modifyReturnValue: false,
            modifyArgumentsObject: false,
          },
        ],
        accessLocalVariables: [],
      }
    );

    isSameCode(t, result, `test();`);
  }
);

t.test("Modify function declaration (ESM)", async (t) => {
  const result = transformCode(
    "testpkg",
    "1.0.0",
    "application.js",
    `
      const x = 1;

      function test123(arg1, arg2 = "default") {
        console.log("test123");

        return "abc";
      }

      const ignore = function test123() {
        console.log("ignore");
      };
    `,
    "module",
    {
      path: "application.js",
      versionRange: "^1.0.0",
      identifier: "testpkg.test.js.^1.0.0",
      functions: [
        {
          nodeType: "FunctionDeclaration",
          name: "test123",
          identifier:
            "testpkg.application.js.test123.FunctionDeclaration.v1.0.0",
          inspectArgs: true,
          modifyArgs: false,
          modifyReturnValue: true,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    }
  );

  isSameCode(
    t,
    result,
    `import { __instrumentInspectArgs, __instrumentModifyReturnValue } from "@aikidosec/firewall/instrument/internals";
    const x = 1;
    function test123(arg1, arg2 = "default") {
        __instrumentInspectArgs("testpkg.application.js.test123.FunctionDeclaration.v1.0.0", arguments, "1.0.0", this);
        console.log("test123");
        return __instrumentModifyReturnValue("testpkg.application.js.test123.FunctionDeclaration.v1.0.0", arguments, "abc", this);
    }
    const ignore = function test123() {
        console.log("ignore");
    };`
  );
});

t.test("Modify function declaration (CJS)", async (t) => {
  const result = transformCode(
    "testpkg",
    "1.0.0",
    "application.js",
    `
      const x = 1;

      function test123(arg1, arg2 = "default") {
        console.log("test123");

        return "abc";
      }

      const ignore = function test123() {
        console.log("ignore");
      };
    `,
    "commonjs",
    {
      path: "application.js",
      versionRange: "^1.0.0",
      identifier: "testpkg.test.js.^1.0.0",
      functions: [
        {
          nodeType: "FunctionDeclaration",
          name: "test123",
          identifier:
            "testpkg.application.js.test123.FunctionDeclaration.v1.0.0",
          inspectArgs: false,
          modifyArgs: true,
          modifyReturnValue: false,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    }
  );

  isSameCode(
    t,
    result,
    `const { __instrumentModifyArgs } = require("@aikidosec/firewall/instrument/internals");
    const x = 1;
    function test123(arg1, arg2 = "default") {
        [arg1, arg2] = __instrumentModifyArgs("testpkg.application.js.test123.FunctionDeclaration.v1.0.0", [arg1, arg2], this);
        console.log("test123");
        return "abc";
    }
    const ignore = function test123() {
        console.log("ignore");
    };`
  );
});

t.test(
  "add inspectArgs to multi level function assignment expression (CJS)",
  async (t) => {
    const result = transformCode(
      "express",
      "1.0.0",
      "application.js",
      `
        const app = require("example");
        app.prototype.use = function (fn) {
            console.log("test");
        };
        `,
      "commonjs",
      {
        path: "application.js",
        versionRange: "^1.0.0",
        identifier: "testpkg.test.js.^1.0.0",
        functions: [
          {
            nodeType: "FunctionAssignment",
            name: "app.prototype.use",
            identifier:
              "express.application.js.app.prototype.use.MethodDefinition.v1.0.0",
            inspectArgs: true,
            modifyArgs: false,
            modifyReturnValue: false,
            modifyArgumentsObject: false,
          },
        ],
        accessLocalVariables: [],
      }
    );

    t.same(
      compareCodeStrings(
        result,
        `const { __instrumentInspectArgs } = require("@aikidosec/firewall/instrument/internals");
        const app = require("example");
        app.prototype.use = function (fn) {
            __instrumentInspectArgs("express.application.js.app.prototype.use.MethodDefinition.v1.0.0", arguments, "1.0.0", this);
            console.log("test");
        };`
      ),
      true
    );
  }
);

t.test("Modify function expression (ESM)", async (t) => {
  const result = transformCode(
    "testpkg",
    "1.0.0",
    "application.js",
    `
      const x = 1;

      const y = function test123(arg1, arg2 = "default") {
        console.log("test123");

        return "abc";
      }

      function test123() {
        console.log("ignore");
      }
    `,
    "module",
    {
      path: "application.js",
      versionRange: "^1.0.0",
      identifier: "testpkg.test.js.^1.0.0",
      functions: [
        {
          nodeType: "FunctionExpression",
          name: "test123",
          identifier:
            "testpkg.application.js.test123.FunctionExpression.v1.0.0",
          inspectArgs: true,
          modifyArgs: false,
          modifyReturnValue: true,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    }
  );

  isSameCode(
    t,
    result,
    `import { __instrumentInspectArgs, __instrumentModifyReturnValue } from "@aikidosec/firewall/instrument/internals";
    const x = 1;
    
    const y = function test123(arg1, arg2 = "default") {
        __instrumentInspectArgs("testpkg.application.js.test123.FunctionExpression.v1.0.0", arguments, "1.0.0", this);
        console.log("test123");
        return __instrumentModifyReturnValue("testpkg.application.js.test123.FunctionExpression.v1.0.0", arguments, "abc", this);
    };
    
    function test123() {
        console.log("ignore");
    }`
  );
});

t.test("Modify constructor (ESM)", async (t) => {
  const result = transformCode(
    "testpkg",
    "1.0.0",
    "application.js",
    `
      class Test {
        constructor() {
          console.log("ignore");
          const x = 1;
        }
      }
    `,
    "module",
    {
      path: "application.js",
      versionRange: "^1.0.0",
      identifier: "testpkg.test.js.^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "constructor",
          identifier:
            "testpkg.application.js.constructor.MethodDefinition.v1.0.0",
          inspectArgs: true,
          modifyArgs: false,
          modifyReturnValue: false,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    }
  );

  isSameCode(
    t,
    result,
    `import { __instrumentInspectArgs } from "@aikidosec/firewall/instrument/internals";
     class Test {
        constructor() {
        __instrumentInspectArgs("testpkg.application.js.constructor.MethodDefinition.v1.0.0", arguments, "1.0.0", this);
          console.log("ignore");
          const x = 1;
        }
      }
    `
  );
});

t.test("Modify constructor with super (ESM)", async (t) => {
  const result = transformCode(
    "testpkg",
    "1.0.0",
    "application.js",
    `
      class Test {
        constructor() {
          super();
          console.log("ignore");
        }
      }
    `,
    "module",
    {
      path: "application.js",
      versionRange: "^1.0.0",
      identifier: "testpkg.test.js.^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "constructor",
          identifier:
            "testpkg.application.js.constructor.MethodDefinition.v1.0.0",
          inspectArgs: true,
          modifyArgs: false,
          modifyReturnValue: false,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    }
  );

  isSameCode(
    t,
    result,
    `import { __instrumentInspectArgs } from "@aikidosec/firewall/instrument/internals";
     class Test {
        constructor() {
          super();
          __instrumentInspectArgs("testpkg.application.js.constructor.MethodDefinition.v1.0.0", arguments, "1.0.0", this);
          console.log("ignore");
        }
      }
    `
  );
});

t.test("Modify constructor with super (ESM)", async (t) => {
  const result = transformCode(
    "testpkg",
    "1.0.0",
    "application.js",
    `
      class Test {
        constructor(arg1) {
          test();
          super();
          console.log("ignore");
        }
      }
    `,
    "module",
    {
      path: "application.js",
      versionRange: "^1.0.0",
      identifier: "testpkg.test.js.^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "constructor",
          identifier:
            "testpkg.application.js.constructor.MethodDefinition.v1.0.0",
          inspectArgs: true,
          modifyArgs: true,
          modifyReturnValue: true,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    }
  );

  isSameCode(
    t,
    result,
    `import { __instrumentInspectArgs, __instrumentModifyArgs, __instrumentModifyReturnValue } from "@aikidosec/firewall/instrument/internals";
     class Test {
        constructor(arg1) {
          test();
          super();
          __instrumentInspectArgs("testpkg.application.js.constructor.MethodDefinition.v1.0.0", arguments, "1.0.0", this);
          [arg1] = __instrumentModifyArgs("testpkg.application.js.constructor.MethodDefinition.v1.0.0", [arg1], this);
          console.log("ignore");
        }
      }
    `
  );
});

t.test("Access local variables (ESM)", async (t) => {
  const result = transformCode(
    "testpkg",
    "1.0.0",
    "application.js",
    `
      const test = 1;

      function stub(x){
        return x++;
      }
    `,
    "module",
    {
      path: "application.js",
      versionRange: "^1.0.0",
      identifier: "testpkg.test.js.^1.0.0",
      functions: [],
      accessLocalVariables: ["test"],
    }
  );

  isSameCode(
    t,
    result,
    `
    import { __instrumentAccessLocalVariables } from "@aikidosec/firewall/instrument/internals";
    const test = 1;
    function stub(x) {
            return x++;
    }
    __instrumentAccessLocalVariables("testpkg.test.js.^1.0.0", [test]);
    `
  );
});

t.test("Access local variables (CJS)", async (t) => {
  const result = transformCode(
    "testpkg",
    "1.0.0",
    "application.js",
    `
      const test = 1;

      function stub(x){
        return x++;
      }
    `,
    "commonjs",
    {
      path: "application.js",
      versionRange: "^1.0.0",
      identifier: "testpkg.test.js.^1.0.0",
      functions: [],
      accessLocalVariables: ["test", "stub"],
    }
  );

  isSameCode(
    t,
    result,
    `
    const { __instrumentAccessLocalVariables } = require("@aikidosec/firewall/instrument/internals");
    const test = 1;
    function stub(x) {
            return x++;
    }
    __instrumentAccessLocalVariables("testpkg.test.js.^1.0.0", [test, stub]);
    `
  );
});

t.test("Returns error if already instrumented (CJS)", async (t) => {
  const error = t.throws(() => {
    transformCode(
      "testpkg",
      "1.0.0",
      "application.js",
      `
      const { __instrumentAccessLocalVariables } = require("@aikidosec/firewall/instrument/internals");
      const test = 1;

      function stub(x){
        return x++;
      }

      __instrumentAccessLocalVariables("testpkg.test.js.^1.0.0", [test, stub]);
    `,
      "commonjs",
      {
        path: "application.js",
        versionRange: "^1.0.0",
        identifier: "testpkg.test.js.^1.0.0",
        functions: [],
        accessLocalVariables: ["test", "stub"],
      }
    );
  });

  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.same(
      error.message,
      "Error transforming code: Code already contains instrument functions"
    );
  }
});

t.test("Invalid code throws error (CJS)", async (t) => {
  const error = t.throws(() => {
    transformCode(
      "testpkg",
      "1.0.0",
      "application.js",
      `
      const {

      function stub(x){
        return x++;
      }
    `,
      "commonjs",
      {
        path: "application.js",
        versionRange: "^1.0.0",
        identifier: "testpkg.test.js.^1.0.0",
        functions: [],
        accessLocalVariables: ["test", "stub"],
      }
    );
  });

  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.match(
      error.message,
      /Error transforming code: Error while parsing code:/
    );
  }
});

t.test(
  "add inspectArgs to this function assignment expression (CJS)",
  async (t) => {
    const result = transformCode(
      "express",
      "1.0.0",
      "application.js",
      `
        const app = require("example");
        this.test = function (fn) {
            console.log("test");
        };
        `,
      "commonjs",
      {
        path: "application.js",
        versionRange: "^1.0.0",
        identifier: "testpkg.test.js.^1.0.0",
        functions: [
          {
            nodeType: "FunctionAssignment",
            name: "this.test",
            identifier:
              "express.application.js.this.test.MethodDefinition.v1.0.0",
            inspectArgs: true,
            modifyArgs: false,
            modifyReturnValue: false,
            modifyArgumentsObject: false,
          },
        ],
        accessLocalVariables: [],
      }
    );

    t.same(
      compareCodeStrings(
        result,
        `const { __instrumentInspectArgs } = require("@aikidosec/firewall/instrument/internals");
        const app = require("example");
        this.test = function (fn) {
            __instrumentInspectArgs("express.application.js.this.test.MethodDefinition.v1.0.0", arguments, "1.0.0", this);
            console.log("test");
        };`
      ),
      true
    );
  }
);

t.test(
  "add inspectArgs to this arrow function assignment expression (CJS)",
  async (t) => {
    const result = transformCode(
      "express",
      "1.0.0",
      "application.js",
      `
        const app = require("example");
       this.test = (fn) => {
            console.log("test");
        };
        `,
      "commonjs",
      {
        path: "application.js",
        versionRange: "^1.0.0",
        identifier: "testpkg.test.js.^1.0.0",
        functions: [
          {
            nodeType: "FunctionAssignment",
            name: "this.test",
            identifier:
              "express.application.js.this.test.MethodDefinition.v1.0.0",
            inspectArgs: true,
            modifyArgs: false,
            modifyReturnValue: false,
            modifyArgumentsObject: false,
          },
        ],
        accessLocalVariables: [],
      }
    );

    t.same(
      compareCodeStrings(
        result,
        `const { __instrumentInspectArgs } = require("@aikidosec/firewall/instrument/internals");
        const app = require("example");
        this.test = (fn) => {
            __instrumentInspectArgs("express.application.js.this.test.MethodDefinition.v1.0.0", arguments, "1.0.0", this);
            console.log("test");
        };`
      ),
      true,
      result
    );
  }
);

t.test("Modify async return value (ESM)", async (t) => {
  const result = transformCode(
    "testpkg",
    "1.0.0",
    "application.js",
    `
      async function test(...args) {
        console.log("test");
        return await test2(...args);
      }
    `,
    "module",
    {
      path: "application.js",
      versionRange: "^1.0.0",
      identifier: "testpkg.test.js.^1.0.0",
      functions: [
        {
          nodeType: "FunctionDeclaration",
          name: "test",
          identifier: "testpkg.application.js.test.FunctionDeclaration.v1.0.0",
          inspectArgs: false,
          modifyArgs: false,
          modifyReturnValue: true,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    }
  );

  isSameCode(
    t,
    result,
    `import { __instrumentModifyReturnValue } from "@aikidosec/firewall/instrument/internals";
      async function test(...args) {
        console.log("test");
        return await __instrumentModifyReturnValue("testpkg.application.js.test.FunctionDeclaration.v1.0.0", arguments, await test2(...args), this);
      }`
  );
});

t.test("Modify async arrow function variable declaration (ESM)", async (t) => {
  const result = transformCode(
    "testpkg",
    "1.0.0",
    "application.js",
    `
      const test = async (...args) => {
        console.log("test");
        return 1;
      }
    `,
    "module",
    {
      path: "application.js",
      versionRange: "^1.0.0",
      identifier: "testpkg.test.js.^1.0.0",
      functions: [
        {
          nodeType: "FunctionVariableDeclaration",
          name: "test",
          identifier:
            "testpkg.application.js.test.FunctionVariableDeclaration.v1.0.0",
          inspectArgs: true,
          modifyArgs: false,
          modifyReturnValue: false,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    }
  );

  isSameCode(
    t,
    result,
    `import { __instrumentInspectArgs } from "@aikidosec/firewall/instrument/internals";
    const test = async (...args) => {
        __instrumentInspectArgs("testpkg.application.js.test.FunctionVariableDeclaration.v1.0.0", arguments, "1.0.0", this);
        console.log("test");
        return 1;
    };`
  );
});

t.test("Modify function variable declaration (ESM)", async (t) => {
  const result = transformCode(
    "testpkg",
    "1.0.0",
    "application.js",
    `
      const test = function (...args) {
        console.log("test");
        return 1;
      }
    `,
    "module",
    {
      path: "application.js",
      versionRange: "^1.0.0",
      identifier: "testpkg.test.js.^1.0.0",
      functions: [
        {
          nodeType: "FunctionVariableDeclaration",
          name: "test",
          identifier:
            "testpkg.application.js.test.FunctionVariableDeclaration.v1.0.0",
          inspectArgs: true,
          modifyArgs: false,
          modifyReturnValue: false,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    }
  );

  isSameCode(
    t,
    result,
    `import { __instrumentInspectArgs } from "@aikidosec/firewall/instrument/internals";
      const test = function(...args) {
              __instrumentInspectArgs("testpkg.application.js.test.FunctionVariableDeclaration.v1.0.0", arguments, "1.0.0", this);
              console.log("test");
              return 1;
      };`
  );
});

t.test("Do not modify function variable declaration (ESM)", async (t) => {
  const result = transformCode(
    "testpkg",
    "1.0.0",
    "application.js",
    `
      const test = function (...args) {
        console.log("test");
        return 1;
      }
    `,
    "module",
    {
      path: "application.js",
      versionRange: "^1.0.0",
      identifier: "testpkg.test.js.^1.0.0",
      functions: [
        {
          nodeType: "FunctionVariableDeclaration",
          name: "testabc",
          identifier:
            "testpkg.application.js.test.FunctionVariableDeclaration.v1.0.0",
          inspectArgs: true,
          modifyArgs: false,
          modifyReturnValue: false,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    }
  );

  isSameCode(
    t,
    result,
    `import { __instrumentInspectArgs } from "@aikidosec/firewall/instrument/internals";
      const test = function(...args) {
          console.log("test");
          return 1;
      };`
  );
});

t.test("Test codegen comment behavior", async (t) => {
  const result = transformCode(
    "testpkg",
    "1.0.0",
    "application.js",
    `
      /**
       * test
       **/
      const test = function (...args) { // test
        console.log("test");
        // test
        return 1;
      }
    `,
    "module",
    {
      path: "application.js",
      versionRange: "^1.0.0",
      identifier: "testpkg.test.js.^1.0.0",
      functions: [
        {
          nodeType: "FunctionVariableDeclaration",
          name: "testabc",
          identifier:
            "testpkg.application.js.test.FunctionVariableDeclaration.v1.0.0",
          inspectArgs: true,
          modifyArgs: false,
          modifyReturnValue: false,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    }
  );

  isSameCode(
    t,
    result,
    `import { __instrumentInspectArgs } from "@aikidosec/firewall/instrument/internals";
      /**
      * test
      **/
      const test = function(...args) {
              console.log("test");
              // test
              return 1;
      };`
  );
});
