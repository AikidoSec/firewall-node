<h1 align="center">Aikido Runtime Protection for Node.js</h1>
<br />
<div align="center">

![NPM Version](https://img.shields.io/npm/v/%40aikidosec%2Fruntime?style=flat-square) ![Codecov](https://img.shields.io/codecov/c/github/AikidoSec/runtime-node?style=flat-square&token=AJK9LU35GY) ![NPM License](https://img.shields.io/npm/l/%40aikidosec%2Fruntime?style=flat-square)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com) ![](https://github.com/AikidoSec/runtime-node/actions/workflows/unit-test.yml/badge.svg) ![](https://github.com/AikidoSec/runtime-node/actions/workflows/end-to-end-tests.yml/badge.svg)

</div>
</br>

Runtime is an embedded security engine for autonomously protecting Node.js apps against common and critical attacks.

Runtime protects your Node.js apps by preventing situations, like user input containing dangerous strings, which allow injection, pollution, and path traversal attacks in the first place. It runs on the same server as your Node.js app for simple [installation](#installation) and zero maintenance.

## Features

Runtime autonomously protects your Node.js applications against:

* 🛡️ [NoSQL injection attacks](https://www.aikido.dev/blog/web-application-security-vulnerabilities)
* 🛡️ [SQL injection attacks]([https://www.aikido.dev/blog/web-application-security-vulnerabilities](https://owasp.org/www-community/attacks/SQL_Injection))
* 🛡️ [Command injection attacks](https://owasp.org/www-community/attacks/Command_Injection)
* 🛡️ [Prototype pollution](./docs/prototype-pollution.md)
* &#x1f6e1;&#xfe0f; [Path traversal attacks](https://owasp.org/www-community/attacks/Path_Traversal)
* 🚀 More to come (see [public roadmap](https://github.com/orgs/AikidoSec/projects/2/views/1))

Runtime operates autonomously on the same server as your Node.js app to:

* ✅ Secure your database like a cloud-based web application firewall (WAF) with none of the infrastructure or cost.
* ✅ [Minimize impact](#performance) on production with a tiny footprint and no additional dependencies.
* ✅ Support a developer-first local development and testing experience.
* ✅ Save security operators and development teams hours rooting out vulnerabilities, testing exploits, and coding remediations.

## Supported libraries and frameworks

Aikido Runtime for Node.js 16+ is compatible with:

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

For framework- and provider- specific instructions, check out our docs:

- [Express.js-based apps](docs/express.md)
- [AWS Lambda](docs/lambda.md)
- [Google Cloud Functions](docs/cloud-functions.md)
- [Google Cloud Pub/Sub](docs/pubsub.md)

## Reporting to your Aikido Security dashboard

> Aikido Security is a developer-first software security platform. We scan your source code & cloud to show you which vulnerabilities are actually important.

You can use some of Runtimes's features without Aikido, but you will get the most value by reporting your data to Aikido.

You will need an Aikido account and a token to report events to Aikido. If you don't have an account, you can [sign up for free](https://app.aikido.dev/login).

Here's how:
* [Log in to your Aikido account](https://app.aikido.dev/login).
* Go to [Runtime protection](https://app.aikido.dev/runtime).
* Go to services.
* Click on **Add service**.
* Choose a name for your service.
* Click **Generate token**.
* Copy the token.
* Set the token as an environment variable, `AIKIDO_TOKEN`, using [dotenv](https://github.com/motdotla/dotenv) or another method of your choosing.

## Running in production (blocking) mode

By default, Runtime will only detect and report attacks to Aikido.

To block requests, set the `AIKIDO_BLOCKING` environment variable to `true`.

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

We run a benchmark on every commit to ensure Runtime has a minimal impact on your application's performance.

The benchmark runs [a simple MongoDB query](benchmarks/nosql-injection/getUser.js) to measure the difference between two runs with and without Runtime:

| Without Runtime  | With Runtime  | Difference in ms |
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
