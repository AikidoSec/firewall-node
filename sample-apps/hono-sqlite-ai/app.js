const Zen = require("@aikidosec/firewall");
const { seedDatabase, getTemperature } = require("./db");
const { Hono } = require("hono");
const { serve } = require("@hono/node-server");
const { google } = require("@ai-sdk/google");
const { generateText, tool } = require("ai");
const { z } = require("zod");

(async () => {
  const app = new Hono();
  seedDatabase();

  Zen.addHonoMiddleware(app);

  // Insecure test api
  app.get("/weather", async (c) => {
    const prompt = c.req.query("prompt");

    if (!prompt) {
      return c.json(
        {
          error: "Prompt is required",
        },
        400
      );
    }

    try {
      const response = await sendRequestToLLM(prompt);

      return c.json({
        response: response.toolResults,
      });
    } catch (error) {
      return c.json(
        {
          error: error.message,
        },
        500
      );
    }
  });

  const port = parseInt(process.argv[2], 10) || 4000;

  if (isNaN(port)) {
    console.error("Invalid port");
    process.exit(1);
  }

  serve({
    fetch: app.fetch,
    port: port,
  }).on("listening", () => {
    console.log(`Server is running on port ${port}`);
  });
})();

async function sendRequestToLLM(prompt) {
  return await generateText({
    model: google("models/gemini-2.0-flash-lite"),
    tools: {
      weather: tool({
        description: "Get the weather in a location",
        parameters: z.object({
          location: z.string().describe("The location to get the weather for"),
        }),
        execute: async ({ location }) => {
          return getTemperature(location);
        },
      }),
    },
    prompt: prompt,
    toolChoice: "required",
  });
}
