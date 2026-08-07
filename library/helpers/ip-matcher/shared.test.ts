import * as t from "tap";
import * as shared from "./shared";
import { Network } from "./Network";

function describeNetworks(networks: Network[]) {
  return networks.map((n) => ({ bytes: n.addr.bytes(), cidr: n.cidr() }));
}

t.test(
  "parseNetworksAsync parses the same networks as parseBaseNetwork, skipping invalid ones",
  async (t) => {
    const input = [
      "192.168.0.0/24",
      "foobar",
      "10.0.0.1",
      "123.123.123.123/1999",
      "",
      ",,,",
      "2001:db8::1/128",
    ];

    const result = await shared.parseNetworksAsync(input);
    const expected = input
      .map((s) => shared.parseBaseNetwork(s, false))
      .filter((n): n is Network => !!n && n.isValid());

    t.same(describeNetworks(result), describeNetworks(expected));
  }
);

t.test(
  "parseNetworksAsync returns an empty array for an empty list",
  async (t) => {
    t.same(await shared.parseNetworksAsync([]), []);
  }
);

t.test(
  "parseNetworksAsync parses every entry in a list large enough to cross yield boundaries",
  async (t) => {
    const count = 12001;
    const input = Array.from(
      { length: count },
      (_, i) =>
        `10.${Math.floor(i / 65536)}.${Math.floor(i / 256) % 256}.${i % 256}/32`
    );

    const result = await shared.parseNetworksAsync(input);
    t.equal(result.length, count);
  }
);

t.test(
  "summarizeSortedNetworksAsync produces the same result as summarizeSortedNetworks",
  async (t) => {
    const input = [
      "192.168.0.0/32",
      "192.168.0.1/32",
      "192.168.0.2/32",
      "192.168.0.3/32",
      "192.168.0.24/32",
      "192.168.0.52/32",
    ];
    const parsed = input.map((s) => shared.parseBaseNetwork(s, false)!);
    shared.sortNetworks(parsed);

    const syncResult = shared.summarizeSortedNetworks(
      parsed.map((n) => n.duplicate())
    );
    const asyncResult = await shared.summarizeSortedNetworksAsync(
      parsed.map((n) => n.duplicate())
    );

    t.same(describeNetworks(asyncResult), describeNetworks(syncResult));
    t.same(describeNetworks(asyncResult), [
      { bytes: [192, 168, 0, 0], cidr: 30 },
      { bytes: [192, 168, 0, 24], cidr: 32 },
      { bytes: [192, 168, 0, 52], cidr: 32 },
    ]);
  }
);

t.test(
  "summarizeSortedNetworksAsync returns an empty array for an empty list",
  async (t) => {
    t.same(await shared.summarizeSortedNetworksAsync([]), []);
  }
);

t.test(
  "summarizeSortedNetworksAsync matches summarizeSortedNetworks across a list large enough to cross yield boundaries",
  async (t) => {
    const count = 12001;
    const input = Array.from(
      { length: count },
      (_, i) => `10.0.${Math.floor(i / 256)}.${i % 256}/32`
    );
    const parsed = input.map((s) => shared.parseBaseNetwork(s, false)!);
    shared.sortNetworks(parsed);

    const syncResult = shared.summarizeSortedNetworks(
      parsed.map((n) => n.duplicate())
    );
    const asyncResult = await shared.summarizeSortedNetworksAsync(
      parsed.map((n) => n.duplicate())
    );

    t.same(describeNetworks(asyncResult), describeNetworks(syncResult));
  }
);
