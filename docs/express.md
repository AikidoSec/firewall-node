# Express

At the very beginning of your app.js file, add the following line:

```js
const { protect, preventPrototypePollution } = require('@aikidosec/guard');

protect(); // <-- Call this before any other code or imports

const express = require('express');

preventPrototypePollution(); // <-- Call this after your main imports

// ...
```

You can read more about `preventPrototypePollution` [here](./prototype-pollution.md).

or ESM import style:

```js
import { protect, preventPrototypePollution } from '@aikidosec/guard';

// ...
```

That's it! Your Express app is now protected by Aikido guard.

## Debug mode

If you need to debug the guard, you can set the `debug` option to `true`:

```js
protect({ debug: true });
```

This will output debug information to the console (e.g. if the agent failed to start, no token was found, unsupported packages, ...).
