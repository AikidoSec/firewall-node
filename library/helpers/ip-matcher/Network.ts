// Based on https://github.com/demskie/netparser
// MIT License - Copyright (c) 2019 alex

import * as parse from "./parse";
import { Address } from "./Address";

const BEFORE = -1;
const EQUALS = 0;
const AFTER = 1;

export class Network {
  public readonly addr = new Address();
  private netbits = -1;

  public constructor(network?: string) {
    if (network) {
      const net = parse.network(network);
      if (net) {
        this.addr.setBytes(net.bytes);
        this.netbits = net.cidr;
      }
    }
  }

  public destroy() {
    if (!this.addr.isValid()) {
      this.addr.destroy();
    }
    this.netbits = -1;
    return this;
  }

  public cidr() {
    if (this.isValid()) {
      return this.netbits;
    }
    return Number.NaN;
  }

  public isValid() {
    return this.addr.isValid() && this.netbits !== -1;
  }

  public duplicate() {
    const network = new Network();
    if (this.isValid()) {
      network.addr.setBytes(this.addr.bytes().slice());
      network.netbits = this.netbits;
    }
    return network;
  }

  public next() {
    this.addr.increase(this.netbits);
    return this;
  }

  public setCIDR(cidr: number) {
    if (!this.addr.isValid()) {
      this.destroy();
    } else {
      cidr = Math.floor(cidr);
      if (cidr >= 0 && cidr <= this.addr.bytes().length * 8) {
        this.netbits = cidr;
      } else {
        this.destroy();
      }
    }
    return this;
  }

  public compare(network: Network) {
    // check that both networks are valid
    if (!this.isValid() || !network.isValid()) return null;

    // compare addresses
    const cmp = this.addr.compare(network.addr);
    if (cmp !== EQUALS) return cmp;

    // compare subnet mask length
    if (this.netbits < network.netbits) return BEFORE;
    if (this.netbits > network.netbits) return AFTER;

    // otherwise they must be equal
    return EQUALS;
  }

  public contains(network: Network) {
    // check that both networks are valid
    if (!this.isValid() || !network.isValid()) return false;

    // ensure that both IPs are of the same type
    if (this.addr.bytes().length !== network.addr.bytes().length) return false;

    // handle edge cases
    if (this.netbits === 0) return true;
    if (network.netbits === 0) return false;

    // our base address should be less than or equal to the other base address
    if (this.addr.compare(network.addr) === AFTER) return false;

    // get the next network address for both
    const next = this.duplicate().next();
    const otherNext = network.duplicate().next();

    // handle edge case where our next network address overflows
    if (!next.isValid()) return true;

    // handle edge case where other network's next address overflows
    // (it extends to end of address space, but we don't, so we can't contain it)
    if (!otherNext.isValid()) return false;

    // our address should be more than or equal to the other address
    if (next.addr.compare(otherNext.addr) === BEFORE) return false;

    // must be a child subnet
    return true;
  }

  public adjacent(network: Network) {
    // check that both networks are valid
    if (!this.isValid() || !network.isValid()) return false;

    // ensure that both IPs are of the same type
    if (this.addr.bytes().length !== network.addr.bytes().length) return false;

    // handle edge cases
    if (this.netbits === 0 || network.netbits === 0) return true;
    const cmp = this.addr.compare(network.addr);
    if (cmp === EQUALS) return false;

    // ensure that alpha addr contains the baseAddress that comes first
    let alpha: Network, bravo: Network;
    if (cmp === BEFORE) {
      alpha = this.duplicate().next();
      bravo = network;
    } else {
      alpha = network.duplicate().next();
      bravo = this; // oxlint-disable-line no-this-alias
    }

    // if alpha overflows then an adjacency is not possible
    if (!alpha.isValid()) return false;

    // alpha addr should equal bravo for them to be perfectly adjacent
    if (alpha.addr.compare(bravo.addr) === EQUALS) return true;

    // otherwise we aren't adjacent
    return false;
  }
}
