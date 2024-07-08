class Cats {
  constructor(db) {
    this.db = db;
  }

  async query(sql) {
    return new Promise((resolve, reject) => {
      this.db.query(sql, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  async add(name) {
    console.log(JSON.stringify(getContext(), null, 2));
    // This is unsafe! This is for demo purposes only, you should use parameterized queries.
    await this.query(`INSERT INTO cats(petname) VALUES ('${name}');`);
  }

  async getAll() {
    const cats = await this.query("SELECT petname FROM `cats`;");

    return cats.map((row) => row.petname);
  }
}

module.exports = Cats;
