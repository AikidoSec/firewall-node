# Google Cloud Pub/Sub

At the very beginning of your app.js file, add the following line:

```js
const { protect, preventPrototypePollution } = require('@aikidosec/guard');

protect(); // <-- Call this before any other code or imports

const { PubSub } = require('@google-cloud/pubsub');

preventPrototypePollution(); // <-- Call this after your main imports

// ...
```

You can read more about `preventPrototypePollution` [here](./prototype-pollution.md).

or ESM import style:

```js
import { protect, preventPrototypePollution } from '@aikidosec/guard';

// ...
```

That's it! Your app is now protected by Aikido guard.

If you want to see a full example, check our [express sample app](../sample-apps/pubsub-mongodb).

## Debug mode

If you need to debug the guard, you can set the `debug` option to `true`:

```js
protect({ debug: true });
```

This will output debug information to the console (e.g. if the agent failed to start, no token was found, unsupported packages, ...).
