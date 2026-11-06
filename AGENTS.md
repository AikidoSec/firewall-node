## Development Notes

- You should always format code after making changes using `node --run format`
- When running an e2e test, cd into end2end and then use npx tap tests/<test file>.ts
- Use nvm to switch node versions if needed (ESM instrumentation requires 24+)
- When running unit tests, cd into library and then use npx tap sinks/<test file>.ts
- To check for TypeScript errors and linting: `node --run lint`

## Old vs new instrumentation

The old instrumentation monkey patches node's require
(this only works for common js code)
The new instrumentation works for common js and ESM modules (we use the new loader hook `module.registerHooks`)
When a file is loaded from disk, we use rust with oxc crates to parse the code and then inject function calls inside certain functions so that we can inspect args, modify args and inspect the return values
Builtin modules are instrumented using the common js instrumentation but then we call:

```js
import { syncBuiltinESMExports } from "module";
```

This will make sure the instrumented builtin functions are synced to the ESM version of the builtin module.
Both are actively maintained (for Node.js 16+ compat).

## Writing code

- Linter: oxlint (not eslint). Use oxlint's suppression comments if needed.
- Use `setTimeout` from `node:timers/promises` instead of `new Promise((r) => setTimeout(r, ms))`. Use `{ ref: false }` when the timer shouldn't keep the process alive.
- If you add new tests do not only execute them with tap, but also run `node --run test:esm -- './path/to/test/file.js'` to make sure the new tests work with the ESM instrumentation. Note that .ts -> .js extension.
- If you really need to execute all unit tests, or you are working on unit tests that are e.g. db related, containers used in tests can be started using `node --run containers` if stopped.
- When building or merging objects use `createSafeObject` instead of object spread. It creates a `null` prototype object, so a polluted `Object.prototype` can't change its behavior.
- Leverage TypeScript's type system to prevent runtime errors. Use discriminated unions, exhaustive switches, and explicit return types. For example:

```typescript
// Use discriminated unions instead of loose types
type Result = { success: true; value: number } | { success: false };
// Use exhaustive switches with return type annotations
type SQLDialect = "mysql" | "postgres" | "sqlite";
function getQuoteChar(dialect: SQLDialect): string {
  switch (dialect) {
    case "mysql":
      return "`";
    case "postgres":
      return '"';
    case "sqlite":
      return '"';
  }
}
```

Adding a new variant to a union should cause a compile error wherever it's not handled, not a runtime bug.
