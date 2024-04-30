type User = {
  id: string;
  name: string | undefined;
  lastIpAddress: string | undefined;
};

export class Users {
  private users: Map<
    string,
    { id: string; name: string | undefined; lastIpAddress: string | undefined }
  > = new Map();

  constructor(private readonly maxEntries: number = 1000) {}

  addUser(user: User) {
    const existing = this.users.get(user.id);
    if (existing) {
      existing.name = user.name;
      existing.lastIpAddress = user.lastIpAddress;
      return;
    }

    if (this.users.size >= this.maxEntries) {
      const firstAdded = this.users.keys().next().value;
      this.users.delete(firstAdded);
    }

    this.users.set(user.id, {
      id: user.id,
      name: user.name,
      lastIpAddress: user.lastIpAddress,
    });
  }

  asArray() {
    return Array.from(this.users.entries()).map(([key, user]) => {
      return {
        id: user.id,
        name: user.name,
        lastIpAddress: user.lastIpAddress,
      };
    });
  }

  clear() {
    this.users.clear();
  }
}
