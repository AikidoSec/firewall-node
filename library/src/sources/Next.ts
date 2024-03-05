import { NextRequest, NextResponse } from "next/server";
import { runWithContext } from "../agent/Context";

export function nextMiddleware(req: NextRequest) {
  // console.log(req.headers);
  // console.log(req.nextUrl);
  // console.log(req.cookies);

  runWithContext(
    {
      method: req.method,
      remoteAddress: req.ip,
      body: req.body ? req.body : undefined,
      url: req.url,
      headers: {},
      query: {},
      cookies: {} //req.cookies ? req.cookies : {},
    },
    () => {
      const response = NextResponse.next();
      return response;
    }
  );
};