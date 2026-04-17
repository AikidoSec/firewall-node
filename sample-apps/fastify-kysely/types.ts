import type { Generated, Insertable, Selectable, Updateable } from "kysely";

export interface Database {
  catsKysely: CatsTable;
}

export interface CatsTable {
  id: Generated<number>;
  name: string;
  age: number;
}

export type Cats = Selectable<CatsTable>;
export type NewCats = Insertable<CatsTable>;
export type CatsUpdate = Updateable<CatsTable>;
