export type Kind = "nosql_injection" | "sql_injection";

export function attackKindHumanName(kind: Kind) {
  switch (kind) {
    case "nosql_injection":
      return "NoSQL injection";
    case "sql_injection":
      return "SQL injection";
  }
}
