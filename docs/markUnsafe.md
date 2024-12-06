# Marking Unsafe Input

To flag input as unsafe, you can use the `markUnsafe` function. This is useful when you want to explicitly label data as potentially dangerous, such as output from an LLM being used to generate a file name. Here's an example:

```js
const Zen = require("@aikidosec/firewall");
const OpenAI = require("openai");
const fs = require("fs/promises");

const completion = await openai.chat.completions.create({
  messages: [
    { role: "user", content: "Generate a filename to save the report." },
  ],
});

const generatedFilename = completion.choices[0].message.content;

// Mark the generated filename as unsafe
Zen.markUnsafe(generatedFilename);

await fs.writeFile(`reports/${generatedFilename}`);
```

The output of LLM models should be treated as potentially dangerous, as they can be manipulated to perform attacks. Similarly, other dynamically generated or user-controlled inputs may also be sources of potential attacks.

You can pass strings, objects, and arrays to `markUnsafe`. Zen will track the marked data across your application and will be able to detect any attacks that may be attempted using the marked data.

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
