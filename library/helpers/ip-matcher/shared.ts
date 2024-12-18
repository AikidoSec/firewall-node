// Based on https://github.com/demskie/netparser
// MIT License - Copyright (c) 2019 alex

import * as sort from "./sort";
import { Network } from "./Network";

export function sortNetworks(networks: Network[]) {
  sort.nativeSort(networks);
}

function increaseSizeByOneBit(network: Network): Network {
  const wider = network.setCIDR(network.cidr() - 1);
  wider.addr.applySubnetMask(wider.cidr());
  return wider;
}

export function summarizeSortedNetworks(sorted: Network[]): Network[] {
  const summarized: Network[] = sorted.slice(0, 1);
  for (let idx = 1; idx < sorted.length; idx++) {
    if (summarized[summarized.length - 1].contains(sorted[idx])) {
      continue;
    }
    summarized.push(sorted[idx]);
    while (summarized.length >= 2) {
      const a = summarized[summarized.length - 2];
      const b = summarized[summarized.length - 1];
      if (
        a.cidr() != b.cidr() ||
        !a.addr.isBaseAddress(a.cidr() - 1) ||
        !a.adjacent(b)
      ) {
        break;
      }
      increaseSizeByOneBit(a);
      summarized.pop();
    }
  }
  return summarized;
}

export function parseBaseNetwork(s: string, strict?: boolean) {
  const net = new Network(s);
  if (!net.isValid()) return null;
  if (!strict) {
    net.addr.applySubnetMask(net.cidr());
  } else {
    const original = net.addr.duplicate();
    net.addr.applySubnetMask(net.cidr());
    if (!net.addr.equals(original)) {
      return null;
    }
  }
  return net;
}
