const express = require("express");

function getPort() {
  const port = parseInt(process.env.PORT, 10) || 4000;

  if (isNaN(port)) {
    console.error("Invalid port");
    process.exit(1);
  }

  return port;
}

function start() {
  const app = express();

  app.get("/empty", (req, res) => {
    res.send("");
  });

  app.listen(getPort(), () => {
    console.log(`Server listening on port ${getPort()}`);
  });
}

start();
