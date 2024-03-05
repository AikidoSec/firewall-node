import {Form} from "./Form";
import connectMongo from "@/app/mongoose/lib/mongoose";
import Guestbook from "@/app/mongoose/lib/GuestBook";

export default async function Page() {
  
  return (
    <main className="p-16">
      <h1>MongoDB Example</h1>
      <p>
        This is a NoSQL injection example. The application uses MongoDB as a
        database.
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

