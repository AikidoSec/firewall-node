# Track custom events

Use `Zen.track()` to report events that only your application knows about, such as failed logins. [Playbooks](https://help.aikido.dev/zen-firewall/zen-features/playbooks) can act when an event occurs repeatedly, for example by blocking an IP after three failed logins in five minutes.

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

After adding `Zen.track()`, trigger the event at least once. It will then appear on the Playbooks page in the Aikido dashboard. From there, you can create a playbook and choose what should happen when the event occurs. Calling `Zen.track()` by itself does not create a playbook or block anything.

Call `Zen.track()` while handling an HTTP request. Zen associates the event with the request's IP address. Playbook counts are per IP, not across your whole app. If you call [`Zen.setUser()`](./user.md) before `Zen.track()`, Zen also includes the current user. `Zen.setUser()` is optional. Events without a user are still tracked.

Event names can use any format. We recommend lowercase, dot-separated names such as `user.login_failed`.
