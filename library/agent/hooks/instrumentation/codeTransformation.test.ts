import * as t from "tap";
import { transformCode } from "./codeTransformation";

const compareCodeStrings = (code1: string, code2: string) => {
  return code1.replace(/\s+/g, "") === code2.replace(/\s+/g, "");
};

t.test("add inspectArgs to method definition (ESM)", async (t) => {
  const result = transformCode(
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
    true,
    {
      path: "test.js",
      versionRange: "^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "testFunction",
          identifier: "testmodule.test.js.testFunction.v1.0.0",
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
      `import { __instrumentInspectArgs } from "@aikidosec/firewall/instrument/internals";
    import { test } from "test";
    class Test {
        private testValue = 42;

        constructor() {
            this.testFunction(testValue);
        }
        testFunction(arg1) {
            __instrumentInspectArgs("testmodule.test.js.testFunction.v1.0.0", arguments); 
            console.log("test");
        }
    }`
    ),
    true
  );
});

t.test("add inspectArgs to method definition (CJS)", async (t) => {
  const result = transformCode(
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
    false,
    {
      path: "test.js",
      versionRange: "^1.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "testFunction",
          identifier: "testmodule.test.js.testFunction.v1.0.0",
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
      `const { __instrumentInspectArgs } = require("@aikidosec/firewall/instrument/internals");
      import { test } from "test";
      class Test {
          private testValue = 42;
  
          constructor() {
              this.testFunction(testValue);
          }
          testFunction(arg1) {
              __instrumentInspectArgs("testmodule.test.js.testFunction.v1.0.0", arguments); 
              console.log("test");
          }
      }`
    ),
    true
  );
});

t.test("wrong function name", async (t) => {
  const result = transformCode(
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
    false,
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

  t.same(
    compareCodeStrings(
      result,
      `const { __instrumentInspectArgs } = require("@aikidosec/firewall/instrument/internals");
        import { test } from "test";
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
    false,
    {
      path: "test.ts",
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

  t.same(
    compareCodeStrings(
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
    ),
    true
  );
});

t.test("typescript code in a js file", async (t) => {
  try {
    transformCode(
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
      false,
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
  const result = transformCode("test.mjs", "", false, {
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
      `import { __instrumentInspectArgs } from "@aikidosec/firewall/instrument/internals";`
    ),
    true
  );
});
