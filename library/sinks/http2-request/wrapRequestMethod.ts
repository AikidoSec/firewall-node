import { getUrlFromRequest } from "./getUrlFromRequest";

/**
 * Wrap .request method of a http2 client
 */
export function wrapRequestMethod(subject: any) {
  const orig = subject.request;

  return function wrapped() {
    const applyOriginal = () =>
      orig.apply(
        // @ts-expect-error We don't know the type of this
        this,
        // eslint-disable-next-line prefer-rest-params
        arguments
      );

    // eslint-disable-next-line prefer-rest-params
    const args = Array.from(arguments);

    const headers = args.length > 0 ? args[0] : {};
    const url = getUrlFromRequest(subject, headers);

    // Todo

    return applyOriginal();
  };
}
