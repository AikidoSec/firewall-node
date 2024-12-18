// Based on https://github.com/demskie/netparser
// MIT License - Copyright (c) 2019 alex

import { Network } from "./Network";

const BEFORE = -1;
const EQUALS = 0;
const AFTER = 1;

export function nativeSort(networks: Network[]) {
  return networks.sort((a, b) => {
    const aBytes = a.addr.bytes();
    const bBytes = b.addr.bytes();
    if (aBytes.length !== bBytes.length) return aBytes.length - bBytes.length;
    for (let i = 0; i < aBytes.length; i++) {
      if (aBytes[i] !== bBytes[i]) return aBytes[i] - bBytes[i];
    }
    if (a.cidr() !== b.cidr()) return a.cidr() - b.cidr();
    return 0;
  });
}

export function binarySearchForInsertionIndex(
  network: Network,
  sortedNetworks: Network[]
) {
  if (!sortedNetworks || sortedNetworks.length === 0) return 0;
  let left = 0;
  let right = sortedNetworks.length - 1;
  while (left < right) {
    const middle = Math.floor(left + (right - left) / 2);
    switch (sortedNetworks[middle].compare(network)) {
      case EQUALS:
        return middle + 1;
      case BEFORE:
        left = middle + 1;
        break;
      case AFTER:
        right = middle - 1;
        break;
    }
  }
  if (sortedNetworks[left].compare(network) === BEFORE) return left + 1;
  return left;
}
