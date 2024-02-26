# Aikido Guard for Node.js

![NPM Version](https://img.shields.io/npm/v/%40aikidosec%2Fguard?style=flat-square) ![Codecov](https://img.shields.io/codecov/c/github/AikidoSec/guard-node?style=flat-square&token=AJK9LU35GY) ![NPM License](https://img.shields.io/npm/l/%40aikidosec%2Fguard?style=flat-square)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

## Features

* 🛡️ Protects your application against [NoSQL injection attacks](https://www.aikido.dev/blog/web-application-security-vulnerabilities)
* 🛡️ Protects your application against [SQL injection attacks]([https://www.aikido.dev/blog/web-application-security-vulnerabilities](https://owasp.org/www-community/attacks/SQL_Injection))
* 🔥 More to come (See roadmap below)

## Roadmap

* [ ] Monitor outbound requests
* [ ] Protect against path traversal attacks
* [ ] Protect against SSRF attacks
* [ ] Protect against shell injection attacks

## Supported libraries and frameworks

Aikido guard for Node.js is compatible with

* ✅ [`express`](https://www.npmjs.com/package/express) 4.x
* ✅ [`mongodb`](https://www.npmjs.com/package/mongodb) 4.x, 5.x and 6.x _(npm package versions, not MongoDB server versions)_
* ✅ [`mongoose`](https://www.npmjs.com/package/mongoose) Mongoose 8.x, 7.x and 6.x

## Installation

```shell
$ npm install @aikidosec/guard
```

* For express based apps, follow the [Express](docs/express.md) instructions
* For AWS Lambda, follow the [AWS Lambda](docs/lambda.md) instructions

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

If you want to test the guard without blocking any requests, you can set the `AIKIDO_NO_BLOCKING` environment variable to `true`:

```shell
AIKIDO_NO_BLOCKING=true node your-app.js
```

(Or use [dotenv](dotenv) to load the token from an `.env` file)

See [Reporting NoSQL injections to Aikido](#reporting-nosql-injections-to-aikido) to learn how to send events to Aikido.

## Performance

We run a benchmark on every commit to make sure that the guard has a minimal impact on your application's performance.

The bench runs [a simple MongoDB query](benchmarks/mongodb/getUser.js) 100 times for warmup and then 1000 times to measure the average time:

| Without guard | With guard | Difference in ms | Difference in % |
|---------------|------------|------------------|-----------------|
| 0.2355ms      | 0.2575ms   | +0.022ms         | +8.54%          |

(Using Node.js 18.x and MongoDB 6.3.x, results will vary depending on your hardware)

See [benchmarks](benchmarks) for more information.

## Development

* `$ make install` to install dependencies
* `$ make build` to build the library
* `$ make watch` to watch for changes and rebuild the library
* `$ make test` to run tests using tap
* `$ make lint` to run ESLint
* `$ make docs` to generate documentation in the ./generated_docs
