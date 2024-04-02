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
}
