type User = {
  id: string;
  name: string | undefined;
  lastIpAddress: string | undefined;
};

export class Users {
  private users: Map<
    string,
    {
      id: string;
      name: string | undefined;
      lastIpAddress: string | undefined;
      firstSeenAt: number;
      lastSeenAt: number;
    }
  > = new Map();

  constructor(private readonly maxEntries: number = 1000) {}

  addUser(user: User) {
    const existing = this.users.get(user.id);
    if (existing) {
      existing.name = user.name;
      existing.lastIpAddress = user.lastIpAddress;
      existing.lastSeenAt = Date.now();
      return;
    }

    if (this.users.size >= this.maxEntries) {
      const firstAdded = this.users.keys().next().value;
      if (firstAdded) {
        this.users.delete(firstAdded);
      }
    }

    this.users.set(user.id, {
      id: user.id,
      name: user.name,
      lastIpAddress: user.lastIpAddress,
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
    });
  }

  asArray() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return Array.from(this.users.entries()).map(([key, user]) => {
      return {
        id: user.id,
        name: user.name,
        lastIpAddress: user.lastIpAddress,
        firstSeenAt: user.firstSeenAt,
        lastSeenAt: user.lastSeenAt,
      };
    });
  }

  clear() {
    this.users.clear();
  }
}
