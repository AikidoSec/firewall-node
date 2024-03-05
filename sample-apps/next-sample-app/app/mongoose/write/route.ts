import { NextRequest, NextResponse } from "next/server";
import connectMongo from "../lib/mongoose";
import Guestbook from "../lib/GuestBook";

export async function POST(req: NextRequest) {
    await connectMongo();
    const { message } = await req.json();
    await Guestbook.create({ message });
    return NextResponse.json({ message: "Message added" });
}
