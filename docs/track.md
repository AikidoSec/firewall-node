# Tracking events

`track` lets you record things happening in your app — like failed logins, signups, or password resets. Zen sends these to Aikido so patterns can be detected, like someone failing to log in 50 times in a minute.

```js
const Zen = require("@aikidosec/firewall");

app.post("/login", async (req, res) => {
  const user = await authenticate(req.body.username, req.body.password);

  if (!user) {
    Zen.track("user.login_failed");
    return res.status(401).json({ error: "Invalid credentials" });
  }

  Zen.setUser({ id: user.id });
  Zen.track("user.login_succeeded");
  res.json({ token: createToken(user) });
});
```

Zen automatically picks up the IP address, user agent, and current user (if you called [`setUser`](./user.md)) from the request — you don't need to pass those yourself.

## More examples

```js
Zen.track("user.signed_up");
Zen.track("user.password_reset_requested");
Zen.track("plan.invite_sent");
Zen.track("payment.failed");
```

## Naming events

Use lowercase with dots to group related events:

- `user.login_failed`
- `user.login_succeeded`
- `user.signed_up`
- `user.password_reset_requested`
- `payment.failed`
- `plan.invite_sent`

## Things to know

`track` only works inside an HTTP request. If you call it in a background job or a script, nothing gets sent and you'll see a warning in the console.

If you haven't called `setUser` yet, the event still goes through — it just won't have a user ID attached.
