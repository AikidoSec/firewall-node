import { Injectable } from "@nestjs/common";
import { Database } from "sqlite3";
import { promisify } from "util";

@Injectable()
export class DBService {
  private db: Database;
  private run: (sql: string) => Promise<Database>;
  private all: (sql: string) => Promise<{ petname: string }[]>;

  constructor() {
    this.db = new Database(":memory:");
    this.run = promisify(this.db.run).bind(this.db);
    this.all = promisify(this.db.all).bind(this.db);

    this.run("CREATE TABLE cats (petname text)");
  }

  async getCats(name?: string): Promise<string[]> {
    if (name) {
      return (
        await this.all(`SELECT * FROM cats WHERE petname = '${name}'`)
      ).map((row) => row.petname);
    }

    return (await this.all("SELECT * FROM cats")).map((row) => row.petname);
  }

  async addCat(name: string): Promise<void> {
    await this.run(`INSERT INTO cats (petname) VALUES ('${name}')`);
  }
}
