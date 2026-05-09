import * as Sentry from "@sentry/node";

// Ensure to call this before importing any other modules!
Sentry.init({
  tracesSampleRate: 0.0,
});
