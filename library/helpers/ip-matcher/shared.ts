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
  const summarized: Network[] = [];
  for (const network of sorted) {
    summarizeStep(summarized, network);
  }
  return summarized;
}

function summarizeStep(summarized: Network[], network: Network) {
  if (
    summarized.length > 0 &&
    summarized[summarized.length - 1].contains(network)
  ) {
    return;
  }
  summarized.push(network);
  while (summarized.length >= 2) {
    const a = summarized[summarized.length - 2];
    const b = summarized[summarized.length - 1];
    if (
      // oxlint-disable-next-line eqeqeq
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

function yieldToEventLoop() {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

// How often to yield to the event loop while building a large IP list
// Counted in processed networks
const YIELD_EVERY = 5000;

export async function summarizeSortedNetworksAsync(
  sorted: Network[]
): Promise<Network[]> {
  const summarized: Network[] = [];
  for (let idx = 0; idx < sorted.length; idx++) {
    summarizeStep(summarized, sorted[idx]);
    if (idx > 0 && idx % YIELD_EVERY === 0) {
      await yieldToEventLoop();
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

export async function parseNetworksAsync(
  networks: string[]
): Promise<Network[]> {
  const subnets: Network[] = [];
  for (let i = 0; i < networks.length; i++) {
    const net = parseBaseNetwork(networks[i], false);
    if (net && net.isValid()) {
      subnets.push(net);
    }
    if (i > 0 && i % YIELD_EVERY === 0) {
      await yieldToEventLoop();
    }
  }
  return subnets;
}
