import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function GET(request) {
  const directory = new URL(request.url).searchParams.get("path") ?? ".";

  // This is a command injection vulnerability. Do not use this in production.
  const files = await execAsync(`ls '${directory}'`);

  return NextResponse.json({
    files: files.split("\n").filter((line) => line),
  });
}
