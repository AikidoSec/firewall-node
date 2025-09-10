# Server-side request forgery (SSRF)

Zen for Node.js 16+ secures your app against server-side request forgery (SSRF) attacks. SSRF vulnerabilities allow attackers to send crafted requests to internal services, bypassing firewalls and security controls. Zen blocks SSRF attacks by intercepting and validating requests to internal services.

## Example

```
GET https://your-app.com/files?url=http://localhost:3000/private
```

```js
const response = http.request(req.query.url);
```

In this example, an attacker sends a request to `localhost:3000/private` from your server. Zen can intercept the request and block it, preventing the attacker from accessing internal services.

```
GET https://your-app.com/files?url=http://localtest.me:3000/private
```

In this example, the attacker sends a request to `localtest.me:3000/private`, which resolves to `127.0.0.1`. Zen can intercept the request and block it, preventing the attacker from accessing internal services.

We don't protect against stored SSRF attacks, where an attacker injects a malicious URL into your app's database. To prevent stored SSRF attacks, validate and sanitize user input before storing it in your database.

## Which built-in modules are protected?

Firewall protects against SSRF attacks in the following built-in modules:
* `node:http`
* `node:https`
* `undici`
* `globalThis.fetch` (Node.js 18+)

Note: Any HTTP client that uses `node:http` or `node:https` under the hood is also supported, such as `axios`, `node-fetch`, or `follow-redirects`.
