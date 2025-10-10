import type { Database } from "sqlite3";
import { promisify } from "util";

export class Cats {
  db: Database;
  all;

  constructor(db: Database) {
    this.db = db;
    this.all = promisify(this.db.all).bind(this.db);
  }

  async add(name: string) {
    const result = await this.all(
      `INSERT INTO cats(petname) VALUES ('${name}');`
    );
    return result;
  }

  async byName(name: string) {
    const cats = await this.all(
      `SELECT petname FROM cats WHERE petname = '${name}';`
    );
    return cats.map((row) => row.petname);
  }

  async getAll() {
    const cats = await this.all("SELECT petname FROM cats;");
    return cats.map((row) => row.petname);
  }
}
