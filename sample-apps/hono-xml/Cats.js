class Cats {
  /**
   *
   * @param {import("sqlite3").Database} db
   */
  constructor(db) {
    this.db = db;
  }

  async add(name) {
    await new Promise((resolve, reject) => {
      // This is unsafe! This is for demo purposes only, you should use parameterized queries.
      console.log(`INSERT INTO cats(petname) VALUES ('${name}');`);
      this.db.all(
        `INSERT INTO cats(petname) VALUES ('${name}');`,
        (result, err) => {
          if (err) {
            return reject(err);
          }
          resolve(result);
        }
      );
    });
  }

  async byName(name) {
    const cats = await new Promise((resolve, reject) => {
      this.db.all(
        `SELECT petname FROM cats WHERE petname = '${name}';`,
        (err, rows) => {
          if (err) {
            return reject(err);
          }
          resolve(rows);
        }
      );
    });
    return cats.map((row) => row.petname);
  }

  async getAll() {
    const cats = await new Promise((resolve, reject) => {
      this.db.all("SELECT petname FROM cats;", (err, rows) => {
        if (err) {
          return reject(err);
        }
        resolve(rows);
      });
    });
    return cats.map((row) => row.petname);
  }
}

module.exports = Cats;
