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

const isSameCode = (code1: string, code2: string) => {
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
    }
  );

  isSameCode(
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
    }
  );

  isSameCode(
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
    }
  );

  isSameCode(
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
    }
  );

  isSameCode(
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
      }
    );
    t.fail("Should throw an error");
  } catch (error) {
    t.ok(error instanceof Error);
    if (error instanceof Error) {
      t.match(error.message, "Error transforming code: #ERR:");
      t.match(error.message, 'Expected `;` but found `:`"');
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
        identifier: "testmodule.test.js.testFunction.MethodDefinition.v1.0.0",
        inspectArgs: true,
        modifyArgs: false,
        modifyReturnValue: false,
        modifyArgumentsObject: false,
      },
    ],
  });

  isSameCode(
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
    }
  );

  isSameCode(
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
    }
  );

  isSameCode(
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
    }
  );

  isSameCode(
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
    }
  );

  isSameCode(
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
    }
  );

  isSameCode(
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
    }
  );

  isSameCode(
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
      }
    );

  isSameCode(
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
    }
  );

  isSameCode(
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
      }
    );

    isSameCode(result, `test();`);
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
      }
    );

    isSameCode(result, `test();`);
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
    }
  );

  isSameCode(
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
    }
  );

  isSameCode(
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
