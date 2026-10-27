import * as Sentry from "@sentry/node";

Sentry.init({
  tracesSampleRate: 0.0,
});
