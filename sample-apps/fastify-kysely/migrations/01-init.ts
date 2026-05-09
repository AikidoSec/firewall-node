import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  db.schema
    .createTable("catsKysely")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("name", "varchar", (col) => col.notNull())
    .addColumn("age", "integer", (col) => col.notNull().defaultTo(1))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("catsKysely").execute();
}
