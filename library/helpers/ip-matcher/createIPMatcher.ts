import {
  loadNodeInternals,
  type NativeIPMatcher as NativeIPMatcherBinding,
} from "../loadNodeInternals";
import { extractIPv4FromMapped } from "../extractIPv4FromMapped";
import { IPMatcher as JavaScriptIPMatcher } from "./IPMatcher";

export interface IPMatcher {
  has(network: string): boolean;
  hasWithMappedCheck(ip: string): boolean;
}

class NativeIPMatcher implements IPMatcher {
  constructor(private readonly matcher: NativeIPMatcherBinding) {}

  has(network: string): boolean {
    return this.matcher.has(network);
  }

  hasWithMappedCheck(ip: string): boolean {
    if (this.has(ip)) {
      return true;
    }

    const ipv4 = extractIPv4FromMapped(ip);
    return ipv4 ? this.has(ipv4) : false;
  }
}

let nativeIPMatcherFactory:
  | ((networks: string[]) => Promise<NativeIPMatcherBinding>)
  | undefined;
let nativeIPMatcherFactoryLoaded = false;
let didWarnAboutJavaScriptIPMatcher = false;

export async function createIPMatcher(networks: string[]): Promise<IPMatcher> {
  if (!nativeIPMatcherFactoryLoaded) {
    nativeIPMatcherFactoryLoaded = true;
    const { bindings } = loadNodeInternals();
    nativeIPMatcherFactory = bindings?.createIPMatcher;
  }

  if (nativeIPMatcherFactory) {
    return new NativeIPMatcher(await nativeIPMatcherFactory(networks));
  }

  if (!didWarnAboutJavaScriptIPMatcher) {
    didWarnAboutJavaScriptIPMatcher = true;
    // oxlint-disable-next-line no-console
    console.warn(
      "Aikido: Native IP matcher is unavailable; firewall lists will be built with the slower JavaScript matcher."
    );
  }

  return new JavaScriptIPMatcher(networks);
}
