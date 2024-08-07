class Cats {
  constructor(db) {
    this.db = db;
  }

  async add(name) {
    // This is unsafe! This is for demo purposes only, you should use parameterized queries.
    await this.db.query(`INSERT INTO cats (petname) VALUES ('${name}');`);
  }

  async getAll() {
    const cats = await this.db.query("SELECT petname FROM cats;");

    return cats.rows.map((row) => row.petname);
  }
}

module.exports = Cats;
