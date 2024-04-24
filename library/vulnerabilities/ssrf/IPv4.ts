// Taken from https://github.com/whitequark/ipaddr.js/blob/32c4f03d1f392ff8e6e5307c8131762881f9077c/lib/ipaddr.js
export class IPv4 {
  private ipv4Part = "(0?\\d+|0x[a-f0-9]+)";
  private ipv4Regexes = {
    fourOctet: new RegExp(
      `^${this.ipv4Part}\\.${this.ipv4Part}\\.${this.ipv4Part}\\.${this.ipv4Part}$`,
      "i"
    ),
    threeOctet: new RegExp(
      `^${this.ipv4Part}\\.${this.ipv4Part}\\.${this.ipv4Part}$`,
      "i"
    ),
    twoOctet: new RegExp(`^${this.ipv4Part}\\.${this.ipv4Part}$`, "i"),
    longValue: new RegExp(`^${this.ipv4Part}$`, "i"),
  };

  private octalRegex = new RegExp(`^0[0-7]+$`, "i");
  private hexRegex = new RegExp(`^0x[a-f0-9]+$`, "i");

  private parseIntAuto(string: string): number {
    // Hexadecimal base 16 (0x#)
    if (this.hexRegex.test(string)) {
      return parseInt(string, 16);
    }

    // While octal representation is discouraged by ECMAScript 3
    // and forbidden by ECMAScript 5, we silently allow it to
    // work only if the rest of the string has numbers less than 8.
    if (string[0] === "0" && !isNaN(parseInt(string[1], 10))) {
      if (this.octalRegex.test(string)) {
        return parseInt(string, 8);
      }
      throw new Error(`ipaddr: cannot parse ${string} as octal`);
    }

    // Always include the base 10 radix!
    return parseInt(string, 10);
  }

  // eslint-disable-next-line max-lines-per-function
  private parse(string: string): number[] | null {
    let match, part, value;

    // parseInt recognizes all that octal & hexadecimal weirdness for us
    if ((match = string.match(this.ipv4Regexes.fourOctet))) {
      const results = [];
      for (let i = 1; i < match.length; i++) {
        // starting at 1 because match[0] is the full match string
        part = match[i];
        results.push(this.parseIntAuto(part));
      }
      return results;
    } else if ((match = string.match(this.ipv4Regexes.longValue))) {
      value = this.parseIntAuto(match[1]);
      if (value > 0xffffffff || value < 0) {
        return null;
      }

      // eslint-disable-next-line func-names
      return (function () {
        const results = [];
        let shift;

        for (shift = 0; shift <= 24; shift += 8) {
          results.push((value >> shift) & 0xff);
        }

        return results;
      })().reverse();
    } else if ((match = string.match(this.ipv4Regexes.twoOctet))) {
      const ref = match.slice(1, 4);
      const results = [];

      value = this.parseIntAuto(ref[1]);
      if (value > 0xffffff || value < 0) {
        return null;
      }

      results.push(this.parseIntAuto(ref[0]));
      results.push((value >> 16) & 0xff);
      results.push((value >> 8) & 0xff);
      results.push(value & 0xff);

      return results;
    } else if ((match = string.match(this.ipv4Regexes.threeOctet))) {
      const ref = match.slice(1, 5);
      const results = [];

      value = this.parseIntAuto(ref[2]);
      if (value > 0xffff || value < 0) {
        throw new Error("ipaddr: address outside defined range");
      }

      results.push(this.parseIntAuto(ref[0]));
      results.push(this.parseIntAuto(ref[1]));
      results.push((value >> 8) & 0xff);
      results.push(value & 0xff);

      return results;
    } else {
      return null;
    }
  }

  normalizeIPAddress(ip: string): string | null {
    const parsedIp = this.parse(ip);
    if (parsedIp == null) {
      return null;
    }

    return parsedIp.join(".");
  }
}
