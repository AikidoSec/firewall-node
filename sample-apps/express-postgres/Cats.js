const { Client } = require("pg");

class Cats {
  constructor(db) {
    this.db = db;
  }

  async add(petname) {
    // THIS IS VULNERABLE TO SQL INJECTION!
    await this.db.query(`INSERT INTO cats(petname) VALUES ('${petname}');`);
  }

  async all() {
    const cats = await this.db.query("SELECT petname FROM cats;");

    return cats.rows.map((row) => row.petname);
  }
}

module.exports = Cats;
