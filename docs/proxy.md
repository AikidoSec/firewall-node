# Proxy settings

We'll automatically use the `x-forwarded-for` header to determine the client's IP address when behind a proxy.

## Trust Proxy Configuration

### Basic Configuration
- `AIKIDO_TRUST_PROXY=true` - Trust all proxies (default)
- `AIKIDO_TRUST_PROXY=false` - Don't trust any proxies

### CIDR Range Configuration
You can specify trusted proxy IP ranges using CIDR notation:
```bash
# Trust specific networks
AIKIDO_TRUST_PROXY=10.0.0.0/8,172.16.0.0/12

# Trust a single IP
AIKIDO_TRUST_PROXY=10.1.2.3
```

When using CIDR ranges, Zen will walk the X-Forwarded-For chain from right-to-left (closest to your server first), skip IPs that match your trusted proxy ranges, and return the first IP that doesn't match as the client IP.

### Custom IP Headers
If you need to use a different header to determine the client's IP address, you can set the `AIKIDO_CLIENT_IP_HEADER` environment variable to the name of that header. This will override the default `x-forwarded-for` header.

```bash
# For DigitalOcean App Platform
AIKIDO_CLIENT_IP_HEADER=do-connecting-ip node app.js

# For Fly.io
AIKIDO_CLIENT_IP_HEADER=fly-client-ip node app.js
```

## Security Considerations
If you're publicly exposing your server without a load balancer in front of it, you should set `AIKIDO_TRUST_PROXY=false` to ensure that the correct IP address is used. Otherwise, someone could potentially spoof their IP address by adding proxy headers and thus bypassing rate limiting and IP restrictions.
