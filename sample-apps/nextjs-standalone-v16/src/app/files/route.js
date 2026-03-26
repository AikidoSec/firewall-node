import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function GET(request) {
  let directory = new URL(request.url).searchParams.get("path") ?? ".";
  if (!directory.length) {
    directory = ".";
  }

  // This is a command injection vulnerability. Do not use this in production.
  const result = await execAsync(`ls '${directory}'`);

  let stdout, stderr;
  if (typeof result === "string") {
    stdout = result;
    stderr = "";
  } else {
    stdout = result.stdout;
    stderr = result.stderr;
  }

  if (stderr && stderr.length > 0) {
    return NextResponse.error(new Error(stderr));
  }

  if (!stdout || stdout.length === 0) {
    return NextResponse.json({ files: [] });
  }

  return NextResponse.json({
    files: stdout.split("\n").filter((line) => line),
  });
}

export async function POST(request) {
  const body = await request.json();
  let directory = body.path ?? ".";
  if (!directory.length) {
    directory = ".";
  }

  // This is a command injection vulnerability. Do not use this in production.
  const result = await execAsync(`ls '${directory}'`);

  let stdout, stderr;
  if (typeof result === "string") {
    stdout = result;
    stderr = "";
  } else {
    stdout = result.stdout;
    stderr = result.stderr;
  }

  if (stderr && stderr.length > 0) {
    return NextResponse.error(new Error(stderr));
  }

  if (!stdout || stdout.length === 0) {
    return NextResponse.json({ files: [] });
  }

  return NextResponse.json({
    files: stdout.split("\n").filter((line) => line),
  });
}
