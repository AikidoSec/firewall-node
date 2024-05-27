# Body size

If your run into `413` HTTP errors and need to accept large bodies, you can use the `AIKIDO_MAX_BODY_SIZE_MB` environment variable to increase the maximum body size that the server will accept.

```bash
AIKIDO_MAX_BODY_SIZE_MB=50 node server.js
```

By default, the maximum body size is `20`. This will protect your server from being overwhelmed by large requests.
