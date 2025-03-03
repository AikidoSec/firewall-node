import { Hono } from "hono";
import { serve } from "@hono/node-server";
//import * as test from "fs/promises";
import { createRequire } from "module";
//console.log(test);

console.log(createRequire(import.meta.url)("node:fs/promises"));

const app = new Hono();

app.get("/", async (c) => {
  await readFile("app.js", "utf8");
  return c.text("Hello, World!");
});

serve(app, (info) => {
  console.log(`Server is running on http://${info.address}:${info.port}`);
});
