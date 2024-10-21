# Generic integration

This document describes how to add rate limiting and user blocking to your app that uses a framework for which we don't expose a dedicated integration.

The following prerequisites are required:

- The framework must be based on the Node.js http / https module (this includes most frameworks).
- The package `@aikidosec/firewall` must be included in your app before the framework is loaded or the http server is created.

## Example

```js
const Zen = require("@aikidosec/firewall");

function onRequest(...){
    // Call this as early as possible before your request handling code, e.g. in a middleware
    const result = Zen.shouldBlockRequest();

    if (result.block) {
      if (result.type === "ratelimited") {
        let message = "You are rate limited by Zen.";
        if (result.trigger === "ip" && result.ip) {
          message += ` (Your IP: ${result.ip})`;
        }

        // Block the request and send a http 429 status code
        return ...;
      }

      if (result.type === "blocked") {
        // Return a http 403 response
        return ...;
      }
    }
}
```
