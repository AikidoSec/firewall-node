# Protect against prototype pollution

Aikido runtime can also protect your application against [prototype pollution attacks](https://www.aikido.dev/blog/prevent-prototype-pollution).

It works by calling [Object.freeze](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze) for some built-in JavaScript objects.

> The `Object.freeze()` method freezes an object. A frozen object can no longer be changed; freezing an object prevents new properties from being added to it, existing properties from being removed, prevents changing the enumerability, configurability, or writability of existing properties, and prevents the values of existing properties from being changed.

We believe that there are legitimate cases of prototype changes, but they should happen only during the initialization step. Hence, we recommend calling `preventPrototypePollution` when your application is initialised.

```js
import { preventPrototypePollution } from '@aikidosec/runtime';

import express from 'express';

preventPrototypePollution(); // <-- Call this after your main imports

const app = express();

app.get("/", (req, res) => {
  res.send("Hello, world!");
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
```

## WARNING: Read this before using `preventPrototypePollution`

This might break your application or result in strange errors if you are using libraries that rely on changing the prototype of built-in objects after your application has started. We recommend testing your application thoroughly after calling `preventPrototypePollution`.

## Incompatible packages

Some packages may not work properly when `preventPrototypePollution` is called, these are some of the known packages:

* [mongoose](https://www.npmjs.com/package/mongoose) (versions 1.x to 4.x)
