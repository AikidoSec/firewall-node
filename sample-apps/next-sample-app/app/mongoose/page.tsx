import {Form} from "./Form";
import connectMongo from "./lib/mongoose";
import Guestbook from "./lib/GuestBook";

export default async function Page() {
  return (
    <main className="p-16">
      <h1>Mongoose</h1>
      <p>
        This is a simple guestbook app that uses Mongoose to store messages in
        MongoDB in the "guestbook" collection.
      </p>
      <Form />
      <GuestBookMessage />
    </main>
  );
}

async function GuestBookMessage() {
  await connectMongo();
  const message = await Guestbook.find({}, {}, { sort: { _id: -1 } });
  return (
    <div className="flex flex-col items-start gap-2 mt-4">
      <h2>Messages</h2>
      {message.map((m) => (
        <p key={m._id}
          className="inline-block bg-gray-900 text-sm font-bold px-4 py-2 rounded-lg"
        >{m.message}</p>
      ))}
    </div>
  )
}

