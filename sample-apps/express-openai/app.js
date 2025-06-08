require('dotenv').config();
require('@aikidosec/firewall');

const express = require('express');
const { OpenAI } = require('openai');

const app = express();
const port = 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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

const renderPage = (prompt = '', answer = '', model = 'gpt-4o') => {
  const safePrompt = escapeHTML(prompt);
  const safeAnswer = escapeHTML(answer);

  return `
    <html>
      <head>
        <title>OpenAI Test</title>
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
          <h1>Ask OpenAI</h1>
          <form action="/ask" method="post">
            <div class="model-select">
              <label for="model">Model:</label>
              <select name="model" id="model">
                <option value="gpt-4o" ${model === 'gpt-4o' ? 'selected' : ''}>GPT-4o</option>
                <option value="gpt-4-turbo" ${model === 'gpt-4-turbo' ? 'selected' : ''}>GPT-4 Turbo</option>
                <option value="gpt-3.5-turbo" ${model === 'gpt-3.5-turbo' ? 'selected' : ''}>GPT-3.5 Turbo</option>
              </select>
            </div>
            <textarea name="prompt" placeholder="Enter your prompt here...">${safePrompt}</textarea>
            <button type="submit">Ask</button>
          </form>
          
          ${answer ? `
            <h2>Answer</h2>
            <pre>${safeAnswer}</pre>
          ` : ''}
        </div>
      </body>
    </html>
  `;
};

app.get('/', (req, res) => {
  res.send(renderPage());
});

app.post('/ask', async (req, res) => {
  const { prompt, model } = req.body;

  if (!prompt) {
    return res.status(400).send('Prompt is required.');
  }

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: model,
    });
    const answer = completion.choices[0].message.content;
    res.send(renderPage(prompt, answer, model));
  } catch (error) {
    console.error(error);
    res.status(500).send(renderPage(prompt, 'Error communicating with OpenAI.', model));
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
}); 