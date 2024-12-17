// Based on https://github.com/demskie/netparser
// MIT License - Copyright (c) 2019 alex

import * as shared from "./shared";
import * as sort from "./sort";
import { Network } from "./Network";

export class IPMatcher {
  private readonly sorted = [] as Network[];

  public constructor(networks?: string[]) {
    const subnets = [] as Network[];
    if (networks) {
      for (const s of networks) {
        const net = shared.parseBaseNetwork(s, false);
        if (net && net.isValid()) {
          subnets.push(net);
        }
      }
      shared.sortNetworks(subnets);
      this.sorted = shared.summarizeSortedNetworks(subnets);
    }
  }

  // Checks if the given IP address is in the list of networks.
  public has(network: string): boolean {
    const net = shared.parseBaseNetwork(network, false);
    if (!net || !net.isValid()) {
      return false;
    }
    const idx = sort.binarySearchForInsertionIndex(net, this.sorted);
    if (idx < 0) {
      return false;
    }
    if (idx < this.sorted.length && this.sorted[idx].contains(net)) {
      return true;
    }
    if (idx - 1 >= 0 && this.sorted[idx - 1].contains(net)) {
      return true;
    }
    return false;
  }

  public add(network: string) {
    const net = shared.parseBaseNetwork(network, false);
    if (!net || !net.isValid()) {
      return this;
    }
    const idx = sort.binarySearchForInsertionIndex(net, this.sorted);
    if (idx < this.sorted.length && this.sorted[idx].compare(net) === 0) {
      return this;
    }
    this.sorted.splice(idx, 0, net);
    return this;
  }
}
