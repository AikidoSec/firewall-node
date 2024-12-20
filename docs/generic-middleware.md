# Generic middleware

This document describes how to add rate limiting and user blocking to your app that uses a framework for which we don't expose a dedicated middleware.

The following prerequisites are required:

- The framework must be based on the Node.js http / https module (this includes most frameworks).
- The package `@aikidosec/firewall` must be included in your app before the framework is loaded or the http server is created.

## Example

```js
const Zen = require("@aikidosec/firewall");

function onRequest(...) {

    // Set the user associated with the request, optional, required for user based rate limiting and blocking of specific users
    Zen.setUser({
        id: "123",
        name: "John Doe", // Optional
    });

    // Call this as early as possible before your request handling code, e.g. in a middleware, after you know your user
    const result = Zen.shouldBlockRequest();

    if (result.block) {
      if (result.type === "ratelimited") {
        let message = "You are rate limited by Zen.";
        if (result.trigger === "ip" && result.ip) {

          // Please note that outputting user input is always a security risk. Make sure to escape it properly.
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
