import pg from "pg";
const { Client } = pg;

export async function createConnection() {
  const client = new Client({
    user: "root",
    host: "127.0.0.1",
    database: "main_db",
    password: "password",
    port: 27016,
  });

  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS cats_3 (
        petname varchar(255),
        comment varchar(255),
        user_id integer
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS cats_3_with_idor (
        petname varchar(255),
        comment varchar(255),
        user_id integer
    );
  `);

  return client;
}
