# Aikido RASP - Runtime Application Self-Protection

## Features

* 🛡️ Protects your application against [NoSQL injection attacks](https://learn.snyk.io/lesson/nosql-injection-attack/)
* 🔥 More to come

## Supported libraries and frameworks

Aikido RASP is compatible with

* ✅ Express 4.x
* ✅ MongoDB 4.x, 5.x and 6.x
* ✅ Mongoose 8.x

## Installation

```shell
$ npm install @aikidosec/rasp
```

### Express

At the very beginning of your app.js file, add the following line:

```js
require('@aikidosec/rasp').protect();
```

That's it!

If you need to debug the RASP, you can set the `debug` option:

```js
require('@aikidosec/rasp').protect({ debug: true });
```

### AWS Lambda

At the very beginning of your handler.js file, add the following line:

```js
const protect = require("@aikidosec/rasp").lambda();
```

And then wrap your handler function with the `protect` function:

```js
exports.handler = protect(async (event, context) => {
  // Your handler code
});
```

In order for the RASP to work properly, we need the following event properties to be present:

* `event.httpMethod`
* `event.body`
* `event.headers`

That's it!

If you need to debug the RASP, you can set the `debug` option:

```js
const protect = require("@aikidosec/rasp").lambda({ debug: true });
```

## Reporting NoSQL injections to Aikido

> Aikido Security is a developer-first software security platform. We scan your source code & cloud to show you which vulnerabilities are actually important.
>
> [Sign up for free](https://app.aikido.dev/login)

In order to send events to Aikido, grab a token from the Aikido dashboard (TODO).

Set the token as an environment variable:

```shell
AIKIDO_TOKEN=your-token node your-app.js
```

(Or use [dotenv](dotenv) to load the token from an `.env` file)

## Development

* `$ make install` to install dependencies
* `$ make build` to build the library
* `$ make watch` to watch for changes and rebuild the library
* `$ make test` to run tests using tap
* `$ make lint` to run ESLint
