# Proxy settings

We'll automatically use the `x-forwarded-for` header to determine the client's IP address when behind a proxy. If you're publicly exposing your server, you may need to set the `AIKIDO_TRUST_PROXY` env var to `false` to ensure that the correct IP address is used. Otherwise, someone could potentially spoof their IP address and thus bypassing the rate limiting.
