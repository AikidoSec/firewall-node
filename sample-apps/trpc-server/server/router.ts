import { z } from "zod";
import { db } from "./db.ts";
import { publicProcedure, router } from "./trpc.ts";

export const appRouter = router({
  cats: {
    list: publicProcedure.query(async () => {
      return db.prepare("SELECT * FROM cats").all();
    }),
    byName: publicProcedure.input(z.string()).query(async (opts) => {
      const { input } = opts;
      // This is intentionally vulnerable to SQL injection
      return db.prepare(`SELECT * FROM cats WHERE petname = '${input}'`).get();
    }),
    create: publicProcedure
      .input(z.object({ name: z.string() }))
      .mutation(async (opts) => {
        const { input } = opts;
        return db
          .prepare(`INSERT INTO cats (petname) VALUES ('${input.name}')`)
          .run();
      }),
    reset: publicProcedure.mutation(async () => {
      db.exec("DELETE FROM cats");
      return { success: true };
    }),
  },
});

// Export type router type signature, this is used by the client.
export type AppRouter = typeof appRouter;
