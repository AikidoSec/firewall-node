const Database = require("better-sqlite3");

const db = new Database(":memory:");

function seedDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS weather (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      city TEXT NOT NULL,
      temperature REAL NOT NULL
    );
  `);
  db.exec("INSERT INTO weather (city, temperature) VALUES ('New York', 25.0);");
  db.exec(
    "INSERT INTO weather (city, temperature) VALUES ('Los Angeles', 30.0);"
  );
  db.exec("INSERT INTO weather (city, temperature) VALUES ('Ghent', 20.0);");
  db.exec("INSERT INTO weather (city, temperature) VALUES ('Oslo', 15.0);");
}

function getTemperature(city) {
  // Insecure, vulnerable to SQL injection
  return db
    .prepare(`SELECT temperature FROM weather WHERE city = '${city}';`)
    .get();
}

module.exports = {
  seedDatabase,
  getTemperature,
};
