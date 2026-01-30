import sqlite3 from "sqlite3";
let db: sqlite3.Database;

export async function getDB() {
  if (db) {
    return db;
  }

  db = new sqlite3.Database(":memory:");

  await new Promise<void>((resolve, reject) => {
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
