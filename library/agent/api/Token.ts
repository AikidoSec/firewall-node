export class Token {
  constructor(private readonly token: string) {
    if (!this.token) {
      throw new Error("Token cannot be empty");
    }
  }

  toString() {
    throw new Error("Please use asString() instead");
  }

  asString() {
    return this.token;
  }

  private parse() {
    const parts = this.token.split("_");

    if (parts.length !== 5) {
      throw new Error("Invalid token format");
    }

    return {
      serviceId: parts[3],
    };
  }

  getServiceId() {
    const { serviceId } = this.parse();

    return serviceId;
  }
}
