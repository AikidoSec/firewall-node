![Aikido Firewall for Node.js](./docs/banner.svg)

# Aikido Firewall for Node.js

![NPM Version](https://img.shields.io/npm/v/%40aikidosec%2Ffirewall?style=flat-square) ![Codecov](https://img.shields.io/codecov/c/github/AikidoSec/firewall-node?style=flat-square&token=AJK9LU35GY) ![NPM License](https://img.shields.io/npm/l/%40aikidosec%2Ffirewall?style=flat-square)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com) ![](https://github.com/AikidoSec/firewall-node/actions/workflows/unit-test.yml/badge.svg) ![](https://github.com/AikidoSec/firewall-node/actions/workflows/end-to-end-tests.yml/badge.svg)

Aikido Firewall is an embedded Web Application Firewall that autonomously protects Node.js apps against common and critical attacks.

It protects your Node.js apps by preventing user input containing dangerous strings, which allow injection, pollution, and path traversal attacks. It runs on the same server as your Node.js app for simple [installation](#installation) and zero maintenance.

## Features

Firewall autonomously protects your Node.js applications against:

* 🛡️ [NoSQL injection attacks](https://www.aikido.dev/blog/web-application-security-vulnerabilities)
* 🛡️ [SQL injection attacks]([https://www.aikido.dev/blog/web-application-security-vulnerabilities](https://owasp.org/www-community/attacks/SQL_Injection))
* 🛡️ [Command injection attacks](https://owasp.org/www-community/attacks/Command_Injection)
* 🛡️ [Prototype pollution](./docs/prototype-pollution.md)
* 🛡️ [Path traversal attacks](https://owasp.org/www-community/attacks/Path_Traversal)
* 🚀 More to come (see the [public roadmap](https://github.com/orgs/AikidoSec/projects/2/views/1))!

Firewall operates autonomously on the same server as your Node.js app to:

* ✅ Secure your database similar to a classic web application firewall (WAF) with none of the infrastructure or cost.
* ✅ Rate limit specific API endpoints by IP or by user
* ✅ Block specific users 

## Supported libraries and frameworks

Aikido Firewall for Node.js 16+ is compatible with:

### Web frameworks

* ✅ [Express](docs/express.md) 4.x
* ✅ [Hono](docs/hono.md) 4.x

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
* ✅ [`drizzle-orm`](https://www.npmjs.com/package/drizzle-orm)

## Installation

```shell
# The --save-exact makes sure that you don't automatically install a newer version
$ npm install --save-exact @aikidosec/firewall

# The --exact makes sure that you don't automatically install a newer version
$ yarn add --exact @aikidosec/firewall
```

For framework- and provider- specific instructions, check out our docs:

- [Express.js-based apps](docs/express.md)
- [AWS Lambda](docs/lambda.md)
- [Google Cloud Functions](docs/cloud-functions.md)
- [Google Cloud Pub/Sub](docs/pubsub.md)

## Reporting to your Aikido Security dashboard

> Aikido Security is a developer-first software security platform. We scan your source code & cloud to show you which vulnerabilities are actually important.

You can use some of Firewalls's features without Aikido, but you will get the most value by reporting your data to Aikido.

You will need an Aikido account and a token to report events to Aikido. If you don't have an account, you can [sign up for free](https://app.aikido.dev/login).

Here's how:
* [Log in to your Aikido account](https://app.aikido.dev/login).
* Go to [Firewall](https://app.aikido.dev/runtime/events).
* Go to services.
* Click on **Add service**.
* Choose a name for your service.
* Click **Generate token**.
* Copy the token.
* Set the token as an environment variable, `AIKIDO_TOKEN`, using [dotenv](https://github.com/motdotla/dotenv) or another method of your choosing.

## Running in production (blocking) mode

By default, Firewall will only detect and report attacks to Aikido.

To block requests, set the `AIKIDO_BLOCKING` environment variable to `true`.

See [Reporting to Aikido](#reporting-to-your-aikido-security-dashboard) to learn how to send events to Aikido.

## License

This program is offered under a commercial and under the AGPL license.
You can be released from the requirements of the AGPL license by purchasing
a commercial license. Buying such a license is mandatory as soon as you
develop commercial activities involving the Aikido Firewall software without
disclosing the source code of your own applications. 

For more information, please contact Aikido Security at this
address: support@aikido.dev or create an account at https://app.aikido.dev.

## Performance

We run a benchmark on every commit to ensure Firewall has a minimal impact on your application's performance.

The benchmark runs [a simple MongoDB query](benchmarks/nosql-injection/getUser.js) to measure the difference between two runs with and without Firewall:

| Without Firewall | With Firewall | Difference in ms |
|------------------|---------------|------------------|
| 0.214ms          | 0.222ms       | +0.008ms         |

(Using Node.js 18.x and MongoDB 6.3.x. Results will vary depending on your hardware.)

See [benchmarks](benchmarks) for more information.

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for more information.

## Code of Conduct

See [CODE_OF_CONDUCT.md](.github/CODE_OF_CONDUCT.md) for more information.

## Security

See [SECURITY.md](.github/SECURITY.md) for more information.
