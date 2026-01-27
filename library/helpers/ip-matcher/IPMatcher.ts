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

  // Checks if the given IP address is in the list of networks,
  // also checking the IPv4 address if it's an IPv4-mapped IPv6 address.
  public hasWithMappedCheck(ip: string): boolean {
    if (this.has(ip)) {
      return true;
    }

    const ipv4 = this.extractIPv4FromMapped(ip);
    if (ipv4) {
      return this.has(ipv4);
    }

    return false;
  }

  private extractIPv4FromMapped(ip: string): string | null {
    const net = new Network(ip);
    if (!net.isValid()) {
      return null;
    }

    const bytes = net.addr.bytes();
    if (bytes.length !== 16) {
      return null;
    }

    // Check IPv4-mapped: first 10 bytes = 0, bytes 10-11 = 0xffff
    for (let i = 0; i < 10; i++) {
      if (bytes[i] !== 0) {
        return null;
      }
    }
    if (bytes[10] !== 255 || bytes[11] !== 255) {
      return null;
    }

    return `${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`;
  }
}
