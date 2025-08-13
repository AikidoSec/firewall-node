# Proxy settings

We'll automatically use the `x-forwarded-for` header to determine the client's IP address when behind a proxy.

If you're publicly exposing your server without a load balancer in front of it, you should set the `AIKIDO_TRUST_PROXY` env var to `false` to ensure that the correct IP address is used. Otherwise, someone could potentially spoof their IP address by adding the above header and thus bypassing the rate limiting.

If you need to use a different header to determine the client's IP address, you can set the `AIKIDO_CLIENT_IP_HEADER` environment variable to the name of that header. This will override the default `x-forwarded-for` header.

```bash
# For DigitalOcean App Platform
AIKIDO_CLIENT_IP_HEADER=do-connecting-ip node app.js
```
