import type { Request, Response, NextFunction } from "express";
const { AsyncLocalStorage } = require("node:async_hooks");

export const asyncLocalStorage = new AsyncLocalStorage();

let id = 1;
function genId() {
  const current = id;
  id++;

  return current;
}

export function middleware(req: Request, res: Response, next: NextFunction) {
  asyncLocalStorage.run(
    {
      id: genId(),
      request: req,
      response: res,
    },
    () => {
      next();
    }
  );
}
