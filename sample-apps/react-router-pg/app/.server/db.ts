import pg from "pg";
const { Client } = pg;

let client: pg.Client | null = null;

export async function getConnection() {
  if (client) {
    return client;
  }

  client = new Client({
    user: "root",
    host: "127.0.0.1",
    database: "main_db",
    password: "password",
    port: 27016,
  });

  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS cats_5 (
        petname varchar(255),
        comment varchar(255)
    );
  `);

  return client;
}
