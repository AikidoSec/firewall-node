import { NextRequest, NextResponse } from "next/server";
import connectMongo from "../lib/mongoose";
import Guestbook from "../lib/GuestBook";

export const revalidate = 60 * 60 * 6; // 6 hours

export async function POST(req: NextRequest) {
    await connectMongo();
    const { message } = await req.json();
    console.log("message", message);
    await Guestbook.create({ message });
    return NextResponse.json({ message: "Message added" });
}
