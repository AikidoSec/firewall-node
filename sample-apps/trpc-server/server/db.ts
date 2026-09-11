import { DatabaseSync } from "node:sqlite";

export const db = new DatabaseSync(":memory:");

db.exec(
  `CREATE TABLE cats (
    petname TEXT
  );`
);
