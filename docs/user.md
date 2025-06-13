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

Using `setUser` has the following benefits:

- The user ID is used for more accurate rate limiting (you can change IP addresses, but you can't change your user ID).
- Whenever attacks are detected, the user will be included in the report to Aikido.
- The dashboard will show all your users, where you can also block them.
- Passing the user's name is optional, but it can help you identify the user in the dashboard. You will be required to list Aikido Security as a subprocessor if you choose to share personal identifiable information (PII).

# Rate limiting groups

To limit the number of requests for a group of users, pass the `rateLimitGroup` option to the `setUser` function. For example, this is useful if you want to limit the number of requests per team or company.

```js
Zen.setUser({
  id: "123",
  name: "John Doe", // Optional
  rateLimitGroup: "group1", // Optional, user id is used by default
});
```
