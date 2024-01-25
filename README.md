# Aikido RASP - Runtime Application Self-Protection

## Features

* 🛡️ Protects your application against [NoSQL injection attacks](https://learn.snyk.io/lesson/nosql-injection-attack/)
* 🔥 More to come

## Supported libraries and frameworks

Aikido RASP is compatible with

* ✅ Express 4.x
* ✅ MongoDB 4.x, 5.x and 6.x

### Installation

```shell
$ npm install @aikidosec/rasp
```

#### Express

At the very beginning of your app.js file, add the following line:

```js
require('@aikidosec/rasp').protect();
```

That's it!

#### AWS Lambda

At the very beginning of your handler.js file, add the following line:

```js
const { protect, protectLambda } = require('@aikidosec/rasp');

protect();
```

And then wrap your handler function with the `protectLambda` function:

```js
exports.handler = protectLambda(async (event, context) => {
  // Your handler code
});
```

In order for the RASP to work properly, we need the following event properties to be present:

* `event.httpMethod`
* `event.body`
* `event.headers`

That's it!