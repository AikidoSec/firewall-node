require("dotenv").config();
require("@aikidosec/runtime");

const Documents = require("./Documents");
const express = require("express");
const asyncHandler = require("express-async-handler");
const morgan = require("morgan");
const fs = require('node:fs')

require("@aikidosec/runtime/nopp");

function getHTMLBody(documents) {
  return `
<html lang="en">
  <body>
    <p>All documents : ${documents.join(", ")}</p>
    <form action="/" method="GET">
      <label for="search">Add a new document</label>
      <input type="text" filename="filename">
      <input type="text" content="content">
      <input type="submit" value="Add" />
    </form>
    <a href="http://localhost:4000/?content=blablabla&filename=../TestDoc.txt">Test unsafe file creation</a>
  </body>
</html>`;
}


async function main(port) {
  const documents = new Documents(getBaseDir());

  const app = express();

  app.use(morgan("tiny"));

  app.get(
    "/",
    asyncHandler(async (req, res) => {
      if (req.query["filename"] && req.query["content"]) {
        await documents.add(req.query["filename"], req.query["content"]);
      }

      res.send(getHTMLBody(await documents.getAll()));
    })
  );

  return new Promise((resolve, reject) => {
    try {
      app.listen(port, () => {
        console.log(`Listening on port ${port}`);
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
}

function getBaseDir() {
  const folderName =  "C:\Temp\Safe";

  try {
    if (!fs.existsSync(folderName)) {
      fs.mkdirSync(folderName);
    }
  } catch (err) {
    console.error("Invalid folder");
    console.error(err);
    process.exit(1);  
  }
  return folderName;
}

function getPort() {
  const port = parseInt(process.argv[2], 10) || 4000;

  if (isNaN(port)) {
    console.error("Invalid port");
    process.exit(1);
  }

  return port;
}

main(getPort());
