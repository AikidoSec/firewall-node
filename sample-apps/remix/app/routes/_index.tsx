import type { LoaderFunction, MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { db } from "~/db.server";

export const meta: MetaFunction = () => {
  return [{ title: "Cats" }];
};

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const search = url.searchParams.get("name") ?? "";
  const sqlite = await db();
  const sql = search
    ? `SELECT * FROM cats WHERE name = '${search}'`
    : `SELECT * FROM cats`;

  return {
    props: {
      cats: await new Promise((resolve, reject) => {
        sqlite.all(sql, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      }),
    },
  };
};

export default function Index() {
  const { props } = useLoaderData<typeof loader>();

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-16">
        <h1 className="text-2xl">Cats</h1>
        <form action="/cats" method="POST">
          <input type="text" name="name" className="border rounded" />
          <button type="submit">Submit</button>
        </form>
        <ul>
          {props.cats.map((cat: { name: string }) => (
            <li>{cat.name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
