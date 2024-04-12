# Aikido Runtime Protection for Node.js

![NPM Version](https://img.shields.io/npm/v/%40aikidosec%2Fruntime?style=flat-square) ![Codecov](https://img.shields.io/codecov/c/github/AikidoSec/runtime-node?style=flat-square&token=AJK9LU35GY) ![NPM License](https://img.shields.io/npm/l/%40aikidosec%2Fruntime?style=flat-square)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com) ![](https://github.com/AikidoSec/runtime-node/actions/workflows/unit-test.yml/badge.svg) ![](https://github.com/AikidoSec/runtime-node/actions/workflows/end-to-end-tests.yml/badge.svg)

## Features

Protects your application against

* 🛡️ [NoSQL injection attacks](https://www.aikido.dev/blog/web-application-security-vulnerabilities)
* 🛡️ [SQL injection attacks]([https://www.aikido.dev/blog/web-application-security-vulnerabilities](https://owasp.org/www-community/attacks/SQL_Injection))
* 🛡️ [Command injection attacks](https://owasp.org/www-community/attacks/Command_Injection)
* 🛡️ [Prototype pollution](./docs/prototype-pollution.md)
* 🛡 [Path traversal attacks](https://owasp.org/www-community/attacks/Path_Traversal)
* 🚀 More to come. See [public roadmap](https://github.com/orgs/AikidoSec/projects/2/views/1)

## Supported libraries and frameworks

Aikido runtime for Node.js 16+ is compatible with

### Web frameworks

* ✅ [`express`](https://www.npmjs.com/package/express) 4.x

### Database drivers

* ✅ [`mongodb`](https://www.npmjs.com/package/mongodb) 4.x, 5.x and 6.x _(npm package versions, not MongoDB server versions)_
* ✅ [`mongoose`](https://www.npmjs.com/package/mongoose) 8.x, 7.x and 6.x
* ✅ [`pg`](https://www.npmjs.com/package/pg) 8.x and 7.x
* ✅ [`mysql`](https://www.npmjs.com/package/mysql) 2.x
* ✅ [`mysql2`](https://www.npmjs.com/package/mysql2) 3.x

### Cloud providers

* ✅ [`@google-cloud/functions-framework`](https://www.npmjs.com/package/@google-cloud/functions-framework) 3.x
* ✅ [`@google-cloud/pubsub`](https://www.npmjs.com/package/@google-cloud/pubsub) 4.x
* ✅ Google Cloud Functions
* ✅ AWS Lambda

### ORMs and query builders

See list above for supported database drivers.

* ✅ [`sequelize`](https://www.npmjs.com/package/sequelize)
* ✅ [`knex`](https://www.npmjs.com/package/knex)
* ✅ [`typeorm`](https://www.npmjs.com/package/typeorm)
* ✅ [`bookshelf`](https://www.npmjs.com/package/bookshelf)

## Installation

```shell
# The --save-exact makes sure that you don't automatically install a newer version
$ npm install --save-exact @aikidosec/runtime

# The --exact makes sure that you don't automatically install a newer version
$ yarn add --exact @aikidosec/runtime
```

* For express based apps, follow the [Express](docs/express.md) instructions
* For AWS Lambda, follow the [AWS Lambda](docs/lambda.md) instructions
* For Google Cloud Functions, follow the [Google Cloud Functions](docs/cloud-functions.md) instructions
* For `@google-cloud/pubsub`, follow the [Google Cloud Pub/Sub](docs/pubsub.md) instructions

## Reporting to Aikido Security dashboard

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
* Set the token as an environment variable: `AIKIDO_TOKEN`

(You can use [dotenv](dotenv) to load the token from an `.env` file)

## Running in production mode (blocking)

By default, the runtime will only detect and report attacks to Aikido.

If you want to start blocking requests, you can set the `AIKIDO_BLOCKING` environment variable to `true`.

See [Reporting to Aikido](#reporting-to-aikido) to learn how to send events to Aikido.

## License

This program is offered under a commercial and under the AGPL license.
You can be released from the requirements of the AGPL license by purchasing
a commercial license. Buying such a license is mandatory as soon as you
develop commercial activities involving the Aikido Runtime software without
disclosing the source code of your own applications. 

For more information, please contact Aikido Security at this
address: support@aikido.dev or create an account at https://app.aikido.dev.

## Performance

We run a benchmark on every commit to make sure that the runtime has a minimal impact on your application's performance.

The bench runs [a simple MongoDB query](benchmarks/nosql-injection/getUser.js) to measure the difference between two runs with and without the runtime:

| Without runtime  | With runtime  | Difference in ms |
|------------------|---------------|------------------|
| 0.214ms          | 0.222ms       | +0.008ms         |

(Using Node.js 18.x and MongoDB 6.3.x, results will vary depending on your hardware)

See [benchmarks](benchmarks) for more information.

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for more information.

## Code of Conduct

See [CODE_OF_CONDUCT.md](.github/CODE_OF_CONDUCT.md) for more information.

## Security

See [SECURITY.md](.github/SECURITY.md) for more information.
