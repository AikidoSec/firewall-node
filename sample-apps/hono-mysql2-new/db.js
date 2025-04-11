const mysql = require("mysql2/promise");

async function createConnection() {
  // Normally you'd use environment variables for this
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "mypassword",
    database: "catsdb",
    port: 27015,
    multipleStatements: true,
  });

  await connection.execute(
    `CREATE TABLE IF NOT EXISTS cats_2 (petname varchar(255));`
  );

  return connection;
}

module.exports = {
  createConnection,
};
