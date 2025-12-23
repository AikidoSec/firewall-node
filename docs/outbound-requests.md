# Monitoring Outbound Requests

To monitor outbound HTTP/HTTPS requests made by your application, you can use the `addHook` function with the `beforeOutboundRequest` hook. This is useful when you want to track external API calls, log outbound traffic, or analyze what domains your application connects to.

## Basic Usage

```js
const { addHook } = require("@aikidosec/firewall");

addHook("beforeOutboundRequest", ({ url, port, method }) => {
  // url is a URL object: https://nodejs.org/api/url.html#class-url
  console.log(`${new Date().toISOString()} - ${method} ${url.href}`);
});
```

## Removing Hooks

You can remove a previously registered hook using the `removeHook` function:

```js
const { addHook, removeHook } = require("@aikidosec/firewall");

function myHook({ url, port, method }) {
  console.log(`${method} ${url.href}`);
}

addHook("beforeOutboundRequest", myHook);

// Later, when you want to remove it:
removeHook("beforeOutboundRequest", myHook);
```

## Important Notes

- You can register multiple hooks by calling `addHook` multiple times.
- The same hook function can only be registered once (duplicates are automatically prevented).
- Hooks are triggered for all HTTP/HTTPS requests made through Node.js built-in modules (`http`, `https`), builtin fetch function, undici and anything that uses that.
- Hooks are called when the connection is initiated, before knowing if Zen will block the request.
- Errors thrown in hooks (both sync and async) are silently caught and not logged to prevent breaking your application.
