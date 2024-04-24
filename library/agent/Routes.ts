export class Routes {
  private routes: Map<string, { method: string; path: string }> = new Map();

  constructor(private readonly maxEntries: number = 200) {}

  addRoute(method: string, path: string) {
    const key = `${method}:${path}`;

    if (this.routes.has(key)) {
      return;
    }

    if (this.routes.size >= this.maxEntries) {
      const firstAdded = this.routes.keys().next().value;
      this.routes.delete(firstAdded);
    }

    this.routes.set(key, { method, path });
  }

  asArray() {
    return Array.from(this.routes.entries()).map(([key, route]) => {
      return {
        method: route.method,
        path: route.path,
      };
    });
  }
}
