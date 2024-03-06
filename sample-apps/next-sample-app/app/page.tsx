import Link from "next/link";

export default function Home() {
  return (
    <main className="grid grid-cols-4 p-16 items-center justify-center">
      <Link href="/mongoose" className="p-4 rounded-md bg-gray-900 hover:bg-gray-800">
        mongoose
      </Link>
    </main>
  );
}
