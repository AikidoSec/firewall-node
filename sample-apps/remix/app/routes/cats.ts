import { db } from "~/db.server";
import { redirect, ActionFunctionArgs } from "@remix-run/node";

export async function action({ request }: ActionFunctionArgs) {
  const body = await request.formData();
  const name = body.get("name");

  if (name) {
    const sqlite = await db();
    await new Promise<void>((resolve, reject) => {
      sqlite.prepare(`INSERT INTO cats (name) VALUES (?)`).run(name, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  return redirect("/");
}
