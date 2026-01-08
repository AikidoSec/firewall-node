export type Kind =
  | "nosql_injection"
  | "sql_injection"
  | "shell_injection"
  | "path_traversal"
  | "ssrf"
  | "stored_ssrf"
  | "code_injection"
  | "prompt_injection";

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
      return "a server-side request forgery";
    case "stored_ssrf":
      return "a stored server-side request forgery";
    case "code_injection":
      return "a JavaScript injection";
    case "prompt_injection":
      return "a prompt injection";
  }
}
