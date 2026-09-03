import { createConnection } from "@/db";

export class Cats {
  async add(name) {
    // This is unsafe! This is for demo purposes only, you should use parameterized queries.
    const conn = await createConnection();
    await conn.query(`INSERT INTO cats (petname) VALUES ('${name}');`);
    await conn.end();
  }

  async getAll() {
    const conn = await createConnection();
    const cats = await conn.query("SELECT petname FROM cats;");
    await conn.end();

    return cats.rows.map((row) => row.petname);
  }
}
