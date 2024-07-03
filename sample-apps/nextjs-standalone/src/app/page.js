"use client";

import useSWR from "swr";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function Home() {
  const { data, isLoading, mutate } = useSWR("/cats", fetcher);

  return (
    <main>
      <h1>Next.js</h1>
      <p>This is a vulnerable Next.js sample app.</p>
      <h2>Cats</h2>
      <ul>
        {data?.map((cat) => (
          <li key={cat}>{cat}</li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const name = e.target.name.value;
          fetch("/cats", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ name }),
          })
            .then(() => {
              e.target.reset();
              mutate();
            })
            .catch(console.error);
        }}
      >
        <input name="name" type="text" />
        <button type="submit">Add</button>
      </form>
    </main>
  );
}
