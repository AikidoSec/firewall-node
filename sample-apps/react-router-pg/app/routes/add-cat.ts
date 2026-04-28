import { redirect, type ActionFunctionArgs } from "react-router";
import { getConnection } from "~/.server/db";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const catName = formData.get("catname");

  const db = await getConnection();

  // Insecure
  await db.query(`INSERT INTO cats_5 (petname) VALUES ('${catName}');`);

  return redirect("/", {});
}
