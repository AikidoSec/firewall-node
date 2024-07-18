import { createConnection } from "@/db";
import { Cats } from "@/Cats";

export async function GET(request) {
  const db = await createConnection();
  const cats = new Cats(db);

  return Response.json(await cats.getAll());
}

export async function POST(request) {
  const db = await createConnection();
  const cats = new Cats(db);
  const json = await request.json();

  if (!json.name) {
    return Response.json({ success: false, error: "Missing name" });
  }

  // This is a SQL injection vulnerability. Do not use this in production.
  await cats.add(json.name);

  return Response.json({ success: true });
}
