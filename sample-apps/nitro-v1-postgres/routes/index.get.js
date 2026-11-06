import { defineEventHandler, getQuery } from "h3";
import pg from "pg";

let clientPromise;

function getClient() {
  clientPromise ??= (async () => {
    const client = new pg.Client({
      user: "root",
      host: "127.0.0.1",
      database: "main_db",
      password: "password",
      port: 27016,
    });

    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS cats_nitro (
          petname varchar(255),
          comment varchar(255)
      );
    `);

    return client;
  })();

  return clientPromise;
}

export default defineEventHandler(async (event) => {
  const db = await getClient();
  const query = getQuery(event);

  if (typeof query["petname"] === "string") {
    // This is vulnerable to SQL injection, only for testing purposes, do not use in production
    await db.query(
      `INSERT INTO cats_nitro (petname) VALUES ('${query["petname"]}');`
    );
  }

  const cats = await db.query("SELECT petname FROM cats_nitro;");

  return `<html lang="en"><body><p>All cats : ${cats.rows
    .map((row) => row.petname)
    .join(", ")}</p></body></html>`;
});
