interface Item<K, V> {
  expiry: number;
  key: K;
  prev: Item<K, V> | null;
  next: Item<K, V> | null;
  value: V;
}

export class LRUMap<K, V> {
  private first: Item<K, V> | null;
  private items: Map<K, Item<K, V>>;
  private last: Item<K, V> | null;
  private readonly max: number;
  private readonly ttl: number;

  constructor(max: number = 1000, ttlInMsecs: number = 0) {
    if (isNaN(max) || max < 0) {
      throw new Error("Invalid max value");
    }

    if (isNaN(ttlInMsecs) || ttlInMsecs < 0) {
      throw new Error("Invalid ttl value");
    }

    this.first = null;
    this.items = new Map<K, Item<K, V>>();
    this.last = null;
    this.max = max;
    this.ttl = ttlInMsecs;
  }

  get size(): number {
    return this.items.size;
  }

  private bumpLru(item: Item<K, V>): void {
    if (this.last === item) {
      return; // Item is already the last one, no need to bump
    }

    const last = this.last;
    const next = item.next;
    const prev = item.prev;

    if (this.first === item) {
      this.first = next;
    }

    item.next = null;
    item.prev = last;
    if (last) last.next = item;

    if (prev !== null) {
      prev.next = next;
    }

    if (next !== null) {
      next.prev = prev;
    }

    this.last = item;
  }

  clear(): void {
    this.items = new Map<K, Item<K, V>>();
    this.first = null;
    this.last = null;
  }

  delete(key: K): void {
    if (this.items.has(key)) {
      const item = this.items.get(key) as Item<K, V>;

      this.items.delete(key);

      if (item.prev !== null) {
        item.prev.next = item.next;
      }

      if (item.next !== null) {
        item.next.prev = item.prev;
      }

      if (this.first === item) {
        this.first = item.next;
      }

      if (this.last === item) {
        this.last = item.prev;
      }
    }
  }

  private evict(): void {
    if (this.size > 0) {
      const item = this.first as Item<K, V>;

      this.items.delete(item.key);

      if (this.size === 0) {
        this.first = null;
        this.last = null;
      } else {
        this.first = item.next;
        if (this.first) this.first.prev = null;
      }
    }
  }

  get(key: K): V | undefined {
    if (this.items.has(key)) {
      const item = this.items.get(key) as Item<K, V>;

      // Item has already expired
      if (this.ttl > 0 && item.expiry <= performance.now()) {
        this.delete(key);
        return;
      }

      // Item is still fresh
      this.bumpLru(item);
      return item.value;
    }
  }

  keys(): IterableIterator<K> {
    return this.items.keys();
  }

  set(key: K, value: V): void {
    // Replace existing item
    if (this.items.has(key)) {
      const item = this.items.get(key) as Item<K, V>;
      item.value = value;

      item.expiry = this.ttl > 0 ? performance.now() + this.ttl : this.ttl;

      if (this.last !== item) {
        this.bumpLru(item);
      }

      return;
    }

    // Add new item
    if (this.max > 0 && this.size === this.max) {
      this.evict();
    }

    const item: Item<K, V> = {
      expiry: this.ttl > 0 ? performance.now() + this.ttl : this.ttl,
      key: key,
      prev: this.last,
      next: null,
      value,
    };

    this.items.set(key, item);

    if (this.size === 1) {
      this.first = item;
    } else {
      if (this.last) this.last.next = item;
    }

    this.last = item;
  }
}
