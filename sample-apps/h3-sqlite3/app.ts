import "@aikidosec/firewall";

// Import h3 as npm dependency
import { createApp, createRouter, defineEventHandler } from "h3";

import { Database } from "sqlite3";

console.log(Database);

// Create an app instance
export const app = createApp();

// Create a new router and register it in app
const router = createRouter();
app.use(router);

// Add a new route that matches GET requests to / path
router.get(
  "/",
  defineEventHandler((event) => {
    return { message: "Tadaa!" };
  })
);
