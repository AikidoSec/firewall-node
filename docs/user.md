# Setting the current user

To set the current user, you can use the `setUser` function. Here's an example for express:

```js
require('@aikidosec/firewall');

// ...

const Aikido = require('@aikidosec/firewall/context');

app.use((req, res, next) => {
  // Get the user from your authentication middleware
  // or wherever you store the user
  Aikido.setUser({
    id: "123",
    name: "John Doe", // Optional
  });

  next();
});
```

Whenever attacks are detected, the user will be included in the report to Aikido.

