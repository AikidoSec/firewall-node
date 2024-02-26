class Cats {
  constructor(pool) {
    this.pool = pool;
  }

  async add(name) {
    const conn = await this.pool.getConnection();
    // This is unsafe! This is for demo purposes only, you should use parameterized queries.
    await conn.query(`INSERT INTO cats (petname) VALUES ('${name}');`);
    conn.end();
  }

  async getAll() {
    const conn = await this.pool.getConnection();
    const cats = await conn.query("SELECT petname FROM cats;");
    conn.end();

    return cats.map((row) => row.petname);
  }
}

module.exports = Cats;
