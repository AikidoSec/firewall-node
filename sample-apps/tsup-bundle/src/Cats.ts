import type BetterSqlite3 from "better-sqlite3";

export class Cats {
  db: BetterSqlite3.Database;

  constructor(db: BetterSqlite3.Database) {
    this.db = db;
  }

  async add(name: string) {
    const result = this.db
      .prepare(`INSERT INTO cats(petname) VALUES ('${name}');`)
      .run();
    return result;
  }

  async byName(name: string) {
    const cats = this.db
      .prepare(`SELECT petname FROM cats WHERE petname = '${name}';`)
      .all() as { petname: string }[];
    return cats.map((row) => row.petname);
  }

  async getAll() {
    const cats = this.db.prepare("SELECT petname FROM cats;").all() as {
      petname: string;
    }[];
    return cats.map((row) => row.petname);
  }
}
