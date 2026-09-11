import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [{ title: "react-router-serve sample app" }];
}

export default function Home() {
  return (
    <main>
      <h1>react-router-serve sample app</h1>
      <p>sample app</p>
    </main>
  );
}
