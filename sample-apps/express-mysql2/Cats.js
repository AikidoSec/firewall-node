class Cats {
  constructor(db) {
    this.db = db;
  }

  async add(petname) {
    // THIS IS VULNERABLE TO SQL INJECTION!
    const conn = await this.db.getConnection();
    await conn.query(`INSERT INTO cats(petname) VALUES ('${petname}');`);
    this.db.releaseConnection(conn);
  }

  async all() {
    const conn = await this.db.getConnection();
    const [cats] = await conn.execute("SELECT petname FROM `cats`;");
    this.db.releaseConnection(conn);

    return cats.map((row) => row.petname);
  }
}

module.exports = Cats;
