require("aikido-rasp");

const serverless = require("serverless-http");
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Hello from root!",
  });
});

app.get("/path", (req, res) => {
  res.status(200).json({
    message: "Hello from path!",
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
  });
});

module.exports.handler = serverless(app);
