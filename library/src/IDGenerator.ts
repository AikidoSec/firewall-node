import { ulid } from "ulid";

export interface IDGenerator {
  generate(): string;
}

export class IDGeneratorULID implements IDGenerator {
  generate(): string {
    return ulid();
  }
}

// For testing purposes
export class IDGeneratorFixed implements IDGenerator {
  constructor(private readonly id: string) {}

  generate(): string {
    return this.id;
  }
}
