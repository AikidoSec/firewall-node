import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function nextMiddleware(request:NextRequest) {
    const url = request.nextUrl;
    const cookies = request.cookies.getAll();

    const response = NextResponse.next();
    return response;
}