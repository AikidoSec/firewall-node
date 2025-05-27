// Transform script for jscodeshift
// tap-to-node-test-transform.js

module.exports = function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);
  let tapIdentifier = "t"; // Default identifier for the tap module

  // 1. Handle Imports: Find tap import, determine its alias (tapIdentifier), remove it, and add new imports
  const tapImportPaths = root.find(j.ImportDeclaration, {
    source: { type: "StringLiteral", value: "tap" },
  });

  if (tapImportPaths.length > 0) {
    const firstTapImport = tapImportPaths.at(0).get().node;
    const namespaceSpecifier = firstTapImport.specifiers.find(
      (s) =>
        s.type === "ImportNamespaceSpecifier" ||
        s.type === "ImportDefaultSpecifier"
    );
    if (namespaceSpecifier) {
      tapIdentifier = namespaceSpecifier.local.name;
    }
    tapImportPaths.remove();

    const newImports = [
      j.importDeclaration(
        [j.importDefaultSpecifier(j.identifier("test"))],
        j.literal("node:test")
      ),
      j.importDeclaration(
        [j.importSpecifier(j.identifier("strict"), j.identifier("assert"))],
        j.literal("node:assert/strict")
      ),
    ];
    const programBody = root.find(j.Program).get("body");
    if (programBody.value) {
      programBody.value.unshift(...newImports);
    } else {
      const programNode = root.get().node;
      if (programNode && programNode.body) {
        programNode.body.unshift(...newImports);
      } else {
        console.warn(
          `Could not find program body to insert imports in ${file.path}`
        );
      }
    }
  }

  // 2. Handle module-level calls (e.g., tap.beforeEach, tap.afterEach)
  const moduleLevelMethodsToTransform = {
    beforeEach: "beforeEach",
    afterEach: "afterEach",
    // Add other direct module exports if any, e.g. t.mochaGlobals()
  };

  Object.keys(moduleLevelMethodsToTransform).forEach((tapMethod) => {
    const nodeTestMethod = moduleLevelMethodsToTransform[tapMethod];
    root
      .find(j.CallExpression, {
        callee: {
          type: "MemberExpression",
          object: { name: tapIdentifier },
          property: { name: tapMethod },
        },
      })
      .forEach((path) => {
        path.node.callee = j.memberExpression(
          j.identifier("test"),
          j.identifier(nodeTestMethod)
        );
        // Note: Callbacks of beforeEach/afterEach might need their own transformations for 't.end()' etc.
        // This will be handled if the callback parameter is processed like a test instance parameter.
      });
  });

  // 3. Handle tap.test(...) calls and transform methods called on its test instance parameter
  root
    .find(j.CallExpression, {
      callee: {
        type: "MemberExpression",
        object: { name: tapIdentifier },
        property: { name: "test" },
      },
    })
    .forEach((testCallPath) => {
      // This is a tapModule.test(...) call
      testCallPath.node.callee = j.identifier("test"); // tapModule.test -> test

      if (
        testCallPath.node.arguments.length > 1 &&
        (testCallPath.node.arguments[1].type === "ArrowFunctionExpression" ||
          testCallPath.node.arguments[1].type === "FunctionExpression")
      ) {
        const callback = testCallPath.node.arguments[1];

        if (
          callback.params.length > 0 &&
          callback.params[0].type === "Identifier"
        ) {
          const testInstanceParamName = callback.params[0].name; // e.g., 't' from (t) => {}

          // Find all method calls on this testInstanceParamName within the callback body
          j(callback.body)
            .find(j.CallExpression, {
              callee: {
                type: "MemberExpression",
                object: { name: testInstanceParamName },
              },
            })
            .forEach((instanceMethodCallPath) => {
              const methodNode = instanceMethodCallPath.node;
              const calledMethodName = methodNode.callee.property.name;

              let newCalleeObjectName = null; // For 'assert'
              let newCalleePropertyName = null; // For assert method name
              let removeCall = false;
              let keepCallAsIs = false; // For methods like plan(), skip() on test context

              switch (calledMethodName) {
                // Standard assertions to convert to assert.*
                case "same":
                case "deepEqual":
                case "strictSame":
                  newCalleeObjectName = "assert";
                  newCalleePropertyName = "deepStrictEqual";
                  break;
                case "equal":
                case "strictEqual":
                  newCalleeObjectName = "assert";
                  newCalleePropertyName = "strictEqual";
                  break;
                case "notOk":
                  newCalleeObjectName = "assert";
                  newCalleePropertyName = "ok";
                  if (methodNode.arguments.length > 0) {
                    methodNode.arguments[0] = j.unaryExpression(
                      "!",
                      methodNode.arguments[0]
                    );
                  }
                  break;
                case "ok":
                case "true":
                  newCalleeObjectName = "assert";
                  newCalleePropertyName = "ok";
                  break;
                case "not":
                case "false":
                  newCalleeObjectName = "assert";
                  newCalleePropertyName = "ok";
                  if (methodNode.arguments.length > 0) {
                    methodNode.arguments[0] = j.unaryExpression(
                      "!",
                      methodNode.arguments[0]
                    );
                  }
                  break;
                case "fail":
                  newCalleeObjectName = "assert";
                  newCalleePropertyName = "fail";
                  break;
                case "throws":
                  newCalleeObjectName = "assert";
                  newCalleePropertyName = "throws";
                  break;
                case "doesNotThrow":
                  newCalleeObjectName = "assert";
                  newCalleePropertyName = "doesNotThrow";
                  break;

                // Newly supported methods
                case "match":
                  newCalleeObjectName = "assert";
                  newCalleePropertyName = "deepStrictEqual";
                  const comments = methodNode.comments || [];
                  comments.push(
                    j.commentLine(
                      ` TODO: Review ${testInstanceParamName}.match conversion. Was partial match, now deepStrictEqual.`
                    )
                  );
                  methodNode.comments = comments;
                  break;
                case "pass":
                  newCalleeObjectName = "assert";
                  newCalleePropertyName = "ok";
                  const passArgs = [j.literal(true)];
                  if (methodNode.arguments.length > 0) {
                    passArgs.push(methodNode.arguments[0]);
                  }
                  methodNode.arguments = passArgs;
                  break;

                // Test instance control methods
                case "end":
                  removeCall = true;
                  break;
                case "plan":
                case "skip":
                case "todo": // These methods exist on node:test context's instance parameter
                  keepCallAsIs = true; // Callee object is testInstanceParamName, which is correct.
                  break;

                default:
                  console.warn(
                    `Unsupported tap instance method: ${testInstanceParamName}.${calledMethodName} in ${file.path} at line ${methodNode.loc?.start.line}`
                  );
                  break;
              }

              if (newCalleeObjectName && newCalleePropertyName) {
                methodNode.callee = j.memberExpression(
                  j.identifier(newCalleeObjectName),
                  j.identifier(newCalleePropertyName)
                );
              } else if (removeCall) {
                // If it's a standalone statement like `t.end();`, remove the whole ExpressionStatement parent.
                if (
                  instanceMethodCallPath.parentPath.node.type ===
                  "ExpressionStatement"
                ) {
                  j(instanceMethodCallPath.parentPath).remove();
                } else {
                  // If t.end() is not a standalone statement (e.g., part of another expression), this is more complex.
                  // For now, warn, as this is less common.
                  console.warn(
                    `Could not cleanly remove ${testInstanceParamName}.${calledMethodName} as it's not a standalone statement in ${file.path} at line ${methodNode.loc?.start.line}. It might need manual removal.`
                  );
                }
              } else if (keepCallAsIs) {
                // Do nothing, callee remains testInstanceParamName.methodName (which is the desired node:test context method)
              }
            });
        }
      }
    });

  return root.toSource({
    quote: "single",
    trailingComma: true,
    lineTerminator: "\n",
  });
};
