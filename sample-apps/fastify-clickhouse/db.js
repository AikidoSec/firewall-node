const { createClient } = require("@clickhouse/client");

let client;

async function createConnection() {
  client = createClient({
    url: "http://localhost:27019",
    username: "clickhouse",
    password: "clickhouse",
    database: "main_db",
  });

  await client.exec({
    query: `CREATE TABLE IF NOT EXISTS cats_table (
        id UUID DEFAULT generateUUIDv4() PRIMARY KEY,
        petname String
    );
  `,
  });

  return client;
}

async function getAllCats() {
  const resultSet = await client.query({
    query: `SELECT * FROM cats_table;`,
    format: "JSONEachRow",
  });
  return resultSet.json();
}

function addCat(name) {
  console.log(`INSERT INTO cats_table (id, petname) VALUES (null, '${name}');`);
  return client.exec({
    query: `INSERT INTO cats_table (id, petname) VALUES (null, '${name}');`,
  });
}

function clearCats() {
  return client.exec({
    query: `DELETE FROM cats_table WHERE 1;`,
  });
}

module.exports = {
  createConnection,
  getAllCats,
  addCat,
  clearCats,
};
