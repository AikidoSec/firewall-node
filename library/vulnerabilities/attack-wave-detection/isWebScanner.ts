import { type Context } from "../../agent/Context";
import { queryParamsContainsDangerousPayload } from "./queryParamsContainsDangerousPayload";
import { isWebScanMethod } from "./isWebScanMethod";
import { isWebScanPath } from "./isWebScanPath";

export function isWebScanner(context: Context): boolean {
  if (context.method && isWebScanMethod(context.method)) {
    return true;
  }

  if (context.route && isWebScanPath(context.route)) {
    return true;
  }

  if (queryParamsContainsDangerousPayload(context)) {
    return true;
  }

  return false;
}
