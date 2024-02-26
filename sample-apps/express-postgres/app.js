require("dotenv").config();
const { protect, preventPrototypePollution } = require("@aikidosec/guard");

protect({ debug: true });

const db = require("./db");
const express = require("express");
const asyncHandler = require("express-async-handler");
const morgan = require("morgan");

preventPrototypePollution();

function getHTMLBody(cats) {
  return `
<html lang="en">
  <body>
    <p>All cats : ${cats.join(", ")}</p>
    <form action="/" method="GET">
      <label for="search">Add a new cat</label>
      <input type="text" name="petname">
      <input type="submit" value="Add" />
    </form>
    <a href="http://localhost:4000/?petname=Kitty'); DELETE FROM cats;--">Test injection</a>
  </body>
</html>`;
}

async function main() {
  const app = express();
  db.connectToPostgresDB();

  app.use(morgan("tiny"));

  app.get(
    "/",
    asyncHandler(async (req, res) => {
      if (req.query["petname"]) {
        // This is very dangerous, don't copy this code into an actual application
        await db.insertCatIntoTable(req.query["petname"]);
      }
      let cats = await db.getAllCats();
      res.send(getHTMLBody(cats));
    })
  );

  return new Promise((resolve, reject) => {
    try {
      app.listen(4000, () => {
        console.log("Listening on port 4000");
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
}

main();
