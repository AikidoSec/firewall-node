import { getConnection } from "~/.server/db";
import type { Route } from "./+types/home";
import { useFetcher } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sample React Router App" },
    { name: "description", content: "Hello world!" },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const db = await getConnection();

  const result = await db.query("SELECT * FROM cats_5;");

  return {
    cats: result.rows,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher();

  const { cats } = loaderData;

  return (
    <main className="flex items-center justify-center pt-16 pb-4">
      <div className="flex-1 flex flex-col items-center gap-16 min-h-0">
        <header className="flex flex-col items-center gap-9">
          <div className="w-[500px] max-w-[100vw] p-4">
            <h1 className="text-4xl font-bold">React Router Sample App</h1>
          </div>
        </header>
        <div className="max-w-[500px] w-full space-y-6 px-4">
          <fetcher.Form method="post" action="/add-cat">
            <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              Create a Cat:
            </h2>
            <div>
              <input
                type="text"
                name="catname"
                id="catname"
                placeholder="Name of the cat"
                required
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              className="mt-3 text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700 dark:border-gray-700"
            >
              {fetcher.state !== "idle" ? "Submitting..." : "Submit"}
            </button>
          </fetcher.Form>

          <hr className="h-px my-8 bg-gray-200 border-0 dark:bg-gray-700" />

          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
            Existing cats:
          </h2>
          <ul className="max-w-md space-y-1 text-gray-500 list-disc list-inside dark:text-gray-400">
            {cats.map((cat: { petname: string }, index: number) => (
              <li key={index}>{cat.petname}</li>
            ))}
            {cats.length === 0 && <li>No cats found.</li>}
          </ul>

          <fetcher.Form method="post" action="/clear-cats">
            <button
              type="submit"
              className="text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 focus:ring-4 focus:ring-gray-100 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-600 dark:focus:ring-gray-700"
            >
              Clear cats
            </button>
          </fetcher.Form>
        </div>
      </div>
    </main>
  );
}
