import { redirect } from "react-router";
import { getConnection } from "~/.server/db";

export async function action() {
  const db = await getConnection();

  await db.query(`DELETE FROM cats_5;`);

  return redirect("/", {});
}
