import type { App } from "./zen/apps.ts";
import type { Request } from "express";

export interface ZenRequest extends Request {
  zenApp?: App;
}
