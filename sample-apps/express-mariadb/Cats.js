class Cats {
  constructor(db) {
    this.db = db;
  }

  async add(petname) {
    const conn = await this.db.getConnection();
    await conn.query(`INSERT INTO cats (petname) VALUES ('${petname}');`);
    conn.end();
  }

  async all() {
    const conn = await this.db.getConnection();
    const [cats] = await this.db.query("SELECT petname FROM cats;");
    conn.end();

    return cats.map((row) => row.petname);
  }
}

module.exports = Cats;
