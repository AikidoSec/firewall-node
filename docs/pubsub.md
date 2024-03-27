# Google Cloud Pub/Sub

At the very beginning of your app.js file, add the following line:

```js
require('@aikidosec/runtime'); // <-- Include this before any other code or imports

const { PubSub } = require('@google-cloud/pubsub');

const client = new PubSub();
const topic = client.createTopic('my-topic');
const subscription = topic.createSubscription('my-subscription');

subscription.on('message', (message) => {
  console.log('Received message:', message.data.toString());
  message.ack();
});

// ...
```

or ESM import style:

```js
import '@aikidosec/runtime';

// ...
```

That's it! Your app is now protected by Aikido guard.

If you want to see a full example, check our [Pub/Sub sample app](../sample-apps/pubsub-mongodb).

## Preventing prototype pollution

Aikido runtime can also protect your application against prototype pollution attacks.

Read [Protect against prototype pollution](./prototype-pollution.md) to learn how to set it up.

## Debug mode

If you need to debug the runtime, you can run your consumer with the environment variable `AIKIDO_DEBUG` set to `true`.

This will output debug information to the console (e.g. if the agent failed to start, no token was found, unsupported packages, ...).
