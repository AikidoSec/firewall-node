# react-router-serve Sample App

A minimal React Router app served with `@react-router/serve`.

This exists to verify that Zen warns when it detects `@react-router/serve`:
that integration parses request bodies itself instead of going through
Express, so Zen can't inspect them, and this setup is untested.

In the root directory run `npm run sample-app react-router-serve` to start
the server.
