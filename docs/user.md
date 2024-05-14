# Setting current user

To set the current user, you can use the `setUser` function. Here's an example for express:

```js
require('@aikidosec/runtime');

// ...

const { setUser } = require('@aikidosec/runtime/user');

app.use((req, res, next) => {
  // Get the user from your authentication middleware
  // or wherever you store the user
  const user = req.user;
  setUser(user);
  next();
});
```

Whenever attacks are detected, the user will be included in the report to Aikido.

