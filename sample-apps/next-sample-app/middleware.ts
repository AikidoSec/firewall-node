//import {nextMiddleware} from '@aikidosec/guard';

import type { NextRequest } from 'next/server'
 
// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  console.log('middleware')
  // return nextMiddleware(request)
}
 