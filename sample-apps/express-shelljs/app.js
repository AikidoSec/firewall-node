require("@aikidosec/firewall");
const express = require("express");
const shell = require("shelljs");
const app = express();

app.get("/execute", (req, res) => {
  const cmd = req.query.cmd;

  if (cmd) {
    const result = shell.exec(`ls -l ${cmd}`, { silent: true });

    if (result.code !== 0) {
      res.status(500).send(`Error: ${result.stderr}`);
      return;
    }

    res.status(200).send(result.stdout);
  } else {
    res
      .status(400)
      .send('Please provide a command via the "cmd" query parameter');
  }
});

app.get("/execute-async", (req, res) => {
  const cmd = req.query.cmd;

  if (cmd) {
    shell.exec(`ls -l ${cmd}`, (code, stdout, stderr) => {
      if (code !== 0) {
        res.status(500).send(`Error: ${stderr}`);
        return;
      }

      res.status(200).send(stdout);
    });
  } else {
    res
      .status(400)
      .send('Please provide a command via the "cmd" query parameter');
  }
});

app.listen(4000, () => {
  console.log("Server is running on port 4000");
});
