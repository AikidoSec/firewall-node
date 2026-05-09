import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  db.insertInto("catsKysely").values({ name: "Whiskers", age: 2 }).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.deleteFrom("catsKysely").where("name, ", "=", "Whiskers").execute();
}
