import sqlite3 from "sqlite3";

/** @type {sqlite3.Database} */
let db;

export async function getDB() {
  if (db) {
    return db;
  }

  db = new sqlite3.Database(":memory:");

  await new Promise((resolve, reject) => {
    db.run(
      `CREATE TABLE cats (
          petname TEXT
        );`,
      (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      }
    );
  });

  return db;
}
