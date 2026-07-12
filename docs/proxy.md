# Proxy settings

Zen automatically reads the `x-forwarded-for` header to determine the client's IP address when running behind a proxy. If you're publicly exposing your server without a load balancer in front of it, you should set the `AIKIDO_TRUST_PROXY` env var to `false` to ensure that the correct IP address is used. Otherwise, someone could potentially spoof their IP address by adding the above header and thus bypassing the rate limiting.

If you need to use a different header to determine the client's IP address, you can set the `AIKIDO_CLIENT_IP_HEADER` environment variable to the name of that header. This will override the default `x-forwarded-for` header.

```bash
# For DigitalOcean App Platform
AIKIDO_CLIENT_IP_HEADER=do-connecting-ip node app.js
```

## Advanced proxy trust configuration

The `AIKIDO_TRUST_PROXY` environment variable controls whether Zen reads the IP header at all, and how it selects the client IP from it.

| Value                              | Behavior                                                                                                                                                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(not set)_ or `true`              | **Default.** Trust the header and use the first non-private IP found, scanning from right to left. Suitable for most deployments behind a reverse proxy.                                                                                        |
| `false`                            | Ignore the header entirely and always use the remote address of the request socket. Use this when your server is directly exposed to the internet without a proxy in front of it.                                                               |
| `1.2.3.4/32, …` _(CIDR notation)_  | Trust the header and use the first non-private IP that does not belong to any of the specified CIDR ranges, scanning from right to left. Multiple ranges can be separated by commas. Use this when your proxies have known public IP addresses. |
| `1`, `2`, … _(positive integer n)_ | Trust the header and use the _n_-th IP from the right (1 = rightmost). Use this when a fixed number of trusted proxies are in front of your server. Private IPs are skipped.                                                                    |
