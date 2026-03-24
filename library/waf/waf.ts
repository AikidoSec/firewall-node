import {
  wasm_waf_set_rules,
  wasm_waf_evaluate,
} from "../internals/zen_internals";
import type { Context } from "../agent/Context";
import type { WafRule, WafSetRulesResult, WafEvaluateResult } from "./WafRule";

export function setWafRules(rules: WafRule[]): WafSetRulesResult {
  return wasm_waf_set_rules(JSON.stringify(rules));
}

export function evaluateWafRules(context: Context): WafEvaluateResult {
  if (!context.remoteAddress) {
    return { matched: false, error: "Missing remote address" };
  }

  const url = context.url || "/";
  let path = url;
  let query = "";
  const queryIndex = url.indexOf("?");
  if (queryIndex !== -1) {
    path = url.substring(0, queryIndex);
    query = url.substring(queryIndex);
  }

  const host =
    (typeof context.headers?.host === "string"
      ? context.headers.host
      : undefined) || "";

  const requestData = {
    host: host,
    method: context.method || "GET",
    path: path,
    query: query,
    uri: url,
    full_uri: `${host}${url}`,
    user_agent:
      typeof context.headers?.["user-agent"] === "string"
        ? context.headers["user-agent"]
        : undefined,
    cookie:
      typeof context.headers?.cookie === "string"
        ? context.headers.cookie
        : undefined,
    referer:
      typeof context.headers?.referer === "string"
        ? context.headers.referer
        : undefined,
    x_forwarded_for:
      typeof context.headers?.["x-forwarded-for"] === "string"
        ? context.headers["x-forwarded-for"]
        : undefined,
    body: typeof context.body === "string" ? context.body : undefined,
    ip_src: context.remoteAddress,
  };

  return wasm_waf_evaluate(JSON.stringify(requestData));
}
