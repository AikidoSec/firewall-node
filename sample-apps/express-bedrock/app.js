require("dotenv").config();
require("@aikidosec/firewall");

const express = require("express");
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");

const app = express();
const port = 3000;

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const htmlEscapes = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};

const reUnescapedHtml = /[&<>"']/g;

function escapeHTML(string) {
  return string
    ? string.replace(reUnescapedHtml, (chr) => htmlEscapes[chr])
    : "";
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

let defaultPrompt = `Write a one-sentence bedtime story about a unicorn.`;
let defaultModel = "anthropic.claude-3-5-sonnet-20240620-v1:0";

const renderPage = (
  prompt = defaultPrompt,
  answer = "",
  model = defaultModel
) => {
  const safePrompt = escapeHTML(prompt);
  const safeAnswer = escapeHTML(answer);

  return `
    <html>
      <head>
        <title>AWS Bedrock Test</title>
        <style>
          body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px 0; }
          .container { width: 500px; }
          form { display: flex; flex-direction: column; }
          textarea { height: 150px; margin-bottom: 10px; }
          button { padding: 10px; }
          .model-select { margin-bottom: 10px; }
          pre { background-color: #f4f4f4; padding: 10px; border-radius: 5px; white-space: pre-wrap; word-wrap: break-word; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Ask AWS Bedrock</h1>
          <form action="/ask" method="post">
            <div class="model-select">
              <label for="model">Model:</label>
              <select name="model" id="model">
                <option value="anthropic.claude-3-5-sonnet-20240620-v1:0" ${model === "anthropic.claude-3-5-sonnet-20240620-v1:0" ? "selected" : ""}>Claude 3 Haiku</option>
                <option value="anthropic.claude-3-sonnet-20240229-v1:0" ${model === "anthropic.claude-3-sonnet-20240229-v1:0" ? "selected" : ""}>Claude 3 Sonnet</option>
              </select>
            </div>
            <textarea name="prompt" placeholder="Enter your prompt here...">${safePrompt}</textarea>
            <button type="submit">Ask</button>
          </form>

          ${
            answer
              ? `
            <h2>Answer</h2>
            <pre>${safeAnswer}</pre>
          `
              : ""
          }
        </div>
      </body>
    </html>
  `;
};

app.get("/", (req, res) => {
  res.send(renderPage());
});

app.post("/ask", async (req, res) => {
  const { prompt, model } = req.body;

  if (!prompt) {
    return res.status(400).send("Prompt is required.");
  }

  try {
    const messages = [
      {
        role: "user",
        content: prompt,
      },
    ];

    const requestBody = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1000,
      messages: messages,
      system: "You are a coding assistant that talks like a pirate",
    };

    const command = new InvokeModelCommand({
      modelId: model,
      contentType: "application/json",
      body: JSON.stringify(requestBody),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    res.send(renderPage(prompt, responseBody.content[0].text, model));
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send(renderPage(prompt, "Error communicating with AWS Bedrock.", model));
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
