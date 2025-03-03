class Cats {
  /**
   *
   * @param {import("@libsql/client").Client} db
   */
  constructor(db) {
    this.db = db;
  }

  async add(name) {
    return await this.db.executeMultiple(
      `INSERT INTO cats(petname) VALUES ('${name}');`
    );
  }

  async byName(name) {
    const cats = await this.db.executeMultiple(
      `SELECT petname FROM cats WHERE petname = '${name}';`
    );
    return cats.rows.map((row) => row.petname);
  }

  async getAll() {
    const cats = await this.db.execute("SELECT petname FROM cats;");
    return cats.rows.map((row) => row.petname);
  }
}

module.exports = Cats;
