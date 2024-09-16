import type { ClientHttp2Session, ClientHttp2Stream } from "http2";
import { getUrlFromRequest } from "./getUrlFromRequest";
import { wrapEventListeners } from "./wrapEventListeners";

/**
 * Wrap .request method of a http2 client
 */
export function wrapRequestMethod(subject: ClientHttp2Session) {
  const orig = subject.request;

  return function wrapped(this: ClientHttp2Session) {
    const applyOriginal = () =>
      orig.apply(
        this,
        // eslint-disable-next-line prefer-rest-params
        // @ts-expect-error Not type safe
        arguments
      );

    // eslint-disable-next-line prefer-rest-params
    const args = Array.from(arguments);

    const headers = args.length > 0 ? args[0] : {};
    const url = getUrlFromRequest(subject, headers);

    const stream = applyOriginal() as ClientHttp2Stream;

    if (url && typeof stream === "object" && stream !== null) {
      wrapEventListeners(stream, url);
    }

    return stream;
  };
}
