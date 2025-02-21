import { tryParseURL } from "../../helpers/tryParseURL";

export class Hostname {
  private constructor(private readonly url: URL) {}

  static fromURL(url: URL) {
    return new Hostname(url);
  }

  static fromString(str: string) {
    const url = tryParseURL(`http://${str}`);

    if (!url) {
      return undefined;
    }

    return new Hostname(url);
  }

  asString() {
    return this.url.hostname;
  }

  toString() {
    throw new Error("Use asString() instead");
  }
}
