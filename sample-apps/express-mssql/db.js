// Get the client
const sql = require("mssql");

async function connectToMysqlDB() {
  // Normally you'd use environment variables for this
  // These values were also referenced in the docker-compose.yml
  await sql.connect(
    "Server=localhost,27014;Database=database;User Id=username;Password=password;Encrypt=true"
  );
  await initDb();
}

async function initDb() {
  // This creates the cats table
  await sql.query(`
    CREATE TABLE IF NOT EXISTS cats (
        petname varchar(255)
    );
    `);
}

async function insertCatIntoTable(petname) {
  // This makes your database vulnerable to SQL Injections! vvv
  await sql.query(`INSERT INTO cats(petname) VALUES ('${petname}');`);
}

async function getAllCats() {
  // This function returns all cats in the db
  const [cats] = await sql.execute("SELECT petname FROM `cats`;");
  return cats.map((row) => row.petname);
}

module.exports = { connectToMysqlDB, insertCatIntoTable, getAllCats };
