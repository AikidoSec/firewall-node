import { NextRequest, NextResponse } from "next/server";
import connectMongo from "../lib/mongoose";
import Guestbook from "../lib/GuestBook";
import { runWithContext } from '@aikidosec/guard'

export async function POST(req: NextRequest) {
    await connectMongo();
    const { message } = await req.json();
    await runWithContext(
        {
            body: { message },
            url: req.url,
            method: req.method,
            query: undefined,
            headers: Array.from(req.headers.keys()).reduce((acc, key) => {
                acc[key] = req.headers.get(key);
                return acc;
            }, {}),
            remoteAddress: req.ip,
            cookies: req.cookies.getAll().reduce((acc, cookie) => {
                acc[cookie.name] = cookie.value;
                return acc;
            }, {}),
        },
        async () => {
            await Guestbook.create({ message });
        }
    );
    return NextResponse.json({ message: "Message added" });
}
