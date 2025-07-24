export class Token {
  #token: string;

  constructor(token: string) {
    if (!token) {
      throw new Error("Token cannot be empty");
    }
    this.#token = token.trim();
  }

  toString() {
    throw new Error("Please use asString() instead");
  }

  asString() {
    return this.#token;
  }
}
