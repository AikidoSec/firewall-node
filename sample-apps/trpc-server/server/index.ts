import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { appRouter } from "./router.ts";

const server = createHTTPServer({
  router: appRouter,
});

const port = process.env.PORT || "4000";

server.listen(port, () => {
  console.log(`tRPC server listening on http://localhost:${port}`);
});
