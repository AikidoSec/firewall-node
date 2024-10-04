import { promisify } from "util";

export class Cats {
  /**
   *
   * @param {import("sqlite3").Database} db
   */
  constructor(db) {
    this.db = db;
    this.all = promisify(this.db.all).bind(this.db);
  }

  async add(name) {
    const result = await this.all(
      `INSERT INTO cats(petname) VALUES ('${name}');`
    );
    return result;
  }

  async byName(name) {
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
