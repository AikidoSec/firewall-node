import type { Database } from "./types.ts";
import { Pool, Client } from "pg";
import {
  FileMigrationProvider,
  Kysely,
  Migrator,
  PostgresDialect,
} from "kysely";
import * as path from "path";
import { promises as fs } from "fs";

const dialect = new PostgresDialect({
  pool: new Pool({
    host: "127.0.0.1",
    database: "main_db",
    password: "password",
    port: 27016,
    user: "root",
    max: 3,
  }),
});

export const db = new Kysely<Database>({
  dialect,
});

const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder: path.join(import.meta.dirname, "./migrations"),
  }),
});

const { error, results } = await migrator.migrateToLatest();

results?.forEach((it) => {
  if (it.status === "Success") {
    console.log(`migration "${it.migrationName}" was executed successfully`);
  } else if (it.status === "Error") {
    console.error(`failed to execute migration "${it.migrationName}"`);
  }
});

if (error) {
  console.error("failed to migrate");
  console.error(error);
  process.exit(1);
}
