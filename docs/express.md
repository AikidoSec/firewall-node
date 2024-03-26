# Express

At the very beginning of your app.js file, add the following line:

```js
const { protect } = require('@aikidosec/runtime');

protect(); // <-- Call this before any other code or imports

const express = require('express');

const app = express();

// ...
```

or ESM import style:

```js
import { protect } from '@aikidosec/runtime';

// ...
```

That's it! Your app is now protected by Aikido runtime.

If you want to see a full example, check our [express sample app](../sample-apps/express-mongodb).

## Preventing prototype pollution

Aikido runtime can also protect your application against prototype pollution attacks.

Read [Protect against prototype pollution](./prototype-pollution.md) to learn how to set it up.

## Debug mode

If you need to debug the runtime, you can set the `debug` option to `true`:

```js
protect({ debug: true });
```

This will output debug information to the console (e.g. if the agent failed to start, no token was found, unsupported packages, ...).
