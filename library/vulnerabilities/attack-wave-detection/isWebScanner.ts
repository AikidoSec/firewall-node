import { type Context } from "../../agent/Context";
import { hasForeignExtension } from "./hasForeignExtension";
import { queryParamsContainDangerousPayload } from "./queryParamsContainDangerousPayload";
import { isWebScanMethod } from "./isWebScanMethod";
import { isWebScanPath } from "./isWebScanPath";

export function isWebScanner(context: Context, statusCode: number): boolean {
  if (context.method && isWebScanMethod(context.method)) {
    return true;
  }

  if (context.route && isWebScanPath(context.route)) {
    return true;
  }

  if (queryParamsContainDangerousPayload(context)) {
    return true;
  }

  if (
    statusCode === 404 &&
    context.route &&
    hasForeignExtension(context.route)
  ) {
    return true;
  }

  return false;
}
