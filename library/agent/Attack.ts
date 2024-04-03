export type Kind =
  | "nosql_injection"
  | "sql_injection"
  | "shell_injection"
  | "path_traversal";

export function attackKindHumanName(kind: Kind) {
  switch (kind) {
    case "nosql_injection":
      return "NoSQL injection";
    case "sql_injection":
      return "SQL injection";
    case "shell_injection":
      return "Shell injection";
    case "path_traversal":
      return "Path traversal";
  }
}
