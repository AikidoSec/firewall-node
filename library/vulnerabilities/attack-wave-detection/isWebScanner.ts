import { type Context } from "../../agent/Context";
import { queryParamsContainDangerousPayload } from "./queryParamsContainDangerousPayload";
import { isWebScanMethod } from "./isWebScanMethod";
import { isWebScanPath } from "./isWebScanPath";

export function isWebScanner(context: Context): boolean {
  if (context.method && isWebScanMethod(context.method)) {
    return true;
  }

  if (context.route && isWebScanPath(context.route)) {
    return true;
  }

  if (queryParamsContainDangerousPayload(context)) {
    return true;
  }

  return false;
}
