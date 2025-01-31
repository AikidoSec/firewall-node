const Database = require("better-sqlite3");

const db = new Database(":memory:");

module.exports = {
  setup: async function setup() {
    db.exec(
      "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT, password TEXT)"
    );
    const stmt = db.prepare(
      "INSERT INTO users (email, password) VALUES (?, ?)"
    );
    stmt.run("john@acme.com", "password");
  },
  step: async function step() {
    const stmt = db.prepare(
      "SELECT * FROM users WHERE email = ? AND password = ?"
    );
    stmt.all("john@acme.com", "password");
  },
  teardown: async function teardown() {
    db.close();
  },
};
