import type { Dispatcher } from "undici";
import { RequestContextStorage } from "./RequestContextStorage";
import { getContext } from "../../agent/Context";
import { tryParseURL } from "../../helpers/tryParseURL";
import { getPortFromURL } from "../../helpers/getPortFromURL";

type Dispatch = Dispatcher["dispatch"];

export function wrapDispatch(orig: Dispatch): Dispatch {
  return function (opts, handler) {
    const context = getContext();

    // If there is no context, we don't need to do anything special
    if (!context) {
      return orig.apply(
        // @ts-expect-error We dont know the type of this
        this,
        [opts, handler]
      );
    }

    if (!opts || !opts.origin) {
      return orig.apply(
        // @ts-expect-error We dont know the type of this
        this,
        [opts, handler]
      );
    }

    let url: URL | undefined;
    if (typeof opts.origin === "string") {
      url = tryParseURL(opts.origin);
    } else if (opts.origin instanceof URL) {
      url = opts.origin;
    }

    if (!url) {
      return orig.apply(
        // @ts-expect-error We dont know the type of this
        this,
        [opts, handler]
      );
    }

    const port = getPortFromURL(url);

    return RequestContextStorage.run({ port }, () => {
      return orig.apply(
        // @ts-expect-error We dont know the type of this
        this,
        [opts, handler]
      );
    });
  };
}
