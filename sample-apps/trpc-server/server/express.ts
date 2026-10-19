import * as trpcExpress from "@trpc/server/adapters/express";
import express from "express";
import { appRouter } from "./router.ts";

const app = express();

app.use(
  "/",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
  })
);

const port = process.env.PORT || "4000";

app.listen(port, () => {
  console.log(`tRPC server listening on http://localhost:${port}`);
});
