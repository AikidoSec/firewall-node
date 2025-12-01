# Monitoring Outbound Requests

To monitor outbound HTTP/HTTPS requests made by your application, you can use the `onOutboundRequest` function. This is useful when you want to track external API calls, log outbound traffic, or analyze what domains your application connects to.

## Basic Usage

```js
const { onOutboundRequest } = require("@aikidosec/firewall");

onOutboundRequest(({ url, port, method }) => {
  // url is a URL object: https://nodejs.org/api/url.html#class-url
  console.log(`${new Date().toISOString()} - ${method} ${url.href}`);
});
```

## Important Notes

- You can register multiple callbacks by calling `onOutboundRequest` multiple times.
- Callbacks are triggered for all HTTP/HTTPS requests made through Node.js built-in modules (`http`, `https`), builtin fetch function, undici and anything that uses that.
- Callbacks are called when the connection is initiated, before knowing if Zen will block the request.
- Errors thrown in callbacks (both sync and async) are silently caught and not logged to prevent breaking your application.
