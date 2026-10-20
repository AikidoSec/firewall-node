# Marking Unsafe Input

To flag input as unsafe, you can use the `markUnsafe` function. This is useful when you want to explicitly label data as potentially dangerous, such as output from an LLM being used to generate a file name. Here's an example using OpenAI's function calling feature:

```js
import Zen from "@aikidosec/firewall";
import OpenAI from "openai";
import { readFile } from "fs/promises";

const openai = new OpenAI();

const completion = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [
    {
      role: "user",
      content: "Read the contents of the config file",
    },
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "read_file",
        description: "Read the contents of a file",
        parameters: {
          type: "object",
          properties: {
            filepath: {
              type: "string",
              description: "The path to the file to read",
            },
          },
          required: ["filepath"],
        },
      },
    },
  ],
});

const toolCall = completion.choices[0].message.tool_calls[0];
const filepath = JSON.parse(toolCall.function.arguments).filepath;

// Mark the filepath as unsafe since it came from the LLM
Zen.markUnsafe(filepath);

// This will be blocked if the LLM tries to perform path traversal
// e.g. if filepath is "../../../etc/passwd"
await readFile(filepath);
```

This example shows how to protect against path traversal attacks when using OpenAI's function calling feature. The LLM might try to access sensitive files using path traversal (e.g., `../../../etc/passwd`), but Zen will detect and block these attempts.

You can also pass multiple arguments to `markUnsafe`:

```js
Zen.markUnsafe(a, b, c);
```

You can pass strings, objects, and arrays to `markUnsafe`. Zen will track the marked data across your application and will be able to detect any attacks that may be attempted using the marked data.

## Caveats when marking data as unsafe

⚠️ Be careful when marking data as unsafe, as it may lead to false positives. If you generate a full SQL query using an LLM and mark it as unsafe, Zen will flag all queries using that SQL as an attack.

BAD:

```js
Zen.markUnsafe("SELECT * FROM users WHERE id = '' OR 1=1 -- '");

await db.query("SELECT * FROM users WHERE id = '' OR 1=1 -- '");
```

GOOD:

```js
Zen.markUnsafe("' OR 1=1 -- ");

await db.query("SELECT * FROM users WHERE id = '' OR 1=1 -- '");
```
