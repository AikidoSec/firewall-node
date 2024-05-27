# Body size

If your run into `413` HTTP errors and need to accept large bodies, you can use the `AIKIDO_MAX_BODY_SIZE` environment variable to increase the maximum body size that the server will accept.

```bash
AIKIDO_MAX_BODY_SIZE=50m node server.js
```

By default, the maximum body size is `20m`. This will protect your server from being overwhelmed by large requests.
