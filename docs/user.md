# Setting the current user

To set the current user, you can use the `setUser` function. Here's an example for express:

```js
const Zen = require("@aikidosec/firewall");

// ...

app.use((req, res, next) => {
  // Get the user from your authentication middleware
  // or wherever you store the user
  Zen.setUser({
    id: "123",
    name: "John Doe", // Optional
  });

  next();
});
```

> [!WARNING]
> Do not call `setUser` with a shared user ID for unauthenticated or anonymous users (e.g. `setUser({ id: "unauthenticated" })`). When a user is set, rate limiting is applied per user ID and IP-based rate limiting is skipped entirely. This means all anonymous users would share a single rate limit bucket and be blocked as a group. For unauthenticated users, simply don't call `setUser` — rate limiting will automatically fall back to per-IP limiting.

Using `setUser` has the following benefits:

- The user ID is used for more accurate rate limiting (you can change IP addresses, but you can't change your user ID).
- Whenever attacks are detected, the user will be included in the report to Aikido.
- The dashboard will show all your users, where you can also block them.
- Passing the user's name is optional, but it can help you identify the user in the dashboard. You will be required to list Aikido Security as a subprocessor if you choose to share personal identifiable information (PII).

# Rate limiting groups

To limit the number of requests for a group of users, you can use the `setRateLimitGroup` function. For example, this is useful if you want to limit the number of requests per team or company.
Please note that if a rate limit group is set, the configured rate limits are only applied to the group and not to individual users or IP addresses.

```js
Zen.setRateLimitGroup({
  id: "123",
});
```
