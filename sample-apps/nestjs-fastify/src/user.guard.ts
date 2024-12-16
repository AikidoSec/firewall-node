import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';

import { setUser } from '@aikidosec/firewall';

// This Guard is used for testing rate limiting and should never be used in production

@Injectable()
export class UserGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const req = context.switchToHttp().getRequest();

    // If header X-User-Id is set in the request, set the user ID
    if (req.headers['x-user-id']) {
      setUser({
        id: req.headers['x-user-id'],
      });
    }

    return true;
  }
}
