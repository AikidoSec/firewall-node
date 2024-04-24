// License and copyright notice for this specific file, as required by the MIT license of ipaddr.js:
// Copyright (C) 2011-2017 whitequark <whitequark@whitequark.org>
// https://github.com/whitequark/ipaddr.js/blob/32c4f03d1f392ff8e6e5307c8131762881f9077c/LICENSE
// Taken from https://github.com/whitequark/ipaddr.js/blob/32c4f03d1f392ff8e6e5307c8131762881f9077c/lib/ipaddr.js
export class IPv6 {
  private ipv4Part = "(0?\\d+|0x[a-f0-9]+)";
  private zoneIndex = "%[0-9a-z]{1,}";

  // IPv6-matching regular expressions.
  // For IPv6, the task is simpler: it is enough to match the colon-delimited
  // hexadecimal IPv6 and a transitional variant with dotted-decimal IPv4 at
  // the end.
  private ipv6Part = "(?:[0-9a-f]+::?)+";
  private ipv6Regexes = {
    zoneIndex: new RegExp(this.zoneIndex, "i"),
    native: new RegExp(
      `^(::)?(${this.ipv6Part})?([0-9a-f]+)?(::)?(${this.zoneIndex})?$`,
      "i"
    ),
    deprecatedTransitional: new RegExp(
      `^(?:::)(${this.ipv4Part}\\.${this.ipv4Part}\\.${this.ipv4Part}\\.${this.ipv4Part}(${this.zoneIndex})?)$`,
      "i"
    ),
    transitional: new RegExp(
      `^((?:${this.ipv6Part})|(?:::)(?:${this.ipv6Part})?)${this.ipv4Part}\\.${this.ipv4Part}\\.${this.ipv4Part}\\.${this.ipv4Part}(${this.zoneIndex})?$`,
      "i"
    ),
  };

  // eslint-disable-next-line max-lines-per-function
  private expandIPv6(string: string, parts: number) {
    // More than one '::' means invalid address
    if (string.indexOf("::") !== string.lastIndexOf("::")) {
      return null;
    }

    let colonCount = 0;
    let lastColon = -1;
    let zoneId = (string.match(this.ipv6Regexes.zoneIndex) || [])[0];
    let replacement, replacementCount;

    // Remove zone index and save it for later
    if (zoneId) {
      zoneId = zoneId.substring(1);
      string = string.replace(/%.+$/, "");
    }

    // How many parts do we already have?
    while ((lastColon = string.indexOf(":", lastColon + 1)) >= 0) {
      colonCount++;
    }

    // 0::0 is two parts more than ::
    if (string.substring(0, 2) === "::") {
      colonCount--;
    }

    if (string.substring(-2, 2) === "::") {
      colonCount--;
    }

    // The following loop would hang if colonCount > parts
    if (colonCount > parts) {
      return null;
    }

    // replacement = ':' + '0:' * (parts - colonCount)
    replacementCount = parts - colonCount;
    replacement = ":";
    while (replacementCount--) {
      replacement += "0:";
    }

    // Insert the missing zeroes
    string = string.replace("::", replacement);

    // Trim any garbage which may be hanging around if :: was at the edge in
    // the source string
    if (string[0] === ":") {
      string = string.slice(1);
    }

    if (string[string.length - 1] === ":") {
      string = string.slice(0, -1);
    }

    const partsArray: number[] = (() => {
      const ref = string.split(":");
      const results = [];

      for (let i = 0; i < ref.length; i++) {
        results.push(parseInt(ref[i], 16));
      }

      return results;
    })();

    return {
      parts: partsArray,
      zoneId: zoneId,
    };
  }

  private parse(
    string: string
  ): { parts: number[]; zoneId: string | undefined } | null | undefined {
    let addr, i, match, octet, octets, zoneId;

    if ((match = string.match(this.ipv6Regexes.deprecatedTransitional))) {
      return this.parse(`::ffff:${match[1]}`);
    }

    if (this.ipv6Regexes.native.test(string)) {
      return this.expandIPv6(string, 8);
    }

    if ((match = string.match(this.ipv6Regexes.transitional))) {
      zoneId = match[6] || "";
      addr = match[1];
      if (!match[1].endsWith("::")) {
        addr = addr.slice(0, -1);
      }

      addr = this.expandIPv6(addr + zoneId, 6);
      if (addr != null && addr.parts) {
        octets = [
          parseInt(match[2]),
          parseInt(match[3]),
          parseInt(match[4]),
          parseInt(match[5]),
        ];
        for (i = 0; i < octets.length; i++) {
          octet = octets[i];
          if (!(0 <= octet && octet <= 255)) {
            return null;
          }
        }

        addr.parts.push((octets[0] << 8) | octets[1]);
        addr.parts.push((octets[2] << 8) | octets[3]);

        return {
          parts: addr.parts,
          zoneId: addr.zoneId,
        };
      }
    }

    return undefined;
  }

  normalizeIPAddress(ip: string): any {
    const parsedIp = this.parse(ip);
    if (parsedIp == null) {
      return null;
    }

    return parsedIp.parts.join(".");
  }
}
