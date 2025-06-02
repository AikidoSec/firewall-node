require("@aikidosec/firewall");
const functions = require("@google-cloud/functions-framework");
const Database = require("better-sqlite3");

const db = new Database(":memory:");

functions.http("function", (req, res) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cats (
      petname TEXT
    );
  `);

  if (req.method === "GET") {
    const petname = req.query.petname;
    if (typeof petname === "string") {
      db.exec(`INSERT INTO cats (petname) VALUES ('${petname}');`);
    }

    const cats = db.prepare("SELECT petname FROM `cats`;").all();
    console.log(cats);
    res.status(200).send(getHTMLBody(cats.map((cat) => cat.petname)));
    return;
  }
  res.status(405).send("Method Not Allowed");
});

function getHTMLBody(cats) {
  return `
<html lang="en">
  <body>
    <p>All cats : ${cats.join(", ")}</p>
    <form action="/" method="GET">
      <label for="petname">Add a new cat</label>
      <input type="text" name="petname">
      <input type="submit" value="Add" />
    </form>
    <a href="http://localhost:4000/?petname=Kitty'); DELETE FROM cats;-- H">Test injection</a>
  </body>
</html>`;
}
