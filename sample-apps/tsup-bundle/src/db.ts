import Database from "better-sqlite3";

let db: Database.Database | null = null;

export async function getDB() {
  if (db) {
    return db;
  }

  db = new Database(":memory:");

  db.exec(`CREATE TABLE cats (
      petname TEXT
    );`);

  return db;
}
