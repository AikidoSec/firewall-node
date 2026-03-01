const Zen = require("@aikidosec/firewall");
const express = require("express");
const mysql = require("mysql2/promise");

async function createConnection() {
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "mypassword",
    database: "catsdb",
    port: 27015,
    multipleStatements: true,
  });

  await connection.execute(
    `CREATE TABLE IF NOT EXISTS cats_taint (petname varchar(255));`
  );

  return connection;
}

async function main() {
  const db = await createConnection();
  const app = express();
  app.use(express.json());

  // This route transforms user input through a chain of string methods.
  // Without taint tracking, Zen would not detect the SQL injection because
  // the transformed value differs from the original user input.
  //
  // Example payload: "  Njuska');  DELETE   FROM   cats_taint;--  HHHH...  "
  // .trimStart()  → "Njuska');  DELETE   FROM   cats_taint;--  HHHH...  "
  // .trimEnd()    → "Njuska');  DELETE   FROM   cats_taint;--  HHHH..."
  // .toLowerCase()→ "njuska');  delete   from   cats_taint;--  hhhh..."
  // .normalize()  → (same)
  // .replace()    → "njuska'); delete from cats_taint;-- hhhh..."
  // .split/.join  → (same)
  // .slice(0, 40) → "njuska'); delete from cats_taint;-- hhhh"
  // .trim()       → (same)
  //
  // SQL: INSERT INTO cats_taint (petname) VALUES ('njuska'); delete from cats_taint;-- hhhh');
  app.post("/add", async (req, res) => {
    const name = req.body.name
      .trimStart()
      .trimEnd()
      .toLowerCase()
      .normalize("NFC")
      .replace(/\s+/g, " ")
      .split(" ")
      .join(" ")
      .slice(0, 40)
      .trim();

    // This is unsafe! For demo purposes only.
    await db.query(`INSERT INTO cats_taint (petname) VALUES ('${name}');`);

    res.json({ success: true });
  });

  app.get("/clear", async (req, res) => {
    await db.execute("DELETE FROM cats_taint;");
    res.json({ success: true });
  });

  const port = parseInt(process.argv[2], 10) || 4000;

  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
}

main();
