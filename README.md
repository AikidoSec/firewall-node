# Aikido Runtime for Node.js

![NPM Version](https://img.shields.io/npm/v/%40aikidosec%2Fruntime?style=flat-square) ![Codecov](https://img.shields.io/codecov/c/github/AikidoSec/runtime-node?style=flat-square&token=AJK9LU35GY) ![NPM License](https://img.shields.io/npm/l/%40aikidosec%2Fruntime?style=flat-square)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com) ![](https://github.com/AikidoSec/runtime-node/actions/workflows/unit-test.yml/badge.svg) ![](https://github.com/AikidoSec/runtime-node/actions/workflows/end-to-end-tests.yml/badge.svg)

## Features

Protects your application against

* 🛡️ [NoSQL injection attacks](https://www.aikido.dev/blog/web-application-security-vulnerabilities)
* 🛡️ [SQL injection attacks]([https://www.aikido.dev/blog/web-application-security-vulnerabilities](https://owasp.org/www-community/attacks/SQL_Injection))
* 🛡️ [Prototype pollution](./docs/prototype-pollution.md)
* 🔥 More to come (See roadmap below)

## Roadmap

* [ ] Monitor outbound requests
* [ ] Protect against path traversal attacks
* [ ] Protect against SSRF attacks
* [ ] Protect against shell injection attacks

## Supported libraries and frameworks

Aikido runtime for Node.js is compatible with

* ✅ [`express`](https://www.npmjs.com/package/express) 4.x
* ✅ [`mongodb`](https://www.npmjs.com/package/mongodb) 4.x, 5.x and 6.x _(npm package versions, not MongoDB server versions)_
* ✅ [`mongoose`](https://www.npmjs.com/package/mongoose) 8.x, 7.x and 6.x
* ✅ [`pg`](https://www.npmjs.com/package/pg) 8.x and 7.x
* ✅ [`mysql`](https://www.npmjs.com/package/mysql) 2.x
* ✅ [`mysql2`](https://www.npmjs.com/package/mysql2) 3.x
* ✅ [`@google-cloud/pubsub`](https://www.npmjs.com/package/@google-cloud/pubsub) 4.x
* ✅ [`@google-cloud/functions-framework`](https://www.npmjs.com/package/@google-cloud/functions-framework) 3.x
* ✅ AWS Lambda

## Installation

```shell
# The --save-exact makes sure that you don't automatically install a newer version
$ npm install --save-exact @aikidosec/runtime

# The --exact makes sure that you don't automatically install a newer version
$ yarn add --exact @aikidosec/runtime
```

* For express based apps, follow the [Express](docs/express.md) instructions
* For AWS Lambda, follow the [AWS Lambda](docs/lambda.md) instructions
* For `@google-cloud/pubsub`, follow the [Google Cloud Pub/Sub](docs/pubsub.md) instructions
* For `@google-cloud/functions-framework`, follow the [Google Cloud Functions](docs/cloud-functions.md) instructions

## Reporting to Aikido

> Aikido Security is a developer-first software security platform. We scan your source code & cloud to show you which vulnerabilities are actually important.

You can use some of this library's features without Aikido, but you will get the most value when using it with Aikido.

You will need an Aikido account and a token to report events to Aikido. If you don't have an account, you can [sign up for free](https://app.aikido.dev/login).

Here's how:
* [Login to your Aikido account](https://app.aikido.dev/login)
* Go to [Runtime protection](https://app.aikido.dev/runtime)
* Go to services
* Click on "Add service"
* Choose a name for your service
* Click on "Generate token"
* Copy the token
* Set the token as an environment variable:

```shell
AIKIDO_TOKEN=your-token node your-app.js
```

(Or use [dotenv](dotenv) to load the token from an `.env` file)

## Running in dry mode

If you want to test the runtime without blocking any requests, you can set the `AIKIDO_NO_BLOCKING` environment variable to `true`:

```shell
AIKIDO_NO_BLOCKING=true node your-app.js
```

(Or use [dotenv](dotenv) to load the token from an `.env` file)

See [Reporting NoSQL injections to Aikido](#reporting-nosql-injections-to-aikido) to learn how to send events to Aikido.

## Performance

We run a benchmark on every commit to make sure that the runtime has a minimal impact on your application's performance.

The bench runs [a simple MongoDB query](benchmarks/mongodb/getUser.js) to measure the difference between two runs with and without the runtime:

| Without runtime  | With runtime  | Difference in ms |
|------------------|---------------|------------------|
| 0.214ms          | 0.222ms       | +0.008ms         |

(Using Node.js 18.x and MongoDB 6.3.x, results will vary depending on your hardware)

See [benchmarks](benchmarks) for more information.

## Development

* `$ make install` to install dependencies
* `$ make build` to build the library
* `$ make watch` to watch for changes and rebuild the library
* `$ make test` to run tests using tap
* `$ make end2end` to run end-to-end tests using tap
* `$ make lint` to run ESLint
