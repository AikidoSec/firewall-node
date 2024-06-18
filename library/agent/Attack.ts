export type Kind =
  | "nosql_injection"
  | "sql_injection"
  | "shell_injection"
  | "path_traversal"
  | "ssrf";

export function attackKindHumanName(kind: Kind) {
  switch (kind) {
    case "nosql_injection":
      return "a NoSQL injection";
    case "sql_injection":
      return "an SQL injection";
    case "shell_injection":
      return "a shell injection";
    case "path_traversal":
      return "a path traversal attack";
    case "ssrf":
      return "Server-side request forgery";
  }
}
