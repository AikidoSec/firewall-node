// Get the client
const sql = require("mssql");

async function connectToMysqlDB() {
  // Normally you'd use environment variables for this
  // These values were also referenced in the docker-compose.yml
  await sql.connect(
    "Server=localhost,27014;Database=master;User Id=sa;Password=Strongeeeee%Password;Encrypt=false"
  );
  await initDb();
}

async function initDb() {
  // This creates the cats table
  try {
    await sql.query(`
    CREATE TABLE dbo.cats (
        petname varchar(255)
    );
    `);
  } catch (err) {
    // Ignore errors -> Database already exists
  }
}

async function insertCatIntoTable(petname) {
  // This makes your database vulnerable to SQL Injections! vvv
  await sql.query(`INSERT INTO cats(petname) VALUES ('${petname}');`);
}

async function getAllCats() {
  // This function returns all cats in the db
  const cats = await sql.query("SELECT petname FROM dbo.cats;");
  return cats.recordset.map((record) => record.petname);
}

module.exports = { connectToMysqlDB, insertCatIntoTable, getAllCats };
